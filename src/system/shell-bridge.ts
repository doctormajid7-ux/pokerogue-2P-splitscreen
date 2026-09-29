/*
 * SPDX-FileCopyrightText: 2026 Pagefault Games
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { globalScene } from "#app/global-scene";
import { speciesDataRegistry } from "#app/global-species-data-registry";
import type { Gender } from "#data/gender";
import { CustomPokemonData } from "#data/pokemon-data";
import { getTypeDamageMultiplier } from "#data/type";
import type { PokemonType } from "#enums/pokemon-type";
import type { PlayerPokemon } from "#field/pokemon";
import { PokemonMove } from "#moves/pokemon-move";
import type { Variant } from "#sprites/variant";
import type { DuelCommand, DuelFighter, DuelSide, DuelState } from "#system/duel-engine";
import { createDuel, duelBenchFor, duelMovesFor, duelPublicState, lockCommand, resolveTurn } from "#system/duel-engine";
import { resolveDuelTurn } from "#system/duel-mechanics";
import { DuelPark } from "#system/duel-park";
import {
  advanceDuelPresentation,
  beginDuelPresentation,
  endDuelPresentation,
  rejectDuelChoice,
} from "#system/duel-presentation";
import type { BankEntryV1, DuelMemberData, DuelPlayerId, ReinforcementChoice } from "#system/duel-snapshot";
import {
  applyLevelCap,
  applyReinforcements,
  captureMember,
  captureTeam,
  contentChecksum,
  copyTeam,
  DUEL_PLAYER_IDS,
  isBankEntry,
  makeTeamPayload,
} from "#system/duel-snapshot";
import type { MatchRulesV1 } from "#system/match-rules";
import { playerStorage, scopeFromQuery } from "#system/player-storage";
import { PokemonData } from "#system/pokemon-data";
import type { DuelTeamsMessage, QuickBattleConfig } from "#system/shell-protocol";
import {
  battleWonMessage,
  duelFighterMessage,
  duelReadyMessage,
  duelStateMessage,
  duelTeamMessage,
  duelWaitingMessage,
  frameMessage,
  isShellMessage,
  savedMessage,
} from "#system/shell-protocol";
import type Phaser from "phaser";

/** Storage key of the battle counter, inside the player's own scope. */
const BATTLE_SEQ_KEY = "2pBattleSeq";

/** Storage key of the save counter, inside the player's own scope. */
const SAVE_SEQ_KEY = "2pSaveSeq";

/**
 * Storage key of the player's profile, inside their own scope.
 *
 * Its `bank` is populated by confirmed captures in this player's run.
 */
const PROFILE_KEY = "profile/v1";

/** Rules the shell handed this frame, or `null` when it is not coordinated. */
let matchRules: MatchRulesV1 | null = null;

/** Match being played, echoed in every report so a stale frame stays silent. */
let matchId: string | undefined;

/** The running game, `null` until the bridge is initialized. */
let gameRef: Phaser.Game | null = null;

/**
 * Waiting state of a player who reached the block boundary.
 *
 * A stopped frame keeps its own state on purpose: the shared pause of the shell
 * (`shell/pause` / `shell/resume`) must not be able to release it, otherwise the
 * player would resume a block the coordinator has already closed.
 */
const duelPark = new DuelPark();

/**
 * Team this frame froze at the block boundary, before the level cap is known.
 * Kept so a `shell/duel-prepare` arriving after a reload can still apply the
 * cap to what the shell froze, rather than to a party that moved on since.
 */
let pendingDuelTeam: { duelId: string; members: DuelMemberData[] } | null = null;

/** Level the shell announced for that duel; `null` when the rules ask for none. */
let pendingDuelCap: number | null = null;
let pendingBankRenforts = 0;

/** Team this frame will play: capped, reinforced, and fingerprinted. */
let preparedDuelTeam: { duelId: string; members: DuelMemberData[]; checksum: string } | null = null;

/** Numbers this frame materialized for the duel, matchup included. */
let duelFighter: DuelFighter | null = null;
let duelFighters: DuelFighter[] = [];

/**
 * Duel being played, resolved by this frame.
 *
 * Both frames resolve every turn on their own, from the same seed, the same
 * fighters and the same choices: the shell applies a turn only when the two
 * fingerprints agree, so neither half can decide a duel by itself.
 */
let duelState: DuelState | null = null;

/**
 * Identifier given to a battle, kept for the life of the battle object.
 *
 * A replayed `BattleEndPhase` must report the *same* identifier, otherwise the
 * coordinator would count the same battle twice; a battle rebuilt after a
 * reload must report a *new* one, otherwise an old identifier would be refused.
 * The pair "per-object memo + counter persisted in the player's scope" gives
 * both.
 */
const battleIds = new WeakMap<object, string>();
const pendingFreeModeBattles: { battleId: string; wave: number }[] = [];

/**
 * Listens to the two-player shell when this game runs inside one of its frames,
 * and reports back what happens in this session.
 *
 * The solo game is untouched: without a parent window the bridge does nothing.
 * What the shell can ask for is deliberately narrow — freeze, unfreeze, let go
 * of held inputs, hand over the rules, park at a block boundary — because the
 * frame must not be remotely drivable beyond what the shell's own buttons do
 * (see `android/shell/2p.html`).
 *
 * @param game - The game instance created by `main.ts`
 */
