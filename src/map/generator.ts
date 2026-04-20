// ABOUTME: Procedural map generator. Given a RegionBlueprint and a seed, returns a valid RegionMap.
// ABOUTME: Retries with incremented seeds on validation failure (bounded to 10 attempts).
import type { RegionMap, MapNode, MapEdge, NodeType, NodeData } from '../models/RegionMap';
import type { RegionBlueprint, FloorRule } from '../models/RegionBlueprint';
import { createRng } from './rng';
import { validateRegionMap } from './validator';

const BOSS_ID = 'boss';
const MAX_RETRIES = 10;

export function generateRegionMap(blueprint: RegionBlueprint, seed: number): RegionMap {
  let lastErrors: string[] = [];
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const tryMap = generateOnce(blueprint, seed + attempt);
    const result = validateRegionMap(tryMap, blueprint);
    if (result.valid) {
      return { ...tryMap, seed };
    }
    lastErrors = result.errors;
  }
  throw new Error(
    `generateRegionMap: failed after ${MAX_RETRIES} attempts starting at seed ${seed}. ` +
    `Last errors: ${lastErrors.join(' | ')}`,
  );
}

function generateOnce(blueprint: RegionBlueprint, seed: number): RegionMap {
  const rng = createRng(seed);
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];

  // Step 1: Fill nodes per floor rule.
  for (const rule of blueprint.floorRules) {
    const typesPerLane = assignTypesForFloor(rule, rng);
    rule.lanes.forEach((lane, i) => {
      const t = typesPerLane[i]!;
      const id = t === 'boss' ? BOSS_ID : `f${rule.floor}-l${lane}`;
      nodes.push({ id, type: t, floor: rule.floor, lane, data: makeNodeData(t, blueprint, rng) });
    });
  }

  // Step 2: Connect floors with non-crossing edges.
  const floors = groupByFloor(nodes);
  const firstRule = blueprint.floorRules[0]!;
  const lastRule = blueprint.floorRules[blueprint.floorRules.length - 1]!;
  for (let f = firstRule.floor; f < lastRule.floor; f++) {
    const cur = floors.get(f) ?? [];
    const nxt = floors.get(f + 1) ?? [];
    for (const from of cur) {
      const eligible = nxt.filter(n => Math.abs(n.lane - from.lane) <= 1);
      if (eligible.length === 0) continue;
      const howMany = rng() < 0.3 && eligible.length >= 2 ? 2 : 1;
      const picks = pickN(eligible, howMany, rng);
      for (const to of picks) edges.push({ from: from.id, to: to.id });
    }
  }

  // Step 3: Reachability pass — force boss-reachability from every floor-(top-1) node.
  const topFloor = lastRule.floor;
  const preBossFloor = topFloor - 1;
  const preBossNodes = (floors.get(preBossFloor) ?? []);
  for (const n of preBossNodes) {
    if (!edges.some(e => e.from === n.id)) edges.push({ from: n.id, to: BOSS_ID });
  }

  // Step 4: Orphan pass — every non-start node needs an incoming edge.
  const startFloor = firstRule.floor;
  for (let f = startFloor + 1; f <= topFloor; f++) {
    const curNodes = floors.get(f) ?? [];
    const below = floors.get(f - 1) ?? [];
    for (const n of curNodes) {
      if (edges.some(e => e.to === n.id)) continue;
      // Only consider lane-adjacent nodes so we don't create lane-crossing edges.
      const laneAdjacent = below.filter(b => Math.abs(b.lane - n.lane) <= 1);
      const closest = nearestBelow(n.lane, laneAdjacent);
      if (closest) edges.push({ from: closest.id, to: n.id });
    }
  }

  // Step 5: De-duplicate edges.
  const seenEdge = new Set<string>();
  const deduped: MapEdge[] = [];
  for (const e of edges) {
    const k = `${e.from}->${e.to}`;
    if (!seenEdge.has(k)) { seenEdge.add(k); deduped.push(e); }
  }

  const startNodeIds = (floors.get(startFloor) ?? []).map(n => n.id);

  return {
    regionId: blueprint.regionId,
    seed,
    nodes,
    edges: deduped,
    startNodeIds,
    bossNodeId: BOSS_ID,
  };
}

