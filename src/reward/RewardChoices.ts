// ABOUTME: Pure post-combat reward logic. Rolls gold/card/potion choices and emits outcomes.
// ABOUTME: No Phaser dependencies — the presentation layer (RewardScene) reads `view()` and calls the `as*Outcomes` builders.
import type { Potion } from '../models/RunState';
import type { RunOutcome } from '../models/RunOutcome';
import type { Card } from '../models/Card';
import { pickCardsByRarity } from '../content/cards';
import { POTIONS } from '../content/potions';
import { createRunRng, pickFrom } from '../run/rng';

export interface RewardView {
  readonly gold: number;
  readonly cards: ReadonlyArray<Card>; // always 3 choices
  readonly potion: Potion | null;
}

export interface RewardOptions {
  elite?: boolean;
  seed?: number;
}

export class RewardChoices {
  private readonly gold: number;
  private readonly cards: Card[];
  private readonly potion: Potion | null;

  constructor(opts: RewardOptions = {}) {
    const rng = createRunRng(opts.seed ?? Date.now());
    const [goldMin, goldMax] = opts.elite ? [25, 40] : [10, 20];
    this.gold = goldMin + Math.floor(rng() * (goldMax - goldMin + 1));

    this.cards = [
      pickCardsByRarity(rng, 1, 'common')[0]!,
      pickCardsByRarity(rng, 1, 'uncommon')[0]!,
      pickCardsByRarity(rng, 1, 'uncommon')[0]!,
    ];

    const potionChance = opts.elite ? 0.6 : 0.4;
    this.potion = rng() < potionChance ? pickFrom(POTIONS, rng) : null;
  }

  view(): RewardView {
    return { gold: this.gold, cards: this.cards, potion: this.potion };
  }

  asGoldOutcomes(): RunOutcome[] {
    return [{ kind: 'gold', amount: this.gold }];
  }

  asCardOutcomes(picked: Card | null): RunOutcome[] {
    return picked ? [{ kind: 'add_card', card: picked }] : [{ kind: 'none' }];
  }

  asPotionOutcomes(): RunOutcome[] {
    if (!this.potion) return [{ kind: 'none' }];
    return [{ kind: 'add_potion', potion: this.potion }];
  }

  asSkipOutcomes(): RunOutcome[] {
    return [{ kind: 'none' }];
  }
}