export function initShellBridge(game: Phaser.Game): void {
  if (window.parent === window) {
    return; // solo: no shell to talk to
  }
  gameRef = game;

  // WebView may create an audio context for the upper iframe before the first
  // tap. Unlock it on that player's own gesture so battle effects can play even
  // though its BGM is intentionally muted in the 2P shell.
  const sound = game.sound as unknown as { unlock?: () => void; context?: AudioContext };
  let audioUnlockPending = false;
  let audioUnlocked = false;
  const removeAudioUnlockListeners = () => {
    window.removeEventListener("pointerdown", unlockAudio);
    window.removeEventListener("touchstart", unlockAudio);
  };
  const unlockAudio = () => {
    if (audioUnlocked || audioUnlockPending) {
      return;
    }
    try {
      sound.unlock?.();
      const context = sound.context;
      if (context === undefined || context.state === "running") {
        audioUnlocked = true;
        removeAudioUnlockListeners();
        return;
      }
      if (context.state !== "closed") {
        audioUnlockPending = true;
        void context.resume().then(
          () => {
            audioUnlockPending = false;
            if (context.state === "running") {
              audioUnlocked = true;
              removeAudioUnlockListeners();
            }
          },
          error => {
            audioUnlockPending = false;
            console.debug("2P audio context unlock deferred", error);
          },
        );
      }
    } catch (error) {
      console.debug("2P audio context unlock deferred", error);
    }
  };
  window.addEventListener("pointerdown", unlockAudio, { passive: true });
  window.addEventListener("touchstart", unlockAudio, { passive: true });

  window.addEventListener("message", event => {
    // Only the hosting page may drive this frame, and only on our own origin.
    if (event.origin !== window.location.origin || event.source !== window.parent) {
      return;
    }
    if (!isShellMessage(event.data)) {
      return;
    }

    switch (event.data.type) {
      case "shell/pause":
        // Nothing else stops the game loop: Phaser only pauses sound on blur.
        releaseInputs();
        game.sound.pauseAll();
        game.loop.sleep();
        reply("frame/paused");
        break;
      case "shell/resume":
        if (duelPark.isWaiting) {
          // Un joueur parqué attend le duel, pas une reprise : le réveiller ici
          // le ferait jouer un bloc déjà clos.
          break;
        }
        game.loop.wake();
        game.sound.resumeAll();
        reply("frame/resumed");
        break;
      case "shell/release-inputs":
        releaseInputs();
        break;
      case "shell/rules":
        matchId = event.data.matchId;
        matchRules = event.data.rules ?? null;
        break;
      case "shell/wait-for-duel":
        duelPark.arm();
        break;
      case "shell/continue":
        endDuelPresentation();
        releaseFromDuelPark();
        break;
      case "shell/duel-abort":
        if (event.data.duelId === duelState?.duelId) {
          duelState = null;
          endDuelPresentation();
          if (duelPark.isWaiting) {
            gameRef?.loop.sleep();
          }
        }
        break;
      case "shell/duel-invite":
        inviteToDuel(event.data.duelId as string);
        break;
      case "shell/quick-generate":
        if (playerIdOfScope() === "j1") {
          generateQuickTeams(event.data.duelId as string, event.data.quickBattle as QuickBattleConfig);
        }
        break;
      case "shell/duel-prepare":
        prepareDuel(
          event.data.duelId as string,
          event.data.cap ?? null,
          event.data.bankRenforts ?? 0,
          event.data.teams,
        );
        break;
      case "shell/duel-reinforce":
        if (event.data.duelId === pendingDuelTeam?.duelId) {
          applyReinforcementsToDuel(event.data.choices ?? [], pendingBankRenforts);
        }
        break;
      case "shell/duel-matchup":
        completeMatchup(event.data.fighter as DuelFighter | undefined, event.data.opponentTypes ?? []);
        break;
      case "shell/duel-start":
        void startDuel(event.data.duelId as string, event.data.seed ?? 0, event.data.fighters);
        break;
      case "shell/duel-turn":
        void playDuelTurn(event.data.duelId as string, event.data.turnId ?? 0, event.data.commands);
        break;
      case "shell/duel-choice-status":
        if (
          event.data.choiceAccepted === false
          && duelState !== null
          && event.data.duelId === duelState.duelId
          && event.data.turnId === duelState.turnId
        ) {
          console.warn("Duel 2P : choix non reçu par la coque", event.data.reason);
          rejectDuelChoice();
        }
        break;
      case "shell/hello":
        reply("frame/ready");
        break;
    }
  });

  // A frame that is hidden or unloaded must not keep a key pressed.
  for (const eventName of ["pagehide", "blur"]) {
    window.addEventListener(eventName, releaseInputs);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      releaseInputs();
    }
  });

  // Point d'observation pour les tests (même rôle que `window.__shell` côté
  // coque) : il conduit exactement les fonctions que le jeu appelle.
  Object.assign(window, {
    __shellEvents: {
      rules: () => matchRules,
      battleWon: notifyPveBattleWon,
      saved: notifyPveSaved,
      waiting: () => duelPark.isWaiting,
      armed: () => duelPark.isArmed,
      // Exactement ce qu'appelle la phase de rencontre, pour éprouver l'arrêt
      // sans avoir à jouer tout un bloc.
      park: holdForDuel,
      // Les deux temps du duel : l'équipe figée, puis l'équipe plafonnée que le
      // moteur du lot D jouera. `reinforce` joue le rôle du futur écran de
      // préparation (C2 livre le mécanisme, E2 le choix des entrées).
      duelTeam: () => pendingDuelTeam,
      prepared: () => preparedDuelTeam,
      reinforce: (choices: ReinforcementChoice[], bankRenforts: number) =>
        applyReinforcementsToDuel(choices, bankRenforts),
      // Le duel : le combattant matérialisé par le jeu, et l'état que ce cadre
      // résout. Les deux moitiés le calculent, la coque ne garde qu'un accord.
      fighter: () => duelFighter,
      duel: () => (duelState === null ? null : duelPublicState(duelState)),
      // Les attaques de ce cadre, telles que la coque les affichera dans **sa**
      // moitié seulement : c'est ce qui garde les choix simultanés masqués.
      moves: () => {
        const side = playerIdOfScope();
        return duelState === null || side === undefined ? null : duelMovesFor(duelState, side);
      },
      // Exactement ce que la coque envoie : les types de l'adversaire, puis
      // l'ouverture du duel, puis un tour. Les tests s'en servent en lieu et
      // place d'une vraie coque.
      matchup: (fighter: DuelFighter | undefined, opponentTypes: number[]) => completeMatchup(fighter, opponentTypes),
      open: (duelId: string, seed: number, fighters: Record<DuelSide, DuelFighter>) =>
        startDuel(duelId, seed, fighters),
      turn: (duelId: string, turnId: number, commands: Record<DuelSide, DuelCommand>) =>
        playDuelTurn(duelId, turnId, commands),
    },
  });

  reply("frame/ready");
}

