// ABOUTME: Tests for the exotic card engine: Ethereal, Unplayable, selfDamage, onTurnEndSelf.
import { describe, it, expect } from 'vitest';
import { CombatState, TurnPhase } from '../src/models/CombatState';
import type { Card } from '../src/models/Card';
import { CardType, TargetType } from '../src/models/Card';

function ethereal(): Card {
  return {
    id: 'eth-1', title: 'EtherealCard', cost: 0, type: CardType.SKILL,
    target: TargetType.SELF, description: '',
    effect: { block: 1 },
    ethereal: true,
  };
}

function unplayableCurse(): Card {
  return {
    id: 'curse-1', title: 'Curse', cost: 0, type: CardType.SKILL,
    target: TargetType.SELF, description: '',
    effect: { onTurnEndSelf: 2 },
    unplayable: true,
  };
}

function selfFlagellate(): Card {
  return {
    id: 'sf-1', title: 'Self-Flagellation', cost: 0, type: CardType.SKILL,
    target: TargetType.SELF, description: '',
    effect: { draw: 1, selfDamage: 4 },
  };
}

describe('Ethereal', () => {
  it('exhausts at end of turn if still in hand', () => {
    const state = new CombatState();
    state.deck.hand = [ethereal()];
    state.endPlayerTurn();
    expect(state.deck.exhaustPile.some(c => c.id === 'eth-1')).toBe(true);
    expect(state.deck.discardPile.some(c => c.id === 'eth-1')).toBe(false);
  });
});

describe('Unplayable + onTurnEndSelf', () => {
  it('Unplayable card cannot be played (playCard returns not-ok)', () => {
    const state = new CombatState();
    state.currentPhase = TurnPhase.PLAYER_ACTION;
    const curse = unplayableCurse();
    state.deck.hand = [curse];
    const result = state.playCard(curse.id, state.player);
    expect(result.success).toBe(false);
  });

  it('onTurnEndSelf damages player at end of turn', () => {
    const state = new CombatState();
    state.player.hp = 50;
    state.deck.hand = [unplayableCurse()];
    state.endPlayerTurn();
    expect(state.player.hp).toBe(48);
  });
});

describe('selfDamage', () => {
  it('playing a selfDamage card deducts player hp', () => {
    const state = new CombatState();
    state.currentPhase = TurnPhase.PLAYER_ACTION;
    state.player.hp = 50;
    state.player.energy = 3;
    const c = selfFlagellate();
    state.deck.hand = [c];
    state.playCard(c.id, state.player);
    expect(state.player.hp).toBe(46);
  });
});
