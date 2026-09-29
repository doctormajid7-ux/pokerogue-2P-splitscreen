/*
 * SPDX-FileCopyrightText: 2026 Pagefault Games
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Mechanics of one duel turn (lot D1), **provisional**.
 *
 * This is the one place where the duel does not yet go through PokeRogue's own
 * battle math, and it is deliberately kept small and separate so that it can be
 * replaced without touching the engine or the protocol:
 *
 * - every input is the game's: statistics come from the frozen member rebuilt
 *   through the game's level path, move power/category/priority/accuracy from the
 *   game's move tables, and the type matchup from the game's own chart
 *   (`getTypeDamageMultiplier`). Nothing is copied from the game's data;
 * - what is written here is the *turn*: who goes first, whether the move lands,
 *   whether it crits, how hard it hits. Damage uses the standard formula from the
 *   levels, the power and the two statistics;
 * - what is **not** here, and is therefore not simulated in this reduced duel: abilities,
 *   status conditions, stat stages, weather and terrain, multi-hit and multi-turn
 *   moves, healing, held items, and the specific effects of
 *   every move (a move with no power deals nothing, whatever its text says).
 *   Team switching and Lutte are handled here, including Lutte's recoil.
 *
 * The engine does not trust any of it: {@linkcode resolveTurn} checks the answer
 * before applying it. Wiring the turn into a real `Battle` — so that these
 * numbers come from `getAttackDamage` and the whole move/ability machinery — is
 * the next step of lot D; until then a D1 duel is a faithful *fight between two
 * real teams*, not a faithful *PokeRogue battle*.
 */

import type {
  DuelActionResult,
  DuelFighter,
  DuelResolution,
  DuelSide,
  DuelSideOutcome,
  DuelTurnContext,
} from "#system/duel-engine";
import { DUEL_STAT } from "#system/duel-engine";
import { DUEL_PLAYER_IDS } from "#system/duel-snapshot";

/** Critical hit chance, one in this many: the base rate of the modern games. */
export const DUEL_CRIT_CHANCE = 24;

/** Damage is rolled between 85% and 100%: the game's damage roll. */
export const DUEL_DAMAGE_ROLL_MIN = 85;

/** Multiplier applied by a critical hit. */
export const DUEL_CRIT_MULTIPLIER = 1.5;

/** Multiplier of a move whose type matches one of its user's types. */
export const DUEL_STAB_MULTIPLIER = 1.5;

/** `MoveCategory.STATUS`: a move that deals nothing on its own. */
export const DUEL_CATEGORY_STATUS = 2;

/**
 * Resolves one turn of a duel.
 *
 * Order is by priority, then by speed, with a seeded coin flip on a tie. Each
 * fighter that is still standing uses the move it locked: it may miss (accuracy),
 * it may crit, and it deals the standard damage for its level, the move's power,
 * the attacker's attack and the defender's defence, adjusted by the type matchup
 * the game computed and by same-type bonus.
 *
 * @param context - The turn to resolve, and the only randomness allowed
 * @returns New HP and PP for both sides, with the lines to display
 */
