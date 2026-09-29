import type { DuelCommand, DuelFighter, DuelSide, DuelState } from "#system/duel-engine";
import { createDuel, duelMovesFor, duelPublicState, duelSeedFor, lockCommand, resolveTurn } from "#system/duel-engine";
import { resolveDuelTurn } from "#system/duel-mechanics";
import { describe, expect, it } from "vitest";
// La session est du JavaScript autonome, chargé tel quel par la page coque :
// les tests l'importent directement, pour qu'il n'existe qu'une implémentation.
import {
  acceptDuelReport,
  cloneFighter,
  DUEL_MOVE_MAX,
  DUEL_SESSION_VERSION,
  duelDisplayFor,
  duelSeedOf,
  isDuelFighter,
  isDuelMoveList,
  isDuelView,
  lockDuelChoice,
  newDuelSession,
  openDuelTurn,
} from "../../../android/shell/duel-session.js";

const DUEL_ID = "m-1:1:0";
const SEED = 1234;

/** Un combattant tel que le cadre d'un joueur le matérialise. */
function fighter(side: DuelSide, overrides: Partial<DuelFighter> = {}): DuelFighter {
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
      {
        moveId: 86,
        name: "Éclair",
        type: 13,
        category: 1,
        power: 40,
        accuracy: 100,
        priority: 0,
        pp: 30,
        ppMax: 30,
        effectiveness: 1,
      },
    ],
    ...overrides,
  };
}

/** Les deux combattants d'un duel de test. */
function fighters(): Record<DuelSide, DuelFighter> {
  return { j1: fighter("j1"), j2: fighter("j2") };
}

/** Une moitié simulée : le moteur du jeu, tel qu'un cadre le fait tourner. */
function simulatedFrame(duelId = DUEL_ID, seed = SEED, pair = fighters()) {
  let state: DuelState | null = createDuel({ duelId, seed, fighters: pair });
  if (state === null) {
    throw new Error("duel de test invalide");
  }
  return {
    /** Le rapport que ce cadre enverrait : état public **et** ses propres attaques. */
    report: (answeredTurnId: number, side: DuelSide) => ({
      duelId,
      turnId: answeredTurnId,
      hash: (state as DuelState).hash,
      view: duelPublicState(state as DuelState),
      moves: duelMovesFor(state as DuelState, side),
    }),
    /** Résout un tour comme `shell/duel-turn` le déclenche dans un vrai cadre. */
    play: (commands: Record<DuelSide, DuelCommand>): boolean => {
      let current = state as DuelState;
      for (const side of ["j1", "j2"] as const) {
        const locked = lockCommand(current, side, commands[side]);
        if (!locked.accepted) {
          return false;
        }
        current = locked.state;
      }
      const resolved = resolveTurn(current, resolveDuelTurn);
      if (!resolved.accepted) {
        return false;
      }
      state = resolved.state;
      return true;
    },
    state: () => state as DuelState,
  };
}

/** Une session ouverte sur deux moitiés simulées, comme après `shell/duel-start`. */
function openedSession(pair = fighters(), duelId = DUEL_ID, seed = SEED) {
  const session = newDuelSession({ duelId, seed, fighters: pair });
  if (session === null) {
    throw new Error("session de test invalide");
  }
  return session;
}

