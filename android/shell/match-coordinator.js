/*
 * SPDX-FileCopyrightText: 2026 Pagefault Games
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Coordinateur local d'un match à deux joueurs (lot C1).
 *
 * Il tient le journal d'un match : où en est chaque joueur dans son bloc, quand
 * le duel doit s'ouvrir, qui a marqué, et si le match est fini. Les règles de
 * jeu sont celles de `docs/android-2p-game-modes.md` : un bloc vaut `blockSize`
 * combats *duel compris*, donc `blockSize - 1` combats contre l'IA puis le duel,
 * et la manche supplémentaire d'une égalité est un bloc d'un seul combat.
 *
 * Deux principes qui expliquent la forme du module :
 *
 * 1. **Tout est fonction pure.** Chaque événement reçoit l'état et rend
 *    `{ state, accepted, reason }`. Rien n'écrit dans `localStorage` en dehors
 *    de `saveJournal`/`loadJournal`, et rien ne lit le DOM : le même code tourne
 *    dans la page coque et dans les tests.
 * 2. **Aucune confiance dans l'appelant.** Un joueur ne peut pas gagner un point
 *    en envoyant un score : le point n'est écrit que par `recordDuelResult`,
 *    après un duel ouvert par le coordinateur, et un identifiant de duel ou de
 *    combat déjà vu est refusé. Un redémarrage ne recompte donc jamais.
 *
 * Les phases suivent le plan : `BLOC` (chacun enchaîne ses combats contre l'IA,
 * à son rythme) → `ATTENTE` (un joueur est à la frontière) → `PREPARE` (les deux
 * y sont, sauvegardes accusées) → `DUEL` → `RESULTAT`/`BLOC` → `FINI`.
 */

/** Révision du format de journal. */
export const JOURNAL_VERSION = 1;

/** Clé du journal courant, écrite à chaque événement accepté. */
export const JOURNAL_KEY = "local2p/v1/shell/match";

/** Clé du dernier journal validé, utilisée si le courant est illisible. */
export const JOURNAL_BACKUP_KEY = "local2p/v1/shell/match.previous";

/** Nombre d'identifiants gardés pour reconnaître un événement déjà traité. */
const SEEN_LIMIT = 64;

/**
 * Révision du format d'instantané d'équipe, identique à `duel-snapshot.ts`.
 * Les deux implémentations doivent rester d'accord sur l'empreinte et sur le
 * plafond : les tests unitaires comparent les deux sur les mêmes entrées.
 */
export const DUEL_SNAPSHOT_VERSION = 1;

/** Taille d'une équipe de duel, comme `DUEL_TEAM_MAX` côté cadre. */
const DUEL_TEAM_MAX = 6;

/** Niveau le plus haut qu'un instantané puisse porter. */
const MAX_DUEL_LEVEL = 1000;

/** Pas du plafond automatique. */
const DUEL_CAP_STEP = 5;

/**
 * @typedef {"j1" | "j2"} PlayerId
 * @typedef {"BLOC" | "ATTENTE" | "PREPARE" | "DUEL" | "RESULTAT" | "FINI"} MatchPhase
 */

/** Joueurs d'un match local, dans l'ordre d'affichage (J1 en bas, J2 en haut). */
export const PLAYER_IDS = /** @type {const} */ (["j1", "j2"]);

/** Résultat d'un événement refusé ou accepté. */
function outcome(state, accepted, reason) {
  return { state, accepted, reason };
}

function otherPlayer(playerId) {
  return playerId === "j1" ? "j2" : "j1";
}

/**
 * Ouvre le journal d'un nouveau match.
 *
 * @param {object} rules - Règles figées du match (voir `match-rules`)
 * @param {string} matchId - Identifiant opaque du match
 * @param {number} now - Horodatage courant
 * @returns {object} Le journal initial
 */
