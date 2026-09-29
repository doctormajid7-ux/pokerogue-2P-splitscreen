import type { DuelFighter, DuelResolver, DuelSide, DuelTurnContext } from "#system/duel-engine";
import { createDuel, lockCommand, resolveTurn } from "#system/duel-engine";
import { resolveDuelTurn, turnOrder } from "#system/duel-mechanics";
import { describe, expect, it } from "vitest";

/** Un combattant tel que le cadre d'un joueur le matérialise. */
function fighter(side: DuelSide, overrides: Partial<DuelFighter> = {}): DuelFighter {
  return {
    side,
    species: 25,
    name: `Pika-${side}`,
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
        moveId: 33,
        name: "Charge",
        type: 0,
        category: 0,
        power: 40,
        accuracy: 100,
        priority: 0,
        pp: 35,
        ppMax: 35,
        effectiveness: 1,
      },
    ],
    ...overrides,
  };
}

/** Un générateur qui rend toujours la même valeur. */
const always = (value: number) => () => value;

/**
 * Un générateur qui rend toujours le pire tirage utile sans jamais échouer :
 * une précision de 100 touche, un coup critique ne sort pas, les dégâts sont au
 * maximum. Il respecte la borne `max`, comme le vrai générateur.
 */
const neutral = (max: number) => max - 1;

/** Un générateur qui suit une liste, puis répète la dernière valeur. */
function sequence(values: number[]) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}

function context(
  overrides: {
    j1?: Partial<DuelFighter>;
    j2?: Partial<DuelFighter>;
    moves?: [number, number];
    randomInt?: (max: number) => number;
  } = {},
): DuelTurnContext {
  const [move1, move2] = overrides.moves ?? [0, 0];
  return {
    turnId: 1,
    commands: { j1: { type: "fight", moveIndex: move1 }, j2: { type: "fight", moveIndex: move2 } },
    sides: { j1: fighter("j1", overrides.j1), j2: fighter("j2", overrides.j2) },
    randomInt: overrides.randomInt ?? always(99),
  };
}

/** Dégâts annoncés par la ligne de log. */
function damageOf(result: { log: string[] }, side: DuelSide): number {
  const line = result.log.find(entry => entry.startsWith(`${side.toUpperCase()} (`) && entry.includes("dégâts"));
  return line === undefined ? 0 : Number(/— (\d+) dégâts/.exec(line)?.[1] ?? 0);
}

