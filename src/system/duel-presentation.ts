/*
 * SPDX-FileCopyrightText: 2026 Pagefault Games
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Battle } from "#app/battle";
import { MAX_TERAS_PER_ARENA } from "#app/constants";
import { globalScene } from "#app/global-scene";
import { settings } from "#app/global-settings-manager";
import { speciesDataRegistry } from "#app/global-species-data-registry";
import { getPokemonNameWithAffix } from "#app/messages";
import { initMoveAnim, loadMoveAnimAssets, MoveAnim } from "#data/battle-anims";
import type { Gender } from "#data/gender";
import { CustomPokemonData } from "#data/pokemon-data";
import { BattleType } from "#enums/battle-type";
import { BattlerIndex } from "#enums/battler-index";
import { Command } from "#enums/command";
import { FieldPosition } from "#enums/field-position";
import { HitResult } from "#enums/hit-result";
import { MoveId } from "#enums/move-id";
import type { MoveUseMode } from "#enums/move-use-mode";
import type { PokemonType } from "#enums/pokemon-type";
import type { SpeciesId } from "#enums/species-id";
import { TrainerSlot } from "#enums/trainer-slot";
import { UiMode } from "#enums/ui-mode";
import type { EnemyPokemon, PlayerPokemon, Pokemon } from "#field/pokemon";
import { PokemonMove } from "#moves/pokemon-move";
import { CommandPhase } from "#phases/command-phase";
import { playDamageAnimation } from "#phases/damage-anim-phase";
import type { Variant } from "#sprites/variant";
import type { DuelActionResult, DuelCommand, DuelFighter, DuelSide, DuelState } from "#system/duel-engine";
import type { DuelMemberData } from "#system/duel-snapshot";
import { DUEL_PLAYER_IDS } from "#system/duel-snapshot";
import type { DamageResult } from "#types/damage-result";
import type { TurnMove } from "#types/turn-move";
import i18next from "i18next";

type ChoiceCallback = (command: DuelCommand) => void;

interface DuelPresentation {
  duelId: string;
  localSide: DuelSide;
  savedBattle: Battle;
  savedPlayerTerasUsed: number;
  savedParty: PlayerPokemon[];
  savedEnemyParty: EnemyPokemon[];
  savedVisibility: { pokemon: Pokemon; visible: boolean; infoVisible: boolean }[];
  party: PlayerPokemon[];
  sceneParty: PlayerPokemon[];
  enemyParty: EnemyPokemon[];
  activeTeamIndex: Record<DuelSide, number>;
  benchTeamIndexes: Record<DuelSide, number[]>;
  phase: DuelCommandPhase;
  phaseInstalled: boolean;
}

let presentation: DuelPresentation | null = null;

/**
 * Display the duel inside the original Phaser battle scene.
 *
 * The run's party and battle are kept by reference and restored when the duel
 * closes. The duel objects are temporary scene objects and never enter a save.
 */