export function newJournal(rules, matchId, now) {
  const players = {};
  for (const playerId of PLAYER_IDS) {
    players[playerId] = newPlayer();
  }
  return {
    version: JOURNAL_VERSION,
    matchId,
    rules,
    /** Numéro du bloc en cours, à partir de 1. */
    block: 1,
    phase: "BLOC",
    /** Manches supplémentaires accordées après une égalité. */
    extraDuels: 0,
    players,
    /**
     * Instantanés d'équipe reçus des cadres pour le duel du bloc, et le plafond
     * commun qui en découle. Un duel ne s'ouvre qu'avec les deux (voir
     * `duelPrepared`) : c'est ce qui permet de le reconstruire à l'identique
     * après un arrêt, sans jamais relire une sauvegarde PvE.
     */
    duelTeams: { j1: null, j2: null },
    duelCap: null,
    /** Identifiant du duel en cours ou du dernier duel réglé. */
    duelId: null,
    /** Identifiant du duel réglé, pour refuser un résultat rejoué. */
    lastSettledDuelId: null,
    /** Résultat final, une fois le match terminé. */
    outcome: null,
    reinforcements: { j1: null, j2: null },
    updatedAt: now,
  };
}

function newPlayer() {
  return {
    /** Combats gagnés contre l'IA dans le bloc en cours. */
    pveInBlock: 0,
    /** Combats gagnés contre l'IA depuis le début du match. */
    pveTotal: 0,
    /** Duels gagnés. */
    duelWins: 0,
    /** Duels perdus. */
    duelLosses: 0,
    /** Le joueur a atteint la frontière du bloc. */
    atBoundary: false,
    /** Numéro de sauvegarde attendu avant d'ouvrir le duel. */
    requiredSaveSeq: 0,
    /** Dernier numéro de sauvegarde accusé. */
    savedSeq: 0,
    /** Derniers identifiants de combat traités. */
    seenBattles: [],
  };
}

// ------------------------------------------------------------ journal et stockage

/** Sérialisation stable : mêmes octets pour le même journal, quel que soit l'ordre. */
function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Empreinte d'une valeur quelconque (FNV-1a 32 bits), pour une sérialisation
 * canonique (clés triées, ordre des tableaux conservé).
 *
 * Elle sert à reconnaître une écriture tronquée ou un instantané modifié, pas à
 * résister à un attaquant. C'est la même fonction que `contentChecksum` de
 * `src/system/duel-snapshot.ts` : l'empreinte d'un instantané est calculée d'un
 * côté et vérifiée de l'autre, donc les deux doivent rendre exactement les mêmes
 * octets pour le même contenu.
 *
 * @param {unknown} value - Valeur à empreindre
 * @returns {string} Empreinte en hexadécimal
 */
export function stableChecksum(value) {
  const text = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Empreinte du journal, sans le champ d'empreinte lui-même.
 *
 * @param {object} state - Journal à empreindre
 * @returns {string} Empreinte en hexadécimal
 */
export function journalChecksum(state) {
  return stableChecksum(withoutChecksum(state));
}

/** Copie du journal sans son empreinte : c'est elle qu'on empreinte. */
function withoutChecksum(state) {
  const payload = {};
  for (const [key, value] of Object.entries(state)) {
    if (key !== "checksum") {
      payload[key] = value;
    }
  }
  return payload;
}

/** Vainqueur d'un score, égalité comprise. */
function winnerOf(j1, j2) {
  if (j1 === j2) {
    return "draw";
  }
  return j1 > j2 ? "j1" : "j2";
}

/**
 * Écrit le journal.
 *
 * `commit: false` marque l'écriture comme provisoire : le journal précédent
 * reste la version de repli. `commit: true` la valide **et** la recopie dans la
 * clé de repli — c'est la séquence prévue au plan (version provisoire, puis
 * marqueur de validation), appelée aux points durables (ouverture d'un duel,
 * résultat réglé, fin de match).
 *
 * @param {Storage} storage - Stockage du match
 * @param {object} state - Journal à écrire
 * @param {{ commit?: boolean }} [options] - `commit` valide l'écriture
 * @returns {object} Le journal écrit, empreinte comprise
 */
export function saveJournal(storage, state, { commit = false } = {}) {
  const stamped = { ...state, checksum: journalChecksum(state) };
  const raw = stableStringify(stamped);
  storage.setItem(JOURNAL_KEY, raw);
  if (commit) {
    storage.setItem(JOURNAL_BACKUP_KEY, raw);
  }
  return stamped;
}

/**
 * Relit le journal après un arrêt ou une reprise.
 *
 * Une écriture tronquée ou modifiée est rejetée (empreinte), au profit du
 * dernier journal validé ; si aucun des deux n'est lisible, il n'y a pas de
 * match à reprendre.
 *
 * @param {Storage} storage - Stockage du match
 * @returns {{ state: object | null, restoredFrom: "current" | "backup" | null }}
 */
export function loadJournal(storage) {
  const candidates = [
    { key: JOURNAL_KEY, from: "current" },
    { key: JOURNAL_BACKUP_KEY, from: "backup" },
  ];
  for (const { key, from } of candidates) {
    const state = readJournal(storage.getItem(key));
    if (state !== null) {
      return { state, restoredFrom: from };
    }
  }
  return { state: null, restoredFrom: null };
}

function readJournal(raw) {
  if (typeof raw !== "string" || raw === "") {
    return null;
  }
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn("Coordinateur 2P : journal illisible", error);
    return null;
  }
  if (
    parsed === null
    || typeof parsed !== "object"
    || parsed.version !== JOURNAL_VERSION
    || typeof parsed.matchId !== "string"
    || typeof parsed.block !== "number"
    || typeof parsed.phase !== "string"
    || typeof parsed.players !== "object"
    || parsed.checksum !== journalChecksum(parsed)
  ) {
    console.warn("Coordinateur 2P : journal incomplet, ignoré");
    return null;
  }
  return parsed;
}

