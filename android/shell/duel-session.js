/*
 * SPDX-FileCopyrightText: 2026 Pagefault Games
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Session de duel local (lot D1) : la partie de la coque qui tient un duel en
 * cours, sans DOM et sans Phaser.
 *
 * Le duel se joue **pendant que les deux parties sont arrêtées** : à la
 * frontière du bloc, la coque a fait figer l'équipe de chaque joueur dans un
 * instantané, et c'est elle qui mène ensuite le combat. Chaque cadre ne sert plus
 * que de table de calcul : il matérialise son combattant depuis l'instantané
 * (niveau, types, statistiques et attaques viennent du jeu), résout les tours avec
 * ses propres tables, et renvoie son état public. Ce module est le côté coque de
 * cet échange : il apparie les rapports, refuse tout ce qui n'est pas le duel du
 * bloc en cours, et n'avance un tour que lorsque **les deux moitiés ont résolu
 * le même tour avec la même empreinte**.
 *
 * Trois propriétés expliquent sa forme :
 *
 * 1. **Choix simultanés masqués.** Un choix verrouillé est gardé ici et n'est
 *    transmis à l'autre cadre qu'au moment du dénouement, dans le même message
 *    que celui de l'adversaire : la moitié concernée affiche « choix verrouillé »
 *    sans nommer l'attaque, et les deux attaques ne sont nommées qu'une fois le
 *    tour réglé (`log`).
 * 2. **Aucun point sans accord.** Un tour appliqué vaut accord des deux camps ;
 *    un désaccord est un duel cassé, jamais un duel gagné par celui qui a
 *    répondu en premier.
 * 3. **Rien à écrire.** La graine se dérive de l'identifiant du duel et des
 *    empreintes d'équipe, toutes deux déjà dans le journal : un duel interrompu
 *    se rejoue à l'identique depuis son premier tour, sans rien persister de
 *    plus.
 */

import { PLAYER_IDS, stableChecksum } from "./match-coordinator.js";

/** Révision du format de session, propre à ce module. */
export const DUEL_SESSION_VERSION = 1;

/** Attaques qu'un combattant peut avoir, comme `DUEL_MOVE_MAX` côté cadre. */
export const DUEL_MOVE_MAX = 4;

/** Tours conservés dans l'historique d'une session. */
const DUEL_HISTORY_LIMIT = 200;

/** Niveau le plus haut qu'un combattant puisse porter, comme `MAX_DUEL_LEVEL`. */
const MAX_DUEL_LEVEL = 1000;

/** Résultat d'un événement refusé ou accepté, sur le modèle du coordinateur. */
function outcome(session, accepted, reason) {
  return { session, accepted, reason };
}

/**
 * Ouvre la session du duel d'un bloc.
 *
 * Elle commence au tour 1, sans choix et sans rapport : les deux cadres vont
 * annoncer l'état d'ouverture, et c'est cet état — le seul que les deux camps
 * peuvent lire — qui s'affiche avant que quiconque ait choisi.
 *
 * @param {object} options - Identifiant du duel, graine et combattants
 * @returns {object | null} La session, ou `null` si un camp n'est pas jouable
 */
