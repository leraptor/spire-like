// ABOUTME: Core map data types — the graph of nodes and edges the player traverses in a region.
// ABOUTME: Pure data; no rendering concerns. The renderer derives screen coordinates from floor/lane.

export type NodeType = 'combat' | 'elite' | 'rest' | 'event' | 'shop' | 'chest' | 'boss';

export type NodeData =
  | { kind: 'combat'; enemyId: string }
  | { kind: 'elite';  enemyId: string }
  | { kind: 'rest';   healPct: number }
  | { kind: 'event';  eventId: string }
  | { kind: 'shop';   seed: number }
  | { kind: 'chest';  seed: number }
  | { kind: 'boss';   enemyId: string };

export interface MapNode {
  id: string;
  type: NodeType;
  floor: number;
  lane: number;
  data: NodeData;
}

export interface MapEdge {
  from: string;
  to: string;
}

export interface RegionMap {
  regionId: string;
  seed: number;
  nodes: MapNode[];
  edges: MapEdge[];
  startNodeIds: string[];
  bossNodeId: string;
}
