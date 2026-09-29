import type { DuelTeamPayloadV1 } from "#system/duel-snapshot";
import { captureMember, contentChecksum, makeTeamPayload } from "#system/duel-snapshot";
import { DEFAULT_MATCH_RULES, normalizeMatchRules } from "#system/match-rules";
import { mockLocalStorage } from "#test/mocks/mock-local-storage";
import { describe, expect, it } from "vitest";
// Le coordinateur est du JavaScript autonome, chargé tel quel par la page coque
// (aucune étape de compilation) : les tests l'importent directement, pour qu'il
// n'existe qu'une seule implémentation.
import {
  battlesNeeded,
  clearJournal,
  duelCapOf,
  duelIdFor,
  duelPrepared,
  duelReady,
  JOURNAL_BACKUP_KEY,
  JOURNAL_KEY,
  journalChecksum,
  loadJournal,
  matchScore,
  newJournal,
  playerProgress,
  recordBattleWon,
  recordDuelResult,
  recordDuelStarted,
  recordDuelTeam,
  recordExtraRound,
  recordSaved,
  resumeJournal,
  saveJournal,
  stableChecksum,
} from "../../../android/shell/match-coordinator.js";

const RULES = normalizeMatchRules({ ...DEFAULT_MATCH_RULES, mode: "blocks", blockSize: 4, blocks: 2 });
const NOW = 1_700_000_000_000;

/** Une équipe figée d'un joueur, au meilleur niveau donné. */
function teamPayload(playerId: "j1" | "j2", duelId: string, bestLevel = 30): DuelTeamPayloadV1 {
  const member = captureMember({
    species: 25,
    level: bestLevel,
    formIndex: 0,
    abilityIndex: 0,
    passive: false,
    shiny: false,
    variant: 0,
    gender: 0,
    nature: 0,
    ivs: [31, 31, 31, 31, 31, 31],
    moveset: [{ moveId: 85, ppUsed: 0, ppUp: 0 }],
  });
  const payload = member === null ? null : makeTeamPayload(playerId, duelId, [member]);
  if (payload === null) {
    throw new Error("instantané de test invalide");
  }
  return payload;
}

/** Les deux joueurs à la frontière, sauvegardés, avec leurs équipes figées. */
function preparedMatch(rules = RULES, levels: [number, number] = [30, 44]) {
  let state = readyAtBoundary(newJournal(rules, "match-1", NOW));
  const duelId = duelIdFor(state);
  state = recordDuelTeam(state, "j1", teamPayload("j1", duelId, levels[0]), NOW).state;
  const second = recordDuelTeam(state, "j2", teamPayload("j2", duelId, levels[1]), NOW);
  return { state: second.state, duelId, accepted: second.accepted };
}

/**
 * Ouvre un match et amène les deux joueurs à la frontière du bloc, sauvegardés.
 *
 * Les identifiants de combat portent le numéro de bloc : ils doivent être
 * uniques sur tout le match, et c'est justement ce que le coordinateur exige.
 */
function readyAtBoundary(state: Record<string, any>) {
  let current = state;
  for (const [index, playerId] of ["j1", "j2"].entries()) {
    for (let battle = 0; battle < battlesNeeded(state); battle++) {
      current = recordBattleWon(current, playerId, `${playerId}-bloc${state.block}-${index}-${battle}`, NOW).state;
    }
    current = recordSaved(current, playerId, state.block, NOW).state;
  }
  return current;
}