/**
 * Stops the game between two battles when the shell announced a block boundary.
 *
 * Called at the point where stopping is safe: the reward is taken and the save
 * is written, the next battle has not started. Nothing is resumed until the
 * shell releases the player (`shell/continue`).
 *
 * @param resume - What to run on release; it is called then, not now
 * @returns `true` when the game must **not** continue, so the caller returns
 *   without starting the next battle
 */
export function holdForDuel(resume: () => void): boolean {
  if (!duelPark.hold(resume)) {
    return false;
  }
  releaseInputs();
  gameRef?.sound.pauseAll();
  gameRef?.loop.sleep();
  replyWaiting();
  return true;
}

/**
 * Freezes this frame's run team for the duel the shell just asked for.
 *
 * Called at the block boundary, where each player's run stops: the team is
 * copied out of the run and sent up. Nothing of the run is written, so an
 * interrupted or abandoned duel cannot touch a save.
 *
 * @param duelId - Duel the shell is preparing
 */
function inviteToDuel(duelId: string): void {
  const playerId = playerIdOfScope();
  if (playerId === undefined) {
    return; // solo or unlabelled frame: no duel to prepare
  }
  const party = globalScene?.getPlayerParty?.() ?? [];
  const members = captureTeam(
    party.map(pokemon => ({
      ...new PokemonData(pokemon),
      heldItems: pokemon.getHeldItems().map(item => {
        const count = item.getStackCount();
        return `${item.type.name}${count > 1 ? ` ×${count}` : ""}`;
      }),
    })),
  );
  if (members === null) {
    console.warn("Duel 2P : équipe de run illisible, aucun instantané envoyé", { duelId });
    return;
  }
  const payload = makeTeamPayload(playerId, duelId, members);
  if (payload === null) {
    console.warn("Duel 2P : instantané refusé par le format", { duelId });
    return;
  }
  pendingDuelTeam = { duelId, members };
  pendingDuelCap = null;
  preparedDuelTeam = null;
  window.parent.postMessage(duelTeamMessage(payload, playerStorage.prefix, matchId), window.location.origin);
}

/**
 * Generates both teams in J1's game frame, then gives the same frozen data to
 * the shell. A single generator keeps the twelve movesets identical in both
 * battle frames even though the two PvE runs have separate random seeds.
 */
function generateQuickTeams(duelId: string, config: QuickBattleConfig): void {
  if (speciesDataRegistry === undefined || globalScene === undefined) {
    return;
  }
  const random = quickRandom(config.seed);
  const candidates = speciesDataRegistry
    .getAllSpecies()
    .filter(species => species.isCatchable() && !species.isTrainerForbidden());
  if (candidates.length < 12) {
    console.warn("Duel rapide : il n'y a pas assez d'espèces valides pour générer deux équipes.");
    return;
  }

  const chosen =
    config.teamMode === "balanced"
      ? selectBalancedSpecies(candidates, random)
      : shuffle(candidates, random).slice(0, 12);
  if (chosen.length !== 12) {
    console.warn("Duel rapide : la sélection des équipes est incomplète.");
    return;
  }
  const level = config.levelMode === "fixed" ? config.level : random.int(1, 100);
  const pokemon = [] as PlayerPokemon[];
  try {
    const payloads = {} as Record<DuelPlayerId, ReturnType<typeof makeTeamPayload>>;
    for (const playerId of DUEL_PLAYER_IDS) {
      const sideIndex = playerId === "j1" ? 0 : 1;
      const team: PlayerPokemon[] = [];
      for (const species of chosen.slice(sideIndex * 6, sideIndex * 6 + 6)) {
        const member = globalScene.addPlayerPokemon(species, level);
        pokemon.push(member);
        member.generateAndPopulateMoveset();
        team.push(member);
      }
      const frozen = captureTeam(team.map(member => new PokemonData(member)));
      payloads[playerId] = frozen === null ? null : makeTeamPayload(playerId, duelId, frozen);
    }
    const j1 = payloads.j1;
    const j2 = payloads.j2;
    if (j1 === null || j2 === null) {
      console.warn("Duel rapide : une équipe générée n'a pas passé la validation.");
      return;
    }
    window.parent.postMessage(
      {
        ...frameMessage("frame/quick-teams", playerStorage.prefix, matchId),
        duelId,
        quickTeams: { j1, j2 },
      },
      window.location.origin,
    );
  } catch (error) {
    console.error("Duel rapide : génération des équipes impossible", error);
  } finally {
    for (const member of pokemon) {
      try {
        member.destroy();
      } catch (error) {
        console.warn("Duel rapide : nettoyage d'un Pokémon temporaire en échec", error);
      }
    }
  }
}