describe("duel mechanics", () => {
  describe("turnOrder", () => {
    it("should let priority beat speed", () => {
      const sides = {
        j1: fighter("j1", { moves: [{ ...fighter("j1").moves[0], priority: 1 }] }),
        j2: fighter("j2", { stats: [100, 60, 50, 70, 60, 999] }),
      };
      expect(turnOrder(sides, { j1: { moveIndex: 0 }, j2: { moveIndex: 1 } }, always(0))).toEqual(["j1", "j2"]);
    });

    it("should order by speed in the absence of priority", () => {
      const faster = { j1: fighter("j1", { stats: [100, 60, 50, 70, 60, 120] }), j2: fighter("j2") };
      expect(turnOrder(faster, { j1: { moveIndex: 0 }, j2: { moveIndex: 0 } }, always(0))).toEqual(["j1", "j2"]);
      const slower = { j1: fighter("j1", { stats: [100, 60, 50, 70, 60, 10] }), j2: fighter("j2") };
      expect(turnOrder(slower, { j1: { moveIndex: 0 }, j2: { moveIndex: 0 } }, always(0))).toEqual(["j2", "j1"]);
    });

    it("should flip a speed tie with the seeded generator", () => {
      const sides = { j1: fighter("j1"), j2: fighter("j2") };
      const commands = { j1: { moveIndex: 0 }, j2: { moveIndex: 0 } };
      let calls = 0;
      const counting = (max: number) => {
        calls++;
        expect(max).toBe(2);
        return 1;
      };
      expect(turnOrder(sides, commands, counting)).toEqual(["j2", "j1"]);
      expect(calls).toBe(1);
      expect(turnOrder(sides, commands, always(0))).toEqual(["j1", "j2"]);
    });
  });

  describe("resolveDuelTurn", () => {
    it("should spend the PP of the chosen move, and only of that move", () => {
      const result = resolveDuelTurn(context({ randomInt: always(99) }));
      expect(result.sides.find(side => side.side === "j1")?.pp).toEqual([14, 35]);
      expect(result.sides.find(side => side.side === "j2")?.pp).toEqual([14, 35]);
    });

    it("should hit, deal damage, and say who went first", () => {
      const result = resolveDuelTurn(context({ randomInt: always(0) }));
      expect(result.order).toEqual(["j1", "j2"]);
      expect(result.log.length).toBeGreaterThan(0);
      expect(damageOf(result, "j1")).toBeGreaterThan(0);
      expect(damageOf(result, "j2")).toBeGreaterThan(0);
      const j1 = result.sides.find(side => side.side === "j1");
      expect(j1?.hp).toBeGreaterThanOrEqual(0);
      expect(j1?.hp).toBeLessThan(100);
    });

    it("should miss when the roll is above the accuracy", () => {
      const result = resolveDuelTurn(
        context({ j1: { moves: [{ ...fighter("j1").moves[0], accuracy: 90 }] }, randomInt: neutral }),
      );
      expect(result.log.some(line => line.includes("raté"))).toBe(true);
      // L'adversaire, lui, n'a rien encaissé.
      expect(result.sides.find(side => side.side === "j2")?.hp).toBe(100);
      // Les PP partent quand même : l'attaque a été choisie.
      expect(result.sides.find(side => side.side === "j1")?.pp[0]).toBe(14);
    });

    it("should never miss with an accuracy of -1", () => {
      const result = resolveDuelTurn(
        context({ j1: { moves: [{ ...fighter("j1").moves[0], accuracy: -1 }] }, randomInt: neutral }),
      );
      expect(result.log.some(line => line.includes("raté"))).toBe(false);
      expect(damageOf(result, "j1")).toBeGreaterThan(0);
    });

    it("should deal nothing without a power, or with a type immunity", () => {
      const status = resolveDuelTurn(
        context({ j1: { moves: [{ ...fighter("j1").moves[0], power: 0, category: 2 }] }, randomInt: always(0) }),
      );
      expect(status.log.some(line => line.includes("sans effet"))).toBe(true);
      expect(status.sides.find(side => side.side === "j2")?.hp).toBe(100);

      const immune = resolveDuelTurn(
        context({ j1: { moves: [{ ...fighter("j1").moves[0], effectiveness: 0 }] }, randomInt: always(0) }),
      );
      expect(immune.log.some(line => line.includes("aucun effet"))).toBe(true);
      expect(immune.sides.find(side => side.side === "j2")?.hp).toBe(100);
    });

    it("should hit harder with same-type bonus and a better matchup", () => {
      const plain = resolveDuelTurn(
        context({ j1: { types: [0], moves: [{ ...fighter("j1").moves[0], type: 13 }] }, randomInt: always(0) }),
      );
      const stab = resolveDuelTurn(context({ randomInt: always(0) }));
      const effective = resolveDuelTurn(
        context({ j1: { moves: [{ ...fighter("j1").moves[0], effectiveness: 2 }] }, randomInt: always(0) }),
      );
      const base = damageOf(plain, "j1");
      expect(damageOf(stab, "j1")).toBeGreaterThan(base);
      expect(damageOf(effective, "j1")).toBeGreaterThan(stab === undefined ? base : damageOf(stab, "j1"));
    });

    it("should hit harder on a critical hit", () => {
      // Ordre des tirages pour J1 : vitesse à égalité, précision, critique, dégâts.
      // Le générateur est celui des deux camps : les tirages de J2 suivent.
      const normal = resolveDuelTurn(context({ randomInt: sequence([0, 50, 23, 15]) }));
      const critical = resolveDuelTurn(context({ randomInt: sequence([0, 50, 0, 15]) }));
      expect(damageOf(normal, "j1")).toBeGreaterThan(0);
      expect(damageOf(critical, "j1")).toBeGreaterThan(damageOf(normal, "j1"));
    });

    it("should not let a knocked-out fighter act, nor spend its PP", () => {
      const result = resolveDuelTurn(context({ j2: { hp: 1, maxHp: 100 }, randomInt: always(0) }));
      expect(result.sides.find(side => side.side === "j2")?.hp).toBe(0);
      expect(result.order).toEqual(["j1"]);
      expect(result.sides.find(side => side.side === "j2")?.pp).toEqual([15, 35]);
      expect(result.log.some(line => line.includes("K.O."))).toBe(true);
    });

    it("should report both sides, whatever the order", () => {
      const result = resolveDuelTurn(context({ j2: { stats: [100, 60, 50, 70, 60, 999] }, randomInt: always(0) }));
      expect(result.order).toEqual(["j2", "j1"]);
      expect(result.sides.map(side => side.side).sort()).toEqual(["j1", "j2"]);
      for (const side of result.sides) {
        expect(side.pp).toHaveLength(2);
      }
    });
  });

  describe("with the engine", () => {
    it("should play a duel to its end and name a winner", () => {
      const state = createDuel({
        duelId: "m-1:1:0",
        seed: 20260928,
        fighters: { j1: fighter("j1"), j2: fighter("j2", { hp: 40, maxHp: 40 }) },
      });
      expect(state).not.toBeNull();
      let current = state!;
      for (let turn = 0; turn < 40 && current.winner === null; turn++) {
        current = lockCommand(current, "j1", { type: "fight", moveIndex: 0 }).state;
        current = lockCommand(current, "j2", { type: "fight", moveIndex: 1 }).state;
        const outcome = resolveTurn(current, resolveDuelTurn);
        expect(outcome.accepted).toBe(true);
        current = outcome.state;
      }
      expect(current.winner).toBe("j1");
      expect(current.history.length).toBeLessThanOrEqual(40);
      expect(current.sides.j2.fighter.hp).toBe(0);
      expect(current.history.every(record => record.log.length > 0)).toBe(true);
    });

    it("should be refused by the engine when the mechanics lie about a side", () => {
      const lying = ((): DuelResolver => {
        return context => ({
          sides: [
            { side: "j1", hp: context.sides.j1.hp, pp: context.sides.j1.moves.map(move => move.pp) },
            { side: "j2", hp: context.sides.j2.hp + 10, pp: context.sides.j2.moves.map(move => move.pp) },
          ],
          order: ["j1", "j2"],
          log: [],
        });
      })();
      const opened = createDuel({
        duelId: "m-1:1:0",
        seed: 1,
        fighters: { j1: fighter("j1"), j2: fighter("j2") },
      })!;
      const locked = lockCommand(lockCommand(opened, "j1", { type: "fight", moveIndex: 0 }).state, "j2", {
        type: "fight",
        moveIndex: 0,
      }).state;
      expect(resolveTurn(locked, lying).accepted).toBe(false);
    });
  });
});
