// ABOUTME: Tests that epoch 2 unlocks after 2 enemy defeats.
import { describe, it, expect } from 'vitest';
import { nextUnlockableEpoch, getEpoch } from '../src/content/epochs';
import { recordEnemyDefeated } from '../src/run/transitions';
import { buildFreshRun } from '../src/run/buildFreshRun';
import { witheredGardenBlueprint } from '../src/map/blueprints';

describe('epoch unlock', () => {
  it('epoch 2 unlocks after 2 enemy defeats', () => {
    const s = buildFreshRun({ seed: 1, epoch: 1, blueprint: witheredGardenBlueprint });
    expect(nextUnlockableEpoch(s)).toBeNull();
    recordEnemyDefeated(s);
    expect(nextUnlockableEpoch(s)).toBeNull();
    recordEnemyDefeated(s);
    const unlocked = nextUnlockableEpoch(s);
    expect(unlocked).not.toBeNull();
    expect(unlocked!.epoch).toBe(2);
  });

  it('epoch 2 has +15% enemy HP and 4 potion slots', () => {
    const e2 = getEpoch(2);
    expect(e2.enemyHpMultiplier).toBeCloseTo(1.15);
    expect(e2.potionSlots).toBe(4);
  });
});
