/*
 * SPDX-FileCopyrightText: 2026 Pagefault Games
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Messages exchanged between the local two-player shell and the games it hosts.
 *
 * The shell page (`android/shell/2p.html`) embeds one game per player in a
 * same-origin frame; each frame keeps its own {@linkcode PlayerStorage} scope.
 * The shell talks to a frame with `postMessage`, and this module is the single
 * place where an incoming message is validated — the frame never trusts the
 * payload blindly, even from its own page.
 *
 * Version 2 adds the two directions of the match itself: the shell hands the
 * frame the rules it must play under (`shell/rules`), and the frame reports what
 * happened in its own session (`frame/pve-battle-won`, `frame/pve-saved`). The
 * scene freeze and resume of version 1 are unchanged.
 *
 * The duel of a block travels the same way, in two steps: the shell asks for a
 * frozen team (`shell/duel-invite`), the frame answers with one
 * (`frame/duel-team`), and once both teams are in the shell hands the duel back
 * frozen,
 * cap included (`shell/duel-prepare`). A frame that received its own team builds
 * it again and acknowledges with `frame/duel-ready`, so both sides agree on what
 * will be played before a single turn is simulated.
 *
 * Lot D1 plays it out in the same style: `frame/duel-ready` carries the numbers
 * the game materialized for this fighter, `shell/duel-matchup` gives each side
 * the opponent's types so it can compute its own type matchups with the game's
 * chart, `shell/duel-start` opens the duel, and every turn both frames resolve
 * it independently before `frame/duel-state` comes back — the shell only accepts
 * a turn whose two independent answers agree, so no single half can decide the
 * duel alone.
 *
 * Both sides ship in the same APK, so the version is bumped rather than
 * negotiated: a frame refuses anything that is not exactly its revision.
 */

import type {
  DuelBenchItem,
  DuelCommand,
  DuelFighter,
  DuelMoveMaterial,
  DuelPublicState,
  DuelSide,
} from "#system/duel-engine";
import { DUEL_MOVE_MAX, isDuelFighter } from "#system/duel-engine";
import type { DuelPlayerId, DuelTeamPayloadV1, ReinforcementChoice } from "#system/duel-snapshot";
import { BANK_RENFORTS_MAX, DUEL_PLAYER_IDS, isDuelTeamPayload, MIN_DUEL_LEVEL } from "#system/duel-snapshot";
import type { MatchRulesV1, MatchSchedule } from "#system/match-rules";
import { isMatchRules } from "#system/match-rules";

/** Protocol revision understood by this build. */
export const SHELL_PROTOCOL_VERSION = 2;

/** Everything a frame accepts from the shell. */
export type ShellMessageType =
  | "shell/hello"
  | "shell/pause"
  | "shell/resume"
  | "shell/release-inputs"
  | "shell/rules"
  | "shell/wait-for-duel"
  | "shell/continue"
  | "shell/duel-invite"
  | "shell/quick-generate"
  | "shell/duel-prepare"
  | "shell/duel-reinforce"
  | "shell/duel-matchup"
  | "shell/duel-start"
  | "shell/duel-turn"
  | "shell/duel-abort";

/** Everything a frame sends back to the shell. */
export type FrameMessageType =
  | "frame/ready"
  | "frame/paused"
  | "frame/resumed"
  | "frame/pve-battle-won"
  | "frame/pve-saved"
  | "frame/duel-waiting"
  | "frame/duel-team"
  | "frame/quick-teams"
  | "frame/duel-options"
  | "frame/duel-ready"
  | "frame/duel-fighter"
  | "frame/duel-state"
  | "frame/duel-choice";

/** Both frozen teams of a duel, either of which may still be missing. */
export interface DuelTeamsMessage {
  j1: DuelTeamPayloadV1 | null;
  j2: DuelTeamPayloadV1 | null;
}