export function resolveDuelTurn(context: DuelTurnContext): DuelResolution {
  const sides = { ...context.sides };
  const order = turnOrder(sides, context.commands, context.randomInt);
  const log: string[] = [];
  const actionResults: DuelActionResult[] = [];
  /** Côtés qui ont réellement agi : un camp mis K.O. avant son tour n'y est pas. */
  const acting: DuelSide[] = [];

  for (const side of order) {
    const attacker = sides[side];
    const defender = sides[otherSide(side)];
    if (attacker.hp <= 0) {
      continue; // mis K.O. par le camp qui vient d'agir
    }
    acting.push(side);
    const command = context.commands[side];
    if ("type" in command && command.type === "switch") {
      continue;
    }
    const struggle = "type" in command && command.type === "struggle";
    const move = struggle
      ? {
          moveId: 0,
          name: "Lutte",
          type: -1,
          category: 0,
          power: 50,
          accuracy: -1,
          priority: 0,
          pp: 1,
          ppMax: 1,
          effectiveness: 1,
        }
      : attacker.moves["moveIndex" in command ? command.moveIndex : -1];
    if (move === undefined || move.pp <= 0) {
      log.push(`${label(attacker)} n'a plus d'attaque utilisable`);
      actionResults.push({
        side,
        result: "failed",
        effectiveness: 1,
        critical: false,
        damage: 0,
        recoil: 0,
        targetFainted: false,
        attackerFainted: false,
      });
      continue;
    }
    if (!struggle) {
      // L'attaque est choisie : les PP partent même si elle rate.
      attacker.moves = attacker.moves.map((candidate, index) =>
        index === ("moveIndex" in command ? command.moveIndex : -1)
          ? { ...candidate, pp: candidate.pp - 1 }
          : candidate,
      );
    }

    if (!hits(move.accuracy, context.randomInt)) {
      log.push(`${label(attacker)} utilise ${move.name} — raté`);
      actionResults.push({
        side,
        result: "miss",
        effectiveness: 0,
        critical: false,
        damage: 0,
        recoil: 0,
        targetFainted: false,
        attackerFainted: false,
      });
      continue;
    }
    if (move.power <= 0 || move.category === DUEL_CATEGORY_STATUS) {
      // Provisoire : les effets des attaques de statut ne sont pas simulés.
      log.push(`${label(attacker)} utilise ${move.name} — sans effet`);
      actionResults.push({
        side,
        result: "failed",
        effectiveness: 1,
        critical: false,
        damage: 0,
        recoil: 0,
        targetFainted: false,
        attackerFainted: false,
      });
      continue;
    }

    const critical = context.randomInt(DUEL_CRIT_CHANCE) === 0;
    const effectiveness = struggle ? 1 : (context.typeMultiplier?.(move.type, defender.types) ?? move.effectiveness);
    const damage = damageOf(attacker, defender, move, effectiveness, critical, context.randomInt);
    if (effectiveness === 0 || damage <= 0) {
      log.push(`${label(attacker)} utilise ${move.name} — aucun effet sur ${label(defender)}`);
      actionResults.push({
        side,
        result: "no_effect",
        effectiveness,
        critical: false,
        damage: 0,
        recoil: 0,
        targetFainted: false,
        attackerFainted: false,
      });
      continue;
    }
    defender.hp = Math.max(0, defender.hp - damage);
    let recoil = 0;
    if (struggle) {
      recoil = Math.max(1, Math.floor(attacker.maxHp / 4));
      attacker.hp = Math.max(0, attacker.hp - recoil);
    }
    const suffix = critical ? " (coup critique)" : "";
    log.push(`${label(attacker)} utilise ${move.name} — ${damage} dégâts${suffix}`);
    if (recoil > 0) {
      log.push(`${label(attacker)} subit ${recoil} PV de contrecoup`);
    }
    if (defender.hp <= 0) {
      log.push(`${label(defender)} est K.O.`);
    }
    if (attacker.hp <= 0) {
      log.push(`${label(attacker)} est K.O.`);
    }
    actionResults.push({
      side,
      result: "hit",
      effectiveness,
      critical,
      damage,
      recoil,
      targetFainted: defender.hp <= 0,
      attackerFainted: attacker.hp <= 0,
    });
  }

  const outcomes: DuelSideOutcome[] = DUEL_PLAYER_IDS.map(side => ({
    side,
    hp: sides[side].hp,
    pp: sides[side].moves.map(move => move.pp),
  }));
  return { sides: outcomes, order: acting, log, actionResults };
}

/**
 * Order of the turn: priority of the chosen move, then speed, then a coin flip.
 *
 * Exported because it is the part of a turn a player can follow without seeing
 * the numbers: the same two choices always give the same order.
 *
 * @param sides - Both fighters
 * @param commands - The move each side locked
 * @param randomInt - Seeded generator, used only for the speed tie
 * @returns The two sides, in the order they act
 */
export function turnOrder(
  sides: Record<DuelSide, DuelFighter>,
  commands: DuelTurnContext["commands"],
  randomInt: (max: number) => number,
): DuelSide[] {
  const [a, b] = DUEL_PLAYER_IDS;
  const priority = (side: DuelSide): number => {
    const command = commands[side];
    if ("type" in command && command.type === "switch") {
      return Number.POSITIVE_INFINITY;
    }
    return "moveIndex" in command ? (sides[side].moves[command.moveIndex]?.priority ?? 0) : 0;
  };
  const speed = (side: DuelSide): number => sides[side].stats[DUEL_STAT.SPD] ?? 0;
  if (priority(a) !== priority(b)) {
    return priority(a) > priority(b) ? [a, b] : [b, a];
  }
  if (speed(a) !== speed(b)) {
    return speed(a) > speed(b) ? [a, b] : [b, a];
  }
  return randomInt(2) === 0 ? [a, b] : [b, a];
}

/** Whether a move with this accuracy lands. `-1` never misses. */
function hits(accuracy: number, randomInt: (max: number) => number): boolean {
  if (accuracy < 0) {
    return true;
  }
  return randomInt(100) < accuracy;
}

/** Damage of one move, from the numbers the game provided. */
function damageOf(
  attacker: DuelFighter,
  defender: DuelFighter,
  move: DuelFighter["moves"][number],
  effectiveness: number,
  critical: boolean,
  randomInt: (max: number) => number,
): number {
  const physical = move.category === 0;
  const attack = attacker.stats[physical ? DUEL_STAT.ATK : DUEL_STAT.SPATK] ?? 0;
  const defence = defender.stats[physical ? DUEL_STAT.DEF : DUEL_STAT.SPDEF] ?? 0;
  if (attack <= 0 || defence <= 0) {
    return 0;
  }
  const base = Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * move.power * attack) / defence / 50) + 2;
  const stab = attacker.types.includes(move.type) ? DUEL_STAB_MULTIPLIER : 1;
  const roll = (DUEL_DAMAGE_ROLL_MIN + randomInt(16)) / 100;
  const multiplier = effectiveness * stab * roll * (critical ? DUEL_CRIT_MULTIPLIER : 1);
  return Math.max(1, Math.floor(base * multiplier));
}

/** The other side of the duel. */
function otherSide(side: DuelSide): DuelSide {
  return side === "j1" ? "j2" : "j1";
}

/** How a side is named in the log: its player, then its Pokémon. */
function label(fighter: DuelFighter): string {
  return `${fighter.side.toUpperCase()} (${fighter.name})`;
}
