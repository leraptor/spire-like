// ABOUTME: Tests that applyOutcomes dispatches each RunOutcome kind to the right transition.
// ABOUTME: Validates behavior for gold, heal, add_relic, add_potion, add_card, maxHp, damage, energy, draw_bonus, enter_combat, and none.
import { describe, it, expect } from 'vitest';
import { applyOutcomes } from '../src/run/applyOutcomes';
import type { RunOutcome } from '../src/models/RunOutcome';
import type { RunState } from '../src/models/RunState';
import { POTIONS } from '../src/content/potions';
import { RELICS } from '../src/content/relics';
import { spawn } from '../src/content/cards';

function blankState(): RunState {
  return {
    regionId: 'x', runId: 'x', currentEpoch: 1,
    map: { regionId: '', seed: 0, nodes: [], edges: [], startNodeIds: [], bossNodeId: 'boss' },
    currentNodeId: null, visitedNodeIds: [],
    playerHp: 75, playerMaxHp: 75, gold: 0, baseEnergy: 3, bonusCardsPerTurn: 0,
    deck: [], upgradedCardIds: new Set(), relics: [], potions: [null, null, null], potionSlots: 3,
    phase: 'MAP', enemiesDefeated: 0,
  };
}

describe('applyOutcomes', () => {
  it('applies gold', () => {
    const s = blankState();
    applyOutcomes(s, [{ kind: 'gold', amount: 30 }]);
    expect(s.gold).toBe(30);
  });

  it('applies heal', () => {
    const s = blankState();
    s.playerHp = 50;
    applyOutcomes(s, [{ kind: 'heal', amount: 10 }]);
    expect(s.playerHp).toBe(60);
  });

  it('applies add_relic', () => {
    const s = blankState();
    applyOutcomes(s, [{ kind: 'add_relic', relic: RELICS[0]! }]);
    expect(s.relics.length).toBe(1);
  });

  it('applies add_potion', () => {
    const s = blankState();
    applyOutcomes(s, [{ kind: 'add_potion', potion: POTIONS[0]! }]);
    expect(s.potions[0]).toBe(POTIONS[0]);
  });

  it('applies add_card', () => {
    const s = blankState();
    applyOutcomes(s, [{ kind: 'add_card', card: spawn('Strike') }]);
    expect(s.deck.length).toBe(1);
  });

  it('applies maxHp (raises max and current)', () => {
    const s = blankState();
    applyOutcomes(s, [{ kind: 'maxHp', amount: 10 }]);
    expect(s.playerMaxHp).toBe(85);
    expect(s.playerHp).toBe(85);
  });

  it('applies damage', () => {
    const s = blankState();
    applyOutcomes(s, [{ kind: 'damage', amount: 10 }]);
    expect(s.playerHp).toBe(65);
  });

  it('applies energy (permanent)', () => {
    const s = blankState();
    applyOutcomes(s, [{ kind: 'energy', amount: 1 }]);
    expect(s.baseEnergy).toBe(4);
  });

  it('applies draw_bonus', () => {
    const s = blankState();
    applyOutcomes(s, [{ kind: 'draw_bonus', amount: 1 }]);
    expect(s.bonusCardsPerTurn).toBe(1);
  });

  it('enter_combat sets phase to COMBAT', () => {
    const s = blankState();
    applyOutcomes(s, [{ kind: 'enter_combat', enemyId: 'thorn-creep', returnPhase: 'MAP' }]);
    expect(s.phase).toBe('COMBAT');
  });

  it('none is a no-op', () => {
    const s = blankState();
    applyOutcomes(s, [{ kind: 'none' }]);
    expect(s.gold).toBe(0);
  });

  it('applies a batch in order', () => {
    const s = blankState();
    applyOutcomes(s, [
      { kind: 'gold', amount: 50 },
      { kind: 'damage', amount: 10 },
      { kind: 'heal', amount: 5 },
    ]);
    expect(s.gold).toBe(50);
    expect(s.playerHp).toBe(70);
  });
});