/** Settings for a quick random duel, generated once by J1 and shared by both frames. */
export interface QuickBattleConfig {
  teamMode: "random" | "balanced";
  levelMode: "random" | "fixed";
  level: number;
  seed: number;
}

/** Shell → frame. */
export interface ShellMessage {
  protocolVersion: number;
  type: ShellMessageType;
  /** Identifies the run the shell is coordinating; opaque to the frame. */
  matchId?: string;
  /** Frozen match rules, carried by `shell/rules` only. */
  rules?: MatchRulesV1;
  /** What those rules imply in battles, carried alongside them. */
  schedule?: MatchSchedule;
  /** Duel being prepared, carried by the two `shell/duel-*` messages. */
  duelId?: string;
  /** Level both fighters are brought down to; `null` when the rules ask for none. */
  cap?: number | null;
  /** Replaceable team slots, carried by the two `shell/duel-*` messages. */
  bankRenforts?: number;
  /** Frozen teams, carried by `shell/duel-prepare` only. */
  teams?: DuelTeamsMessage;
  /** Quick duel settings, carried by `shell/quick-generate` only. */
  quickBattle?: QuickBattleConfig;
  choices?: ReinforcementChoice[];
  /** Types of the opponent, carried by `shell/duel-matchup`. */
  opponentTypes?: number[];
  /**
   * One fighter, carried by `shell/duel-matchup`: the frame completes the copy it
   * is handed rather than the one it kept, so a resumed duel can be finalized
   * without the frame having materialized anything yet.
   */
  fighter?: DuelFighter;
  /** Seed of the duel, carried by `shell/duel-start`. */
  seed?: number;
  /** Both fighters, carried by `shell/duel-start`. */
  fighters?: Partial<Record<DuelSide, DuelFighter | DuelFighter[]>>;
  /** Turn being played and both choices, carried by `shell/duel-turn`. */
  turnId?: number;
  commands?: Partial<Record<DuelSide, DuelCommand>>;
}

/** Frame → shell. */
export interface FrameMessage {
  protocolVersion: number;
  type: FrameMessageType;
  /** Server-less scope of the sending frame, e.g. `local2p/v1/j1/`. */
  scope: string;
  matchId?: string;
  /** Stable identifier of the won battle, carried by `frame/pve-battle-won`. */
  battleId?: string;
  /** PvE wave for the player's lifetime best, carried with a won battle. */
  wave?: number;
  /** Session save counter, strictly increasing, carried by `frame/pve-saved`. */
  saveSeq?: number;
  /** Duel a report belongs to, carried by the duel reports. */
  duelId?: string;
  /**
   * Turn a report answers, carried by `frame/duel-state`: `0` for the opening
   * state, otherwise the turn both frames were just asked to resolve.
   */
  turnId?: number;
  /** Frozen team, carried by `frame/duel-team` only. */
  duelTeam?: DuelTeamPayloadV1;
  /** Both computer-generated teams, returned by J1 for a quick duel. */
  quickTeams?: DuelTeamsMessage;
  options?: {
    duelId: string;
    max: number;
    team: { slot: number; speciesId: number; level: number }[];
    bank: { entryId: string; speciesId: number; level: number }[];
  };
  /**
   * Fingerprint of the team this frame will actually play — capped and
   * reinforced — carried by `frame/duel-ready`. The shell compares it with what
   * it handed out: two frames that disagree on the duel are caught here, before
   * the first turn.
   */
  checksum?: string;
  /**
   * Numbers the game materialized for this fighter, carried by
   * `frame/duel-ready` (without its type matchups) and by `frame/duel-fighter`
   * (with them).
   */
  fighter?: DuelFighter;
  /** Complete prepared team, active member first. */
  fighters?: DuelFighter[];
  /** Fingerprint of the duel state after a turn, carried by `frame/duel-state`. */
  hash?: string;
  /** Public state of the duel, carried by `frame/duel-state`. */
  view?: DuelPublicState;
  /**
   * Moves of the sending side, carried by `frame/duel-state`.
   *
   * They are private to their owner: the shell displays them in that player's
   * half and nowhere else, which is what keeps both choices hidden until the
   * turn is settled. They never travel to a frame — a frame reads its own state.
   */
  moves?: DuelMoveMaterial[];
  /** Private reserve menu for the sending side. */
  bench?: DuelBenchItem[];
  /** Command picked through the in-game Phaser battle menu. */
  command?: DuelCommand;
}

