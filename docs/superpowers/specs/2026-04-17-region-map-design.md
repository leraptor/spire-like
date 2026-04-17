# Region Map — Design Specification

## Overview

This spec designs the **Region Map** screen for the Tower of Mirrors card game: a branching node graph the player traverses from floor 1 to the boss on floor 5. It is the in-run navigation layer between combats.

This spec **supersedes** the "Map System → The Region Map" and "Map System → Node Types" sections of `2026-04-11-tower-of-mirrors-design.md` for visual direction and v1 implementation scope. The underlying game-loop design (floor counts, node types, Region 1 content) from that document remains authoritative.

### Goals

1. Give the player a strategic branching-path view of their run that reads at a glance and feels like a Ghibli-style journey up a painted scroll.
2. Ground the map in a **data-driven model** — a `RegionMap` data structure authored in TypeScript or JSON — so layouts can be hand-crafted, procedurally generated, validated, and analyzed as text and math, independent of rendering.
3. Fit the current landscape 1280×720 Phaser game while remaining trivially adaptable to mobile portrait (future Capacitor target).
4. Ship a v1 that is walkable end-to-end: combat and elite nodes launch real combat, rest nodes heal, other node types are placeholders.

### Non-Goals (v1)

- World Map (tower cross-section between runs)
- Real content for shop, event, and boss nodes (placeholders only)
- Card reward selection after combat
- Rest site's "upgrade a card" option
- Between-Runs Shop / Star spending
- Firestore save/resume for in-progress runs
- New music or SFX
- Mobile-specific tuning (touch gestures, Capacitor integration)

---

## Visual Direction

### Orientation

- **Portrait column, ~560px wide, centered** in the current landscape 1280×720 frame.
- The surrounding strips (x=0–360 and x=920–1280 on desktop) render a parchment texture that is fixed to the camera (does not scroll with the map).
- The scroll column fills the full viewport width on mobile portrait when that target lands later. No orientation-specific rework will be needed.

### Style

- Ghibli-inspired painted parchment background with subtle watercolor washes.
- Ink-drawn path strokes connecting nodes, hand-jittered to feel organic rather than geometric.
- Hybrid node visual hierarchy:
  - **Illustrated objects** — bosses, elites, shops. Unique painted art on a floating platform.
  - **Ink medallions** — combat, event, rest. Circular parchment disc (~72px) with an inked glyph.
- Illustrated nodes are ~96px to stand out as "heroes of the map." Medallions are ~72px.

### Scroll Behavior

- Map world is taller than the viewport (~1440px for 5 floors at 240px each).
- Player can scroll freely (mouse wheel / touch drag).
- When the player selects a valid next node, the camera tweens to center on the new current position (500ms, ease-out).

### Node State Visuals

- **Visited:** full color, golden border, subtle glow.
- **Current:** full color, avatar icon sitting on the node.
- **Available (next step):** glowing border, gentle pulse (scale 1.0 ↔ 1.08 over 900ms).
- **Future (not yet reachable this step):** desaturated to ~50%, alpha 0.7, non-interactive.

### Path Visuals

- Each edge renders as a cubic Bézier curve. Control points offset perpendicular to the straight line with small jitter for an organic feel.
- Completed paths: gold, ~6px, alpha 0.9.
- Available paths (from current to an available next node): ink-black, full opacity, optional shimmer.
- Future paths: ink-black, alpha 0.4.
- **No path crossings** — guaranteed by the lane-crossing rule in the validator.

### Sidebar & Avatar Calls

- **Parchment sidebar (desktop):** solid parchment texture with inner drop-shadow implying a scroll lying on top of a surface. No painted sidebar art in v1 (would not ship to mobile; YAGNI).
- **Player avatar:** reuse the existing `hero_idle` sprite sheet at ~0.7× scale. Pixel character on painted parchment reads as deliberate mixed media; revisit if it clashes in practice.

---

## Data Model

All files live under `src/models/` and `src/map/`.

### Types

