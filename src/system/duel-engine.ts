/*
 * SPDX-FileCopyrightText: 2026 Pagefault Games
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Authoritative engine of a local duel (lot D1, `docs/android-2p-game-modes.md`).
 *
 * A duel carries one active Pokémon and up to five reserves per player. Players lock
 * an attack, a replacement, or Lutte when all PP are depleted, without seeing
 * the other's choice. The turn is resolved **once** by this
 * engine — the shell holds it, not a frame, so neither half can resolve a turn
 * twice or invent a result.
 *
 * Three properties explain its shape:
 *
 * 1. **Hidden until locked.** A locked command stays inside the engine: the
 *    public view exposes *that* a side has locked, never what it picked. An
 *    opponent cannot read its way to the counter-move.
 * 2. **Resolved once, then verified.** The mechanics are injected
 *    ({@linkcode DuelResolver}) — see `duel-mechanics.ts` — and this engine
 *    *checks the answer* before applying it: HP may only go down, PP may only
 *    decrease by exactly one for the move that was used, no side may come back
 *    from a K.O. A resolver that invents numbers is refused rather than trusted,
 *    which is what makes the injected seam safe to swap.
 * 3. **Reproducible.** The engine owns the only source of chance: a seeded
 *    generator advanced at each turn and stored in the state. Same seed and same
 *    command log mean the same duel, so a replay reproduces every hash — the
 *    condition the plan asks of D1.
 *
 * Nothing here knows about Phaser, the DOM or `localStorage`: a duel is a
 * JSON-safe state machine, testable on its own.
 */

import type { DuelFusionData, DuelPlayerId } from "#system/duel-snapshot";
import { contentChecksum, DUEL_PLAYER_IDS } from "#system/duel-snapshot";

/** Revision of the engine's state format. */
export const DUEL_ENGINE_VERSION = 1;

/** Turns after which the duel is declared a draw rather than dragging on. */
export const DUEL_TURN_LIMIT = 100;

/** Moves a fighter may carry; the first cut plays with the four of the run. */
export const DUEL_MOVE_MAX = 4;

/** Index of the statistics a damage calculation reads, in `Stat` order. */
export const DUEL_STAT = { HP: 0, ATK: 1, DEF: 2, SPATK: 3, SPDEF: 4, SPD: 5 } as const;

/** Sides of a duel. */
export type DuelSide = DuelPlayerId;

/** A move, as the game described it: no logic, only the numbers it carries. */
export interface DuelMoveMaterial {
  moveId: number;
  /** Name already translated by the game, for the battle log. */
  name: string;
  /** `PokemonType` value. */
  type: number;
  /** `MoveCategory` value: 0 physical, 1 special, 2 status. */
  category: number;
  power: number;
  /** Percentage; `-1` never misses. */
  accuracy: number;
  priority: number;
  pp: number;
  ppMax: number;
  /**
   * Type multiplier against the opponent today, from the game's own chart
   * (`getTypeDamageMultiplier`). The engine never guesses a matchup.
   */
  effectiveness: number;
}

/**
 * One side of the duel, materialized by its own frame.
 *
 * The numbers come from the game: it rebuilds the frozen team member through its
 * own level path, so the statistics are the real ones for the capped level, and
 * it reads the move tables and the type chart. The engine only plays with them.
 */
export interface DuelFighter {
  side: DuelSide;
  species: number;
  name: string;
  level: number;
  /** Appearance copied from the frozen team for the opponent's battle sprite. */
  appearance?: DuelFighterAppearance;
  /** Held item labels shown on the post-match result card. */
  heldItems?: string[];
  types: number[];
  /** `Stat` order: HP, ATK, DEF, SPATK, SPDEF, SPD. */
  stats: number[];
  maxHp: number;
  hp: number;
  shiny: boolean;
  variant: number;
  moves: DuelMoveMaterial[];
}

/** Visual identity the duel scene needs to show the same Pokémon as its run. */
export interface DuelFighterAppearance {
  formIndex: number;
  gender: number;
  custom: Record<string, unknown> | null;
  fusion: DuelFusionData | null;
}

/** What a player asks for on their turn. */
export type DuelCommand =
  | { type: "fight"; moveIndex: number }
  | { type: "switch"; benchIndex: number }
  | { type: "struggle" };