export async function beginDuelPresentation(
  state: DuelState,
  localSide: DuelSide,
  localMembers: readonly DuelMemberData[],
  fighters: Record<DuelSide, DuelFighter[]>,
  onChoice: ChoiceCallback,
): Promise<void> {
  endDuelPresentation();

  const savedBattle = globalScene.currentBattle;
  const savedPlayerTerasUsed = globalScene.arena.playerTerasUsed;
  const party = globalScene.getPlayerParty();
  const savedParty = party.slice();
  const savedEnemyParty = savedBattle.enemyParty.slice();
  const savedVisibility = [...savedParty, ...savedEnemyParty].map(pokemon => ({
    pokemon,
    visible: pokemon.visible,
    infoVisible: battleInfoOf(pokemon)?.visible ?? false,
  }));
  const otherSide: DuelSide = localSide === "j1" ? "j2" : "j1";
  const activeTeamIndex = { j1: 0, j2: 0 };
  const benchTeamIndexes = {
    j1: Array.from({ length: Math.max(0, fighters.j1.length - 1) }, (_, index) => index + 1),
    j2: Array.from({ length: Math.max(0, fighters.j2.length - 1) }, (_, index) => index + 1),
  };
  const ownRoster: PlayerPokemon[] = [];
  const opponentRoster: EnemyPokemon[] = [];
  presentation = {
    duelId: state.duelId,
    localSide,
    savedBattle,
    savedPlayerTerasUsed,
    savedParty,
    savedEnemyParty,
    savedVisibility,
    party: ownRoster,
    enemyParty: opponentRoster,
    activeTeamIndex,
    benchTeamIndexes,
    phase: new DuelCommandPhase(0, onChoice),
    sceneParty: party,
    phaseInstalled: false,
  };

  try {
    for (const saved of savedVisibility) {
      saved.pokemon.setVisible(false);
      battleInfoOf(saved.pokemon)?.setVisible(false);
    }
    globalScene.currentBattle = new Battle(globalScene.gameMode, {
      waveIndex: savedBattle.waveIndex,
      battleType: BattleType.WILD,
      trainer: undefined,
      double: false,
    });
    // Téra n'est pas encore une commande du moteur de duel : masquer son bouton
    // conserve le menu natif sans consommer la ressource de la run.
    globalScene.arena.playerTerasUsed = MAX_TERAS_PER_ARENA;
    globalScene.currentBattle.incrementTurn();

    for (const member of localMembers) {
      ownRoster.push(createPlayerPokemon(member));
    }
    for (const fighter of fighters[otherSide]) {
      opponentRoster.push(createEnemyPokemon(fighter));
    }
    party.splice(0, party.length, ...ownRoster);
    globalScene.currentBattle.enemyParty.push(...opponentRoster);
    // Native encounter phases load the species atlas before adding the enemy
    // to the field. These temporary duel Pokémon need the same step, or Phaser
    // leaves the generic `pkmn__sub` placeholder visible in place of the art.
    // The shell parked Phaser at the block boundary; wake its loop before
    // waiting on the loader, since the loader's completion is dispatched there.
    globalScene.game.loop.wake();
    await Promise.all([...ownRoster, ...opponentRoster].map(pokemon => pokemon.loadAssets()));
    syncDuelPresentation(state, {}, []);
    showActivePokemon(localSide, ownRoster[0]);
    showActivePokemon(otherSide, opponentRoster[0]);
    globalScene.updateFieldScale();
    presentation.phaseInstalled = true;
    if (!globalScene.phaseManager.overridePhase(presentation.phase)) {
      presentation.phaseInstalled = false;
      throw new Error("phase de jeu déjà suspendue");
    }
    globalScene.game.sound.resumeAll();
  } catch (error) {
    endDuelPresentation();
    throw error;
  }
}

/** Apply the agreed engine state and play the actual move animations. */
export async function advanceDuelPresentation(
  state: DuelState,
  commands: Record<DuelSide, DuelCommand>,
  order: DuelSide[],
): Promise<void> {
  if (presentation === null || presentation.duelId !== state.duelId) {
    return;
  }
  // Invalidate the delayed local waiting label before move messages start. The
  // message mode transition is asynchronous, so an older callback must not
  // overwrite "uses …" after both players' choices have already been received.
  presentation.phase.clearWaitingMessage();
  // Switches must be visible before an opponent's ordered attack. Keep this
  // turn's HP and PP until its animations have played, then apply the result.
  syncDuelPresentation(state, commands, order, false);
  await animateCommands(commands, order, state.history.at(-1)?.actionResults);
  if (presentation === null || presentation.duelId !== state.duelId) {
    return;
  }
  syncDuelPresentation(state, {}, order);
  if (state.winner === null) {
    presentation.phase.unlock();
    globalScene.ui.clearText();
    globalScene.ui.setMode(UiMode.FIGHT, 0);
  } else {
    globalScene.ui.setMode(UiMode.MESSAGE);
    globalScene.ui.showText(state.winner === "draw" ? "Égalité !" : `${state.winner.toUpperCase()} remporte le duel !`);
  }
}

/** Restore the paused run scene after the shell releases the players. */
export function endDuelPresentation(): void {
  if (presentation === null) {
    return;
  }
  const current = presentation;
  presentation = null;
  globalScene.ui.clearText();
  globalScene.ui.setMode(UiMode.MESSAGE);

  for (const pokemon of [...current.party, ...current.enemyParty]) {
    globalScene.field.remove(pokemon, false);
    pokemon.destroy();
  }
  current.sceneParty.splice(0, current.sceneParty.length, ...current.savedParty);
  current.savedBattle.enemyParty.splice(0, current.savedBattle.enemyParty.length, ...current.savedEnemyParty);
  globalScene.currentBattle = current.savedBattle;
  globalScene.arena.playerTerasUsed = current.savedPlayerTerasUsed;
  for (const saved of current.savedVisibility) {
    saved.pokemon.setVisible(saved.visible);
    battleInfoOf(saved.pokemon)?.setVisible(saved.infoVisible);
  }
  if (current.phaseInstalled) {
    globalScene.phaseManager.shiftPhase();
  }
  globalScene.updateFieldScale();
}