```ts
export type NodeType = 'combat' | 'elite' | 'rest' | 'event' | 'shop' | 'boss';

export interface MapNode {
  id: string;        // stable, unique within the map (e.g. "f1-l0", "boss")
  type: NodeType;
  floor: number;     // 1..5 — logical row; 1 = bottom, 5 = top
  lane: number;      // 0..2 — logical column; 0 = left, 1 = center, 2 = right
  data?: NodeData;   // type-specific payload (see below)
}

export interface MapEdge {
  from: string;      // MapNode.id
  to: string;        // MapNode.id on a higher floor
}

export interface RegionMap {
  regionId: string;          // e.g. "withered-garden"
  seed: number;              // RNG seed that produced this map (for reproducibility)
  nodes: MapNode[];
  edges: MapEdge[];
  startNodeIds: string[];    // floor-1 nodes the player may begin at
  bossNodeId: string;        // always type: 'boss', always on the top floor
}

export type NodeData =
  | { kind: 'combat'; enemyId: string; }
  | { kind: 'elite';  enemyId: string; }
  | { kind: 'rest';   healPct: number; }  // default 0.30
  | { kind: 'event';  eventId: string; }  // placeholder id for v1
  | { kind: 'shop';   seed: number; }     // placeholder seed for v1
  | { kind: 'boss';   enemyId: string; };

export interface RunProgress {
  mapId: string;                    // `${regionId}-${seed}`
  currentNodeId: string | null;     // null before the player picks a start node
  visitedNodeIds: string[];         // ordered, oldest first
}
```

### Rationale

- **Graph, not tree.** Edges are first-class so reachability, orphan detection, and path analysis are trivial.
- **Logical `floor` + `lane`, not pixel `x/y`.** The renderer derives screen coordinates. Maps remain portable across resolutions and orientations.
- **No rendering concerns in the model.** No hex colors, no sprite refs. Pure game logic so a JSON dump is enough to reason about a map.
- **`seed` is stored.** Given any `RegionMap`, we can always identify the RNG input that produced it.
- **`NodeData` is a discriminated union.** TypeScript narrows `kind` correctly; no `any`.
- **`RegionMap` is immutable once generated.** Player progress lives in the separate `RunProgress` object so the map itself can be serialized, tested, and inspected without mixing in mutable state.

### Handcrafted vs. Generated

Both paths produce the same `RegionMap` type. A handcrafted tutorial map is a TypeScript literal in `src/fixtures/maps/`. A procedural run is the return value of `generateRegionMap(blueprint, seed)`. The renderer cannot tell them apart.

---

## Map Generation

### Region Blueprint

Generation rules live in a blueprint so the same generator can produce maps for every region as new blueprints are authored.

```ts
export interface RegionBlueprint {
  regionId: string;
  floorRules: FloorRule[];
  enemyPools: {
    normal: string[];   // enemy ids valid for combat nodes
    elite: string[];    // ids valid for elite nodes
    boss: string;       // single boss id
  };
}

export interface FloorRule {
  floor: number;
  lanes: number[];                         // lanes populated on this floor
  allowedTypes: NodeType[];
  required?: { type: NodeType; count: number }[];
}
```

### Withered Garden Blueprint (Region 1)

| Floor | Lanes | Allowed types | Required |
|-------|-------|---------------|----------|
| 1 | [0, 2] | combat | 2× combat |
| 2 | [0, 1, 2] | combat, event | ≥1 combat, ≥1 event |
| 3 | [0, 1, 2] | shop, rest, combat, event | ≥1 of {shop, rest} |
| 4 | [0, 1, 2] | elite, combat, event | exactly 1 elite |
| 5 | [1] | boss | 1× boss |

Every floor produces exactly `lanes.length` nodes (one per populated lane). This narrows the "2–3 nodes per floor" latitude in the earlier Tower of Mirrors spec to a fixed shape, which simplifies generation and keeps the visual layout predictable. If we later want variable-width floors, the blueprint schema can grow a `lanesRange` option without a breaking model change.

### RNG

- Mulberry32 PRNG (~12 lines, zero dependencies). Deterministic given a seed.
- Prod seeds from `Date.now()`. Dev mode uses a fixed seed (default `1`, configurable via env var) so reloads produce the same map.

