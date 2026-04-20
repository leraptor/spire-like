// ABOUTME: Pure rest-site logic. Computes heal amount and emits outcomes on rest/skip.
// ABOUTME: No Phaser dependencies — the presentation layer (RestScene) reads view() and calls the as*Outcomes builders.
import type { RunOutcome } from '../models/RunOutcome';
import type { RunState } from '../models/RunState';

export interface RestView {
  readonly currentHp: number;
  readonly maxHp: number;
  readonly healAmount: number; // projected HP gain if the player rests
  readonly healedHp: number;   // projected HP after rest
}

export interface RestOptions {
  healPct?: number; // defaults to 0.30
}

export class RestChoice {
  private readonly currentHp: number;
  private readonly maxHp: number;
  private readonly healAmount: number;

  constructor(runState: Readonly<RunState>, opts: RestOptions = {}) {
    this.currentHp = runState.playerHp;
    this.maxHp = runState.playerMaxHp;
    const pct = opts.healPct ?? 0.30;
    this.healAmount = Math.min(this.maxHp - this.currentHp, Math.ceil(this.maxHp * pct));
  }

  view(): RestView {
    return {
      currentHp: this.currentHp,
      maxHp: this.maxHp,
      healAmount: this.healAmount,
      healedHp: this.currentHp + this.healAmount,
    };
  }

  asRestOutcomes(): RunOutcome[] {
    if (this.healAmount <= 0) return [{ kind: 'none' }];
    return [{ kind: 'heal', amount: this.healAmount }];
  }

  asSkipOutcomes(): RunOutcome[] {
    return [{ kind: 'none' }];
  }
}