/** Return the local command menu when the shell refuses a locked choice. */
export function rejectDuelChoice(): void {
  presentation?.phase.rejectWaitingChoice();
}

function createPlayerPokemon(member: DuelMemberData): PlayerPokemon {
  const species = speciesDataRegistry.getSpecies(member.species);
  const pokemon = globalScene.addPlayerPokemon(
    species,
    member.level,
    member.abilityIndex,
    member.formIndex,
    member.gender,
    member.shiny,
    (member.variant === 1 || member.variant === 2 ? member.variant : 0) as Variant,
    member.ivs,
    member.nature,
    undefined,
    playerPokemon => {
      playerPokemon.passive = member.passive;
    },
  );
  pokemon.nickname = member.nickname || undefined;
  pokemon.teraType = member.teraType;
  pokemon.customPokemonData = new CustomPokemonData(
    (member.custom ?? undefined) as Partial<CustomPokemonData> | undefined,
  );
  if (member.fusion !== null) {
    const fusionSpecies = speciesDataRegistry.getSpecies(member.fusion.species);
    pokemon.fusionSpecies = fusionSpecies;
    pokemon.fusionFormIndex = member.fusion.formIndex;
    pokemon.fusionAbilityIndex = member.fusion.abilityIndex;
    pokemon.fusionShiny = member.fusion.shiny;
    pokemon.fusionVariant = (
      member.fusion.variant === 1 || member.fusion.variant === 2 ? member.fusion.variant : 0
    ) as Variant;
    pokemon.fusionGender = member.fusion.gender as Gender;
    pokemon.fusionTeraType = member.fusion.teraType;
    pokemon.fusionCustomPokemonData = new CustomPokemonData(
      (member.fusion.custom ?? undefined) as Partial<CustomPokemonData> | undefined,
    );
    pokemon.generateName();
  }
  pokemon.moveset = member.moves.map(move => new PokemonMove(move.moveId, move.ppUsed, move.ppUp, move.maxPpOverride));
  pokemon.calculateStats();
  pokemon.hp = pokemon.getMaxHp();
  pokemon.setVisible(false);
  battleInfoOf(pokemon)?.setVisible(false);
  return pokemon;
}

function createEnemyPokemon(fighter: DuelFighter): EnemyPokemon {
  const species = speciesDataRegistry.getSpecies(fighter.species as SpeciesId);
  const pokemon = globalScene.addEnemyPokemon(
    species,
    fighter.level,
    TrainerSlot.NONE,
    false,
    true,
    undefined,
    enemyPokemon => {
      // addEnemyPokemon calls this before init() creates the sprite. Appearance
      // fields must be in place here or it loads the default, already-wrong art.
      const appearance = fighter.appearance;
      if (appearance !== undefined) {
        enemyPokemon.formIndex = appearance.formIndex;
        enemyPokemon.gender = appearance.gender as Gender;
        enemyPokemon.customPokemonData = new CustomPokemonData(
          (appearance.custom ?? undefined) as Partial<CustomPokemonData> | undefined,
        );
        if (appearance.fusion !== null) {
          const fusion = appearance.fusion;
          const fusionSpecies = speciesDataRegistry.getSpecies(fusion.species as SpeciesId);
          if (fusionSpecies !== undefined) {
            enemyPokemon.fusionSpecies = fusionSpecies;
            enemyPokemon.fusionFormIndex = fusion.formIndex;
            enemyPokemon.fusionAbilityIndex = fusion.abilityIndex;
            enemyPokemon.fusionShiny = fusion.shiny;
            enemyPokemon.fusionVariant = (fusion.variant === 1 || fusion.variant === 2 ? fusion.variant : 0) as Variant;
            enemyPokemon.fusionGender = fusion.gender as Gender;
            enemyPokemon.fusionTeraType = fusion.teraType as PokemonType;
            enemyPokemon.fusionCustomPokemonData = new CustomPokemonData(
              (fusion.custom ?? undefined) as Partial<CustomPokemonData> | undefined,
            );
          }
        }
        enemyPokemon.generateName();
      }
      enemyPokemon.shiny = fighter.shiny;
      enemyPokemon.variant =
        fighter.variant === 1 || fighter.variant === 2 ? (fighter.variant as Variant) : (0 as Variant);
      // EnemyPokemon stores nicknames as UTF-8 base64, while duel fighters carry
      // the already-decoded name shown in the run.
      enemyPokemon.nickname = btoa(unescape(encodeURIComponent(fighter.name)));
    },
  );
  pokemon.stats = [...fighter.stats];
  pokemon.moveset = fighter.moves.map(move => new PokemonMove(move.moveId, move.ppMax - move.pp, 0, move.ppMax));
  pokemon.hp = fighter.maxHp;
  pokemon.setVisible(false);
  battleInfoOf(pokemon)?.setVisible(false);
  return pokemon;
}