/** One side once the turn has been resolved, as the resolver reports it. */
export interface DuelSideOutcome {
  side: DuelSide;
  hp: number;
  pp: number[];
}

/** The visible result of one move, kept with the turn for battle presentation. */
export interface DuelActionResult {
  side: DuelSide;
  result: "hit" | "miss" | "failed" | "no_effect";
  effectiveness: number;
  critical: boolean;
  damage: number;
  recoil: number;
  targetFainted: boolean;
  attackerFainted: boolean;
}

/** What a resolver must answer: the new numbers, acting order and battle results. */
export interface DuelResolution {
  sides: DuelSideOutcome[];
  /**
   * Sides in the order they acted.
   *
   * A side the opponent knocked out before it moved is simply absent: the record
   * must say what happened, not what was planned.
   */
  order: DuelSide[];
  log: string[];
  /** Per-move results used by the visual battle scene. Optional for older resolvers. */
  actionResults?: DuelActionResult[];
}

/** Everything a resolver may look at, and the only source of chance it may use. */
export interface DuelTurnContext {
  turnId: number;
  /** Bare move indexes remain accepted by the isolated mechanics API. */
  commands: Record<DuelSide, DuelCommand | { moveIndex: number }>;
  /** Copies of both fighters, with the state of the turn to resolve. */
  sides: Record<DuelSide, DuelFighter>;
  /** Seeded integer in `[0, max)`; the duel has no other randomness. */
  randomInt: (max: number) => number;
  /** Optional game type chart, needed when a reserve replaces the defender. */
  typeMultiplier?: (moveType: number, defenderTypes: readonly number[]) => number;
}

/** Mechanics of a turn: implemented by the game side, injected here. */
export type DuelResolver = (context: DuelTurnContext) => DuelResolution;

/** A settled turn, kept so a duel can be replayed command by command. */
export interface DuelTurnRecord {
  turnId: number;
  /** Order in which the moves went off. */
  order: DuelSide[];
  commands: Record<DuelSide, DuelCommand>;
  log: string[];
  /** Per-move results used by the visual battle scene. */
  actionResults?: DuelActionResult[];
}

/** State of one side: the fighter itself, plus what it has locked. */
export interface DuelSideState {
  side: DuelSide;
  fighter: DuelFighter;
  /** Other team members, including those already knocked out. */
  bench?: DuelFighter[];
}

/** The whole duel, JSON-safe and enough to replay it. */
export interface DuelState {
  version: number;
  duelId: string;
  seed: number;
  /** Internal state of the seeded generator: what makes a replay deterministic. */
  rng: number;
  turnId: number;
  turnLimit: number;
  sides: Record<DuelSide, DuelSideState>;
  /** Commands locked for the turn being played, hidden until both are in. */
  pending: Record<DuelSide, DuelCommand | null>;
  /** Settled turns, in order: the command log a replay works from. */
  history: DuelTurnRecord[];
  winner: DuelSide | "draw" | null;
  endedReason: string | null;
  /** Fingerprint of the durable part of the state, per turn. */
  hash: string;
}

/** Public state of one side: what both halves are allowed to see. */
export interface DuelPublicSide {
  side: DuelSide;
  name: string;
  species: number;
  level: number;
  types: number[];
  shiny: boolean;
  variant: number;
  hp: number;
  maxHp: number;
  /** Moves this side can still use; the moves themselves stay private. */
  movesLeft: number;
  locked: boolean;
  fainted: boolean;
  /** Number of team members still able to fight, active one included. */
  remaining: number;
  teamSize: number;
}

/** Public state of the duel: the mirrored field both halves display. */
export interface DuelPublicState {
  version: number;
  duelId: string;
  turnId: number;
  turnLimit: number;
  sides: Record<DuelSide, DuelPublicSide>;
  lastTurn: DuelTurnRecord | null;
  winner: DuelSide | "draw" | null;
  endedReason: string | null;
  hash: string;
  finished: boolean;
}

/** A reserve choice, visible only to its owner. */
export interface DuelBenchItem {
  benchIndex: number;
  name: string;
  hp: number;
  maxHp: number;
}

/** Outcome of locking a command. */
export interface LockOutcome {
  state: DuelState;
  accepted: boolean;
  reason?: string;
  /** Both sides have locked: the turn can be resolved. */
  readyToResolve: boolean;
}