export function newDuelSession({ duelId, seed, fighters }) {
  if (typeof duelId !== "string" || duelId === "") {
    return null;
  }
  if (!Number.isInteger(seed) || seed < 0) {
    return null;
  }
  const validated = {};
  for (const playerId of PLAYER_IDS) {
    const supplied = fighters?.[playerId];
    const team = Array.isArray(supplied) ? supplied : [supplied];
    // Un combattant déjà K.O. n'a pas de duel à jouer : le duel s'ouvre sur
    // deux équipes en état, comme à la préparation de l'instantané.
    if (
      team.length === 0
      || team.length > 6
      || !team.every(member => isDuelFighter(member, playerId))
      || team[0].hp <= 0
    ) {
      return null;
    }
    validated[playerId] = Array.isArray(supplied) ? team.map(cloneFighter) : cloneFighter(team[0]);
  }
  return {
    version: DUEL_SESSION_VERSION,
    duelId,
    seed,
    fighters: validated,
    /** Tour qui attend les choix. */
    turn: 1,
    /** Tour dont on attend les rapports des cadres ; `null` pendant les choix. */
    awaiting: 0,
    /** Attaque choisie par chaque camp pour `turn`, masquée jusqu'au dénouement. */
    pending: { j1: null, j2: null },
    /** Rapports déjà reçus pour `awaiting`. */
    reports: { j1: null, j2: null },
    /** Dernière vue acceptée par les deux camps, ou `null` avant le premier tour. */
    view: null,
    /** Attaques de chaque camp, telles que son propre cadre les a envoyées. */
    moves: { j1: null, j2: null },
    /** Private reserve of each player, refreshed after every agreed turn. */
    bench: { j1: null, j2: null },
    /** Lignes du dernier tour réglé : les deux joueurs les découvrent ensemble. */
    log: [],
    /** Tours réglés, dans l'ordre. */
    history: [],
    winner: null,
    finished: false,
  };
}

/**
 * Réceptionne le rapport d'un cadre sur le tour en cours.
 *
 * Le rapport est refusé s'il parle d'un autre duel, d'un autre tour, s'il est
 * illisible, ou si ce camp a déjà répondu pour ce tour : un cadre qui rejoue un
 * message ne fait donc jamais avancer un tour deux fois. Le tour n'est appliqué
 * que lorsque **les deux empreintes concordent** ; un désaccord est signalé à
 * l'appelant (`agreed: false`) plutôt que tranché.
 *
 * @param {object} session - Session du duel
 * @param {"j1" | "j2"} playerId - Camp qui répond
 * @param {object} report - `duelId`, `turnId`, `hash`, `view` et `moves` reçus
 * @returns {{ session: object, accepted: boolean, agreed?: boolean, mismatch?: boolean,
 *   finished?: boolean, reason?: string }} `mismatch` signale un désaccord franc :
 *   les deux camps ont répondu, mais pas la même chose
 */
export function acceptDuelReport(session, playerId, report) {
  if (session === null || !PLAYER_IDS.includes(playerId)) {
    return outcome(session, false, "session inconnue");
  }
  if (session.finished) {
    return outcome(session, false, "duel terminé");
  }
  if (session.awaiting === null) {
    return outcome(session, false, "aucun tour en attente de rapport");
  }
  if (typeof report !== "object" || report === null) {
    return outcome(session, false, "rapport illisible");
  }
  if (report.duelId !== session.duelId) {
    return outcome(session, false, "rapport d'un autre duel");
  }
  if (report.turnId !== session.awaiting) {
    return outcome(session, false, "rapport d'un autre tour");
  }
  if (typeof report.hash !== "string" || report.hash === "") {
    return outcome(session, false, "empreinte manquante");
  }
  if (!isDuelView(report.view, session.duelId)) {
    return outcome(session, false, "vue illisible");
  }
  if (!isDuelMoveList(report.moves)) {
    return outcome(session, false, "attaques illisibles");
  }
  if (report.bench !== undefined && !isDuelBenchList(report.bench)) {
    return outcome(session, false, "réserve illisible");
  }
  if (session.reports[playerId] !== null) {
    return outcome(session, false, "rapport déjà reçu pour ce tour");
  }

  const reports = { ...session.reports, [playerId]: report };
  const moves = { ...session.moves, [playerId]: report.moves.map(move => ({ ...move })) };
  const bench = {
    ...session.bench,
    [playerId]: report.bench?.map(member => ({ ...member })) ?? session.bench?.[playerId] ?? null,
  };
  if (!PLAYER_IDS.every(other => reports[other] !== null)) {
    // Un seul camp a répondu : sa vue n'est pas encore la vue commune, mais ses
    // attaques sont les siennes et n'appartiennent qu'à sa moitié.
    return { session: { ...session, reports, moves, bench }, accepted: true, agreed: false };
  }

  const agreed = reports.j1.hash === reports.j2.hash;
  if (!agreed) {
    // Deux résolutions d'un même tour devraient être identiques : un désaccord
    // signale un duel cassé, et la coque le règle sans créditer personne.
    return {
      session: { ...session, reports },
      accepted: true,
      agreed: false,
      mismatch: true,
      reason: "les deux moitiés ne résolvent pas le même duel",
    };
  }

  const view = reports.j1.view;
  const applied = {
    ...session,
    reports: { j1: null, j2: null },
    pending: { j1: null, j2: null },
    moves,
    bench,
    view,
    turn: view.turnId,
    awaiting: null,
    log: Array.isArray(view.lastTurn?.log) ? view.lastTurn.log.slice(0, 12) : [],
    // Le tour 0 est l'état d'ouverture, pas un tour joué : l'historique ne
    // contient que des tours réellement résolus.
    history: report.turnId > 0 ? [...session.history, report.turnId].slice(-DUEL_HISTORY_LIMIT) : session.history,
    winner: view.finished ? view.winner : null,
    finished: view.finished,
  };
  return { session: applied, accepted: true, agreed: true, finished: view.finished };
}

