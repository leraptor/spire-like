// ABOUTME: Static analyzer for RegionMap instances. Produces counts, path stats, and warnings.
// ABOUTME: Used by tests to snapshot map health and by devs to eyeball map structure.
import type { RegionMap, NodeType } from '../models/RegionMap';

export interface MapAnalysis {
  nodeCounts: Record<NodeType, number>;
  shortestPathLength: number;
  longestPathLength: number;
  distinctPathCount: number;
  avgCombatsPerPath: number;
  warnings: string[];
}

export function analyzeMap(map: RegionMap): MapAnalysis {
  const nodeCounts: Record<NodeType, number> = {
    combat: 0, elite: 0, rest: 0, event: 0, shop: 0, chest: 0, boss: 0,
  };
  for (const n of map.nodes) nodeCounts[n.type]++;

  const adj = new Map<string, string[]>();
  for (const n of map.nodes) adj.set(n.id, []);
  for (const e of map.edges) if (adj.has(e.from)) adj.get(e.from)!.push(e.to);

  const nodesById = new Map<string, typeof map.nodes[number]>();
  for (const n of map.nodes) nodesById.set(n.id, n);

  // Enumerate all paths from any start to the boss. Guarded DFS — the graph is tiny (≤ ~15 nodes).
  const allPaths: string[][] = [];
  for (const startId of map.startNodeIds) {
    dfs(startId, [startId], adj, map.bossNodeId, allPaths);
  }

  const lengths = allPaths.map(p => p.length);
  const shortestPathLength = lengths.length > 0 ? Math.min(...lengths) : 0;
  const longestPathLength  = lengths.length > 0 ? Math.max(...lengths) : 0;

  const combatsPerPath = allPaths.map(p =>
    p.filter(id => {
      const t = nodesById.get(id)?.type;
      return t === 'combat' || t === 'elite';
    }).length,
  );
  const avgCombatsPerPath = combatsPerPath.length > 0
    ? combatsPerPath.reduce((s, n) => s + n, 0) / combatsPerPath.length
    : 0;

  const warnings: string[] = [];
  for (let i = 0; i < allPaths.length; i++) {
    const combats = combatsPerPath[i]!;
    const path = allPaths[i]!;
    const rests = path.filter(id => nodesById.get(id)?.type === 'rest').length;
    if (combats >= 4 && rests === 0) {
      warnings.push(`path ${path.join('→')} has ${combats} combats and 0 rests — brutal`);
    }
  }

  return {
    nodeCounts,
    shortestPathLength,
    longestPathLength,
    distinctPathCount: allPaths.length,
    avgCombatsPerPath,
    warnings,
  };
}

function dfs(
  current: string,
  path: string[],
  adj: Map<string, string[]>,
  bossId: string,
  out: string[][],
): void {
  if (current === bossId) {
    out.push([...path]);
    return;
  }
  for (const next of adj.get(current) ?? []) {
    if (path.includes(next)) continue; // no cycles
    path.push(next);
    dfs(next, path, adj, bossId, out);
    path.pop();
  }
}
