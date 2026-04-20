// ABOUTME: Pure run-start blessing logic. Rolls 3 blessings and resolves the player's pick into outcomes.
// ABOUTME: No Phaser dependencies — the presentation layer (BlessingScene) reads view() and calls pick(blessingId).
import type { RunOutcome } from '../models/RunOutcome';
import { createRunRng } from '../run/rng';
import { pickBlessings, type BlessingDef } from '../content/blessings';

export interface BlessingOfferView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export interface BlessingView {
  readonly offers: ReadonlyArray<BlessingOfferView>;
}

export interface BlessingOptions {
  seed?: number;
  count?: number;
}

export class BlessingChoices {
  private readonly offers: BlessingDef[];
  private readonly rng: () => number;

  constructor(opts: BlessingOptions = {}) {
    const seed = opts.seed ?? Date.now();
    this.rng = createRunRng(seed);
    this.offers = pickBlessings(this.rng, opts.count ?? 3);
  }

  view(): BlessingView {
    return {
      offers: this.offers.map(b => ({ id: b.id, name: b.name, description: b.description })),
    };
  }

  /** Resolves the chosen blessing into outcomes. Returns [{none}] if id is unknown. */
  pick(id: string): RunOutcome[] {
    const chosen = this.offers.find(b => b.id === id);
    if (!chosen) return [{ kind: 'none' }];
    return chosen.resolve(this.rng);
  }
}
