// ABOUTME: Tests for analyzeMap — produces a human-readable health report for a RegionMap.
import { describe, it, expect } from 'vitest';
import { analyzeMap } from '../src/map/analyzer';
import { generateRegionMap } from '../src/map/generator';
import { witheredGardenBlueprint } from '../src/map/blueprints';

describe('analyzeMap', () => {
  it('counts nodes by type correctly', () => {
    const map = generateRegionMap(witheredGardenBlueprint, 1);
    const a = analyzeMap(map);
    const totalFromCounts = Object.values(a.nodeCounts).reduce((s, n) => s + n, 0);
    expect(totalFromCounts).toBe(map.nodes.length);
    expect(a.nodeCounts.boss).toBe(1);
  });

  it('reports at least one distinct path for a valid map', () => {
    const map = generateRegionMap(witheredGardenBlueprint, 1);
    const a = analyzeMap(map);
    expect(a.distinctPathCount).toBeGreaterThan(0);
    expect(a.shortestPathLength).toBeGreaterThan(0);
    expect(a.longestPathLength).toBeGreaterThanOrEqual(a.shortestPathLength);
  });

  it('produces a stable snapshot for seed 1', () => {
    const map = generateRegionMap(witheredGardenBlueprint, 1);
    const a = analyzeMap(map);
    // Snapshot just the integer-valued summary (not warnings — those may be text-unstable).
    const summary = {
      nodeCounts: a.nodeCounts,
      shortestPathLength: a.shortestPathLength,
      longestPathLength: a.longestPathLength,
      distinctPathCount: a.distinctPathCount,
    };
    expect(summary).toMatchSnapshot();
  });

  it('emits a warning for a path with many combats and no rests', () => {
    // Build a tiny bad map manually: 3 floors, all combat, single path.
    const bad = {
      regionId: 'test',
      seed: 0,
      nodes: [
        { id: 'f1-l0', type: 'combat' as const, floor: 1, lane: 0, data: { kind: 'combat' as const, enemyId: 'x' } },
        { id: 'f2-l0', type: 'combat' as const, floor: 2, lane: 0, data: { kind: 'combat' as const, enemyId: 'x' } },
        { id: 'f3-l0', type: 'combat' as const, floor: 3, lane: 0, data: { kind: 'combat' as const, enemyId: 'x' } },
        { id: 'f4-l0', type: 'combat' as const, floor: 4, lane: 0, data: { kind: 'combat' as const, enemyId: 'x' } },
        { id: 'boss',  type: 'boss'   as const, floor: 5, lane: 0, data: { kind: 'boss'   as const, enemyId: 'b' } },
      ],
      edges: [
        { from: 'f1-l0', to: 'f2-l0' },
        { from: 'f2-l0', to: 'f3-l0' },
        { from: 'f3-l0', to: 'f4-l0' },
        { from: 'f4-l0', to: 'boss' },
      ],
      startNodeIds: ['f1-l0'],
      bossNodeId: 'boss',
    };
    const a = analyzeMap(bad);
    expect(a.warnings.some(w => w.toLowerCase().includes('combat'))).toBe(true);
  });
});
