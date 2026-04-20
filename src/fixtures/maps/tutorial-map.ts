// ABOUTME: Hand-crafted map for debugging the MapScene with a predictable layout.
// ABOUTME: Load in dev mode via the URL param ?map=tutorial.
import type { RegionMap } from '../../models/RegionMap';

export const tutorialMap: RegionMap = {
  regionId: 'withered-garden',
  seed: -1,
  nodes: [
    { id: 'f1-l0', type: 'combat', floor: 1, lane: 0, data: { kind: 'combat', enemyId: 'thorn-creep' } },
    { id: 'f1-l2', type: 'combat', floor: 1, lane: 2, data: { kind: 'combat', enemyId: 'thorn-creep' } },
    { id: 'f2-l0', type: 'combat', floor: 2, lane: 0, data: { kind: 'combat', enemyId: 'fog-wisp' } },
    { id: 'f2-l1', type: 'event',  floor: 2, lane: 1, data: { kind: 'event',  eventId: 'placeholder' } },
    { id: 'f2-l2', type: 'combat', floor: 2, lane: 2, data: { kind: 'combat', enemyId: 'thorn-creep' } },
    { id: 'f3-l0', type: 'rest',   floor: 3, lane: 0, data: { kind: 'rest',   healPct: 0.30 } },
    { id: 'f3-l1', type: 'chest',  floor: 3, lane: 1, data: { kind: 'chest',  seed: 1234 } },
    { id: 'f3-l2', type: 'event',  floor: 3, lane: 2, data: { kind: 'event',  eventId: 'placeholder' } },
    { id: 'f4-l0', type: 'combat', floor: 4, lane: 0, data: { kind: 'combat', enemyId: 'thorn-creep' } },
    { id: 'f4-l1', type: 'elite',  floor: 4, lane: 1, data: { kind: 'elite',  enemyId: 'rot-golem' } },
    { id: 'f4-l2', type: 'event',  floor: 4, lane: 2, data: { kind: 'event',  eventId: 'placeholder' } },
    { id: 'boss',  type: 'boss',   floor: 5, lane: 1, data: { kind: 'boss',   enemyId: 'hollow-gardener' } },
  ],
  edges: [
    { from: 'f1-l0', to: 'f2-l0' }, { from: 'f1-l0', to: 'f2-l1' },
    { from: 'f1-l2', to: 'f2-l1' }, { from: 'f1-l2', to: 'f2-l2' },
    { from: 'f2-l0', to: 'f3-l0' }, { from: 'f2-l0', to: 'f3-l1' },
    { from: 'f2-l1', to: 'f3-l1' },
    { from: 'f2-l2', to: 'f3-l1' }, { from: 'f2-l2', to: 'f3-l2' },
    { from: 'f3-l0', to: 'f4-l0' }, { from: 'f3-l0', to: 'f4-l1' },
    { from: 'f3-l1', to: 'f4-l1' },
    { from: 'f3-l2', to: 'f4-l1' }, { from: 'f3-l2', to: 'f4-l2' },
    { from: 'f4-l0', to: 'boss' },
    { from: 'f4-l1', to: 'boss' },
    { from: 'f4-l2', to: 'boss' },
  ],
  startNodeIds: ['f1-l0', 'f1-l2'],
  bossNodeId: 'boss',
};