function showActivePokemon(side: DuelSide, pokemon: Pokemon | undefined): void {
  if (pokemon === undefined) {
    return;
  }
  pokemon.setFieldPosition(FieldPosition.CENTER);
  globalScene.add.existing(pokemon);
  globalScene.field.add(pokemon);
  pokemon.setVisible(true);
  pokemon.getSprite().setVisible(true);
  pokemon.showInfo();
  pokemon.playAnim();
  pokemon.fieldSetup();
  pokemon.updateInfo(true);
  if (side !== presentation?.localSide) {
    const playerPokemon = globalScene.getPlayerPokemon();
    if (playerPokemon?.isOnField()) {
      globalScene.field.moveBelow(pokemon, playerPokemon);
    }
  }
}

function syncDuelPresentation(
  state: DuelState,
  commands: Partial<Record<DuelSide, DuelCommand>>,
  _order: DuelSide[],
  syncCombatState = true,
): void {
  if (presentation === null || presentation.duelId !== state.duelId) {
    return;
  }
  // Add this frame's player first. On J2 the opponent is J1, so a fixed J1/J2
  // iteration tried to order the enemy under a player sprite that Phaser had
  // not added to the field container yet; Container.moveBelow throws then.
  const sideOrder: DuelSide[] = [presentation.localSide, presentation.localSide === "j1" ? "j2" : "j1"];
  for (const side of sideOrder) {
    const command = commands[side];
    if (command?.type === "switch") {
      switchVisualRoster(side, command.benchIndex);
    }
    const roster = side === presentation.localSide ? presentation.party : presentation.enemyParty;
    const memberState = state.sides[side];
    let activePokemon = roster[presentation.activeTeamIndex[side]];
    if (syncCombatState && activePokemon !== undefined && !fighterMatchesPokemon(memberState.fighter, activePokemon)) {
      const replacementPosition = presentation.benchTeamIndexes[side].findIndex(index => {
        const reserve = roster[index];
        return reserve !== undefined && fighterMatchesPokemon(memberState.fighter, reserve);
      });
      if (replacementPosition >= 0) {
        switchVisualRoster(side, replacementPosition);
        activePokemon = roster[presentation.activeTeamIndex[side]];
      }
    }
    if (activePokemon !== undefined) {
      if (syncCombatState) {
        updatePokemonFromFighter(activePokemon, memberState.fighter);
      }
      if (side === presentation.localSide) {
        presentation.sceneParty.splice(
          0,
          presentation.sceneParty.length,
          activePokemon as PlayerPokemon,
          ...presentation.benchTeamIndexes[side].map(index => roster[index] as PlayerPokemon),
        );
      } else {
        globalScene.currentBattle.enemyParty.splice(
          0,
          globalScene.currentBattle.enemyParty.length,
          activePokemon as EnemyPokemon,
          ...presentation.benchTeamIndexes[side].map(index => roster[index] as EnemyPokemon),
        );
      }
      if (!activePokemon.isOnField()) {
        for (const member of roster) {
          if (member !== activePokemon) {
            member.setVisible(false);
            battleInfoOf(member)?.setVisible(false);
            globalScene.field.remove(member, false);
          }
        }
        showActivePokemon(side, activePokemon);
      }
    }
    const benchState = memberState.bench ?? [];
    for (let index = 0; index < benchState.length; index++) {
      const rosterIndex = presentation.benchTeamIndexes[side][index];
      const reserve = roster[rosterIndex];
      if (syncCombatState && reserve !== undefined) {
        updatePokemonFromFighter(reserve, benchState[index]);
      }
    }
  }
}

