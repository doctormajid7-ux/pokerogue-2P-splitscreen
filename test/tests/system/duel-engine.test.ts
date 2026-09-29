import type { DuelFighter, DuelResolver, DuelSide, DuelState, DuelTurnRecord } from "#system/duel-engine";
import {
  abandonDuel,
  createDuel,
  createDuelRng,
  DUEL_ENGINE_VERSION,
  DUEL_TURN_LIMIT,
  duelHash,
  duelMovesFor,
  duelPublicState,
  duelSeedFor,
  endDuel,
  isDuelFighter,
  lockCommand,
  replayDuel,
  resolveTurn,
} from "#system/duel-engine";
import { resolveDuelTurn } from "#system/duel-mechanics";
import { describe, expect, it } from "vitest";

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

/** Un duel ouvert, prêt à jouer. */
function duel(
  overrides: { seed?: number; sides?: Partial<Record<DuelSide, Partial<DuelFighter>>>; turnLimit?: number } = {},
) {
  const state = createDuel({
    duelId: "m-1:1:0",
    seed: overrides.seed ?? 1234,
    fighters: {
      j1: fighter("j1", overrides.sides?.j1),
      j2: fighter("j2", overrides.sides?.j2),
    },
    ...(overrides.turnLimit === undefined ? {} : { turnLimit: overrides.turnLimit }),
  });
  if (state === null) {
    throw new Error("duel de test invalide");
  }
  return state;
}

/** Verrouille les deux camps, puis résout le tour. */
function playTurn(state: DuelState, move1 = 0, move2 = 0, resolver: DuelResolver = resolveDuelTurn): DuelState {
  const first = lockCommand(state, "j1", { type: "fight", moveIndex: move1 });
  const second = lockCommand(first.state, "j2", { type: "fight", moveIndex: move2 });
  return resolveTurn(second.state, resolver).state;
}

