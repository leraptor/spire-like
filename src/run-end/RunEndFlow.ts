// ABOUTME: Pure logic for the three run-end screens (BossVictory / Death / EpochUnlock).
// ABOUTME: No Phaser dependencies — each scene consumes view() and calls nextAction() on confirm.
import type { RunState } from '../models/RunState';
import { nextUnlockableEpoch } from '../content/epochs';

export type NextAction =
  | { kind: 'show_epoch_unlock' }
  | { kind: 'restart_run'; epoch: number };

export interface BossVictoryView {
  readonly enemiesDefeated: number;
  readonly finalHp: number;
  readonly maxHp: number;
  readonly gold: number;
  readonly relicCount: number;
  readonly epoch: number;
}

export class BossVictoryFlow {
  constructor(private readonly runState: Readonly<RunState>) {}

  view(): BossVictoryView {
    return {
      enemiesDefeated: this.runState.enemiesDefeated,
      finalHp: this.runState.playerHp,
      maxHp: this.runState.playerMaxHp,
      gold: this.runState.gold,
      relicCount: this.runState.relics.length,
      epoch: this.runState.currentEpoch,
    };
  }

  nextAction(): NextAction {
    const unlock = nextUnlockableEpoch(this.runState);
    if (unlock) return { kind: 'show_epoch_unlock' };
    return { kind: 'restart_run', epoch: this.runState.currentEpoch };
  }
}

export interface DeathView {
  readonly enemiesDefeated: number;
  readonly gold: number;
  readonly relicCount: number;
  readonly epoch: number;
}

export class DeathFlow {
  constructor(private readonly runState: Readonly<RunState>) {}

  view(): DeathView {
    return {
      enemiesDefeated: this.runState.enemiesDefeated,
      gold: this.runState.gold,
      relicCount: this.runState.relics.length,
      epoch: this.runState.currentEpoch,
    };
  }

  nextAction(): NextAction {
    const unlock = nextUnlockableEpoch(this.runState);
    if (unlock) return { kind: 'show_epoch_unlock' };
    return { kind: 'restart_run', epoch: this.runState.currentEpoch };
  }
}

export interface EpochUnlockView {
  readonly epoch: number;
  readonly description: string;
  readonly enemyHpMultiplier: number;
  readonly potionSlots: number;
}

export class EpochUnlockFlow {
  private readonly epochDef: ReturnType<typeof nextUnlockableEpoch>;

  constructor(private readonly runState: Readonly<RunState>) {
    this.epochDef = nextUnlockableEpoch(runState);
  }

  /** Returns null if there's no pending unlock (scene should bail to MAP). */
  view(): EpochUnlockView | null {
    if (!this.epochDef) return null;
    return {
      epoch: this.epochDef.epoch,
      description: this.epochDef.description,
      enemyHpMultiplier: this.epochDef.enemyHpMultiplier,
      potionSlots: this.epochDef.potionSlots,
    };
  }

  nextAction(): NextAction {
    const targetEpoch = this.epochDef?.epoch ?? this.runState.currentEpoch;
    return { kind: 'restart_run', epoch: targetEpoch };
  }
}