### Generation Algorithm

1. For each floor rule, randomly fill the specified lanes with types that satisfy `allowedTypes` and any `required` constraints.
2. For each lane on floor F (F = 1..4), pick 1–2 forward lanes on floor F+1 that satisfy the non-crossing rule: lane L can connect only to lanes {L−1, L, L+1}. Weight single-connection vs. double-connection 70/30.
3. **Reachability pass.** BFS from each start node. For any floor-4 node that does not reach the boss, add a direct edge to the boss.
4. **Orphan pass.** For any node (floor ≥ 2) with no incoming edge, add an edge from the closest lane below.
5. Attach `NodeData` per node: combat/elite/boss draw an `enemyId` from the pool; rest gets `{ healPct: 0.30 }`; event and shop get placeholder data.
6. Validate. On failure, advance the seed by 1 and retry (bounded to 10 attempts).

### Validator

Pure function `validateRegionMap(map: RegionMap, blueprint: RegionBlueprint): ValidationResult`.

Checks:

1. All edge endpoints reference existing nodes.
2. Every edge goes strictly upward (`from.floor < to.floor`).
3. `startNodeIds` are all on floor 1.
4. `bossNodeId` exists, is type `boss`, and sits on the top floor.
5. Every non-start node has ≥1 incoming edge.
6. Every non-boss node has ≥1 outgoing edge.
7. Boss is BFS-reachable from every start node.
8. No edge crosses lanes (|from.lane − to.lane| ≤ 1).
9. All blueprint floor rules are satisfied (required counts met, no forbidden types present).

Returns `{ valid: boolean, errors: string[], warnings: string[] }`. Runs on every generated map and on every handcrafted fixture as part of tests.

### Analyzer (debugging aid)

Pure function `analyzeMap(map: RegionMap): MapAnalysis`.

Reports:

- Node counts per type.
- Shortest and longest path lengths (in nodes) from any start to the boss.
- Number of distinct paths from any start to the boss.
- Average combat count along a path.
- Warnings: "path A→C→E has 4 combats and 0 rests — brutal", "shop nodes are unreachable from lane 0".

Used by unit tests to snapshot reports for fixture maps, and by devs to manually read map health.

---

## Scene Architecture

### Scene Graph

```
BootScene       preload assets + animations (already exists, edited)
   ↓
MapScene        NEW — renders a RegionMap + RunProgress, handles interaction
   ↓ (combat / elite / boss nodes)
CombatScene     existing — accepts an enemyId config, returns to MapScene on victory
```

Rest, event, and shop nodes do **not** leave `MapScene`. They open an in-scene modal layer, resolve, close, and mark the node visited. Only combat warrants a scene transition because it is heavy enough to deserve one.

**Enemy content note.** `enemyId` is part of the data model and is set by the generator from the blueprint's enemy pools, but the existing `CombatScene` only implements a single droid enemy. In v1, `CombatScene` records the received `enemyId` but renders the existing droid regardless. This preserves the data shape so multiple enemies can slot in later without changing the map model.

### MapScene Responsibilities

1. Receive `{ map: RegionMap, progress: RunProgress }` on `init()`.
2. Render parchment backdrop, paths, nodes, HUD.
3. Handle player interaction: tap on a valid next node → camera pan → avatar walk along edge → trigger node.
4. Dispatch node actions by type.
5. Maintain `progress.currentNodeId` and append to `progress.visitedNodeIds` on each resolution.
6. Emit a `region-cleared` event on boss resolution (v1: shows a "VICTORY" banner; next-run flow is out of scope).

### CombatScene Changes (minimal)

- Accept config via `init(data: { enemyId: string; returnTo?: string; map?: RegionMap; progress?: RunProgress })`.
- Default behavior when called with no data is preserved so solo testing (`scene.start('CombatScene')`) still works.
- On **victory**: `scene.start(data.returnTo ?? 'MapScene', { map, progress, lastResult: 'victory' })`.
- On **defeat**: show "YOU DIED", then restart with a freshly-generated map and empty progress (v1 stub for the eventual return-to-World-Map flow).

### Boot Entry Point

