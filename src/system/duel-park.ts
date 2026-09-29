/*
 * SPDX-FileCopyrightText: 2026 Pagefault Games
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Waiting state of a player who reached the block boundary (`docs/android-2p-game-modes.md`).
 *
 * A player who has played the `blockSize - 1` battles of their block must not
 * start another one: the run stops **between two battles**, once the reward is
 * taken and the save is written, and waits for the duel. The shell announces
 * that boundary (`shell/wait-for-duel`) and later releases the player
 * (`shell/continue`) once the duel is settled.
 *
 * The two events are not simultaneous: the announcement arrives while a battle
 * is still ending, and the stop can only happen at the next safe point. This
 * class holds that gap — arm, then stop once, then hand the continuation back —
 * without knowing anything about the game, the DOM or the shell, so the
 * choreography can be tested on its own.
 */
export class DuelPark {
  /** The shell announced a boundary; the game has not stopped yet. */
  private armed = false;

  /** The game is stopped between two battles. */
  private stopped = false;

  /** What to run when the player is released. */
  private continuation: (() => void) | null = null;

  /** Whether a boundary was announced and not yet consumed. */
  public get isArmed(): boolean {
    return this.armed;
  }

  /** Whether the game is actually stopped, waiting for its release. */
  public get isWaiting(): boolean {
    return this.stopped;
  }

  /**
   * Records that the shell announced a boundary for this player.
   *
   * Idempotent: several announcements (a resumed match announces it again)
   * describe the same wait.
   */
  public arm(): void {
    this.armed = true;
  }

  /**
   * Point where the game may stop, between two battles.
   *
   * @param resume - What to run if the player is released; only called later,
   *   and only if this call actually stops the game
   * @returns `true` when the caller must not continue: the game is stopped and
   *   `resume` is kept for the release
   */
  public hold(resume: () => void): boolean {
    if (!this.armed) {
      return false;
    }
    if (!this.stopped) {
      this.stopped = true;
      this.continuation = resume;
    }
    // A second hold while stopped keeps the first continuation: the older one is
    // the one that leads back to the battle the player was waiting for.
    return true;
  }

  /**
   * Releases the player, if it was waiting.
   *
   * @returns The continuation to run, or `null` when there was nothing to
   *   release (an ordinary resume, or a release arriving after a restart)
   */
  public release(): (() => void) | null {
    const continuation = this.stopped ? this.continuation : null;
    this.armed = false;
    this.stopped = false;
    this.continuation = null;
    return continuation;
  }

  /** Abandons the wait: whatever was announced no longer applies. */
  public abandon(): void {
    this.armed = false;
    this.stopped = false;
    this.continuation = null;
  }
}