/** Outcome of resolving a turn. */
export interface ResolveOutcome {
  state: DuelState;
  accepted: boolean;
  reason?: string;
}

// ------------------------------------------------------------------- generator

/**
 * Seeded generator (mulberry32): 32 bits of state, deterministic everywhere.
 *
 * The game's own randomness comes from a seed offset on a global scene; a duel
 * must not depend on the scene's bookkeeping, so it carries its own. It is the
 * only randomness a resolver may use.
 *
 * @param seed - Seed of the duel
 * @returns An integer generator and its current state
 */
export function createDuelRng(seed: number): { randomInt: (max: number) => number; state: () => number } {
  let state = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 1;
  const randomInt = (max: number): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    const result = ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    const bound = Number.isInteger(max) && max > 0 ? max : 1;
    return Math.floor(result * bound);
  };
  return { randomInt, state: () => state };
}

/**
 * Seed of a duel, derived from the duel and the two frozen teams.
 *
 * Derived rather than drawn at random, for the same reason the duel identifier
 * is (C2): a resumed match prepares the same duel, and it must also play the same
 * duel. Two different duels, or two different teams, give two different seeds.
 *
 * @param duelId - Identifier of the duel
 * @param teamChecksums - Fingerprints of the two frozen teams, in side order
 * @returns A 32-bit seed
 */
export function duelSeedFor(duelId: string, teamChecksums: Record<DuelSide, string | null>): number {
  const fingerprint = contentChecksum({
    duelId,
    teams: DUEL_PLAYER_IDS.map(side => teamChecksums[side] ?? null),
  });
  return Number.parseInt(fingerprint, 16) >>> 0;
}

// ---------------------------------------------------------------------- start

/**
 * Opens a duel from two materialized fighters.
 *
 * @param options - Duel identifier, seed and the fighters of both sides
 * @returns The initial state, or `null` when the fighters are unusable
 */
export function createDuel({
  duelId,
  seed,
  fighters,
  turnLimit = DUEL_TURN_LIMIT,
}: {
  duelId: string;
  seed: number;
  fighters: Record<DuelSide, DuelFighter | DuelFighter[]>;
  turnLimit?: number;
}): DuelState | null {
  if (typeof duelId !== "string" || duelId === "") {
    return null;
  }
  const sides = {} as Record<DuelSide, DuelSideState>;
  for (const side of DUEL_PLAYER_IDS) {
    const supplied = fighters?.[side];
    const team = Array.isArray(supplied) ? supplied : [supplied];
    if (team.length === 0 || team.length > 6 || team.some(member => !isDuelFighter(member, side)) || team[0].hp <= 0) {
      return null;
    }
    sides[side] = { side, fighter: cloneFighter(team[0]), bench: team.slice(1).map(cloneFighter) };
  }
  const rng = createDuelRng(seed);
  const state: DuelState = {
    version: DUEL_ENGINE_VERSION,
    duelId,
    seed,
    rng: rng.state(),
    turnId: 1,
    turnLimit: Number.isInteger(turnLimit) && turnLimit > 0 ? turnLimit : DUEL_TURN_LIMIT,
    sides,
    pending: { j1: null, j2: null },
    history: [],
    winner: null,
    endedReason: null,
    hash: "",
  };
  return { ...state, hash: duelHash(state) };
}

/**
 * Whether `value` is a fighter this engine can play.
 *
 * Strict: a fighter is produced by the game from a frozen team, so anything
 * merely *readable* is refused rather than repaired — a duel built on guessed
 * statistics would be a duel nobody played.
 *
 * @param value - The parsed value to inspect
 * @param side - Side it must belong to
 * @returns Whether it is a complete {@linkcode DuelFighter}
 */
