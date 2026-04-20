// ABOUTME: Tests for buildFreshRun — constructs a fresh RunState for a new run/epoch.
import { describe, it, expect } from 'vitest';
import { buildFreshRun } from '../src/run/buildFreshRun';
import { witheredGardenBlueprint } from '../src/map/blueprints';

describe('buildFreshRun', () => {
  it('returns a RunState with expected defaults for epoch 1', () => {
    const s = buildFreshRun({ seed: 1, epoch: 1, blueprint: witheredGardenBlueprint });
    expect(s.regionId).toBe('withered-garden');
    expect(s.currentEpoch).toBe(1);
    expect(s.playerHp).toBe(75);
    expect(s.playerMaxHp).toBe(75);
    expect(s.gold).toBe(0);
    expect(s.baseEnergy).toBe(3);
    expect(s.bonusCardsPerTurn).toBe(0);
    expect(s.potions.length).toBe(3);
    expect(s.potions.every(p => p === null)).toBe(true);
    expect(s.potionSlots).toBe(3);
    expect(s.deck.length).toBe(10);  // 5 Strike + 4 Defend + 1 Flow as starting deck
    expect(s.relics.length).toBe(0);
    expect(s.enemiesDefeated).toBe(0);
    expect(s.phase).toBe('BLESSING');
  });

  it('uses epoch 2 modifiers when passed epoch 2', () => {
    const s = buildFreshRun({ seed: 1, epoch: 2, blueprint: witheredGardenBlueprint });
    expect(s.currentEpoch).toBe(2);
    expect(s.potionSlots).toBe(4);
    expect(s.potions.length).toBe(4);
  });

  it('generates a valid map', () => {
    const s = buildFreshRun({ seed: 1, epoch: 1, blueprint: witheredGardenBlueprint });
    expect(s.map.nodes.length).toBeGreaterThan(0);
    expect(s.map.bossNodeId).toBe('boss');
  });

  it('is deterministic for same seed', () => {
    const a = buildFreshRun({ seed: 42, epoch: 1, blueprint: witheredGardenBlueprint });
    const b = buildFreshRun({ seed: 42, epoch: 1, blueprint: witheredGardenBlueprint });
    expect(a.map.nodes.length).toBe(b.map.nodes.length);
    expect(a.deck.length).toBe(b.deck.length);
  });
});
