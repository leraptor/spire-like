// ABOUTME: All relic definitions. Effects are resolved by CombatState hooks based on trigger.
// ABOUTME: Skeletal set (3 relics); extend by appending.
import type { Relic } from '../models/RunState';

export const RELICS: readonly Relic[] = [
  {
    id: 'relic_bronze_scales',
    name: 'Bronze Scales',
    description: 'Gain 4 block at the start of each turn.',
    trigger: 'turn_start',
    effect: { kind: 'gain_block', amount: 4 },
  },
  {
    id: 'relic_anchor',
    name: 'Anchor',
    description: 'Gain 10 block at the start of each combat.',
    trigger: 'combat_start',
    effect: { kind: 'gain_block', amount: 10 },
  },
  {
    id: 'relic_lantern',
    name: 'Lantern',
    description: '+1 energy on the first turn of each combat.',
    trigger: 'first_turn',
    effect: { kind: 'gain_energy_first_turn', amount: 1 },
  },
] as const;

export function getRelicById(id: string): Relic | undefined {
  return RELICS.find(r => r.id === id);
}
