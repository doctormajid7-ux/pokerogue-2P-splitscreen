/*
 * SPDX-FileCopyrightText: 2026 Pagefault Games
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Duel team snapshots of a local two-player match (lot C2, see
 * `docs/android-2p-game-modes.md`).
 *
 * At the block boundary each player's run is frozen into a **snapshot**: a copy
 * of the team, never a reference to the run. The block then closes on a duel
 * played from those copies, so a destroyed or interrupted duel can never change
 * a saved run — the saves are not even read back.
 *
 * A snapshot carries **build inputs only** — species, form, level, ability,
 * nature, IVs, moves — and never battle state:
 *
 * - no HP, no status, no stat stages: a duel always starts from a healthy team,
 *   which is what "team healed for the duel" means in the rules;
 * - PP is reset on capture, for the same reason: a duel must not be decided by
 *   the punches the run already threw;
 * - stats are *not* stored, so the level cap really applies: the game rebuilds
 *   them from the level, the IVs and the nature through its own level-change
 *   path (`{@linkcode toBuildArguments}` gives it the inputs).
 *
 * Everything here is pure, JSON-safe and free of game imports, so the same
 * functions serve the frame that captures a team, the tests that check it and
 * the duel engine of lot D. The shell never sees a Phaser object: only this
 * format crosses `postMessage`.
 */

import type { MatchRulesV1 } from "#system/match-rules";

/** Revision of the snapshot format understood by this build. */
export const DUEL_SNAPSHOT_VERSION = 1;

/** Team size of a duel: the same ceiling as a party. */
export const DUEL_TEAM_MAX = 6;

/** Steps the automatic level cap is rounded down to. */
export const DUEL_CAP_STEP = 5;

/** Lowest level the cap may produce; a level 0 Pokémon is not playable. */
export const MIN_DUEL_LEVEL = 1;

/** Highest level a snapshot may carry; beyond it the payload is corrupt. */
export const MAX_DUEL_LEVEL = 1000;

/** Highest number of replaceable slots a configuration may ask for. */
export const BANK_RENFORTS_MAX = 3;

/** Sides of a local match, in display order (J1 below, J2 above). */
export type DuelPlayerId = "j1" | "j2";

/** Both sides, so a caller never hard-codes the pair. */
export const DUEL_PLAYER_IDS: readonly DuelPlayerId[] = ["j1", "j2"];

/** One move, in the shape `PokemonMove.loadMove` reads back. */
export interface DuelMoveData {
  moveId: number;
  ppUsed: number;
  ppUp: number;
  maxPpOverride?: number | undefined;
}

/**
 * A `PokemonData` read through the fields a snapshot keeps.
 *
 * The real `PokemonData` satisfies this interface structurally, so `captureMember`
 * is called with one directly and the compiler refuses a field that drifts
 * apart.
 */
export interface DuelMemberSource {
  species: number;
  level: number;
  formIndex: number;
  abilityIndex: number;
  passive: boolean;
  shiny: boolean;
  variant: number;
  gender: number;
  nature: number;
  ivs: readonly number[];
  moveset: readonly DuelMoveData[];
  nickname?: string;
  /** Localized held-item labels kept for match result summaries. */
  heldItems?: readonly string[];
  teraType?: number;
  usedTMs?: readonly number[];
  customPokemonData?: unknown;
  metWave?: number;
  fusionSpecies?: number;
  fusionFormIndex?: number;
  fusionAbilityIndex?: number;
  fusionShiny?: boolean;
  fusionVariant?: number;
  fusionGender?: number;
  fusionTeraType?: number;
  fusionCustomPokemonData?: unknown;
}

/** The fused half of a member, when the run spliced two Pokémon together. */
export interface DuelFusionData {
  species: number;
  formIndex: number;
  abilityIndex: number;
  shiny: boolean;
  variant: number;
  gender: number;
  teraType: number;
  custom: Record<string, unknown> | null;
}

/** A frozen duel team member: build inputs, and nothing that a duel could change. */
export interface DuelMemberData {
  species: number;
  level: number;
  formIndex: number;
  abilityIndex: number;
  passive: boolean;
  shiny: boolean;
  variant: number;
  gender: number;
  nature: number;
  ivs: number[];
  moves: DuelMoveData[];
  nickname: string;
  /** Display-only inventory carried into the duel; effects are not simulated yet. */
  heldItems?: string[];
  teraType: number;
  usedTMs: number[];
  custom: Record<string, unknown> | null;
  metWave: number;
  fusion: DuelFusionData | null;
}

