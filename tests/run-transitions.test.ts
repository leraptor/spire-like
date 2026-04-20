// ABOUTME: Tests for all run-level pure transitions.
// ABOUTME: Each transition mutates state in place and optionally fires onStateChanged.
import { describe, it, expect, vi } from 'vitest';
import {
  gainGold, spendGold, takeDamage, heal, gainMaxHp,
  addCardToDeck, removeCardFromDeck, upgradeCard,
  addRelic, addPotion, usePotion,
  gainEnergy, gainDrawBonus, recordEnemyDefeated, setPhase,
} from '../src/run/transitions';
import type { RunState } from '../src/models/RunState';
import { POTIONS } from '../src/content/potions';
import { RELICS } from '../src/content/relics';
import { spawn } from '../src/content/cards';

function blankRunState(): RunState {
  return {
    regionId: 'withered-garden',
    runId: 'test-run',
    currentEpoch: 1,
    map: { regionId: '', seed: 0, nodes: [], edges: [], startNodeIds: [], bossNodeId: 'boss' },
    currentNodeId: null,
    visitedNodeIds: [],
    playerHp: 75,
    playerMaxHp: 75,
    gold: 0,
    baseEnergy: 3,
    bonusCardsPerTurn: 0,
    deck: [],
    upgradedCardIds: new Set(),
    relics: [],
    potions: [null, null, null],
    potionSlots: 3,
    phase: 'MAP',
    enemiesDefeated: 0,
  };
}

describe('gainGold / spendGold', () => {
  it('gainGold adds to gold and fires onStateChanged', () => {
    const s = blankRunState();
    const spy = vi.fn();
    s.onStateChanged = spy;
    gainGold(s, 50);
    expect(s.gold).toBe(50);
    expect(spy).toHaveBeenCalledWith(s);
  });

  it('spendGold deducts when sufficient, returns true', () => {
    const s = blankRunState();
    s.gold = 100;
    expect(spendGold(s, 30)).toBe(true);
    expect(s.gold).toBe(70);
  });

  it('spendGold refuses when insufficient, returns false, does not mutate', () => {
    const s = blankRunState();
    s.gold = 20;
    expect(spendGold(s, 30)).toBe(false);
    expect(s.gold).toBe(20);
  });
});

describe('takeDamage / heal / gainMaxHp', () => {
  it('takeDamage subtracts from hp, clamps to 0', () => {
    const s = blankRunState();
    takeDamage(s, 100);
    expect(s.playerHp).toBe(0);
  });

  it('takeDamage sets phase to DEATH when hp hits 0', () => {
    const s = blankRunState();
    takeDamage(s, 100);
    expect(s.phase).toBe('DEATH');
  });

  it('heal restores hp, clamps to maxHp', () => {
    const s = blankRunState();
    s.playerHp = 50;
    heal(s, 100);
    expect(s.playerHp).toBe(75);
  });

  it('gainMaxHp raises both max and current hp by the same amount', () => {
    const s = blankRunState();
    s.playerHp = 50; s.playerMaxHp = 75;
    gainMaxHp(s, 10);
    expect(s.playerMaxHp).toBe(85);
    expect(s.playerHp).toBe(60);
  });
});

describe('deck transitions', () => {
  it('addCardToDeck appends', () => {
    const s = blankRunState();
    addCardToDeck(s, spawn('Strike'));
    expect(s.deck.length).toBe(1);
  });

  it('removeCardFromDeck removes by id', () => {
    const s = blankRunState();
    const c = spawn('Strike');
    s.deck.push(c);
    removeCardFromDeck(s, c.id);
    expect(s.deck.length).toBe(0);
  });

  it('upgradeCard records the card id', () => {
    const s = blankRunState();
    upgradeCard(s, 'card-123');
    expect(s.upgradedCardIds.has('card-123')).toBe(true);
  });
});

describe('relic / potion transitions', () => {
  it('addRelic appends', () => {
    const s = blankRunState();
    addRelic(s, RELICS[0]!);
    expect(s.relics.length).toBe(1);
  });

  it('addPotion fills first empty slot, returns true', () => {
    const s = blankRunState();
    const ok = addPotion(s, POTIONS[0]!);
    expect(ok).toBe(true);
    expect(s.potions[0]).toBe(POTIONS[0]);
  });

  it('addPotion returns false when all slots full', () => {
    const s = blankRunState();
    s.potions = [POTIONS[0]!, POTIONS[1]!, POTIONS[2]!];
    expect(addPotion(s, POTIONS[0]!)).toBe(false);
  });

  it('usePotion clears the slot', () => {
    const s = blankRunState();
    s.potions[1] = POTIONS[0]!;
    usePotion(s, 1);
    expect(s.potions[1]).toBe(null);
  });
});

describe('permanent buffs', () => {
  it('gainEnergy increases baseEnergy', () => {
    const s = blankRunState();
    gainEnergy(s, 1);
    expect(s.baseEnergy).toBe(4);
  });

  it('gainDrawBonus increases bonusCardsPerTurn', () => {
    const s = blankRunState();
    gainDrawBonus(s, 1);
    expect(s.bonusCardsPerTurn).toBe(1);
  });
});

describe('metrics + phase', () => {
  it('recordEnemyDefeated increments', () => {
    const s = blankRunState();
    recordEnemyDefeated(s);
    recordEnemyDefeated(s);
    expect(s.enemiesDefeated).toBe(2);
  });

  it('setPhase changes phase and fires onStateChanged', () => {
    const s = blankRunState();
    const spy = vi.fn();
    s.onStateChanged = spy;
    setPhase(s, 'COMBAT');
    expect(s.phase).toBe('COMBAT');
    expect(spy).toHaveBeenCalledWith(s);
  });
});