/** Six matching strength bands, with one random Pokémon per player in each. */
function selectBalancedSpecies<T extends { getBaseStatTotal: () => number }>(
  candidates: readonly T[],
  random: ReturnType<typeof quickRandom>,
): T[] {
  const ranked = shuffle([...candidates], random).sort(
    (left, right) => left.getBaseStatTotal() - right.getBaseStatTotal(),
  );
  const teams: T[] = [];
  for (let band = 0; band < 6; band++) {
    const start = Math.floor((band * ranked.length) / 6);
    const end = Math.floor(((band + 1) * ranked.length) / 6);
    const bucket = ranked.slice(start, end);
    if (bucket.length < 2) {
      return [];
    }
    const firstIndex = random.int(0, bucket.length - 1);
    const first = bucket.splice(firstIndex, 1)[0];
    if (first === undefined) {
      return [];
    }
    const nearest = bucket
      .map((species, index) => ({
        species,
        index,
        difference: Math.abs(species.getBaseStatTotal() - first.getBaseStatTotal()),
      }))
      .sort((left, right) => left.difference - right.difference);
    const closestDifference = nearest[0]?.difference;
    const ties = nearest.filter(entry => entry.difference === closestDifference);
    const opponent = ties[random.int(0, ties.length - 1)];
    if (opponent === undefined) {
      return [];
    }
    bucket.splice(opponent.index, 1);
    teams.push(first, opponent.species);
  }
  return teams;
}

/** Fisher-Yates shuffle driven by the saved quick battle seed. */
function shuffle<T>(values: T[], random: ReturnType<typeof quickRandom>): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = random.int(0, index);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function quickRandom(seed: number): { int(min: number, max: number): number } {
  let state = seed >>> 0;
  return {
    int(min, max) {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      const fraction = ((value ^ (value >>> 14)) >>> 0) / 4294967296;
      return min + Math.floor(fraction * (max - min + 1));
    },
  };
}

/**
 * Builds the team this frame will actually play, and says so.
 *
 * The shell hands back the teams it froze, plus the shared cap: the frame brings
 * the team down to that cap and then lets the bank replace a few slots. Both
 * frames doing this from the same frozen content is what makes a resumed duel
 * identical to the interrupted one — the party in the run may have moved on, and
 * it does not matter.
 *
 * @param duelId - Duel being prepared
 * @param cap - Level to bring both teams down to; `null` for none
 * @param bankRenforts - Replaceable slots allowed by the match rules
 * @param teams - The two frozen teams, ours included
 */
function prepareDuel(
  duelId: string,
  cap: number | null,
  bankRenforts: number,
  teams: DuelTeamsMessage | undefined,
): void {
  const playerId = playerIdOfScope();
  if (playerId === undefined) {
    return;
  }
  const frozen = teams?.[playerId] ?? null;
  if (frozen === null || frozen.duelId !== duelId) {
    return; // not the duel this frame froze a team for
  }
  pendingDuelTeam = { duelId, members: copyTeam(frozen.members) };
  pendingDuelCap = cap;
  pendingBankRenforts = bankRenforts;
  preparedDuelTeam = null;
  const bank = readBank();
  if (bankRenforts > 0 && bank.length > 0) {
    window.parent.postMessage(
      {
        ...frameMessage("frame/duel-options", playerStorage.prefix, matchId),
        options: {
          duelId,
          max: bankRenforts,
          team: pendingDuelTeam.members.map((member, slot) => ({
            slot,
            speciesId: member.species,
            level: member.level,
          })),
          bank: bank.map(entry => ({ entryId: entry.entryId, speciesId: entry.speciesId, level: entry.level })),
        },
      },
      window.location.origin,
    );
  } else {
    applyReinforcementsToDuel([], bankRenforts);
  }
}

/**
 * Applies the bank replacements the player picked to the capped team.
 *
 * The real picker is the preparation screen of the duel (lot D, then E2 for the
 * full bank): here the mechanism is complete — allowance from the rules, entries
 * validated one by one, copies rather than consumption — and an empty list is a
 * perfectly normal answer.
 *
 * @param choices - Slot and bank entry pairs the player picked
 * @param bankRenforts - Replaceable slots allowed by the match rules
 * @returns Whether the team is ready, and its fingerprint
 */
function applyReinforcementsToDuel(
  choices: readonly ReinforcementChoice[],
  bankRenforts: number,
): { accepted: boolean; reason?: string; checksum?: string } {
  if (pendingDuelTeam === null) {
    return { accepted: false, reason: "aucun duel à préparer" };
  }
  const capped = applyLevelCap(pendingDuelTeam.members, pendingDuelCap);
  const outcome = applyReinforcements(capped, readBank(), choices, bankRenforts);
  if (!outcome.accepted) {
    console.warn("Duel 2P : renforts refusés, équipe inchangée", outcome.reason);
    return { accepted: false, reason: outcome.reason ?? "renforts refusés" };
  }
  const finalTeam = applyLevelCap(outcome.team, pendingDuelCap);
  const checksum = contentChecksum(finalTeam);
  preparedDuelTeam = { duelId: pendingDuelTeam.duelId, members: finalTeam, checksum };
  // Le combattant voyage avec l'accusé : le jeu est le seul à savoir quelles
  // statistiques, quels types et quelles attaques découlent de cette équipe.
  const side = playerIdOfScope();
  duelFighters =
    side === undefined
      ? []
      : finalTeam
          .map(member => materializeFighter(side, [member]))
          .filter((fighter): fighter is DuelFighter => fighter !== null);
  duelFighter = duelFighters[0] ?? null;
  if (duelFighters.length !== finalTeam.length) {
    duelFighters = [];
    duelFighter = null;
  }
  window.parent.postMessage(
    duelReadyMessage(checksum, playerStorage.prefix, matchId, duelFighter ?? undefined, duelFighters),
    window.location.origin,
  );
  return { accepted: true, checksum };
}