/**
 * One team, as it crosses the shell boundary.
 *
 * The identifier of the duel is part of what is hashed: a snapshot taken for
 * one duel cannot be replayed into another, and a payload cannot be re-labelled
 * for the other player.
 */
export interface DuelTeamPayloadV1 {
  version: number;
  playerId: DuelPlayerId;
  duelId: string;
  /** Fingerprint of every other field, checked by the receiver. */
  checksum: string;
  members: DuelMemberData[];
}

/** An entry of the player's bank, usable as a duel reinforcement. */
export interface BankEntryV1 {
  entryId: string;
  /** Index fields: what a profile screen sorts and shows without unpacking the copy. */
  speciesId: number;
  formIndex: number;
  variant: number;
  level: number;
  caughtAt: number;
  matchId: string;
  runId: string;
  wave: number;
  /** The playable copy; the bank is never consumed by a replacement. */
  member: DuelMemberData;
}

/** Which member of the team a bank entry replaces. */
export interface ReinforcementChoice {
  slot: number;
  entryId: string;
}

/**
 * Outcome of a reinforcement request.
 *
 * A refusal leaves the team exactly as it was: the duel then starts without
 * reinforcement rather than with half a request applied.
 */
export interface ReinforcementOutcome {
  team: DuelMemberData[];
  accepted: boolean;
  reason?: string;
}

/** The values the game needs to rebuild one member, level cap included. */
export interface DuelMemberBuild {
  species: number;
  level: number;
  abilityIndex: number;
  formIndex: number;
  gender: number;
  shiny: boolean;
  variant: number;
  ivs: number[];
  nature: number;
  moves: DuelMoveData[];
  nickname: string;
  passive: boolean;
  teraType: number;
  usedTMs: number[];
  custom: Record<string, unknown> | null;
  metWave: number;
  fusion: DuelFusionData | null;
}

// ------------------------------------------------------------------ capture

/**
 * Copies one Pokémon of a run into a snapshot member.
 *
 * The copy is *healed*: PP is reset, and no combat state is carried at all. A
 * source missing a species, a level or any move is refused — a member without a
 * move cannot play a duel, and refusing is better than freezing a team the duel
 * engine would have to repair.
 *
 * @param source - A Pokémon, usually `new PokemonData(playerPokemon)`
 * @returns The frozen member, or `null` when the source is unusable
 */
export function captureMember(source: DuelMemberSource): DuelMemberData | null {
  if (typeof source !== "object" || source === null) {
    return null;
  }
  const moves = captureMoves(source.moveset);
  if (
    !isInteger(source.species, 1, Number.MAX_SAFE_INTEGER)
    || !isInteger(source.level, 1, MAX_DUEL_LEVEL)
    || moves === null
  ) {
    return null;
  }
  const member: DuelMemberData = {
    species: Math.trunc(source.species),
    level: Math.trunc(source.level),
    formIndex: nonNegativeInteger(source.formIndex),
    abilityIndex: nonNegativeInteger(source.abilityIndex),
    passive: source.passive === true,
    shiny: source.shiny === true,
    variant: nonNegativeInteger(source.variant),
    gender: nonNegativeInteger(source.gender),
    nature: nonNegativeInteger(source.nature),
    ivs: captureIvs(source.ivs),
    moves,
    nickname: typeof source.nickname === "string" ? source.nickname : "",
    heldItems: captureStringList(source.heldItems),
    teraType: nonNegativeInteger(source.teraType),
    usedTMs: captureIdList(source.usedTMs),
    custom: captureRecord(source.customPokemonData),
    metWave: Number.isFinite(source.metWave) ? Math.trunc(source.metWave as number) : 0,
    fusion: captureFusion(source),
  };
  return isDuelMember(member) ? member : null;
}

/**
 * Copies a whole team, refusing the team as soon as one member is unusable.
 *
 * @param sources - The party to freeze, in slot order
 * @returns The frozen team, or `null` when a member or the size is unusable
 */
