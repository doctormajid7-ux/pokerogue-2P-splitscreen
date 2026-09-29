import { audioManager } from "#app/global-audio-manager";
import { globalScene } from "#app/global-scene";
import { settings } from "#app/global-settings-manager";
import type { BattlerIndex } from "#enums/battler-index";
import { HitResult } from "#enums/hit-result";
import type { Pokemon } from "#field/pokemon";
import { PokemonPhase } from "#phases/pokemon-phase";
import type { DamageResult } from "#types/damage-result";
import { fixedInt } from "#utils/common";

export class DamageAnimPhase extends PokemonPhase {
  public readonly phaseName = "DamageAnimPhase";

  private amount: number;
  private readonly damageResult: DamageResult;
  private readonly critical: boolean;

  constructor(
    battlerIndex: BattlerIndex,
    amount: number,
    damageResult: DamageResult = HitResult.EFFECTIVE,
    critical = false,
  ) {
    super(battlerIndex);

    this.amount = amount;
    this.damageResult = damageResult;
    this.critical = critical;
  }

  start() {
    super.start();
    playDamageAnimation(this.getPokemon(), this.amount, this.damageResult, this.critical).then(() => this.end());
  }

  // TODO: this is silly, just make `amount` `public`
  public updateAmount(amount: number): void {
    this.amount = amount;
  }

  public override end() {
    if (globalScene.currentBattle.isClassicFinalBoss) {
      globalScene.initFinalBossPhaseTwo(this.getPokemon());
    } else {
      super.end();
    }
  }
}

/** Play the native damage feedback without advancing or ending a phase. */
export async function playDamageAnimation(
  pokemon: Pokemon,
  amount: number,
  damageResult: DamageResult = HitResult.EFFECTIVE,
  critical = false,
): Promise<void> {
  if (damageResult === HitResult.ONE_HIT_KO || damageResult === HitResult.INDIRECT_KO) {
    if (settings.display.enableMoveAnimations) {
      globalScene.toggleInvert(true);
    }
    await new Promise<void>(resolve => {
      globalScene.time.delayedCall(fixedInt(1000), () => {
        globalScene.toggleInvert(false);
        resolve();
      });
    });
  }

  switch (damageResult) {
    case HitResult.EFFECTIVE:
    case HitResult.CONFUSION:
      audioManager.playSound("se/hit");
      break;
    case HitResult.EXTREMELY_EFFECTIVE:
    case HitResult.SUPER_EFFECTIVE:
    case HitResult.INDIRECT_KO:
    case HitResult.ONE_HIT_KO:
      audioManager.playSound("se/hit_strong");
      break;
    case HitResult.NOT_VERY_EFFECTIVE:
    case HitResult.MOSTLY_INEFFECTIVE:
      audioManager.playSound("se/hit_weak");
      break;
  }

  if (amount) {
    globalScene.damageNumberHandler.add(pokemon, amount, damageResult, critical);
  }

  if (damageResult !== HitResult.INDIRECT && amount > 0) {
    await new Promise<void>(resolve => {
      const flashTimer = globalScene.time.addEvent({
        delay: 100,
        repeat: 5,
        startAt: 200,
        callback: () => {
          pokemon.getSprite().setVisible(flashTimer.repeatCount % 2 === 0);
          if (!flashTimer.repeatCount) {
            pokemon.updateInfo().then(resolve);
          }
        },
      });
    });
  } else {
    await pokemon.updateInfo();
  }
}
