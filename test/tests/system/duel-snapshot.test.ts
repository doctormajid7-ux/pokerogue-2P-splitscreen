import type { BankEntryV1, DuelMemberData, DuelMemberSource } from "#system/duel-snapshot";
import {
  applyLevelCap,
  applyReinforcements,
  capForRules,
  captureMember,
  captureTeam,
  contentChecksum,
  copyMember,
  copyTeam,
  DUEL_SNAPSHOT_VERSION,
  DUEL_TEAM_MAX,
  duelLevelCap,
  isBankEntry,
  isDuelMember,
  isDuelTeamPayload,
  MIN_DUEL_LEVEL,
  makeTeamPayload,
  teamBestLevel,
  toBuildArguments,
} from "#system/duel-snapshot";
import { DEFAULT_MATCH_RULES, normalizeMatchRules } from "#system/match-rules";
import { describe, expect, it } from "vitest";

/** Un Pokémon d'un run, tel que `new PokemonData(pokemon)` le présente. */
function source(overrides: Partial<DuelMemberSource> = {}): DuelMemberSource {
  return {
    species: 25,
    level: 30,
    formIndex: 0,
    abilityIndex: 0,
    passive: false,
    shiny: false,
    variant: 0,
    gender: 0,
    nature: 3,
    ivs: [31, 20, 10, 5, 0, 31],
    moveset: [
      { moveId: 85, ppUsed: 12, ppUp: 1 },
      { moveId: 86, ppUsed: 0, ppUp: 0 },
    ],
    nickname: "Pika",
    teraType: 13,
    usedTMs: [85],
    customPokemonData: { ability: 9 },
    metWave: 12,
    ...overrides,
  };
}

function member(overrides: Partial<DuelMemberSource> = {}): DuelMemberData {
  const captured = captureMember(source(overrides));
  if (captured === null) {
    throw new Error("fixture invalide");
  }
  return captured;
}

/** Les champs d'index d'une entrée recopient sa copie jouable : c'est l'invariant à tenir. */
function bankEntry(entryId: string, overrides: Partial<BankEntryV1> = {}): BankEntryV1 {
  const level = overrides.level ?? 20;
  return {
    entryId,
    speciesId: 1,
    formIndex: 0,
    variant: 0,
    level,
    caughtAt: 1,
    matchId: "m-1",
    runId: "r-1",
    wave: 10,
    member: member({ species: 1, level, nickname: entryId }),
    ...overrides,
  };
}