export function captureTeam(sources: readonly DuelMemberSource[]): DuelMemberData[] | null {
  if (!Array.isArray(sources) || sources.length === 0 || sources.length > DUEL_TEAM_MAX) {
    return null;
  }
  const team: DuelMemberData[] = [];
  for (const source of sources) {
    const member = captureMember(source);
    if (member === null) {
      return null;
    }
    team.push(member);
  }
  return team;
}

/** Deep copy of a member, so a stored snapshot is never a live reference. */
export function copyMember(member: DuelMemberData): DuelMemberData {
  return {
    ...member,
    ivs: [...member.ivs],
    moves: member.moves.map(move => ({ ...move })),
    ...(Array.isArray(member.heldItems) ? { heldItems: [...member.heldItems] } : {}),
    usedTMs: [...member.usedTMs],
    custom: member.custom === null ? null : { ...member.custom },
    fusion:
      member.fusion === null
        ? null
        : { ...member.fusion, custom: member.fusion.custom === null ? null : { ...member.fusion.custom } },
  };
}

/** Deep copy of a team: the snapshots of the journal are never shared. */
export function copyTeam(team: readonly DuelMemberData[]): DuelMemberData[] {
  return team.map(copyMember);
}

// --------------------------------------------------------------- validation

/**
 * Whether `value` is a member this build can rebuild.
 *
 * Strict on purpose: the payload crosses a page boundary, so anything merely
 * *readable* has to be normalized by {@linkcode captureMember} instead of being
 * trusted here.
 *
 * @param value - The parsed value to inspect
 * @returns Whether it is a complete {@linkcode DuelMemberData}
 */
export function isDuelMember(value: unknown): value is DuelMemberData {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const member = value as Partial<DuelMemberData>;
  return (
    isInteger(member.species, 1, Number.MAX_SAFE_INTEGER)
    && isInteger(member.level, 1, MAX_DUEL_LEVEL)
    && isInteger(member.formIndex, 0, Number.MAX_SAFE_INTEGER)
    && isInteger(member.abilityIndex, 0, Number.MAX_SAFE_INTEGER)
    && typeof member.passive === "boolean"
    && typeof member.shiny === "boolean"
    && isInteger(member.variant, 0, Number.MAX_SAFE_INTEGER)
    && isInteger(member.gender, 0, Number.MAX_SAFE_INTEGER)
    && isInteger(member.nature, 0, Number.MAX_SAFE_INTEGER)
    && isStatArray(member.ivs)
    && isMoveList(member.moves)
    && typeof member.nickname === "string"
    && (member.heldItems === undefined || isStringList(member.heldItems))
    && isInteger(member.teraType, 0, Number.MAX_SAFE_INTEGER)
    && isIdList(member.usedTMs)
    && isRecordOrNull(member.custom)
    && isInteger(member.metWave, -1, Number.MAX_SAFE_INTEGER)
    && isFusionOrNull(member.fusion)
  );
}

/**
 * Whether `value` is a team payload whose checksum matches its content.
 *
 * @param value - The parsed value to inspect
 * @returns Whether it is a complete, intact {@linkcode DuelTeamPayloadV1}
 */
export function isDuelTeamPayload(value: unknown): value is DuelTeamPayloadV1 {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const payload = value as Partial<DuelTeamPayloadV1>;
  if (
    payload.version !== DUEL_SNAPSHOT_VERSION
    || !DUEL_PLAYER_IDS.includes(payload.playerId as DuelPlayerId)
    || typeof payload.duelId !== "string"
    || payload.duelId === ""
    || !Array.isArray(payload.members)
    || payload.members.length === 0
    || payload.members.length > DUEL_TEAM_MAX
    || !payload.members.every(isDuelMember)
  ) {
    return false;
  }
  return payload.checksum === contentChecksum(withoutChecksum(payload));
}

/**
 * Whether `value` is a bank entry whose member is playable.
 *
 * @param value - The parsed value to inspect
 * @returns Whether it is a complete {@linkcode BankEntryV1}
 */
