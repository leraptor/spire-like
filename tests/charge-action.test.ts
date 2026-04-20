// ABOUTME: Verifies the Charge action type: resolves with no damage and grants strength to the enemy.
// ABOUTME: Validates intent display as gold "⚡ Charging" icon.

import { describe, it, expect } from 'vitest';
import { CombatState } from '../src/models/CombatState';

describe('Charge action', () => {
  it('resolves without damaging the player and grants strength to the enemy', () => {
    const state = new CombatState();
    state.nextEnemyAction = { type: 'Charge', damage: 0, strengthGain: 3 };
    const startingPlayerHp = state.player.hp;
    const startingEnemyStrength = state.enemy.strength;

    state.executeEnemyAction();

    expect(state.player.hp).toBe(startingPlayerHp);
    expect(state.enemy.strength).toBe(startingEnemyStrength + 3);
  });

  it('shows a "Charging" gold intent when the next action is Charge', () => {
    const state = new CombatState();
    state.nextEnemyAction = { type: 'Charge', damage: 0, strengthGain: 3 };

    const intent = state.getEnemyIntentDisplay();

    expect(intent.text).toBe('⚡ Charging');
    expect(intent.color).toBe('#fdcb6e');
  });
});
