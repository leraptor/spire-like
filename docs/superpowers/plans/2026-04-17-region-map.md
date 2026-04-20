# Region Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a data-driven, scrollable Region Map scene for the Tower of Mirrors Phaser card game that links to the existing combat scene, matching the design in `docs/superpowers/specs/2026-04-17-region-map-design.md`.

**Architecture:** A `RegionMap` graph (nodes + edges) is produced by a seeded generator from a `RegionBlueprint`, validated for correctness, then rendered by a new `MapScene` as a portrait column of parchment platforms inside the existing landscape 1280×720 frame. Combat/elite/boss nodes launch `CombatScene`; rest and placeholder nodes open in-scene modals.

**Tech Stack:** TypeScript 6, Phaser 4, Vite 8, Vitest (new), Puppeteer (existing).

**Repo root for this work:** `/Users/samibenhassine/antigravity/game/phaser/spire-like/`
All paths below are relative to that directory unless absolute.

---

## File structure

**Creates:**
- `src/models/RegionMap.ts` — core map types
- `src/models/RunProgress.ts` — player progress type
- `src/models/RegionBlueprint.ts` — generation rule types
- `src/map/rng.ts` — Mulberry32 PRNG
- `src/map/blueprints.ts` — region blueprint data
- `src/map/generator.ts` — map generation
- `src/map/validator.ts` — map validation
- `src/map/analyzer.ts` — map analysis (debug aid)
- `src/scenes/BootScene.ts` — extracted from main.ts
- `src/scenes/CombatScene.ts` — extracted from main.ts
- `src/scenes/MapScene.ts` — new
- `src/ui/HealthBar.ts` — extracted from main.ts
- `src/ui/CardView.ts` — extracted from main.ts
- `src/ui/NodeView.ts` — new
- `src/ui/PathRenderer.ts` — new
- `src/ui/AvatarWalker.ts` — new
- `src/ui/MapHud.ts` — new
- `src/ui/RestModal.ts` — new
- `src/ui/PlaceholderModal.ts` — new
- `src/fixtures/maps/tutorial-map.ts` — handcrafted fixture
- `tests/rng.test.ts`
- `tests/generator.test.ts`
- `tests/validator.test.ts`
- `tests/analyzer.test.ts`
- `tests/tutorial-map.test.ts`
- `vitest.config.ts`
- `tests/e2e/map-smoke.test.ts` (Playwright/puppeteer-driven)

**Modifies:**
- `src/main.ts` — trimmed to ~20 lines: config + Phaser.Game + scene list
- `package.json` — add Vitest; add `test` and `test:watch` scripts

**Does NOT touch:**
- `src/models/Card.ts`, `src/models/CombatState.ts`, `src/models/CombatEntity.ts`, `src/models/Deck.ts` — combat model stays.

**Why this split:**
- `src/models/` — pure domain types, zero runtime dependencies.
- `src/map/` — pure functions over the map types (generator/validator/analyzer). Trivially unit-testable.
- `src/scenes/` — Phaser `Scene` subclasses, one per file.
- `src/ui/` — reusable Phaser `Container`/`Graphics` widgets used by scenes.
- `src/fixtures/` — hand-authored maps used for dev loading and tests.
- `tests/` — Vitest unit tests next to their targets' file names.

---

## Naming and type conventions (locked in for every task)

**Function names:**
- `createRng(seed: number): () => number` — returns a float generator in `[0, 1)`.
- `generateRegionMap(blueprint: RegionBlueprint, seed: number): RegionMap`
- `validateRegionMap(map: RegionMap, blueprint: RegionBlueprint): ValidationResult`
- `analyzeMap(map: RegionMap): MapAnalysis`

**Node id scheme (stable, tests depend on it):**
- Regular nodes: `f{floor}-l{lane}` — e.g. `f1-l0`, `f4-l2`.
- Boss node: literal string `boss`.
- Start nodes: `startNodeIds = [ids on floor 1]`, bossNodeId always `"boss"`.

**Map coordinate constants (locked):**
- Viewport: 1280 × 720.
- Column x-range: 360..920 (width 560).
- Lane x: lane 0 = 460, lane 1 = 640, lane 2 = 820.
- Floor y (world, bottom-up): floor 1 = 1320, floor 2 = 1080, floor 3 = 840, floor 4 = 600, floor 5 = 360.
- World height: 1440.