describe("duel engine", () => {
  describe("createDuel", () => {
    it("should open a duel with both sides at full health", () => {
      const state = duel();
      expect(state.version).toBe(DUEL_ENGINE_VERSION);
      expect(state.duelId).toBe("m-1:1:0");
      expect(state.turnId).toBe(1);
      expect(state.turnLimit).toBe(DUEL_TURN_LIMIT);
      expect(state.winner).toBeNull();
      expect(state.history).toEqual([]);
      expect(state.pending).toEqual({ j1: null, j2: null });
      expect(state.sides.j1.fighter.hp).toBe(100);
      expect(state.sides.j2.fighter.hp).toBe(100);
      expect(state.hash).toMatch(/^[0-9a-f]{8}$/);
    });

    it("should copy its fighters instead of keeping the caller's objects", () => {
      const mine = fighter("j1");
      const state = createDuel({ duelId: "d-1", seed: 1, fighters: { j1: mine, j2: fighter("j2") } });
      mine.moves[0].pp = 0;
      mine.hp = 1;
      expect(state?.sides.j1.fighter.moves[0].pp).toBe(15);
      expect(state?.sides.j1.fighter.hp).toBe(100);
    });

    it("should refuse an unusable fighter or an unnamed duel", () => {
      expect(createDuel({ duelId: "", seed: 1, fighters: { j1: fighter("j1"), j2: fighter("j2") } })).toBeNull();
      expect(
        createDuel({ duelId: "d-1", seed: 1, fighters: { j1: fighter("j1", { hp: 0 }), j2: fighter("j2") } }),
      ).toBeNull();
      expect(
        createDuel({
          duelId: "d-1",
          seed: 1,
          fighters: { j1: fighter("j1", { moves: [] }), j2: fighter("j2") },
        }),
      ).toBeNull();
      expect(createDuel({ duelId: "d-1", seed: 1, fighters: { j1: fighter("j2"), j2: fighter("j2") } })).toBeNull();
      expect(isDuelFighter(fighter("j1", { hp: 200 }))).toBe(false);
      expect(isDuelFighter(fighter("j1", { stats: [1, 2] }))).toBe(false);
      expect(isDuelFighter(fighter("j1", { moves: [{ ...fighter("j1").moves[0], accuracy: Number.NaN }] }))).toBe(
        false,
      );
    });

    it("should validate optional result-screen appearance data", () => {
      expect(isDuelFighter(fighter("j1", { resultSpriteAtlasPath: "female/25", trainerSkin: "f" }))).toBe(true);
      expect(isDuelFighter(fighter("j1", { resultSpriteAtlasPath: "../private/image" }))).toBe(false);
      expect(isDuelFighter({ ...fighter("j1"), trainerSkin: "x" })).toBe(false);
    });
  });

  describe("duelSeedFor", () => {
    it("should derive a stable seed from the duel and its teams", () => {
      const seed = duelSeedFor("d-1", { j1: "aaaa", j2: "bbbb" });
      expect(seed).toBe(duelSeedFor("d-1", { j1: "aaaa", j2: "bbbb" }));
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xffffffff);
      expect(duelSeedFor("d-2", { j1: "aaaa", j2: "bbbb" })).not.toBe(seed);
      expect(duelSeedFor("d-1", { j1: "cccc", j2: "bbbb" })).not.toBe(seed);
      expect(duelSeedFor("d-1", { j1: null, j2: null })).toBe(duelSeedFor("d-1", { j1: null, j2: null }));
    });
  });

  describe("createDuelRng", () => {
    it("should be deterministic, bounded and advancing", () => {
      const first = createDuelRng(42);
      const second = createDuelRng(42);
      for (let i = 0; i < 20; i++) {
        expect(first.randomInt(100)).toBe(second.randomInt(100));
      }
      const rng = createDuelRng(7);
      for (let i = 0; i < 50; i++) {
        const value = rng.randomInt(6);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(6);
      }
      expect(createDuelRng(7).state()).not.toBe(createDuelRng(8).randomInt(1_000_000) === 0 ? 0 : 1);
    });
  });

  describe("lockCommand", () => {
    it("should lock one move per side and announce when the turn is ready", () => {
      const state = duel();
      const first = lockCommand(state, "j1", { type: "fight", moveIndex: 1 });
      expect(first.accepted).toBe(true);
      expect(first.readyToResolve).toBe(false);
      expect(first.state.pending.j1).toEqual({ type: "fight", moveIndex: 1 });
      const second = lockCommand(first.state, "j2", { type: "fight", moveIndex: 0 });
      expect(second.readyToResolve).toBe(true);
    });

    it("should refuse a second lock from the same side", () => {
      const locked = lockCommand(duel(), "j1", { type: "fight", moveIndex: 0 }).state;
      const again = lockCommand(locked, "j1", { type: "fight", moveIndex: 1 });
      expect(again.accepted).toBe(false);
      expect(again.reason).toBe("choix déjà verrouillé");
      expect(again.state.pending.j1).toEqual({ type: "fight", moveIndex: 0 });
    });

    it("should refuse an unknown side, an unknown move and a malformed choice", () => {
      const state = duel();
      expect(lockCommand(state, "j3" as DuelSide, { type: "fight", moveIndex: 0 }).reason).toBe("côté inconnu");
      expect(lockCommand(state, "j1", { type: "fight", moveIndex: 9 }).reason).toBe("attaque inconnue");
      expect(lockCommand(state, "j1", { type: "fight", moveIndex: -1 }).reason).toBe("attaque inconnue");
      for (const command of [null, undefined, "fight", { type: "run" }, { type: "fight", moveIndex: 0.5 }]) {
        expect(lockCommand(state, "j1", command as never).accepted).toBe(false);
      }
    });

    it("should refuse a move without PP left", () => {
      const state = duel({ sides: { j1: { moves: [{ ...fighter("j1").moves[0], pp: 0 }] } } });
      expect(lockCommand(state, "j1", { type: "fight", moveIndex: 0 }).reason).toBe("plus de PP");
    });

    it("should refuse a command from a fainted side or a finished duel", () => {
      // Un duel ne s'ouvre pas avec un combattant K.O. : l'état est forcé ici pour
      // éprouver la porte des commandes, pas l'ouverture.
      const opened = duel();
      const fainted: DuelState = {
        ...opened,
        sides: { ...opened.sides, j1: { side: "j1", fighter: { ...opened.sides.j1.fighter, hp: 0 } } },
      };
      const finished = endDuel(duel(), "j1", "test");
      expect(lockCommand(fainted, "j1", { type: "fight", moveIndex: 0 }).reason).toBe("combattant K.O.");
      expect(lockCommand(finished, "j1", { type: "fight", moveIndex: 0 }).reason).toBe("duel terminé");
    });
  });

  describe("hidden choices", () => {
    it("should say that a side locked, never what it picked", () => {
      const locked = lockCommand(duel(), "j1", { type: "fight", moveIndex: 1 }).state;
      const view = duelPublicState(locked);
      expect(view.sides.j1.locked).toBe(true);
      expect(view.sides.j2.locked).toBe(false);
      expect(view.lastTurn).toBeNull();
      expect(JSON.stringify(view)).not.toContain("Tonnerre");
      expect(Object.keys(view.sides.j1)).not.toContain("moves");
      expect(view.sides.j1.movesLeft).toBe(2);
    });

    it("should reveal both choices only once the turn is settled", () => {
      const played = playTurn(duel(), 1, 0);
      const view = duelPublicState(played);
      expect(view.lastTurn?.commands).toEqual({
        j1: { type: "fight", moveIndex: 1 },
        j2: { type: "fight", moveIndex: 0 },
      });
      expect(view.sides.j1.locked).toBe(false);
      expect(view.hash).toBe(played.hash);
      expect(view.turnId).toBe(2);
    });

    it("should keep the moves of a side to its owner", () => {
      const state = duel();
      const mine = duelMovesFor(state, "j1");
      expect(mine).toHaveLength(2);
      mine[0].pp = 0;
      expect(state.sides.j1.fighter.moves[0].pp).toBe(15);
      expect(duelMovesFor(state, "j1")[0].pp).toBe(15);
    });
  });

  describe("resolveTurn", () => {
    it("should refuse to resolve before both sides have locked", () => {
      const state = lockCommand(duel(), "j1", { type: "fight", moveIndex: 0 }).state;
      const outcome = resolveTurn(state, resolveDuelTurn);
      expect(outcome.accepted).toBe(false);
      expect(outcome.reason).toBe("les deux choix ne sont pas verrouillés");
      expect(outcome.state).toBe(state);
    });

    it("should apply the turn, spend the PP, advance the turn and clear the locks", () => {
      const played = playTurn(duel(), 0, 1);
      expect(played.turnId).toBe(2);
      expect(played.pending).toEqual({ j1: null, j2: null });
      expect(played.history).toHaveLength(1);
      expect(played.history[0].turnId).toBe(1);
      expect(played.history[0].log.length).toBeGreaterThan(0);
      expect(played.sides.j1.fighter.moves[0].pp).toBe(14);
      expect(played.sides.j1.fighter.moves[1].pp).toBe(30);
      expect(played.sides.j2.fighter.moves[1].pp).toBe(29);
      expect(played.sides.j1.fighter.hp).toBeLessThanOrEqual(100);
      expect(played.hash).not.toBe(duel().hash);
    });

    it("should stop the duel on a K.O. and name the winner", () => {
      const state = duel({ sides: { j1: { hp: 1 }, j2: { hp: 1, stats: [1, 1, 1, 1, 1, 1] } } });
      const played = playTurn(state, 0, 1);
      expect(played.sides.j2.fighter.hp).toBe(0);
      expect(played.winner).toBe("j1");
      expect(played.endedReason).toContain("K.O.");
      expect(duelPublicState(played).finished).toBe(true);
      expect(lockCommand(played, "j2", { type: "fight", moveIndex: 0 }).accepted).toBe(false);
    });

    it("should declare a draw when both sides fall", () => {
      // La mécanique de D1 fait agir les deux camps l'un après l'autre : un K.O.
      // simultané ne peut venir que d'une mécanique qui le rapporte (riposte,
      // recul, attaque à double K.O.). Le moteur, lui, doit le traiter.
      const mutual: DuelResolver = context => ({
        sides: [
          {
            side: "j1",
            hp: 0,
            pp: context.sides.j1.moves.map((move, index) => (index === 0 ? move.pp - 1 : move.pp)),
          },
          { side: "j2", hp: 0, pp: context.sides.j2.moves.map((move, index) => (index === 0 ? move.pp - 1 : move.pp)) },
        ],
        order: ["j1", "j2"],
        log: ["les deux camps tombent"],
      });
      const played = playTurn(duel(), 0, 0, mutual);
      expect(played.sides.j1.fighter.hp).toBe(0);
      expect(played.sides.j2.fighter.hp).toBe(0);
      expect(played.winner).toBe("draw");
      expect(played.endedReason).toBe("K.O. des deux camps");
    });

    it("should declare a draw once the turn limit is reached", () => {
      const state = duel({
        turnLimit: 2,
        sides: {
          j1: { maxHp: 9999, hp: 9999 },
          j2: { maxHp: 9999, hp: 9999, stats: [9999, 1, 9999, 1, 9999, 1] },
        },
      });
      const first = playTurn(state);
      const second = playTurn(first);
      expect(second.turnId).toBe(3);
      expect(second.winner).toBe("draw");
      expect(second.endedReason).toBe("limite de tours");
    });

    it("should refuse a resolution that heals, invents PP or forgets a side", () => {
      const locked = lockCommand(lockCommand(duel(), "j1", { type: "fight", moveIndex: 0 }).state, "j2", {
        type: "fight",
        moveIndex: 0,
      }).state;
      const healing: DuelResolver = context => ({
        sides: [
          { side: "j1", hp: 200, pp: context.sides.j1.moves.map(move => move.pp) },
          { side: "j2", hp: 100, pp: context.sides.j2.moves.map(move => move.pp) },
        ],
        order: ["j1", "j2"],
        log: [],
      });
      const inventing: DuelResolver = context => ({
        sides: [
          { side: "j1", hp: 50, pp: context.sides.j1.moves.map(move => move.pp - 1) },
          { side: "j2", hp: 50, pp: context.sides.j2.moves.map(move => move.pp) },
        ],
        order: ["j1", "j2"],
        log: [],
      });
      const incomplete: DuelResolver = () => ({ sides: [{ side: "j1", hp: 50, pp: [1, 1] }], order: ["j1"], log: [] });
      const garbage = (() => ({ sides: "soon" })) as unknown as DuelResolver;
      const exploding: DuelResolver = () => {
        throw new Error("boom");
      };

      expect(resolveTurn(locked, healing).reason).toBe("résolution qui soigne un combattant");
      expect(resolveTurn(locked, inventing).reason).toBe("résolution qui touche aux PP d'une autre attaque");
      expect(resolveTurn(locked, incomplete).reason).toBe("résolution incomplète");
      expect(resolveTurn(locked, garbage).reason).toBe("résolution illisible");
      expect(resolveTurn(locked, exploding).reason).toBe("mécanique de tour en échec");
      // Rien n'a bougé : le duel peut être rejoué tel quel.
      expect(resolveTurn(locked, exploding).state).toBe(locked);
    });

    it("should accept a resolution where the K.O. victim never acted", () => {
      // Le camp le plus rapide met l'autre K.O. : le vaincu ne consomme pas de PP.
      const state = duel({ sides: { j1: { stats: [1, 1, 1, 1, 1, 999] }, j2: { hp: 1 } } });
      const played = playTurn(state, 0, 1);
      expect(played.winner).toBe("j1");
      expect(played.sides.j2.fighter.moves[1].pp).toBe(30);
    });
  });

  describe("endDuel et abandonDuel", () => {
    it("should end a duel without playing it out", () => {
      const ended = endDuel(duel(), "draw", "interruption");
      expect(ended.winner).toBe("draw");
      expect(ended.endedReason).toBe("interruption");
      expect(ended.hash).not.toBe(duel().hash);
    });

    it("should hand the duel to the other side on an abandon", () => {
      expect(abandonDuel(duel(), "j1").winner).toBe("j2");
      expect(abandonDuel(duel(), "j2").winner).toBe("j1");
      expect(abandonDuel(duel(), "j1").endedReason).toBe("abandon de J1");
    });
  });

  describe("determinism and replay", () => {
    it("should play the same duel twice from the same seed and the same choices", () => {
      const script: [number, number][] = [
        [0, 0],
        [1, 1],
        [0, 0],
      ];
      const play = () => {
        let state = duel({ seed: 99 });
        for (const [first, second] of script) {
          state = playTurn(state, first, second);
        }
        return state;
      };
      const one = play();
      const other = play();
      expect(one.hash).toBe(other.hash);
      expect(one.sides.j1.fighter.hp).toBe(other.sides.j1.fighter.hp);
      expect(one.sides.j2.fighter.hp).toBe(other.sides.j2.fighter.hp);
      expect(one.history).toEqual(other.history);
    });

    it("should replay a duel from its command log and land on the same state", () => {
      let state = duel({ seed: 4242 });
      const opening = state;
      for (let turn = 0; turn < 5; turn++) {
        state = playTurn(state, turn % 2, (turn + 1) % 2);
      }
      const replayed = replayDuel(opening, state.history, resolveDuelTurn);
      expect(replayed).not.toBeNull();
      expect(replayed?.hash).toBe(state.hash);
      expect(replayed?.sides.j1.fighter.hp).toBe(state.sides.j1.fighter.hp);
      expect(replayed?.turnId).toBe(state.turnId);
    });

    it("should refuse to replay a log it cannot follow", () => {
      const state = playTurn(duel(), 0, 0);
      const broken: DuelTurnRecord[] = [
        {
          turnId: 1,
          order: ["j1", "j2"],
          commands: { j1: { type: "fight", moveIndex: 0 }, j2: { type: "fight", moveIndex: 0 } },
          log: [],
        },
        {
          turnId: 2,
          order: ["j2", "j1"],
          commands: { j1: { type: "fight", moveIndex: 9 }, j2: { type: "fight", moveIndex: 0 } },
          log: [],
        },
      ];
      expect(replayDuel(duel(), broken, resolveDuelTurn)).toBeNull();
      expect(replayDuel(duel(), state.history, () => ({ sides: [], order: [], log: [] }))).toBeNull();
    });

    it("should make the seed matter for a speed tie", () => {
      const orders = new Set<string>();
      for (let index = 1; index <= 20; index++) {
        // Les graines réelles viennent d'une empreinte, pas d'un compteur : c'est
        // ce que le duel utilise, donc c'est ce qu'on éprouve.
        const seed = duelSeedFor("m-1:1:0", { j1: `equipe-${index}`, j2: "equipe-fixe" });
        const state = duel({ seed, sides: { j2: { stats: [100, 60, 50, 70, 60, 90], maxHp: 100, hp: 100 } } });
        const played = playTurn(state, 0, 0);
        orders.add(played.history[0].order.join("-"));
      }
      expect(orders.size).toBe(2);
      expect(orders.has("j1-j2")).toBe(true);
      expect(orders.has("j2-j1")).toBe(true);
    });

    it("should fingerprint the durable part of the duel", () => {
      const state = duel();
      expect(duelHash(state)).toBe(state.hash);
      expect(duelHash({ ...state, turnId: 7 })).not.toBe(state.hash);
      const advanced = playTurn(state, 0, 0);
      expect(duelHash(advanced)).toBe(advanced.hash);
    });
  });
});
