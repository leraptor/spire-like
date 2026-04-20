// ABOUTME: All potion definitions. Pure data; combat/map modals reference these by id.
// ABOUTME: Content is skeletal (3 potions); extend by appending new Potion entries.
import type { Potion } from '../models/RunState';

export const POTIONS: readonly Potion[] = [
  {
    id: 'potion_heal',
    name: 'Heal Draft',
    description: 'Restore 25 HP.',
    usableInMap: true,
    usableInCombat: true,
    targets: 'self',
    effect: { kind: 'heal', amount: 25 },
  },
  {
    id: 'potion_power',
    name: 'Power Elixir',
    description: 'Gain 1 energy this turn.',
    usableInMap: false,
    usableInCombat: true,
    targets: 'self',
    effect: { kind: 'energy', amount: 1 },
  },
  {
    id: 'potion_vulnerable',
    name: 'Vulnerable Vial',
    description: 'Apply Vulnerable(3) to target enemy.',
    usableInMap: false,
    usableInCombat: true,
    targets: 'enemy',
    effect: { kind: 'vulnerable', stacks: 3 },
  },
] as const;

export function getPotionById(id: string): Potion | undefined {
  return POTIONS.find(p => p.id === id);
}
