/*
 * SPDX-FileCopyrightText: 2026 Pagefault Games
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Player-scoped access to `localStorage`.
 *
 * Two players sharing a single device also share one origin, and therefore one
 * `localStorage`. Each of them still needs their own saves, settings, tutorials
 * and preferences. `PlayerStorage` is the single explicit door to that storage:
 * every key is read and written under a scope prefix, while the solo game keeps
 * its historical, unprefixed keys untouched.
 *
 * The local two-player shell loads each player's game in a same-origin frame
 * whose URL carries `?player=j1|j2&profile=<id>`; the profile selects a stable
 * scope so its data follows it from J1 to J2. The Android solo launcher can
 * open that same scope with `?profile=<id>`. Old player-only URLs keep their
 * original scope, and solo URLs without a profile keep the historical keys.
 *
 * Scope is decided here and *only* here — no module may reach for `localStorage`
 * directly, so a future format change has exactly one place to migrate.
 */

/** Root of every scoped key. Versioned so a format change can be migrated. */
export const SCOPE_ROOT = "local2p/v1";

/** Query parameter naming the player whose storage this frame should use. */
export const PLAYER_PARAM = "player";
export const PROFILE_PARAM = "profile";

/** Characters allowed in a scope id: it ends up inside a storage key. */
const SCOPE_PATTERN = /^[a-z0-9_-]{1,32}$/i;
const PROFILE_PATTERN = /^[a-z0-9_-]{1,64}$/i;

/**
 * Reads the scope from an URL query string.
 * @param search - The query string to inspect (e.g. `?player=j1`)
 * @returns The scope id, or `undefined` for the unscoped (solo) storage
 */
export function scopeFromQuery(search: string): string | undefined {
  const scope = new URLSearchParams(search).get(PLAYER_PARAM);
  return scope && SCOPE_PATTERN.test(scope) ? scope : undefined;
}

/** A selected 2P profile owns its saves independently of the screen it uses. */
export function storageScopeFromQuery(search: string): string | undefined {
  const player = scopeFromQuery(search);
  const profile = new URLSearchParams(search).get(PROFILE_PARAM);
  if (profile && PROFILE_PATTERN.test(profile)) {
    return `profiles/${profile}`;
  }
  return player;
}

/** Storage of one player, or of the solo game when `scope` is omitted. */
export class PlayerStorage {
  /** `""` for solo, `local2p/v1/<scope>/` otherwise. */
  public readonly prefix: string;

  constructor(scope?: string) {
    this.prefix = scope ? `${SCOPE_ROOT}/${scope}/` : "";
  }

  /**
   * Fully qualified key, as it appears in `localStorage`.
   * Needed by the rare consumers that address the raw store (i18next's
   * language cache), never by regular callers.
   */
  public scopeKey(key: string): string {
    return this.prefix + key;
  }

  public getItem(key: string): string | null {
    return localStorage.getItem(this.scopeKey(key));
  }

  public setItem(key: string, value: string): void {
    localStorage.setItem(this.scopeKey(key), value);
  }

  public removeItem(key: string): void {
    localStorage.removeItem(this.scopeKey(key));
  }

  /**
   * Whether this scope holds `key`.
   * Stored values are always strings (possibly empty), so `null` — and only
   * `null` — means "absent".
   */
  public hasItem(key: string): boolean {
    return this.getItem(key) !== null;
  }

  /**
   * Keys held by this scope, without the prefix, in store order.
   * Other scopes (and the solo keys) are never exposed.
   */
  public keys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const raw = localStorage.key(i);
      if (raw?.startsWith(this.prefix)) {
        keys.push(raw.slice(this.prefix.length));
      }
    }
    return keys;
  }

  /** Removes every key of this scope, leaving the other players untouched. */
  public clear(): void {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const raw = localStorage.key(i);
      if (raw?.startsWith(this.prefix)) {
        localStorage.removeItem(raw);
      }
    }
  }
}

/**
 * Storage of the player this frame belongs to.
 * The solo game gets an empty prefix, so its keys stay exactly where the
 * existing saves put them.
 */
export const playerStorage = new PlayerStorage(
  typeof location === "undefined" ? undefined : storageScopeFromQuery(location.search),
);
