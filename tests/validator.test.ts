// ABOUTME: Tests for validateRegionMap — one scenario per rule.
// ABOUTME: Starts from a known-good fixture map and perturbs it to violate each rule.
import { describe, it, expect } from 'vitest';
import { validateRegionMap } from '../src/map/validator';
import { witheredGardenBlueprint } from '../src/map/blueprints';
import type { RegionMap } from '../src/models/RegionMap';

function goodMap(): RegionMap {
  return {
    regionId: 'withered-garden',
    seed: 1,
    nodes: [
      { id: 'f1-l0', type: 'combat', floor: 1, lane: 0, data: { kind: 'combat', enemyId: 'thorn-creep' } },
      { id: 'f1-l2', type: 'combat', floor: 1, lane: 2, data: { kind: 'combat', enemyId: 'thorn-creep' } },
      { id: 'f2-l0', type: 'combat', floor: 2, lane: 0, data: { kind: 'combat', enemyId: 'thorn-creep' } },
      { id: 'f2-l1', type: 'event',  floor: 2, lane: 1, data: { kind: 'event',  eventId: 'placeholder' } },
      { id: 'f2-l2', type: 'combat', floor: 2, lane: 2, data: { kind: 'combat', enemyId: 'thorn-creep' } },
      { id: 'f3-l0', type: 'rest',   floor: 3, lane: 0, data: { kind: 'rest',   healPct: 0.30 } },
      { id: 'f3-l1', type: 'event',  floor: 3, lane: 1, data: { kind: 'event',  eventId: 'placeholder' } },
      { id: 'f3-l2', type: 'combat', floor: 3, lane: 2, data: { kind: 'combat', enemyId: 'thorn-creep' } },
      { id: 'f4-l0', type: 'combat', floor: 4, lane: 0, data: { kind: 'combat', enemyId: 'thorn-creep' } },
      { id: 'f4-l1', type: 'elite',  floor: 4, lane: 1, data: { kind: 'elite',  enemyId: 'rot-golem' } },
      { id: 'f4-l2', type: 'event',  floor: 4, lane: 2, data: { kind: 'event',  eventId: 'placeholder' } },
      { id: 'boss',  type: 'boss',   floor: 5, lane: 1, data: { kind: 'boss',   enemyId: 'hollow-gardener' } },
    ],
    edges: [
      { from: 'f1-l0', to: 'f2-l0' }, { from: 'f1-l0', to: 'f2-l1' },
      { from: 'f1-l2', to: 'f2-l1' }, { from: 'f1-l2', to: 'f2-l2' },
      { from: 'f2-l0', to: 'f3-l0' }, { from: 'f2-l1', to: 'f3-l1' },
      { from: 'f2-l2', to: 'f3-l2' },
      { from: 'f3-l0', to: 'f4-l0' }, { from: 'f3-l1', to: 'f4-l1' },
      { from: 'f3-l2', to: 'f4-l2' },
      { from: 'f4-l0', to: 'boss' }, { from: 'f4-l1', to: 'boss' }, { from: 'f4-l2', to: 'boss' },
    ],
    startNodeIds: ['f1-l0', 'f1-l2'],
    bossNodeId: 'boss',
  };
}

describe('validateRegionMap', () => {
  it('passes a well-formed map', () => {
    const res = validateRegionMap(goodMap(), witheredGardenBlueprint);
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it('catches dangling edge endpoints', () => {
    const m = goodMap();
    m.edges.push({ from: 'ghost', to: 'boss' });
    const res = validateRegionMap(m, witheredGardenBlueprint);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes('ghost'))).toBe(true);
  });

  it('catches downward edges', () => {
    const m = goodMap();
    m.edges.push({ from: 'f2-l0', to: 'f1-l0' });
    const res = validateRegionMap(m, witheredGardenBlueprint);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.toLowerCase().includes('downward') || e.toLowerCase().includes('upward'))).toBe(true);
  });

  it('catches start nodes not on floor 1', () => {
    const m = goodMap();
    m.startNodeIds = ['f2-l0'];
    const res = validateRegionMap(m, witheredGardenBlueprint);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.toLowerCase().includes('start'))).toBe(true);
  });

  it('catches missing or misplaced boss', () => {
    const m = goodMap();
    m.bossNodeId = 'ghost';
    const res = validateRegionMap(m, witheredGardenBlueprint);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.toLowerCase().includes('boss'))).toBe(true);
  });

  it('catches unreachable nodes (no incoming edges, not a start)', () => {
    const m = goodMap();
    m.edges = m.edges.filter(e => e.to !== 'f3-l1');
    const res = validateRegionMap(m, witheredGardenBlueprint);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes('f3-l1'))).toBe(true);
  });

  it('catches dead-end nodes (no outgoing edges, not the boss)', () => {
    const m = goodMap();
    m.edges = m.edges.filter(e => e.from !== 'f3-l2');
    const res = validateRegionMap(m, witheredGardenBlueprint);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes('f3-l2'))).toBe(true);
  });

  it('catches boss unreachable from a start', () => {
    const m = goodMap();
    // Remove f1-l2's only path up:
    m.edges = m.edges.filter(e => e.from !== 'f1-l2');
    const res = validateRegionMap(m, witheredGardenBlueprint);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.toLowerCase().includes('boss'))).toBe(true);
  });

  it('catches lane-crossing edges', () => {
    const m = goodMap();
    m.edges.push({ from: 'f1-l0', to: 'f2-l2' });
    const res = validateRegionMap(m, witheredGardenBlueprint);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.toLowerCase().includes('lane') || e.toLowerCase().includes('cross'))).toBe(true);
  });

  it('catches missing required types (floor 3 without rest or shop)', () => {
    const m = goodMap();
    const f3rest = m.nodes.find(n => n.id === 'f3-l0')!;
    f3rest.type = 'combat';
    f3rest.data = { kind: 'combat', enemyId: 'thorn-creep' };
    const res = validateRegionMap(m, witheredGardenBlueprint);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes('floor 3') || e.includes('rest') || e.includes('shop'))).toBe(true);
  });

  it('catches forbidden types on a floor', () => {
    const m = goodMap();
    const f1 = m.nodes.find(n => n.id === 'f1-l0')!;
    f1.type = 'boss';
    f1.data = { kind: 'boss', enemyId: 'x' };
    const res = validateRegionMap(m, witheredGardenBlueprint);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.toLowerCase().includes('floor 1'))).toBe(true);
  });
});