export function isDuelFighter(value: unknown, side?: DuelSide): value is DuelFighter {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const fighter = value as Partial<DuelFighter>;
  return (
    (side === undefined || fighter.side === side)
    && DUEL_PLAYER_IDS.includes(fighter.side as DuelSide)
    && isInteger(fighter.species, 1, Number.MAX_SAFE_INTEGER)
    && isInteger(fighter.level, 1, 1000)
    && typeof fighter.name === "string"
    && (fighter.heldItems === undefined
      || (Array.isArray(fighter.heldItems)
        && fighter.heldItems.length <= 20
        && fighter.heldItems.every(item => typeof item === "string")))
    && (fighter.appearance === undefined || isDuelFighterAppearance(fighter.appearance))
    && Array.isArray(fighter.types)
    && fighter.types.length > 0
    && fighter.types.every(type => Number.isInteger(type))
    && Array.isArray(fighter.stats)
    && fighter.stats.length >= 6
    && fighter.stats.every(stat => Number.isFinite(stat))
    && isInteger(fighter.maxHp, 1, Number.MAX_SAFE_INTEGER)
    && isInteger(fighter.hp, 0, fighter.maxHp as number)
    && typeof fighter.shiny === "boolean"
    && Number.isInteger(fighter.variant)
    && Array.isArray(fighter.moves)
    && fighter.moves.length > 0
    && fighter.moves.length <= DUEL_MOVE_MAX
    && fighter.moves.every(isMoveMaterial)
  );
}

/** Whether `value` is a move the engine can play. */
export function isMoveMaterial(value: unknown): value is DuelMoveMaterial {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const move = value as Partial<DuelMoveMaterial>;
  return (
    isInteger(move.moveId, 1, Number.MAX_SAFE_INTEGER)
    && typeof move.name === "string"
    && Number.isInteger(move.type)
    && isInteger(move.category, 0, 2)
    // `-1` est la puissance des attaques de statut dans les tables du jeu :
    // elles ne frappent pas, mais elles restent des attaques jouables.
    && isInteger(move.power, -1, 999)
    && typeof move.accuracy === "number"
    && Number.isFinite(move.accuracy)
    && Number.isInteger(move.priority)
    && isInteger(move.pp, 0, 999)
    && isInteger(move.ppMax, 1, 999)
    && typeof move.effectiveness === "number"
    && Number.isFinite(move.effectiveness)
    && move.effectiveness >= 0
  );
}

// ------------------------------------------------------------------ commandes

/**
 * Locks the move of one side for the current turn.
 *
 * A side may lock once per turn: a second command, a command for an old turn, an
 * unknown move or a move without PP left are all refused, so a duplicated message
 * or a stale one cannot make the turn resolve twice or with a move its owner no
 * longer has.
 *
 * @param state - State of the duel
 * @param side - Side locking its move
 * @param command - What it picked
 * @returns The state (unchanged when refused) and whether both sides are ready
 */
export function lockCommand(state: DuelState, side: DuelSide, command: DuelCommand): LockOutcome {
  if (!DUEL_PLAYER_IDS.includes(side)) {
    return { state, accepted: false, reason: "côté inconnu", readyToResolve: false };
  }
  if (state.winner !== null) {
    return { state, accepted: false, reason: "duel terminé", readyToResolve: false };
  }
  if (state.pending[side] !== null) {
    return { state, accepted: false, reason: "choix déjà verrouillé", readyToResolve: false };
  }
  if (state.sides[side].fighter.hp <= 0) {
    return { state, accepted: false, reason: "combattant K.O.", readyToResolve: false };
  }
  if (typeof command !== "object" || command === null) {
    return { state, accepted: false, reason: "choix illisible", readyToResolve: false };
  }
  if (command.type === "fight") {
    const move = state.sides[side].fighter.moves[command.moveIndex];
    if (!Number.isInteger(command.moveIndex) || move === undefined) {
      return { state, accepted: false, reason: "attaque inconnue", readyToResolve: false };
    }
    if (move.pp <= 0) {
      return { state, accepted: false, reason: "plus de PP", readyToResolve: false };
    }
  } else if (command.type === "switch") {
    const replacement = (state.sides[side].bench ?? [])[command.benchIndex];
    if (!Number.isInteger(command.benchIndex) || replacement === undefined || replacement.hp <= 0) {
      return { state, accepted: false, reason: "remplaçant indisponible", readyToResolve: false };
    }
  } else if (command.type === "struggle") {
    if (state.sides[side].fighter.moves.some(move => move.pp > 0)) {
      return { state, accepted: false, reason: "des attaques restent disponibles", readyToResolve: false };
    }
  } else {
    return { state, accepted: false, reason: "choix inconnu", readyToResolve: false };
  }
  const pending = { ...state.pending, [side]: { ...command } };
  const readyToResolve = DUEL_PLAYER_IDS.every(candidate => pending[candidate] !== null);
  return { state: { ...state, pending }, accepted: true, readyToResolve };
}

