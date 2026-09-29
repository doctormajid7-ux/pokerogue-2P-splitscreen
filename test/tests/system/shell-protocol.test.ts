import type { DuelFighter, DuelSide } from "#system/duel-engine";
import { createDuel, duelMovesFor, duelPublicState } from "#system/duel-engine";
import type { DuelTeamPayloadV1 } from "#system/duel-snapshot";
import { captureMember, makeTeamPayload } from "#system/duel-snapshot";
import { DEFAULT_MATCH_RULES, normalizeMatchRules } from "#system/match-rules";
import {
  battleWonMessage,
  duelReadyMessage,
  duelStateMessage,
  duelTeamMessage,
  duelWaitingMessage,
  frameMessage,
  isShellMessage,
  SHELL_PROTOCOL_VERSION,
  savedMessage,
} from "#system/shell-protocol";
import { describe, expect, it } from "vitest";

/** Une équipe figée minimale, telle que le cadre d'un joueur l'envoie. */
function teamPayload(playerId: "j1" | "j2", duelId: string): DuelTeamPayloadV1 {
  const member = captureMember({
    species: 25,
    level: 30,
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

const DUEL = "m-1:1:0";

/** Un combattant tel que le cadre d'un joueur le matérialise. */
function duelFighter(side: DuelSide): DuelFighter {
  return {
    side,
    species: 25,
    name: `${side}-Pika`,
    level: 30,
    types: [13],
    stats: [100, 60, 50, 70, 60, 90],
    maxHp: 100,
    hp: 100,
    shiny: false,
    variant: 0,
    moves: [
      {
        moveId: 85,
        name: "Tonnerre",
        type: 13,
        category: 1,
        power: 90,
        accuracy: 100,
        priority: 0,
        pp: 15,
        ppMax: 15,
        effectiveness: 1,
      },
    ],
  };
}

describe("shell protocol", () => {
  describe("isShellMessage", () => {
    it("should accept every message a frame implements", () => {
      for (const type of [
        "shell/hello",
        "shell/pause",
        "shell/resume",
        "shell/release-inputs",
        "shell/wait-for-duel",
        "shell/continue",
      ]) {
        expect(isShellMessage({ protocolVersion: SHELL_PROTOCOL_VERSION, type })).toBe(true);
      }
    });

    it("should accept rules the frame can play under", () => {
      const rules = normalizeMatchRules({ ...DEFAULT_MATCH_RULES, mode: "blocks" });
      expect(isShellMessage({ protocolVersion: SHELL_PROTOCOL_VERSION, type: "shell/rules", rules })).toBe(true);
    });

    it("should drop rules it cannot play under, rather than apply them halfway", () => {
      const broken = [
        undefined,
        null,
        {},
        { ...DEFAULT_MATCH_RULES, mode: "arena" },
        { ...DEFAULT_MATCH_RULES, blockSize: 1 },
        { ...DEFAULT_MATCH_RULES, version: 99 },
      ];
      for (const rules of broken) {
        expect(isShellMessage({ protocolVersion: SHELL_PROTOCOL_VERSION, type: "shell/rules", rules })).toBe(false);
      }
    });

    it("should reject an unknown version", () => {
      expect(isShellMessage({ protocolVersion: SHELL_PROTOCOL_VERSION + 1, type: "shell/pause" })).toBe(false);
      expect(isShellMessage({ type: "shell/pause" })).toBe(false);
    });

    it("should reject an unknown message type", () => {
      expect(isShellMessage({ protocolVersion: SHELL_PROTOCOL_VERSION, type: "shell/shutdown" })).toBe(false);
    });

    it("should reject anything that is not a message object", () => {
      for (const payload of [null, undefined, "shell/pause", 42, ["shell/pause"]]) {
        expect(isShellMessage(payload)).toBe(false);
      }
    });

    it("should accept an invitation to prepare a duel", () => {
      for (const bankRenforts of [0, 1, 3]) {
        expect(
          isShellMessage({
            protocolVersion: SHELL_PROTOCOL_VERSION,
            type: "shell/duel-invite",
            duelId: DUEL,
            bankRenforts,
          }),
        ).toBe(true);
      }
    });

    it("should reject an invitation without a duel or with an impossible allowance", () => {
      const invitation = {
        protocolVersion: SHELL_PROTOCOL_VERSION,
        type: "shell/duel-invite",
        duelId: DUEL,
        bankRenforts: 1,
      };
      expect(isShellMessage({ ...invitation, duelId: "" })).toBe(false);
      expect(isShellMessage({ ...invitation, duelId: 42 })).toBe(false);
      for (const bankRenforts of [-1, 4, 1.5, "1", null]) {
        expect(isShellMessage({ ...invitation, bankRenforts })).toBe(false);
      }
    });

    it("should accept a duel prepared with both frozen teams", () => {
      const prepare = {
        protocolVersion: SHELL_PROTOCOL_VERSION,
        type: "shell/duel-prepare",
        duelId: DUEL,
        cap: 30,
        bankRenforts: 1,
        teams: { j1: teamPayload("j1", DUEL), j2: teamPayload("j2", DUEL) },
      };
      expect(isShellMessage(prepare)).toBe(true);
      // Un plafond « aucun » est explicite, pas absent.
      expect(isShellMessage({ ...prepare, cap: null })).toBe(true);
      // Un camp peut encore manquer : c'est une préparation, pas un duel.
      expect(isShellMessage({ ...prepare, teams: { j1: prepare.teams.j1, j2: null } })).toBe(true);
    });

    it("should refuse a duel prepared with teams of another duel or on the wrong side", () => {
      const prepare = {
        protocolVersion: SHELL_PROTOCOL_VERSION,
        type: "shell/duel-prepare",
        duelId: DUEL,
        cap: 30,
        bankRenforts: 1,
        teams: { j1: teamPayload("j1", DUEL), j2: teamPayload("j2", DUEL) },
      };
      expect(isShellMessage({ ...prepare, teams: { j1: teamPayload("j1", "m-1:2:0"), j2: null } })).toBe(false);
      expect(isShellMessage({ ...prepare, teams: { j1: teamPayload("j2", DUEL), j2: null } })).toBe(false);
      expect(isShellMessage({ ...prepare, teams: { j1: null, j2: null } })).toBe(false);
      expect(isShellMessage({ ...prepare, teams: undefined })).toBe(false);
      const edited = { ...prepare.teams.j1, members: [] };
      expect(isShellMessage({ ...prepare, teams: { j1: edited, j2: null } })).toBe(false);
    });

    it("should refuse a duel prepared with an unusable cap or allowance", () => {
      const prepare = {
        protocolVersion: SHELL_PROTOCOL_VERSION,
        type: "shell/duel-prepare",
        duelId: DUEL,
        cap: 30,
        bankRenforts: 1,
        teams: { j1: teamPayload("j1", DUEL), j2: null },
      };
      for (const cap of [0, -5, 4.5, "30", undefined]) {
        expect(isShellMessage({ ...prepare, cap })).toBe(false);
      }
      for (const bankRenforts of [-1, 4, 1.5]) {
        expect(isShellMessage({ ...prepare, bankRenforts })).toBe(false);
      }
    });
  });

  describe("frameMessage", () => {
    it("should stamp the protocol version and the frame scope", () => {
      expect(frameMessage("frame/ready", "local2p/v1/j2/")).toEqual({
        protocolVersion: SHELL_PROTOCOL_VERSION,
        type: "frame/ready",
        scope: "local2p/v1/j2/",
      });
    });

    it("should carry the run identifier when the shell sent one", () => {
      expect(frameMessage("frame/paused", "", "match-1")).toEqual({
        protocolVersion: SHELL_PROTOCOL_VERSION,
        type: "frame/paused",
        scope: "",
        matchId: "match-1",
      });
    });

    it("should stamp a battle won against the AI", () => {
      expect(battleWonMessage("7-0-3", "local2p/v1/j1/", "match-1")).toEqual({
        protocolVersion: SHELL_PROTOCOL_VERSION,
        type: "frame/pve-battle-won",
        scope: "local2p/v1/j1/",
        matchId: "match-1",
        battleId: "7-0-3",
      });
    });

    it("should stamp the acknowledgement of a game stopped at a block boundary", () => {
      expect(duelWaitingMessage("local2p/v1/j1/", "match-1")).toEqual({
        protocolVersion: SHELL_PROTOCOL_VERSION,
        type: "frame/duel-waiting",
        scope: "local2p/v1/j1/",
        matchId: "match-1",
      });
    });

    it("should stamp a save acknowledgement", () => {
      expect(savedMessage(4, "local2p/v1/j2/")).toEqual({
        protocolVersion: SHELL_PROTOCOL_VERSION,
        type: "frame/pve-saved",
        scope: "local2p/v1/j2/",
        saveSeq: 4,
      });
    });

    it("should stamp the frozen team of this frame", () => {
      const team = teamPayload("j2", DUEL);
      expect(duelTeamMessage(team, "local2p/v1/j2/", "m-1")).toEqual({
        protocolVersion: SHELL_PROTOCOL_VERSION,
        type: "frame/duel-team",
        scope: "local2p/v1/j2/",
        matchId: "m-1",
        duelTeam: team,
      });
    });

    it("should stamp the acknowledgement that this side of the duel is rebuilt", () => {
      expect(duelReadyMessage("deadbeef", "local2p/v1/j1/")).toEqual({
        protocolVersion: SHELL_PROTOCOL_VERSION,
        type: "frame/duel-ready",
        scope: "local2p/v1/j1/",
        checksum: "deadbeef",
      });
    });

    it("should carry the fighter that was materialized, and leave it out when there is none", () => {
      const fighter = duelFighter("j1");
      expect(duelReadyMessage("deadbeef", "local2p/v1/j1/", "m-1", fighter)).toEqual({
        protocolVersion: SHELL_PROTOCOL_VERSION,
        type: "frame/duel-ready",
        scope: "local2p/v1/j1/",
        matchId: "m-1",
        checksum: "deadbeef",
        fighter,
      });
      // Un cachet sans combattant est une réponse complète : le cadre dit qu'il a
      // reconstruit son côté, et la coque en conclut que le duel n'est pas jouable.
      expect(duelReadyMessage("deadbeef", "local2p/v1/j1/").fighter).toBeUndefined();
    });

    it("should stamp the field of a duel as one side sees it, moves included", () => {
      const state = createDuel({ duelId: DUEL, seed: 7, fighters: { j1: duelFighter("j1"), j2: duelFighter("j2") } });
      if (state === null) {
        throw new Error("duel de test invalide");
      }
      const message = duelStateMessage(
        {
          duelId: DUEL,
          turnId: 0,
          hash: state.hash,
          view: duelPublicState(state),
          moves: duelMovesFor(state, "j1"),
        },
        "local2p/v1/j1/",
        "m-1",
      );
      expect(message).toEqual({
        protocolVersion: SHELL_PROTOCOL_VERSION,
        type: "frame/duel-state",
        scope: "local2p/v1/j1/",
        matchId: "m-1",
        duelId: DUEL,
        turnId: 0,
        hash: state.hash,
        view: duelPublicState(state),
        moves: duelMovesFor(state, "j1"),
      });
      // Les attaques appartiennent à leur propriétaire : une moitié qui n'en
      // annonce aucune reste un rapport lisible, la vue n'en porte aucune.
      expect(
        duelStateMessage({ duelId: DUEL, turnId: 0, hash: state.hash, view: duelPublicState(state) }, "x").moves,
      ).toBeUndefined();
      expect(duelPublicState(state).sides.j1).not.toHaveProperty("moves");
    });
  });
});