/** Efface le journal et sa copie de repli, par exemple quand le match est quitté. */
export function clearJournal(storage) {
  storage.removeItem(JOURNAL_KEY);
  storage.removeItem(JOURNAL_BACKUP_KEY);
}

// ------------------------------------------------------------------- questions

/** Combats contre l'IA nécessaires pour atteindre la frontière du bloc courant. */
export function battlesNeeded(state) {
  const planned = state.block <= state.rules.blocks;
  // Une manche supplémentaire est un bloc d'un seul combat : le duel, sans PvE.
  return planned ? Math.max(0, state.rules.blockSize - 1) : 0;
}

/**
 * Progression d'un joueur, telle que la barre centrale l'affiche.
 *
 * @param {object} state - Journal du match
 * @param {PlayerId} playerId - Joueur concerné
 * @returns {{ block: number, totalBlocks: number, battles: number, needed: number, atBoundary: boolean, duelWins: number }}
 */
export function playerProgress(state, playerId) {
  const player = state.players[playerId];
  return {
    block: Math.min(state.block, state.rules.blocks),
    totalBlocks: state.rules.blocks,
    battles: player.pveInBlock,
    needed: battlesNeeded(state),
    atBoundary: player.atBoundary,
    duelWins: player.duelWins,
  };
}

/**
 * Score du match, avec son état de fin éventuel.
 *
 * @param {object} state - Journal du match
 * @returns {{ j1: number, j2: number, winner: "j1" | "j2" | "draw" | null, finished: boolean }}
 */
export function matchScore(state) {
  const j1 = state.players.j1.duelWins;
  const j2 = state.players.j2.duelWins;
  const finished = state.phase === "FINI";
  const winner = finished ? (state.outcome ?? winnerOf(j1, j2)) : null;
  return { j1, j2, winner, finished };
}

/** Le duel peut être ouvert : les deux joueurs sont prêts et leurs sauvegardes accusées. */
export function duelReady(state) {
  return PLAYER_IDS.every(playerId => {
    const player = state.players[playerId];
    return player.atBoundary && player.savedSeq >= player.requiredSaveSeq;
  });
}

/** Instantanés d'équipe du bloc, y compris sur un journal écrit avant C2. */
function teamsOf(state) {
  const teams = state.duelTeams ?? {};
  return { j1: teams.j1 ?? null, j2: teams.j2 ?? null };
}

/**
 * Identifiant du duel du bloc en cours.
 *
 * Il est **dérivé** du journal plutôt que tiré au hasard : un match repris après
 * un arrêt doit préparer exactement le même duel, sinon les instantanés déjà
 * figés seraient refusés comme appartenant à un autre duel.
 *
 * @param {object} state - Journal du match
 * @returns {string} Identifiant opaque et stable du duel du bloc
 */