**Every new source file starts with:**
```ts
// ABOUTME: <one line describing the file>
// ABOUTME: <second line clarifying scope>
```
(Per Sami's global CLAUDE.md — enforced across the codebase.)

---

## Task 1: Add Vitest and verify a toy test runs

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/smoke.test.ts`

- [ ] **Step 1: Install Vitest**

Run: `npm install --save-dev vitest@^2.0.0`

Expected: installs vitest and its deps; `package.json` gets a new devDependency.

- [ ] **Step 2: Add npm scripts**

Edit `package.json`. In the `"scripts"` object, add:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

The resulting `scripts` block should look like:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 3: Create `vitest.config.ts`**

Create `vitest.config.ts` at the repo root:

```ts
// ABOUTME: Vitest configuration for unit tests.
// ABOUTME: Runs TypeScript tests under tests/ with node environment.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Write failing toy test**

Create `tests/smoke.test.ts`:

```ts
// ABOUTME: Smoke test verifying the Vitest harness works.
// ABOUTME: Asserts 2 + 2 === 4 to prove the pipeline runs.
import { describe, it, expect } from 'vitest';

describe('vitest harness', () => {
  it('runs basic assertions', () => {
    expect(2 + 2).toBe(4);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm test`

Expected: `✓ tests/smoke.test.ts > vitest harness > runs basic assertions`. Exit code 0.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/smoke.test.ts
git commit -m "chore: add vitest for unit tests"
```

---

## Task 2: Extract BootScene, CombatScene, HealthBar, CardView from main.ts

This is a mechanical refactor with zero behavior change. After it, running `npm run dev` must produce exactly the same combat experience as before.

**Files:**
- Create: `src/scenes/BootScene.ts`
- Create: `src/scenes/CombatScene.ts`
- Create: `src/ui/HealthBar.ts`
- Create: `src/ui/CardView.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Extract `HealthBar` to `src/ui/HealthBar.ts`**

Copy the class `HealthBar` (lines 14–88 of the current `src/main.ts`) into a new file. Prepend the ABOUTME header and convert `class HealthBar` to `export class HealthBar`.

File header:
```ts
// ABOUTME: Animated health bar widget with a "catchup trail" that chases the real HP down.
// ABOUTME: Used by CombatScene for player and enemy HP readouts.
```

Keep the class body identical to the current source. The `import * as Phaser from 'phaser';` line goes at the top after the ABOUTME.

- [ ] **Step 2: Extract `CardView` to `src/ui/CardView.ts`**

Copy the class `CardView` (currently ~lines 94–244) into `src/ui/CardView.ts`. Header:

```ts
// ABOUTME: Draggable Phaser container that renders a single card from the player's hand.
// ABOUTME: Handles hover/drag visuals, glow, trail particles, and affordability dimming.
```

Because `CardView` references `CombatScene` (typed field), import `CombatScene` with a `type`-only import to avoid a circular runtime dependency:

```ts
import * as Phaser from 'phaser';
import type { Card } from '../models/Card';
import { CardType } from '../models/Card';
import type { CombatScene } from '../scenes/CombatScene';
```

Declare as `export class CardView extends Phaser.GameObjects.Container { ... }`.

- [ ] **Step 3: Extract `CombatScene` to `src/scenes/CombatScene.ts`**

Copy the class `CombatScene` (currently ~lines 345–1117) into `src/scenes/CombatScene.ts`. Header:

```ts
// ABOUTME: Phaser scene rendering turn-based card combat between the player and a single enemy.
// ABOUTME: Handles card playing, targeting, animations, health bars, and combat state transitions.
```

Imports at the top (adjust to match what the class actually uses):

```ts
import * as Phaser from 'phaser';
import { CombatState, TurnPhase } from '../models/CombatState';
import { CombatEntity } from '../models/CombatEntity';
import type { Card } from '../models/Card';
import { CardType, TargetType } from '../models/Card';
import { HealthBar } from '../ui/HealthBar';
import { CardView } from '../ui/CardView';
```

Export the class: `export class CombatScene extends Phaser.Scene { ... }`.

- [ ] **Step 4: Extract `BootScene` to `src/scenes/BootScene.ts`**

Copy the class `BootScene` (currently ~lines 250–339) into `src/scenes/BootScene.ts`. Header:

```ts
// ABOUTME: Phaser scene that preloads all sprites, spritesheets, and audio, then starts gameplay.
// ABOUTME: Also generates the particle flare texture and registers all sprite animations.
```

Imports:

```ts
import * as Phaser from 'phaser';
```

Export: `export class BootScene extends Phaser.Scene { ... }`. Keep `this.scene.start('CombatScene');` at the end of `create()` unchanged — Task 23 will replace this.

- [ ] **Step 5: Slim down `src/main.ts`**

Replace the entire contents of `src/main.ts` with:

```ts
// ABOUTME: Phaser game entry point. Configures the renderer and boots BootScene.
// ABOUTME: All scenes, widgets, and gameplay logic live in their own modules.
import * as Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { CombatScene } from './scenes/CombatScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    pixelArt: true,
    preserveDrawingBuffer: true,
    scene: [BootScene, CombatScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        fullscreenTarget: 'game-container'
    },
    input: {
        activePointers: 2
    },
    physics: {
        default: 'arcade',
        arcade: { debug: false }
    }
};

const game = new Phaser.Game(config);
(window as any).game = game;
```

- [ ] **Step 6: Verify build and runtime**

Run: `npm run build`
Expected: exit 0, no type errors.

Run: `npm run dev` in one terminal. In a browser, open `http://localhost:5173` (or whichever port Vite chose).
Expected: combat scene loads exactly as before — hero on left, droid on right, fanned hand at bottom, audio plays. Kill the dev server.

- [ ] **Step 7: Commit**

```bash
git add src/main.ts src/scenes/ src/ui/
git commit -m "refactor: split main.ts into per-scene and per-widget files"
```

---

## Task 3: Add the data model types

**Files:**
- Create: `src/models/RegionMap.ts`
- Create: `src/models/RunProgress.ts`
- Create: `src/models/RegionBlueprint.ts`

- [ ] **Step 1: Create `src/models/RegionMap.ts`**

```ts
// ABOUTME: Core map data types — the graph of nodes and edges the player traverses in a region.
// ABOUTME: Pure data; no rendering concerns. The renderer derives screen coordinates from floor/lane.

export type NodeType = 'combat' | 'elite' | 'rest' | 'event' | 'shop' | 'boss';

export type NodeData =
  | { kind: 'combat'; enemyId: string }
  | { kind: 'elite';  enemyId: string }
  | { kind: 'rest';   healPct: number }
  | { kind: 'event';  eventId: string }
  | { kind: 'shop';   seed: number }
  | { kind: 'boss';   enemyId: string };

export interface MapNode {
  id: string;
  type: NodeType;
  floor: number;
  lane: number;
  data?: NodeData;
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
```

- [ ] **Step 2: Create `src/models/RunProgress.ts`**

```ts
// ABOUTME: In-memory player progress through a single run of a region.
// ABOUTME: Mutable companion to the immutable RegionMap.

export interface RunProgress {
  mapId: string;
  currentNodeId: string | null;
  visitedNodeIds: string[];
}
```

- [ ] **Step 3: Create `src/models/RegionBlueprint.ts`**

```ts
// ABOUTME: Blueprint types describing how a region's map is generated.
// ABOUTME: One blueprint per region (Withered Garden, Mist Woods, etc.).
import type { NodeType } from './RegionMap';

export interface RequiredCount {
  types: NodeType[];
  min?: number;
  max?: number;
  exact?: number;
}

export interface FloorRule {
  floor: number;
  lanes: number[];
  allowedTypes: NodeType[];
  required?: RequiredCount[];
}

export interface RegionBlueprint {
  regionId: string;
  floorRules: FloorRule[];
  enemyPools: {
    normal: string[];
    elite: string[];
    boss: string;
  };
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: exit 0, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/models/RegionMap.ts src/models/RunProgress.ts src/models/RegionBlueprint.ts
git commit -m "feat(map): add RegionMap, RunProgress, RegionBlueprint types"
```

---

## Task 4: Mulberry32 PRNG with tests

**Files:**
- Create: `src/map/rng.ts`
- Create: `tests/rng.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/rng.test.ts`:

```ts
// ABOUTME: Tests for the seeded Mulberry32 PRNG.
// ABOUTME: Verifies determinism, range, and distribution.
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/map/rng';

describe('createRng', () => {
  it('produces deterministic sequences for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a()).not.toBe(b());
  });

  it('returns floats in [0, 1)', () => {
    const r = createRng(123);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('has reasonable distribution across 0..1', () => {
    const r = createRng(7);
    const buckets = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) {
      buckets[Math.floor(r() * 4)]++;
    }
    for (const b of buckets) {
      expect(b).toBeGreaterThan(800);
      expect(b).toBeLessThan(1200);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- rng`
Expected: FAIL with "Cannot find module ... src/map/rng".

- [ ] **Step 3: Implement `src/map/rng.ts`**

```ts
// ABOUTME: Mulberry32 seeded PRNG. Deterministic given the seed.
// ABOUTME: Used by the map generator so every run of a given seed produces the same map.

export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return function rng(): number {
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- rng`
Expected: all 4 tests pass. Exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/map/rng.ts tests/rng.test.ts
git commit -m "feat(map): seeded Mulberry32 PRNG"
```

---

## Task 5: Withered Garden blueprint

**Files:**
- Create: `src/map/blueprints.ts`

- [ ] **Step 1: Create `src/map/blueprints.ts`**

```ts
// ABOUTME: Region blueprints describing generation rules for each region of the tower.
// ABOUTME: V1 contains only Withered Garden (Region 1); more regions slot in as new exports.
import type { RegionBlueprint } from '../models/RegionBlueprint';

export const witheredGardenBlueprint: RegionBlueprint = {
  regionId: 'withered-garden',
  floorRules: [
    {
      floor: 1,
      lanes: [0, 2],
      allowedTypes: ['combat'],
      required: [{ types: ['combat'], exact: 2 }],
    },
    {
      floor: 2,
      lanes: [0, 1, 2],
      allowedTypes: ['combat', 'event'],
      required: [
        { types: ['combat'], min: 1 },
        { types: ['event'], min: 1 },
      ],
    },
    {
      floor: 3,
      lanes: [0, 1, 2],
      allowedTypes: ['shop', 'rest', 'combat', 'event'],
      required: [{ types: ['shop', 'rest'], min: 1 }],
    },
    {
      floor: 4,
      lanes: [0, 1, 2],
      allowedTypes: ['elite', 'combat', 'event'],
      required: [{ types: ['elite'], exact: 1 }],
    },
    {
      floor: 5,
      lanes: [1],
      allowedTypes: ['boss'],
      required: [{ types: ['boss'], exact: 1 }],
    },
  ],
  enemyPools: {
    normal: ['thorn-creep', 'fog-wisp'],
    elite: ['rot-golem'],
    boss: 'hollow-gardener',
  },
};
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: exit 0, no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/map/blueprints.ts
git commit -m "feat(map): Withered Garden blueprint"
```

---

## Task 6: Validator — all 9 checks with tests

The validator is written before the generator so the generator's output has a sharp correctness contract. The validator is pure and easy to TDD against fixture maps.

**Files:**
- Create: `src/map/validator.ts`
- Create: `tests/validator.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/validator.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- validator`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/map/validator.ts`**

```ts
// ABOUTME: Pure validator for RegionMap instances against a RegionBlueprint.
// ABOUTME: Returns a list of human-readable errors; reused by generator retries and by tests.
import type { RegionMap, MapNode, NodeType } from '../models/RegionMap';
import type { RegionBlueprint, FloorRule, RequiredCount } from '../models/RegionBlueprint';

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
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npm test -- validator`
Expected: all 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/map/validator.ts tests/validator.test.ts
git commit -m "feat(map): map validator with 9 correctness checks"
```

---

## Task 7: Generator — produces valid maps for any seed

The generator is big. Test against the blueprint + 1000 seeds.

**Files:**
- Create: `src/map/generator.ts`
- Create: `tests/generator.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/generator.test.ts`:

```ts
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
    expect(bosses[0].id).toBe('boss');
    expect(map.bossNodeId).toBe('boss');
    expect(bosses[0].floor).toBe(5);
  });

  it('populates NodeData for every node', () => {
    const map = generateRegionMap(witheredGardenBlueprint, 3);
    for (const n of map.nodes) {
      expect(n.data).toBeDefined();
      expect(n.data?.kind).toBe(n.type);
    }
  });
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `npm test -- generator`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/map/generator.ts`**

```ts
// ABOUTME: Procedural map generator. Given a RegionBlueprint and a seed, returns a valid RegionMap.
// ABOUTME: Retries with incremented seeds on validation failure (bounded to 10 attempts).
import type { RegionMap, MapNode, MapEdge, NodeType, NodeData } from '../models/RegionMap';
import type { RegionBlueprint, FloorRule, RequiredCount } from '../models/RegionBlueprint';
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
      const t = typesPerLane[i];
      const id = t === 'boss' ? BOSS_ID : `f${rule.floor}-l${lane}`;
      nodes.push({ id, type: t, floor: rule.floor, lane, data: makeNodeData(t, blueprint, rng) });
    });
  }

  // Step 2: Connect floors with non-crossing edges.
  const floors = groupByFloor(nodes);
  for (let f = blueprint.floorRules[0].floor; f < blueprint.floorRules[blueprint.floorRules.length - 1].floor; f++) {
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
  const topFloor = blueprint.floorRules[blueprint.floorRules.length - 1].floor;
  const preBossFloor = topFloor - 1;
  const preBossNodes = (floors.get(preBossFloor) ?? []);
  for (const n of preBossNodes) {
    if (!edges.some(e => e.from === n.id)) edges.push({ from: n.id, to: BOSS_ID });
  }

  // Step 4: Orphan pass — every non-start node needs an incoming edge.
  const startFloor = blueprint.floorRules[0].floor;
  for (let f = startFloor + 1; f <= topFloor; f++) {
    const curNodes = floors.get(f) ?? [];
    const below = floors.get(f - 1) ?? [];
    for (const n of curNodes) {
      if (edges.some(e => e.to === n.id)) continue;
      const closest = nearestBelow(n.lane, below);
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
      assigned.push(choices[Math.floor(rng() * choices.length)]);
    }
  }

  // Truncate if requireds overflowed (shouldn't happen for well-formed blueprints).
  while (assigned.length > slots) assigned.pop();

  // Second pass: fill remaining slots with random allowed types.
  while (assigned.length < slots) {
    assigned.push(rule.allowedTypes[Math.floor(rng() * rule.allowedTypes.length)]);
  }

  // Shuffle so required types don't always land in lane 0.
  for (let i = assigned.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [assigned[i], assigned[j]] = [assigned[j], assigned[i]];
  }

  // If the floor requires `exact` counts, enforce them post-shuffle.
  for (const req of rule.required ?? []) {
    if (req.exact === undefined) continue;
    let count = assigned.filter(t => req.types.includes(t)).length;
    if (count === req.exact) continue;
    if (count < req.exact) {
      // Replace non-required slots with a required type.
      const fillType = req.types[Math.floor(rng() * req.types.length)];
      for (let i = 0; i < assigned.length && count < req.exact; i++) {
        if (!req.types.includes(assigned[i]) && rule.allowedTypes.includes(fillType)) {
          assigned[i] = fillType;
          count++;
        }
      }
    } else {
      // Over-count: replace extras with a non-required allowed type.
      const replaceType = rule.allowedTypes.find(t => !req.types.includes(t));
      if (replaceType) {
        for (let i = 0; i < assigned.length && count > req.exact; i++) {
          if (req.types.includes(assigned[i])) {
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
  }
}

function pickFrom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickN<T>(arr: T[], n: number, rng: () => number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
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
  let best = below[0];
  let bestDist = Math.abs(best.lane - lane);
  for (const n of below) {
    const d = Math.abs(n.lane - lane);
    if (d < bestDist) { best = n; bestDist = d; }
  }
  return best;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- generator`
Expected: all 6 tests pass. If the 1000-seed test fails, the error output names specific failing seeds — debug with `generateRegionMap(blueprint, <seed>)` in a throwaway script and inspect the returned map JSON.

- [ ] **Step 5: Commit**

```bash
git add src/map/generator.ts tests/generator.test.ts
git commit -m "feat(map): seeded map generator with reachability and orphan passes"
```

---

## Task 8: Analyzer with tests and snapshot

**Files:**
- Create: `src/map/analyzer.ts`
- Create: `tests/analyzer.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/analyzer.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify fail**

Run: `npm test -- analyzer`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/map/analyzer.ts`**

```ts
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
    combat: 0, elite: 0, rest: 0, event: 0, shop: 0, boss: 0,
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
    const combats = combatsPerPath[i];
    const rests = allPaths[i].filter(id => nodesById.get(id)?.type === 'rest').length;
    if (combats >= 4 && rests === 0) {
      warnings.push(`path ${allPaths[i].join('→')} has ${combats} combats and 0 rests — brutal`);
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
```

- [ ] **Step 4: Run tests**

Run: `npm test -- analyzer`
Expected: all 4 tests pass. The snapshot test creates `tests/__snapshots__/analyzer.test.ts.snap` on first run.

- [ ] **Step 5: Commit**

```bash
git add src/map/analyzer.ts tests/analyzer.test.ts tests/__snapshots__/
git commit -m "feat(map): map analyzer with counts, path stats, and warnings"
```

---

## Task 9: Tutorial map fixture

**Files:**
- Create: `src/fixtures/maps/tutorial-map.ts`
- Create: `tests/tutorial-map.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/tutorial-map.test.ts`:

```ts
// ABOUTME: Confirms the hand-crafted tutorial map validates against the Withered Garden blueprint.
import { describe, it, expect } from 'vitest';
import { tutorialMap } from '../src/fixtures/maps/tutorial-map';
import { validateRegionMap } from '../src/map/validator';
import { witheredGardenBlueprint } from '../src/map/blueprints';

describe('tutorialMap', () => {
  it('is a valid map for Withered Garden', () => {
    const res = validateRegionMap(tutorialMap, witheredGardenBlueprint);
    expect(res.errors).toEqual([]);
    expect(res.valid).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- tutorial-map`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/fixtures/maps/tutorial-map.ts`**

```ts
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
    { id: 'f3-l1', type: 'shop',   floor: 3, lane: 1, data: { kind: 'shop',   seed: 0 } },
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
```

- [ ] **Step 4: Run test**

Run: `npm test -- tutorial-map`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/fixtures/maps/tutorial-map.ts tests/tutorial-map.test.ts
git commit -m "feat(map): tutorial fixture map for debugging"
```

---

## Task 10: NodeView — renders a single map node

**Files:**
- Create: `src/ui/NodeView.ts`

This UI component is a simple Phaser `Container`. Not unit-tested — visual verification happens in Task 16 when MapScene is wired up.

- [ ] **Step 1: Create `src/ui/NodeView.ts`**

```ts
// ABOUTME: Renders a single map node as a parchment medallion (combat/event/rest) or illustrated platform (elite/shop/boss).
// ABOUTME: Exposes setState() for visited/current/available/future visuals.
import * as Phaser from 'phaser';
import type { MapNode, NodeType } from '../models/RegionMap';

export type NodeViewState = 'visited' | 'current' | 'available' | 'future';

const MEDALLION_RADIUS = 36;
const ILLUSTRATED_RADIUS = 48;

const GLYPH_BY_TYPE: Record<NodeType, string> = {
  combat: '⚔',
  elite:  '☠',
  rest:   '🔥',
  event:  '?',
  shop:   '🛍',
  boss:   '♛',
};

export class NodeView extends Phaser.GameObjects.Container {
  node: MapNode;
  state: NodeViewState = 'future';
  private disc: Phaser.GameObjects.Graphics;
  private glyph: Phaser.GameObjects.Text;
  private pulseTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, node: MapNode) {
    super(scene, x, y);
    this.node = node;

    const illustrated = node.type === 'elite' || node.type === 'shop' || node.type === 'boss';
    const radius = illustrated ? ILLUSTRATED_RADIUS : MEDALLION_RADIUS;

    this.disc = scene.add.graphics();
    this.add(this.disc);

    this.glyph = scene.add.text(0, 0, GLYPH_BY_TYPE[node.type], {
      fontSize: illustrated ? '40px' : '32px',
      color: '#4a321c',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add(this.glyph);

    this.setSize(radius * 2, radius * 2);
    this.setInteractive(new Phaser.Geom.Circle(0, 0, radius), Phaser.Geom.Circle.Contains);
    this.redraw();
  }

  setState(next: NodeViewState): void {
    if (next === this.state) return;
    this.state = next;
    this.redraw();
  }

  private redraw(): void {
    const illustrated = this.node.type === 'elite' || this.node.type === 'shop' || this.node.type === 'boss';
    const radius = illustrated ? ILLUSTRATED_RADIUS : MEDALLION_RADIUS;
    this.disc.clear();

    let fill = 0xefe5cc;
    let border = 0x6b4a2b;
    let alpha = 1;

    if (this.state === 'future') { alpha = 0.55; }
    if (this.state === 'visited') { border = 0xc89b3c; }
    if (this.state === 'available') { border = 0xc89b3c; }

    this.disc.fillStyle(fill, alpha);
    this.disc.fillCircle(0, 0, radius);
    this.disc.lineStyle(4, border, alpha);
    this.disc.strokeCircle(0, 0, radius);

    // Subtle inner shadow to suggest a painted platform.
    this.disc.fillStyle(0x000000, 0.08 * alpha);
    this.disc.fillCircle(0, 4, radius * 0.9);

    this.glyph.setAlpha(alpha);

    if (this.state === 'available' && !this.pulseTween) {
      this.pulseTween = this.scene.tweens.add({
        targets: this,
        scaleX: 1.08, scaleY: 1.08,
        duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    } else if (this.state !== 'available' && this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = undefined;
      this.setScale(1);
    }

    this.setAlpha(this.state === 'future' ? 0.7 : 1);
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/ui/NodeView.ts
git commit -m "feat(map): NodeView component"
```

---

## Task 11: PathRenderer — draws ink-style Bézier paths

**Files:**
- Create: `src/ui/PathRenderer.ts`

- [ ] **Step 1: Create `src/ui/PathRenderer.ts`**

```ts
// ABOUTME: Draws all edges of a RegionMap as cubic Bézier ink paths with per-edge state (future/available/completed).
// ABOUTME: One graphics object per edge so states can be toggled without redrawing everything.
import * as Phaser from 'phaser';
import type { RegionMap, MapEdge } from '../models/RegionMap';

export type PathState = 'future' | 'available' | 'completed';

export interface EdgeCoords {
  from: { x: number; y: number };
  to:   { x: number; y: number };
}

export class PathRenderer {
  private scene: Phaser.Scene;
  private graphicsByEdge = new Map<string, Phaser.GameObjects.Graphics>();
  private coordsByEdge: Map<string, EdgeCoords>;

  constructor(scene: Phaser.Scene, coords: Map<string, EdgeCoords>) {
    this.scene = scene;
    this.coordsByEdge = coords;
  }

  renderAll(map: RegionMap): void {
    for (const e of map.edges) {
      const key = edgeKey(e);
      if (this.graphicsByEdge.has(key)) continue;
      const g = this.scene.add.graphics();
      g.setDepth(5);
      this.graphicsByEdge.set(key, g);
      this.drawEdge(e, 'future');
    }
  }

  setState(edge: MapEdge, state: PathState): void {
    this.drawEdge(edge, state);
  }

  private drawEdge(edge: MapEdge, state: PathState): void {
    const g = this.graphicsByEdge.get(edgeKey(edge));
    const coords = this.coordsByEdge.get(edgeKey(edge));
    if (!g || !coords) return;
    g.clear();

    const { from, to } = coords;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    // Perpendicular offset for the Bézier control points.
    const perpX = -dy / len;
    const perpY =  dx / len;
    const jitterMag = len * 0.15;
    const cp1 = { x: from.x + dx * 0.33 + perpX * jitterMag, y: from.y + dy * 0.33 + perpY * jitterMag };
    const cp2 = { x: from.x + dx * 0.66 - perpX * jitterMag, y: from.y + dy * 0.66 - perpY * jitterMag };

    const color = state === 'completed' ? 0xc89b3c : 0x2a1a0d;
    const thickness = state === 'completed' ? 6 : 4;
    const alpha = state === 'future' ? 0.4 : state === 'available' ? 1 : 0.9;

    g.lineStyle(thickness, color, alpha);
    const curve = new Phaser.Curves.CubicBezier(
      new Phaser.Math.Vector2(from.x, from.y),
      new Phaser.Math.Vector2(cp1.x, cp1.y),
      new Phaser.Math.Vector2(cp2.x, cp2.y),
      new Phaser.Math.Vector2(to.x, to.y),
    );
    curve.draw(g);
  }
}

function edgeKey(e: MapEdge): string {
  return `${e.from}->${e.to}`;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/ui/PathRenderer.ts
git commit -m "feat(map): PathRenderer for Bézier ink paths"
```

---

## Task 12: AvatarWalker — character sprite + travel tween

**Files:**
- Create: `src/ui/AvatarWalker.ts`

- [ ] **Step 1: Create `src/ui/AvatarWalker.ts`**

```ts
// ABOUTME: Player avatar sprite on the map. Walks along a Bézier curve between nodes.
// ABOUTME: Reuses the existing hero_idle spritesheet at reduced scale.
import * as Phaser from 'phaser';

const WALK_DURATION_MS = 900;

export class AvatarWalker {
  scene: Phaser.Scene;
  sprite: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.sprite = scene.add.sprite(x, y, 'hero_idle').setOrigin(0.5, 0.9).setScale(2.2).setDepth(20);
    this.sprite.play('hero-idle');
  }

  setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y);
  }

  walkTo(
    from: { x: number; y: number },
    to: { x: number; y: number },
    onComplete: () => void,
  ): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    const perpX = -dy / len;
    const perpY =  dx / len;
    const jitterMag = len * 0.15;
    const cp1 = { x: from.x + dx * 0.33 + perpX * jitterMag, y: from.y + dy * 0.33 + perpY * jitterMag };
    const cp2 = { x: from.x + dx * 0.66 - perpX * jitterMag, y: from.y + dy * 0.66 - perpY * jitterMag };

    const curve = new Phaser.Curves.CubicBezier(
      new Phaser.Math.Vector2(from.x, from.y),
      new Phaser.Math.Vector2(cp1.x, cp1.y),
      new Phaser.Math.Vector2(cp2.x, cp2.y),
      new Phaser.Math.Vector2(to.x, to.y),
    );

    const tween = this.scene.tweens.addCounter({
      from: 0, to: 1, duration: WALK_DURATION_MS, ease: 'Sine.easeInOut',
      onUpdate: () => {
        const t = tween.getValue() ?? 0;
        const p = curve.getPoint(t);
        this.sprite.setPosition(p.x, p.y);
      },
      onComplete,
    });
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/ui/AvatarWalker.ts
git commit -m "feat(map): AvatarWalker component"
```

---

## Task 13: MapHud — fixed top bar

**Files:**
- Create: `src/ui/MapHud.ts`

- [ ] **Step 1: Create `src/ui/MapHud.ts`**

```ts
// ABOUTME: Fixed top-bar HUD for MapScene. Shows HP, gold, potions, floor indicator.
// ABOUTME: Locked to the camera so it stays put while the map scrolls.
import * as Phaser from 'phaser';

export interface HudData {
  hp: number;
  maxHp: number;
  gold: number;
  potions: number;
  floor: number;
  totalFloors: number;
}

export class MapHud extends Phaser.GameObjects.Container {
  private text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, 1280, 45);
    bg.lineStyle(2, 0x74b9ff, 1);
    bg.strokeRect(0, 0, 1280, 45);
    this.add(bg);

    this.text = scene.add.text(20, 10, '', {
      fontSize: '22px',
      color: '#fff',
      fontStyle: 'bold',
    });
    this.add(this.text);

    this.setScrollFactor(0);
    this.setDepth(1000);
  }

  update(data: HudData): void {
    this.text.setText(
      `❤️ ${data.hp}/${data.maxHp}    🪙 ${data.gold}    🧪 ${'◯'.repeat(data.potions)}    🗺️ Floor ${data.floor}/${data.totalFloors}`,
    );
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/ui/MapHud.ts
git commit -m "feat(map): MapHud top-bar component"
```

---

## Task 14: RestModal — 30% heal modal

**Files:**
- Create: `src/ui/RestModal.ts`

- [ ] **Step 1: Create `src/ui/RestModal.ts`**

```ts
// ABOUTME: In-scene modal for Rest nodes. Confirms a 30% heal and returns control to MapScene.
// ABOUTME: Used inside MapScene; not a separate Phaser scene.
import * as Phaser from 'phaser';

export interface RestModalResult {
  healedBy: number;
}

export class RestModal extends Phaser.GameObjects.Container {
  private onResolve: (res: RestModalResult) => void;
  private healAmount: number;

  constructor(
    scene: Phaser.Scene,
    hp: number,
    maxHp: number,
    healPct: number,
    onResolve: (res: RestModalResult) => void,
  ) {
    super(scene, 0, 0);
    this.onResolve = onResolve;
    this.healAmount = Math.min(maxHp - hp, Math.ceil(maxHp * healPct));

    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.6).setInteractive();
    this.add(dim);

    const panel = scene.add.graphics();
    panel.fillStyle(0xefe5cc, 1);
    panel.fillRoundedRect(440, 240, 400, 240, 24);
    panel.lineStyle(4, 0x6b4a2b, 1);
    panel.strokeRoundedRect(440, 240, 400, 240, 24);
    this.add(panel);

    const title = scene.add.text(640, 290, 'Rest Site', {
      fontSize: '32px', fontStyle: 'bold', color: '#4a321c',
    }).setOrigin(0.5);
    this.add(title);

    const body = scene.add.text(640, 355,
      `You sit by the fire.\nHP ${hp} → ${hp + this.healAmount} (+${this.healAmount})`,
      { fontSize: '20px', color: '#4a321c', align: 'center' },
    ).setOrigin(0.5);
    this.add(body);

    const btn = scene.add.rectangle(640, 440, 180, 48, 0x6b4a2b).setStrokeStyle(3, 0xc89b3c).setInteractive({ useHandCursor: true });
    const btnText = scene.add.text(640, 440, 'Rest', {
      fontSize: '22px', fontStyle: 'bold', color: '#efe5cc',
    }).setOrigin(0.5);
    this.add(btn);
    this.add(btnText);

    btn.on('pointerdown', () => {
      this.close();
    });

    this.setDepth(2000);
    this.setScrollFactor(0);
  }

  private close(): void {
    this.onResolve({ healedBy: this.healAmount });
    this.destroy();
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/ui/RestModal.ts
git commit -m "feat(map): RestModal for rest nodes"
```

---

## Task 15: PlaceholderModal — stub for shop/event/boss

**Files:**
- Create: `src/ui/PlaceholderModal.ts`

- [ ] **Step 1: Create `src/ui/PlaceholderModal.ts`**

```ts
// ABOUTME: In-scene modal used for node types whose real content isn't built yet.
// ABOUTME: Shows a short message and a dismiss button; boss nodes use this with a "VICTORY" message.
import * as Phaser from 'phaser';

export class PlaceholderModal extends Phaser.GameObjects.Container {
  private onResolve: () => void;

  constructor(scene: Phaser.Scene, title: string, message: string, onResolve: () => void) {
    super(scene, 0, 0);
    this.onResolve = onResolve;

    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.6).setInteractive();
    this.add(dim);

    const panel = scene.add.graphics();
    panel.fillStyle(0xefe5cc, 1);
    panel.fillRoundedRect(440, 240, 400, 240, 24);
    panel.lineStyle(4, 0x6b4a2b, 1);
    panel.strokeRoundedRect(440, 240, 400, 240, 24);
    this.add(panel);

    const titleText = scene.add.text(640, 290, title, {
      fontSize: '32px', fontStyle: 'bold', color: '#4a321c',
    }).setOrigin(0.5);
    this.add(titleText);

    const body = scene.add.text(640, 360, message, {
      fontSize: '20px', color: '#4a321c', align: 'center', wordWrap: { width: 360 },
    }).setOrigin(0.5);
    this.add(body);

    const btn = scene.add.rectangle(640, 440, 180, 48, 0x6b4a2b).setStrokeStyle(3, 0xc89b3c).setInteractive({ useHandCursor: true });
    const btnText = scene.add.text(640, 440, 'Continue', {
      fontSize: '22px', fontStyle: 'bold', color: '#efe5cc',
    }).setOrigin(0.5);
    this.add(btn);
    this.add(btnText);

    btn.on('pointerdown', () => {
      this.onResolve();
      this.destroy();
    });

    this.setDepth(2000);
    this.setScrollFactor(0);
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/ui/PlaceholderModal.ts
git commit -m "feat(map): PlaceholderModal for stubbed node types"
```

---

## Task 16: MapScene — scaffolding, rendering, interaction

This is the biggest task. It sets up the full map screen: parchment layers, nodes, paths, avatar, HUD, input. No combat hand-off yet — that's Task 17.

**Files:**
- Create: `src/scenes/MapScene.ts`

- [ ] **Step 1: Create `src/scenes/MapScene.ts`**

```ts
// ABOUTME: Phaser scene that renders a RegionMap + RunProgress as a scrollable parchment column.
// ABOUTME: Handles node selection, avatar travel, and node-action dispatch.
import * as Phaser from 'phaser';
import type { RegionMap, MapNode, MapEdge } from '../models/RegionMap';
import type { RunProgress } from '../models/RunProgress';
import { NodeView, type NodeViewState } from '../ui/NodeView';
import { PathRenderer, type EdgeCoords } from '../ui/PathRenderer';
import { AvatarWalker } from '../ui/AvatarWalker';
import { MapHud } from '../ui/MapHud';
import { RestModal } from '../ui/RestModal';
import { PlaceholderModal } from '../ui/PlaceholderModal';

const COLUMN_X_MIN = 360;
const COLUMN_X_MAX = 920;
const LANE_X: Record<number, number> = { 0: 460, 1: 640, 2: 820 };
const FLOOR_Y: Record<number, number> = { 1: 1320, 2: 1080, 3: 840, 4: 600, 5: 360 };
const WORLD_HEIGHT = 1440;

// Stub stats until the run system lands.
const PLAYER_HP = 75;
const PLAYER_MAX_HP = 75;
const PLAYER_GOLD = 0;
const PLAYER_POTIONS = 0;
const TOTAL_FLOORS = 5;

export interface MapSceneData {
  map: RegionMap;
  progress: RunProgress;
  lastResult?: 'victory' | 'defeat';
}

export class MapScene extends Phaser.Scene {
  private map!: RegionMap;
  private progress!: RunProgress;
  private nodeViews = new Map<string, NodeView>();
  private paths!: PathRenderer;
  private avatar!: AvatarWalker;
  private hud!: MapHud;
  private activeModal?: Phaser.GameObjects.Container;

  constructor() { super('MapScene'); }

  init(data: MapSceneData): void {
    this.map = data.map;
    this.progress = data.progress;
  }

  create(): void {
    this.cameras.main.setBounds(0, 0, 1280, WORLD_HEIGHT);

    // Parchment sidebars (fixed to camera).
    this.add.rectangle(COLUMN_X_MIN / 2, 360, COLUMN_X_MIN, 720, 0xd9c9a0).setScrollFactor(0).setDepth(-10);
    this.add.rectangle((1280 + COLUMN_X_MAX) / 2, 360, 1280 - COLUMN_X_MAX, 720, 0xd9c9a0).setScrollFactor(0).setDepth(-10);

    // Parchment column background (scrolls with the map).
    const column = this.add.graphics();
    column.fillStyle(0xf4ecd8, 1);
    column.fillRect(COLUMN_X_MIN, 0, COLUMN_X_MAX - COLUMN_X_MIN, WORLD_HEIGHT);
    column.fillStyle(0x000000, 0.08);
    column.fillRect(COLUMN_X_MIN, 0, 6, WORLD_HEIGHT);
    column.fillRect(COLUMN_X_MAX - 6, 0, 6, WORLD_HEIGHT);
    column.setDepth(-5);

    // Build edge coords (same xy math used by PathRenderer and AvatarWalker).
    const edgeCoords = new Map<string, EdgeCoords>();
    for (const e of this.map.edges) {
      const a = this.map.nodes.find(n => n.id === e.from)!;
      const b = this.map.nodes.find(n => n.id === e.to)!;
      edgeCoords.set(`${e.from}->${e.to}`, {
        from: { x: LANE_X[a.lane], y: FLOOR_Y[a.floor] },
        to:   { x: LANE_X[b.lane], y: FLOOR_Y[b.floor] },
      });
    }
    this.paths = new PathRenderer(this, edgeCoords);
    this.paths.renderAll(this.map);

    // Nodes.
    for (const n of this.map.nodes) {
      const view = new NodeView(this, LANE_X[n.lane], FLOOR_Y[n.floor], n);
      view.setDepth(10);
      view.on('pointerdown', () => this.onNodeTapped(n));
      this.add.existing(view);
      this.nodeViews.set(n.id, view);
    }

    // Avatar.
    const startPos = this.avatarRestingPosition();
    this.avatar = new AvatarWalker(this, startPos.x, startPos.y);

    // HUD.
    this.hud = new MapHud(this);
    this.add.existing(this.hud);
    this.refreshHud();

    // Mouse-wheel scroll.
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _go: unknown, _dx: number, dy: number) => {
      this.cameras.main.scrollY = Phaser.Math.Clamp(this.cameras.main.scrollY + dy, 0, WORLD_HEIGHT - 720);
    });

    // Touch drag scroll.
    let dragStartY = 0;
    let dragStartScroll = 0;
    let isDragging = false;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.activeModal) return;
      isDragging = true;
      dragStartY = p.y;
      dragStartScroll = this.cameras.main.scrollY;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!isDragging || !p.isDown) return;
      const dy = dragStartY - p.y;
      this.cameras.main.scrollY = Phaser.Math.Clamp(dragStartScroll + dy, 0, WORLD_HEIGHT - 720);
    });
    this.input.on('pointerup', () => { isDragging = false; });

    this.centerCameraOn(startPos.y);
    this.refreshNodeStates();
  }

  private avatarRestingPosition(): { x: number; y: number } {
    if (this.progress.currentNodeId) {
      const n = this.map.nodes.find(m => m.id === this.progress.currentNodeId)!;
      return { x: LANE_X[n.lane], y: FLOOR_Y[n.floor] };
    }
    // Before the first pick — perch below floor 1, centered.
    return { x: 640, y: FLOOR_Y[1] + 100 };
  }

  private centerCameraOn(worldY: number): void {
    const target = Phaser.Math.Clamp(worldY - 360, 0, WORLD_HEIGHT - 720);
    this.tweens.add({
      targets: this.cameras.main,
      scrollY: target,
      duration: 500,
      ease: 'Power2',
    });
  }

  private refreshHud(): void {
    const floor = this.currentFloor();
    this.hud.update({
      hp: PLAYER_HP, maxHp: PLAYER_MAX_HP,
      gold: PLAYER_GOLD, potions: PLAYER_POTIONS,
      floor, totalFloors: TOTAL_FLOORS,
    });
  }

  private currentFloor(): number {
    if (!this.progress.currentNodeId) return 1;
    const n = this.map.nodes.find(m => m.id === this.progress.currentNodeId);
    return n?.floor ?? 1;
  }

  private refreshNodeStates(): void {
    const available = this.availableNextIds();
    for (const [id, view] of this.nodeViews) {
      let state: NodeViewState;
      if (this.progress.visitedNodeIds.includes(id)) state = 'visited';
      else if (id === this.progress.currentNodeId) state = 'current';
      else if (available.includes(id)) state = 'available';
      else state = 'future';
      view.setNodeState(state);
    }
    // Path states.
    for (const e of this.map.edges) {
      const visited = this.progress.visitedNodeIds;
      const traversed = visited.includes(e.from) && (visited.includes(e.to) || e.to === this.progress.currentNodeId);
      if (traversed) this.paths.setState(e, 'completed');
      else if (e.from === this.progress.currentNodeId && available.includes(e.to)) this.paths.setState(e, 'available');
      else this.paths.setState(e, 'future');
    }
  }

  private availableNextIds(): string[] {
    if (!this.progress.currentNodeId) return [...this.map.startNodeIds];
    return this.map.edges
      .filter(e => e.from === this.progress.currentNodeId)
      .map(e => e.to);
  }

  private onNodeTapped(node: MapNode): void {
    if (this.activeModal) return;
    const available = this.availableNextIds();
    if (!available.includes(node.id)) return;
    this.travelToNode(node);
  }

  protected travelToNode(node: MapNode): void {
    const from = this.avatarRestingPosition();
    const to = { x: LANE_X[node.lane], y: FLOOR_Y[node.floor] };
    this.centerCameraOn(to.y);
    this.avatar.walkTo(from, to, () => {
      // Hand off to the node action.
      this.onArrived(node);
    });
  }

  protected onArrived(node: MapNode): void {
    // In this scaffolding task we just mark visited and continue (Task 17 replaces this).
    this.progress.visitedNodeIds.push(this.progress.currentNodeId ?? '');
    this.progress.currentNodeId = node.id;
    this.refreshNodeStates();
    this.refreshHud();
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/MapScene.ts
git commit -m "feat(map): MapScene scaffolding with rendering and scrolling"
```

---

## Task 17: MapScene node-action dispatch + combat hand-off

Replace the `onArrived` stub with real dispatch: combat/elite/boss → CombatScene; rest → RestModal; event/shop → PlaceholderModal; boss → PlaceholderModal with a "VICTORY" stub.

**Files:**
- Modify: `src/scenes/MapScene.ts`

- [ ] **Step 1: Replace `onArrived`, add dispatch helpers**

Replace the `protected onArrived(node: MapNode)` method in `src/scenes/MapScene.ts` with:

```ts
  protected onArrived(node: MapNode): void {
    // Mark the arrival: the node we just walked to becomes current; old current becomes visited.
    if (this.progress.currentNodeId) this.progress.visitedNodeIds.push(this.progress.currentNodeId);
    this.progress.currentNodeId = node.id;
    this.refreshNodeStates();
    this.refreshHud();

    switch (node.type) {
      case 'combat':
      case 'elite':
        this.launchCombat(node);
        break;
      case 'boss':
        this.showPlaceholder('Boss', 'VICTORY! You have cleared the region.\n(Real boss fight coming soon.)', () => this.completeNode(node));
        break;
      case 'rest':
        this.showRest(node);
        break;
      case 'event':
        this.showPlaceholder('Event', 'Event — coming soon.', () => this.completeNode(node));
        break;
      case 'shop':
        this.showPlaceholder('Shop', 'Shop — coming soon.', () => this.completeNode(node));
        break;
    }
  }

  private launchCombat(node: MapNode): void {
    const enemyId = node.data?.kind === 'combat' || node.data?.kind === 'elite' || node.data?.kind === 'boss'
      ? node.data.enemyId
      : 'thorn-creep';
    this.scene.start('CombatScene', {
      enemyId,
      returnTo: 'MapScene',
      map: this.map,
      progress: this.progress,
    });
  }

  private showRest(node: MapNode): void {
    const healPct = node.data?.kind === 'rest' ? node.data.healPct : 0.30;
    this.activeModal = new RestModal(this, PLAYER_HP, PLAYER_MAX_HP, healPct, () => {
      this.activeModal = undefined;
      this.completeNode(node);
    });
    this.add.existing(this.activeModal);
  }

  private showPlaceholder(title: string, message: string, onClose: () => void): void {
    this.activeModal = new PlaceholderModal(this, title, message, () => {
      this.activeModal = undefined;
      onClose();
    });
    this.add.existing(this.activeModal);
  }

  private completeNode(node: MapNode): void {
    // The node is already current; when the next step starts, it will be shifted into visitedNodeIds.
    // Refresh UI so the current node continues to render as "current".
    this.refreshNodeStates();
    this.refreshHud();
  }
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/MapScene.ts
git commit -m "feat(map): MapScene dispatches combat/rest/placeholder actions"
```

---

## Task 18: CombatScene accepts init data and returns to the map

**Files:**
- Modify: `src/scenes/CombatScene.ts`

- [ ] **Step 1: Add `init` and wire the return flow**

Add this method at the top of the `CombatScene` class body (just after `constructor()`):

```ts
    private launchData: {
        enemyId?: string;
        returnTo?: string;
        map?: import('../models/RegionMap').RegionMap;
        progress?: import('../models/RunProgress').RunProgress;
    } = {};

    init(data: {
        enemyId?: string;
        returnTo?: string;
        map?: import('../models/RegionMap').RegionMap;
        progress?: import('../models/RunProgress').RunProgress;
    }): void {
        this.launchData = data ?? {};
        this.gameOverShown = false;
    }
```

- [ ] **Step 2: Hook the defeat branch**

Find the block in `updateUI()` that handles `TurnPhase.GAME_OVER` (starts with `if (this.state.currentPhase === TurnPhase.GAME_OVER && !this.gameOverShown)`). At the end of that block — right after `this.endTurnBtn.setVisible(false);` — add the return-to-map hand-off:

```ts
            this.time.delayedCall(2200, () => {
                if (this.launchData.returnTo && this.launchData.map && this.launchData.progress) {
                    const result: 'victory' | 'defeat' = playerWon ? 'victory' : 'defeat';
                    if (result === 'victory') {
                        this.scene.start(this.launchData.returnTo, {
                            map: this.launchData.map,
                            progress: this.launchData.progress,
                            lastResult: 'victory',
                        });
                    } else {
                        // v1 stub: restart the scene with a freshly generated map.
                        this.scene.start('BootScene');
                    }
                }
            });
```

- [ ] **Step 3: Verify build and smoke-run**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/CombatScene.ts
git commit -m "feat(combat): accept map/progress init data and return to MapScene on resolution"
```

---

## Task 19: BootScene launches MapScene with URL-param overrides

**Files:**
- Modify: `src/scenes/BootScene.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Update `BootScene.create()` to start MapScene**

In `src/scenes/BootScene.ts`, add the imports:

```ts
import { generateRegionMap } from '../map/generator';
import { witheredGardenBlueprint } from '../map/blueprints';
import { tutorialMap } from '../fixtures/maps/tutorial-map';
import type { RunProgress } from '../models/RunProgress';
```

Replace the final line `this.scene.start('CombatScene');` in `create()` with:

```ts
        const params = new URLSearchParams(window.location.search);
        const mapParam = params.get('map');
        const seedParam = params.get('seed');

        const defaultDevSeed = 1;
        const seed = seedParam ? Number(seedParam) : (import.meta.env.DEV ? defaultDevSeed : Date.now());

        const map = mapParam === 'tutorial'
            ? tutorialMap
            : generateRegionMap(witheredGardenBlueprint, seed);

        const progress: RunProgress = {
            mapId: `${map.regionId}-${map.seed}`,
            currentNodeId: null,
            visitedNodeIds: [],
        };

        this.scene.start('MapScene', { map, progress });
```

- [ ] **Step 2: Register MapScene in `src/main.ts`**

Edit `src/main.ts`:

```ts
import { MapScene } from './scenes/MapScene';
```

Then update the `scene:` array:

```ts
    scene: [BootScene, MapScene, CombatScene],
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`. In a browser, open `http://localhost:5173` (or whichever port Vite reports).

Verify:
1. The map loads with parchment column and 5 floors of nodes visible as you scroll.
2. Only floor-1 nodes are glowing / pulsing.
3. Tap a floor-1 combat node. Avatar walks to the node. Combat scene loads with the existing droid.
4. Win the combat. Map reloads with the combat node visited, floor-2 reachable nodes glowing.
5. Tap `http://localhost:5173/?map=tutorial` in a fresh tab — the tutorial fixture loads.
6. Tap a rest node (in the tutorial layout, floor 3 lane 0). Rest modal appears; confirm; dismisses.
7. Tap an event/shop node — placeholder modal.
8. Walk to the boss — "VICTORY" placeholder.

If any step fails, fix before continuing. Kill the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/BootScene.ts src/main.ts
git commit -m "feat(map): BootScene launches MapScene with seed and map URL params"
```

---

## Task 20: Playwright-style smoke test

The repo already has `puppeteer` as a dep. One automated smoke test.

**Files:**
- Create: `tests/e2e/map-smoke.test.ts`
- Modify: `package.json` (add script)

- [ ] **Step 1: Add script**

In `package.json`, in `"scripts"`, add:

```json
    "test:e2e": "tsx tests/e2e/map-smoke.test.ts"
```

Run: `npm install --save-dev tsx`

- [ ] **Step 2: Write the smoke test**

Create `tests/e2e/map-smoke.test.ts`:

```ts
// ABOUTME: End-to-end smoke test — loads the dev server, waits for MapScene, asserts parchment renders.
// ABOUTME: Must be run with the dev server already up on port 5173.
import puppeteer from 'puppeteer';

const DEV_URL = 'http://localhost:5173/?seed=1';

async function main(): Promise<void> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(DEV_URL, { waitUntil: 'networkidle0' });

  // Give MapScene time to draw after BootScene transitions.
  await new Promise((r) => setTimeout(r, 2500));

  const color = await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      // Phaser uses WebGL; fall back to a WebGL pixel read.
      const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
      if (!gl) return null;
      const pixels = new Uint8Array(4);
      gl.readPixels(200, 200, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return { r: pixels[0], g: pixels[1], b: pixels[2] };
    }
    const px = ctx.getImageData(200, 200, 1, 1).data;
    return { r: px[0], g: px[1], b: px[2] };
  });

  await browser.close();

  if (!color) throw new Error('smoke test: could not read pixel color from canvas');

  // Parchment sidebar is ~#d9c9a0. Accept a wide tolerance.
  const { r, g, b } = color;
  const isParchment = r > 160 && r < 240 && g > 150 && g < 230 && b > 100 && b < 200;
  if (!isParchment) {
    throw new Error(`smoke test: expected parchment-like color at (200, 200), got rgb(${r}, ${g}, ${b})`);
  }

  console.log('smoke test: OK — parchment color detected at (200, 200).');
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 3: Run the smoke test**

In one terminal: `npm run dev`
In another: `npm run test:e2e`

Expected: `smoke test: OK — parchment color detected at (200, 200).` Exit 0.

Kill the dev server.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/map-smoke.test.ts package.json package-lock.json
git commit -m "test: add puppeteer smoke test for MapScene rendering"
```

---

## Self-review checklist (for plan author)

- [x] Every spec section has a task that implements it.
- [x] No "TBD", "TODO", "similar to Task N", or bare narration — all code is written out.
- [x] Type names are consistent across tasks (`RegionMap`, `MapNode`, `MapEdge`, `NodeType`, `NodeData`, `RegionBlueprint`, `FloorRule`, `RequiredCount`, `RunProgress`, `ValidationResult`, `MapAnalysis`).
- [x] Function signatures match between the task that defines them and the tasks that call them (`createRng`, `generateRegionMap`, `validateRegionMap`, `analyzeMap`).
- [x] Node id scheme (`f{floor}-l{lane}`, `boss`) used consistently.
- [x] Coordinate constants (`LANE_X`, `FLOOR_Y`, `WORLD_HEIGHT`) match the spec.
- [x] TDD ordering: tests written, run red, code, run green, commit.
- [x] Every commit is scoped to one task.
- [x] ABOUTME headers on every new file.

If the engineer hits a blocker, the fastest debugging path is:

1. A failing generator test → print `generateRegionMap(blueprint, seedN)` and inspect the returned map against the validator errors.
2. A failing render → open `http://localhost:5173/?map=tutorial` (deterministic map) before reaching for a random seed.
3. A failing combat return → check that `scene.start('CombatScene', { ... })` arguments match `init(data)` shape in CombatScene.