/**
 * Verrouille l'attaque d'un camp pour le tour en cours.
 *
 * Un camp ne verrouille qu'une fois par tour, et seulement une attaque qu'il a
 * réellement sous la main : une attaque inconnue ou à court de PP est refusée
 * ici, et le sera de nouveau par le moteur du cadre, qui reste seul juge.
 *
 * @param {object} session - Session du duel
 * @param {"j1" | "j2"} playerId - Camp qui choisit
 * @param {number} moveIndex - Position de l'attaque dans son menu
 * @returns {{ session: object, accepted: boolean, readyToResolve?: boolean, reason?: string }}
 */
export function lockDuelChoice(session, playerId, selection) {
  if (session === null || !PLAYER_IDS.includes(playerId)) {
    return outcome(session, false, "session inconnue");
  }
  if (session.finished) {
    return outcome(session, false, "duel terminé");
  }
  if (session.awaiting !== null) {
    return outcome(session, false, "le tour est déjà en cours");
  }
  if (session.pending[playerId] !== null) {
    return outcome(session, false, "choix déjà verrouillé");
  }
  const command = Number.isInteger(selection) ? { type: "fight", moveIndex: selection } : selection;
  if (typeof command !== "object" || command === null) {
    return outcome(session, false, "choix illisible");
  }
  if (command.type === "fight") {
    if (!Number.isInteger(command.moveIndex) || command.moveIndex < 0 || command.moveIndex >= DUEL_MOVE_MAX) {
      return outcome(session, false, "attaque inconnue");
    }
    const move = session.moves[playerId]?.[command.moveIndex];
    if (move === undefined || move.pp <= 0) {
      return outcome(session, false, "attaque indisponible");
    }
  } else if (command.type === "switch") {
    const member = session.bench?.[playerId]?.[command.benchIndex];
    if (!Number.isInteger(command.benchIndex) || member?.benchIndex !== command.benchIndex || member.hp <= 0) {
      return outcome(session, false, "remplaçant indisponible");
    }
  } else if (command.type === "struggle") {
    if (!Array.isArray(session.moves[playerId]) || session.moves[playerId].some(move => move.pp > 0)) {
      return outcome(session, false, "des attaques restent disponibles");
    }
  } else {
    return outcome(session, false, "choix inconnu");
  }
  const pending = { ...session.pending, [playerId]: { ...command } };
  return {
    session: { ...session, pending },
    accepted: true,
    readyToResolve: PLAYER_IDS.every(other => pending[other] !== null),
  };
}

