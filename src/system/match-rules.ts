/*
 * SPDX-FileCopyrightText: 2026 Pagefault Games
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Rules of a local two-player match (see `docs/android-2p-game-modes.md`).
 *
 * A match is a series of **blocks**: `N - 1` battles against the AI, then a duel
 * between the two players that closes the block. The duel, not the AI battle,
 * is what scores a point. Three blocks of ten battles therefore mean 27 AI
 * battles and 3 duels — 30 battles in total.
 *
 * The shell stores the rules J1 picked; each game frame receives them and
 * validates them again on arrival. Both sides go through
 * {@linkcode normalizeMatchRules}: a frame never trusts the numbers it is
 * handed, and the shell never writes a value a frame would refuse.
 *
 * No user-facing string lives here — the shell page is French, the game is
 * translated, and this module only owns numbers and their bounds.
 */

/** Revision of the rules format understood by this build. */
export const MATCH_RULES_VERSION = 1;

/**
 * `side-by-side` is two independent runs; `blocks` alternates PvE progress and
 * duels; `quick-random` starts one computer-generated duel immediately.
 */
export type TwoPlayerMode = "side-by-side" | "blocks" | "quick-random";

/** Modes a configuration may select, in display order. */
export const TWO_PLAYER_MODES: readonly TwoPlayerMode[] = ["side-by-side", "blocks", "quick-random"];

/**
 * How the duel levels are levelled out.
 *
 * `auto` lowers every fighter to the lower of the two best levels (rounded down
 * to a multiple of 5), so the player who stayed behind keeps a chance. `none`
 * lets the real levels meet, which is meant for duels on demand.
 */
export type DuelLevelCap = "auto" | "none";

/** Level cap policies a configuration may select. */
export const DUEL_LEVEL_CAPS: readonly DuelLevelCap[] = ["auto", "none"];

/** A complete two-player configuration. */
export interface MatchRulesV1 {
  version: number;
  mode: TwoPlayerMode;
  /**
   * Battles per block, **duel included**: a block of 10 is 9 battles against
   * the AI plus the duel.
   */
  blockSize: number;
  /** Number of blocks, hence of duels, in the match. */
  blocks: number;
  /** Team slots a player may replace with an entry of their bank before a duel. */
  bankRenforts: number;
  levelCap: DuelLevelCap;
  /** Whether a friendly duel may be started in the middle of a block. */
  duelOnDemand: boolean;
}

/** Accepted range of every numeric field. */
export const MATCH_RULES_LIMITS = {
  blockSize: { min: 2, max: 99 },
  blocks: { min: 1, max: 20 },
  bankRenforts: { min: 0, max: 3 },
} as const;

/** Configuration proposed before the first match: the reference example. */
export const DEFAULT_MATCH_RULES: MatchRulesV1 = {
  version: MATCH_RULES_VERSION,
  mode: "side-by-side",
  blockSize: 10,
  blocks: 3,
  bankRenforts: 1,
  levelCap: "auto",
  duelOnDemand: true,
};

/** What a configuration implies, once the example arithmetic is applied. */
export interface MatchSchedule {
  /** Battles against the AI inside a single block. */
  pvePerBlock: number;
  /** Blocks of the match, master of the number of duels. */
  blocks: number;
  /** AI battles over the whole match. */
  pveBattles: number;
  /** Duels of the match, extra rounds included. */
  duels: number;
  /** Everything the two players will play, duels included. */
  totalBattles: number;
}

/**
 * Derives the battle count from a configuration.
 *
 * A match played `side-by-side` schedules no duel at all: the totals are zero
 * rather than misleading.
 *
 * @param rules - The configuration to read, already normalized
 * @param extraDuels - Tie-breaking rounds already granted (one duel each)
 * @returns The number of AI battles, duels and battles in total
 */
export function matchSchedule(rules: MatchRulesV1, extraDuels = 0): MatchSchedule {
  const extra = Number.isInteger(extraDuels) ? Math.max(0, extraDuels) : 0;
  if (rules.mode === "quick-random") {
    return { pvePerBlock: 0, blocks: 1, pveBattles: 0, duels: 1 + extra, totalBattles: 1 + extra };
  }
  if (rules.mode !== "blocks") {
    return { pvePerBlock: 0, blocks: 0, pveBattles: 0, duels: 0, totalBattles: 0 };
  }
  const pvePerBlock = rules.blockSize - 1;
  const pveBattles = pvePerBlock * rules.blocks;
  const duels = rules.blocks + extra;
  return {
    pvePerBlock,
    blocks: rules.blocks,
    pveBattles,
    duels,
    totalBattles: pveBattles + duels,
  };
}