/**
 * Materializes the fighter this frame will bring to the duel.
 *
 * The game rebuilds the member through its own path — level, IVs, nature and
 * statistics — then reads its types, its health and its moves from the game's
 * tables. The type matchups are deliberately left neutral here: they need the
 * opponent's final typing, which the shell only knows once both fighters are in.
 *
 * @param side - Side this fighter belongs to
 * @param members - The prepared team, first member first
 * @returns The fighter, or `null` when the game cannot build it
 */
function materializeFighter(side: DuelSide, members: readonly DuelMemberData[]): DuelFighter | null {
  const member = members[0];
  if (member === undefined || speciesDataRegistry === undefined) {
    return null;
  }
  const species = speciesDataRegistry.getSpecies(member.species);
  if (species === undefined) {
    return null;
  }
  let pokemon: PlayerPokemon | undefined;
  try {
    pokemon = globalScene.addPlayerPokemon(
      species,
      member.level,
      member.abilityIndex,
      member.formIndex,
      member.gender,
      member.shiny,
      // Le format d'instantané range `variant` en entier (il doit rester
      // JSON-safe) ; le jeu ne connaît que `0 | 1 | 2`. Une valeur hors bornes
      // est ramenée au palier standard plutôt que refusée : c'est un détail
      // d'apparence, et refuser un duel pour lui serait disproportionné.
      member.variant === 1 || member.variant === 2 ? (member.variant as Variant) : (0 as Variant),
      member.ivs,
      member.nature,
      undefined,
      playerPokemon => {
        playerPokemon.passive = member.passive;
      },
    );
    // Le combattant de duel n'appartient à aucun terrain : rien à afficher.
    pokemon.setVisible(false);
    pokemon.nickname = member.nickname || undefined;
    pokemon.teraType = member.teraType as PokemonType;
    pokemon.customPokemonData = new CustomPokemonData(
      (member.custom ?? undefined) as Partial<CustomPokemonData> | undefined,
    );
    if (member.fusion !== null) {
      const fusionSpecies = speciesDataRegistry.getSpecies(member.fusion.species);
      if (fusionSpecies === undefined) {
        return null;
      }
      pokemon.fusionSpecies = fusionSpecies;
      pokemon.fusionFormIndex = member.fusion.formIndex;
      pokemon.fusionAbilityIndex = member.fusion.abilityIndex;
      pokemon.fusionShiny = member.fusion.shiny;
      pokemon.fusionVariant = (
        member.fusion.variant === 1 || member.fusion.variant === 2 ? member.fusion.variant : 0
      ) as Variant;
      pokemon.fusionGender = member.fusion.gender as Gender;
      pokemon.fusionTeraType = member.fusion.teraType as PokemonType;
      pokemon.fusionCustomPokemonData = new CustomPokemonData(
        (member.fusion.custom ?? undefined) as Partial<CustomPokemonData> | undefined,
      );
      pokemon.generateName();
    }
    pokemon.moveset = member.moves.map(
      move => new PokemonMove(move.moveId, move.ppUsed, move.ppUp, move.maxPpOverride),
    );
    pokemon.calculateStats();
    const maxHp = pokemon.getMaxHp();
    pokemon.hp = maxHp;
    const moves = pokemon.moveset.map(move => {
      const data = move.getMove();
      const ppMax = move.getMovePp();
      return {
        moveId: data.id,
        name: data.name,
        type: data.type as number,
        category: data.category,
        power: data.power,
        accuracy: data.accuracy,
        priority: data.priority,
        pp: Math.max(0, ppMax - move.ppUsed),
        ppMax,
        // Rempli par `completeMatchup`, une fois les deux camps connus.
        effectiveness: 1,
      };
    });
    if (moves.length === 0) {
      return null;
    }
    return {
      side,
      species: member.species,
      name: pokemon.getNameToRender(),
      heldItems: [...(member.heldItems ?? [])],
      level: pokemon.level,
      appearance: {
        formIndex: member.formIndex,
        gender: member.gender,
        custom:
          member.custom === null
            ? null
            : { ...member.custom, ...(Array.isArray(member.custom.types) ? { types: [...member.custom.types] } : {}) },
        fusion:
          member.fusion === null
            ? null
            : {
                ...member.fusion,
                custom:
                  member.fusion.custom === null
                    ? null
                    : {
                        ...member.fusion.custom,
                        ...(Array.isArray(member.fusion.custom.types)
                          ? { types: [...member.fusion.custom.types] }
                          : {}),
                      },
              },
      },
      types: [...pokemon.getTypes({ includeTeraType: false })] as number[],
      stats: [...pokemon.stats],
      maxHp,
      hp: maxHp,
      shiny: member.shiny,
      variant: member.variant,
      moves,
    };
  } catch (error) {
    console.warn("Duel 2P : combattant impossible à construire", error);
    return null;
  } finally {
    // addPlayerPokemon crée aussi des sprites et un panneau de combat dans la
    // scène PvE. Le duel ne garde que les valeurs sérialisées ci-dessus : ces
    // objets temporaires doivent disparaître avant la reprise du run.
    if (pokemon !== undefined) {
      try {
        pokemon.destroy();
      } catch (error) {
        console.warn("Duel 2P : nettoyage du combattant temporaire en échec", error);
      }
    }
  }
}

