// ABOUTME: Tests for generateRegionMap — seeded, deterministic, always produces valid maps.
import { describe, it, expect } from 'vitest';
import { generateRegionMap } from '../src/map/generator';
import { validateRegionMap } from '../src/map/validator';
import { witheredGardenBlueprint } from '../src/map/blueprints';

describe('generateRegionMap', () => {
  it('produces a valid map for seed 1', () => {
    const map = generateRegionMap(witheredGardenBlueprint, 1);
    const res = validateRegionMap(map, witheredGardenBlueprint);
    expect(res.errors).toEqual([]);
    expect(res.valid).toBe(true);
  });

  it('is deterministic given the same seed', () => {
    const a = generateRegionMap(witheredGardenBlueprint, 7);
    const b = generateRegionMap(witheredGardenBlueprint, 7);
    expect(a).toEqual(b);
  });

  it('produces valid maps across 1000 random seeds', () => {
    const failed: { seed: number; errors: string[] }[] = [];
    for (let seed = 1; seed <= 1000; seed++) {
      const map = generateRegionMap(witheredGardenBlueprint, seed);
      const res = validateRegionMap(map, witheredGardenBlueprint);
      if (!res.valid) failed.push({ seed, errors: res.errors });
    }
    expect(failed).toEqual([]);
  });

  it('sets the stored seed on the generated map', () => {
    const map = generateRegionMap(witheredGardenBlueprint, 42);
    expect(map.seed).toBe(42);
    expect(map.regionId).toBe('withered-garden');
  });

  it('always has exactly one boss node with id "boss" on the top floor', () => {
    const map = generateRegionMap(witheredGardenBlueprint, 99);
    const bosses = map.nodes.filter(n => n.type === 'boss');
    expect(bosses).toHaveLength(1);
    expect(bosses[0]!.id).toBe('boss');
    expect(map.bossNodeId).toBe('boss');
    expect(bosses[0]!.floor).toBe(5);
  });

  it('populates NodeData for every node', () => {
    const map = generateRegionMap(witheredGardenBlueprint, 3);
    for (const n of map.nodes) {
      expect(n.data).toBeDefined();
      expect(n.data?.kind).toBe(n.type);
    }
  });
});
