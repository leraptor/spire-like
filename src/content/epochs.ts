// ABOUTME: Epoch definitions. Each epoch is an independent "difficulty / modifier tier" unlocked by a distinct goal.
// ABOUTME: Non-linear — any epoch can be unlocked when its goal is met at run-end. Session-only unlock state.
import type { RunState } from '../models/RunState';

export interface EpochDef {
  /** Stable numeric id. Used for selection + persistence. */
  epoch: number;
  /** Short display name shown on epoch cards + headers. */
  name: string;
  /** Thematic description shown on epoch cards + the unlock celebration. */
  description: string;
  /** Human-readable goal shown as a constant reminder on the timeline, even when locked. */
  goalLabel: string;
  /** Pure predicate evaluated on a completed run's final state. True = unlock this epoch. */
  meetsUnlockCriteria: (state: Readonly<RunState>) => boolean;
  /** Difficulty / content modifiers applied when a run is started in this epoch. */
  enemyHpMultiplier: number;
  potionSlots: number;
  /** Whether this epoch is unlocked by default (no goal needed). Only the base epoch should set this true. */
  unlockedByDefault?: boolean;
}

export const EPOCHS: readonly EpochDef[] = [
  {
    epoch: 1,
    name: 'The Withered Garden',
    description: 'The journey begins among fading blooms. A gentle introduction to the mists.',
    goalLabel: 'Starting path — always open.',
    meetsUnlockCriteria: () => false,
    enemyHpMultiplier: 1.0,
    potionSlots: 3,
    unlockedByDefault: true,
  },
  {
    epoch: 2,
    name: 'Thickening Mist',
    description: 'The mist grows heavier. Enemies are sturdier; your satchel expands.',
    goalLabel: 'Defeat 2 enemies in a single run.',
    meetsUnlockCriteria: (state) => state.enemiesDefeated >= 2,
    enemyHpMultiplier: 1.15,
    potionSlots: 4,
  },
  {
    epoch: 3,
    name: 'Lantern of Wealth',
    description: 'A merchant\'s path. Riches flow, but enemies hit harder to match.',
    goalLabel: 'Finish a run holding 100+ gold.',
    meetsUnlockCriteria: (state) => state.gold >= 100,
    enemyHpMultiplier: 1.1,
    potionSlots: 3,
  },
  {
    epoch: 4,
    name: 'The Ascetic\'s Way',
    description: 'Walk the empty road. No relics, expanded draughts.',
    goalLabel: 'Finish a run carrying zero relics.',
    meetsUnlockCriteria: (state) => state.relics.length === 0,
    enemyHpMultiplier: 1.0,
    potionSlots: 5,
  },
  {
    epoch: 5,
    name: 'Bloodbound Ember',
    description: 'Survive on a thread. Enemies strike hard, but your hand burns hotter.',
    goalLabel: 'Finish a run with 10 HP or less.',
    meetsUnlockCriteria: (state) => state.playerHp > 0 && state.playerHp <= 10,
    enemyHpMultiplier: 1.25,
    potionSlots: 3,
  },
] as const;

export function getEpoch(epoch: number): EpochDef {
  return EPOCHS.find(e => e.epoch === epoch) ?? EPOCHS[0]!;
}

/**
 * Current-run check: is there an epoch the player hasn't yet unlocked
 * whose criteria the live run state satisfies?
 */
export function nextUnlockableEpoch(state: Readonly<RunState>): EpochDef | null {
  for (const ep of EPOCHS) {
    if (ep.unlockedByDefault) continue;
    if (ep.epoch === state.currentEpoch) continue;
    if (ep.meetsUnlockCriteria(state)) return ep;
  }
  return null;
}