function assignTypesForFloor(rule: FloorRule, rng: () => number): NodeType[] {
  // Build a bag: start with one instance of each required type (honoring exact/min),
  // then fill remaining slots with allowed types.
  const slots = rule.lanes.length;
  const assigned: NodeType[] = [];

  // First pass: satisfy required minima.
  for (const req of rule.required ?? []) {
    const need = req.exact ?? req.min ?? 1;
    for (let i = 0; i < need; i++) {
      // Pick a type from req.types that is allowed on this floor.
      const choices = req.types.filter(t => rule.allowedTypes.includes(t));
      if (choices.length === 0) continue;
      assigned.push(choices[Math.floor(rng() * choices.length)]!);
    }
  }

  // Truncate if requireds overflowed (shouldn't happen for well-formed blueprints).
  while (assigned.length > slots) assigned.pop();

  // Second pass: fill remaining slots with random allowed types.
  while (assigned.length < slots) {
    assigned.push(rule.allowedTypes[Math.floor(rng() * rule.allowedTypes.length)]!);
  }

  // Shuffle so required types don't always land in lane 0.
  for (let i = assigned.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = assigned[i]!;
    assigned[i] = assigned[j]!;
    assigned[j] = tmp;
  }

  // If the floor requires `exact` counts, enforce them post-shuffle.
  for (const req of rule.required ?? []) {
    if (req.exact === undefined) continue;
    let count = assigned.filter(t => req.types.includes(t)).length;
    if (count === req.exact) continue;
    if (count < req.exact) {
      // Replace non-required slots with a required type. Pick the fill type
      // fresh per slot so multi-type required sets don't collapse to one type.
      for (let i = 0; i < assigned.length && count < req.exact; i++) {
        const fillType = req.types[Math.floor(rng() * req.types.length)]!;
        const current = assigned[i]!;
        if (!req.types.includes(current) && rule.allowedTypes.includes(fillType)) {
          assigned[i] = fillType;
          count++;
        }
      }
    } else {
      // Over-count: replace extras with a non-required allowed type.
      const replaceType = rule.allowedTypes.find(t => !req.types.includes(t));
      if (replaceType) {
        for (let i = 0; i < assigned.length && count > req.exact; i++) {
          const current = assigned[i]!;
          if (req.types.includes(current)) {
            assigned[i] = replaceType;
            count--;
          }
        }
      }
    }
  }

  return assigned;
}

function makeNodeData(type: NodeType, blueprint: RegionBlueprint, rng: () => number): NodeData {
  switch (type) {
    case 'combat':
      return { kind: 'combat', enemyId: pickFrom(blueprint.enemyPools.normal, rng) };
    case 'elite':
      return { kind: 'elite', enemyId: pickFrom(blueprint.enemyPools.elite, rng) };
    case 'boss':
      return { kind: 'boss', enemyId: blueprint.enemyPools.boss };
    case 'rest':
      return { kind: 'rest', healPct: 0.30 };
    case 'event':
      return { kind: 'event', eventId: 'placeholder' };
    case 'shop':
      return { kind: 'shop', seed: Math.floor(rng() * 1_000_000) };
    case 'chest':
      return { kind: 'chest', seed: Math.floor(rng() * 1_000_000) };
  }
}

function pickFrom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function pickN<T>(arr: T[], n: number, rng: () => number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]!);
  }
  return out;
}

function groupByFloor(nodes: MapNode[]): Map<number, MapNode[]> {
  const m = new Map<number, MapNode[]>();
  for (const n of nodes) {
    if (!m.has(n.floor)) m.set(n.floor, []);
    m.get(n.floor)!.push(n);
  }
  return m;
}

function nearestBelow(lane: number, below: MapNode[]): MapNode | undefined {
  if (below.length === 0) return undefined;
  let best = below[0]!;
  let bestDist = Math.abs(best.lane - lane);
  for (const n of below) {
    const d = Math.abs(n.lane - lane);
    if (d < bestDist) { best = n; bestDist = d; }
  }
  return best;
}