/**
 * Resolves the turn both sides have locked.
 *
 * The resolver is asked for the new numbers and its answer is **checked** before
 * being applied: HP may only go down, the move that was used loses exactly one
 * PP, the others lose none, and nobody gets back up. A refused resolution leaves
 * the duel exactly where it was, ready to be tried again — the state is never
 * half-advanced.
 *
 * @param state - State of the duel, both commands locked
 * @param resolver - Mechanics of the turn
 * @returns The next state, and whether the resolution was applied
 */
export function resolveTurn(state: DuelState, resolver: DuelResolver): ResolveOutcome {
  if (state.winner !== null) {
    return { state, accepted: false, reason: "duel terminé" };
  }
  const commands = {
    j1: state.pending.j1,
    j2: state.pending.j2,
  } as Record<DuelSide, DuelCommand | null>;
  if (commands.j1 === null || commands.j2 === null) {
    return { state, accepted: false, reason: "les deux choix ne sont pas verrouillés" };
  }
  if (typeof resolver !== "function") {
    return { state, accepted: false, reason: "aucune mécanique de duel" };
  }

  const rng = createDuelRng(state.rng);
  const turnSides = {
    j1: {
      ...state.sides.j1,
      fighter: cloneFighter(state.sides.j1.fighter),
      bench: (state.sides.j1.bench ?? []).map(cloneFighter),
    },
    j2: {
      ...state.sides.j2,
      fighter: cloneFighter(state.sides.j2.fighter),
      bench: (state.sides.j2.bench ?? []).map(cloneFighter),
    },
  };
  const switchLog: string[] = [];
  for (const side of DUEL_PLAYER_IDS) {
    const command = commands[side]!;
    if (command.type !== "switch") {
      continue;
    }
    const current = turnSides[side];
    const incoming = current.bench[command.benchIndex];
    current.bench[command.benchIndex] = current.fighter;
    current.fighter = incoming;
    switchLog.push(`${side.toUpperCase()} envoie ${incoming.name}`);
  }
  const context: DuelTurnContext = {
    turnId: state.turnId,
    commands: { j1: commands.j1, j2: commands.j2 },
    sides: { j1: cloneFighter(turnSides.j1.fighter), j2: cloneFighter(turnSides.j2.fighter) },
    randomInt: rng.randomInt,
  };

  let resolution: DuelResolution;
  try {
    resolution = resolver(context);
  } catch (error) {
    console.warn("Duel 2P : mécanique de tour en échec", error);
    return { state, accepted: false, reason: "mécanique de tour en échec" };
  }
  if (!isResolution(resolution)) {
    return { state, accepted: false, reason: "résolution illisible" };
  }

  // La résolution doit parler des deux camps : sinon un camp pourrait sortir du
  // tour sans que personne n'ait touché à ses PV.
  if (resolution.sides.length !== DUEL_PLAYER_IDS.length) {
    return { state, accepted: false, reason: "résolution incomplète" };
  }

  const sides: Record<DuelSide, DuelSideState> = { ...turnSides };
  const log: string[] = [...switchLog];
  for (const outcome of resolution.sides) {
    const before = turnSides[outcome.side];
    if (outcome.hp > before.fighter.hp) {
      return { state, accepted: false, reason: "résolution qui soigne un combattant" };
    }
    if (outcome.hp > before.fighter.maxHp || outcome.hp < 0) {
      return { state, accepted: false, reason: "résolution hors bornes" };
    }
    // Les PP ne remontent jamais, et seule l'attaque choisie peut en perdre :
    // elle peut aussi n'en perdre aucun, si son camp a été mis K.O. avant d'agir.
    const command = commands[outcome.side]!;
    const usedIndex = command.type === "fight" ? command.moveIndex : -1;
    for (let index = 0; index < before.fighter.moves.length; index++) {
      const remaining = outcome.pp[index];
      if (remaining === undefined || remaining > before.fighter.moves[index].pp) {
        return { state, accepted: false, reason: "résolution qui invente des PP" };
      }
      if (index !== usedIndex && remaining !== before.fighter.moves[index].pp) {
        return { state, accepted: false, reason: "résolution qui touche aux PP d'une autre attaque" };
      }
      if (index === usedIndex) {
        const spent = resolution.order.includes(outcome.side) ? 1 : 0;
        if (remaining !== before.fighter.moves[index].pp - spent) {
          return { state, accepted: false, reason: "résolution avec dépense de PP incohérente" };
        }
      }
    }
    const moves = before.fighter.moves.map((move, index) => ({ ...move, pp: outcome.pp[index] }));
    sides[outcome.side] = {
      side: outcome.side,
      fighter: { ...before.fighter, hp: outcome.hp, moves },
      bench: before.bench ?? [],
    };
  }
  log.push(...resolution.log.filter(line => typeof line === "string").slice(0, 12));

  // A knockout ends a duel only when no healthy reserve remains. Keep the
  // fainted member on the bench so its HP and PP remain part of the replay.
  for (const side of DUEL_PLAYER_IDS) {
    const current = sides[side];
    if (current.fighter.hp > 0) {
      continue;
    }
    const replacementIndex = (current.bench ?? []).findIndex(member => member.hp > 0);
    if (replacementIndex >= 0) {
      const bench = (current.bench ?? []).map(cloneFighter);
      const [replacement] = bench.splice(replacementIndex, 1);
      bench.push(cloneFighter(current.fighter));
      sides[side] = { side, fighter: replacement, bench };
      log.push(`${side.toUpperCase()} envoie ${replacement.name}`);
    }
  }

  const record: DuelTurnRecord = {
    turnId: state.turnId,
    order: [...resolution.order],
    commands: { j1: commands.j1, j2: commands.j2 },
    log,
    ...(resolution.actionResults === undefined
      ? {}
      : { actionResults: resolution.actionResults.map(result => ({ ...result })) }),
  };

  const fainted = DUEL_PLAYER_IDS.filter(side => sides[side].fighter.hp <= 0);
  let winner: DuelSide | "draw" | null = null;
  let endedReason: string | null = null;
  if (fainted.length === 2) {
    winner = "draw";
    endedReason = "K.O. des deux camps";
  } else if (fainted.length === 1) {
    winner = DUEL_PLAYER_IDS.find(side => side !== fainted[0]) ?? null;
    endedReason = `K.O. de ${fainted[0].toUpperCase()}`;
  }

  const nextTurn = state.turnId + 1;
  if (winner === null && nextTurn > state.turnLimit) {
    winner = "draw";
    endedReason = "limite de tours";
  }

  const next: DuelState = {
    ...state,
    rng: rng.state(),
    turnId: nextTurn,
    sides,
    pending: { j1: null, j2: null },
    history: [...state.history, record].slice(-DUEL_TURN_LIMIT),
    winner,
    endedReason,
  };
  return { state: { ...next, hash: duelHash(next) }, accepted: true };
}