export function duelIdFor(state) {
  return `${state.matchId}:${state.block}:${state.extraDuels}`;
}

/**
 * Plafond commun des deux équipes, ou `null` quand il n'y en a pas.
 *
 * C'est le plus bas des deux meilleurs niveaux, arrondi au multiple de 5
 * inférieur : celui qui a le moins progressé garde une chance. `null` couvre deux
 * cas que l'appelant ne confond pas : la configuration demande les niveaux réels
 * (`levelCap: none`), ou une des deux équipes n'est pas encore arrivée.
 *
 * @param {object} state - Journal du match
 * @returns {number | null} Le plafond à appliquer
 */
export function duelCapOf(state) {
  if (state.rules?.levelCap === "none") {
    return null;
  }
  const teams = teamsOf(state);
  if (teams.j1 === null || teams.j2 === null) {
    return null;
  }
  const lowest = Math.min(bestLevel(teams.j1), bestLevel(teams.j2));
  if (!Number.isFinite(lowest) || lowest <= 0) {
    return null;
  }
  return Math.max(1, Math.floor(lowest / DUEL_CAP_STEP) * DUEL_CAP_STEP);
}

/** Meilleur niveau d'une équipe d'instantané. */
function bestLevel(team) {
  return team.members.reduce((best, member) => Math.max(best, Number.isInteger(member?.level) ? member.level : 0), 0);
}

/**
 * Le duel du bloc peut être ouvert : équipes figées, même duel, joueurs prêts.
 *
 * `recordDuelStarted` reste plus permissif (la manche nulle provisoire n'a pas
 * d'instantanés) : c'est à la coque de n'ouvrir un vrai duel que lorsque cette
 * fonction est vraie.
 *
 * @param {object} state - Journal du match
 * @returns {boolean} Si les deux équipes sont figées pour ce duel
 */
export function duelPrepared(state) {
  const teams = teamsOf(state);
  if (teams.j1 === null || teams.j2 === null || !duelReady(state)) {
    return false;
  }
  return isTeamPayload(teams.j1) && isTeamPayload(teams.j2) && teams.j1.duelId === teams.j2.duelId;
}

/**
 * Valide un instantané d'équipe reçu d'un cadre.
 *
 * Le contrôle est structurel et porte sur ce que la coque lit réellement
 * (version, joueur, duel, taille et forme des membres), plus l'empreinte qui
 * lie le contenu au reste. Le détail fin des membres appartient au cadre, qui
 * ne produit que des instantanés déjà validés par `duel-snapshot.ts`.
 *
 * @param {unknown} value - Objet reçu du cadre
 * @returns {boolean} Si l'instantané est utilisable tel quel
 */
export function isTeamPayload(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (value.version !== DUEL_SNAPSHOT_VERSION || !PLAYER_IDS.includes(value.playerId)) {
    return false;
  }
  if (typeof value.duelId !== "string" || value.duelId === "") {
    return false;
  }
  if (!Array.isArray(value.members) || value.members.length === 0 || value.members.length > DUEL_TEAM_MAX) {
    return false;
  }
  if (!value.members.every(isTeamMember)) {
    return false;
  }
  // Même empreinte que côté cadre, donc même normalisation : on empreint
  // l'instantané privé de son champ d'empreinte.
  return value.checksum === stableChecksum(withoutChecksum(value));
}

/** Contrôle structurel d'un membre : ce que la coque lit, et rien de plus. */
function isTeamMember(member) {
  if (typeof member !== "object" || member === null) {
    return false;
  }
  if (!Number.isInteger(member.species) || member.species <= 0) {
    return false;
  }
  if (!Number.isInteger(member.level) || member.level <= 0 || member.level > MAX_DUEL_LEVEL) {
    return false;
  }
  return Array.isArray(member.moves) && member.moves.length > 0 && member.moves.length <= 4;
}

/**
 * Reprend le journal après un arrêt : remet la phase en accord avec les faits,
 * sans jamais avancer un compteur.
 *
 * @param {object} state - Journal relu du stockage
 * @param {number} now - Horodatage courant
 * @returns {object} Le journal reprenable
 */