function switchVisualRoster(side: DuelSide, benchPosition: number): void {
  if (presentation === null) {
    return;
  }
  const bench = presentation.benchTeamIndexes[side];
  if (!Number.isInteger(benchPosition) || benchPosition < 0 || benchPosition >= bench.length) {
    return;
  }
  const oldActive = presentation.activeTeamIndex[side];
  presentation.activeTeamIndex[side] = bench[benchPosition];
  bench[benchPosition] = oldActive;
}

function fighterMatchesPokemon(fighter: DuelFighter, pokemon: Pokemon): boolean {
  return (
    fighter.species === pokemon.species.speciesId
    && fighter.level === pokemon.level
    && fighter.name === pokemon.getNameToRender()
    && fighter.moves.length === pokemon.moveset.length
    && fighter.moves.every((move, index) => pokemon.moveset[index]?.moveId === move.moveId)
  );
}

function updatePokemonFromFighter(pokemon: Pokemon, fighter: DuelFighter): void {
  pokemon.hp = fighter.hp;
  for (let index = 0; index < Math.min(pokemon.moveset.length, fighter.moves.length); index++) {
    const move = pokemon.moveset[index];
    move.ppUsed = Math.max(0, move.getMovePp() - fighter.moves[index].pp);
  }
  pokemon.updateInfo();
}

function battleInfoOf(pokemon: Pokemon): Phaser.GameObjects.Container | undefined {
  return (pokemon as unknown as { battleInfo?: Phaser.GameObjects.Container }).battleInfo;
}

