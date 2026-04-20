// ABOUTME: Region 1 card pool + exotic cards. Used by reward/merchant/blessing/event flows.
// ABOUTME: Separated by rarity; pickers weight by rarity.
import type { Card } from '../models/Card';
import { CardType, TargetType } from '../models/Card';

export type Rarity = 'common' | 'uncommon' | 'rare';

export interface CardDef {
  rarity: Rarity;
  template: Omit<Card, 'id'>;
}

function makeId(title: string): string {
  return `${title.toLowerCase().replace(/\s+/g, '_')}_${Math.random().toString(36).slice(2, 7)}`;
}

export function spawn(defTitle: string): Card {
  const def = CARD_POOL.find(d => d.template.title === defTitle);
  if (!def) throw new Error(`No card def: ${defTitle}`);
  return { ...def.template, id: makeId(def.template.title) };
}

export const CARD_POOL: readonly CardDef[] = [
  // Common
  {
    rarity: 'common',
    template: {
      title: 'Strike', cost: 1, type: CardType.ATTACK, target: TargetType.SINGLE_ENEMY,
      description: 'Deal 6 damage.',
      effect: { damage: 6 },
    },
  },
  {
    rarity: 'common',
    template: {
      title: 'Defend', cost: 1, type: CardType.SKILL, target: TargetType.SELF,
      description: 'Gain 5 block.',
      effect: { block: 5 },
    },
  },
  // Uncommon
  {
    rarity: 'uncommon',
    template: {
      title: 'Shockwave', cost: 2, type: CardType.ATTACK, target: TargetType.ALL_ENEMIES,
      description: 'Deal 8 damage. Apply Weak(2).',
      effect: { damage: 8, weak: 2 },
    },
  },
  {
    rarity: 'uncommon',
    template: {
      title: 'Flow', cost: 0, type: CardType.SKILL, target: TargetType.SELF,
      description: 'Draw 2 cards.',
      effect: { draw: 2 },
    },
  },
  // Rare
  {
    rarity: 'rare',
    template: {
      title: 'Empower', cost: 1, type: CardType.POWER, target: TargetType.SELF,
      description: 'Permanently gain Strength(2).',
      effect: { strength: 2 },
    },
  },
  // Exotic (rare tier, enabled by exotic card engine)
  {
    rarity: 'rare',
    template: {
      title: 'Wild Strike', cost: 1, type: CardType.ATTACK, target: TargetType.SINGLE_ENEMY,
      description: 'Deal 12 damage. Ethereal.',
      effect: { damage: 12 },
      ethereal: true,
    },
  },
  {
    rarity: 'uncommon',
    template: {
      title: 'Self-Flagellation', cost: 0, type: CardType.SKILL, target: TargetType.SELF,
      description: 'Draw 2 cards. Lose 4 HP.',
      effect: { draw: 2, selfDamage: 4 },
    },
  },
  {
    rarity: 'common',  // curses are "common tier" bad cards
    template: {
      title: 'Doubt', cost: 0, type: CardType.SKILL, target: TargetType.SELF,
      description: 'Unplayable. At end of turn, lose 2 HP.',
      effect: { onTurnEndSelf: 2 },
      unplayable: true,
    },
  },
] as const;

export function pickRandomCard(rng: () => number, filter?: (d: CardDef) => boolean): Card {
  const pool = filter ? CARD_POOL.filter(filter) : CARD_POOL;
  const def = pool[Math.floor(rng() * pool.length)]!;
  return { ...def.template, id: makeId(def.template.title) };
}

export function pickCardsByRarity(rng: () => number, count: number, rarity: Rarity): Card[] {
  const pool = CARD_POOL.filter(d => d.rarity === rarity);
  const chosen: Card[] = [];
  for (let i = 0; i < count; i++) {
    const def = pool[Math.floor(rng() * pool.length)]!;
    chosen.push({ ...def.template, id: makeId(def.template.title) });
  }
  return chosen;
}
