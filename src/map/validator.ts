// ABOUTME: Pure validator for RegionMap instances against a RegionBlueprint.
// ABOUTME: Returns a list of human-readable errors; reused by generator retries and by tests.
import type { RegionMap, MapNode } from '../models/RegionMap';
import type { RegionBlueprint, RequiredCount } from '../models/RegionBlueprint';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateRegionMap(map: RegionMap, blueprint: RegionBlueprint): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const nodesById = new Map<string, MapNode>();
  for (const n of map.nodes) nodesById.set(n.id, n);

  // 1. Edge endpoints exist.
  for (const e of map.edges) {
    if (!nodesById.has(e.from)) errors.push(`edge endpoint not found: ${e.from}`);
    if (!nodesById.has(e.to))   errors.push(`edge endpoint not found: ${e.to}`);
  }

  // 2. Edges go strictly upward.
  for (const e of map.edges) {
    const a = nodesById.get(e.from);
    const b = nodesById.get(e.to);
    if (a && b && a.floor >= b.floor) {
      errors.push(`edge ${e.from}->${e.to} is not upward (floor ${a.floor} -> ${b.floor})`);
    }
  }

  // 3. Start nodes on floor 1.
  for (const id of map.startNodeIds) {
    const n = nodesById.get(id);
    if (!n) { errors.push(`start node not found: ${id}`); continue; }
    if (n.floor !== 1) errors.push(`start node ${id} is not on floor 1 (floor ${n.floor})`);
  }

  // 4. Boss node exists, is type boss, and is on the top floor.
  const topFloor = Math.max(...blueprint.floorRules.map(f => f.floor));
  const boss = nodesById.get(map.bossNodeId);
  if (!boss) {
    errors.push(`boss node not found: ${map.bossNodeId}`);
  } else {
    if (boss.type !== 'boss') errors.push(`boss node ${boss.id} is not type 'boss' (type ${boss.type})`);
    if (boss.floor !== topFloor) errors.push(`boss node ${boss.id} is not on top floor ${topFloor} (floor ${boss.floor})`);
  }

  // 5. Every non-start node has >=1 incoming edge.
  // 6. Every non-boss node has >=1 outgoing edge.
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const n of map.nodes) { incoming.set(n.id, 0); outgoing.set(n.id, 0); }
  for (const e of map.edges) {
    if (incoming.has(e.to)) incoming.set(e.to, incoming.get(e.to)! + 1);
    if (outgoing.has(e.from)) outgoing.set(e.from, outgoing.get(e.from)! + 1);
  }
  const startSet = new Set(map.startNodeIds);
  for (const n of map.nodes) {
    if (!startSet.has(n.id) && (incoming.get(n.id) ?? 0) === 0) {
      errors.push(`node ${n.id} has no incoming edge and is not a start node`);
    }
    if (n.id !== map.bossNodeId && (outgoing.get(n.id) ?? 0) === 0) {
      errors.push(`node ${n.id} has no outgoing edge and is not the boss`);
    }
  }

  // 7. Boss reachable from every start (BFS per start).
  const adj = new Map<string, string[]>();
  for (const n of map.nodes) adj.set(n.id, []);
  for (const e of map.edges) {
    if (adj.has(e.from)) adj.get(e.from)!.push(e.to);
  }
  for (const startId of map.startNodeIds) {
    if (!nodesById.has(startId)) continue;
    const visited = new Set<string>([startId]);
    const queue = [startId];
    let reached = false;
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur === map.bossNodeId) { reached = true; break; }
      for (const nxt of adj.get(cur) ?? []) {
        if (!visited.has(nxt)) { visited.add(nxt); queue.push(nxt); }
      }
    }
    if (!reached) errors.push(`boss is not reachable from start ${startId}`);
  }

  // 8. No lane-crossing edges (|dLane| <= 1).
  for (const e of map.edges) {
    const a = nodesById.get(e.from);
    const b = nodesById.get(e.to);
    if (a && b && Math.abs(a.lane - b.lane) > 1) {
      errors.push(`edge ${e.from}->${e.to} crosses lanes (|${a.lane}-${b.lane}| > 1)`);
    }
  }

  // 9. Floor rules: required counts and forbidden types.
  for (const rule of blueprint.floorRules) {
    const floorNodes = map.nodes.filter(n => n.floor === rule.floor);
    // Forbidden type detection:
    for (const n of floorNodes) {
      if (!rule.allowedTypes.includes(n.type)) {
        errors.push(`node ${n.id} has type ${n.type} which is not allowed on floor ${rule.floor}`);
      }
    }
    // Required counts:
    for (const req of rule.required ?? []) {
      const matchCount = floorNodes.filter(n => req.types.includes(n.type)).length;
      const min = req.exact ?? req.min ?? 1;
      const max = req.exact ?? req.max ?? Infinity;
      if (matchCount < min || matchCount > max) {
        errors.push(
          `floor ${rule.floor} expected ${describeReq(req)} of types [${req.types.join(',')}], got ${matchCount}`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function describeReq(req: RequiredCount): string {
  if (req.exact !== undefined) return `exactly ${req.exact}`;
  if (req.min !== undefined && req.max !== undefined) return `between ${req.min} and ${req.max}`;
  if (req.min !== undefined) return `at least ${req.min}`;
  if (req.max !== undefined) return `at most ${req.max}`;
  return 'at least 1';
}