async function animateCommands(
  commands: Record<DuelSide, DuelCommand>,
  order: DuelSide[],
  actionResults?: DuelActionResult[],
): Promise<void> {
  if (presentation === null) {
    return;
  }
  const currentPresentation = presentation;
  // A voluntary switch happens before either move. Name the Pokémon going back
  // and the replacement, as the native solo switch phases do.
  for (const side of DUEL_PLAYER_IDS) {
    const command = commands[side];
    if (command?.type !== "switch") {
      continue;
    }
    const roster = side === currentPresentation.localSide ? currentPresentation.party : currentPresentation.enemyParty;
    const outgoingIndex = currentPresentation.benchTeamIndexes[side][command.benchIndex];
    const outgoing = roster[outgoingIndex];
    const incoming = roster[currentPresentation.activeTeamIndex[side]];
    if (outgoing !== undefined) {
      await showDuelBattleMessage(
        i18next.t("battle:playerComeBack", { pokemonName: getPokemonNameWithAffix(outgoing) }),
      );
      if (presentation !== currentPresentation) {
        return;
      }
    }
    if (incoming !== undefined) {
      await showDuelBattleMessage(i18next.t("battle:playerGo", { pokemonName: getPokemonNameWithAffix(incoming) }));
      if (presentation !== currentPresentation) {
        return;
      }
    }
  }

  const resultsBySide = new Map(actionResults?.map(result => [result.side, result]) ?? []);
  const attacks: { side: DuelSide; user: Pokemon; moveId: MoveId; result?: DuelActionResult }[] = [];
  for (const side of order) {
    const command = commands[side];
    if (command === undefined || (command.type !== "fight" && command.type !== "struggle")) {
      continue;
    }
    const local = side === currentPresentation.localSide;
    const roster = local ? currentPresentation.party : currentPresentation.enemyParty;
    const index = currentPresentation.activeTeamIndex[side];
    const user = roster[index];
    const moveId = command.type === "struggle" ? MoveId.STRUGGLE : user?.moveset[command.moveIndex]?.moveId;
    if (user === undefined || moveId === undefined) {
      continue;
    }
    const result = resultsBySide.get(side);
    attacks.push({ side, user, moveId, ...(result === undefined ? {} : { result }) });
  }
  if (attacks.length === 0) {
    return;
  }

  globalScene.ui.setMode(UiMode.MESSAGE);
  // Missed and ineffective moves do not play an animation in the native battle
  // flow. Load only the animations that can actually be shown this turn.
  const animatedAttacks = attacks.filter(attack => attack.result === undefined || attack.result.result === "hit");
  const moveIds = [...new Set(animatedAttacks.map(attack => attack.moveId))];
  let animationsReady = true;
  if (moveIds.length > 0) {
    try {
      await Promise.all(moveIds.map(moveId => initMoveAnim(moveId)));
      await loadMoveAnimAssets(moveIds, true);
    } catch (error) {
      console.warn("Duel 2P : animation des attaques ignorée", error);
      animationsReady = false;
    }
  }
  if (presentation !== currentPresentation) {
    return;
  }

  for (const attack of attacks) {
    const move =
      attack.user.moveset.find(candidate => candidate.moveId === attack.moveId)?.getMove()
      ?? new PokemonMove(attack.moveId, 0, 0).getMove();
    await showDuelBattleMessage(
      i18next.t("battle:useMove", {
        pokemonNameWithAffix: getPokemonNameWithAffix(attack.user),
        moveName: move.name,
      }),
    );
    if (presentation !== currentPresentation) {
      return;
    }

    const targetSide: DuelSide = attack.side === "j1" ? "j2" : "j1";
    const targetRoster =
      targetSide === currentPresentation.localSide ? currentPresentation.party : currentPresentation.enemyParty;
    const target = targetRoster[currentPresentation.activeTeamIndex[targetSide]];
    const result = attack.result;
    if (result?.result === "miss") {
      if (target !== undefined) {
        await showDuelBattleMessage(
          i18next.t("battle:attackMissed", {
            pokemonNameWithAffix: getPokemonNameWithAffix(target),
          }),
        );
      }
      if (presentation !== currentPresentation) {
        return;
      }
      continue;
    }
    if (result?.result === "failed") {
      await showDuelBattleMessage(i18next.t("battle:attackFailed"));
      if (presentation !== currentPresentation) {
        return;
      }
      continue;
    }
    if (result?.result === "no_effect") {
      if (target !== undefined) {
        await showDuelBattleMessage(
          i18next.t("battle:hitResultNoEffect", {
            pokemonName: getPokemonNameWithAffix(target),
          }),
        );
      }
      if (presentation !== currentPresentation) {
        return;
      }
      continue;
    }

    if (animationsReady) {
      const local = attack.side === currentPresentation.localSide;
      await new Promise<void>(resolve => {
        new MoveAnim(attack.moveId, attack.user, local ? BattlerIndex.ENEMY : BattlerIndex.PLAYER).play(false, resolve);
      });
    }
    if (presentation !== currentPresentation) {
      return;
    }

    if (result !== undefined) {
      if (result.result === "hit" && target !== undefined) {
        target.hp = Math.max(0, target.hp - result.damage);
        await playDamageAnimation(target, result.damage, getDuelHitResult(result.effectiveness), result.critical);
        if (presentation !== currentPresentation) {
          return;
        }
      }
      if (result.recoil > 0) {
        attack.user.hp = Math.max(0, attack.user.hp - result.recoil);
        await playDamageAnimation(attack.user, result.recoil, HitResult.INDIRECT);
        if (presentation !== currentPresentation) {
          return;
        }
      }
      await showDuelActionResult(result, attack.user, target);
      if (presentation !== currentPresentation) {
        return;
      }
    }
  }
}

/** Use the native battle message typing speed and pause. */
function showDuelBattleMessage(text: string, callbackDelay?: number): Promise<void> {
  const manualClear = settings.general.manualMessageClear;
  return new Promise(resolve => {
    globalScene.ui.showText(text, null, resolve, callbackDelay || (manualClear ? 0 : 1500), manualClear);
  });
}

function getDuelHitResult(effectiveness: number): DamageResult {
  if (effectiveness >= 4) {
    return HitResult.EXTREMELY_EFFECTIVE;
  }
  if (effectiveness >= 2) {
    return HitResult.SUPER_EFFECTIVE;
  }
  if (effectiveness <= 0.25) {
    return HitResult.MOSTLY_INEFFECTIVE;
  }
  if (effectiveness <= 0.5) {
    return HitResult.NOT_VERY_EFFECTIVE;
  }
  return HitResult.EFFECTIVE;
}