describe("duel session", () => {
  describe("newDuelSession", () => {
    it("should open at the first turn, with nothing locked and nothing reported", () => {
      const session = openedSession();
      expect(session.version).toBe(DUEL_SESSION_VERSION);
      expect(session.duelId).toBe(DUEL_ID);
      expect(session.turn).toBe(1);
      expect(session.awaiting).toBe(0);
      expect(session.pending).toEqual({ j1: null, j2: null });
      expect(session.reports).toEqual({ j1: null, j2: null });
      expect(session.view).toBeNull();
      expect(session.finished).toBe(false);
      expect(session.winner).toBeNull();
    });

    it("should copy its fighters instead of keeping the caller's objects", () => {
      const pair = fighters();
      const session = openedSession(pair);
      pair.j1.hp = 1;
      pair.j1.moves[0].pp = 0;
      expect(session.fighters.j1.hp).toBe(100);
      expect(session.fighters.j1.moves[0].pp).toBe(15);
      expect(cloneFighter(pair.j2)).not.toBe(pair.j2);
    });

    it("should refuse an unnamed duel, an impossible seed or an unusable fighter", () => {
      expect(newDuelSession({ duelId: "", seed: SEED, fighters: fighters() })).toBeNull();
      expect(newDuelSession({ duelId: DUEL_ID, seed: 1.5, fighters: fighters() })).toBeNull();
      expect(newDuelSession({ duelId: DUEL_ID, seed: -1, fighters: fighters() })).toBeNull();
      expect(
        newDuelSession({ duelId: DUEL_ID, seed: SEED, fighters: { j1: fighter("j2"), j2: fighter("j2") } }),
      ).toBeNull();
      expect(
        newDuelSession({ duelId: DUEL_ID, seed: SEED, fighters: { j1: fighter("j1", { hp: 0 }), j2: fighter("j2") } }),
      ).toBeNull();
      expect(isDuelFighter(fighter("j1", { moves: [] }), "j1")).toBe(false);
      expect(isDuelFighter(fighter("j1", { stats: [1, 2] }), "j1")).toBe(false);
      expect(isDuelFighter(fighter("j1", { hp: 200 }), "j1")).toBe(false);
      expect(isDuelFighter(fighter("j1", { maxHp: 0 }), "j1")).toBe(false);
      expect(isDuelFighter({ ...fighter("j1"), side: "j3" }, "j1")).toBe(false);
    });

    it("should validate optional result-screen appearance data", () => {
      expect(isDuelFighter(fighter("j1", { resultSpriteAtlasPath: "shiny/25", trainerSkin: "m" }), "j1")).toBe(true);
      expect(isDuelFighter(fighter("j1", { resultSpriteAtlasPath: "../private/image" }), "j1")).toBe(false);
      expect(isDuelFighter({ ...fighter("j1"), trainerSkin: "x" }, "j1")).toBe(false);
    });

    it("should accept the moves the game actually produces, status moves included", () => {
      // Une attaque de statut porte une puissance de -1 dans les tables du jeu :
      // elle ne frappe pas, mais elle reste jouable.
      const status = {
        moveId: 100,
        name: "Rugissement",
        type: 0,
        category: 2,
        power: -1,
        accuracy: 100,
        priority: 0,
        pp: 40,
        ppMax: 40,
        effectiveness: 1,
      };
      expect(isDuelMoveList([status])).toBe(true);
      expect(isDuelMoveList([])).toBe(false);
      expect(isDuelMoveList([{ ...status, name: "" }])).toBe(false);
      expect(isDuelMoveList([{ ...status, pp: -1 }])).toBe(false);
      expect(isDuelMoveList([{ ...status, effectiveness: Number.NaN }])).toBe(false);
      expect(isDuelMoveList(new Array(DUEL_MOVE_MAX + 1).fill(status))).toBe(false);
    });
  });

  describe("duelSeedOf", () => {
    it("should derive the same seed as the frame-side engine", () => {
      const checksums = { j1: "aaaa1111", j2: "bbbb2222" };
      expect(duelSeedOf(DUEL_ID, checksums)).toBe(duelSeedFor(DUEL_ID, checksums));
      expect(duelSeedOf(DUEL_ID, { j1: null, j2: null })).toBe(duelSeedFor(DUEL_ID, { j1: null, j2: null }));
      expect(duelSeedOf("m-2:1:0", checksums)).not.toBe(duelSeedOf(DUEL_ID, checksums));
      expect(duelSeedOf(DUEL_ID, { j1: "cccc", j2: "bbbb2222" })).not.toBe(duelSeedOf(DUEL_ID, checksums));
    });
  });

  describe("acceptDuelReport", () => {
    it("should hold a lone report until the other half answers", () => {
      const session = openedSession();
      const j1 = simulatedFrame();
      const first = acceptDuelReport(session, "j1", j1.report(0, "j1"));
      expect(first.accepted).toBe(true);
      expect(first.agreed).toBe(false);
      expect(first.session.view).toBeNull();
      expect(first.session.awaiting).toBe(0);
      expect(first.session.moves.j1).toHaveLength(2);
      expect(first.session.moves.j2).toBeNull();
    });

    it("should apply the turn only once the two halves agree", () => {
      const session = openedSession();
      const j1 = simulatedFrame();
      const j2 = simulatedFrame();
      const one = acceptDuelReport(session, "j1", j1.report(0, "j1"));
      const two = acceptDuelReport(one.session, "j2", j2.report(0, "j2"));
      expect(two.accepted).toBe(true);
      expect(two.agreed).toBe(true);
      expect(two.session.view?.turnId).toBe(1);
      expect(two.session.view?.sides.j1.hp).toBe(100);
      expect(two.session.log).toEqual([]);
      // Le tour 1 attend maintenant les choix des deux joueurs.
      expect(two.session.awaiting).toBeNull();
      expect(two.session.turn).toBe(1);
    });

    it("should refuse a report of another duel, another turn, or a repeated one", () => {
      const session = openedSession();
      const j1 = simulatedFrame();
      const report = j1.report(0, "j1");
      expect(acceptDuelReport(session, "j1", { ...report, duelId: "m-9:1:0" }).accepted).toBe(false);
      expect(acceptDuelReport(session, "j1", { ...report, turnId: 3 }).accepted).toBe(false);
      expect(acceptDuelReport(session, "j1", { ...report, hash: "" }).accepted).toBe(false);
      expect(acceptDuelReport(session, "j1", { ...report, moves: [] }).accepted).toBe(false);
      expect(acceptDuelReport(session, "j1", { ...report, view: null }).accepted).toBe(false);
      expect(acceptDuelReport(session, "j1", { ...report, view: { ...report.view, duelId: "m-9:1:0" } }).accepted).toBe(
        false,
      );
      expect(acceptDuelReport(session, "j1", null).accepted).toBe(false);
      expect(acceptDuelReport(session, "j9", report).accepted).toBe(false);
      const once = acceptDuelReport(session, "j1", report);
      expect(acceptDuelReport(once.session, "j1", report).accepted).toBe(false);
    });

    it("should refuse a report while the two halves are still choosing", () => {
      const session = openedSession();
      const j1 = simulatedFrame();
      const j2 = simulatedFrame();
      const opening = acceptDuelReport(
        acceptDuelReport(session, "j1", j1.report(0, "j1")).session,
        "j2",
        j2.report(0, "j2"),
      );
      // Aucun tour n'est en vol : un rapport ne peut plus rien appliquer.
      expect(acceptDuelReport(opening.session, "j1", j1.report(1, "j1")).accepted).toBe(false);
    });

    it("should refuse a turn the two halves resolve differently instead of settling it", () => {
      const session = openedSession();
      const j1 = simulatedFrame();
      const other = simulatedFrame(DUEL_ID, SEED + 1);
      const one = acceptDuelReport(session, "j1", j1.report(0, "j1"));
      const two = acceptDuelReport(one.session, "j2", other.report(0, "j2"));
      expect(two.accepted).toBe(true);
      expect(two.agreed).toBe(false);
      expect(two.reason).toBeDefined();
      // Le désaccord ne fait avancer ni le tour ni le terrain.
      expect(two.session.turn).toBe(1);
      expect(two.session.view).toBeNull();
      expect(two.session.finished).toBe(false);
    });
  });

  describe("lockDuelChoice", () => {
    it("should refuse a choice nobody could make", () => {
      const session = openedSession();
      expect(lockDuelChoice(session, "j1", 9).accepted).toBe(false);
      expect(lockDuelChoice(session, "j1", 0.5).accepted).toBe(false);
      expect(lockDuelChoice(session, "j1", -1).accepted).toBe(false);
      expect(lockDuelChoice(session, "j9", 0).accepted).toBe(false);
      // Un menu vide (aucun rapport encore reçu) ne propose aucun tour.
      expect(lockDuelChoice(session, "j1", 0).accepted).toBe(false);
    });

    it("should refuse a move without PP left and a second choice in the same turn", () => {
      const session = openedSession();
      const j1 = simulatedFrame();
      const j2 = simulatedFrame();
      const one = acceptDuelReport(session, "j1", j1.report(0, "j1"));
      const both = acceptDuelReport(one.session, "j2", j2.report(0, "j2"));
      const out = lockDuelChoice(both.session, "j1", 1);
      expect(out.accepted).toBe(true);
      expect(out.readyToResolve).toBe(false);
      // Le menu de J1 ne rejoue pas : un second choix pour le même tour est refusé.
      expect(lockDuelChoice(out.session, "j1", 0).accepted).toBe(false);
      const spent = {
        ...out.session,
        moves: {
          ...out.session.moves,
          j2: [{ ...out.session.moves.j2[0], pp: 0 }, out.session.moves.j2[1]],
        },
      };
      expect(lockDuelChoice(spent, "j2", 0).accepted).toBe(false);
      expect(lockDuelChoice(spent, "j2", 1).accepted).toBe(true);
    });

    it("should tell the caller when both halves have locked", () => {
      const session = openedSession();
      const j1 = simulatedFrame();
      const j2 = simulatedFrame();
      let current = acceptDuelReport(session, "j1", j1.report(0, "j1")).session;
      current = acceptDuelReport(current, "j2", j2.report(0, "j2")).session;
      current = lockDuelChoice(current, "j1", 0).session;
      const done = lockDuelChoice(current, "j2", 1);
      expect(done.accepted).toBe(true);
      expect(done.readyToResolve).toBe(true);
    });
  });

  describe("openDuelTurn", () => {
    it("should refuse to open a turn before both halves have locked", () => {
      const session = openedSession();
      const j1 = simulatedFrame();
      const current = acceptDuelReport(session, "j1", j1.report(0, "j1")).session;
      const early = openDuelTurn(current);
      expect(early.accepted).toBe(false);
      expect(early.sender).toBeUndefined();
      const half = openDuelTurn(lockDuelChoice(current, "j1", 1).session);
      expect(half.accepted).toBe(false);
    });

    it("should carry both choices and wait for the two reports", () => {
      const session = openedSession();
      const j1 = simulatedFrame();
      const j2 = simulatedFrame();
      let current = acceptDuelReport(session, "j1", j1.report(0, "j1")).session;
      current = acceptDuelReport(current, "j2", j2.report(0, "j2")).session;
      current = lockDuelChoice(current, "j1", 1).session;
      current = lockDuelChoice(current, "j2", 0).session;
      const opened = openDuelTurn(current);
      expect(opened.accepted).toBe(true);
      expect(opened.sender?.turnId).toBe(1);
      expect(opened.sender?.commands).toEqual({
        j1: { type: "fight", moveIndex: 1 },
        j2: { type: "fight", moveIndex: 0 },
      });
      expect(opened.session.awaiting).toBe(1);
      // Un second appel dans le même tour ne renvoie jamais deux fois le même tour.
      expect(openDuelTurn(opened.session).accepted).toBe(false);
      expect(lockDuelChoice(opened.session, "j1", 0).accepted).toBe(false);
    });
  });

  describe("duelDisplayFor", () => {
    it("should show the menu of one half only, and reveal nothing when it locks", () => {
      const session = openedSession();
      const j1 = simulatedFrame();
      const j2 = simulatedFrame();
      let current = acceptDuelReport(session, "j1", j1.report(0, "j1")).session;
      current = acceptDuelReport(current, "j2", j2.report(0, "j2")).session;
      current = lockDuelChoice(current, "j1", 1).session;

      const mine = duelDisplayFor(current, "j1");
      expect(mine.moves.map(move => move.name)).toEqual(["Tonnerre", "Éclair"]);
      expect(mine.self.name).toBe("j1-Pika");
      expect(mine.foe.name).toBe("j2-Pika");
      expect(mine.locked).toBe(true);
      expect(mine.waiting).toBe(false);
      // Le choix verrouillé ne se dit pas : la moitié le signale, sans le nommer.
      expect(Object.keys(mine)).not.toContain("choice");
      expect(Object.keys(mine)).not.toContain("moveIndex");

      // La moitié adverse ne change pas d'un iota quand J1 verrouille.
      const before = duelDisplayFor({ ...current, pending: { j1: null, j2: null } }, "j2");
      expect(duelDisplayFor(current, "j2")).toEqual(before);
    });

    it("should follow the field of the accepted view, turn after turn", () => {
      const session = openedSession();
      const j1 = simulatedFrame();
      const j2 = simulatedFrame();
      let current = acceptDuelReport(session, "j1", j1.report(0, "j1")).session;
      current = acceptDuelReport(current, "j2", j2.report(0, "j2")).session;
      current = lockDuelChoice(current, "j1", 0).session;
      current = lockDuelChoice(current, "j2", 0).session;
      const opened = openDuelTurn(current);
      const commands = opened.sender?.commands as Record<DuelSide, DuelCommand>;
      expect(j1.play(commands)).toBe(true);
      expect(j2.play(commands)).toBe(true);
      current = acceptDuelReport(opened.session, "j1", j1.report(1, "j1")).session;
      const agreed = acceptDuelReport(current, "j2", j2.report(1, "j2"));
      expect(agreed.agreed).toBe(true);
      const display = duelDisplayFor(agreed.session, "j1");
      expect(display.turn).toBe(2);
      expect(display.waiting).toBe(false);
      expect(display.log.length).toBeGreaterThan(0);
      // Le combat a été résolu par le moteur : les PV ont bougé des deux côtés.
      expect(display.self.hp === 100 && display.foe.hp === 100).toBe(false);
      expect(display.self.hp).toBe(agreed.session.view?.sides.j1.hp);
    });
  });

  describe("a whole duel", () => {
    it("should play a duel to its end and settle on the winner the engine found", () => {
      const pair: Record<DuelSide, DuelFighter> = {
        j1: fighter("j1", { stats: [100, 200, 90, 70, 60, 120], moves: [fighter("j1").moves[0]] }),
        j2: fighter("j2", { hp: 40, maxHp: 40, stats: [40, 30, 30, 30, 30, 20], moves: [fighter("j2").moves[1]] }),
      };
      const j1 = simulatedFrame(DUEL_ID, SEED, pair);
      const j2 = simulatedFrame(DUEL_ID, SEED, pair);
      let session = openedSession(pair);
      let answered = 0;
      session = acceptDuelReport(session, "j1", j1.report(0, "j1")).session;
      session = acceptDuelReport(session, "j2", j2.report(0, "j2")).session;

      for (let guard = 0; guard < 60 && !session.finished; guard++) {
        session = lockDuelChoice(session, "j1", 0).session;
        session = lockDuelChoice(session, "j2", 0).session;
        const opened = openDuelTurn(session);
        expect(opened.accepted).toBe(true);
        const commands = opened.sender?.commands as Record<DuelSide, DuelCommand>;
        expect(j1.play(commands)).toBe(true);
        expect(j2.play(commands)).toBe(true);
        answered += 1;
        session = acceptDuelReport(opened.session, "j1", j1.report(answered, "j1")).session;
        const agreed = acceptDuelReport(session, "j2", j2.report(answered, "j2"));
        expect(agreed.agreed).toBe(true);
        session = agreed.session;
      }

      expect(session.finished).toBe(true);
      expect(session.winner).toBe(j1.state().winner);
      expect(session.winner).toBe("j1");
      expect(session.history).toEqual(answered === 0 ? [] : session.history);
      expect(session.history.length).toBe(answered);
      // Un duel fini n'accepte plus rien : ni choix, ni rapport.
      expect(lockDuelChoice(session, "j1", 0).accepted).toBe(false);
      expect(acceptDuelReport(session, "j1", j1.report(answered, "j1")).accepted).toBe(false);
      expect(openDuelTurn(session).accepted).toBe(false);
    });
  });

  describe("isDuelView", () => {
    it("should accept the view the engine produces and refuse anything less", () => {
      const state = createDuel({ duelId: DUEL_ID, seed: SEED, fighters: fighters() });
      if (state === null) {
        throw new Error("duel de test invalide");
      }
      const view = duelPublicState(state);
      expect(isDuelView(view, DUEL_ID)).toBe(true);
      expect(isDuelView(view, "m-9:1:0")).toBe(false);
      expect(isDuelView(null, DUEL_ID)).toBe(false);
      expect(isDuelView({ ...view, sides: { j1: view.sides.j1 } }, DUEL_ID)).toBe(false);
      expect(isDuelView({ ...view, winner: "j9" }, DUEL_ID)).toBe(false);
      expect(isDuelView({ ...view, sides: { ...view.sides, j1: { ...view.sides.j1, hp: 999 } } }, DUEL_ID)).toBe(false);
      expect(isDuelView({ ...view, sides: { ...view.sides, j2: { ...view.sides.j2, types: [] } } }, DUEL_ID)).toBe(
        false,
      );
    });
  });
});
