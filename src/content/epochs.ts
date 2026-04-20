// ABOUTME: Epoch definitions. Epoch 1 is default, epoch 2 unlocks when criteria met.
// ABOUTME: Session-only: unlock state lives in memory until page reload.
import type { RunState } from '../models/RunState';

export interface EpochDef {
  epoch: number;
  description: string;
  meetsUnlockCriteria: (state: Readonly<RunState>) => boolean;
  enemyHpMultiplier: number;
  potionSlots: number;
}

export const EPOCHS: readonly EpochDef[] = [
  {
    epoch: 1,
    description: 'The Withered Garden awakens.',
    meetsUnlockCriteria: () => false,
    enemyHpMultiplier: 1.0,
    potionSlots: 3,
  },
  {
    epoch: 2,
    description: 'The mist thickens. Enemies grow sturdier; your satchel expands.',
    meetsUnlockCriteria: (state) => state.enemiesDefeated >= 2,
    enemyHpMultiplier: 1.15,
    potionSlots: 4,
  },
] as const;

export function getEpoch(epoch: number): EpochDef {
  return EPOCHS.find(e => e.epoch === epoch) ?? EPOCHS[0]!;
}

export function nextUnlockableEpoch(state: Readonly<RunState>): EpochDef | null {
  const current = state.currentEpoch;
  const next = EPOCHS.find(e => e.epoch === current + 1);
  if (next && next.meetsUnlockCriteria(state)) return next;
  return null;
}