/**
 * Ouvre le tour dès que les deux camps ont verrouillé.
 *
 * C'est le seul endroit qui fait passer la session en attente de rapports, et il
 * renvoie le couple d'attaques à envoyer **aux deux cadres** : dans le même
 * message, donc, et pas avant que les deux aient choisi.
 *
 * @param {object} session - Session du duel
 * @returns {{ session: object, accepted: boolean, sender?: object, reason?: string }}
 *   `sender` porte `duelId`, `turnId` et les deux `commands`
 */
export function openDuelTurn(session) {
  if (session === null) {
    return { session, accepted: false, reason: "session inconnue" };
  }
  if (session.finished) {
    return { session, accepted: false, reason: "duel terminé" };
  }
  if (session.awaiting !== null) {
    return { session, accepted: false, reason: "un tour est déjà en cours" };
  }
  const commands = {};
  for (const playerId of PLAYER_IDS) {
    const choice = session.pending[playerId];
    if (choice === null) {
      return { session, accepted: false, reason: "les deux choix ne sont pas verrouillés" };
    }
    commands[playerId] = Number.isInteger(choice) ? { type: "fight", moveIndex: choice } : { ...choice };
  }
  return {
    session: { ...session, awaiting: session.turn, reports: { j1: null, j2: null } },
    accepted: true,
    sender: { duelId: session.duelId, turnId: session.turn, commands },
  };
}

/**
 * Ce qu'une moitié affiche du duel.
 *
 * Le terrain vient de la dernière vue acceptée — la même pour les deux joueurs —
 * et le menu vient des attaques que **son propre** cadre a envoyées : c'est la
 * seule information privée de la session. Un choix verrouillé n'y figure pas :
 * la moitié montre qu'il y a un choix, jamais lequel.
 *
 * @param {object} session - Session du duel
 * @param {"j1" | "j2"} playerId - Moitié concernée
 * @returns {object} Combattants, menu, état du tour et journal
 */
export function duelDisplayFor(session, playerId) {
  const other = playerId === "j1" ? "j2" : "j1";
  return {
    turn: session?.turn ?? 1,
    turnLimit: session?.view?.turnLimit ?? 0,
    /** Un tour est parti : plus personne ne choisit, on attend les deux rapports. */
    waiting: session !== null && session !== undefined && session.awaiting !== null,
    /** Ce camp a verrouillé son attaque : laquelle ne se dit pas encore. */
    locked: session !== null && session !== undefined && session.pending[playerId] !== null,
    self: sideDisplay(session, playerId),
    foe: sideDisplay(session, other),
    moves: (session?.moves?.[playerId] ?? []).map(move => ({
      name: move.name,
      type: move.type,
      pp: move.pp,
      ppMax: move.ppMax,
      usable: move.pp > 0,
      supported: move.power > 0 && move.category !== 2,
    })),
    switches: (session?.bench?.[playerId] ?? []).map(member => ({ ...member, usable: member.hp > 0 })),
    struggle: Array.isArray(session?.moves?.[playerId]) && session.moves[playerId].every(move => move.pp <= 0),
    log: [...(session?.log ?? [])],
    finished: session?.finished === true,
    winner: session?.winner ?? null,
  };
}

/** Un camp tel qu'il s'affiche : la vue acceptée prime sur l'instantané d'ouverture. */
function sideDisplay(session, playerId) {
  const supplied = session?.fighters?.[playerId];
  const fighter = Array.isArray(supplied) ? supplied[0] : supplied;
  const view = session?.view?.sides?.[playerId];
  if (fighter === undefined && view === undefined) {
    return { name: "?", level: 0, types: [], hp: 0, maxHp: 0, fainted: true, shiny: false };
  }
  return {
    name: view?.name ?? fighter?.name ?? "?",
    species: view?.species ?? fighter?.species ?? 0,
    level: view?.level ?? fighter?.level ?? 0,
    types: [...(view?.types ?? fighter?.types ?? [])],
    hp: view?.hp ?? fighter?.hp ?? 0,
    maxHp: view?.maxHp ?? fighter?.maxHp ?? 0,
    fainted: view?.fainted ?? (fighter?.hp ?? 0) <= 0,
    shiny: view?.shiny ?? fighter?.shiny === true,
    remaining: view?.remaining ?? (fighter?.hp > 0 ? 1 : 0),
    teamSize: view?.teamSize ?? (Array.isArray(supplied) ? supplied.length : 1),
  };
}