describe("match coordinator", () => {
  describe("newJournal", () => {
    it("should open a match on the first block with idle players", () => {
      const state = newJournal(RULES, "match-1", NOW);
      expect(state.block).toBe(1);
      expect(state.phase).toBe("BLOC");
      expect(state.matchId).toBe("match-1");
      expect(state.extraDuels).toBe(0);
      expect(state.outcome).toBeNull();
      for (const playerId of ["j1", "j2"]) {
        expect(state.players[playerId]).toMatchObject({
          pveInBlock: 0,
          pveTotal: 0,
          duelWins: 0,
          atBoundary: false,
          savedSeq: 0,
        });
      }
    });

    it("should require blockSize - 1 battles against the AI", () => {
      expect(battlesNeeded(newJournal(RULES, "match-1", NOW))).toBe(3);
      expect(
        battlesNeeded(newJournal(normalizeMatchRules({ mode: "blocks", blockSize: 10, blocks: 3 }), "m", NOW)),
      ).toBe(9);
    });
  });

  describe("recordBattleWon", () => {
    it("should count a battle and stop the player at the block boundary", () => {
      let state = newJournal(RULES, "match-1", NOW);
      state = recordBattleWon(state, "j1", "b1", NOW).state;
      expect(playerProgress(state, "j1")).toMatchObject({ battles: 1, needed: 3, atBoundary: false });
      expect(state.players.j1.pveTotal).toBe(1);

      state = recordBattleWon(state, "j1", "b2", NOW).state;
      state = recordBattleWon(state, "j1", "b3", NOW).state;
      expect(state.players.j1.atBoundary).toBe(true);
      expect(state.players.j1.requiredSaveSeq).toBe(1);
      expect(state.phase).toBe("ATTENTE");
    });

    it("should refuse a battle once the boundary is reached", () => {
      const state = readyAtBoundary(newJournal(RULES, "match-1", NOW));
      const result = recordBattleWon(state, "j1", "beyond", NOW);
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe("frontière déjà atteinte");
      expect(result.state.players.j1.pveTotal).toBe(3);
    });

    it("should refuse the same battle twice", () => {
      let state = newJournal(RULES, "match-1", NOW);
      state = recordBattleWon(state, "j1", "b1", NOW).state;
      const replay = recordBattleWon(state, "j1", "b1", NOW);
      expect(replay.accepted).toBe(false);
      expect(replay.reason).toBe("combat déjà compté");
      expect(replay.state.players.j1.pveTotal).toBe(1);
    });

    it("should refuse an unknown player or a missing battle id", () => {
      const state = newJournal(RULES, "match-1", NOW);
      expect(recordBattleWon(state, "j3" as never, "b1", NOW).reason).toBe("joueur inconnu");
      expect(recordBattleWon(state, "j1", "", NOW).reason).toBe("identifiant de combat manquant");
    });

    it("should keep the two players independent", () => {
      let state = newJournal(RULES, "match-1", NOW);
      state = recordBattleWon(state, "j1", "b1", NOW).state;
      state = recordBattleWon(state, "j2", "b1", NOW).state;
      state = recordBattleWon(state, "j2", "b2", NOW).state;
      expect(state.players.j1.pveInBlock).toBe(1);
      expect(state.players.j2.pveInBlock).toBe(2);
      expect(state.phase).toBe("BLOC");
    });
  });

  describe("recordSaved", () => {
    it("should only accept a save sequence that moves forward", () => {
      const state = newJournal(RULES, "match-1", NOW);
      expect(recordSaved(state, "j1", 0, NOW).reason).toBe("numéro de sauvegarde périmé");
      const saved = recordSaved(state, "j1", 2, NOW);
      expect(saved.accepted).toBe(true);
      expect(saved.state.players.j1.savedSeq).toBe(2);
      expect(recordSaved(saved.state, "j1", 2, NOW).reason).toBe("numéro de sauvegarde périmé");
    });

    it("should open the duel preparation only once both saves are acknowledged", () => {
      let state = newJournal(RULES, "match-1", NOW);
      for (const battleId of ["b1", "b2", "b3"]) {
        state = recordBattleWon(state, "j1", battleId, NOW).state;
        state = recordBattleWon(state, "j2", battleId, NOW).state;
      }
      expect(state.phase).toBe("ATTENTE");
      expect(duelReady(state)).toBe(false);

      state = recordSaved(state, "j1", 1, NOW).state;
      expect(state.phase).toBe("ATTENTE");
      state = recordSaved(state, "j2", 1, NOW).state;
      expect(state.phase).toBe("PREPARE");
      expect(duelReady(state)).toBe(true);
    });
  });

  describe("recordDuelStarted", () => {
    it("should refuse a duel the preparation has not opened", () => {
      const state = newJournal(RULES, "match-1", NOW);
      expect(recordDuelStarted(state, "duel-1", NOW).reason).toBe("les deux joueurs ne sont pas prêts");
    });

    it("should refuse a missing identifier and a second opening", () => {
      const state = readyAtBoundary(newJournal(RULES, "match-1", NOW));
      expect(recordDuelStarted(state, "", NOW).reason).toBe("identifiant de duel manquant");
      const opened = recordDuelStarted(state, "duel-1", NOW);
      expect(opened.accepted).toBe(true);
      expect(opened.state.phase).toBe("DUEL");
      expect(recordDuelStarted(opened.state, "duel-2", NOW).reason).toBe("duel déjà ouvert");
    });
  });

  describe("recordDuelResult", () => {
    function duelOpened() {
      const state = readyAtBoundary(newJournal(RULES, "match-1", NOW));
      return recordDuelStarted(state, "duel-1", NOW).state;
    }

    it("should credit the winner once and advance the block", () => {
      const result = recordDuelResult(duelOpened(), "duel-1", "j1", NOW);
      expect(result.accepted).toBe(true);
      const state = result.state;
      expect(state.players.j1.duelWins).toBe(1);
      expect(state.players.j2.duelLosses).toBe(1);
      expect(state.block).toBe(2);
      expect(state.phase).toBe("BLOC");
      expect(matchScore(state)).toMatchObject({ j1: 1, j2: 0, finished: false });
      // Les compteurs de bloc repartent de zéro, sans toucher aux totaux.
      expect(state.players.j1.pveInBlock).toBe(0);
      expect(state.players.j1.atBoundary).toBe(false);
      expect(state.players.j1.pveTotal).toBe(3);
    });

    it("should refuse a result without an open duel or from another duel", () => {
      expect(recordDuelResult(newJournal(RULES, "match-1", NOW), "duel-1", "j1", NOW).reason).toBe("aucun duel ouvert");
      expect(recordDuelResult(duelOpened(), "duel-9", "j1", NOW).reason).toBe("résultat d'un autre duel");
      expect(recordDuelResult(duelOpened(), "duel-1", "j3" as never, NOW).reason).toBe("vainqueur inconnu");
    });

    it("should not count a replayed result twice", () => {
      const settled = recordDuelResult(duelOpened(), "duel-1", "j1", NOW).state;
      const replay = recordDuelResult(settled, "duel-1", "j1", NOW);
      expect(replay.accepted).toBe(false);
      expect(replay.state.players.j1.duelWins).toBe(1);
    });

    it("should end the match on the last block and name the winner", () => {
      let state = recordDuelResult(duelOpened(), "duel-1", "j2", NOW).state;
      state = readyAtBoundary(state);
      state = recordDuelStarted(state, "duel-2", NOW).state;
      state = recordDuelResult(state, "duel-2", "j2", NOW).state;
      expect(state.phase).toBe("FINI");
      expect(state.outcome).toBe("j2");
      expect(matchScore(state)).toEqual({ j1: 0, j2: 2, winner: "j2", finished: true });
      expect(recordBattleWon(state, "j1", "after", NOW).reason).toBe("match terminé");
    });

    it("should declare a draw and offer an extra round", () => {
      let state = recordDuelResult(duelOpened(), "duel-1", "j1", NOW).state;
      state = readyAtBoundary(state);
      state = recordDuelStarted(state, "duel-2", NOW).state;
      state = recordDuelResult(state, "duel-2", "j2", NOW).state;
      expect(state.phase).toBe("FINI");
      expect(state.outcome).toBe("draw");
      expect(matchScore(state)).toMatchObject({ winner: "draw" });

      const extra = recordExtraRound(state, NOW);
      expect(extra.accepted).toBe(true);
      expect(extra.state.extraDuels).toBe(1);
      expect(extra.state.block).toBe(3);
      expect(extra.state.outcome).toBeNull();
      // Une manche supplémentaire ne contient aucun combat contre l'IA : les
      // deux joueurs sont à la frontière et le duel peut s'ouvrir aussitôt.
      expect(battlesNeeded(extra.state)).toBe(0);
      expect(extra.state.phase).toBe("PREPARE");
      expect(duelReady(extra.state)).toBe(true);
      expect(recordDuelStarted(extra.state, "duel-3", NOW).accepted).toBe(true);
    });

    it("should refuse an extra round outside a drawn match", () => {
      const state = newJournal(RULES, "match-1", NOW);
      expect(recordExtraRound(state, NOW).reason).toBe("le match n'est pas terminé");
    });
  });

  describe("resumeJournal", () => {
    it("should keep a finished match finished", () => {
      const state = { ...newJournal(RULES, "match-1", NOW), phase: "FINI", outcome: "j1" };
      expect(resumeJournal(state, NOW)).toMatchObject({ phase: "FINI", outcome: "j1" });
    });

    it("should bring an interrupted duel back to its preparation", () => {
      const opened = recordDuelStarted(readyAtBoundary(newJournal(RULES, "match-1", NOW)), "duel-1", NOW).state;
      const resumed = resumeJournal(opened, NOW);
      expect(resumed.phase).toBe("PREPARE");
      expect(resumed.players.j1.duelWins).toBe(0);
      expect(resumed.block).toBe(1);
    });

    it("should fall back to waiting when a save is still missing", () => {
      let state = newJournal(RULES, "match-1", NOW);
      for (const battleId of ["b1", "b2", "b3"]) {
        state = recordBattleWon(state, "j1", battleId, NOW).state;
        state = recordBattleWon(state, "j2", battleId, NOW).state;
      }
      state = { ...state, phase: "DUEL", duelId: "duel-1" };
      expect(resumeJournal(state, NOW).phase).toBe("ATTENTE");
    });
  });

  describe("journal storage", () => {
    it("should round-trip a journal", () => {
      const storage = mockLocalStorage();
      const state = newJournal(RULES, "match-1", NOW);
      saveJournal(storage, state, { commit: true });
      const loaded = loadJournal(storage);
      expect(loaded.restoredFrom).toBe("current");
      expect(loaded.state).toMatchObject({ matchId: "match-1", block: 1, phase: "BLOC" });
      expect(loaded.state.checksum).toBe(journalChecksum(state));
    });

    it("should keep the last validated journal as a fallback", () => {
      const storage = mockLocalStorage();
      saveJournal(storage, newJournal(RULES, "match-1", NOW), { commit: true });
      const advanced = recordBattleWon(newJournal(RULES, "match-1", NOW), "j1", "b1", NOW).state;
      saveJournal(storage, advanced); // écriture provisoire, non validée
      expect(loadJournal(storage).state.players.j1.pveInBlock).toBe(1);

      storage.setItem(JOURNAL_KEY, '{"version":1,"matchId":"match-1"'); // écriture tronquée
      const recovered = loadJournal(storage);
      expect(recovered.restoredFrom).toBe("backup");
      expect(recovered.state.players.j1.pveInBlock).toBe(0);
    });

    it("should ignore a journal whose checksum does not match", () => {
      const storage = mockLocalStorage();
      saveJournal(storage, newJournal(RULES, "match-1", NOW), { commit: true });
      const tampered = JSON.parse(storage.getItem(JOURNAL_KEY) ?? "{}");
      tampered.players.j1.duelWins = 99;
      storage.setItem(JOURNAL_KEY, JSON.stringify(tampered));
      const loaded = loadJournal(storage);
      expect(loaded.restoredFrom).toBe("backup");
      expect(loaded.state.players.j1.duelWins).toBe(0);

      // Les deux copies abîmées : aucun match à reprendre, plutôt qu'un score inventé.
      storage.setItem(JOURNAL_BACKUP_KEY, storage.getItem(JOURNAL_KEY) ?? "");
      expect(loadJournal(storage)).toEqual({ state: null, restoredFrom: null });
    });

    it("should report no match when nothing is stored", () => {
      const storage = mockLocalStorage();
      expect(loadJournal(storage)).toEqual({ state: null, restoredFrom: null });
      clearJournal(storage);
      expect(storage.getItem(JOURNAL_KEY)).toBeNull();
      expect(storage.getItem(JOURNAL_BACKUP_KEY)).toBeNull();
    });

    it("should fingerprint a journal regardless of key order", () => {
      const state = newJournal(RULES, "match-1", NOW);
      const reordered = Object.fromEntries(Object.entries(state).reverse());
      expect(journalChecksum(reordered)).toBe(journalChecksum(state));
      expect(journalChecksum({ ...state, block: 2 })).not.toBe(journalChecksum(state));
    });
  });

  describe("team snapshots", () => {
    it("should name the duel of a block in a way a resume reproduces", () => {
      const state = newJournal(RULES, "match-1", NOW);
      expect(duelIdFor(state)).toBe(duelIdFor({ ...state }));
      expect(duelIdFor(state)).toBe(duelIdFor(resumeJournal(state, NOW)));
      expect(duelIdFor({ ...state, block: 2 })).not.toBe(duelIdFor(state));
      expect(duelIdFor({ ...state, extraDuels: 1 })).not.toBe(duelIdFor(state));
    });

    it("should share its fingerprint with the frame that computed it", () => {
      const payload = teamPayload("j1", "duel-1");
      const { checksum, ...content } = payload;
      expect(stableChecksum(content)).toBe(contentChecksum(content));
      expect(stableChecksum(content)).toBe(checksum);
    });

    it("should accept a team only once the player is at the boundary", () => {
      const state = recordBattleWon(newJournal(RULES, "match-1", NOW), "j1", "b1", NOW).state;
      const result = recordDuelTeam(state, "j1", teamPayload("j1", duelIdFor(state)), NOW);
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe("frontière non atteinte");
    });

    it("should refuse a snapshot of the other player, of another duel or of a broken team", () => {
      const state = readyAtBoundary(newJournal(RULES, "match-1", NOW));
      const duelId = duelIdFor(state);
      expect(recordDuelTeam(state, "j3", teamPayload("j1", duelId), NOW).reason).toBe("joueur inconnu");
      expect(recordDuelTeam(state, "j1", teamPayload("j2", duelId), NOW).reason).toBe("instantané d'un autre joueur");

      const corrupted = teamPayload("j1", duelId);
      corrupted.members[0].level = 99;
      expect(recordDuelTeam(state, "j1", corrupted, NOW).reason).toBe("instantané illisible");
      expect(recordDuelTeam(state, "j1", { ...teamPayload("j1", duelId), version: 99 }, NOW).reason).toBe(
        "instantané illisible",
      );

      const opened = recordDuelTeam(state, "j1", teamPayload("j1", duelId), NOW).state;
      expect(recordDuelTeam(opened, "j2", teamPayload("j2", "autre-duel"), NOW).reason).toBe(
        "instantané d'un autre duel",
      );
    });

    it("should compute the shared cap from both teams, as the frame does", () => {
      const { state } = preparedMatch(RULES, [47, 30]);
      expect(duelCapOf(state)).toBe(30);
      expect(duelCapOf(preparedMatch(RULES, [31, 44]).state)).toBe(30);
      expect(duelCapOf(preparedMatch(RULES, [26, 40]).state)).toBe(25);
      expect(duelCapOf(preparedMatch(RULES, [3, 4]).state)).toBe(1);
    });

    it("should summarise the duel as unprepared until both teams are in", () => {
      const state = readyAtBoundary(newJournal(RULES, "match-1", NOW));
      const duelId = duelIdFor(state);
      expect(duelPrepared(state)).toBe(false);
      expect(duelCapOf(state)).toBeNull();

      const half = recordDuelTeam(state, "j1", teamPayload("j1", duelId), NOW).state;
      expect(duelPrepared(half)).toBe(false);
      expect(duelCapOf(half)).toBeNull();
      expect(half.duelTeams.j1?.duelId).toBe(duelId);
      expect(half.duelTeams.j2).toBeNull();

      const both = recordDuelTeam(half, "j2", teamPayload("j2", duelId), NOW).state;
      expect(duelPrepared(both)).toBe(true);
      expect(both.phase).toBe("PREPARE");
    });

    it("should leave the teams uncapped when the rules ask for the real levels", () => {
      const rules = normalizeMatchRules({ ...RULES, levelCap: "none" });
      const { state } = preparedMatch(rules);
      expect(duelCapOf(state)).toBeNull();
      expect(duelPrepared(state)).toBe(true);
      expect(recordDuelStarted(state, duelIdFor(state), NOW).accepted).toBe(true);
    });

    it("should refuse to open a duel that is not the one the teams were frozen for", () => {
      const { state, duelId } = preparedMatch();
      expect(recordDuelStarted(state, "autre-duel", NOW).reason).toBe("instantané d'un autre duel");
      expect(recordDuelStarted(state, duelId, NOW).accepted).toBe(true);
    });

    it("should still open the provisional duel of a block without snapshots", () => {
      // La manche nulle provisoire n'a pas d'instantanés : elle reste possible,
      // mais elle ne passe pas pour un duel préparé.
      const state = readyAtBoundary(newJournal(RULES, "match-1", NOW));
      expect(duelPrepared(state)).toBe(false);
      expect(recordDuelStarted(state, "duel-provisoire", NOW).accepted).toBe(true);
    });

    it("should rebuild the same duel after a restart", () => {
      const storage = mockLocalStorage();
      const { state, duelId } = preparedMatch();
      saveJournal(storage, state, { commit: true });
      const resumed = resumeJournal(loadJournal(storage).state!, NOW);
      expect(resumed.phase).toBe("PREPARE");
      expect(resumed.duelCap).toBe(30);
      expect(duelPrepared(resumed)).toBe(true);
      // Rien n'a bougé : mêmes équipes, même empreinte, donc même duel.
      expect(resumed.duelTeams).toEqual(state.duelTeams);
      expect(stableChecksum(resumed.duelTeams)).toBe(stableChecksum(state.duelTeams));
      expect(recordDuelStarted(resumed, duelId, NOW).accepted).toBe(true);
    });

    it("should drop the snapshots once the block is settled", () => {
      const { state, duelId } = preparedMatch();
      const opened = recordDuelStarted(state, duelId, NOW).state;
      const settled = recordDuelResult(opened, duelId, "j1", NOW).state;
      expect(settled.block).toBe(2);
      expect(settled.duelTeams).toEqual({ j1: null, j2: null });
      expect(settled.duelCap).toBeNull();
    });

    it("should drop the snapshots of the last block and of an extra round", () => {
      let { state, duelId } = preparedMatch();
      state = recordDuelResult(recordDuelStarted(state, duelId, NOW).state, duelId, "j1", NOW).state;
      state = readyAtBoundary(state);
      const secondDuel = duelIdFor(state);
      state = recordDuelTeam(state, "j1", teamPayload("j1", secondDuel), NOW).state;
      state = recordDuelTeam(state, "j2", teamPayload("j2", secondDuel), NOW).state;
      state = recordDuelResult(recordDuelStarted(state, secondDuel, NOW).state, secondDuel, "j2", NOW).state;
      expect(state.phase).toBe("FINI");
      expect(state.duelTeams).toEqual({ j1: null, j2: null });

      const extra = recordExtraRound(state, NOW).state;
      expect(extra.duelTeams).toEqual({ j1: null, j2: null });
      expect(extra.duelCap).toBeNull();
      // La manche supplémentaire a son propre duel : les équipes du bloc réglé
      // ne peuvent pas resservir, et il faut les redemander.
      expect(extra.duelTeams).toEqual({ j1: null, j2: null });
      const extraDuel = duelIdFor(extra);
      expect(extraDuel).not.toBe(secondDuel);
      expect(recordDuelTeam(extra, "j1", teamPayload("j1", secondDuel), NOW).reason).toBe("instantané d'un autre duel");
      const extraPrepared = recordDuelTeam(extra, "j1", teamPayload("j1", extraDuel), NOW).state;
      expect(duelPrepared(recordDuelTeam(extraPrepared, "j2", teamPayload("j2", extraDuel), NOW).state)).toBe(true);
    });
  });
});
