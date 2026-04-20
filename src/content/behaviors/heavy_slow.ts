// ABOUTME: Alternating heavy-hitter AI. Attack for 18-22 on odd turns, Defend on even turns.
import type { BehaviorFn } from './index';

export const heavySlow: BehaviorFn = ({ turnCount }) => {
  if (turnCount % 2 === 1) {
    return { type: 'Attack', damage: Math.floor(Math.random() * 5) + 18 };
  }
  return { type: 'Defend', damage: 0 };
};
