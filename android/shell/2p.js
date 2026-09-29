/*
 * SPDX-FileCopyrightText: 2026 Pagefault Games
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createTwoPlayerI18n } from "./2p-i18n.js";
/**
 * Coque 2P locale : accueil, configuration du match, lancement des deux parties
 * isolées, progression des blocs, pause commune et reprise.
 *
 * Chaque moitié héberge une partie complète dans son propre cadre de même
 * origine (`../index.html?player=j1|j2`). C'est la frontière du cadre qui route
 * les contacts : un doigt qui appuie dans la moitié J2 est livré au document J2,
 * et y reste jusqu'au relâchement même s'il traverse la ligne de partage. Aucun
 * état d'entrée n'est partagé entre les deux joueurs.
 *
 * J1 configure le match dans sa moitié ; J2 en lit le récapitulatif retourné et
 * doit appuyer sur « Prêt » de son côté. Aucun lancement sans les deux accords,
 * et toute modification de réglage annule l'accord déjà donné.
 *
 * Le déroulement du match appartient au coordinateur
 * (`match-coordinator.js`) : cette page ne fait que lui livrer les événements,
 * écrire son journal et afficher son état. Aucun compteur n'est tenu ici, donc
 * aucun compteur ne peut diverger de ce qui est enregistré.
 *
 * Le duel d'un bloc se joue depuis un **instantané d'équipe** : à la frontière,
 * la coque demande aux deux cadres de figer leur équipe de run
 * (`shell/duel-invite`), garde les deux dans le journal, en déduit le plafond
 * commun, puis renvoie le duel figé aux deux cadres (`shell/duel-prepare`). Les
 * sauvegardes PvE ne sont jamais relues : un duel avorté ne peut rien y changer.
 *
 * Le duel réutilise la scène Phaser et les menus de combat du jeu dans les deux
 * cadres. La coque ne dessine pas de scène : elle reçoit seulement les choix
 * natifs, les garde secrets, puis envoie le tour aux deux moteurs pour qu'ils
 * vérifient le même résultat avant d'accorder le point.
 *
 * Le protocole (versionné, enveloppe minimale) est le même que côté jeu :
 * voir `src/system/shell-protocol.ts`.
 */
import {
  acceptDuelReport,
  duelDisplayFor,
  duelSeedOf,
  isDuelFighter,
  lockDuelChoice,
  newDuelSession,
  openDuelTurn,
} from "./duel-session.js";
import {
  battlesNeeded,
  clearJournal,
  duelCapOf,
  duelIdFor,
  duelPrepared,
  isTeamPayload,
  loadJournal,
  matchScore,
  newJournal,
  playerProgress,
  recordBattleWon,
  recordDuelResult,
  recordDuelStarted,
  recordDuelTeam,
  recordExtraRound,
  recordSaved,
  resumeJournal,
  saveJournal,
} from "./match-coordinator.js";
import {
  activeProfileId,
  createProfile,
  customizeProfile,
  deleteProfile,
  listProfiles,
  readProfile,
  recordProfileBattle,
  recordProfileDuel,
  recordProfileMatch,
  selectProfile,
} from "./player-profile.js";