export function resumeJournal(state, now) {
  const resumed = { ...state, updatedAt: now };
  if (resumed.phase === "FINI") {
    return resumed;
  }
  // Un duel ouvert est relancé depuis son instantané : le point n'est pas compté
  // tant que le résultat n'est pas réglé.
  if (resumed.phase === "DUEL" || resumed.phase === "PREPARE" || resumed.phase === "RESULTAT") {
    return { ...resumed, phase: duelReady(resumed) ? "PREPARE" : "ATTENTE" };
  }
  if (duelReady(resumed)) {
    return { ...resumed, phase: "PREPARE" };
  }
  const waiting = PLAYER_IDS.some(playerId => resumed.players[playerId].atBoundary);
  return { ...resumed, phase: waiting ? "ATTENTE" : "BLOC" };
}

// ----------------------------------------------------------------- événements

/**
 * Un combat gagné contre l'IA.
 *
 * Refusé si le joueur a déjà atteint la frontière (son avancement s'arrête
 * **entre** deux combats), si le bloc n'attend plus de combat, ou si ce combat a
 * déjà été compté — un redémarrage ou une phase rejouée ne compte pas double.
 *
 * @param {object} state - Journal du match
 * @param {PlayerId} playerId - Joueur vainqueur
 * @param {string} battleId - Identifiant du combat
 * @param {number} now - Horodatage courant
 * @returns {{ state: object, accepted: boolean, reason?: string }}
 */
export function recordBattleWon(state, playerId, battleId, now) {
  if (!PLAYER_IDS.includes(playerId)) {
    return outcome(state, false, "joueur inconnu");
  }
  if (state.phase === "FINI") {
    return outcome(state, false, "match terminé");
  }
  if (typeof battleId !== "string" || battleId === "") {
    return outcome(state, false, "identifiant de combat manquant");
  }
  const player = state.players[playerId];
  if (player.atBoundary) {
    return outcome(state, false, "frontière déjà atteinte");
  }
  if (player.seenBattles.includes(battleId)) {
    return outcome(state, false, "combat déjà compté");
  }
  const needed = battlesNeeded(state);
  if (needed <= 0) {
    return outcome(state, false, "bloc sans combat contre l'IA");
  }

  const battles = player.pveInBlock + 1;
  const atBoundary = battles >= needed;
  const updated = {
    ...player,
    pveInBlock: battles,
    pveTotal: player.pveTotal + 1,
    atBoundary,
    seenBattles: [...player.seenBattles, battleId].slice(-SEEN_LIMIT),
    // La sauvegarde qui suit ce dernier combat doit être accusée : c'est elle
    // qui garantit qu'aucune progression n'est perdue avant le duel.
    requiredSaveSeq: atBoundary ? player.savedSeq + 1 : player.savedSeq,
  };
  return outcome(withPlayer(state, playerId, updated, now), true);
}

/**
 * Accusé de sauvegarde d'un joueur.
 *
 * @param {object} state - Journal du match
 * @param {PlayerId} playerId - Joueur concerné
 * @param {number} saveSeq - Numéro de sauvegarde annoncé par sa session
 * @param {number} now - Horodatage courant
 * @returns {{ state: object, accepted: boolean, reason?: string }}
 */
export function recordSaved(state, playerId, saveSeq, now) {
  if (!PLAYER_IDS.includes(playerId)) {
    return outcome(state, false, "joueur inconnu");
  }
  const player = state.players[playerId];
  if (!Number.isInteger(saveSeq) || saveSeq <= player.savedSeq) {
    return outcome(state, false, "numéro de sauvegarde périmé");
  }
  const updated = { ...player, savedSeq: saveSeq };
  const next = withPlayer(state, playerId, updated, now);
  return outcome(withPhase(next, now), true);
}