export function isBankEntry(value: unknown): value is BankEntryV1 {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const entry = value as Partial<BankEntryV1>;
  return (
    typeof entry.entryId === "string"
    && entry.entryId !== ""
    && isInteger(entry.speciesId, 1, Number.MAX_SAFE_INTEGER)
    && isInteger(entry.formIndex, 0, Number.MAX_SAFE_INTEGER)
    && isInteger(entry.variant, 0, Number.MAX_SAFE_INTEGER)
    && isInteger(entry.level, 1, MAX_DUEL_LEVEL)
    && isInteger(entry.caughtAt, 0, Number.MAX_SAFE_INTEGER)
    && typeof entry.matchId === "string"
    && typeof entry.runId === "string"
    && isInteger(entry.wave, 0, Number.MAX_SAFE_INTEGER)
    && isDuelMember(entry.member)
  );
}

// --------------------------------------------------------------- fingerprint

/**
 * Fingerprint of any JSON-safe value, over a sorted key order.
 *
 * FNV-1a 32 bits: it recognises a truncated or edited payload, which is all a
 * local match needs. The shell recomputes it with the very same rules
 * (`stableChecksum` in `android/shell/match-coordinator.js`), so both sides
 * agree on what "the same team" means — the tests of the coordinator compare
 * the two implementations on the same object.
 *
 * @param value - The value to fingerprint
 * @returns Eight hexadecimal digits
 */