(() => {
  const shellI18n = createTwoPlayerI18n();
  const { t } = shellI18n;
  shellI18n.applyStatic();
  const shellLanguageSelect = document.getElementById("shell-language");
  for (const language of shellI18n.languages) {
    const option = new Option(language.name, language.code);
    shellLanguageSelect.add(option);
  }
  shellLanguageSelect.value = shellI18n.selection;

  /** Révision du protocole comprise par les deux côtés (voir `shell-protocol.ts`). */
  const PROTOCOL_VERSION = 3;

  /** Les règles du match appartiennent à la coque, pas au stockage d'un joueur. */
  const RULES_KEY = "local2p/v1/shell/rules";

  /** Matchs terminés, bornés : le journal courant est effacé à la fin du match. */
  const HISTORY_KEY = "local2p/v1/shell/history";
  const HISTORY_LIMIT = 20;

  /**
   * Bornes et valeurs par défaut, identiques à `src/system/match-rules.ts`.
   * La coque est du JavaScript autonome, sans étape de compilation : la liste
   * est recopiée ici et les tests unitaires du module TypeScript font foi. Un
   * cadre reçoit de toute façon ces nombres et les revalide de son côté.
   */
  const RULES_VERSION = 1;
  const LIMITS = { blockSize: [2, 99], blocks: [1, 20], bankRenforts: [0, 3], quickLevel: [1, 100] };
  const MODES = ["side-by-side", "blocks", "quick-random"];
  const LEVEL_CAPS = ["auto", "none"];
  const DEFAULT_RULES = {
    version: RULES_VERSION,
    mode: "side-by-side",
    blockSize: 10,
    blocks: 3,
    bankRenforts: 1,
    levelCap: "auto",
    duelOnDemand: true,
  };

  /** Messages qu'un cadre peut envoyer à la coque. */
  const SHELL_MESSAGE_TYPES = [
    "frame/ready",
    "frame/paused",
    "frame/resumed",
    "frame/pve-battle-won",
    "frame/pve-saved",
    "frame/duel-waiting",
    "frame/duel-team",
    "frame/quick-teams",
    "frame/duel-options",
    "frame/duel-ready",
    "frame/duel-fighter",
    "frame/duel-state",
    "frame/duel-choice",
    "frame/duel-error",
  ];

  /**
   * Délai après lequel un tour sans accord est un duel cassé.
   *
   * Les deux cadres résolvent le même tour au même moment, donc l'accord arrive
   * en quelques millisecondes ; une attente prolongée veut dire qu'un cadre a
   * refusé ce qu'on lui a envoyé, et un duel qui ne se résout pas ne doit pas
   * bloquer les deux joueurs indéfiniment.
   */
  const DUEL_WATCHDOG_MS = 30000;

  /**
   * Durée pendant laquelle le dernier tour reste à l'écran.
   *
   * Sans elle, la scène Phaser disparaîtrait au moment où le combat se décide,
   * et personne ne lirait le coup qui a tranché. Le point n'est crédité qu'à la
   * fin de ce délai : un arrêt pendant cette lecture laisse le journal en
   * `DUEL`, donc le duel se rejoue à l'identique au lieu d'être perdu.
   */
  const DUEL_RESULT_MS = 3500;

  const home = document.getElementById("home");
  const arena = document.getElementById("arena");
  const rotateHint = document.getElementById("rotate-hint");
  const pauseButton = document.getElementById("pause");
  const quitButton = document.getElementById("quit");
  const resumeButton = document.getElementById("resume");
  const duelButton = document.getElementById("duel");
  const quickOptions = document.getElementById("quick-options");
  const quickTeamHelp = document.getElementById("quick-team-help");
  const quickLevelModeField = document.getElementById("quick-level-mode-field");
  const quickLevelField = document.getElementById("quick-level-field");
  const resultScreen = document.getElementById("match-result");
  const resultElements = {
    kicker: document.querySelector("#match-result .result-kicker"),
    title: document.getElementById("result-title"),
    winner: document.getElementById("result-winner"),
    home: document.getElementById("result-home"),
    teams: { j1: document.getElementById("result-team-j1"), j2: document.getElementById("result-team-j2") },
    items: { j1: document.getElementById("result-items-j1"), j2: document.getElementById("result-items-j2") },
  };

  /** Champs de configuration, tous dans la moitié de J1. */
  const fields = {
    mode: document.getElementById("mode"),
    blockSize: document.getElementById("block-size"),
    blocks: document.getElementById("blocks"),
    bankRenforts: document.getElementById("bank-renforts"),
    levelCap: document.getElementById("level-cap"),
    duelOnDemand: document.getElementById("duel-on-demand"),
    quickTeamMode: document.getElementById("quick-team-mode"),
    quickLevelMode: document.getElementById("quick-level-mode"),
    quickLevel: document.getElementById("quick-level"),
  };
  const modeHelp = document.getElementById("mode-help");

  const recaps = { j1: document.getElementById("recap-j1"), j2: document.getElementById("recap-j2") };

  const readyButtons = { j1: document.getElementById("start"), j2: document.getElementById("ready-j2") };
  const readyHint = document.getElementById("ready-state-j2");
  const profileElements = Object.fromEntries(
    ["j1", "j2"].map(playerId => [
      playerId,
      {
        toggle: document.getElementById(`profile-toggle-${playerId}`),
        card: document.getElementById(`profile-card-${playerId}`),
        name: document.getElementById(`profile-name-${playerId}`),
        avatar: document.getElementById(`profile-avatar-${playerId}`),
        color: document.getElementById(`profile-color-${playerId}`),
        select: document.getElementById(`profile-select-${playerId}`),
        save: document.getElementById(`profile-save-${playerId}`),
        create: document.getElementById(`profile-create-${playerId}`),
        remove: document.getElementById(`profile-delete-${playerId}`),
        deleteConfirmation: document.getElementById(`profile-delete-confirmation-${playerId}`),
        deleteMessage: document.getElementById(`profile-delete-message-${playerId}`),
        deleteConfirm: document.getElementById(`profile-delete-confirm-${playerId}`),
        deleteCancel: document.getElementById(`profile-delete-cancel-${playerId}`),
        deleteStage: 0,
        deleteTarget: null,
        message: document.getElementById(`profile-message-${playerId}`),
        summary: document.getElementById(`profile-summary-${playerId}`),
        bank: document.getElementById(`profile-bank-${playerId}`),
      },
    ]),
  );
  const reinforcementPanels = Object.fromEntries(
    ["j1", "j2"].map(playerId => {
      const root = document.getElementById(`reinforce-${playerId}`);
      return [
        playerId,
        { root, rows: root.querySelector(".reinforce-rows"), submit: root.querySelector(".reinforce-submit") },
      ];
    }),
  );

  /** Une entrée par moitié d'écran, J2 en haut (retourné), J1 en bas. */
  const players = ["j2", "j1"].map(id => ({
    id,
    frame: document.getElementById(`frame-${id}`),
    marker: document.getElementById(`state-${id}`),
    /** Tableau de bord de la moitié, dans son orientation. */
    tag: document.getElementById(`tag-${id}`),
    /** Bandeau d'attente de la moitié, dans son orientation. */
    wait: document.getElementById(`wait-${id}`),
    state: "idle",
    /** Frontière annoncée à ce cadre : il doit s'arrêter au prochain point sûr. */
    armed: false,
    /** Le cadre a confirmé être arrêté entre deux combats. */
    parked: false,
    /** Dernier message reçu de ce cadre (diagnostic). */
    lastReply: null,
    /** Duel pour lequel ce cadre a été invité à figer son équipe. */
    duelId: null,
    /** Le cadre a reconstruit son côté du duel et l'a annoncé. */
    duelReady: false,
    /** Empreinte de l'équipe que ce cadre jouera (diagnostic et contrôle). */
    duelChecksum: null,
    /**
     * Combattant du duel, tel que ce cadre l'a matérialisé.
     *
     * C'est le jeu qui sait lire un instantané : il en tire le niveau, les
     * types, les statistiques, les PV et les attaques. La coque se contente de
     * le faire circuler entre les deux cadres et de l'afficher.
     */
    fighter: null,
    fighters: null,
    reinforceOptions: null,
    /** Le même, une fois complété avec les types de l'adversaire. */
    completedFighter: null,
  }));

  /** Conteneurs historiques gardés masqués pendant que le canvas Phaser combat. */
  const duelPanels = {};
  for (const player of players) {
    const root = document.getElementById(`duel-${player.id}`);
    duelPanels[player.id] = { root };
  }

  /** Identifiant opaque du run courant, repris dans chaque message. */
  let matchId = null;
  let quickGenerationPendingFor = null;

  /** Pause commune : les deux boucles de jeu dorment. */
  let paused = false;

  /** Accords des deux joueurs : le match ne part que si les deux sont à `true`. */
  const agreed = { j1: false, j2: false };

  /** Règles figées du match lancé. */
  let matchRules = { ...DEFAULT_RULES };
  let quickSettings = { teamMode: "random", levelMode: "random", level: 50 };

  /** Journal du match en cours, tel que le coordinateur le rend après écriture. */
  let journal = null;
  /** Victories only become lifetime statistics after the frame confirms its save. */
  const pendingProfileBattles = { j1: [], j2: [] };

  /** Duel en cours, côté coque : voir `duel-session.js`. */
  let duelSession = null;

  /**
   * Préparation du duel du bloc : instantanés rendus puis combattants échangés.
   *
   * Elle survit à l'échec d'une étape (rien n'est perdu) et disparaît dès que le
   * duel est ouvert ou abandonné.
   */
  let duelSetup = null;

  /** Minuteur du tour sans accord : voir {@linkcode DUEL_WATCHDOG_MS}. */
  let duelWatchdog = null;

  /** Minuteur d'affichage du dernier tour : voir {@linkcode DUEL_RESULT_MS}. */
  let duelResultTimer = null;

  /**
   * Pourquoi le duel du bloc ne peut pas être joué, ou `null`.
   *
   * Le bouton « manche nulle » ne s'affiche que sur cet aveu : une manche qui
   * attend encore ses combattants ne doit jamais pouvoir être réglée par erreur.
   */
  let duelFailure = null;
  let duelRetryNeeded = false;
  let finalResultSummary = null;

  // --------------------------------------------------------------- outils

  /**
   * Dimensions réelles de la zone visible.
   *
   * `visualViewport` suit la barre de gestes et le clavier, ce que `100%` ne
   * fait pas de façon fiable ; les marges système sont ajoutées en CSS.
   */
  function applyViewportHeight() {
    const height = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty("--viewport-height", `${height}px`);
  }

  /**
   * Ramène une valeur dans les bornes de son champ.
   *
   * Une chaîne vide est **inutilisable**, pas zéro : un `<select>` sans option
   * correspondante renvoie `""`, et `Number("")` vaut `0` — un piège qui
   * donnerait silencieusement la borne basse à la place de la valeur stockée.
   */
  function clamp(value, key, fallback) {
    const [min, max] = LIMITS[key];
    const usable = typeof value === "number" || (typeof value === "string" && value.trim() !== "");
    const number = Number(value);
    return usable && Number.isFinite(number) ? Math.min(max, Math.max(min, Math.trunc(number))) : fallback;
  }

  /**
   * Pose `value` sur un `<select>` en ajoutant l'option manquante.
   *
   * Une valeur enregistrée peut ne pas figurer dans la liste courte du
   * formulaire (migration de l'ancien seuil, configuration d'une version
   * antérieure) : la perdre en silence ferait diverger le formulaire des règles
   * réellement stockées.
   */
  function setSelectValue(select, value) {
    const wanted = String(value);
    if (![...select.options].some(option => option.value === wanted)) {
      const option = document.createElement("option");
      option.value = wanted;
      option.textContent =
        select.id === "block-size" ? t("blockOption", { total: wanted, ai: Number(wanted) - 1 }) : wanted;
      const next = [...select.options].find(existing => Number(existing.value) > Number(wanted));
      select.insertBefore(option, next ?? null);
    }
    select.value = wanted;
  }

  /**
   * Complète et borne une configuration, où qu'elle vienne : `localStorage`
   * d'une version précédente ou un objet fabriqué à la main.
   *
   * L'ancien format `{ threshold }` (un duel toutes les N victoires PvE par
   * joueur) est migré en un bloc de `N + 1` combats, qui décrit le même match.
   */
  function normalizeRules(value) {
    const stored = typeof value === "object" && value !== null ? value : {};
    const thresholds = Number(stored.threshold);
    const legacy =
      stored.blockSize === undefined && Number.isFinite(thresholds) && thresholds > 0 ? Math.trunc(thresholds) : null;

    const rules = {
      version: RULES_VERSION,
      mode: MODES.includes(stored.mode) ? stored.mode : DEFAULT_RULES.mode,
      blockSize: clamp(stored.blockSize, "blockSize", DEFAULT_RULES.blockSize),
      blocks: clamp(stored.blocks, "blocks", DEFAULT_RULES.blocks),
      bankRenforts: clamp(stored.bankRenforts, "bankRenforts", DEFAULT_RULES.bankRenforts),
      levelCap: LEVEL_CAPS.includes(stored.levelCap) ? stored.levelCap : DEFAULT_RULES.levelCap,
      duelOnDemand: typeof stored.duelOnDemand === "boolean" ? stored.duelOnDemand : DEFAULT_RULES.duelOnDemand,
    };
    if (legacy !== null) {
      // Un seuil « un duel toutes les N victoires PvE » décrit un bloc de N + 1 combats.
      rules.mode = "blocks";
      rules.blockSize = Math.min(LIMITS.blockSize[1], Math.max(LIMITS.blockSize[0], legacy + 1));
    }
    return rules;
  }

  function normalizeQuickSettings(value) {
    const stored = typeof value === "object" && value !== null ? value : {};
    const teamMode = stored.teamMode === "balanced" ? "balanced" : "random";
    return {
      teamMode,
      levelMode: teamMode === "random" || stored.levelMode !== "fixed" ? "random" : "fixed",
      level: clamp(stored.level, "quickLevel", 50),
    };
  }

  function readQuickSettings() {
    return normalizeQuickSettings({
      teamMode: fields.quickTeamMode.value,
      levelMode: fields.quickLevelMode.value,
      level: fields.quickLevel.value,
    });
  }

  function applyQuickSettings(settings) {
    quickSettings = normalizeQuickSettings(settings);
    fields.quickTeamMode.value = quickSettings.teamMode;
    fields.quickLevelMode.value = quickSettings.levelMode;
    fields.quickLevel.value = String(quickSettings.level);
    updateQuickOptions();
  }

  /** Les règles telles que les champs de J1 les décrivent. */
  function rulesFromFields() {
    return normalizeRules({
      mode: fields.mode.value,
      blockSize: fields.blockSize.value,
      blocks: fields.blocks.value,
      bankRenforts: fields.bankRenforts.value,
      levelCap: fields.levelCap.value,
      duelOnDemand: fields.duelOnDemand.checked,
    });
  }

  function loadRules() {
    try {
      const stored = JSON.parse(localStorage.getItem(RULES_KEY));
      quickSettings = normalizeQuickSettings(stored?.quickBattle);
      return normalizeRules(stored);
    } catch (error) {
      console.warn("Coque 2P : règles illisibles, valeurs par défaut", error);
      quickSettings = normalizeQuickSettings(null);
      return { ...DEFAULT_RULES };
    }
  }

  function saveRules(rules) {
    quickSettings = readQuickSettings();
    localStorage.setItem(RULES_KEY, JSON.stringify({ ...rules, quickBattle: quickSettings, updatedAt: Date.now() }));
  }

  /**
   * Ce qu'une configuration implique, en combats.
   *
   * Un bloc vaut `blockSize` combats *duel compris* : `blockSize - 1` combats
   * contre l'IA, puis le duel. Trois blocs de 10 font donc 27 + 3 = 30.
   *
   * @param {object} rules - Configuration déjà bornée
   * @returns {object} Combats par bloc, combats contre l'IA, duels, total
   */
  function scheduleOf(rules) {
    if (rules.mode === "quick-random") {
      return { pvePerBlock: 0, blocks: 1, pveBattles: 0, duels: 1, totalBattles: 1 };
    }
    if (rules.mode !== "blocks") {
      return { pvePerBlock: 0, blocks: 0, pveBattles: 0, duels: 0, totalBattles: 0 };
    }
    const pvePerBlock = rules.blockSize - 1;
    const pveBattles = pvePerBlock * rules.blocks;
    const duels = rules.blocks;
    return { pvePerBlock, blocks: rules.blocks, pveBattles, duels, totalBattles: pveBattles + duels };
  }

  /** Phrase affichée dans les deux moitiés : aucun calcul à refaire de tête. */
  function recapText(rules) {
    if (rules.mode === "quick-random") {
      const selected = readQuickSettings();
      const teamDescription = selected.teamMode === "balanced" ? t("recapQuickBalanced") : t("recapQuickRandom");
      const levelDescription =
        selected.teamMode !== "balanced" || selected.levelMode === "random"
          ? t("recapLevelRandom")
          : t("recapLevelFixed", { level: selected.level });
      return t("recapQuick", { teams: teamDescription, level: levelDescription });
    }
    if (rules.mode !== "blocks") {
      return rules.duelOnDemand ? t("recapFree") : t("recapFreeNoDuel");
    }
    const schedule = scheduleOf(rules);
    const recap = t("recapBlocks", {
      ai: rules.blockSize - 1,
      blocks: schedule.blocks,
      pve: schedule.pveBattles,
      duels: schedule.duels,
    });
    return schedule.totalBattles > 200 ? `${recap} ${t("longMatch")}` : recap;
  }

  function isFrameMessage(data) {
    return (
      typeof data === "object"
      && data !== null
      && data.protocolVersion === PROTOCOL_VERSION
      && SHELL_MESSAGE_TYPES.includes(data.type)
    );
  }

  function postTo(player, type, payload = {}) {
    player.frame.contentWindow?.postMessage(
      { protocolVersion: PROTOCOL_VERSION, type, matchId, ...payload },
      window.location.origin,
    );
  }

  /**
   * Remet les règles au cadre qui vient de se déclarer prêt.
   *
   * C'est le cadre qui parle en premier (`frame/ready` au chargement de la
   * page) : la coque répond, plutôt que d'envoyer dans le vide avant que la page
   * n'ait de quoi recevoir. Un cadre qui refuse ces règles (`shell-protocol.ts`
   * valide le motif) ne compte alors rien, et la coque le voit à l'écran.
   */
  function sendRules(player) {
    // Pendant un match, les règles sont figées : c'est celles du match qui font
    // foi, pas ce que le formulaire afficherait s'il avait changé entre-temps.
    const rules = matchId === null ? rulesFromFields() : matchRules;
    postTo(player, "shell/rules", { rules, schedule: scheduleOf(rules) });
  }

  function broadcast(type) {
    for (const player of players) {
      postTo(player, type);
    }
  }

  function renderState(player) {
    const labels = { idle: "", ready: "prêt", paused: "pause" };
    const label = labels[player.state] ?? "";
    player.marker.textContent = `${player.id.toUpperCase()}${label ? ` · ${label}` : ""}`;
    player.marker.classList.toggle("ready", player.state === "ready");
    player.marker.classList.toggle("paused", player.state === "paused");
  }

  function playerOf(frameWindow) {
    return players.find(player => player.frame.contentWindow === frameWindow) ?? null;
  }

  /** Moitié d'écran à partir de son identifiant, pour les tests et les fautes. */
  function playerById(playerId) {
    return players.find(player => player.id === playerId) ?? null;
  }

  // ------------------------------------------------------ tableau de bord

  /**
   * Phrase du tableau de bord d'une moitié, dans son orientation.
   *
   * Elle lit le journal du coordinateur et rien d'autre : ce qui est affiché est
   * ce qui est enregistré, donc ce qui sera repris après un arrêt.
   *
   * @param {string} playerId - `j1` ou `j2`
   * @returns {string} Repère du joueur et sa progression
   */
  function progressText(playerId) {
    const name = playerId.toUpperCase();
    if (journal === null) {
      return name;
    }
    if (journal.quickBattle && journal.phase !== "FINI") {
      return `${name} · combat rapide aléatoire · duel`;
    }
    if (journal.phase === "FINI") {
      const score = matchScore(journal);
      const result = score.winner === "draw" ? "égalité" : `remporté par ${score.winner.toUpperCase()}`;
      return `${name} · ${score[playerId]} pt · match ${result}`;
    }
    const progress = playerProgress(journal, playerId);
    const battles = progress.needed === 0 ? "manche de duel" : `${progress.battles}/${progress.needed} combats`;
    const state = progress.atBoundary ? " · frontière" : "";
    return `${name} · bloc ${progress.block}/${progress.totalBlocks} · ${battles} · ${progress.duelWins} pt${state}`;
  }

  /**
   * État de la préparation du duel, tel que les deux moitiés le lisent.
   *
   * Il dit où en sont les instantanés (un par joueur), le plafond commun une
   * fois les deux équipes connues, et quels cadres ont fini de reconstruire leur
   * côté. C'est le même texte des deux côtés : personne n'a à demander à l'autre.
   *
   * @returns {string} La phrase du bandeau, ou une chaîne vide
   */
  function duelText() {
    if (journal === null) {
      return "";
    }
    const parts = ["Duel à jouer · les deux blocs sont terminés"];
    const snapshots = players
      .filter(player => journal.duelTeams[player.id] !== null)
      .map(player => player.id.toUpperCase());
    if (snapshots.length > 0 && !duelPrepared(journal)) {
      parts.push(`instantanés : ${snapshots.join(" ")}`);
    }
    if (duelPrepared(journal)) {
      const cap = duelCapOf(journal);
      parts.push(cap === null ? "niveaux réels" : `plafond ${cap}`);
      const ready = players.filter(player => player.duelReady).map(player => player.id.toUpperCase());
      if (ready.length > 0) {
        parts.push(`prêts : ${ready.join(" ")}`);
      }
    }
    return parts.join(" · ");
  }

  /**
   * Phrase du bandeau d'attente d'une moitié, quand il y a lieu d'en afficher un.
   *
   * Trois situations, dans l'ordre où elles arrivent : la frontière est annoncée
   * (le run va s'arrêter), le jeu est arrêté (le cadre l'a confirmé), et le duel
   * est prêt (les deux camps sont à l'arrêt). Un joueur qui joue encore n'a rien
   * à lire.
   *
   * @param {object} player - Moitié concernée
   * @returns {string} Le texte à afficher, ou une chaîne vide
   */
  function waitText(player) {
    if (journal === null || journal.phase === "FINI") {
      return "";
    }
    const duelDue = journal.phase === "PREPARE" || journal.phase === "DUEL";
    if (duelDue) {
      return duelText();
    }
    const other = player.id === "j1" ? "J2" : "J1";
    if (player.parked) {
      return `Frontière atteinte · en attente de ${other}`;
    }
    if (player.armed) {
      return `Bloc terminé · ton run s'arrête avant le prochain combat`;
    }
    return "";
  }

  /** Rafraîchit les deux tableaux de bord, les bandeaux et les actions de la barre. */
  function renderDashboard() {
    for (const player of players) {
      player.tag.textContent = progressText(player.id);
      // Pendant le duel, les messages et commandes sont dans le jeu Phaser.
      const wait = duelSession === null ? waitText(player) : "";
      player.wait.textContent = wait;
      player.wait.hidden = wait === "";
      const boundary =
        journal !== null && journal.players[player.id] !== undefined && journal.players[player.id].atBoundary;
      player.tag.classList.toggle("duel", boundary || player.parked);
    }
    renderDuel();
    const matchFinished = journal !== null && journal.phase === "FINI" && !journal.onDemand;
    const freeDuelFinished = finalResultSummary?.returnToRuns === true;
    if (matchFinished || freeDuelFinished) {
      if (matchFinished) {
        for (const player of players) {
          player.frame.hidden = true;
        }
      }
      resultScreen.hidden = false;
      renderMatchResult();
    } else if (finalResultSummary === null) {
      resultScreen.hidden = true;
    }
    if (journal === null) {
      duelButton.hidden =
        matchRules.mode !== "side-by-side"
        || !matchRules.duelOnDemand
        || arena.hidden
        || !players.every(player => player.state === "ready");
      duelButton.textContent = "Duel libre · pour 1 point";
      return;
    }
    if (journal.onDemand && !duelRetryNeeded) {
      duelButton.hidden = false;
      duelButton.textContent = "Annuler le duel libre";
      return;
    }
    // Le bouton n'est qu'une sortie de secours, pour la manche qu'aucun des deux
    // cadres n'a pu transformer en combattant : elle est comptée nulle, et le
    // bloc suivant commence. Un duel jouable la rend invisible.
    duelButton.hidden = !duelStuck();
    duelButton.textContent = duelRetryNeeded ? "Rejouer le duel interrompu" : "Duel impossible · manche nulle";
  }

  function renderMatchResult() {
    if (finalResultSummary === null) {
      return;
    }
    const winnerId = finalResultSummary.winner;
    const winner = winnerId === "draw" ? null : finalResultSummary.teams[winnerId]?.trainer;
    resultElements.kicker.textContent = finalResultSummary.returnToRuns ? "Résultat du duel libre" : "Fin du match";
    resultElements.title.textContent = winner === null ? "Match nul" : `Victoire de ${winner} !`;
    resultElements.winner.textContent = `Score final : ${finalResultSummary.score.j1}–${finalResultSummary.score.j2}`;
    resultElements.home.textContent = finalResultSummary.returnToRuns ? "Reprendre les parties" : "Retour à l'accueil";
    for (const playerId of ["j1", "j2"]) {
      const side = finalResultSummary.teams[playerId];
      resultElements.teams[playerId].replaceChildren();
      for (const pokemon of side.pokemon) {
        const line = document.createElement("li");
        line.textContent = pokemon.name;
        resultElements.teams[playerId].append(line);
      }
      const held = side.pokemon.flatMap(pokemon => pokemon.heldItems.map(item => `${pokemon.name} : ${item}`));
      resultElements.items[playerId].textContent =
        held.length === 0
          ? "Aucun objet porté au début du duel. Les objets ne sont pas utilisables dans les duels 2 joueurs pour le moment."
          : `Objets portés au début du duel (non activés pendant ce duel) : ${held.join(" · ")}.`;
      document.getElementById(`result-${playerId}-title`).textContent =
        `${side.trainer} · équipe de ${playerId.toUpperCase()}`;
    }
  }

  function summarizeFinalDuel(winner, returnToRuns = false) {
    const teams = {};
    for (const playerId of ["j1", "j2"]) {
      const player = playerById(playerId);
      const profile = readProfile(localStorage, playerId);
      const fighters = Array.isArray(player.fighters) ? player.fighters : [];
      teams[playerId] = {
        trainer: profile.displayName ?? playerId.toUpperCase(),
        pokemon: fighters.map(fighter => ({
          name: fighter.name,
          heldItems: Array.isArray(fighter.heldItems) ? [...fighter.heldItems] : [],
        })),
      };
    }
    return { winner, teams, score: matchScore(journal), returnToRuns };
  }

  /**
   * La manche due ne peut pas être jouée : les deux camps ont annoncé leur côté,
   * mais aucun combattant n'en est sorti, ou l'échange s'est arrêté en route.
   */
  function duelStuck() {
    if (duelFailure === null || duelSession !== null || journal === null) {
      return false;
    }
    // `duelFailure` n'est jamais deviné : il vient d'une moitié qui n'a pas pu
    // construire son combattant, ou d'un échange resté sans réponse. Une manche
    // qui attend encore ses instantanés n'est donc jamais proposée à la place.
    return journal.phase === "PREPARE";
  }

  // -------------------------------------------------- accueil et configuration

  /**
   * Applique la configuration au formulaire, explique le résultat et remet les
   * deux accords à zéro : ce que J1 vient de changer, J2 ne l'a pas encore vu.
   */
  function applyRules(rules, { resetAgreement = true } = {}) {
    fields.mode.value = rules.mode;
    setSelectValue(fields.blockSize, rules.blockSize);
    setSelectValue(fields.blocks, rules.blocks);
    setSelectValue(fields.bankRenforts, rules.bankRenforts);
    fields.levelCap.value = rules.levelCap;
    fields.duelOnDemand.checked = rules.duelOnDemand;

    const scheduled = rules.mode === "blocks";
    const free = rules.mode === "side-by-side";
    const quick = rules.mode === "quick-random";
    for (const key of ["blockSize", "blocks", "bankRenforts", "levelCap"]) {
      fields[key].disabled = !scheduled;
      fields[key].closest(".field").hidden = !scheduled;
    }
    for (const row of new Set(
      [fields.blockSize, fields.blocks, fields.bankRenforts, fields.levelCap].map(field => field.closest(".row")),
    )) {
      if (row) {
        row.hidden = !scheduled;
      }
    }
    fields.duelOnDemand.disabled = !free;
    fields.duelOnDemand.closest(".check").hidden = !free;
    quickOptions.hidden = !quick;
    updateQuickOptions();
    modeHelp.textContent = scheduled ? t("modeHelpBlocks") : free ? t("modeHelpFree") : t("modeHelpQuick");

    const recap = recapText(rules);
    for (const recapElement of Object.values(recaps)) {
      recapElement.textContent = recap;
    }

    if (resetAgreement) {
      agreed.j1 = false;
      agreed.j2 = false;
    }
    renderAgreement();
  }

  function updateQuickOptions() {
    if (!fields.quickTeamMode) {
      return;
    }
    const quick = fields.mode.value === "quick-random";
    const balanced = fields.quickTeamMode.value === "balanced";
    const fixed = fields.quickLevelMode.value === "fixed";
    quickLevelModeField.hidden = !quick || !balanced;
    quickLevelField.hidden = !quick || !balanced || !fixed;
    quickTeamHelp.textContent = balanced ? t("quickHelpBalanced") : t("quickHelpRandom");
    if (!balanced) {
      fields.quickLevelMode.value = "random";
    }
  }

  function renderAgreement() {
    renderAgreementLabels();
    // Le second accord lance le match : le premier joueur n'attend jamais un
    // bouton qui n'existe pas chez lui.
    if (agreed.j1 && agreed.j2) {
      startMatch();
    }
  }

  function renderAgreementLabels() {
    const labels = {
      j1: agreed.j1 ? t("readyWaitingJ2") : t("readyLaunch"),
      j2: agreed.j2 ? t("readyWaitingJ1") : t("ready"),
    };
    readyButtons.j1.textContent = labels.j1;
    readyButtons.j2.textContent = labels.j2;
    readyHint.textContent = agreed.j2 ? t("readyHint") : t("waitingHint");
  }

  /** Un accord ne vaut que pour la configuration affichée au moment où il est donné. */
  function agree(playerId) {
    agreed[playerId] = true;
    renderAgreement();
  }

  // ------------------------------------------------------------ coordinateur

  /**
   * Livre un événement au coordinateur, écrit le journal et rafraîchit l'écran.
   *
   * C'est l'unique porte d'entrée des faits du match : les cadres y arriveront
   * par message (`frame/PVE_BATTLE_WON`, `frame/PVE_READY`, `frame/DUEL_RESULT`),
   * et les tests par `window.__shell.coordinator`. Un événement refusé n'écrit
   * rien.
   *
   * @param {(state: object, now: number) => { state: object, accepted: boolean, reason?: string }} apply
   * @param {{ commit?: boolean }} [options] - `commit` marque l'écriture comme durable
   * @returns {{ accepted: boolean, reason?: string }}
   */
  function record(apply, { commit = false } = {}) {
    if (journal === null) {
      return { accepted: false, reason: "aucun match en cours" };
    }
    const result = apply(journal, Date.now());
    if (result.accepted) {
      journal = saveJournal(localStorage, result.state, { commit });
      if (finalResultSummary !== null && (journal.phase === "FINI" || journal.onDemand)) {
        const score = matchScore(journal);
        finalResultSummary.score = score;
        finalResultSummary.winner = score.winner;
      }
      if (journal.phase === "FINI" && !journal.onDemand) {
        archiveMatch(journal);
      }
      renderDashboard();
    }
    return { accepted: result.accepted, reason: result.reason };
  }

  /**
   * Range le match terminé dans l'historique et efface le journal courant :
   * un match fini n'est plus à reprendre, mais son score reste consultable.
   */
  function archiveMatch(state) {
    const score = matchScore(state);
    for (const playerId of ["j1", "j2"]) {
      recordProfileMatch(localStorage, playerId, state.matchId, score.winner);
    }
    const history = readHistory();
    history.unshift({
      matchId: state.matchId,
      endedAt: Date.now(),
      extraDuels: state.extraDuels,
      rules: state.quickBattle ? { ...state.rules, mode: "quick-random" } : state.rules,
      score: { j1: score.j1, j2: score.j2 },
      winner: score.winner,
      quickBattle: state.quickBattle ?? null,
      resultSummary: finalResultSummary,
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
    clearJournal(localStorage);
  }

  function readHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY));
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Coque 2P : historique illisible, reparti à vide", error);
      return [];
    }
  }

  function resetDeleteConfirmation(elements) {
    elements.deleteStage = 0;
    elements.deleteTarget = null;
    elements.deleteConfirmation.hidden = true;
    elements.deleteMessage.textContent = "";
    elements.deleteConfirm.textContent = t("confirmDelete");
  }

  function closeProfileMenus(exceptCard = null) {
    for (const elements of Object.values(profileElements)) {
      if (elements.card !== exceptCard && !elements.card.hidden) {
        elements.card.hidden = true;
        resetDeleteConfirmation(elements);
      }
    }
  }

  function prepareProfileDropdown(activeElements) {
    fields.mode.blur();
    closeProfileMenus(activeElements.card);
    for (const elements of Object.values(profileElements)) {
      if (elements !== activeElements) {
        elements.select.blur();
      }
    }
  }

  function prepareModeDropdown() {
    closeProfileMenus();
    for (const elements of Object.values(profileElements)) {
      elements.select.blur();
    }
  }

  function renderProfile(playerId) {
    const elements = profileElements[playerId];
    const selected = activeProfileId(localStorage, playerId);
    const other = activeProfileId(localStorage, playerId === "j1" ? "j2" : "j1");
    elements.select.replaceChildren(
      ...listProfiles(localStorage).map(entry => {
        const label = `${entry.avatar} ${entry.displayName}`;
        const option = new Option(entry.id === selected ? t("selectedProfile", { label }) : label, entry.id);
        option.disabled = entry.id === other;
        return option;
      }),
    );
    elements.select.value = selected;
    const profile = readProfile(localStorage, playerId);
    const stats = profile.stats ?? {};
    const dexEntries = Object.values(profile.dex ?? {});
    const caughtSpecies = dexEntries.filter(entry => entry?.caught > 0).length;
    elements.name.value = profile.displayName ?? playerId.toUpperCase();
    elements.avatar.value = profile.avatar ?? "🎮";
    elements.color.value = profile.color ?? "#9c8cff";
    elements.toggle.textContent = `${elements.avatar.value} ${profile.displayName ?? playerId.toUpperCase()}`;
    document.getElementById(`tag-${playerId}`).style.color = elements.color.value;
    elements.summary.textContent = t("profileStats", {
      pveBattlesWon: stats.pveBattlesWon ?? 0,
      bestRunWave: stats.bestRunWave ?? 0,
      duelsWon: stats.duelsWon ?? 0,
      duelsLost: stats.duelsLost ?? 0,
      duelsDrawn: stats.duelsDrawn ?? 0,
      matchesWon: stats.matchesWon ?? 0,
      matchesPlayed: stats.matchesPlayed ?? 0,
      seen: dexEntries.length,
      caught: caughtSpecies,
    });
    const bank = Array.isArray(profile.bank) ? profile.bank : [];
    const best = [...bank].sort((a, b) => b.level - a.level).slice(0, 6);
    const bankPreview =
      best.length === 0
        ? t("noCaptures")
        : best.map(entry => `#${entry.speciesId} ${t("level")} ${entry.level}`).join(", ");
    elements.bank.textContent = `${t("captureBank", { count: bank.length })} · ${bankPreview}. ${t("bankHelp")}`;
  }

  function refreshLanguageDependentContent() {
    for (const playerId of ["j1", "j2"]) {
      const elements = profileElements[playerId];
      const draft = { name: elements.name.value, avatar: elements.avatar.value, color: elements.color.value };
      renderProfile(playerId);
      elements.name.value = draft.name;
      elements.avatar.value = draft.avatar;
      elements.color.value = draft.color;
      // Status messages are transient and may have been generated in the old language.
      elements.message.textContent = "";

      if (elements.deleteStage > 0 && elements.deleteTarget !== null) {
        const target = listProfiles(localStorage).find(profile => profile.id === elements.deleteTarget);
        if (target === undefined) {
          resetDeleteConfirmation(elements);
        } else {
          const messageKey = elements.deleteStage === 1 ? "deleteAskFirst" : "deleteAskSecond";
          const buttonKey = elements.deleteStage === 1 ? "deleteButtonFirst" : "deleteButtonSecond";
          elements.deleteConfirmation.hidden = false;
          elements.deleteMessage.textContent = t(messageKey, {
            avatar: target.avatar,
            name: target.displayName,
          });
          elements.deleteConfirm.textContent = t(buttonKey);
        }
      }
    }

    const rules = rulesFromFields();
    const scheduled = rules.mode === "blocks";
    const free = rules.mode === "side-by-side";
    modeHelp.textContent = scheduled ? t("modeHelpBlocks") : free ? t("modeHelpFree") : t("modeHelpQuick");
    const recap = recapText(rules);
    for (const recapElement of Object.values(recaps)) {
      recapElement.textContent = recap;
    }
    quickTeamHelp.textContent =
      fields.quickTeamMode.value === "balanced" ? t("quickHelpBalanced") : t("quickHelpRandom");
    renderAgreementLabels();
    renderResume();
  }

  /** Un combat gagné contre l'IA, annoncé par la session du joueur. */
  function battleWon(playerId, battleId, wave = 0) {
    const result = record((state, now) => recordBattleWon(state, playerId, battleId, now));
    if (result.accepted) {
      pendingProfileBattles[playerId].push({ battleId, wave });
      // Une victoire peut être celle qui atteint la frontière du bloc.
      parkPlayerIfAtBoundary(playerId);
    }
    return result;
  }

  /** Accusé de sauvegarde d'une session : le duel ne s'ouvre qu'après les deux. */
  function saved(playerId, saveSeq) {
    const result = record((state, now) => recordSaved(state, playerId, saveSeq, now), { commit: true });
    if (result.accepted) {
      for (const { battleId, wave } of pendingProfileBattles[playerId].splice(0)) {
        recordProfileBattle(localStorage, playerId, battleId, wave);
      }
    }
    return result;
  }

  /** Ouverture du duel, quand la préparation l'a rendu possible. */
  function duelStarted(duelId) {
    return record((state, now) => recordDuelStarted(state, duelId, now), { commit: true });
  }

  /**
   * Résultat d'un duel : le seul endroit qui crédite un point.
   *
   * Le bloc suivant appartient aux deux joueurs : ils sont libérés de leur
   * arrêt ici, et seulement ici.
   */
  function duelResult(duelId, winner) {
    const result = record((state, now) => recordDuelResult(state, duelId, winner, now), { commit: true });
    if (result.accepted) {
      if (!journal.onDemand || journal.scoreOnDemand) {
        for (const playerId of ["j1", "j2"]) {
          recordProfileDuel(localStorage, playerId, duelId, winner);
        }
      }
      const matchFinished = journal.phase === "FINI" && !journal.onDemand;
      if (!matchFinished) {
        releasePlayers();
      }
      if (journal.onDemand) {
        clearJournal(localStorage);
        journal = null;
        renderDashboard();
      }
    }
    return result;
  }

  /** Manche supplémentaire après une égalité. */
  function extraRound() {
    return record((state, now) => recordExtraRound(state, now), { commit: true });
  }

  /**
   * Annonce la frontière à la moitié qui l'a atteinte.
   *
   * Le cadre ne s'arrête pas au milieu d'un combat : il arme son attente et
   * s'arrête au prochain point sûr (récompense prise, sauvegarde écrite, combat
   * suivant pas encore commencé). L'annonce est idempotente, et se refait au
   * `frame/ready` d'un cadre rechargé, dont l'arrêt n'a pas survécu.
   */
  function parkPlayerIfAtBoundary(playerId) {
    const player = players.find(candidate => candidate.id === playerId);
    if (player === undefined || journal === null || !journal.players[playerId].atBoundary) {
      return false;
    }
    if (!player.armed && !player.parked) {
      player.armed = true;
      postTo(player, "shell/wait-for-duel");
      renderDashboard();
    }
    return true;
  }

  /** Libère les deux moitiés après un duel réglé : le bloc suivant commence. */
  function releasePlayers() {
    for (const player of players) {
      postTo(player, "shell/continue");
      player.armed = false;
      player.parked = false;
      // Le duel est réglé : les instantanés du bloc suivant seront redemandés.
      player.duelId = null;
      player.duelReady = false;
      player.duelChecksum = null;
      player.fighter = null;
      player.fighters = null;
      player.reinforceOptions = null;
      reinforcementPanels[player.id].root.hidden = true;
      player.completedFighter = null;
    }
    duelSetup = null;
    duelFailure = null;
    duelRetryNeeded = false;
    renderDashboard();
  }

  // --------------------------------------------------- instantanés de duel

  /**
   * Met un cadre en état de préparer le duel du bloc.
   *
   * Deux cas, et ils se suivent : tant que la coque n'a pas d'équipe de ce
   * joueur, elle l'invite à figer la sienne ; une fois les deux équipes
   * connues, elle renvoie le duel figé (plafond compris) pour que le cadre
   * reconstruise son côté. Un cadre rechargé a tout perdu de son duel : il suffit
   * de l'appeler à son `frame/ready` pour que la reprise soit identique.
   *
   * @param {object} player - Moitié concernée
   * @returns {boolean} Si un message a été envoyé
   */
  function syncDuelPreparation(player) {
    if (journal === null || (journal.phase !== "PREPARE" && journal.phase !== "DUEL")) {
      return false;
    }
    if (journal.onDemand && !player.parked) {
      return false;
    }
    const duelId = duelIdFor(journal);
    const bankRenforts = journal.rules.bankRenforts;
    if (journal.duelTeams[player.id] === null) {
      if (journal.quickBattle) {
        return false;
      }
      player.duelId = duelId;
      player.duelReady = false;
      postTo(player, "shell/duel-invite", { duelId, bankRenforts });
      return true;
    }
    if (duelPrepared(journal) && !(player.duelReady && player.duelId === duelId)) {
      player.duelId = duelId;
      player.duelReady = false;
      postTo(player, "shell/duel-prepare", {
        duelId,
        cap: duelCapOf(journal),
        bankRenforts,
        teams: { j1: journal.duelTeams.j1, j2: journal.duelTeams.j2 },
      });
      return true;
    }
    return false;
  }

  /** Demande à chaque cadre l'équipe qu'il faut pour le duel du bloc. */
  function requestDuelTeams() {
    if (journal === null || journal.phase !== "PREPARE") {
      return false;
    }
    if (journal.onDemand && !players.every(player => player.parked)) {
      return false;
    }
    let sent = false;
    for (const player of players) {
      sent = syncDuelPreparation(player) || sent;
    }
    if (sent && !duelPrepared(journal)) {
      // Un cadre dont le run n'est pas chargé ne peut pas figer d'équipe : sans
      // garde-fou, les deux joueurs resteraient à l'arrêt sur un duel que
      // personne ne peut préparer.
      armDuelWatchdog("instantanés d'équipe incomplets");
    }
    renderDashboard();
    return sent;
  }

  /**
   * Équipe figée d'un joueur, telle que son cadre l'a envoyée.
   *
   * Le cadre ne dit pas qui il est : c'est la source du message qui l'identifie,
   * et l'équipe doit porter le même joueur et le duel du bloc en cours. Un
   * instantané d'un autre bloc est refusé, jamais « presque accepté ».
   *
   * @param {object} player - Moitié émettrice
   * @param {object} payload - Instantané reçu
   * @returns {{ accepted: boolean, reason?: string }}
   */
  function receiveDuelTeam(player, payload) {
    if (player === null) {
      return { accepted: false, reason: "joueur inconnu" };
    }
    if (journal === null) {
      return { accepted: false, reason: "aucun match en cours" };
    }
    if (!isTeamPayload(payload) || payload.playerId !== player.id || payload.duelId !== duelIdFor(journal)) {
      return { accepted: false, reason: "instantané refusé" };
    }
    // L'instantané est figé à la frontière : rien de la sauvegarde PvE ne
    // dépend de lui, et il doit survivre à un arrêt au milieu du duel.
    const result = record((state, now) => recordDuelTeam(state, player.id, payload, now), { commit: true });
    if (result.accepted) {
      player.duelId = payload.duelId;
      if (duelPrepared(journal)) {
        // Les deux instantanés sont dans le journal : le garde-fou des
        // instantanés n'a plus rien à surveiller.
        disarmDuelWatchdog();
      }
    }
    return result;
  }

  function requestQuickTeamGeneration(player) {
    if (
      player.id !== "j1"
      || journal?.phase !== "PREPARE"
      || !journal.quickBattle
      || journal.duelTeams.j1 !== null
      || quickGenerationPendingFor === journal.matchId
      || !players.every(candidate => candidate.state === "ready")
    ) {
      return false;
    }
    quickGenerationPendingFor = journal.matchId;
    armDuelWatchdog("l'ordinateur n'a pas pu préparer les équipes du duel rapide");
    postTo(player, "shell/quick-generate", {
      duelId: duelIdFor(journal),
      quickBattle: journal.quickBattle,
    });
    return true;
  }

  function receiveQuickTeams(player, duelId, teams) {
    if (
      player.id !== "j1"
      || journal?.quickBattle === undefined
      || journal.phase !== "PREPARE"
      || duelId !== duelIdFor(journal)
      || typeof teams !== "object"
      || teams === null
      || !isTeamPayload(teams.j1)
      || !isTeamPayload(teams.j2)
      || teams.j1.playerId !== "j1"
      || teams.j2.playerId !== "j2"
      || teams.j1.duelId !== duelId
      || teams.j2.duelId !== duelId
    ) {
      return { accepted: false, reason: "équipes du combat rapide refusées" };
    }
    const first = recordDuelTeam(journal, "j1", teams.j1, Date.now());
    const second = first.accepted ? recordDuelTeam(first.state, "j2", teams.j2, Date.now()) : first;
    if (!first.accepted || !second.accepted) {
      return { accepted: false, reason: second.reason ?? "équipes du combat rapide refusées" };
    }
    journal = saveJournal(localStorage, second.state, { commit: true });
    playerById("j1").duelId = duelId;
    playerById("j2").duelId = duelId;
    disarmDuelWatchdog();
    requestDuelTeams();
    renderDashboard();
    return { accepted: true };
  }

  /** Le cadre a reconstruit son côté du duel : l'autre moitié attend le sien. */
  function duelReady(player, checksum, fighter, fighters) {
    if (player === null || journal === null || !duelPrepared(journal)) {
      return { accepted: false, reason: "aucun duel préparé" };
    }
    player.duelId = duelIdFor(journal);
    player.duelReady = typeof checksum === "string" && checksum !== "";
    player.duelChecksum = player.duelReady ? checksum : null;
    // Un cachet sans combattant veut dire que le jeu n'a pas su reconstruire
    // l'instantané : sans duel jouable, la coque doit pouvoir le dire.
    const team = Array.isArray(fighters) ? fighters : [fighter];
    player.fighters =
      player.duelReady && team.length > 0 && team.length <= 6 && team.every(member => isDuelFighter(member, player.id))
        ? team
        : null;
    player.fighter = player.fighters?.[0] ?? null;
    reinforcementPanels[player.id].root.hidden = true;
    if (player.duelReady && player.fighter === null) {
      duelFailure = "combattant impossible à construire";
    }
    renderDashboard();
    return { accepted: player.duelReady };
  }

  /** Offers bank replacements in the owner's half, or reuses a durable choice. */
  function receiveReinforcementOptions(player, options) {
    if (
      journal?.phase !== "PREPARE"
      || options?.duelId !== duelIdFor(journal)
      || !Number.isInteger(options.max)
      || options.max < 1
      || options.max > 3
      || !Array.isArray(options.team)
      || options.team.length === 0
      || options.team.length > 6
      || !Array.isArray(options.bank)
      || options.bank.length === 0
    ) {
      return false;
    }
    const remembered = journal.reinforcements?.[player.id];
    if (remembered?.duelId === options.duelId && Array.isArray(remembered.choices)) {
      postTo(player, "shell/duel-reinforce", { duelId: options.duelId, choices: remembered.choices });
      return true;
    }
    player.reinforceOptions = options;
    const panel = reinforcementPanels[player.id];
    panel.submit.textContent = "Valider l'équipe";
    panel.rows.replaceChildren();
    for (let index = 0; index < options.max; index++) {
      const row = document.createElement("div");
      row.className = "reinforce-row";
      const slot = document.createElement("select");
      slot.setAttribute("aria-label", `Emplacement ${index + 1}`);
      slot.add(new Option("Aucun remplacement", ""));
      for (const member of options.team) {
        slot.add(new Option(`Équipe #${member.speciesId} niv. ${member.level}`, String(member.slot)));
      }
      const bank = document.createElement("select");
      bank.setAttribute("aria-label", `Capture ${index + 1}`);
      bank.add(new Option("Choisir une capture", ""));
      for (const entry of options.bank) {
        bank.add(new Option(`Banque #${entry.speciesId} niv. ${entry.level}`, entry.entryId));
      }
      row.append(slot, bank);
      panel.rows.append(row);
    }
    panel.root.hidden = false;
    return true;
  }

  function submitReinforcements(player) {
    const options = player.reinforceOptions;
    if (options === null || journal?.phase !== "PREPARE" || options.duelId !== duelIdFor(journal)) {
      return false;
    }
    const panel = reinforcementPanels[player.id];
    const choices = [];
    for (const row of panel.rows.children) {
      const [slot, bank] = row.querySelectorAll("select");
      if (slot.value === "" && bank.value === "") {
        continue;
      }
      if (slot.value === "" || bank.value === "") {
        panel.submit.textContent = "Choix incomplet · choisir un emplacement et une capture";
        return false;
      }
      choices.push({ slot: Number(slot.value), entryId: bank.value });
    }
    if (
      new Set(choices.map(choice => choice.slot)).size !== choices.length
      || new Set(choices.map(choice => choice.entryId)).size !== choices.length
    ) {
      panel.submit.textContent = "Chaque emplacement et capture doit être unique";
      return false;
    }
    journal = saveJournal(
      localStorage,
      {
        ...journal,
        reinforcements: { ...journal.reinforcements, [player.id]: { duelId: options.duelId, choices } },
      },
      { commit: true },
    );
    panel.root.hidden = true;
    postTo(player, "shell/duel-reinforce", { duelId: options.duelId, choices });
    return true;
  }

  // ------------------------------------------------------------------- duel

  /**
   * Avance la préparation du duel, étape par étape.
   *
   * Trois temps, chacun déclenché par un message : les deux cadres reconstruisent
   * leur côté (`frame/duel-ready`, combattant compris), on leur donne les types
   * de l'adversaire pour qu'ils calculent leurs efficacités avec le tableau du
   * jeu (`shell/duel-matchup`), puis les deux combattants complétés ouvrent le
   * duel (`shell/duel-start`).
   *
   * @returns {boolean} Si un message est parti
   */
  function advanceDuelSetup() {
    const duelId = duelSetupTarget();
    if (duelId === null) {
      return false;
    }
    rememberDuelSetup(duelId);
    if (!duelSetup.asked) {
      askDuelMatchups(duelId);
      return true;
    }
    return players.every(player => player.completedFighter !== null) ? openLiveDuel(duelId) : false;
  }

  /**
   * Duel du bloc à ouvrir, ou `null` : les deux camps doivent être à la
   * frontière, leurs instantanés dans le journal, et leur combattant construit.
   *
   * @returns {string | null} L'identifiant du duel
   */
  function duelSetupTarget() {
    if (journal === null || duelSession !== null) {
      return null;
    }
    if (journal.phase !== "PREPARE" && journal.phase !== "DUEL") {
      return null;
    }
    const duelId = duelIdFor(journal);
    const both = players.every(player => player.duelReady && player.duelId === duelId && player.fighter !== null);
    return both && duelPrepared(journal) ? duelId : null;
  }

  /**
   * Fige ce que le duel a de commun : les empreintes d'équipe, qui donneront la
   * graine, et les combattants que chaque moitié a construits.
   *
   * @param {string} duelId - Duel du bloc en cours
   */
  function rememberDuelSetup(duelId) {
    if (duelSetup !== null && duelSetup.duelId === duelId) {
      return;
    }
    duelSetup = { duelId, checksums: {}, fighters: {}, asked: false };
    for (const player of players) {
      duelSetup.checksums[player.id] = player.duelChecksum;
      duelSetup.fighters[player.id] = player.fighter;
    }
  }

  /**
   * Donne à chaque cadre les types de l'adversaire.
   *
   * C'est le seul pas croisé de la préparation : chacun calcule ensuite ses
   * efficacités avec le tableau du jeu, sans jamais voir autre chose que les
   * types de l'autre.
   *
   * @param {string} duelId - Duel du bloc en cours
   */
  function askDuelMatchups(duelId) {
    for (const player of players) {
      const foe = player.id === "j1" ? "j2" : "j1";
      postTo(player, "shell/duel-matchup", {
        duelId,
        fighter: duelSetup.fighters[player.id],
        opponentTypes: duelSetup.fighters[foe].types,
      });
    }
    duelSetup.asked = true;
    // Les deux moitiés répondent en quelques millisecondes ; au-delà, ce duel ne
    // s'ouvrira pas et les joueurs doivent pouvoir en sortir.
    armDuelWatchdog("le duel n'a pas pu s'ouvrir");
    renderDashboard();
  }

  /**
   * Ouvre le duel : les deux combattants sont prêts, le coordinateur ouvre la
   * porte du point, et la table de jeu remplace les deux parties.
   *
   * @param {string} duelId - Duel du bloc en cours
   * @returns {boolean} Si le duel est ouvert
   */
  function openLiveDuel(duelId) {
    const fighters = {
      j1: [playerById("j1").completedFighter, ...playerById("j1").fighters.slice(1)],
      j2: [playerById("j2").completedFighter, ...playerById("j2").fighters.slice(1)],
    };
    const seed = duelSeedOf(duelId, duelSetup.checksums);
    const session = newDuelSession({ duelId, seed, fighters });
    if (session === null) {
      console.warn("Coque 2P : duel refusé par la session", { duelId });
      failDuelSetup("combattant illisible");
      return false;
    }
    // L'ouverture du duel est un fait durable : elle est écrite et validée avant
    // le premier tour, et le point ne sera crédité qu'à la fin.
    const opened = duelStarted(duelId);
    if (!opened.accepted) {
      console.warn("Coque 2P : duel non ouvert par le coordinateur", opened.reason);
      failDuelSetup("le coordinateur a refusé le duel");
      return false;
    }
    duelSetup = null;
    duelSession = session;
    duelFailure = null;
    duelRetryNeeded = false;
    for (const player of players) {
      postTo(player, "shell/duel-start", { duelId, seed, fighters });
    }
    // Le duel s'annonce par l'état d'ouverture, que les deux camps renvoient :
    // c'est lui qui remplit les menus, et rien n'est affiché avant.
    armDuelWatchdog("aucun état d'ouverture des deux moitiés");
    showDuelField();
    renderDashboard();
    return true;
  }

  /**
   * Combattant complété renvoyé par un cadre : les deux camps connaissent
   * maintenant leurs efficacités de type.
   *
   * @param {object} player - Moitié émettrice
   * @param {object} fighter - Combattant complété
   * @returns {{ accepted: boolean, reason?: string }}
   */
  function receiveDuelFighter(player, fighter) {
    if (player === null || duelSetup === null || journal === null || duelSetup.duelId !== duelIdFor(journal)) {
      return { accepted: false, reason: "aucun duel en préparation" };
    }
    if (!isDuelFighter(fighter, player.id)) {
      failDuelSetup("combattant illisible");
      return { accepted: false, reason: "combattant illisible" };
    }
    player.completedFighter = fighter;
    return { accepted: true };
  }

  /**
   * Verrouille l'attaque d'un joueur, et part quand les deux ont choisi.
   *
   * Le choix ne quitte pas cette page : il est gardé jusqu'à ce que l'autre
   * moitié ait choisi à son tour, et les deux attaques ne partent alors que dans
   * le même message.
   *
   * @param {"j1" | "j2"} playerId - Joueur qui a touché une attaque
   * @param {number} moveIndex - Position de l'attaque dans son menu
   * @returns {{ accepted: boolean, reason?: string }}
   */
  function chooseMove(playerId, moveIndex) {
    return chooseDuelCommand(playerId, { type: "fight", moveIndex });
  }

  function chooseDuelCommand(playerId, command) {
    if (duelSession === null) {
      return { accepted: false, reason: "aucun duel en cours" };
    }
    const locked = lockDuelChoice(duelSession, playerId, command);
    if (!locked.accepted) {
      return { accepted: false, reason: locked.reason };
    }
    duelSession = locked.session;
    renderDashboard();
    if (!locked.readyToResolve) {
      return { accepted: true };
    }
    return sendDuelTurn();
  }

  function handleDuelChoice(player, message) {
    const validTurnId = Number.isInteger(message.turnId) && message.turnId >= 1;
    const duelId = typeof message.duelId === "string" ? message.duelId : duelSession?.duelId;
    const turnId = validTurnId ? message.turnId : (duelSession?.turn ?? 1);
    let result = { accepted: false, reason: "choix illisible" };

    if (duelSession === null) {
      result.reason = "aucun duel en cours";
    } else if (message.duelId !== duelSession.duelId) {
      result.reason = "choix d'un autre duel";
    } else if (validTurnId && message.turnId === duelSession.turn) {
      if (isDuelCommand(message.command)) {
        result = chooseDuelCommand(player.id, message.command);
      } else {
        result.reason = "commande illisible";
      }
    } else {
      result.reason = "choix d'un autre tour";
    }

    if (typeof duelId === "string" && Number.isInteger(turnId) && turnId >= 1) {
      postTo(player, "shell/duel-choice-status", {
        duelId,
        turnId,
        choiceAccepted: result.accepted,
        ...(result.reason === undefined ? {} : { reason: result.reason }),
      });
    }
    if (!result.accepted) {
      console.warn("Coque 2P : choix de duel refusé", player.id, result.reason);
    }
  }

  /** Envoie le tour aux deux cadres : c'est là que les deux choix se rencontrent. */
  function sendDuelTurn() {
    const opened = openDuelTurn(duelSession);
    if (!opened.accepted) {
      return { accepted: false, reason: opened.reason };
    }
    duelSession = opened.session;
    const { duelId, turnId, commands } = opened.sender;
    for (const player of players) {
      postTo(player, "shell/duel-turn", { duelId, turnId, commands });
    }
    armDuelWatchdog(`aucun accord sur le tour ${turnId}`);
    renderDashboard();
    return { accepted: true };
  }

  /**
   * Rapport d'un cadre sur le tour en cours.
   *
   * Le tour n'est appliqué que si les deux empreintes concordent : autrement,
   * c'est un duel cassé, et un duel cassé ne crédite personne.
   *
   * @param {object} player - Moitié émettrice
   * @param {object} message - Rapport reçu (tour, empreinte, vue, attaques)
   * @returns {{ accepted: boolean, agreed?: boolean, reason?: string }}
   */
  function receiveDuelState(player, message) {
    if (player === null) {
      return { accepted: false, reason: "joueur inconnu" };
    }
    if (duelSession === null) {
      return { accepted: false, reason: "aucun duel en cours" };
    }
    const result = acceptDuelReport(duelSession, player.id, message);
    if (!result.accepted) {
      return { accepted: false, reason: result.reason };
    }
    duelSession = result.session;
    if (result.mismatch === true) {
      abortLiveDuel(result.reason);
      return { accepted: true, agreed: false };
    }
    if (result.agreed !== true) {
      // Un seul camp a répondu : le garde-fou reste armé, son partenaire peut
      // encore manquer à l'appel.
      renderDuel();
      return { accepted: true, agreed: false };
    }
    disarmDuelWatchdog();
    renderDuel();
    if (result.finished === true) {
      // Le duel est fini : le dernier tour s'affiche, puis la table se retire et
      // le coordinateur crédite le point.
      holdDuelResult();
      return { accepted: true, agreed: true, finished: true };
    }
    return { accepted: true, agreed: true };
  }

  /** Laisse le dernier tour à l'écran, puis règle le duel. */
  function holdDuelResult() {
    if (duelResultTimer !== null) {
      window.clearTimeout(duelResultTimer);
    }
    duelResultTimer = window.setTimeout(() => {
      duelResultTimer = null;
      settleLiveDuel();
    }, DUEL_RESULT_MS);
  }

  /**
   * Clôt le duel sur ce que les deux camps ont accepté : le coordinateur crédite
   * le point, et libère les deux joueurs pour le bloc suivant.
   */
  function settleLiveDuel() {
    const finished = duelSession;
    disarmDuelWatchdog();
    disarmDuelResult();
    duelSession = null;
    duelSetup = null;
    duelFailure = null;
    duelRetryNeeded = false;
    showDuelField();
    const winner = finished === null || finished.winner === null ? "draw" : finished.winner;
    const finalMatchDuel = journal !== null && !journal.onDemand && journal.block >= journal.rules.blocks;
    const scoredFreeDuel = journal !== null && journal.onDemand && journal.scoreOnDemand;
    finalResultSummary = finalMatchDuel || scoredFreeDuel ? summarizeFinalDuel(winner, scoredFreeDuel) : null;
    duelResult(finished === null ? "" : finished.duelId, winner);
    renderDashboard();
  }

  /**
   * Interrompt un duel engagé : personne ne marque, et l'instantané est rejoué.
   *
   * C'est la sortie de secours d'un duel qui ne peut plus être résolu par les
   * deux camps (désaccord, cadre redémarré, tour sans réponse). Elle ne crédite
   * jamais de point : le prix de n'avoir jamais deux vérités.
   *
   * @param {string} reason - Ce qui a cassé, écrit dans la console de la coque
   */
  function abortLiveDuel(reason) {
    console.warn("Coque 2P : duel interrompu", reason);
    const duelId = duelSession === null ? null : duelSession.duelId;
    disarmDuelWatchdog();
    disarmDuelResult();
    duelSession = null;
    duelSetup = null;
    duelFailure = reason;
    duelRetryNeeded = true;
    if (duelId !== null) {
      for (const player of players) {
        postTo(player, "shell/duel-abort", { duelId });
      }
    }
    showDuelField();
    for (const player of players) {
      player.completedFighter = null;
    }
    if (duelId !== null && journal !== null && journal.phase === "DUEL") {
      journal = saveJournal(localStorage, resumeJournal(journal, Date.now()), { commit: true });
      for (const player of players) {
        player.duelReady = false;
        player.duelChecksum = null;
        player.fighter = null;
        player.fighters = null;
      }
    }
    renderDashboard();
  }

  /**
   * Le duel ne s'ouvrira pas : les joueurs doivent pouvoir en sortir.
   *
   * @param {string} reason - Ce qui a manqué
   */
  function failDuelSetup(reason) {
    console.warn("Coque 2P : duel abandonné avant d'être joué", reason);
    disarmDuelWatchdog();
    duelSetup = null;
    duelFailure = reason;
    duelRetryNeeded = false;
    for (const player of players) {
      player.completedFighter = null;
    }
    renderDashboard();
  }

  /**
   * Règle la manche due faute de duel jouable.
   *
   * Sortie de secours, et assumée comme telle : la manche est comptée **nulle**
   * — aucun point n'est crédité — et le bloc suivant commence. Elle n'est
   * proposée que lorsque le jeu n'a pas pu matérialiser un combattant ; un duel
   * qui se joue la rend invisible.
   */
  function settleDuelAsDraw() {
    if (journal === null || journal.phase !== "PREPARE") {
      return { accepted: false, reason: "aucun duel à jouer" };
    }
    const duelId = duelIdFor(journal);
    const opened = duelStarted(duelId);
    if (!opened.accepted) {
      return opened;
    }
    const result = duelResult(duelId, "draw");
    if (result.accepted) {
      duelFailure = null;
    }
    return result;
  }

  /** Rebuild both halves from the frozen snapshot after a technical interruption. */
  function retryInterruptedDuel() {
    if (!duelRetryNeeded || journal?.phase !== "PREPARE") {
      return { accepted: false, reason: "aucun duel à rejouer" };
    }
    duelRetryNeeded = false;
    duelFailure = null;
    for (const player of players) {
      player.duelReady = false;
      player.completedFighter = null;
    }
    const sent = requestDuelTeams();
    renderDashboard();
    return { accepted: sent };
  }

  /**
   * Arme le garde-fou d'un échange attendu.
   *
   * @param {string} reason - Ce qu'un silence prolongé voudra dire
   */
  function armDuelWatchdog(reason) {
    disarmDuelWatchdog();
    duelWatchdog = window.setTimeout(() => {
      duelWatchdog = null;
      if (duelSession === null) {
        failDuelSetup(reason);
      } else {
        abortLiveDuel(reason);
      }
    }, DUEL_WATCHDOG_MS);
  }

  function disarmDuelWatchdog() {
    if (duelWatchdog !== null) {
      window.clearTimeout(duelWatchdog);
      duelWatchdog = null;
    }
  }

  function disarmDuelResult() {
    if (duelResultTimer !== null) {
      window.clearTimeout(duelResultTimer);
      duelResultTimer = null;
    }
  }

  /** Les cadres restent visibles : chacun rend le duel dans son canvas Phaser. */
  function showDuelField() {
    for (const player of players) {
      // Le combat se joue dans le canvas Phaser d'origine de chaque cadre.
      // La coque n'affiche aucun panneau de combat parallèle.
      player.frame.hidden = false;
      duelPanels[player.id].root.hidden = true;
    }
  }

  /** Rien à peindre dans la coque : le jeu dessine le terrain et ses menus. */
  function renderDuel() {}

  // ------------------------------------------------------------- séquence

  /** Prépare l'arène et charge les deux cadres pour le run donné. */
  function openArena(rules, id) {
    matchRules = rules;
    matchId = id;
    paused = false;
    duelRetryNeeded = false;
    quickGenerationPendingFor = null;
    finalResultSummary = null;
    resultScreen.hidden = true;
    pendingProfileBattles.j1 = [];
    pendingProfileBattles.j2 = [];
    pauseButton.textContent = "Pause";

    for (const player of players) {
      player.state = "idle";
      renderState(player);
      player.frame.src = `../index.html?player=${player.id}&profile=${activeProfileId(localStorage, player.id)}`;
    }

    home.hidden = true;
    arena.hidden = false;
    applyViewportHeight();
    renderDashboard();
  }

  function startMatch() {
    const rules = rulesFromFields();
    saveRules(rules);
    const id = `m-${Date.now().toString(36)}`;
    if (rules.mode === "blocks") {
      journal = saveJournal(localStorage, newJournal(rules, id, Date.now()), { commit: true });
    } else if (rules.mode === "quick-random") {
      const fresh = newJournal(
        {
          ...rules,
          mode: "blocks",
          blockSize: 2,
          blocks: 1,
          bankRenforts: 0,
          levelCap: "none",
          duelOnDemand: false,
        },
        id,
        Date.now(),
      );
      const playersState = Object.fromEntries(
        ["j1", "j2"].map(playerId => [
          playerId,
          {
            ...fresh.players[playerId],
            atBoundary: true,
          },
        ]),
      );
      const quick = readQuickSettings();
      const quickBattle = {
        ...quick,
        seed: (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0,
      };
      journal = saveJournal(
        localStorage,
        {
          ...fresh,
          players: playersState,
          phase: "PREPARE",
          quickBattle,
        },
        { commit: true },
      );
    } else {
      // En duo libre, aucun compteur n'est tenu : il n'y a pas de match à suivre.
      clearJournal(localStorage);
      journal = null;
    }
    openArena(rules, id);
  }

  /** Schedules a scored duel at the next safe boundary of both free runs. */
  function requestFreeDuel() {
    if (
      journal !== null
      || duelSession !== null
      || matchRules.mode !== "side-by-side"
      || !matchRules.duelOnDemand
      || !players.every(player => player.state === "ready")
    ) {
      return false;
    }
    const rules = { ...matchRules, mode: "blocks", blockSize: 2, blocks: 1 };
    const id = `${matchId}-free-${Date.now().toString(36)}`;
    const fresh = newJournal(rules, id, Date.now());
    const playersState = Object.fromEntries(
      ["j1", "j2"].map(playerId => [
        playerId,
        {
          ...fresh.players[playerId],
          atBoundary: true,
        },
      ]),
    );
    journal = saveJournal(
      localStorage,
      {
        ...fresh,
        players: playersState,
        phase: "PREPARE",
        onDemand: true,
        scoreOnDemand: true,
        baseRules: matchRules,
      },
      { commit: true },
    );
    for (const player of players) {
      player.armed = true;
      postTo(player, "shell/wait-for-duel");
    }
    renderDashboard();
    return true;
  }

  /** Cancels a free-mode duel and resumes both independent runs. */
  function cancelFreeDuel() {
    if (!journal?.onDemand) {
      return false;
    }
    disarmDuelWatchdog();
    disarmDuelResult();
    duelSession = null;
    duelSetup = null;
    duelFailure = null;
    duelRetryNeeded = false;
    showDuelField();
    for (const player of players) {
      reinforcementPanels[player.id].root.hidden = true;
    }
    releasePlayers();
    clearJournal(localStorage);
    journal = null;
    renderDashboard();
    return true;
  }

  /**
   * Reprend le match trouvé dans le stockage.
   *
   * Les deux runs repartent de leurs propres sauvegardes ; seul l'avancement du
   * match vient du journal, remis d'aplomb par `resumeJournal` (un duel
   * interrompu revient à sa préparation, sans compter de point).
   */
  function resumeMatch() {
    const { state } = loadJournal(localStorage);
    if (state === null) {
      return false;
    }
    journal = saveJournal(localStorage, resumeJournal(state, Date.now()));
    const rules = journal.quickBattle
      ? { ...journal.rules, mode: "quick-random" }
      : journal.onDemand
        ? (journal.baseRules ?? { ...journal.rules, mode: "side-by-side" })
        : journal.rules;
    if (journal.quickBattle) {
      applyQuickSettings(journal.quickBattle);
    }
    saveRules(rules);
    openArena(rules, journal.matchId);
    return true;
  }

  /** Le journal du stockage, relu à l'ouverture de la page. */
  function storedJournal() {
    return loadJournal(localStorage).state;
  }

  function renderResume() {
    const state = storedJournal();
    if (state === null || state.phase === "FINI") {
      resumeButton.hidden = true;
      return;
    }
    if (state.onDemand) {
      resumeButton.hidden = false;
      resumeButton.textContent = t("resumeMatch");
      return;
    }
    if (state.quickBattle) {
      resumeButton.hidden = false;
      resumeButton.textContent = t("resumeMatch");
      return;
    }
    if (state.rules.mode !== "blocks") {
      resumeButton.hidden = true;
      return;
    }
    const progress = playerProgress(state, "j1");
    const score = matchScore(state);
    resumeButton.hidden = false;
    resumeButton.textContent = `${t("resumeMatch")} · ${progress.block}/${progress.totalBlocks} · ${score.j1}–${score.j2}`;
  }

  function setPaused(next) {
    paused = next;
    pauseButton.textContent = paused ? "Reprendre" : "Pause";
    broadcast(paused ? "shell/pause" : "shell/resume");
    // La coque ne suppose pas l'état d'un cadre : il l'annonce lui-même.
    for (const player of players) {
      player.state = paused ? "paused" : "ready";
      renderState(player);
    }
  }

  function quitMatch() {
    broadcast("shell/pause");
    // Le duel meurt avec le match : ni tour en attente, ni garde-fou armé.
    disarmDuelWatchdog();
    disarmDuelResult();
    duelSession = null;
    duelSetup = null;
    duelFailure = null;
    duelRetryNeeded = false;
    quickGenerationPendingFor = null;
    finalResultSummary = null;
    resultScreen.hidden = true;
    showDuelField();
    for (const player of players) {
      player.frame.src = "about:blank";
      player.state = "idle";
      renderState(player);
    }
    matchId = null;
    paused = false;
    pauseButton.textContent = "Pause";
    for (const player of players) {
      player.armed = false;
      player.parked = false;
      player.duelId = null;
      player.duelReady = false;
      player.duelChecksum = null;
      player.fighter = null;
      player.fighters = null;
      player.completedFighter = null;
    }
    arena.hidden = true;
    home.hidden = false;
    // Quitter abandonne le match : le journal ne doit pas proposer de le reprendre.
    clearJournal(localStorage);
    journal = null;
    applyRules(matchRules);
    renderDashboard();
    renderResume();
    renderProfile("j1");
    renderProfile("j2");
    applyViewportHeight();
  }

  function updateRotateHint() {
    rotateHint.hidden = !window.matchMedia("(orientation: landscape)").matches;
  }

  // -------------------------------------------------------------- écoute

  window.addEventListener("message", event => {
    if (event.origin !== window.location.origin) {
      return;
    }
    const player = playerOf(event.source);
    if (!player || !isFrameMessage(event.data)) {
      return;
    }
    if (matchId !== null && event.data.matchId !== undefined && event.data.matchId !== matchId) {
      return; // message d'un run précédent
    }

    player.lastReply = event.data.type;

    switch (event.data.type) {
      case "frame/ready":
        player.state = stateAfter(event.data.type);
        sendRules(player);
        if (duelSession !== null) {
          // Un cadre rechargé au milieu du duel a perdu son état : les deux
          // moitiés ne peuvent plus s'accorder, et la coque ne joue pas un duel
          // qu'une seule moitié saurait résoudre. La manche est nulle.
          abortLiveDuel("un cadre a redémarré pendant le duel");
          break;
        }
        // Un cadre qui vient de se charger a perdu son arrêt : s'il attendait le
        // duel, il doit réapprendre à s'arrêter.
        parkPlayerIfAtBoundary(player.id);
        requestQuickTeamGeneration(playerById("j1"));
        // Il a aussi perdu son duel : l'instantané est dans le journal, donc le
        // duel se reconstruit à l'identique, sans rien redemander aux joueurs.
        syncDuelPreparation(player);
        advanceDuelSetup();
        break;
      case "frame/pve-battle-won":
        // Seule une session peut annoncer sa propre victoire : la source du
        // message est vérifiée plus haut, et le coordinateur borne le reste.
        battleWon(player.id, event.data.battleId, event.data.wave);
        break;
      case "frame/pve-saved":
        saved(player.id, event.data.saveSeq);
        // Les deux sauvegardes accusées ouvrent la préparation : les cadres
        // figent leur équipe de run, la coque garde les deux instantanés.
        requestDuelTeams();
        break;
      case "frame/duel-team":
        receiveDuelTeam(player, event.data.duelTeam);
        // La seconde équipe qui arrive rend le duel préparable : la coque
        // renvoie alors le duel figé, plafond compris, aux deux cadres.
        requestDuelTeams();
        break;
      case "frame/quick-teams":
        receiveQuickTeams(player, event.data.duelId, event.data.quickTeams);
        break;
      case "frame/duel-options":
        receiveReinforcementOptions(player, event.data.options);
        break;
      case "frame/duel-ready":
        duelReady(player, event.data.checksum, event.data.fighter, event.data.fighters);
        // Les deux moitiés prêtes, on leur fait croiser leurs types : c'est le
        // seul pas qui ne peut pas être fait d'un côté seulement.
        advanceDuelSetup();
        break;
      case "frame/duel-fighter":
        receiveDuelFighter(player, event.data.fighter);
        advanceDuelSetup();
        break;
      case "frame/duel-state":
        receiveDuelState(player, event.data);
        break;
      case "frame/duel-choice":
        handleDuelChoice(player, event.data);
        break;
      case "frame/duel-error":
        if (
          duelSession !== null
          && event.data.duelId === duelSession.duelId
          && event.data.turnId === duelSession.awaiting
          && typeof event.data.reason === "string"
        ) {
          abortLiveDuel(`${player.id.toUpperCase()} : ${event.data.reason.slice(0, 240)}`);
        }
        break;
      case "frame/duel-waiting":
        // Le jeu est vraiment arrêté, récompense prise et sauvegarde écrite.
        player.parked = true;
        if (journal?.onDemand) {
          requestDuelTeams();
        }
        break;
      default:
        player.state = stateAfter(event.data.type);
        break;
    }
    renderState(player);
    // Un accusé d'arrêt change ce que lit le joueur : le bandeau suit.
    renderDashboard();
  });

  function isDuelCommand(command) {
    return (
      command !== null
      && typeof command === "object"
      && ((command.type === "fight"
        && Number.isInteger(command.moveIndex)
        && command.moveIndex >= 0
        && command.moveIndex < 4)
        || (command.type === "switch"
          && Number.isInteger(command.benchIndex)
          && command.benchIndex >= 0
          && command.benchIndex < 6)
        || command.type === "struggle")
    );
  }

  /** État affiché d'un cadre après un de ses messages. */
  function stateAfter(type) {
    if (type === "frame/paused") {
      return "paused";
    }
    // Un cadre prêt ou repris reste en pause tant que la pause commune dure.
    return paused ? "paused" : "ready";
  }

  // Tout relâchement doit libérer les touches : Android peut suspendre la page
  // (arrière-plan, rotation, changement de configuration) sans préavis.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      broadcast("shell/release-inputs");
    }
  });
  window.addEventListener("blur", () => broadcast("shell/release-inputs"));

  pauseButton.addEventListener("click", () => setPaused(!paused));
  quitButton.addEventListener("click", quitMatch);
  document.getElementById("result-home").addEventListener("click", () => {
    if (finalResultSummary?.returnToRuns) {
      finalResultSummary = null;
      resultScreen.hidden = true;
      renderDashboard();
      return;
    }
    quitMatch();
  });
  resumeButton.addEventListener("click", resumeMatch);
  duelButton.addEventListener("click", () =>
    journal === null
      ? requestFreeDuel()
      : duelRetryNeeded
        ? retryInterruptedDuel()
        : journal.onDemand
          ? cancelFreeDuel()
          : settleDuelAsDraw(),
  );
  readyButtons.j2.addEventListener("click", () => agree("j2"));
  readyButtons.j1.addEventListener("click", () => agree("j1"));
  for (const player of players) {
    reinforcementPanels[player.id].submit.addEventListener("click", () => submitReinforcements(player));
  }
  fields.mode.addEventListener("pointerdown", prepareModeDropdown);
  fields.mode.addEventListener("focus", prepareModeDropdown);
  shellLanguageSelect.addEventListener("pointerdown", prepareModeDropdown);
  shellLanguageSelect.addEventListener("focus", prepareModeDropdown);
  shellLanguageSelect.addEventListener("change", () => {
    shellI18n.setLanguage(shellLanguageSelect.value);
    refreshLanguageDependentContent();
  });
  for (const key of ["quickTeamMode", "quickLevelMode", "quickLevel"]) {
    fields[key].addEventListener("pointerdown", prepareModeDropdown);
    fields[key].addEventListener("focus", prepareModeDropdown);
  }
  for (const playerId of ["j1", "j2"]) {
    const elements = profileElements[playerId];
    const canChangeProfile = () => {
      const pending = storedJournal();
      if (pending !== null && pending.phase !== "FINI") {
        elements.message.textContent = t("profileBlocked");
        return false;
      }
      return true;
    };
    elements.toggle.addEventListener("click", () => {
      fields.mode.blur();
      closeProfileMenus(elements.card);
      for (const otherElements of Object.values(profileElements)) {
        if (otherElements !== elements) {
          otherElements.select.blur();
        }
      }
      elements.card.hidden = !elements.card.hidden;
      if (elements.card.hidden) {
        resetDeleteConfirmation(elements);
      } else {
        resetDeleteConfirmation(elements);
        renderProfile(playerId);
      }
    });
    elements.select.addEventListener("pointerdown", () => prepareProfileDropdown(elements));
    elements.select.addEventListener("focus", () => prepareProfileDropdown(elements));
    elements.save.addEventListener("click", () => {
      resetDeleteConfirmation(elements);
      const saved = customizeProfile(
        localStorage,
        playerId,
        elements.name.value,
        elements.avatar.value,
        elements.color.value,
      );
      elements.message.textContent = saved ? t("profileSaved") : t("enterName");
      renderProfile(playerId);
      renderProfile(playerId === "j1" ? "j2" : "j1");
    });
    elements.create.addEventListener("click", () => {
      if (!canChangeProfile()) {
        return;
      }
      resetDeleteConfirmation(elements);
      if (!createProfile(localStorage, playerId, elements.name.value)) {
        elements.message.textContent = t("enterName");
        return;
      }
      customizeProfile(localStorage, playerId, elements.name.value, elements.avatar.value, elements.color.value);
      agreed.j1 = false;
      agreed.j2 = false;
      elements.message.textContent = t("profileCreated");
      renderProfile("j1");
      renderProfile("j2");
      renderAgreement();
    });
    elements.remove.addEventListener("click", () => {
      if (!canChangeProfile()) {
        return;
      }
      resetDeleteConfirmation(elements);
      const targetId = activeProfileId(localStorage, playerId);
      const otherPlayer = playerId === "j1" ? "j2" : "j1";
      if (targetId === activeProfileId(localStorage, otherPlayer)) {
        elements.message.textContent = t("profileUsed");
        return;
      }
      const profile = readProfile(localStorage, playerId);
      elements.deleteTarget = targetId;
      elements.deleteStage = 1;
      elements.deleteConfirmation.hidden = false;
      elements.deleteMessage.textContent = t("deleteAskFirst", { avatar: profile.avatar, name: profile.displayName });
      elements.deleteConfirm.textContent = t("deleteButtonFirst");
      elements.message.textContent = "";
    });
    elements.deleteConfirm.addEventListener("click", () => {
      if (!canChangeProfile()) {
        resetDeleteConfirmation(elements);
        return;
      }
      const targetId = elements.deleteTarget;
      const otherPlayer = playerId === "j1" ? "j2" : "j1";
      if (
        targetId === null
        || targetId !== activeProfileId(localStorage, playerId)
        || targetId === activeProfileId(localStorage, otherPlayer)
      ) {
        resetDeleteConfirmation(elements);
        elements.message.textContent = t("profileChanged");
        return;
      }
      if (elements.deleteStage === 1) {
        const profile = readProfile(localStorage, playerId);
        elements.deleteStage = 2;
        elements.deleteMessage.textContent = t("deleteAskSecond", {
          avatar: profile.avatar,
          name: profile.displayName,
        });
        elements.deleteConfirm.textContent = t("deleteButtonSecond");
        return;
      }
      if (elements.deleteStage !== 2 || !deleteProfile(localStorage, playerId, targetId)) {
        resetDeleteConfirmation(elements);
        elements.message.textContent = t("deleteFailed");
        return;
      }
      resetDeleteConfirmation(elements);
      agreed.j1 = false;
      agreed.j2 = false;
      renderProfile("j1");
      renderProfile("j2");
      elements.message.textContent = t("profileDeleted");
      renderAgreement();
    });
    elements.deleteCancel.addEventListener("click", () => {
      resetDeleteConfirmation(elements);
      elements.message.textContent = t("profileCancelled");
    });
    elements.select.addEventListener("change", () => {
      resetDeleteConfirmation(elements);
      if (!canChangeProfile() || !selectProfile(localStorage, playerId, elements.select.value)) {
        renderProfile(playerId);
        return;
      }
      agreed.j1 = false;
      agreed.j2 = false;
      elements.message.textContent = t("profileLoaded");
      renderProfile("j1");
      renderProfile("j2");
      renderAgreement();
    });
  }
  for (const field of Object.values(fields)) {
    field.addEventListener("change", () => applyRules(rulesFromFields()));
  }
  window.addEventListener("resize", applyViewportHeight);
  window.visualViewport?.addEventListener("resize", applyViewportHeight);
  window.addEventListener("orientationchange", updateRotateHint);

  /**
   * Le formulaire doit représenter fidèlement les règles stockées : sans ce
   * contrôle, une valeur perdue par un `<select>` ne se verrait qu'au premier
   * duel, une fois le match lancé.
   */
  function assertRoundTrip(rules) {
    const read = rulesFromFields();
    if (JSON.stringify(read) !== JSON.stringify(rules)) {
      console.warn("Coque 2P : le formulaire ne reflète pas les règles stockées", { stored: rules, form: read });
    }
  }

  const storedRules = loadRules();
  applyQuickSettings(quickSettings);
  renderProfile("j1");
  renderProfile("j2");
  applyRules(storedRules, { resetAgreement: true });
  assertRoundTrip(storedRules);
  renderResume();
  applyViewportHeight();
  updateRotateHint();

  // Point d'observation et de pilotage pour les tests automatisés de la coque.
  window.__shell = {
    state: () => ({
      matchId,
      paused,
      rules: rulesFromFields(),
      schedule: scheduleOf(rulesFromFields()),
      recap: recapText(rulesFromFields()),
      agreed: { ...agreed },
      journal,
      dashboard: { j1: progressText("j1"), j2: progressText("j2") },
      parking: Object.fromEntries(
        players.map(player => [
          player.id,
          { armed: player.armed, parked: player.parked, wait: player.wait.textContent, hidden: player.wait.hidden },
        ]),
      ),
      duelDue: duelButton.hidden === false,
      duel: {
        id: journal === null ? null : duelIdFor(journal),
        prepared: journal === null ? false : duelPrepared(journal),
        cap: journal === null ? null : duelCapOf(journal),
        snapshots: Object.fromEntries(
          players.map(player => [player.id, journal === null ? null : journal.duelTeams[player.id]]),
        ),
        ready: Object.fromEntries(players.map(player => [player.id, player.duelReady])),
        checksums: Object.fromEntries(players.map(player => [player.id, player.duelChecksum])),
        text: duelText(),
      },
      progress:
        journal === null
          ? null
          : { j1: playerProgress(journal, "j1"), j2: playerProgress(journal, "j2"), needed: battlesNeeded(journal) },
      duelLive:
        duelSession === null
          ? null
          : {
              turn: duelSession.turn,
              awaiting: duelSession.awaiting,
              locked: { j1: duelSession.pending.j1 !== null, j2: duelSession.pending.j2 !== null },
              finished: duelSession.finished,
              winner: duelSession.winner,
              log: [...duelSession.log],
              panel: { j1: !duelPanels.j1.root.hidden, j2: !duelPanels.j2.root.hidden },
              frame: { j1: !playerById("j1").frame.hidden, j2: !playerById("j2").frame.hidden },
            },
      duelFailure,
      players: players.map(player => ({
        id: player.id,
        state: player.state,
        lastReply: player.lastReply,
        src: player.frame.getAttribute("src"),
        duelReady: player.duelReady,
        fighter: player.fighter !== null,
        completedFighter: player.completedFighter !== null,
      })),
    }),
    /** Applique une configuration comme le ferait J1 dans ses menus. */
    configure: patch => applyRules(normalizeRules({ ...rulesFromFields(), ...patch })),
    agree,
    start: startMatch,
    resume: resumeMatch,
    quit: quitMatch,
    pause: setPaused,
    history: () => readHistory(),
    /** Sortie de secours : règle nulle une manche impossible à matérialiser. */
    settleDuel: settleDuelAsDraw,
    /** Les faits du match, tels que les cadres les annonceront (protocole v2). */
    coordinator: {
      battleWon,
      saved,
      duelStarted,
      duelTeam: receiveDuelTeam,
      duelReady,
      duelResult,
      extraRound,
      journal: () => journal,
    },
    /** Les deux temps de la préparation du duel, comme les cadres les vivent. */
    duel: {
      request: requestDuelTeams,
      receive: (playerId, payload) => receiveDuelTeam(playerById(playerId), payload),
      reportReady: (playerId, checksum, fighter) => duelReady(playerById(playerId), checksum, fighter),
      prepared: () => journal !== null && duelPrepared(journal),
      cap: () => (journal === null ? null : duelCapOf(journal)),
      id: () => (journal === null ? null : duelIdFor(journal)),
      // Le duel vivant : ce que la coque affiche, et les gestes d'un joueur.
      advance: advanceDuelSetup,
      fighter: (playerId, fighter) => receiveDuelFighter(playerById(playerId), fighter),
      report: (playerId, message) => receiveDuelState(playerById(playerId), message),
      choose: chooseMove,
      abort: abortLiveDuel,
      session: () => duelSession,
      setup: () => duelSetup,
      failure: () => duelFailure,
      stuck: duelStuck,
      display: playerId => (duelSession === null ? null : duelDisplayFor(duelSession, playerId)),
    },
  };
})();