/**
 * Instantané d'équipe d'un joueur, pris à la frontière du bloc.
 *
 * Le cadre capture son équipe, la coque la Range dans le journal : le duel se
 * rejouera depuis cette copie, jamais depuis la sauvegarde du run. Refusé si le
 * joueur n'est pas à la frontière (un instantané pris en cours de bloc serait
 * périmé dès le combat suivant) ou si l'instantané appartient à un autre duel que
 * celui déjà en préparation.
 *
 * @param {object} state - Journal du match
 * @param {PlayerId} playerId - Joueur dont l'équipe vient d'arriver
 * @param {object} payload - Instantané reçu du cadre
 * @param {number} now - Horodatage courant
 * @returns {{ state: object, accepted: boolean, reason?: string }}
 */
export function recordDuelTeam(state, playerId, payload, now) {
  if (!PLAYER_IDS.includes(playerId)) {
    return outcome(state, false, "joueur inconnu");
  }
  if (state.phase === "FINI") {
    return outcome(state, false, "match terminé");
  }
  if (!isTeamPayload(payload)) {
    return outcome(state, false, "instantané illisible");
  }
  if (payload.playerId !== playerId) {
    return outcome(state, false, "instantané d'un autre joueur");
  }
  if (!state.players[playerId].atBoundary) {
    return outcome(state, false, "frontière non atteinte");
  }
  // L'identifiant du duel du bloc est connu des deux côtés : un instantané qui
  // en porte un autre vient d'un bloc déjà réglé, ou d'une manche supplémentaire
  // qui n'a pas encore demandé ses équipes.
  if (payload.duelId !== duelIdFor(state)) {
    return outcome(state, false, "instantané d'un autre duel");
  }
  const duelTeams = { ...teamsOf(state), [playerId]: payload };
  const next = { ...state, duelTeams, updatedAt: now };
  return outcome(withPhase({ ...next, duelCap: duelCapOf(next) }, now), true);
}

/**
 * Ouvre le duel : la seule porte vers un point.
 *
 * @param {object} state - Journal du match
 * @param {string} duelId - Identifiant du duel
 * @param {number} now - Horodatage courant
 * @returns {{ state: object, accepted: boolean, reason?: string }}
 */
export function recordDuelStarted(state, duelId, now) {
  if (state.phase === "FINI") {
    return outcome(state, false, "match terminé");
  }
  if (state.phase === "DUEL" && state.duelId !== null) {
    return outcome(state, false, "duel déjà ouvert");
  }
  if (!duelReady(state)) {
    return outcome(state, false, "les deux joueurs ne sont pas prêts");
  }
  if (typeof duelId !== "string" || duelId === "") {
    return outcome(state, false, "identifiant de duel manquant");
  }
  // Un instantané est déjà figé pour un autre duel : démarrer celui-ci jouerait
  // avec les équipes d'un bloc qui n'est plus.
  const teams = teamsOf(state);
  if (teams.j1 !== null && teams.j1.duelId !== duelId) {
    return outcome(state, false, "instantané d'un autre duel");
  }
  if (teams.j2 !== null && teams.j2.duelId !== duelId) {
    return outcome(state, false, "instantané d'un autre duel");
  }
  return outcome({ ...state, phase: "DUEL", duelId, outcome: null, updatedAt: now }, true);
}

/**
 * Résultat d'un duel, crédité une seule fois.
 *
 * Le point va au vainqueur, ou à personne en cas de nul ; le bloc avance, ou le
 * match se termine (égalité comprise : elle propose alors une manche
 * supplémentaire).
 *
 * @param {object} state - Journal du match
 * @param {string} duelId - Identifiant du duel réglé
 * @param {"j1" | "j2" | "draw"} winner - Vainqueur annoncé par le moteur de duel
 * @param {number} now - Horodatage courant
 * @returns {{ state: object, accepted: boolean, reason?: string }}
 */
export function recordDuelResult(state, duelId, winner, now) {
  if (state.phase !== "DUEL") {
    return outcome(state, false, "aucun duel ouvert");
  }
  if (duelId !== state.duelId) {
    return outcome(state, false, "résultat d'un autre duel");
  }
  if (winner !== "draw" && !PLAYER_IDS.includes(winner)) {
    return outcome(state, false, "vainqueur inconnu");
  }

  const players = { ...state.players };
  if (winner !== "draw") {
    const won = players[winner];
    players[winner] = { ...won, duelWins: won.duelWins + 1 };
    const lost = players[otherPlayer(winner)];
    players[otherPlayer(winner)] = { ...lost, duelLosses: lost.duelLosses + 1 };
  }

  const settled = {
    ...state,
    players,
    phase: "RESULTAT",
    lastSettledDuelId: duelId,
    duelId: null,
    updatedAt: now,
  };
  return outcome(advanceBlock(settled, now), true);
}

