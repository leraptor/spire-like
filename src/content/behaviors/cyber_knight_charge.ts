// ABOUTME: Cyber Knight AI. Alternates Charge (strengthGain +3, no damage) with Strike (base 30 Attack).
// ABOUTME: Strength accumulates across cycles so consecutive Strikes escalate via calculateDamage.
import type { BehaviorFn } from './index';

export const cyberKnightCharge: BehaviorFn = ({ turnCount }) => {
  if (turnCount % 2 === 1) {
    return { type: 'Charge', damage: 0, strengthGain: 3 };
  }
  return { type: 'Attack', damage: 30 };
};