`BootScene.create()` ends by starting `MapScene` with a generated map and empty progress:

```ts
const map = generateRegionMap(witheredGardenBlueprint, Date.now());
const progress: RunProgress = {
  mapId: `${map.regionId}-${map.seed}`,
  currentNodeId: null,
  visitedNodeIds: []
};
this.scene.start('MapScene', { map, progress });
```

Dev overrides (URL params, handled in `BootScene`):

- `?map=tutorial` — load the handcrafted fixture instead of generating.
- `?seed=42` — override the generation seed.

### Modal Components

`RestModal` and `PlaceholderModal` are Phaser `GameObjects.Container` subclasses instantiated inside `MapScene`. Each darkens the background with a 0.6-alpha rectangle, renders its panel, and invokes a callback on confirm. No additional scenes.

- **RestModal:** shows current HP, computes heal = `ceil(maxHp × 0.30)`, previews new HP, confirm button heals the player, dismiss closes.
- **PlaceholderModal:** one-line text ("Shop — coming soon", "Event — coming soon", "Boss — coming soon"), single dismiss button.

### Interaction Rules

- Tap a valid available node (direct edge from `currentNodeId`) → resolves it.
- Tap a non-available node → no-op. No confirmation prompts.
- Player can scroll the camera freely at any time via mouse wheel / touch drag. Camera clamps to world bounds.
- No zoom control in v1.
- `ESC` closes open modals. No pause menu on the main map.

### Avatar Travel

- On node selection: avatar tweens along the edge's Bézier curve (~900ms, `Sine.easeInOut`); path lights up to gold as it is traversed; scene then resolves the node action.
- On returning to the map from combat: avatar is already at the new node. No re-travel animation.

---

## Rendering

### Coordinate System

- **Viewport:** 1280×720.
- **Portrait column:** 560px wide, x-range [360, 920]. Parchment strips fill [0, 360] and [920, 1280], locked to camera.
- **Map world height:** `(numFloors + 1) × floorHeight` with `floorHeight = 240px`. For 5 floors: 1440px.
- **Lane x-positions** (world coords): lane 0 at x=460, lane 1 at x=640, lane 2 at x=820.
- **Floor y-positions** (world coords, bottom-up): floor 1 at y=1320, floor 2 at 1080, floor 3 at 840, floor 4 at 600, floor 5 at 360. 120px headroom top and bottom.

### Draw Layers (back to front)

1. Parchment sidebar strips (fixed to camera).
2. Parchment column background (scrolls with camera).
3. Paths (cubic Bézier `Graphics`).
4. Nodes (illustrated platforms or ink medallions).
5. Avatar.
6. HUD (fixed to camera).

### HUD

Top bar fixed at camera y=0. Content: `❤️ HP/maxHP  🪙 Gold  🧪 ◯◯◯  🗺️ Floor N/5`. Reuses the style pattern from the existing `CombatScene.topBarText`. No bottom bar in v1 (deck/relic views deferred).

### Performance

- Path graphics are drawn once at scene create and stored as display objects. No per-frame redraw.
- Ambient flourish decorations capped at ~30 per map. Static sprites.
- MapScene draw-call budget is under 50 objects. No perf concerns.

---

## File Layout

New or moved files:

```
src/
  models/
    RegionMap.ts             types: RegionMap, MapNode, MapEdge, NodeType, NodeData
    RunProgress.ts           type: RunProgress
    RegionBlueprint.ts       type: RegionBlueprint, FloorRule
  map/
    generator.ts             generateRegionMap(blueprint, seed): RegionMap
    validator.ts             validateRegionMap(map, blueprint): ValidationResult
    analyzer.ts              analyzeMap(map): MapAnalysis
    rng.ts                   Mulberry32 seeded PRNG
    blueprints.ts            witheredGardenBlueprint (+ future regions)
  scenes/
    BootScene.ts             extracted from main.ts (no behavior change)
    CombatScene.ts           extracted from main.ts (no behavior change beyond accepting init data)
    MapScene.ts              the Phaser scene
  ui/
    RestModal.ts             30% heal modal
    PlaceholderModal.ts      stub modal
    MapHud.ts                top-bar HUD component
    NodeView.ts              draws a single node (medallion or illustrated)
    PathRenderer.ts          draws edges as Bézier ink paths
    AvatarWalker.ts          avatar sprite + travel tween
  main.ts                    trimmed to ~20 lines: config + Phaser.Game + scene list
  fixtures/
    maps/
      tutorial-map.ts        handcrafted fixture for debugging
tests/
  generator.test.ts
  validator.test.ts
  analyzer.test.ts
  map-reachability.test.ts
```