/**
 * Accorde la manche supplémentaire d'une égalité.
 *
 * @param {object} state - Journal du match terminé sur une égalité
 * @param {number} now - Horodatage courant
 * @returns {{ state: object, accepted: boolean, reason?: string }}
 */
export function recordExtraRound(state, now) {
  if (state.phase !== "FINI") {
    return outcome(state, false, "le match n'est pas terminé");
  }
  if (state.outcome !== "draw") {
    return outcome(state, false, "le match a un vainqueur");
  }
  const extraDuels = state.extraDuels + 1;
  const next = resetPlayersForBlock(
    { ...state, extraDuels, block: state.rules.blocks + extraDuels, outcome: null },
    now,
  );
  // Un bloc supplémentaire ne contient aucun combat contre l'IA : les deux
  // joueurs sont à la frontière dès qu'il commence.
  const ready = readyForEmptyBlock(next, now);
  return outcome({ ...ready, phase: "PREPARE" }, true);
}

// ------------------------------------------------------------------- interne

/** Applique un joueur modifié, sans jamais muter l'état reçu. */
function withPlayer(state, playerId, player, now) {
  const next = { ...state, players: { ...state.players, [playerId]: player }, updatedAt: now };
  return withPhase(next, now);
}

/** Recalcule la phase à partir des faits, sauf pendant et après un duel. */
function withPhase(state, now) {
  if (state.phase === "DUEL" || state.phase === "RESULTAT" || state.phase === "FINI") {
    return state;
  }
  if (duelReady(state)) {
    return { ...state, phase: "PREPARE", updatedAt: now };
  }
  const waiting = PLAYER_IDS.some(playerId => state.players[playerId].atBoundary);
  return { ...state, phase: waiting ? "ATTENTE" : "BLOC", updatedAt: now };
}

/**
 * Termine le bloc qui vient d'être réglé : bloc suivant, match terminé, ou
 * manche supplémentaire proposée.
 */
function advanceBlock(state, now) {
  const lastPlannedBlock = state.block >= state.rules.blocks;
  if (!lastPlannedBlock) {
    const reset = resetPlayersForBlock(state, now);
    return {
      ...state,
      phase: "BLOC",
      block: state.block + 1,
      players: reset.players,
      duelTeams: reset.duelTeams,
      duelCap: reset.duelCap,
      updatedAt: now,
    };
  }
  const j1 = state.players.j1.duelWins;
  const j2 = state.players.j2.duelWins;
  // Le duel est réglé et le journal validé : les instantanés n'ont plus d'usage.
  return {
    ...state,
    phase: "FINI",
    outcome: winnerOf(j1, j2),
    duelTeams: { j1: null, j2: null },
    duelCap: null,
    updatedAt: now,
  };
}

/** Remet les compteurs de bloc à zéro pour les deux joueurs. */
function resetPlayersForBlock(state, now) {
  const players = {};
  for (const playerId of PLAYER_IDS) {
    players[playerId] = {
      ...state.players[playerId],
      pveInBlock: 0,
      atBoundary: false,
      requiredSaveSeq: state.players[playerId].savedSeq,
    };
  }
  // Le bloc suivant aura son propre duel, donc ses propres instantanés : garder
  // ceux du bloc qui vient d'être réglé ferait jouer le duel suivant avec les
  // équipes du précédent.
  return { ...state, players, duelTeams: { j1: null, j2: null }, duelCap: null, updatedAt: now };
}

/** Dans un bloc sans combat, la frontière est atteinte d'emblée. */
function readyForEmptyBlock(state, now) {
  const players = {};
  for (const playerId of PLAYER_IDS) {
    players[playerId] = { ...state.players[playerId], atBoundary: true };
  }
  return { ...state, players, updatedAt: now };
}