/**
 * Whether `value` is a rules object this build can use as is.
 *
 * Strict on purpose: a value that is merely *usable* is normalized instead, and
 * a value that is silently clamped here would hide a corrupted store.
 *
 * @param value - The parsed value to inspect
 * @returns Whether it is a complete, in-range {@linkcode MatchRulesV1}
 */
export function isMatchRules(value: unknown): value is MatchRulesV1 {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const rules = value as Partial<MatchRulesV1>;
  return (
    rules.version === MATCH_RULES_VERSION
    && TWO_PLAYER_MODES.includes(rules.mode as TwoPlayerMode)
    && isIntegerIn(rules.blockSize, MATCH_RULES_LIMITS.blockSize)
    && isIntegerIn(rules.blocks, MATCH_RULES_LIMITS.blocks)
    && isIntegerIn(rules.bankRenforts, MATCH_RULES_LIMITS.bankRenforts)
    && DUEL_LEVEL_CAPS.includes(rules.levelCap as DuelLevelCap)
    && typeof rules.duelOnDemand === "boolean"
  );
}

/**
 * Turns anything read from the store or received from the shell into a usable
 * configuration: unknown or missing fields fall back to
 * {@linkcode DEFAULT_MATCH_RULES}, numbers outside their range are brought back
 * inside it.
 *
 * A legacy `{ threshold }` value — the pre-blocks rule, "one duel every N PvE
 * wins per player" — is migrated to a block of `threshold + 1` battles, which
 * describes the same match. This is the only place that knows about it.
 *
 * @param value - The parsed value to normalize
 * @param fallback - Configuration to complete from
 * @returns A configuration that satisfies {@linkcode isMatchRules}
 */
export function normalizeMatchRules(value: unknown, fallback: MatchRulesV1 = DEFAULT_MATCH_RULES): MatchRulesV1 {
  const stored = typeof value === "object" && value !== null ? (value as Partial<MatchRulesV1>) : {};
  const legacy = legacyThreshold(value);
  const mode = TWO_PLAYER_MODES.includes(stored.mode as TwoPlayerMode) ? (stored.mode as TwoPlayerMode) : fallback.mode;
  return {
    version: MATCH_RULES_VERSION,
    mode: legacy === undefined ? mode : "blocks",
    blockSize:
      legacy === undefined
        ? clampToRange(stored.blockSize, MATCH_RULES_LIMITS.blockSize, fallback.blockSize)
        : clampToRange(legacy + 1, MATCH_RULES_LIMITS.blockSize, fallback.blockSize),
    blocks: clampToRange(stored.blocks, MATCH_RULES_LIMITS.blocks, fallback.blocks),
    bankRenforts: clampToRange(stored.bankRenforts, MATCH_RULES_LIMITS.bankRenforts, fallback.bankRenforts),
    levelCap: DUEL_LEVEL_CAPS.includes(stored.levelCap as DuelLevelCap)
      ? (stored.levelCap as DuelLevelCap)
      : fallback.levelCap,
    duelOnDemand: typeof stored.duelOnDemand === "boolean" ? stored.duelOnDemand : fallback.duelOnDemand,
  };
}

/** Reads the pre-blocks `threshold` field, if that is what this value holds. */
function legacyThreshold(value: unknown): number | undefined {
  const stored =
    typeof value === "object" && value !== null ? (value as { threshold?: unknown; blockSize?: unknown }) : {};
  if (stored.blockSize !== undefined || typeof stored.threshold !== "number") {
    return undefined;
  }
  return Number.isFinite(stored.threshold) && stored.threshold > 0 ? Math.trunc(stored.threshold) : undefined;
}

function isIntegerIn(value: unknown, range: { min: number; max: number }): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= range.min && value <= range.max;
}

function clampToRange(value: unknown, range: { min: number; max: number }, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(range.max, Math.max(range.min, Math.trunc(value)));
}