/**
 * Graine du duel, dérivée de son identifiant et des empreintes des deux équipes.
 *
 * Elle doit être la même des deux côtés de la frontière, donc c'est exactement
 * le calcul de `duelSeedFor` (`src/system/duel-engine.ts`) : identifiant du duel
 * et empreintes des équipes **figées**, dans l'ordre des camps. Un duel repris,
 * dont les équipes sont reconstruites depuis le journal, retombe donc sur la même
 * graine, et rejoue les mêmes tours.
 *
 * @param {string} duelId - Identifiant du duel
 * @param {{ j1: string | null, j2: string | null }} checksums - Empreintes des équipes préparées
 * @returns {number} Graine 32 bits
 */
export function duelSeedOf(duelId, checksums) {
  const fingerprint = stableChecksum({
    duelId,
    teams: PLAYER_IDS.map(playerId => checksums?.[playerId] ?? null),
  });
  return Number.parseInt(fingerprint, 16) >>> 0;
}

/**
 * Contrôle structurel d'une vue de duel reçue d'un cadre.
 *
 * La coque ne recalcule jamais un duel : elle affiche ce que les deux camps ont
 * accepté. Une vue illisible est donc écartée plutôt que rendue à moitié, sans
 * quoi une écriture tronquée peindrait un terrain que personne n'a joué.
 *
 * @param {unknown} value - Valeur reçue
 * @param {string} duelId - Duel auquel la vue doit appartenir
 * @returns {boolean} Si la vue est affichable
 */
export function isDuelView(value, duelId) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (
    value.duelId !== duelId
    || !Number.isInteger(value.turnId)
    || value.turnId < 0
    || typeof value.hash !== "string"
    || typeof value.finished !== "boolean"
    || typeof value.sides !== "object"
    || value.sides === null
  ) {
    return false;
  }
  if (value.winner !== null && value.winner !== "draw" && !PLAYER_IDS.includes(value.winner)) {
    return false;
  }
  return PLAYER_IDS.every(playerId => isPublicSide(value.sides[playerId], playerId));
}

/** Contrôle structurel de la moitié visible d'un camp. */
function isPublicSide(value, playerId) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return (
    value.side === playerId
    && typeof value.name === "string"
    && Number.isInteger(value.hp)
    && value.hp >= 0
    && Number.isInteger(value.maxHp)
    && value.maxHp > 0
    && value.hp <= value.maxHp
    && Array.isArray(value.types)
    && value.types.length > 0
    && value.types.every(type => Number.isInteger(type))
    && typeof value.locked === "boolean"
    && typeof value.fainted === "boolean"
    && (value.remaining === undefined
      || (Number.isInteger(value.remaining) && value.remaining >= 0 && value.remaining <= 6))
    && (value.teamSize === undefined
      || (Number.isInteger(value.teamSize) && value.teamSize >= 1 && value.teamSize <= 6))
  );
}

/**
 * Contrôle structurel d'un menu d'attaques.
 *
 * La coque refuse une liste qu'elle ne peut pas lire entièrement : elle préfère
 * ne rien afficher que proposer une attaque dont elle ne connaît pas les PP.
 *
 * @param {unknown} value - Valeur reçue
 * @returns {boolean} Si la liste est affichable
 */
export function isDuelMoveList(value) {
  return Array.isArray(value) && value.length > 0 && value.length <= DUEL_MOVE_MAX && value.every(isDuelMove);
}