export function contentChecksum(value: unknown): string {
  const text = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Serializes a value with sorted keys, so the same content always gives the
 * same bytes. Arrays keep their order: a team order and a move order are part
 * of what is fingerprinted.
 *
 * @param value - The value to serialize
 * @returns The canonical text
 */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const keys = [...Object.keys(value as Record<string, unknown>)].sort();
    return `{${keys
      .map(key => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Builds the payload of one team, checksum included.
 *
 * @param playerId - Side this team belongs to
 * @param duelId - Duel the team is frozen for
 * @param members - The frozen members, in slot order
 * @returns The payload to send, or `null` when it could not be built
 */
export function makeTeamPayload(
  playerId: DuelPlayerId,
  duelId: string,
  members: readonly DuelMemberData[],
): DuelTeamPayloadV1 | null {
  if (!DUEL_PLAYER_IDS.includes(playerId) || typeof duelId !== "string" || duelId === "") {
    return null;
  }
  if (!Array.isArray(members) || members.length === 0 || members.length > DUEL_TEAM_MAX) {
    return null;
  }
  const copied = copyTeam(members);
  const payload: DuelTeamPayloadV1 = {
    version: DUEL_SNAPSHOT_VERSION,
    playerId,
    duelId,
    checksum: "",
    members: copied,
  };
  payload.checksum = contentChecksum(withoutChecksum(payload));
  return isDuelTeamPayload(payload) ? payload : null;
}

/** The payload without its checksum: what is fingerprinted. */
function withoutChecksum(payload: Partial<DuelTeamPayloadV1>): Record<string, unknown> {
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key !== "checksum") {
      copy[key] = value;
    }
  }
  return copy;
}

// ------------------------------------------------------------- level capping

/** Highest level of a team, `0` when it holds none. */
export function teamBestLevel(team: readonly DuelMemberData[]): number {
  let best = 0;
  for (const member of team) {
    if (Number.isFinite(member.level)) {
      best = Math.max(best, member.level);
    }
  }
  return best;
}

/**
 * Automatic duel cap: the lower of the given best levels, rounded down to a
 * multiple of {@linkcode DUEL_CAP_STEP}.
 *
 * The player who stayed behind keeps a chance, and the gap earned by playing
 * more of the block stays an advantage without being decisive. Never returns
 * less than {@linkcode MIN_DUEL_LEVEL}.
 *
 * @param bestLevels - Best level of every team taking part
 * @returns The level every fighter is brought down to
 */
export function duelLevelCap(bestLevels: readonly number[]): number {
  const usable = bestLevels.filter(level => Number.isFinite(level) && level > 0);
  if (usable.length === 0) {
    return MIN_DUEL_LEVEL;
  }
  const lowest = Math.min(...usable);
  return Math.max(MIN_DUEL_LEVEL, Math.floor(lowest / DUEL_CAP_STEP) * DUEL_CAP_STEP);
}

/**
 * The cap a configuration asks for, or `null` when it asks for none.
 *
 * `none` is meant for duels on demand: two players measuring their real
 * progress. A ranked block always uses `auto`.
 *
 * @param rules - Frozen rules of the match
 * @param bestLevels - Best level of every team taking part
 * @returns The cap to apply, or `null`
 */
export function capForRules(rules: Pick<MatchRulesV1, "levelCap">, bestLevels: readonly number[]): number | null {
  return rules.levelCap === "none" ? null : duelLevelCap(bestLevels);
}

/**
 * Brings a team down to the cap, without touching anything else.
 *
 * Levels are clamped, never scaled: moves, IVs, nature, abilities and
 * evolutions are kept, and the game recalculates the stats from the new level.
 *
 * @param team - The frozen team
 * @param cap - Level to bring down to, or `null` to keep the real levels
 * @returns A new team, the input untouched
 */
export function applyLevelCap(team: readonly DuelMemberData[], cap: number | null): DuelMemberData[] {
  if (cap === null || !Number.isFinite(cap)) {
    return copyTeam(team);
  }
  const ceiling = Math.max(MIN_DUEL_LEVEL, Math.trunc(cap));
  return copyTeam(team).map(member => ({ ...member, level: Math.min(member.level, ceiling) }));
}

// ------------------------------------------------------------------- renforts

/**
 * Replaces team slots with bank entries.
 *
 * A replacement is a **copy**: the entry stays in the bank and losing the duel
 * takes nothing away. The request is all-or-nothing — more replacements than the
 * rules allow, an unknown entry, a slot outside the team or the same entry used
 * twice all refuse the whole request, so a duel never starts on a half-applied
 * team.
 *
 * @param team - The frozen team, already capped
 * @param bank - The player's bank
 * @param choices - Slot/entry pairs the player picked
 * @param max - Replaceable slots allowed by the match rules
 * @returns The team to play, and whether the request was applied
 */
export function applyReinforcements(
  team: readonly DuelMemberData[],
  bank: readonly BankEntryV1[],
  choices: readonly ReinforcementChoice[],
  max: number,
): ReinforcementOutcome {
  const copied = copyTeam(team);
  const allowed = Number.isFinite(max) ? Math.min(BANK_RENFORTS_MAX, Math.max(0, Math.trunc(max))) : 0;
  const requested = Array.isArray(choices) ? choices : [];
  if (requested.length === 0) {
    return { team: copied, accepted: true };
  }
  if (allowed === 0) {
    return { team: copied, accepted: false, reason: "renforts désactivés par la configuration" };
  }
  if (requested.length > allowed) {
    return { team: copied, accepted: false, reason: "plus de renforts que la configuration n'en autorise" };
  }

  const entries = new Map(bank.filter(isBankEntry).map(entry => [entry.entryId, entry]));
  const replaced = new Set<number>();
  const used = new Set<string>();
  for (const choice of requested) {
    if (
      typeof choice !== "object"
      || choice === null
      || !Number.isInteger(choice.slot)
      || choice.slot < 0
      || choice.slot >= copied.length
    ) {
      return { team: copied, accepted: false, reason: "emplacement de renfort invalide" };
    }
    const entry = entries.get(choice.entryId);
    if (entry === undefined) {
      return { team: copied, accepted: false, reason: "entrée de banque inconnue" };
    }
    if (replaced.has(choice.slot)) {
      return { team: copied, accepted: false, reason: "emplacement remplacé deux fois" };
    }
    if (used.has(choice.entryId)) {
      return { team: copied, accepted: false, reason: "même entrée utilisée deux fois" };
    }
    replaced.add(choice.slot);
    used.add(choice.entryId);
    copied[choice.slot] = copyMember(entry.member);
  }
  return { team: copied, accepted: true };
}

// ---------------------------------------------------------------------- build

/**
 * The arguments the game needs to rebuild one member.
 *
 * The duel engine of lot D creates the Pokémon **without** a save data source:
 * the constructor then derives the stats from the level, the IVs and the nature,
 * which is what makes a capped level actually change the numbers. Healing is
 * implicit — a freshly built Pokémon is at full HP, with full PP from
 * {@linkcode DuelMemberData.moves} and no status.
 *
 * @param member - A frozen member
 * @returns A deep copy of everything the rebuild reads
 */
export function toBuildArguments(member: DuelMemberData): DuelMemberBuild {
  return {
    species: member.species,
    level: member.level,
    abilityIndex: member.abilityIndex,
    formIndex: member.formIndex,
    gender: member.gender,
    shiny: member.shiny,
    variant: member.variant,
    ivs: [...member.ivs],
    nature: member.nature,
    moves: member.moves.map(move => ({ ...move })),
    nickname: member.nickname,
    passive: member.passive,
    teraType: member.teraType,
    usedTMs: [...member.usedTMs],
    custom: member.custom === null ? null : { ...member.custom },
    metWave: member.metWave,
    fusion: member.fusion === null ? null : { ...member.fusion },
  };
}

// -------------------------------------------------------------------- interne

/** Copies a moveset, resetting PP: the duel starts from a healthy team. */
function captureMoves(moveset: readonly DuelMoveData[] | undefined): DuelMoveData[] | null {
  if (!Array.isArray(moveset) || moveset.length === 0 || moveset.length > 4) {
    return null;
  }
  const moves: DuelMoveData[] = [];
  for (const move of moveset) {
    if (typeof move !== "object" || move === null || !isInteger(move.moveId, 1, Number.MAX_SAFE_INTEGER)) {
      return null;
    }
    const captured: DuelMoveData = {
      moveId: Math.trunc(move.moveId),
      ppUsed: 0,
      ppUp: nonNegativeInteger(move.ppUp),
    };
    if (Number.isFinite(move.maxPpOverride)) {
      captured.maxPpOverride = Math.trunc(move.maxPpOverride as number);
    }
    moves.push(captured);
  }
  return moves;
}

function captureIvs(ivs: readonly number[] | undefined): number[] {
  const captured: number[] = [];
  for (let index = 0; index < 6; index++) {
    const value = Array.isArray(ivs) ? ivs[index] : undefined;
    captured.push(Number.isFinite(value) ? Math.max(0, Math.min(31, Math.trunc(value as number))) : 0);
  }
  return captured;
}

function captureIdList(values: readonly number[] | undefined): number[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .filter(value => Number.isFinite(value) && value > 0)
    .map(value => Math.trunc(value))
    .slice(0, 64);
}

function captureRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  // Round trip through JSON: only plain data may cross the shell boundary.
  return JSON.parse(JSON.stringify(value as Record<string, unknown>)) as Record<string, unknown>;
}

function captureFusion(source: DuelMemberSource): DuelFusionData | null {
  if (!isInteger(source.fusionSpecies, 1, Number.MAX_SAFE_INTEGER)) {
    return null;
  }
  return {
    species: Math.trunc(source.fusionSpecies as number),
    formIndex: nonNegativeInteger(source.fusionFormIndex),
    abilityIndex: nonNegativeInteger(source.fusionAbilityIndex),
    shiny: source.fusionShiny === true,
    variant: nonNegativeInteger(source.fusionVariant),
    gender: nonNegativeInteger(source.fusionGender),
    teraType: nonNegativeInteger(source.fusionTeraType),
    custom: captureRecord(source.fusionCustomPokemonData),
  };
}

function isMoveList(value: unknown): value is DuelMoveData[] {
  return (
    Array.isArray(value)
    && value.length > 0
    && value.length <= 4
    && value.every(
      move =>
        typeof move === "object"
        && move !== null
        && isInteger((move as DuelMoveData).moveId, 1, Number.MAX_SAFE_INTEGER)
        && isInteger((move as DuelMoveData).ppUsed, 0, 999)
        && isInteger((move as DuelMoveData).ppUp, 0, 99),
    )
  );
}

function isStatArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === 6 && value.every(stat => isInteger(stat, 0, 31));
}

function isIdList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(id => isInteger(id, 1, Number.MAX_SAFE_INTEGER));
}

function captureStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map(entry => entry.slice(0, 80))
        .slice(0, 20)
    : [];
}

function isStringList(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.length <= 20 && value.every(entry => typeof entry === "string" && entry.length <= 80)
  );
}

function isRecordOrNull(value: unknown): value is Record<string, unknown> | null {
  return value === null || (typeof value === "object" && !Array.isArray(value));
}

function isFusionOrNull(value: unknown): value is DuelFusionData | null {
  if (value === null) {
    return true;
  }
  if (typeof value !== "object" || value === undefined) {
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

function isInteger(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}