/**
 * Ends a duel without playing it out — an explicit abandon, or an interruption
 * the shell decides not to resume.
 *
 * @param state - State of the duel
 * @param winner - Who wins, or `"draw"`
 * @param reason - Short reason, shown to both halves
 * @returns The finished state
 */
export function endDuel(state: DuelState, winner: DuelSide | "draw", reason: string): DuelState {
  const next: DuelState = {
    ...state,
    winner,
    endedReason: reason,
    pending: { j1: null, j2: null },
  };
  return { ...next, hash: duelHash(next) };
}

/**
 * Ends the duel because one side gave up: the other one takes it.
 *
 * @param state - State of the duel
 * @param side - Side abandoning
 * @returns The finished state
 */
export function abandonDuel(state: DuelState, side: DuelSide): DuelState {
  const winner = DUEL_PLAYER_IDS.find(candidate => candidate !== side) ?? "draw";
  return endDuel(state, winner, `abandon de ${side.toUpperCase()}`);
}

// ---------------------------------------------------------------------- vues

/**
 * Public state of the duel: what both halves may display.
 *
 * The move lists are not part of it, and a locked command is only visible once
 * the turn is settled: the field is the same in both halves, the choices are not.
 *
 * @param state - State of the duel
 * @returns The mirrored view of the duel
 */
