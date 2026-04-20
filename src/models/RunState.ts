// ABOUTME: RunState is the central run-level model — player, inventory, map nav, phase machine.
// ABOUTME: All mutations go through pure transitions in src/run/transitions.ts.
import type { RegionMap } from './RegionMap';
import type { Card } from './Card';

export type RunPhase =
  | 'BLESSING'
  | 'MAP'
  | 'COMBAT'
  | 'REWARD'
  | 'CHEST'
  | 'MERCHANT'
  | 'EVENT'
  | 'REST'
  | 'BOSS_VICTORY'
  | 'DEATH'
  | 'EPOCH_UNLOCK';

export type PotionEffect =
  | { kind: 'heal';       amount: number }
  | { kind: 'energy';     amount: number }
  | { kind: 'vulnerable'; stacks: number }
  | { kind: 'add_card';   card: Card };

export interface Potion {
  id: string;
  name: string;
  description: string;
  usableInMap: boolean;
  usableInCombat: boolean;
  targets: 'none' | 'enemy' | 'self';
  effect: PotionEffect;
}

export type RelicEffect =
  | { kind: 'gain_block';              amount: number }
  | { kind: 'gain_energy_first_turn';  amount: number }
  | { kind: 'shop_discount';           pct: number };

export interface Relic {
  id: string;
  name: string;
  description: string;
  trigger: 'turn_start' | 'combat_start' | 'first_turn' | 'passive';
  effect: RelicEffect;
}

export interface RunState {
  regionId: string;
  runId: string;
  currentEpoch: number;

  map: RegionMap;
  currentNodeId: string | null;
  visitedNodeIds: string[];

  playerHp: number;
  playerMaxHp: number;
  gold: number;
  baseEnergy: number;
  bonusCardsPerTurn: number;

  deck: Card[];
  upgradedCardIds: Set<string>;
  relics: Relic[];
  potions: (Potion | null)[];
  potionSlots: number;

  phase: RunPhase;
  enemiesDefeated: number;

  onStateChanged?: (state: RunState) => void;
}