/**
 * Completes the type matchups of a fighter with the game's own chart.
 *
 * The frame works on the copy the shell hands it rather than on what it kept: a
 * duel resumed after a reload has to be finalized without anything having been
 * materialized in this session yet, and only the game knows the type chart.
 *
 * @param fighter - The fighter to complete, as the shell holds it
 * @param opponentTypes - Types of the opponent, from its own materialization
 */
function completeMatchup(fighter: DuelFighter | undefined, opponentTypes: readonly number[]): void {
  const side = playerIdOfScope();
  if (side === undefined || fighter === undefined || fighter.side !== side) {
    return;
  }
  const defenders = opponentTypes.filter(type => Number.isInteger(type)) as PokemonType[];
  const against = (moveType: number): number =>
    defenders.reduce(
      (product, defenderType) => product * getTypeDamageMultiplier(moveType as PokemonType, defenderType),
      1,
    );
  const moves = (fighter.moves ?? []).map(move => ({ ...move, effectiveness: against(move.type) }));
  duelFighter = { ...fighter, moves };
  window.parent.postMessage(duelFighterMessage(duelFighter, playerStorage.prefix, matchId), window.location.origin);
}

/**
 * Opens the duel in this frame, from the two fighters the shell froze.
 *
 * Both frames open the same duel from the same seed: nothing is exchanged until
 * a turn, and the shell will only keep a turn the two agree on.
 *
 * @param duelId - Duel being opened
 * @param seed - Seed derived from the journal by the shell
 * @param fighters - Both fighters, finalized
 */
async function startDuel(duelId: string, seed: number, fighters: unknown): Promise<void> {
  const side = playerIdOfScope();
  if (side === undefined) {
    return;
  }
  const pair = fighters as Record<DuelSide, DuelFighter | DuelFighter[]> | undefined;
  const state = pair === undefined ? null : createDuel({ duelId, seed, fighters: pair });
  if (state === null) {
    console.warn("Duel 2P : duel refusé par le moteur", { duelId });
    duelState = null;
    return;
  }
  duelState = state;
  try {
    const normalized = {
      j1: Array.isArray(pair!.j1) ? pair!.j1 : [pair!.j1 as DuelFighter],
      j2: Array.isArray(pair!.j2) ? pair!.j2 : [pair!.j2 as DuelFighter],
    };
    if (preparedDuelTeam === null || preparedDuelTeam.duelId !== duelId) {
      throw new Error("équipe locale absente");
    }
    await beginDuelPresentation(state, side, preparedDuelTeam.members, normalized, command => {
      if (duelState === null || duelState.duelId !== duelId) {
        return;
      }
      window.parent.postMessage(
        {
          ...frameMessage("frame/duel-choice", playerStorage.prefix, matchId),
          duelId,
          turnId: duelState.turnId,
          command,
        },
        window.location.origin,
      );
    });
  } catch (error) {
    console.error("Duel 2P : scène de combat Phaser impossible à ouvrir", error);
    duelState = null;
    return;
  }
  // Le duel est ouvert : chaque moitié peut afficher le terrain avant que
  // quiconque ait choisi, donc sans révéler le moindre choix. Aucun tour n'a
  // encore été joué, d'où le `0`.
  reportDuelState(0);
}

/**
 * Plays one turn of the duel, on this frame's own copy.
 *
 * The turn is only reported when both choices lock and the mechanics resolve
 * them; a stale turn, a choice already locked or a refused resolution stays
 * silent, and the shell never gets a second answer to compare — which is exactly
 * the case where no point is credited.
 *
 * @param duelId - Duel being played
 * @param turnId - Turn the choices belong to
 * @param commands - Both choices, as locked by the shell
 */
async function playDuelTurn(duelId: string, turnId: number, commands: unknown): Promise<void> {
  if (duelState === null) {
    reportDuelFailure(duelId, turnId, "état du duel absent dans ce cadre");
    return;
  }
  if (duelState.duelId !== duelId || duelState.turnId !== turnId) {
    reportDuelFailure(duelId, turnId, `tour reçu ${turnId}, état local ${duelState.duelId}/${duelState.turnId}`);
    return;
  }
  const pair = commands as Partial<Record<DuelSide, DuelCommand>> | undefined;
  if (pair === undefined) {
    reportDuelFailure(duelId, turnId, "choix des deux joueurs absent");
    return;
  }
  let current = duelState;
  for (const side of DUEL_PLAYER_IDS) {
    const command = pair[side];
    if (command === undefined) {
      reportDuelFailure(duelId, turnId, `choix ${side.toUpperCase()} absent`);
      return;
    }
    const locked = lockCommand(current, side, command);
    if (!locked.accepted) {
      console.warn("Duel 2P : choix refusé", locked.reason);
      reportDuelFailure(duelId, turnId, `choix ${side.toUpperCase()} refusé : ${locked.reason ?? "raison inconnue"}`);
      return;
    }
    current = locked.state;
  }
  const resolved = resolveTurn(current, context =>
    resolveDuelTurn({
      ...context,
      typeMultiplier: (moveType, defenderTypes) =>
        defenderTypes.reduce(
          (product, defenderType) =>
            product * getTypeDamageMultiplier(moveType as PokemonType, defenderType as PokemonType),
          1,
        ),
    }),
  );
  if (!resolved.accepted) {
    console.warn("Duel 2P : tour refusé", resolved.reason);
    reportDuelFailure(duelId, turnId, `tour refusé : ${resolved.reason ?? "raison inconnue"}`);
    return;
  }
  duelState = resolved.state;
  try {
    await advanceDuelPresentation(
      duelState,
      pair as Record<DuelSide, DuelCommand>,
      duelState.history.at(-1)?.order ?? [],
    );
  } catch (error) {
    console.error("Duel 2P : présentation du tour en échec", error);
    reportDuelFailure(duelId, turnId, error instanceof Error ? error.message : String(error));
    return;
  }
  reportDuelState(turnId);
}

