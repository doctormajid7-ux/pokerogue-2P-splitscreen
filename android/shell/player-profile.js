/*
 * SPDX-FileCopyrightText: 2026 Pagefault Games
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** Profile data and saves use the same scope in the shell and the game frame. */
const ROOT = "local2p/v1";
const REGISTRY_KEY = `${ROOT}/shell/profiles/v1`;
const profilePrefix = id => `${ROOT}/profiles/${id}/`;
const newId = () => `p-${crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
const validId = id => typeof id === "string" && /^[a-z0-9_-]{1,64}$/i.test(id);
const AVATARS = ["🎮", "⭐", "🔥", "🌿", "💧", "⚡"];
const COLORS = ["#9c8cff", "#ff8787", "#68c9ff", "#78df9a", "#ffd36e"];

function defaultProfile(playerId, displayName = playerId.toUpperCase()) {
  return {
    version: 1,
    profileId: newId(),
    displayName,
    avatar: "🎮",
    color: COLORS[0],
    createdAt: Date.now(),
    stats: {
      matchesPlayed: 0,
      matchesWon: 0,
      duelsWon: 0,
      duelsLost: 0,
      duelsDrawn: 0,
      pveBattlesWon: 0,
      bestRunWave: 0,
    },
    dex: {},
    bank: [],
    seenBattles: [],
    seenDuels: [],
    seenMatches: [],
  };
}

/** Copies pre-profile J1/J2 data once; old keys remain as a recovery copy. */
function migrateSlot(storage, playerId, forbiddenId = null) {
  const oldPrefix = `${ROOT}/${playerId}/`;
  let legacy = null;
  try {
    legacy = JSON.parse(storage.getItem(`${oldPrefix}profile/v1`));
  } catch (_error) {
    /* old profile is optional */
  }
  const profile = legacy?.version === 1 && typeof legacy.profileId === "string" ? legacy : defaultProfile(playerId);
  const id = validId(profile.profileId) && profile.profileId !== forbiddenId ? profile.profileId : newId();
  profile.profileId = id;
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith(oldPrefix)) {
      storage.setItem(profilePrefix(id) + key.slice(oldPrefix.length), storage.getItem(key));
    }
  }
  storage.setItem(`${profilePrefix(id)}profile/v1`, JSON.stringify(profile));
  return id;
}

export function profileRegistry(storage) {
  const storedRegistry = readProfileRegistry(storage);
  if (storedRegistry) {
    return storedRegistry;
  }
  const j1 = migrateSlot(storage, "j1");
  const j2 = migrateSlot(storage, "j2", j1);
  const registry = { version: 1, ids: [j1, j2], selected: { j1, j2 } };
  storage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  return registry;
}

function readProfileRegistry(storage) {
  try {
    const registry = JSON.parse(storage.getItem(REGISTRY_KEY));
    if (
      registry?.version === 1
      && Array.isArray(registry.ids)
      && registry.ids.every(validId)
      && validId(registry.selected?.j1)
      && validId(registry.selected?.j2)
      && registry.selected.j1 !== registry.selected.j2
      && registry.ids.includes(registry.selected.j1)
      && registry.ids.includes(registry.selected.j2)
    ) {
      return registry;
    }
  } catch (_error) {
    /* absent or corrupt registry */
  }
  return null;
}

export function activeProfileId(storage, playerId) {
  return profileRegistry(storage).selected[playerId];
}

const keyFor = (storage, playerId) => `${profilePrefix(activeProfileId(storage, playerId))}profile/v1`;

export function readProfile(storage, playerId) {
  let stored = null;
  try {
    stored = JSON.parse(storage.getItem(keyFor(storage, playerId)));
  } catch (_error) {
    // A malformed profile does not prevent a match from opening.
  }
  const valid = stored?.version === 1 && typeof stored.profileId === "string";
  if (valid) {
    return stored;
  }
  const created = defaultProfile(playerId);
  storage.setItem(keyFor(storage, playerId), JSON.stringify(created));
  return created;
}

export function listProfiles(storage) {
  return listProfileSummaries(storage, profileRegistry(storage).ids);
}

/** Lists saved profiles without creating empty J1/J2 profiles for solo-only users. */
export function listExistingProfiles(storage) {
  const registry = readProfileRegistry(storage);
  if (registry) {
    return listProfileSummaries(storage, registry.ids);
  }

  const profiles = [];
  const prefix = `${ROOT}/profiles/`;
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix) || !key.endsWith("/profile/v1")) {
      continue;
    }
    const id = key.slice(prefix.length, -"/profile/v1".length);
    if (!validId(id)) {
      continue;
    }
    let profile;
    try {
      profile = JSON.parse(storage.getItem(key));
    } catch (_error) {
      /* ignore invalid profile */
    }
    if (profile?.version === 1 && profile.profileId === id) {
      profiles.push({
        id,
        displayName: String(profile.displayName ?? "Profil").slice(0, 16),
        avatar: AVATARS.includes(profile.avatar) ? profile.avatar : "🎮",
      });
    }
  }
  if (profiles.length > 0) {
    return profiles;
  }

  // Migrate old J1/J2 data only if it exists; keep those saves available in solo.
  if (storage.getItem(`${ROOT}/j1/profile/v1`) !== null || storage.getItem(`${ROOT}/j2/profile/v1`) !== null) {
    return listProfiles(storage);
  }
  return [];
}

function listProfileSummaries(storage, ids) {
  return ids.map(id => {
    let profile;
    try {
      profile = JSON.parse(storage.getItem(`${profilePrefix(id)}profile/v1`));
    } catch (_error) {
      /* fallback below */
    }
    return {
      id,
      displayName: String(profile?.displayName ?? "Profil").slice(0, 16),
      avatar: AVATARS.includes(profile?.avatar) ? profile.avatar : "🎮",
    };
  });
}

export function createProfile(storage, playerId, name) {
  const displayName = String(name).trim().slice(0, 16);
  if (!displayName || !["j1", "j2"].includes(playerId)) {
    return null;
  }
  const registry = profileRegistry(storage);
  const id = newId();
  const profile = defaultProfile(playerId, displayName);
  profile.profileId = id;
  storage.setItem(`${profilePrefix(id)}profile/v1`, JSON.stringify(profile));
  registry.ids.push(id);
  registry.selected[playerId] = id;
  storage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  return id;
}

export function selectProfile(storage, playerId, id) {
  const registry = profileRegistry(storage);
  const other = playerId === "j1" ? "j2" : "j1";
  if (!["j1", "j2"].includes(playerId) || !registry.ids.includes(id) || registry.selected[other] === id) {
    return false;
  }
  registry.selected[playerId] = id;
  storage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  return true;
}

/** Deletes one saved profile and assigns a fresh profile if its owner used it. */
export function deleteProfile(storage, playerId, id) {
  if (!validId(id) || !["j1", "j2"].includes(playerId)) {
    return false;
  }

  const registry = profileRegistry(storage);
  const otherPlayer = playerId === "j1" ? "j2" : "j1";
  if (!registry.ids.includes(id) || registry.selected[otherPlayer] === id || registry.ids.length <= 1) {
    return false;
  }

  const keysToDelete = [];
  const prefix = profilePrefix(id);
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) {
      keysToDelete.push(key);
    }
  }

  const remainingIds = registry.ids.filter(profileId => profileId !== id);
  let replacementId = null;
  let createdReplacementId = null;
  if (registry.selected[playerId] === id) {
    replacementId = remainingIds.find(profileId => profileId !== registry.selected[otherPlayer]) ?? null;
    if (replacementId === null) {
      const replacement = defaultProfile(playerId);
      replacementId = replacement.profileId;
      createdReplacementId = replacementId;
      try {
        storage.setItem(`${profilePrefix(replacementId)}profile/v1`, JSON.stringify(replacement));
      } catch (_error) {
        return false;
      }
      remainingIds.push(replacementId);
    }
  }

  const nextRegistry = {
    ...registry,
    ids: remainingIds,
    selected: replacementId === null ? registry.selected : { ...registry.selected, [playerId]: replacementId },
  };
  try {
    storage.setItem(REGISTRY_KEY, JSON.stringify(nextRegistry));
  } catch (_error) {
    if (createdReplacementId !== null) {
      storage.removeItem(`${profilePrefix(createdReplacementId)}profile/v1`);
    }
    return false;
  }

  for (const key of keysToDelete) {
    storage.removeItem(key);
  }
  return true;
}

export function updateProfile(storage, playerId, change) {
  if (playerId !== "j1" && playerId !== "j2") {
    return null;
  }
  const profile = readProfile(storage, playerId);
  const updated = change(profile);
  if (updated === null) {
    return profile;
  }
  storage.setItem(keyFor(storage, playerId), JSON.stringify(updated));
  return updated;
}

export function recordProfileBattle(storage, playerId, battleId, wave = 0) {
  return updateProfile(storage, playerId, profile => {
    if (profile.seenBattles?.includes(battleId)) {
      return null;
    }
    return {
      ...profile,
      stats: {
        ...profile.stats,
        pveBattlesWon: (profile.stats?.pveBattlesWon ?? 0) + 1,
        bestRunWave: Math.max(profile.stats?.bestRunWave ?? 0, Number.isInteger(wave) ? wave : 0),
      },
      seenBattles: [...(profile.seenBattles ?? []), battleId].slice(-2048),
    };
  });
}

export function recordProfileDuel(storage, playerId, duelId, winner) {
  return updateProfile(storage, playerId, profile => {
    if (profile.seenDuels?.includes(duelId)) {
      return null;
    }
    const key = winner === "draw" ? "duelsDrawn" : winner === playerId ? "duelsWon" : "duelsLost";
    return {
      ...profile,
      stats: { ...profile.stats, [key]: (profile.stats?.[key] ?? 0) + 1 },
      seenDuels: [...(profile.seenDuels ?? []), duelId].slice(-2048),
    };
  });
}

export function recordProfileMatch(storage, playerId, matchId, winner) {
  return updateProfile(storage, playerId, profile => {
    if (profile.seenMatches?.includes(matchId)) {
      return null;
    }
    return {
      ...profile,
      stats: {
        ...profile.stats,
        matchesPlayed: (profile.stats?.matchesPlayed ?? 0) + 1,
        matchesWon: (profile.stats?.matchesWon ?? 0) + (winner === playerId ? 1 : 0),
      },
      seenMatches: [...(profile.seenMatches ?? []), matchId].slice(-256),
    };
  });
}

export function renameProfile(storage, playerId, name) {
  const displayName = String(name).trim().slice(0, 16);
  if (displayName === "") {
    return null;
  }
  return updateProfile(storage, playerId, profile => ({ ...profile, displayName }));
}

export function customizeProfile(storage, playerId, name, avatar, color) {
  const displayName = String(name).trim().slice(0, 16);
  if (!displayName) {
    return null;
  }
  return updateProfile(storage, playerId, profile => ({
    ...profile,
    displayName,
    avatar: AVATARS.includes(avatar) ? avatar : "🎮",
    color: COLORS.includes(color) ? color : COLORS[0],
  }));
}