describe("duel snapshot", () => {
  describe("captureMember", () => {
    it("should copy every field the rebuild needs", () => {
      const captured = member();
      expect(captured).toEqual({
        species: 25,
        level: 30,
        formIndex: 0,
        abilityIndex: 0,
        passive: false,
        shiny: false,
        variant: 0,
        gender: 0,
        nature: 3,
        ivs: [31, 20, 10, 5, 0, 31],
        moves: [
          { moveId: 85, ppUsed: 0, ppUp: 1 },
          { moveId: 86, ppUsed: 0, ppUp: 0 },
        ],
        nickname: "Pika",
        teraType: 13,
        usedTMs: [85],
        custom: { ability: 9 },
        metWave: 12,
        fusion: null,
      });
    });

    it("should heal the copy: full PP, and no combat state at all", () => {
      const captured = member({ moveset: [{ moveId: 85, ppUsed: 40, ppUp: 0 }] });
      expect(captured.moves[0].ppUsed).toBe(0);
      expect(Object.keys(captured)).not.toContain("hp");
      expect(Object.keys(captured)).not.toContain("status");
      expect(Object.keys(captured)).not.toContain("stats");
      expect(Object.keys(captured)).not.toContain("summonData");
    });

    it("should accept a PokemonData carrying fields the snapshot ignores", () => {
      // Le vrai `PokemonData` porte bien plus que cela : PV, statuts, données de
      // combat, tout est ignoré, et rien de tout cela n'entre dans l'instantané.
      const asRunPokemon = {
        ...source(),
        id: 12,
        player: true,
        hp: 12,
        stats: [100, 50, 60, 70, 80, 90],
        status: { effect: 2 },
        summonData: { statStages: [1, 0, 0, 0, 0, 0, 0] },
        battleData: { turnCount: 4 },
        boss: false,
      } as DuelMemberSource;
      const captured = captureMember(asRunPokemon);
      expect(captured).not.toBeNull();
      expect(captured?.species).toBe(25);
      expect(JSON.stringify(captured)).not.toContain("summonData");
    });

    it("should refuse a source without a usable move", () => {
      expect(captureMember(source({ moveset: [] }))).toBeNull();
      expect(captureMember(source({ moveset: [{ moveId: 0, ppUsed: 0, ppUp: 0 }] }))).toBeNull();
      expect(captureMember(source({ moveset: null as unknown as DuelMemberSource["moveset"] }))).toBeNull();
    });

    it("should refuse a source with more than four moves", () => {
      const moveset = [85, 86, 87, 88, 89].map(moveId => ({ moveId, ppUsed: 0, ppUp: 0 }));
      expect(captureMember(source({ moveset }))).toBeNull();
    });

    it("should refuse a corrupt species or level", () => {
      for (const species of [0, -4, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "25"]) {
        expect(captureMember(source({ species: species as number }))).toBeNull();
      }
      for (const level of [0, -1, 2.5, Number.NaN, 5000]) {
        expect(captureMember(source({ level: level as number }))).toBeNull();
      }
    });

    it("should refuse anything that is not a source", () => {
      for (const payload of [null, undefined, 42, "pikachu", []]) {
        expect(captureMember(payload as unknown as DuelMemberSource)).toBeNull();
      }
    });

    it("should clamp the IVs to the real range and always keep six of them", () => {
      expect(member({ ivs: [-5, 40, 3] }).ivs).toEqual([0, 31, 3, 0, 0, 0]);
      expect(member({ ivs: [] }).ivs).toEqual([0, 0, 0, 0, 0, 0]);
      expect(member({ ivs: [1.9, Number.NaN, 2, 3, 4, 5] }).ivs).toEqual([1, 0, 2, 3, 4, 5]);
    });

    it("should keep the fused half, or refuse a fusion without a species", () => {
      const fused = member({ fusionSpecies: 6, fusionFormIndex: 1, fusionShiny: true, fusionVariant: 2 });
      expect(fused.fusion).toEqual({
        species: 6,
        formIndex: 1,
        abilityIndex: 0,
        shiny: true,
        variant: 2,
        gender: 0,
        teraType: 0,
        custom: null,
      });
      expect(captureMember(source({ fusionFormIndex: 3 }))?.fusion).toBeNull();
      expect(member({ fusionSpecies: 0 }).fusion).toBeNull();
    });

    it("should survive a JSON round trip unchanged", () => {
      const captured = member();
      expect(JSON.parse(JSON.stringify(captured))).toEqual(captured);
      expect(isDuelMember(JSON.parse(JSON.stringify(captured)))).toBe(true);
    });
  });

  describe("captureTeam", () => {
    it("should freeze a team of one to six members", () => {
      const team = captureTeam([source(), source({ species: 6, level: 31 })]);
      expect(team).toHaveLength(2);
      expect(team?.map(captured => captured.species)).toEqual([25, 6]);
      expect(captureTeam(Array.from({ length: DUEL_TEAM_MAX }, () => source()))).toHaveLength(DUEL_TEAM_MAX);
    });

    it("should refuse an empty team, an oversized one and a broken member", () => {
      expect(captureTeam([])).toBeNull();
      expect(captureTeam(Array.from({ length: DUEL_TEAM_MAX + 1 }, () => source()))).toBeNull();
      expect(captureTeam([source(), source({ species: 0 })])).toBeNull();
    });

    it("should copy the team rather than keep a reference", () => {
      const filled = [85, 86].map(moveId => ({ moveId, ppUsed: 9, ppUp: 0 }));
      const sources = [source({ moveset: filled })];
      const team = captureTeam(sources);
      filled[0].ppUsed = 0;
      team![0].ivs[0] = 1;
      expect(team?.[0].moves[0].ppUsed).toBe(0);
      expect(team?.[0].ivs[0]).toBe(1);
    });
  });

  describe("copyMember et copyTeam", () => {
    it("should deep copy, so a stored snapshot is never mutated by its reader", () => {
      const team = captureTeam([source(), source({ species: 6 })])!;
      const copy = copyTeam(team);
      copy[0].level = 99;
      copy[0].ivs[1] = 0;
      copy[0].moves[0].moveId = 1;
      copy[1].usedTMs.push(42);
      expect(team[0].level).toBe(30);
      expect(team[0].ivs[1]).toBe(20);
      expect(team[0].moves[0].moveId).toBe(85);
      expect(team[1].usedTMs).toEqual([85]);
      expect(copyMember(team[0])).toEqual(team[0]);
    });
  });

  describe("contentChecksum", () => {
    it("should give the same fingerprint to the same content, whatever the key order", () => {
      const one = { b: [1, 2], a: { d: 4, c: 3 } };
      const other = { a: { c: 3, d: 4 }, b: [1, 2] };
      expect(contentChecksum(one)).toBe(contentChecksum(other));
      expect(contentChecksum(one)).toMatch(/^[0-9a-f]{8}$/);
    });

    it("should notice a changed value, a changed order and an added field", () => {
      const team = captureTeam([source()])!;
      const other = captureTeam([source({ level: 31 })])!;
      expect(contentChecksum(team)).not.toBe(contentChecksum(other));
      expect(contentChecksum([1, 2])).not.toBe(contentChecksum([2, 1]));
      expect(contentChecksum({ a: 1 })).not.toBe(contentChecksum({ a: 1, b: null }));
    });
  });

  describe("makeTeamPayload", () => {
    it("should build a payload whose checksum matches its content", () => {
      const payload = makeTeamPayload("j1", "d-1", [member()]);
      expect(payload).not.toBeNull();
      expect(payload?.version).toBe(DUEL_SNAPSHOT_VERSION);
      expect(payload?.playerId).toBe("j1");
      expect(payload?.checksum).toMatch(/^[0-9a-f]{8}$/);
      expect(isDuelTeamPayload(payload)).toBe(true);
      expect(isDuelTeamPayload(JSON.parse(JSON.stringify(payload)))).toBe(true);
    });

    it("should refuse an unknown player, an empty duel id or an unusable team", () => {
      expect(makeTeamPayload("j3" as "j1", "d-1", [member()])).toBeNull();
      expect(makeTeamPayload("j1", "", [member()])).toBeNull();
      expect(makeTeamPayload("j1", "d-1", [])).toBeNull();
      expect(
        makeTeamPayload(
          "j1",
          "d-1",
          Array.from({ length: 7 }, () => member()),
        ),
      ).toBeNull();
    });

    it("should not share its members with the caller", () => {
      const team = [member()];
      const payload = makeTeamPayload("j2", "d-1", team);
      team[0].level = 99;
      expect(payload?.members[0].level).toBe(30);
    });
  });

  describe("isDuelTeamPayload", () => {
    const valid = makeTeamPayload("j1", "d-1", [member()])!;

    it("should reject an edited payload, a foreign duel and a foreign player", () => {
      expect(isDuelTeamPayload({ ...valid, members: [{ ...valid.members[0], level: 99 }] })).toBe(false);
      expect(isDuelTeamPayload({ ...valid, duelId: "d-2" })).toBe(false);
      expect(isDuelTeamPayload({ ...valid, playerId: "j2" })).toBe(false);
      expect(isDuelTeamPayload({ ...valid, checksum: "deadbeef" })).toBe(false);
    });

    it("should reject a payload of another revision or without content", () => {
      expect(isDuelTeamPayload({ ...valid, version: DUEL_SNAPSHOT_VERSION + 1 })).toBe(false);
      expect(isDuelTeamPayload({ ...valid, members: [] })).toBe(false);
      for (const payload of [null, undefined, "j1", 42, []]) {
        expect(isDuelTeamPayload(payload)).toBe(false);
      }
    });
  });

  describe("duelLevelCap", () => {
    it("should take the lower of the best levels, rounded down to a multiple of 5", () => {
      expect(duelLevelCap([47, 30])).toBe(30);
      expect(duelLevelCap([31, 47])).toBe(30);
      expect(duelLevelCap([26, 40])).toBe(25);
      expect(duelLevelCap([100, 100])).toBe(100);
    });

    it("should never go below the lowest playable level", () => {
      expect(duelLevelCap([3, 2])).toBe(MIN_DUEL_LEVEL);
      expect(duelLevelCap([])).toBe(MIN_DUEL_LEVEL);
      expect(duelLevelCap([Number.NaN, -5, 0])).toBe(MIN_DUEL_LEVEL);
    });

    it("should read the best level of a team", () => {
      const team = captureTeam([source({ level: 12 }), source({ level: 44 })])!;
      expect(teamBestLevel(team)).toBe(44);
      expect(teamBestLevel([])).toBe(0);
    });
  });

  describe("capForRules", () => {
    it("should cap an automatic match and leave a match on demand alone", () => {
      const automatic = normalizeMatchRules({ ...DEFAULT_MATCH_RULES, mode: "blocks", levelCap: "auto" });
      const none = normalizeMatchRules({ ...DEFAULT_MATCH_RULES, mode: "blocks", levelCap: "none" });
      expect(capForRules(automatic, [47, 30])).toBe(30);
      expect(capForRules(none, [47, 30])).toBeNull();
    });
  });

  describe("applyLevelCap", () => {
    it("should bring down what is above the cap and leave the rest alone", () => {
      const team = captureTeam([source({ level: 44 }), source({ species: 6, level: 12 })])!;
      const capped = applyLevelCap(team, 30);
      expect(capped.map(fighter => fighter.level)).toEqual([30, 12]);
      expect(team.map(fighter => fighter.level)).toEqual([44, 12]);
    });

    it("should keep everything but the level", () => {
      const capped = applyLevelCap([member({ level: 44, fusionSpecies: 6 })], 25);
      expect(capped[0].ivs).toEqual([31, 20, 10, 5, 0, 31]);
      expect(capped[0].moves).toEqual([
        { moveId: 85, ppUsed: 0, ppUp: 1 },
        { moveId: 86, ppUsed: 0, ppUp: 0 },
      ]);
      expect(capped[0].fusion?.species).toBe(6);
      expect(capped[0].nature).toBe(3);
    });

    it("should keep the real levels without a cap", () => {
      const team = captureTeam([source({ level: 44 })])!;
      expect(applyLevelCap(team, null)[0].level).toBe(44);
      expect(applyLevelCap(team, Number.NaN)[0].level).toBe(44);
    });

    it("should not share members with the input", () => {
      const team = captureTeam([source({ level: 44 })])!;
      const capped = applyLevelCap(team, 30);
      capped[0].moves[0].moveId = 1;
      expect(team[0].moves[0].moveId).toBe(85);
    });
  });

  describe("toBuildArguments", () => {
    it("should hand back everything the rebuild reads, and nothing of the run's state", () => {
      const captured = member({ fusionSpecies: 6 });
      const build = toBuildArguments(captured);
      expect(build).toEqual({
        species: 25,
        level: 30,
        abilityIndex: 0,
        formIndex: 0,
        gender: 0,
        shiny: false,
        variant: 0,
        ivs: [31, 20, 10, 5, 0, 31],
        nature: 3,
        moves: [
          { moveId: 85, ppUsed: 0, ppUp: 1 },
          { moveId: 86, ppUsed: 0, ppUp: 0 },
        ],
        nickname: "Pika",
        passive: false,
        teraType: 13,
        usedTMs: [85],
        custom: { ability: 9 },
        metWave: 12,
        fusion: {
          species: 6,
          formIndex: 0,
          abilityIndex: 0,
          shiny: false,
          variant: 0,
          gender: 0,
          teraType: 0,
          custom: null,
        },
      });
      expect(Object.keys(build)).not.toContain("stats");
      expect(Object.keys(build)).not.toContain("hp");
    });

    it("should copy, so the rebuild cannot write back into the snapshot", () => {
      const captured = member();
      const build = toBuildArguments(captured);
      build.ivs[0] = 0;
      build.moves[0].moveId = 1;
      build.usedTMs.push(42);
      expect(captured.ivs[0]).toBe(31);
      expect(captured.moves[0].moveId).toBe(85);
      expect(captured.usedTMs).toEqual([85]);
    });

    it("should round trip: what comes out describes what went in", () => {
      const captured = member({ level: 44, passive: true, shiny: true, variant: 2 });
      const recaptured = captureMember({
        species: captured.species,
        level: captured.level,
        formIndex: captured.formIndex,
        abilityIndex: captured.abilityIndex,
        passive: captured.passive,
        shiny: captured.shiny,
        variant: captured.variant,
        gender: captured.gender,
        nature: captured.nature,
        ivs: captured.ivs,
        moveset: captured.moves,
        nickname: captured.nickname,
        teraType: captured.teraType,
        usedTMs: captured.usedTMs,
        customPokemonData: captured.custom,
        metWave: captured.metWave,
      });
      expect(recaptured).toEqual(captured);
      expect(toBuildArguments(recaptured!)).toEqual(toBuildArguments(captured));
    });
  });

  describe("isBankEntry", () => {
    it("should accept an entry and refuse one whose copy is unusable", () => {
      expect(isBankEntry(bankEntry("e-1"))).toBe(true);
      expect(isBankEntry({ ...bankEntry("e-1"), entryId: "" })).toBe(false);
      expect(isBankEntry({ ...bankEntry("e-1"), member: { species: 1 } })).toBe(false);
      expect(isBankEntry({ ...bankEntry("e-1"), wave: -1 })).toBe(false);
      for (const payload of [null, undefined, "e-1", 42]) {
        expect(isBankEntry(payload)).toBe(false);
      }
    });
  });

  describe("applyReinforcements", () => {
    it("should replace the chosen slot with a copy of the bank entry", () => {
      const team = captureTeam([source({ species: 25 }), source({ species: 6, level: 12 })])!;
      const bank = [bankEntry("e-1", { level: 30 })];
      const outcome = applyReinforcements(team, bank, [{ slot: 1, entryId: "e-1" }], 1);
      expect(outcome.accepted).toBe(true);
      expect(outcome.team.map(fighter => fighter.species)).toEqual([25, 1]);
      expect(outcome.team[1].level).toBe(30);
      expect(bank[0].member.nickname).toBe("e-1");
    });

    it("should copy rather than consume: the bank and the team stay intact", () => {
      const team = captureTeam([source({ species: 25 }), source({ species: 6 })])!;
      const bank = [bankEntry("e-1")];
      const outcome = applyReinforcements(team, bank, [{ slot: 0, entryId: "e-1" }], 1);
      outcome.team[0].level = 99;
      outcome.team[0].moves[0].moveId = 1;
      expect(team[0].species).toBe(25);
      expect(bank).toHaveLength(1);
      expect(bank[0].member.level).toBe(20);
      expect(bank[0].member.moves[0].moveId).toBe(85);
    });

    it("should accept an empty request, even without any allowance", () => {
      const team = captureTeam([source()])!;
      const outcome = applyReinforcements(team, [], [], 0);
      expect(outcome.accepted).toBe(true);
      expect(outcome.team).toEqual(team);
    });

    it("should refuse more reinforcements than the rules allow", () => {
      const team = captureTeam([source(), source({ species: 6 }), source({ species: 9 })])!;
      const bank = [bankEntry("e-1"), bankEntry("e-2")];
      const choices = [
        { slot: 0, entryId: "e-1" },
        { slot: 1, entryId: "e-2" },
      ];
      expect(applyReinforcements(team, bank, choices, 1)).toMatchObject({ accepted: false });
      expect(applyReinforcements(team, bank, choices, 3).accepted).toBe(true);
      expect(applyReinforcements(team, bank, choices, 99).accepted).toBe(true);
    });

    it("should refuse a reinforcement when the configuration forbids them", () => {
      const team = captureTeam([source()])!;
      const outcome = applyReinforcements(team, [bankEntry("e-1")], [{ slot: 0, entryId: "e-1" }], 0);
      expect(outcome.accepted).toBe(false);
      expect(outcome.team).toEqual(team);
    });

    it("should refuse an unknown entry, a slot outside the team and a junk choice", () => {
      const team = captureTeam([source()])!;
      const bank = [bankEntry("e-1")];
      const refusals = [
        [{ slot: 0, entryId: "e-9" }],
        [{ slot: 4, entryId: "e-1" }],
        [{ slot: -1, entryId: "e-1" }],
        [{ slot: 0.5, entryId: "e-1" }],
        [null],
      ];
      for (const choices of refusals) {
        const outcome = applyReinforcements(team, bank, choices as never, 3);
        expect(outcome.accepted).toBe(false);
        expect(outcome.team).toEqual(team);
      }
    });

    it("should refuse the same slot or the same entry twice", () => {
      const team = captureTeam([source(), source({ species: 6 })])!;
      const bank = [bankEntry("e-1"), bankEntry("e-2")];
      expect(
        applyReinforcements(
          team,
          bank,
          [
            { slot: 0, entryId: "e-1" },
            { slot: 0, entryId: "e-2" },
          ],
          3,
        ).accepted,
      ).toBe(false);
      expect(
        applyReinforcements(
          team,
          bank,
          [
            { slot: 0, entryId: "e-1" },
            { slot: 1, entryId: "e-1" },
          ],
          3,
        ).accepted,
      ).toBe(false);
    });

    it("should ignore unusable bank entries instead of trusting them", () => {
      const team = captureTeam([source()])!;
      const bank = [{ ...bankEntry("e-1"), member: { species: 1 } }, bankEntry("e-2")];
      expect(applyReinforcements(team, bank as BankEntryV1[], [{ slot: 0, entryId: "e-1" }], 1).accepted).toBe(false);
      expect(applyReinforcements(team, bank as BankEntryV1[], [{ slot: 0, entryId: "e-2" }], 1).accepted).toBe(true);
    });
  });
});