function reportDuelFailure(duelId: string, turnId: number, reason: string): void {
  const side = playerIdOfScope();
  if (side === undefined) {
    return;
  }
  const message = {
    ...frameMessage("frame/duel-error", playerStorage.prefix, matchId),
    duelId,
    turnId,
    reason: reason.slice(0, 240),
  };
  window.parent.postMessage(message, window.location.origin);
}

/**
 * Reports the duel as this frame sees it, **with its own moves**.
 *
 * The public state deliberately hides the moves — an opponent must not read its
 * way to the counter-move — but the owner's half has to display them, so they
 * travel with the report and the shell shows them in that half only. What is
 * reported after a turn is therefore still only what both players may see, plus
 * the private menu of whoever sent it.
 *
 * @param answeredTurnId - Turn this report answers, `0` for the opening state:
 *   that is how the shell pairs the two answers of one turn without ever
 *   trusting a report it did not ask for
 */
function reportDuelState(answeredTurnId: number): void {
  const side = playerIdOfScope();
  if (duelState === null || side === undefined) {
    return;
  }
  window.parent.postMessage(
    duelStateMessage(
      {
        duelId: duelState.duelId,
        turnId: answeredTurnId,
        hash: duelState.hash,
        view: duelPublicState(duelState),
        moves: duelMovesFor(duelState, side),
        bench: duelBenchFor(duelState, side),
      },
      playerStorage.prefix,
      matchId,
    ),
    window.location.origin,
  );
}

/**
 * The team the duel engine of lot D must play, or `null` before a duel is
 * prepared. It is a copy owned by the bridge: nothing in the run points at it.
 */
export function duelTeamForEngine(): readonly DuelMemberData[] | null {
  return preparedDuelTeam === null ? null : preparedDuelTeam.members;
}

/**
 * Which side this frame plays, read from its own storage scope.
 *
 * The frame never *claims* an identity: it reads the label its URL gave it. The
 * shell checks that label against the source of the message, which is the only
 * identity that counts, so a lying frame gains nothing.
 */
function playerIdOfScope(): DuelPlayerId | undefined {
  const scope = scopeFromQuery(window.location.search);
  return DUEL_PLAYER_IDS.includes(scope as DuelPlayerId) ? (scope as DuelPlayerId) : undefined;
}

/**
 * The player's bank. Absent profile, the run team plays without replacements.
 */
function readBank(): BankEntryV1[] {
  try {
    const profile = JSON.parse(playerStorage.getItem(PROFILE_KEY) ?? "null") as { bank?: unknown } | null;
    const bank = profile?.bank;
    return Array.isArray(bank) ? bank.filter(isBankEntry) : [];
  } catch (error) {
    console.warn("Duel 2P : banque du profil illisible, ignorée", error);
    return [];
  }
}

