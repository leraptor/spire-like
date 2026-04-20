// ABOUTME: Behavior registry keyed by EnemyDef.behaviorId.
// ABOUTME: CombatState.generateNextEnemyAction dispatches through BEHAVIORS on each turn.

import type { CombatEntity } from '../../models/CombatEntity';
import { bossPhases } from './boss_phases';
import { simpleAttack } from './simple_attack';
import { heavySlow } from './heavy_slow';
import { cyberKnightCharge } from './cyber_knight_charge';

export type EnemyAction = {
  type: 'Attack' | 'Defend' | 'Debuff' | 'Charge';
  damage: number;
  slam?: boolean;
  strengthGain?: number;
};

export type BehaviorCtx = {
  enemy: CombatEntity;
  player: CombatEntity;
  turnCount: number;
};

export type BehaviorFn = (ctx: BehaviorCtx) => EnemyAction;

export const BEHAVIORS: Record<string, BehaviorFn> = {
  simple_attack: simpleAttack,
  heavy_slow: heavySlow,
  boss_phases: bossPhases,
  cyber_knight_charge: cyberKnightCharge,
};