const SHELL_MESSAGE_TYPES: readonly string[] = [
  "shell/hello",
  "shell/pause",
  "shell/resume",
  "shell/release-inputs",
  "shell/rules",
  "shell/wait-for-duel",
  "shell/continue",
  "shell/duel-invite",
  "shell/quick-generate",
  "shell/duel-prepare",
  "shell/duel-reinforce",
  "shell/duel-matchup",
  "shell/duel-start",
  "shell/duel-turn",
  "shell/duel-abort",
];

/**
 * Validates an incoming `message` payload.
 *
 * A `shell/rules` message is accepted only if it carries rules this build can
 * play under: an unreadable configuration is dropped rather than half-applied,
 * and the frame simply keeps reporting its battles, which the coordinator
 * bounds on its side anyway. The duel messages fail closed the same way — a duel
 * prepared with teams of another duel, an unreadable level cap, a missing team,
 * a fighter that is not playable or a turn without both choices is refused as a
 * whole rather than played half-configured.
 *
 * @param data - The `MessageEvent.data` received by a frame
 * @returns Whether it is a shell message this build understands
 */
export function isShellMessage(data: unknown): data is ShellMessage {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const message = data as Partial<ShellMessage>;
  if (message.protocolVersion !== SHELL_PROTOCOL_VERSION || !SHELL_MESSAGE_TYPES.includes(message.type ?? "")) {
    return false;
  }
  switch (message.type) {
    case "shell/rules":
      return isMatchRules(message.rules);
    case "shell/duel-invite":
      return isDuelId(message.duelId) && isBankRenforts(message.bankRenforts);
    case "shell/quick-generate":
      return isDuelId(message.duelId) && isQuickBattleConfig(message.quickBattle);
    case "shell/duel-prepare":
      return (
        isDuelId(message.duelId)
        && isBankRenforts(message.bankRenforts)
        && isDuelCap(message.cap)
        && isDuelTeams(message.teams, message.duelId)
      );
    case "shell/duel-reinforce":
      return (
        isDuelId(message.duelId)
        && Array.isArray(message.choices)
        && message.choices.length <= BANK_RENFORTS_MAX
        && message.choices.every(
          choice =>
            typeof choice === "object"
            && choice !== null
            && Number.isInteger(choice.slot)
            && choice.slot >= 0
            && choice.slot < 6
            && typeof choice.entryId === "string"
            && choice.entryId !== "",
        )
      );
    case "shell/duel-matchup":
      return (
        isDuelId(message.duelId)
        && isTypeList(message.opponentTypes)
        && isDuelFighter(message.fighter, message.fighter?.side)
      );
    case "shell/duel-start":
      return isDuelId(message.duelId) && isSeed(message.seed) && isFighterPair(message.fighters);
    case "shell/duel-turn":
      return (
        isDuelId(message.duelId)
        && typeof message.turnId === "number"
        && Number.isInteger(message.turnId)
        && message.turnId >= 1
        && isCommandPair(message.commands)
      );
    case "shell/duel-abort":
      return isDuelId(message.duelId);
    default:
      return true;
  }
}

/** Quick battle options must be complete and bounded before a frame generates a team. */
function isQuickBattleConfig(value: unknown): value is QuickBattleConfig {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const config = value as Partial<QuickBattleConfig>;
  return (
    (config.teamMode === "random" || config.teamMode === "balanced")
    && (config.levelMode === "random" || config.levelMode === "fixed")
    && typeof config.level === "number"
    && Number.isInteger(config.level)
    && config.level >= 1
    && config.level <= 100
    && isSeed(config.seed)
  );
}