/** Stores a confirmed catch in this player's local dex and duel bank. */
function frameProfile(side: DuelSide): any {
  const raw = JSON.parse(playerStorage.getItem(PROFILE_KEY) ?? "null");
  return raw?.version === 1 && typeof raw.profileId === "string"
    ? raw
    : {
        version: 1,
        profileId: `local-${side}-${crypto.randomUUID?.() ?? Date.now().toString(36)}`,
        displayName: side.toUpperCase(),
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

export function recordProfileSeen(speciesId: number): void {
  const side = playerIdOfScope();
  if (side === undefined || !Number.isInteger(speciesId) || speciesId <= 0) {
    return;
  }
  try {
    const profile = frameProfile(side);
    if (profile.dex?.[speciesId]?.seen) {
      return;
    }
    profile.dex = {
      ...profile.dex,
      [speciesId]: { seen: true, caught: 0, firstCaughtAt: 0 },
    };
    playerStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.warn("Profil 2P : rencontre non enregistrée", error);
  }
}

export function recordProfileCapture(data: PokemonData): void {
  const side = playerIdOfScope();
  if (side === undefined) {
    return;
  }
  const member = captureMember(data);
  if (member === null || !Number.isInteger(data.id)) {
    return;
  }
  try {
    const profile = frameProfile(side);
    const entryId = `${matchId ?? "local"}:${data.id}`;
    if (Array.isArray(profile.bank) && profile.bank.some((entry: BankEntryV1) => entry.entryId === entryId)) {
      return;
    }
    const now = Date.now();
    const speciesId = member.species;
    const oldDex = profile.dex?.[speciesId] ?? { seen: false, caught: 0, firstCaughtAt: now };
    const entry: BankEntryV1 = {
      entryId,
      speciesId,
      formIndex: member.formIndex,
      variant: member.variant,
      level: member.level,
      caughtAt: now,
      matchId: matchId ?? "",
      runId: matchId ?? "",
      wave: Math.max(0, member.metWave),
      member,
    };
    const quality = (candidate: BankEntryV1): number =>
      candidate.level * 1000 + candidate.member.ivs.reduce((sum, iv) => sum + iv, 0);
    const sorted = [...(Array.isArray(profile.bank) ? profile.bank.filter(isBankEntry) : []), entry].sort(
      (a, b) => quality(b) - quality(a) || b.caughtAt - a.caughtAt,
    );
    const preferred: BankEntryV1[] = [];
    const extra: BankEntryV1[] = [];
    const speciesVariants = new Set<string>();
    for (const candidate of sorted) {
      const key = `${candidate.speciesId}:${candidate.variant}`;
      if (speciesVariants.has(key)) {
        extra.push(candidate);
      } else {
        speciesVariants.add(key);
        preferred.push(candidate);
      }
    }
    // Le jeu solo ne fixe aucun nombre maximal d'espèces dans son Pokédex.
    // Conserver toutes les captures individuelles pour les profils 2P ; le
    // quota réel du stockage local Android reste la limite pratique.
    profile.bank = [...preferred, ...extra];
    profile.dex = {
      ...profile.dex,
      [speciesId]: { seen: true, caught: (oldDex.caught ?? 0) + 1, firstCaughtAt: oldDex.firstCaughtAt || now },
    };
    playerStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.warn("Profil 2P : capture non enregistrée", error);
  }
}

/**
 * Reports a battle won against the AI to the coordinator.
 *
 * Called once per won battle, where the game concludes it (`BattleEndPhase`).
 * Nothing is reported outside a coordinated match: the solo game and the
 * side-by-side mode keep no counter, so they must not write one.
 *
 * @param battle - Concluded battle; only `waveIndex` and `battleType` are read
 * @returns The identifier sent to the shell, or `null` when nothing was sent
 */
export function notifyPveBattleWon(battle: { waveIndex: number; battleType: number }): string | null {
  if (window.parent === window || matchRules === null) {
    return null;
  }
  const battleId = battleIds.get(battle) ?? `${battle.waveIndex}-${battle.battleType}-${nextSeq(BATTLE_SEQ_KEY)}`;
  battleIds.set(battle, battleId);
  if (matchRules.mode === "blocks") {
    window.parent.postMessage(
      battleWonMessage(battleId, playerStorage.prefix, matchId, battle.waveIndex),
      window.location.origin,
    );
  } else if (!pendingFreeModeBattles.some(item => item.battleId === battleId)) {
    pendingFreeModeBattles.push({ battleId, wave: battle.waveIndex });
  }
  return battleId;
}

/**
 * Reports that this session's save is written.
 *
 * The coordinator waits for both players' saves before opening a duel: a frame
 * that has not finished writing must not enter one.
 *
 * @returns The counter sent to the shell, or `null` when nothing was sent
 */
export function notifyPveSaved(): number | null {
  if (window.parent === window || matchRules === null) {
    return null;
  }
  if (matchRules.mode !== "blocks") {
    const side = playerIdOfScope();
    if (side !== undefined && pendingFreeModeBattles.length > 0) {
      try {
        const profile = frameProfile(side);
        const seen = new Set<string>(profile.seenBattles ?? []);
        for (const { battleId, wave } of pendingFreeModeBattles.splice(0)) {
          if (seen.has(battleId)) {
            continue;
          }
          seen.add(battleId);
          profile.stats.pveBattlesWon = (profile.stats.pveBattlesWon ?? 0) + 1;
          profile.stats.bestRunWave = Math.max(profile.stats.bestRunWave ?? 0, wave);
        }
        profile.seenBattles = [...seen].slice(-2048);
        playerStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      } catch (error) {
        console.warn("Profil 2P : victoires du duo libre non enregistrées", error);
      }
    }
    return null;
  }
  const saveSeq = nextSeq(SAVE_SEQ_KEY);
  window.parent.postMessage(savedMessage(saveSeq, playerStorage.prefix, matchId), window.location.origin);
  return saveSeq;
}

/**
 * Whether the game is currently stopped between two battles.
 *
 * Used by the parts of the game that must not act while waiting.
 */
export function isWaitingForDuel(): boolean {
  return duelPark.isWaiting;
}

/** Rules handed by the shell, for the parts of the game that display them. */
export function shellRules(): MatchRulesV1 | null {
  return matchRules;
}

/** Wakes the game up and runs whatever the stop was holding back. */
function releaseFromDuelPark(): void {
  const resume = duelPark.release();
  if (resume === null) {
    // Rien n'était arrêté : c'est une reprise ordinaire.
    gameRef?.loop.wake();
    gameRef?.sound.resumeAll();
    return;
  }
  gameRef?.loop.wake();
  gameRef?.sound.resumeAll();
  resume();
}

function reply(type: Parameters<typeof frameMessage>[0]): void {
  window.parent.postMessage(frameMessage(type, playerStorage.prefix, matchId), window.location.origin);
}

/** Posts the block-boundary acknowledgement, without carrying a payload. */
function replyWaiting(): void {
  window.parent.postMessage(duelWaitingMessage(playerStorage.prefix, matchId), window.location.origin);
}

/**
 * Reads the counter of `key`, increments it and writes it back.
 *
 * It lives in the player's scope, so it survives an application restart: the
 * coordinator only accepts a report that moves the counter forward, and a
 * counter restarting at zero would block a resumed match.
 */
function nextSeq(key: string): number {
  const stored = Number(playerStorage.getItem(key));
  const next = (Number.isFinite(stored) && stored > 0 ? Math.trunc(stored) : 0) + 1;
  playerStorage.setItem(key, String(next));
  return next;
}

/** Drops every held key, including the ones the touch layout keeps locked. */
function releaseInputs(): void {
  // `loseFocus` is the path the game already uses for a lost window focus.
  globalScene?.inputController?.loseFocus();
}