async function showDuelActionResult(
  result: DuelActionResult,
  attacker: Pokemon,
  target: Pokemon | undefined,
): Promise<void> {
  if (result.critical) {
    await showDuelBattleMessage(i18next.t("battle:hitResultCriticalHit"));
  }

  let effectivenessMessage: string | undefined;
  if (result.effectiveness >= 4) {
    effectivenessMessage = "battle:hitResultExtremelyEffective";
  } else if (result.effectiveness >= 2) {
    effectivenessMessage = "battle:hitResultSuperEffective";
  } else if (result.effectiveness <= 0.25) {
    effectivenessMessage = "battle:hitResultMostlyIneffective";
  } else if (result.effectiveness <= 0.5) {
    effectivenessMessage = "battle:hitResultNotVeryEffective";
  }
  if (effectivenessMessage !== undefined) {
    await showDuelBattleMessage(i18next.t(effectivenessMessage));
  }

  if (result.targetFainted && target !== undefined) {
    await showDuelBattleMessage(
      i18next.t("battle:fainted", {
        pokemonNameWithAffix: getPokemonNameWithAffix(target),
      }),
    );
  }
  if (result.attackerFainted) {
    await showDuelBattleMessage(
      i18next.t("battle:fainted", {
        pokemonNameWithAffix: getPokemonNameWithAffix(attacker),
      }),
    );
  }
}

class DuelCommandPhase extends CommandPhase {
  public override readonly phaseName = "CommandPhase";
  private readonly onChoice: ChoiceCallback;
  private inputLocked = false;
  private waitingMessageRevision = 0;

  constructor(fieldIndex: number, onChoice: ChoiceCallback) {
    super(fieldIndex);
    this.onChoice = onChoice;
  }

  public override start(): void {
    this.inputLocked = false;
    this.waitingMessageRevision++;
    globalScene.ui.clearText();
    globalScene.ui.setMode(UiMode.FIGHT, this.getFieldIndex());
  }

  unlock(): void {
    this.inputLocked = false;
    this.waitingMessageRevision++;
  }

  clearWaitingMessage(): void {
    this.waitingMessageRevision++;
    globalScene.ui.clearText();
  }

  rejectWaitingChoice(): void {
    this.inputLocked = false;
    this.waitingMessageRevision++;
    globalScene.ui.clearText();
    void globalScene.ui.setMode(UiMode.FIGHT, this.getFieldIndex()).catch(error => {
      console.debug("Duel 2P : retour au menu d'attaques ignoré", error);
    });
  }

  public override handleCommand(
    command: Command,
    cursor: number,
    _useMode?: boolean | MoveUseMode,
    _move?: TurnMove,
  ): boolean {
    if (this.inputLocked) {
      return false;
    }
    const pokemon = this.getPokemon();
    if (command === Command.POKEMON) {
      if (cursor <= 0 || !presentation) {
        return false;
      }
      this.inputLocked = true;
      this.onChoice({ type: "switch", benchIndex: cursor - 1 });
      this.showWaitingMessage();
      return true;
    }
    if (command !== Command.FIGHT) {
      globalScene.ui.playError();
      return false;
    }
    const [selectedUsable] = pokemon.trySelectMove(cursor);
    const noUsableMoves = !pokemon.getMoveset().some(move => move.isUsable(pokemon, false, true)[0]);
    if (!selectedUsable && !noUsableMoves) {
      globalScene.ui.playError();
      return false;
    }
    this.inputLocked = true;
    this.onChoice(noUsableMoves ? { type: "struggle" } : { type: "fight", moveIndex: cursor });
    this.showWaitingMessage();
    return true;
  }

  private showWaitingMessage(): void {
    const revision = ++this.waitingMessageRevision;
    void globalScene.ui
      .setMode(UiMode.MESSAGE)
      .then(() => {
        if (this.inputLocked && revision === this.waitingMessageRevision) {
          globalScene.ui.showText("Choix verrouillé · en attente de l'autre joueur", 0);
        }
      })
      .catch(error => console.debug("Duel 2P : affichage du message d'attente ignoré", error));
  }

  public override cancel(): void {
    globalScene.ui.setMode(UiMode.FIGHT, this.getFieldIndex());
  }
}