### Refactor Note: main.ts

`src/main.ts` currently holds BootScene, CombatScene, HealthBar, CardView, and the config in one 1143-line file. To add MapScene without making the file worse, the existing classes are extracted into per-scene files as a **preparatory commit** with zero behavior change. MapScene and its helpers are then built in fresh files.

---

## Testing

### Unit Tests (Vitest)

- `rng.test.ts`: Mulberry32 produces deterministic sequences given a seed; distribution is reasonable.
- `generator.test.ts`: 1,000 random seeds each produce a map that passes `validateRegionMap` against the Withered Garden blueprint.
- `validator.test.ts`: fixture maps that violate each rule produce the expected error; a well-formed fixture produces `{ valid: true }`.
- `analyzer.test.ts`: snapshot of `analyzeMap(seed=1)` for the Withered Garden blueprint.
- `map-reachability.test.ts`: BFS finds all nodes reachable from starts; orphan and unreachable-boss scenarios are detected.

Vitest is added as a dev dependency. `npm test` runs the suite. Watch mode (`vitest`) is available for TDD on the generator.

### Manual Smoke Testing

MapScene is not unit-tested at the scene level (Phaser headless testing is costly and the real value is visual). Manual verification via `vite dev`:

1. Map renders with parchment column and 5 floors of nodes.
2. Starting nodes (floor 1) are glowing; all others are dimmed.
3. Tapping a start node walks the avatar, triggers combat.
4. After combat victory, the map reappears with the combat node visited and the next floor's reachable nodes glowing.
5. Rest node opens RestModal, heals 30%, closes.
6. Placeholder nodes open PlaceholderModal, close, mark visited.
7. Boss node shows "VICTORY" banner.
8. Defeat in combat triggers restart with a fresh map.

### Playwright Smoke Test

One automated smoke test, run manually or in CI:

1. `vite dev` is running.
2. Headless browser loads the page.
3. Waits for MapScene textures to be drawn.
4. Takes a screenshot and asserts that the expected parchment color is present at known coordinates (catches "map didn't render at all").

Kept minimal — catches the most useful regression class at low cost. Puppeteer is already a project dependency.

---

## v1 Ship List

- [ ] Data model types compile and are exported.
- [ ] Mulberry32 RNG with unit tests.
- [ ] Withered Garden blueprint matching the table above.
- [ ] Generator produces valid maps for 1,000/1,000 random seeds (tested).
- [ ] Validator catches each class of broken map (tested).
- [ ] Analyzer produces a human-readable report (tested + snapshot).
- [ ] `main.ts` refactored into per-scene files with no behavior change.
- [ ] MapScene renders parchment backdrop, portrait column, 5 floors, nodes, ink paths, HUD.
- [ ] Player taps a valid next node; avatar walks; node action triggers.
- [ ] Combat / elite / boss nodes launch `CombatScene` with an `enemyId`; return on victory; defeat restarts with a fresh map.
- [ ] Rest node opens `RestModal`, heals 30% (rounded up), closes, marks visited.
- [ ] Event / shop nodes open `PlaceholderModal`, close, mark visited.
- [ ] Boss node shows "VICTORY" banner stub.
- [ ] Camera auto-pans on selection; manual scroll works.
- [ ] Node state visuals (visited / current / available / future) all correct.
- [ ] Handcrafted tutorial map loads via `?map=tutorial` in dev.
- [ ] Dev mode uses fixed seed (default `1`); prod uses `Date.now()`.
- [ ] Works in the existing landscape 1280×720 frame.
- [ ] Playwright smoke test passes.