/** A list of Pokémon types, one to four entries: what a matchup needs. */
function isTypeList(value: unknown): value is number[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 4 && value.every(type => Number.isInteger(type));
}

function isSeed(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** Both fighters must be playable, each on its own side: a duel is not "almost" openable. */
function isFighterPair(value: unknown): value is Record<DuelSide, DuelFighter | DuelFighter[]> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const fighters = value as Partial<Record<DuelSide, DuelFighter | DuelFighter[]>>;
  return DUEL_PLAYER_IDS.every(side => {
    const supplied = fighters[side];
    const team = Array.isArray(supplied) ? supplied : [supplied];
    return team.length > 0 && team.length <= 6 && team.every(member => isDuelFighter(member, side));
  });
}

/** Both sides must have chosen a move, and only a move they could choose. */
function isCommandPair(value: unknown): value is Record<DuelSide, DuelCommand> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const commands = value as Partial<Record<DuelSide, DuelCommand>>;
  return DUEL_PLAYER_IDS.every(side => {
    const command = commands[side];
    if (typeof command !== "object" || command === null) {
      return false;
    }
    if (command.type === "fight") {
      return Number.isInteger(command.moveIndex) && command.moveIndex >= 0 && command.moveIndex < DUEL_MOVE_MAX;
    }
    if (command.type === "switch") {
      return Number.isInteger(command.benchIndex) && command.benchIndex >= 0 && command.benchIndex < 6;
    }
    return command.type === "struggle";
  });
}

/** A duel id is an opaque string; an empty one names nothing. */
function isDuelId(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

function isBankRenforts(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= BANK_RENFORTS_MAX;
}

/** The cap is either a real level or explicitly absent. */
function isDuelCap(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isInteger(value) && value >= MIN_DUEL_LEVEL);
}

/**
 * Both teams must be frozen for *this* duel, each on its own side.
 *
 * A team prepared for another duel is not "almost right": it is the teams of a
 * block that is over, and playing it would show two players a duel neither of
 * them prepared.
 */
function isDuelTeams(value: unknown, duelId: string): value is DuelTeamsMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const teams = value as Partial<DuelTeamsMessage>;
  if (teams.j1 === null && teams.j2 === null) {
    return false;
  }
  for (const playerId of ["j1", "j2"] as const) {
    const team = teams[playerId];
    if (team === null || team === undefined) {
      continue;
    }
    if (!isDuelTeamPayload(team) || team.duelId !== duelId || team.playerId !== (playerId as DuelPlayerId)) {
      return false;
    }
  }
  return true;
}

/**
 * Builds a message destined for the shell.
 *
 * @param type - What the frame is reporting
 * @param scope - Storage scope of the frame, as given by `PlayerStorage.prefix`
 * @param matchId - Optional run identifier echoed from the shell
 * @returns The message to `postMessage` to the parent window
 */
export function frameMessage(type: FrameMessageType, scope: string, matchId?: string): FrameMessage {
  const message: FrameMessage = { protocolVersion: SHELL_PROTOCOL_VERSION, type, scope };
  if (matchId !== undefined) {
    message.matchId = matchId;
  }
  return message;
}

/**
 * Builds the report of a battle won against the AI.
 *
 * @param battleId - Identifier stable for the life of that battle
 * @param scope - Storage scope of the frame
 * @param matchId - Optional run identifier echoed from the shell
 * @returns The message to `postMessage` to the parent window
 */
export function battleWonMessage(battleId: string, scope: string, matchId?: string, wave?: number): FrameMessage {
  const message: FrameMessage = { ...frameMessage("frame/pve-battle-won", scope, matchId), battleId };
  if (wave !== undefined) {
    message.wave = wave;
  }
  return message;
}

