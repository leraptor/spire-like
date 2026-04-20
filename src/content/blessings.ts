// ABOUTME: Run-start blessing pool. 3 random entries shown at BlessingScene.
// ABOUTME: Each blessing has a resolver that produces RunOutcome[] when chosen.
import type { RunOutcome } from '../models/RunOutcome';
import { POTIONS } from './potions';
import { RELICS } from './relics';
import { pickCardsByRarity } from './cards';
import { pickFrom, pickN } from '../run/rng';

export interface BlessingDef {
  id: string;
  name: string;
  description: string;
  resolve: (rng: () => number) => RunOutcome[];
}

export const BLESSINGS: readonly BlessingDef[] = [
  {
    id: 'bless_rare_card',
    name: 'Gift of Insight',
    description: 'Add 1 random rare card to your deck.',
    resolve: (rng) => {
      const card = pickCardsByRarity(rng, 1, 'rare')[0]!;
      return [{ kind: 'add_card', card }];
    },
  },
  {
    id: 'bless_relic',
    name: 'Gift of Memory',
    description: 'Gain 1 random relic.',
    resolve: (rng) => [{ kind: 'add_relic', relic: pickFrom(RELICS, rng) }],
  },
  {
    id: 'bless_vitality',
    name: 'Gift of Vitality',
    description: '+10 max HP and heal 10.',
    resolve: () => [{ kind: 'maxHp', amount: 10 }, { kind: 'heal', amount: 10 }],
  },
  {
    id: 'bless_wealth',
    name: 'Gift of Fortune',
    description: 'Start with +75 gold.',
    resolve: () => [{ kind: 'gold', amount: 75 }],
  },
  {
    id: 'bless_potions',
    name: 'Gift of Brewing',
    description: 'Start with 2 random potions.',
    resolve: (rng) => {
      const potions = pickN(POTIONS, 2, rng);
      return potions.map(p => ({ kind: 'add_potion' as const, potion: p }));
    },
  },
  {
    id: 'bless_power',
    name: 'Gift of Fire',
    description: 'Gain 1 permanent energy per turn.',
    resolve: () => [{ kind: 'energy', amount: 1 }],
  },
  {
    id: 'bless_knowledge',
    name: 'Gift of Sight',
    description: 'Draw 1 extra card each turn.',
    resolve: () => [{ kind: 'draw_bonus', amount: 1 }],
  },
] as const;

export function pickBlessings(rng: () => number, count: number = 3): BlessingDef[] {
  return pickN(BLESSINGS, count, rng);
}