export function duelPublicState(state: DuelState): DuelPublicState {
  const sides = {} as Record<DuelSide, DuelPublicSide>;
  for (const side of DUEL_PLAYER_IDS) {
    const fighter = state.sides[side].fighter;
    sides[side] = {
      side,
      name: fighter.name,
      species: fighter.species,
      level: fighter.level,
      types: [...fighter.types],
      shiny: fighter.shiny,
      variant: fighter.variant,
      hp: fighter.hp,
      maxHp: fighter.maxHp,
      movesLeft: fighter.moves.filter(move => move.pp > 0).length,
      locked: state.pending[side] !== null,
      fainted: fighter.hp <= 0,
      remaining: (fighter.hp > 0 ? 1 : 0) + (state.sides[side].bench ?? []).filter(member => member.hp > 0).length,
      teamSize: 1 + (state.sides[side].bench ?? []).length,
    };
  }
  return {
    version: state.version,
    duelId: state.duelId,
    turnId: state.turnId,
    turnLimit: state.turnLimit,
    sides,
    lastTurn: state.history.at(-1) ?? null,
    winner: state.winner,
    endedReason: state.endedReason,
    hash: state.hash,
    finished: state.winner !== null,
  };
}

/**
 * The moves of one side, with their remaining PP: private to its owner.
 *
 * @param state - State of the duel
 * @param side - Side asking
 * @returns Its moves, usable as buttons
 */
export function duelMovesFor(state: DuelState, side: DuelSide): DuelMoveMaterial[] {
  return state.sides[side].fighter.moves.map(move => ({ ...move }));
}

/** Private reserve menu, with indexes stable for the current turn. */
export function duelBenchFor(state: DuelState, side: DuelSide): DuelBenchItem[] {
  return (state.sides[side].bench ?? []).map((member, benchIndex) => ({
    benchIndex,
    name: member.name,
    hp: member.hp,
    maxHp: member.maxHp,
  }));
}

/**
 * Fingerprint of the durable part of a duel.
 *
 * It covers the turn, the generator, the HP and PP of both sides and the winner:
 * two duels that hash the same will play out the same.
 *
 * @param state - State of the duel
 * @returns Eight hexadecimal digits
 */
export function duelHash(state: DuelState): string {
  return contentChecksum({
    version: state.version,
    duelId: state.duelId,
    duelSeed: state.seed,
    rng: state.rng,
    turnId: state.turnId,
    sides: DUEL_PLAYER_IDS.map(side => ({
      side,
      active: {
        species: state.sides[side].fighter.species,
        hp: state.sides[side].fighter.hp,
        moves: state.sides[side].fighter.moves.map(move => [move.moveId, move.pp]),
      },
      bench: (state.sides[side].bench ?? []).map(member => ({
        species: member.species,
        hp: member.hp,
        moves: member.moves.map(move => [move.moveId, move.pp]),
      })),
    })),
    winner: state.winner,
  });
}

/**
 * Replays a duel from its opening state and the command log it produced.
 *
 * This is the check the plan asks of the first cut — *same result after
 * reproducing the commands and the seed* — and the tool a resumed duel uses: the
 * log lives in the shell's memory, the seed is derived from the journal, so a
 * replayed duel lands on the same hashes.
 *
 * @param state - State at the beginning of the duel
 * @param history - Turns to replay, in order
 * @param resolver - Mechanics of the turn
 * @returns The replayed state, or `null` when a turn could not be resolved
 */
export function replayDuel(
  state: DuelState,
  history: readonly DuelTurnRecord[],
  resolver: DuelResolver,
): DuelState | null {
  let current = state;
  for (const record of history) {
    for (const side of DUEL_PLAYER_IDS) {
      const locked = lockCommand(current, side, record.commands[side]);
      if (!locked.accepted) {
        return null;
      }
      current = locked.state;
    }
    const resolved = resolveTurn(current, resolver);
    if (!resolved.accepted) {
      return null;
    }
    current = resolved.state;
  }
  return current;
}

// ------------------------------------------------------------------- interne

/** Deep copy of a fighter: the engine never shares its objects with a resolver. */
export function cloneFighter(fighter: DuelFighter): DuelFighter {
  return {
    ...fighter,
    ...(fighter.appearance === undefined ? {} : { appearance: cloneFighterAppearance(fighter.appearance) }),
    ...(fighter.heldItems === undefined ? {} : { heldItems: [...fighter.heldItems] }),
    types: [...fighter.types],
    stats: [...fighter.stats],
    moves: fighter.moves.map(m => ({ ...m })),
  };
}