/**
 * Builds the acknowledgement of a session save.
 *
 * @param saveSeq - Counter of saves performed by this frame in this profile
 * @param scope - Storage scope of the frame
 * @param matchId - Optional run identifier echoed from the shell
 * @returns The message to `postMessage` to the parent window
 */
export function savedMessage(saveSeq: number, scope: string, matchId?: string): FrameMessage {
  return { ...frameMessage("frame/pve-saved", scope, matchId), saveSeq };
}

/**
 * Builds the report of the frozen team of this frame.
 *
 * The frame never says *which* player it is: the payload carries the side its
 * own storage scope belongs to, and the shell checks that against the source of
 * the message, which is the only identity that counts.
 *
 * @param team - Frozen team of this frame
 * @param scope - Storage scope of the frame
 * @param matchId - Optional run identifier echoed from the shell
 * @returns The message to `postMessage` to the parent window
 */
export function duelTeamMessage(team: DuelTeamPayloadV1, scope: string, matchId?: string): FrameMessage {
  return { ...frameMessage("frame/duel-team", scope, matchId), duelTeam: team };
}

/**
 * Builds the acknowledgement that this frame rebuilt its side of the duel.
 *
 * @param checksum - Fingerprint of the team this frame will play
 * @param scope - Storage scope of the frame
 * @param matchId - Optional run identifier echoed from the shell
 * @returns The message to `postMessage` to the parent window
 */
export function duelReadyMessage(
  checksum: string,
  scope: string,
  matchId?: string,
  fighter?: DuelFighter,
  fighters?: DuelFighter[],
): FrameMessage {
  const message: FrameMessage = { ...frameMessage("frame/duel-ready", scope, matchId), checksum };
  if (fighter !== undefined) {
    message.fighter = fighter;
  }
  if (fighters !== undefined) {
    message.fighters = fighters;
  }
  return message;
}

/**
 * Builds the report of this frame's fighter, numbers included.
 *
 * @param fighter - What the game materialized for this side
 * @param scope - Storage scope of the frame
 * @param matchId - Optional run identifier echoed from the shell
 * @returns The message to `postMessage` to the parent window
 */
export function duelFighterMessage(fighter: DuelFighter, scope: string, matchId?: string): FrameMessage {
  return { ...frameMessage("frame/duel-fighter", scope, matchId), fighter };
}

/**
 * Builds the report of a duel as one side sees it.
 *
 * Both frames answer the same turn independently: the shell compares the two
 * fingerprints, and only a turn both agree on is applied. The report also
 * carries the sender's own moves, for its own half to display; the public state
 * stays what both players may see.
 *
 * @param report - Turn answered, fingerprint, public state and own moves
 * @param scope - Storage scope of the frame
 * @param matchId - Optional run identifier echoed from the shell
 * @returns The message to `postMessage` to the parent window
 */
export function duelStateMessage(
  report: {
    duelId: string;
    turnId: number;
    hash: string;
    view: DuelPublicState;
    moves?: DuelMoveMaterial[];
    bench?: DuelBenchItem[];
  },
  scope: string,
  matchId?: string,
): FrameMessage {
  const message: FrameMessage = {
    ...frameMessage("frame/duel-state", scope, matchId),
    duelId: report.duelId,
    turnId: report.turnId,
    hash: report.hash,
    view: report.view,
  };
  if (Array.isArray(report.moves)) {
    message.moves = report.moves;
  }
  if (Array.isArray(report.bench)) {
    message.bench = report.bench;
  }
  return message;
}

/**
 * Builds the acknowledgement of a game stopped at the block boundary.
 *
 * The shell knows it asked the frame to wait; this says the game actually
 * stopped, reward taken and save written, which is what lets both halves show
 * the same state.
 *
 * @param scope - Storage scope of the frame
 * @param matchId - Optional run identifier echoed from the shell
 * @returns The message to `postMessage` to the parent window
 */
export function duelWaitingMessage(scope: string, matchId?: string): FrameMessage {
  return frameMessage("frame/duel-waiting", scope, matchId);
}
