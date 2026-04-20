// ABOUTME: Mook AI. Always emits an Attack for 8-12 damage, no branching.
import type { BehaviorFn } from './index';

export const simpleAttack: BehaviorFn = () => ({
  type: 'Attack',
  damage: Math.floor(Math.random() * 5) + 8,
});