/** Private reserve list sent by the owning frame. */
function isDuelBenchList(value) {
  return (
    Array.isArray(value)
    && value.length <= 5
    && value.every(
      (member, index) =>
        typeof member === "object"
        && member !== null
        && member.benchIndex === index
        && typeof member.name === "string"
        && Number.isInteger(member.hp)
        && member.hp >= 0
        && Number.isInteger(member.maxHp)
        && member.maxHp > 0
        && member.hp <= member.maxHp,
    )
  );
}

/** Une attaque telle que la coque l'affiche : de quoi nommer et compter les PP. */
export function isDuelMove(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return (
    Number.isInteger(value.moveId)
    && value.moveId > 0
    && typeof value.name === "string"
    && value.name !== ""
    && Number.isInteger(value.type)
    && Number.isInteger(value.category)
    && Number.isInteger(value.power)
    && Number.isFinite(value.accuracy)
    && Number.isInteger(value.priority)
    && Number.isInteger(value.pp)
    && value.pp >= 0
    && value.pp <= 999
    && Number.isInteger(value.ppMax)
    && value.ppMax >= 1
    && value.ppMax <= 999
    && Number.isFinite(value.effectiveness)
    && value.effectiveness >= 0
  );
}

/**
 * Contrôle d'un chemin d'atlas de sprite, tel que la coque le reçoit.
 *
 * Le chemin est relatif au dossier `images/` : un seul jeu de caractères, pas
 * de segment parent, et une longueur bornée. La même règle protège le moteur
 * (`duel-engine.ts`) et l'écran de résultat.
 *
 * @param {unknown} value - Chemin reçu
 * @returns {boolean} Si le chemin ne peut sortir du dossier d'images
 */
export function isSafeSpriteAtlasPath(value) {
  return (
    typeof value === "string"
    && value.length <= 200
    && /^[a-z0-9_/-]+$/i.test(value)
    && !value.split("/").includes("..")
  );
}

/**
 * Contrôle structurel d'un combattant, à l'entrée de la session.
 *
 * Mêmes règles que `isDuelFighter` du moteur : un combattant est produit par le
 * jeu à partir d'un instantané, donc il est complet ou il n'est pas. La session
 * refuse le duel entier plutôt que d'en jouer un avec des statistiques devinées.
 *
 * @param {unknown} value - Valeur reçue
 * @param {"j1" | "j2"} playerId - Camp auquel il doit appartenir
 * @returns {boolean} Si le combattant est jouable
 */
export function isDuelFighter(value, playerId) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return (
    PLAYER_IDS.includes(value.side)
    && value.side === playerId
    && Number.isInteger(value.species)
    && value.species > 0
    && Number.isInteger(value.level)
    && value.level >= 1
    && value.level <= MAX_DUEL_LEVEL
    && typeof value.name === "string"
    && (value.resultSpriteAtlasPath === undefined || isSafeSpriteAtlasPath(value.resultSpriteAtlasPath))
    && (value.trainerSkin === undefined || value.trainerSkin === "m" || value.trainerSkin === "f")
    && Array.isArray(value.types)
    && value.types.length > 0
    && value.types.every(type => Number.isInteger(type))
    && Array.isArray(value.stats)
    && value.stats.length >= 6
    && value.stats.every(stat => Number.isFinite(stat))
    && Number.isInteger(value.maxHp)
    && value.maxHp >= 1
    && Number.isInteger(value.hp)
    && value.hp >= 0
    && value.hp <= value.maxHp
    && typeof value.shiny === "boolean"
    && Number.isInteger(value.variant)
    && isDuelMoveList(value.moves)
  );
}

/** Copie profonde d'un combattant : la session ne partage rien avec les cadres. */
export function cloneFighter(fighter) {
  return {
    ...fighter,
    types: [...fighter.types],
    stats: [...fighter.stats],
    moves: fighter.moves.map(move => ({ ...move })),
  };
}