function isDuelFighterAppearance(value: unknown): value is DuelFighterAppearance {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const appearance = value as Partial<DuelFighterAppearance>;
  return (
    isInteger(appearance.formIndex, 0, Number.MAX_SAFE_INTEGER)
    && isInteger(appearance.gender, 0, Number.MAX_SAFE_INTEGER)
    && isRecordOrNull(appearance.custom)
    && (appearance.fusion === null || isDuelFusionAppearance(appearance.fusion))
  );
}

function isDuelFusionAppearance(value: unknown): value is DuelFusionData {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const fusion = value as Partial<DuelFusionData>;
  return (
    isInteger(fusion.species, 1, Number.MAX_SAFE_INTEGER)
    && isInteger(fusion.formIndex, 0, Number.MAX_SAFE_INTEGER)
    && isInteger(fusion.abilityIndex, 0, Number.MAX_SAFE_INTEGER)
    && typeof fusion.shiny === "boolean"
    && isInteger(fusion.variant, 0, Number.MAX_SAFE_INTEGER)
    && isInteger(fusion.gender, 0, Number.MAX_SAFE_INTEGER)
    && isInteger(fusion.teraType, 0, Number.MAX_SAFE_INTEGER)
    && isRecordOrNull(fusion.custom)
  );
}

function isRecordOrNull(value: unknown): value is Record<string, unknown> | null {
  return value === null || (typeof value === "object" && !Array.isArray(value));
}

function cloneFighterAppearance(appearance: DuelFighterAppearance): DuelFighterAppearance {
  const copyCustom = (custom: Record<string, unknown> | null): Record<string, unknown> | null =>
    custom === null ? null : { ...custom, ...(Array.isArray(custom.types) ? { types: [...custom.types] } : {}) };
  return {
    ...appearance,
    custom: copyCustom(appearance.custom),
    fusion: appearance.fusion === null ? null : { ...appearance.fusion, custom: copyCustom(appearance.fusion.custom) },
  };
}

function isResolution(value: unknown): value is DuelResolution {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const resolution = value as Partial<DuelResolution>;
  if (!Array.isArray(resolution.sides) || !Array.isArray(resolution.log) || !Array.isArray(resolution.order)) {
    return false;
  }
  // L'ordre d'action ne peut citer un côté qu'une fois, et seulement un côté.
  const acting = new Set<DuelSide>();
  for (const side of resolution.order) {
    if (!DUEL_PLAYER_IDS.includes(side) || acting.has(side)) {
      return false;
    }
    acting.add(side);
  }
  if (resolution.actionResults !== undefined) {
    if (!Array.isArray(resolution.actionResults) || resolution.actionResults.length > DUEL_PLAYER_IDS.length) {
      return false;
    }
    const resultSides = new Set<DuelSide>();
    for (const result of resolution.actionResults) {
      if (typeof result !== "object" || result === null) {
        return false;
      }
      const action = result as Partial<DuelActionResult>;
      if (
        !DUEL_PLAYER_IDS.includes(action.side as DuelSide)
        || !acting.has(action.side as DuelSide)
        || resultSides.has(action.side as DuelSide)
        || !["hit", "miss", "failed", "no_effect"].includes(action.result as string)
        || typeof action.effectiveness !== "number"
        || !Number.isFinite(action.effectiveness)
        || action.effectiveness < 0
        || typeof action.critical !== "boolean"
        || !isInteger(action.damage, 0, Number.MAX_SAFE_INTEGER)
        || !isInteger(action.recoil, 0, Number.MAX_SAFE_INTEGER)
        || typeof action.targetFainted !== "boolean"
        || typeof action.attackerFainted !== "boolean"
      ) {
        return false;
      }
      resultSides.add(action.side as DuelSide);
    }
  }
  const sides = new Set<DuelSide>();
  for (const outcome of resolution.sides) {
    if (typeof outcome !== "object" || outcome === null) {
      return false;
    }
    const { side, hp, pp } = outcome as Partial<DuelSideOutcome>;
    if (!DUEL_PLAYER_IDS.includes(side as DuelSide) || sides.has(side as DuelSide)) {
      return false;
    }
    if (!isInteger(hp, 0, Number.MAX_SAFE_INTEGER) || !Array.isArray(pp)) {
      return false;
    }
    if (!pp.every(remaining => isInteger(remaining, 0, 999))) {
      return false;
    }
    sides.add(side as DuelSide);
  }
  return sides.size === resolution.sides.length;
}

/** Entier borné, tolérant : sert à valider une résolution venue de l'extérieur. */
function isInteger(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}
