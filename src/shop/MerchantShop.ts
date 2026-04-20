// ABOUTME: Pure merchant business logic. Item generation, gold tracking, buy/leave outcome emission.
// ABOUTME: No Phaser dependencies — the presentation layer (MerchantScene) reads state and calls buy/leave.
import type { RunState, Potion, Relic } from '../models/RunState';
import type { RunOutcome } from '../models/RunOutcome';
import type { Card } from '../models/Card';
import { pickCardsByRarity } from '../content/cards';
import { RELICS } from '../content/relics';
import { POTIONS } from '../content/potions';
import { pickFrom } from '../run/rng';

export type ShopItemKind = 'card' | 'relic' | 'potion' | 'remove';

export interface ShopItem {
  readonly kind: ShopItemKind;
  readonly label: string;
  readonly sub: string;
  readonly description: string;
  readonly price: number;
  /** Energy cost — populated only for cards (used for the cost pip on the tile). */
  readonly cost?: number;
  readonly outcome: RunOutcome | null; // null = card removal service (handled on-resolve)
}

export interface MerchantView {
  readonly items: ReadonlyArray<ShopItem>;
  readonly goldAvailable: number;
  readonly purchased: ReadonlySet<number>;
}

export class MerchantShop {
  private readonly runState: Readonly<RunState>;
  private readonly items: ShopItem[];
  private goldSpent = 0;
  private readonly outcomesBuffer: RunOutcome[] = [];
  private readonly purchased = new Set<number>();

  constructor(runState: Readonly<RunState>, rng: () => number) {
    this.runState = runState;
    this.items = buildInventory(rng);
  }

  view(): MerchantView {
    return {
      items: this.items,
      goldAvailable: this.runState.gold - this.goldSpent,
      purchased: this.purchased,
    };
  }

  canAfford(itemIndex: number): boolean {
    const item = this.items[itemIndex];
    if (!item) return false;
    if (this.purchased.has(itemIndex)) return false;
    return this.runState.gold - this.goldSpent >= item.price;
  }

  buy(itemIndex: number): boolean {
    if (!this.canAfford(itemIndex)) return false;
    const item = this.items[itemIndex]!;
    this.goldSpent += item.price;
    this.purchased.add(itemIndex);
    if (item.outcome) this.outcomesBuffer.push(item.outcome);
    return true;
  }

  /** Final outcomes to apply when the player leaves the shop. */
  computeLeaveOutcomes(): RunOutcome[] {
    const outcomes: RunOutcome[] = [];
    if (this.goldSpent > 0) outcomes.push({ kind: 'gold', amount: -this.goldSpent });
    outcomes.push(...this.outcomesBuffer);
    if (outcomes.length === 0) outcomes.push({ kind: 'none' });
    return outcomes;
  }
}

/** Picks `n` distinct items from the pool. Falls back to duplicates if the pool is too small. */
function pickNDistinct<T>(pool: ReadonlyArray<T>, n: number, rng: () => number): T[] {
  const copy = [...pool];
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    if (copy.length === 0) {
      out.push(pickFrom(pool, rng));
      continue;
    }
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]!);
  }
  return out;
}

function buildInventory(rng: () => number): ShopItem[] {
  const cards: Card[] = [
    pickCardsByRarity(rng, 1, 'common')[0]!,
    pickCardsByRarity(rng, 1, 'uncommon')[0]!,
    pickCardsByRarity(rng, 1, 'rare')[0]!,
  ];
  const relics: Relic[] = pickNDistinct(RELICS, 2, rng);
  const potions: Potion[] = pickNDistinct(POTIONS, 2, rng);

  return [
    { kind: 'card',   label: cards[0]!.title, sub: 'common card',    description: cards[0]!.description,  cost: cards[0]!.cost, price: 50,  outcome: { kind: 'add_card', card: cards[0]! } },
    { kind: 'card',   label: cards[1]!.title, sub: 'uncommon card',  description: cards[1]!.description,  cost: cards[1]!.cost, price: 75,  outcome: { kind: 'add_card', card: cards[1]! } },
    { kind: 'card',   label: cards[2]!.title, sub: 'rare card',      description: cards[2]!.description,  cost: cards[2]!.cost, price: 100, outcome: { kind: 'add_card', card: cards[2]! } },
    { kind: 'relic',  label: relics[0]!.name, sub: 'common relic',   description: relics[0]!.description, price: 100, outcome: { kind: 'add_relic', relic: relics[0]! } },
    { kind: 'relic',  label: relics[1]!.name, sub: 'uncommon relic', description: relics[1]!.description, price: 150, outcome: { kind: 'add_relic', relic: relics[1]! } },
    { kind: 'potion', label: potions[0]!.name, sub: 'potion',        description: potions[0]!.description, price: 15, outcome: { kind: 'add_potion', potion: potions[0]! } },
    { kind: 'potion', label: potions[1]!.name, sub: 'potion',        description: potions[1]!.description, price: 15, outcome: { kind: 'add_potion', potion: potions[1]! } },
    { kind: 'remove', label: 'Card Removal',   sub: 'service',       description: 'Remove 1 card from your deck.', price: 50, outcome: null },
  ];
}
