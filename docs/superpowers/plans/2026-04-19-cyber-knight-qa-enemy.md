# Cyber Knight QA-Only Enemy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second enemy (`cyber-knight`) reachable only via the QA debug panel, alongside the small refactors that make enemy data and rendering driven by `EnemyDef` instead of hardcoded droid references.

**Architecture:** Introduce a behavior registry (`src/content/behaviors/`) that dispatches on `EnemyDef.behaviorId`, extend `EnemyDef` with a `sprite` config consumed by `CombatScene`, and add a new action type `Charge` for a two-turn windup/strike pattern. One new QA button in `QaDebugPanel.ts` starts combat with the new enemy.

**Tech Stack:** TypeScript, Phaser 4, Vitest (`npm run test`), ImageMagick (`magick`) for asset preprocessing.

**Spec:** `docs/superpowers/specs/2026-04-19-cyber-knight-qa-enemy-design.md`

---

## File Structure

**New files:**
- `scripts/prepare-cyber-knight-sprites.sh` — idempotent downsampler from `~/Downloads/*.png` to `public/assets/cyber_knight_*.png`
- `public/assets/cyber_knight_idle.png` — generated 868×1036 sheet, 8×8 grid, ~108×130 per frame
- `public/assets/cyber_knight_attack.png` — generated 1280×1280 sheet, 8×8 grid, 160×160 per frame
- `src/content/behaviors/index.ts` — `BEHAVIORS` registry + `BehaviorCtx`/`BehaviorFn` types
- `src/content/behaviors/boss_phases.ts` — verbatim port of today's `generateNextEnemyAction` body
- `src/content/behaviors/simple_attack.ts` — minimal attack-only behavior (not yet reachable)
- `src/content/behaviors/heavy_slow.ts` — attack/defend alternation (not yet reachable)
- `src/content/behaviors/cyber_knight_charge.ts` — Charge ↔ Strike alternation
- `tests/behaviors.test.ts` — covers all four behaviors (one file, multiple `describe` blocks)
- `tests/cyber-knight-combat.test.ts` — integration test for CombatState driven by the cyber-knight EnemyDef

**Modified files:**
- `src/content/enemies.ts` — add `EnemyDef.sprite`, fill all existing entries, add `cyber-knight`
- `src/models/CombatState.ts` — add `'Charge'` action type, accept optional `EnemyDef`, replace `generateNextEnemyAction` body with registry dispatch, handle Charge in `executeEnemyAction`/`getEnemyIntentDisplay`
- `src/scenes/BootScene.ts` — preload two spritesheets, register three animations
- `src/scenes/CombatScene.ts` — honor `enemyId` init param, build enemy sprite from `EnemyDef.sprite`, wire attack animation chain, handle `Charge` action with a gold tint pulse
- `src/qa/fixtures.ts` — add optional `enemyIdOverride` to the `COMBAT` fixture path
- `src/ui/QaDebugPanel.ts` — add `Fight Cyber Knight` button

---

## Task 1: Preprocess sprite assets

**Files:**
- Create: `scripts/prepare-cyber-knight-sprites.sh`
- Create: `public/assets/cyber_knight_idle.png`
- Create: `public/assets/cyber_knight_attack.png`

No unit tests — this is a one-shot ingestion script. Verification is file-size + `identify` output.

- [ ] **Step 1: Write the script**

`scripts/prepare-cyber-knight-sprites.sh`:

```bash
#!/usr/bin/env bash
# ABOUTME: Downsamples the full-resolution cyber-knight sprite sheets from ~/Downloads to public/assets.
# ABOUTME: Idempotent — rerun after Sami drops updated PNGs in ~/Downloads. Requires `magick` (ImageMagick).

set -euo pipefail

SRC_STAND="${HOME}/Downloads/A-front-facing-cel-shaded-cybernetic-knight-depict-max-px-64 (1).png"
SRC_FIGHT="${HOME}/Downloads/A-front-facing-cel-shaded-cybernetic-knight-depict-max-px-64.png"

REPO_ROOT="$(git rev-parse --show-toplevel)"
OUT_DIR="${REPO_ROOT}/public/assets"

if [ ! -d "$OUT_DIR" ]; then
  echo "Error: $OUT_DIR does not exist. Run this from inside the spire-like project." >&2
  exit 1
fi

if [ ! -f "$SRC_STAND" ]; then
  echo "Error: missing source standing sheet: $SRC_STAND" >&2
  exit 1
fi

if [ ! -f "$SRC_FIGHT" ]; then
  echo "Error: missing source fighting sheet: $SRC_FIGHT" >&2
  exit 1
fi

magick "$SRC_STAND" -resize 25% "${OUT_DIR}/cyber_knight_idle.png"
magick "$SRC_FIGHT" -resize 25% "${OUT_DIR}/cyber_knight_attack.png"

echo "OK: wrote"
echo "  ${OUT_DIR}/cyber_knight_idle.png"
echo "  ${OUT_DIR}/cyber_knight_attack.png"
```

- [ ] **Step 2: Make it executable and run it**

```bash
chmod +x scripts/prepare-cyber-knight-sprites.sh
./scripts/prepare-cyber-knight-sprites.sh
```

Expected output:
```
OK: wrote
  <repo>/public/assets/cyber_knight_idle.png
  <repo>/public/assets/cyber_knight_attack.png
```

- [ ] **Step 3: Verify output dimensions**

```bash
identify public/assets/cyber_knight_idle.png public/assets/cyber_knight_attack.png
```

Expected: idle ≈ 868×1036, attack = 1280×1280. If the attack sheet is not exactly 1280×1280, recompute frame size as `<width>/8 × <height>/8` and note the actual numbers — Task 7 references these as `frameWidth`/`frameHeight`.

- [ ] **Step 4: Commit**

```bash
git add scripts/prepare-cyber-knight-sprites.sh public/assets/cyber_knight_idle.png public/assets/cyber_knight_attack.png
git commit -m "chore(assets): add cyber-knight idle + attack spritesheets"
```

---

## Task 2: Add `Charge` action type with display + resolution

Before introducing the registry, make `CombatState` know about the new action shape. This keeps the type system happy as subsequent tasks import the union.

**Files:**
- Modify: `src/models/CombatState.ts`
- Create: `tests/charge-action.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/charge-action.test.ts`:

```ts
// ABOUTME: Verifies the Charge action type: resolves with no damage and grants strength to the enemy.
import { describe, it, expect } from 'vitest';
import { CombatState } from '../src/models/CombatState';

describe('Charge action', () => {
  it('resolves without damaging the player and grants strength to the enemy', () => {
    const state = new CombatState();
    state.nextEnemyAction = { type: 'Charge', damage: 0, strengthGain: 3 };
    const startingPlayerHp = state.player.hp;
    const startingEnemyStrength = state.enemy.strength;

    state.executeEnemyAction();

    expect(state.player.hp).toBe(startingPlayerHp);
    expect(state.enemy.strength).toBe(startingEnemyStrength + 3);
  });

  it('shows a "Charging" gold intent when the next action is Charge', () => {
    const state = new CombatState();
    state.nextEnemyAction = { type: 'Charge', damage: 0, strengthGain: 3 };

    const intent = state.getEnemyIntentDisplay();

    expect(intent.text).toBe('⚡ Charging');
    expect(intent.color).toBe('#fdcb6e');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/charge-action.test.ts`
Expected: both tests fail with TypeScript errors about the `'Charge'` literal not being assignable (or runtime failures on intent text).

- [ ] **Step 3: Extend the action type**

In `src/models/CombatState.ts`, change the `nextEnemyAction` declaration:

```ts
    nextEnemyAction!: {
        type: 'Attack' | 'Defend' | 'Debuff' | 'Charge',
        damage: number,
        slam?: boolean,
        strengthGain?: number,
    };
```

- [ ] **Step 4: Handle Charge in `executeEnemyAction`**

Replace the body of `executeEnemyAction` in `src/models/CombatState.ts` with:

```ts
    executeEnemyAction() {
        this.currentPhase = TurnPhase.ENEMY_ACTION;
        const action = this.nextEnemyAction;
        let actualDamage = 0;

        if (action.type === 'Attack') {
            actualDamage = this.player.calculateDamage(action.damage, this.enemy);
            this.player.takeDamage(actualDamage);
        } else if (action.type === 'Defend') {
            this.enemy.addBlock(15);
        } else if (action.type === 'Charge') {
            this.enemy.strength += action.strengthGain ?? 0;
        } else {
            this.player.vulnerable += 2;
        }

        this.enemy.endTurn();
        this.generateNextEnemyAction();
        this.checkGameOver();
        this.onStateChanged();

        return { ...action, actualDamage };
    }
```

- [ ] **Step 5: Handle Charge in `getEnemyIntentDisplay`**

Replace `getEnemyIntentDisplay` with:

```ts
    getEnemyIntentDisplay(): { text: string, color: string } {
        const action = this.nextEnemyAction;
        if (action.type === 'Attack') {
            const displayDmg = this.player.calculateDamage(action.damage, this.enemy);
            const icon = action.slam ? '⚡' : '⚔️';
            return { text: `${icon} ${displayDmg}`, color: action.slam ? '#fdcb6e' : '#ff7675' };
        } else if (action.type === 'Defend') {
            return { text: '🛡️', color: '#74b9ff' };
        } else if (action.type === 'Charge') {
            return { text: '⚡ Charging', color: '#fdcb6e' };
        } else {
            return { text: '💔', color: '#a29bfe' };
        }
    }
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test -- tests/charge-action.test.ts`
Expected: both tests pass.

- [ ] **Step 7: Run the full test suite to confirm no regressions**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/models/CombatState.ts tests/charge-action.test.ts
git commit -m "feat(combat): add Charge action type for windup behaviors"
```

---

## Task 3: Create behavior registry and move existing AI to `boss_phases`

Behavior extraction with zero gameplay change. The existing `generateNextEnemyAction` logic becomes `boss_phases` verbatim; `CombatState` dispatches by `behaviorId`.

**Files:**
- Create: `src/content/behaviors/index.ts`
- Create: `src/content/behaviors/boss_phases.ts`
- Modify: `src/models/CombatState.ts`
- Create: `tests/behaviors.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/behaviors.test.ts`:

```ts
// ABOUTME: Tests each enemy behavior function in isolation via the BEHAVIORS registry.
// ABOUTME: Verifies dispatch, parity with the previous inline AI, and cyber_knight_charge alternation.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CombatEntity } from '../src/models/CombatEntity';
import { BEHAVIORS } from '../src/content/behaviors';

function ctx(overrides: Partial<{
  enemy: CombatEntity; player: CombatEntity; turnCount: number;
}> = {}) {
  return {
    enemy: overrides.enemy ?? new CombatEntity(false, 80),
    player: overrides.player ?? new CombatEntity(true, 75, 3),
    turnCount: overrides.turnCount ?? 1,
  };
}

describe('BEHAVIORS registry', () => {
  it('has all four behaviors registered by id', () => {
    expect(BEHAVIORS.simple_attack).toBeTypeOf('function');
    expect(BEHAVIORS.heavy_slow).toBeTypeOf('function');
    expect(BEHAVIORS.boss_phases).toBeTypeOf('function');
    expect(BEHAVIORS.cyber_knight_charge).toBeTypeOf('function');
  });
});

describe('boss_phases behavior', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns a slam Attack every 3rd turn', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const action = BEHAVIORS.boss_phases!(ctx({ turnCount: 3 }));
    expect(action.type).toBe('Attack');
    expect(action.slam).toBe(true);
  });

  it('finishes off a low-HP player', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const player = new CombatEntity(true, 75, 3);
    player.hp = 10;
    const action = BEHAVIORS.boss_phases!(ctx({ player, turnCount: 1 }));
    expect(action.type).toBe('Attack');
    expect(action.slam).toBeFalsy();
    expect(action.damage).toBeGreaterThanOrEqual(10);
  });

  it('emits Defend when enemy is hurt and unblocked (random path)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const enemy = new CombatEntity(false, 80);
    enemy.hp = 20;
    const action = BEHAVIORS.boss_phases!(ctx({ enemy, turnCount: 1 }));
    expect(action.type).toBe('Defend');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- tests/behaviors.test.ts`
Expected: fails with `Cannot find module '../src/content/behaviors'`.

- [ ] **Step 3: Define the registry and types**

Create `src/content/behaviors/index.ts`:

```ts
// ABOUTME: Behavior registry keyed by EnemyDef.behaviorId.
// ABOUTME: CombatState.generateNextEnemyAction dispatches through BEHAVIORS on each turn.

import type { CombatEntity } from '../../models/CombatEntity';
import { bossPhases } from './boss_phases';

export type EnemyAction = {
  type: 'Attack' | 'Defend' | 'Debuff' | 'Charge';
  damage: number;
  slam?: boolean;
  strengthGain?: number;
};

export type BehaviorCtx = {
  enemy: CombatEntity;
  player: CombatEntity;
  turnCount: number;
};

export type BehaviorFn = (ctx: BehaviorCtx) => EnemyAction;

export const BEHAVIORS: Record<string, BehaviorFn> = {
  boss_phases: bossPhases,
  // simple_attack, heavy_slow, cyber_knight_charge registered in later tasks
};
```

- [ ] **Step 4: Port the existing logic into `boss_phases.ts`**

Create `src/content/behaviors/boss_phases.ts`:

```ts
// ABOUTME: Hollow Gardener AI. Every 3rd turn slam; reacts to player HP, vulnerable, block.
// ABOUTME: Verbatim port of the previous inline CombatState.generateNextEnemyAction body.

import type { BehaviorFn, EnemyAction } from './index';

export const bossPhases: BehaviorFn = ({ enemy, player, turnCount }) => {
  const hpPct = enemy.hp / enemy.maxHp;
  const playerLow = player.hp < player.maxHp * 0.35;
  const playerVulnerable = player.vulnerable > 0;
  const enemyHurt = hpPct < 0.5;
  const playerBlocked = player.block >= 10;

  if (turnCount % 3 === 0) {
    return { type: 'Attack', damage: Math.floor(Math.random() * 4) + 14, slam: true };
  }

  if (playerLow) {
    return { type: 'Attack', damage: Math.floor(Math.random() * 6) + 10 };
  }

  if (playerVulnerable) {
    return { type: 'Attack', damage: Math.floor(Math.random() * 4) + 12 };
  }

  if (playerBlocked && Math.random() < 0.6) {
    return { type: 'Debuff', damage: 0 };
  }

  if (enemyHurt && enemy.block < 10 && Math.random() < 0.5) {
    return { type: 'Defend', damage: 0 };
  }

  const r = Math.random();
  if (r < 0.6) {
    return { type: 'Attack', damage: Math.floor(Math.random() * 6) + 10 };
  } else if (r < 0.8) {
    return { type: 'Debuff', damage: 0 };
  }
  return { type: 'Defend', damage: 0 };
};
```

- [ ] **Step 5: Replace `generateNextEnemyAction` with registry dispatch**

In `src/models/CombatState.ts`, add this import near the top (alongside existing imports):

```ts
import { BEHAVIORS } from '../content/behaviors';
```

Replace the entire `generateNextEnemyAction` method (everything from `generateNextEnemyAction() {` through the closing `}`) with:

```ts
    generateNextEnemyAction() {
        this.turnCount++;
        const behavior = BEHAVIORS[this.behaviorId] ?? BEHAVIORS.boss_phases!;
        this.nextEnemyAction = behavior({
            enemy: this.enemy,
            player: this.player,
            turnCount: this.turnCount,
        });
    }
```

At the top of the `CombatState` class, add a `behaviorId` field initialized to `'boss_phases'` (preserves existing behavior when no `EnemyDef` is passed):

```ts
    behaviorId: string = 'boss_phases';
```

- [ ] **Step 6: Run behavior tests to verify they pass**

Run: `npm run test -- tests/behaviors.test.ts tests/charge-action.test.ts`
Expected: all tests pass.

- [ ] **Step 7: Run full suite to confirm no regressions**

Run: `npm run test`
Expected: all tests pass. In particular, `card-engine.test.ts` and any CombatState integration tests must still pass — the constructor still defaults to the same behavior.

- [ ] **Step 8: Commit**

```bash
git add src/content/behaviors/index.ts src/content/behaviors/boss_phases.ts src/models/CombatState.ts tests/behaviors.test.ts
git commit -m "refactor(combat): extract enemy AI to behavior registry"
```

---

## Task 4: Add `simple_attack` and `heavy_slow` behaviors

Round out the existing `behaviorId` values referenced in `ENEMIES` so the dispatcher has something to point at when those enemies become reachable later.

**Files:**
- Create: `src/content/behaviors/simple_attack.ts`
- Create: `src/content/behaviors/heavy_slow.ts`
- Modify: `src/content/behaviors/index.ts`
- Modify: `tests/behaviors.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/behaviors.test.ts`:

```ts
describe('simple_attack behavior', () => {
  afterEach(() => vi.restoreAllMocks());

  it('always returns an Attack between 8 and 12 damage', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(BEHAVIORS.simple_attack!(ctx())).toEqual({ type: 'Attack', damage: 8 });

    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    expect(BEHAVIORS.simple_attack!(ctx())).toEqual({ type: 'Attack', damage: 12 });
  });
});

describe('heavy_slow behavior', () => {
  it('attacks on odd turns', () => {
    const action = BEHAVIORS.heavy_slow!(ctx({ turnCount: 1 }));
    expect(action.type).toBe('Attack');
    expect(action.damage).toBeGreaterThanOrEqual(18);
    expect(action.damage).toBeLessThanOrEqual(22);
  });

  it('defends on even turns', () => {
    const action = BEHAVIORS.heavy_slow!(ctx({ turnCount: 2 }));
    expect(action).toEqual({ type: 'Defend', damage: 0 });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- tests/behaviors.test.ts`
Expected: both new `describe` blocks fail because `BEHAVIORS.simple_attack` and `BEHAVIORS.heavy_slow` are `undefined`.

- [ ] **Step 3: Implement `simple_attack.ts`**

Create `src/content/behaviors/simple_attack.ts`:

```ts
// ABOUTME: Mook AI. Always emits an Attack for 8-12 damage, no branching.
import type { BehaviorFn } from './index';

export const simpleAttack: BehaviorFn = () => ({
  type: 'Attack',
  damage: Math.floor(Math.random() * 5) + 8,
});
```

- [ ] **Step 4: Implement `heavy_slow.ts`**

Create `src/content/behaviors/heavy_slow.ts`:

```ts
// ABOUTME: Alternating heavy-hitter AI. Attack for 18-22 on odd turns, Defend on even turns.
import type { BehaviorFn } from './index';

export const heavySlow: BehaviorFn = ({ turnCount }) => {
  if (turnCount % 2 === 1) {
    return { type: 'Attack', damage: Math.floor(Math.random() * 5) + 18 };
  }
  return { type: 'Defend', damage: 0 };
};
```

- [ ] **Step 5: Register both in the registry**

Edit `src/content/behaviors/index.ts` — add two imports and two entries:

```ts
import { bossPhases } from './boss_phases';
import { simpleAttack } from './simple_attack';
import { heavySlow } from './heavy_slow';
```

```ts
export const BEHAVIORS: Record<string, BehaviorFn> = {
  simple_attack: simpleAttack,
  heavy_slow: heavySlow,
  boss_phases: bossPhases,
  // cyber_knight_charge registered in Task 5
};
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test -- tests/behaviors.test.ts`
Expected: all `describe` blocks pass.

- [ ] **Step 7: Commit**

```bash
git add src/content/behaviors/simple_attack.ts src/content/behaviors/heavy_slow.ts src/content/behaviors/index.ts tests/behaviors.test.ts
git commit -m "feat(combat): add simple_attack and heavy_slow behaviors"
```

---

## Task 5: Add `cyber_knight_charge` behavior

The Cyber Knight's alternating Charge / Strike pattern.

**Files:**
- Create: `src/content/behaviors/cyber_knight_charge.ts`
- Modify: `src/content/behaviors/index.ts`
- Modify: `tests/behaviors.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/behaviors.test.ts`:

```ts
describe('cyber_knight_charge behavior', () => {
  it('returns Charge on odd turns with strengthGain 3', () => {
    const action = BEHAVIORS.cyber_knight_charge!(ctx({ turnCount: 1 }));
    expect(action).toEqual({ type: 'Charge', damage: 0, strengthGain: 3 });

    const laterAction = BEHAVIORS.cyber_knight_charge!(ctx({ turnCount: 5 }));
    expect(laterAction).toEqual({ type: 'Charge', damage: 0, strengthGain: 3 });
  });

  it('returns Strike (base 30 Attack) on even turns', () => {
    const action = BEHAVIORS.cyber_knight_charge!(ctx({ turnCount: 2 }));
    expect(action).toEqual({ type: 'Attack', damage: 30 });

    const laterAction = BEHAVIORS.cyber_knight_charge!(ctx({ turnCount: 8 }));
    expect(laterAction).toEqual({ type: 'Attack', damage: 30 });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- tests/behaviors.test.ts`
Expected: fails because `BEHAVIORS.cyber_knight_charge` is `undefined`.

- [ ] **Step 3: Implement the behavior**

Create `src/content/behaviors/cyber_knight_charge.ts`:

```ts
// ABOUTME: Cyber Knight AI. Alternates Charge (strengthGain +3, no damage) with Strike (base 30 Attack).
// ABOUTME: Strength accumulates across cycles so consecutive Strikes escalate via calculateDamage.
import type { BehaviorFn } from './index';

export const cyberKnightCharge: BehaviorFn = ({ turnCount }) => {
  if (turnCount % 2 === 1) {
    return { type: 'Charge', damage: 0, strengthGain: 3 };
  }
  return { type: 'Attack', damage: 30 };
};
```

- [ ] **Step 4: Register it**

Edit `src/content/behaviors/index.ts`:

```ts
import { cyberKnightCharge } from './cyber_knight_charge';
```

```ts
export const BEHAVIORS: Record<string, BehaviorFn> = {
  simple_attack: simpleAttack,
  heavy_slow: heavySlow,
  boss_phases: bossPhases,
  cyber_knight_charge: cyberKnightCharge,
};
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npm run test -- tests/behaviors.test.ts`
Expected: all behavior tests pass, including the new `cyber_knight_charge` cases.

- [ ] **Step 6: Commit**

```bash
git add src/content/behaviors/cyber_knight_charge.ts src/content/behaviors/index.ts tests/behaviors.test.ts
git commit -m "feat(combat): add cyber_knight_charge behavior"
```

---

## Task 6: Extend `EnemyDef` with `sprite` config and add cyber-knight

**Files:**
- Modify: `src/content/enemies.ts`
- Create: `tests/enemies.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/enemies.test.ts`:

```ts
// ABOUTME: Tests EnemyDef shape invariants: every enemy has a non-empty sprite config.
// ABOUTME: Also verifies the cyber-knight entry exists with the expected behavior/sprite wiring.
import { describe, it, expect } from 'vitest';
import { ENEMIES, getEnemyById } from '../src/content/enemies';

describe('ENEMIES sprite config', () => {
  it('every enemy has a populated sprite config', () => {
    for (const enemy of ENEMIES) {
      expect(enemy.sprite.textureKey, `${enemy.id} textureKey`).not.toBe('');
      expect(enemy.sprite.idleAnimKey, `${enemy.id} idleAnimKey`).not.toBe('');
      expect(enemy.sprite.attackAnimKeys.length, `${enemy.id} attackAnimKeys`).toBeGreaterThan(0);
      expect(enemy.sprite.scale, `${enemy.id} scale`).toBeGreaterThan(0);
    }
  });
});

describe('cyber-knight EnemyDef', () => {
  it('is registered with the expected stats and sprite wiring', () => {
    const def = getEnemyById('cyber-knight');
    expect(def).toBeDefined();
    expect(def!.name).toBe('Cyber Knight');
    expect(def!.hp).toBe(90);
    expect(def!.tier).toBe('elite');
    expect(def!.behaviorId).toBe('cyber_knight_charge');
    expect(def!.sprite.textureKey).toBe('cyber_knight_idle');
    expect(def!.sprite.idleAnimKey).toBe('cyber-knight-idle');
    expect(def!.sprite.attackAnimKeys).toEqual(['cyber-knight-attack-windup', 'cyber-knight-attack-strike']);
    expect(def!.sprite.scale).toBe(1.4);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- tests/enemies.test.ts`
Expected: TypeScript errors about `sprite` not being a property of `EnemyDef`, and `getEnemyById('cyber-knight')` returning undefined.

- [ ] **Step 3: Replace `src/content/enemies.ts`**

Replace the entire contents of `src/content/enemies.ts`:

```ts
// ABOUTME: Enemy roster for combat encounters. Data-driven via behaviorId + sprite config.
// ABOUTME: CombatState dispatches AI through BEHAVIORS; CombatScene builds sprites from sprite fields.

export interface EnemySpriteConfig {
  textureKey: string;
  idleAnimKey: string;
  attackAnimKeys: string[];
  scale: number;
  yOffset?: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  tier: 'normal' | 'elite' | 'boss';
  behaviorId: string;
  sprite: EnemySpriteConfig;
}

const DROID_SPRITE: EnemySpriteConfig = {
  textureKey: 'droid_idle',
  idleAnimKey: 'droid-idle',
  attackAnimKeys: ['droid-attack1'],
  scale: 6,
};

export const ENEMIES: readonly EnemyDef[] = [
  { id: 'thorn-creep',       name: 'Thorn Creep',         hp: 30,  tier: 'normal', behaviorId: 'simple_attack',      sprite: DROID_SPRITE },
  { id: 'fog-wisp',          name: 'Fog Wisp',            hp: 25,  tier: 'normal', behaviorId: 'simple_attack',      sprite: DROID_SPRITE },
  { id: 'rot-golem',         name: 'Rot Golem',           hp: 80,  tier: 'elite',  behaviorId: 'heavy_slow',         sprite: DROID_SPRITE },
  { id: 'hollow-gardener',   name: 'The Hollow Gardener', hp: 140, tier: 'boss',   behaviorId: 'boss_phases',        sprite: DROID_SPRITE },
  {
    id: 'cyber-knight',
    name: 'Cyber Knight',
    hp: 90,
    tier: 'elite',
    behaviorId: 'cyber_knight_charge',
    sprite: {
      textureKey: 'cyber_knight_idle',
      idleAnimKey: 'cyber-knight-idle',
      attackAnimKeys: ['cyber-knight-attack-windup', 'cyber-knight-attack-strike'],
      scale: 1.4,
      yOffset: -20,
    },
  },
] as const;

export function getEnemyById(id: string): EnemyDef | undefined {
  return ENEMIES.find(e => e.id === id);
}
```

Note: the existing droid sprite is rendered in `CombatScene.ts:122` with `.setScale(6)`, so we set `scale: 6` in `DROID_SPRITE` to preserve current visuals exactly.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run test -- tests/enemies.test.ts`
Expected: both tests pass.

- [ ] **Step 5: Run full suite**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/content/enemies.ts tests/enemies.test.ts
git commit -m "feat(content): extend EnemyDef with sprite config; add cyber-knight"
```

---

## Task 7: Load cyber-knight spritesheets and register animations

Wire the assets into `BootScene` so they're available when `CombatScene` asks for them.

**Files:**
- Modify: `src/scenes/BootScene.ts`

No unit tests — Phaser preload happens inside the game runtime. Covered by the manual smoke test in Task 11.

- [ ] **Step 1: Add the preload calls**

In `src/scenes/BootScene.ts`, inside `preload()`, immediately after the existing `droid_slam` line (currently line 45), add:

```ts
        this.load.spritesheet('cyber_knight_idle',   'assets/cyber_knight_idle.png',   { frameWidth: 108, frameHeight: 130 });
        this.load.spritesheet('cyber_knight_attack', 'assets/cyber_knight_attack.png', { frameWidth: 160, frameHeight: 160 });
```

> If Task 1 Step 3 reported different dimensions than 868×1036 / 1280×1280, recompute `frameWidth = width / 8` and `frameHeight = height / 8` and use those exact values here.

- [ ] **Step 2: Add the animations**

In `create()`, immediately after the existing `droid-slam` animation (currently line 127), add:

```ts
        this.anims.create({
            key: 'cyber-knight-idle',
            frames: this.anims.generateFrameNumbers('cyber_knight_idle', { start: 0, end: 63 }),
            frameRate: 12,
            repeat: -1,
        });
        this.anims.create({
            key: 'cyber-knight-attack-windup',
            frames: this.anims.generateFrameNumbers('cyber_knight_attack', { start: 0, end: 39 }),
            frameRate: 20,
            repeat: 0,
        });
        this.anims.create({
            key: 'cyber-knight-attack-strike',
            frames: this.anims.generateFrameNumbers('cyber_knight_attack', { start: 40, end: 63 }),
            frameRate: 30,
            repeat: 0,
        });
```

- [ ] **Step 3: Verify the build still compiles**

Run: `npm run build`
Expected: TypeScript compilation succeeds, vite build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/BootScene.ts
git commit -m "feat(boot): preload cyber-knight sprites and animations"
```

---

## Task 8: `CombatState` accepts `EnemyDef`; data-driven HP + behaviorId

Before `CombatScene` can hand off an `enemyId` to the state, `CombatState` must accept an optional `EnemyDef` at construction and drive `enemy.maxHp`/`behaviorId` from it.

**Files:**
- Modify: `src/models/CombatState.ts`
- Create: `tests/cyber-knight-combat.test.ts`

- [ ] **Step 1: Write a failing integration test**

Create `tests/cyber-knight-combat.test.ts`:

```ts
// ABOUTME: End-to-end CombatState test driven by the cyber-knight EnemyDef.
// ABOUTME: Verifies initial Charge intent, Charge→Strike alternation, and strength-driven damage ramp.
import { describe, it, expect } from 'vitest';
import { CombatState } from '../src/models/CombatState';
import { getEnemyById } from '../src/content/enemies';

function cyberKnightState() {
  const def = getEnemyById('cyber-knight')!;
  return new CombatState(def);
}

describe('CombatState with cyber-knight EnemyDef', () => {
  it('spawns with 90 max HP and a Charging intent', () => {
    const state = cyberKnightState();
    expect(state.enemy.maxHp).toBe(90);
    expect(state.enemy.hp).toBe(90);
    expect(state.getEnemyIntentDisplay().text).toBe('⚡ Charging');
  });

  it('first Strike deals 33 damage (base 30 + strength 3 from Charge)', () => {
    const state = cyberKnightState();
    // Resolve turn 1 (Charge): enemy gains +3 strength, next action becomes Strike.
    state.executeEnemyAction();
    expect(state.enemy.strength).toBe(3);
    expect(state.nextEnemyAction.type).toBe('Attack');

    // Display intent now reflects strength.
    const intent = state.getEnemyIntentDisplay();
    expect(intent.text).toBe('⚔️ 33');
    expect(intent.color).toBe('#ff7675');

    // Resolve turn 2 (Strike): player takes 33 damage.
    const hpBefore = state.player.hp;
    state.executeEnemyAction();
    expect(hpBefore - state.player.hp).toBe(33);
  });

  it('second Strike deals 36 damage after another Charge cycle', () => {
    const state = cyberKnightState();
    state.executeEnemyAction(); // Charge 1 (strength 3)
    state.executeEnemyAction(); // Strike 1 (33 dmg)
    state.executeEnemyAction(); // Charge 2 (strength 6)

    const intent = state.getEnemyIntentDisplay();
    expect(intent.text).toBe('⚔️ 36');

    const hpBefore = state.player.hp;
    state.executeEnemyAction(); // Strike 2
    expect(hpBefore - state.player.hp).toBe(36);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- tests/cyber-knight-combat.test.ts`
Expected: TypeScript error — `CombatState` constructor does not accept an `EnemyDef` argument.

- [ ] **Step 3: Update the `CombatState` constructor**

In `src/models/CombatState.ts`, add this import near the top:

```ts
import type { EnemyDef } from '../content/enemies';
```

Replace the `CombatState` class's constructor (currently lines 27-49). After the change the constructor and the nearby `behaviorId` field should read:

```ts
    behaviorId: string = 'boss_phases';

    constructor(enemyDef?: EnemyDef) {
        this.player = new CombatEntity(true, 75, 3);

        const enemyMaxHp = enemyDef?.hp ?? 150;
        this.enemy = new CombatEntity(false, enemyMaxHp);
        this.behaviorId = enemyDef?.behaviorId ?? 'boss_phases';

        const initialCards = [
            {...STARTER_CARDS.strike, id: 's1'},
            {...STARTER_CARDS.strike, id: 's2'},
            {...STARTER_CARDS.strike, id: 's3'},
            {...STARTER_CARDS.strike, id: 's4'},
            {...STARTER_CARDS.defend, id: 'd1'},
            {...STARTER_CARDS.defend, id: 'd2'},
            {...STARTER_CARDS.defend, id: 'd3'},
            {...STARTER_CARDS.defend, id: 'd4'},
            {...STARTER_CARDS.mega, id: 'm1'},
            {...STARTER_CARDS.empower, id: 'e1'},
            {...STARTER_CARDS.shockwave, id: 'sw1'},
            {...STARTER_CARDS.flow, id: 'f1'},
        ];

        this.deck = new Deck(initialCards as Card[]);
        this.currentPhase = TurnPhase.PLAYER_START;
        this.generateNextEnemyAction();
    }
```

- [ ] **Step 4: Run the new test**

Run: `npm run test -- tests/cyber-knight-combat.test.ts`
Expected: all three tests pass.

- [ ] **Step 5: Run the full suite**

Run: `npm run test`
Expected: all tests pass, including `card-engine.test.ts` which constructs `new CombatState()` with no argument.

- [ ] **Step 6: Commit**

```bash
git add src/models/CombatState.ts tests/cyber-knight-combat.test.ts
git commit -m "feat(combat): CombatState accepts optional EnemyDef for stats + behavior"
```

---

## Task 9: `CombatScene` data-driven rendering + Charge visual

Make `CombatScene` read from the incoming `enemyId`, build the sprite from `EnemyDef.sprite`, and handle the `Charge` action with a gold tint pulse.

**Files:**
- Modify: `src/scenes/CombatScene.ts`

No unit tests — scene-layer integration is covered by Task 11's manual smoke. A small sanity test on the launch-data plumbing would require Phaser scene mocking that the project doesn't currently have.

- [ ] **Step 1: Import `getEnemyById` + `EnemyDef`**

At the top of `src/scenes/CombatScene.ts`, alongside existing imports, add:

```ts
import { getEnemyById, type EnemyDef } from '../content/enemies';
```

- [ ] **Step 2: Resolve the `EnemyDef` during `create()` and pass it to `CombatState`**

In `create()`, replace the current line:

```ts
        this.state = new CombatState();
```

with:

```ts
        const enemyDef = this.launchData.enemyId ? getEnemyById(this.launchData.enemyId) : undefined;
        this.state = new CombatState(enemyDef);
        this.enemyDef = enemyDef;
```

Add a field to the class alongside the other `!` fields near the top (after `state!: CombatState;`):

```ts
    enemyDef?: EnemyDef;
```

- [ ] **Step 3: Build the enemy sprite from `enemyDef.sprite`**

Replace the line that currently reads:

```ts
        this.enemySprite = this.add.sprite(950, 480, 'droid_idle').setOrigin(0.5, 1).setScale(6).setFlipX(true).setInteractive();
        this.enemySprite.play('droid-idle');
```

with:

```ts
        const spriteCfg = enemyDef?.sprite;
        const spriteTextureKey = spriteCfg?.textureKey ?? 'droid_idle';
        const spriteIdleAnim = spriteCfg?.idleAnimKey ?? 'droid-idle';
        const spriteScale = spriteCfg?.scale ?? 6;
        const spriteYOffset = spriteCfg?.yOffset ?? 0;

        this.enemySprite = this.add
            .sprite(950, 480 + spriteYOffset, spriteTextureKey)
            .setOrigin(0.5, 1)
            .setScale(spriteScale)
            .setFlipX(true)
            .setInteractive();
        this.enemySprite.play(spriteIdleAnim);
```

- [ ] **Step 4: Add a helper that plays an attack animation chain**

Still in `CombatScene.ts`, add this method near the other animation helpers:

```ts
    playEnemyAttackAnimation(onComplete: () => void) {
        const keys = this.enemyDef?.sprite.attackAnimKeys ?? ['droid-attack1'];
        const playNext = (i: number) => {
            if (i >= keys.length) {
                // Return to idle after the chain
                const idleKey = this.enemyDef?.sprite.idleAnimKey ?? 'droid-idle';
                this.enemySprite.play(idleKey);
                onComplete();
                return;
            }
            this.enemySprite.play(keys[i]!);
            this.enemySprite.once('animationcomplete', () => playNext(i + 1));
        };
        playNext(0);
    }
```

- [ ] **Step 5: Route attack actions through the helper; handle `Charge`**

Find the `endTurnBtn.on('pointerdown', ...)` block (currently around line 325-353). Inside it, replace the `if/else if/else` chain that branches on `action.type` with:

```ts
                    if (action.type === 'Attack' && action.slam) {
                        this.execSlamAttack(action.actualDamage, () => {
                            this.time.delayedCall(600, () => this.startPlayerTurnAnim());
                        });
                    } else if (action.type === 'Attack') {
                        if (this.enemyDef) {
                            // Data-driven chain — play the configured attack anim(s), then advance.
                            this.playEnemyAttackAnimation(() => {
                                this.time.delayedCall(600, () => this.startPlayerTurnAnim());
                            });
                            // Fire the player hurt reaction at the same moment the swing would land.
                            this.time.delayedCall(400, () => {
                                this.playerSprite.play('hero-hurt');
                            });
                        } else {
                            this.execAttacks(this.enemySprite, this.playerSprite, -1, [action.actualDamage], () => {
                                this.time.delayedCall(600, () => this.startPlayerTurnAnim());
                            });
                        }
                    } else if (action.type === 'Defend') {
                        this.animateBuff(this.enemySprite, '🛡️ +15', () => {
                            this.time.delayedCall(600, () => this.startPlayerTurnAnim());
                        });
                    } else if (action.type === 'Charge') {
                        this.tweens.add({
                            targets: this.enemySprite,
                            tint: 0xfff5a0,
                            duration: 600,
                            yoyo: true,
                            repeat: 1,
                            onComplete: () => {
                                this.enemySprite.clearTint();
                                this.time.delayedCall(300, () => this.startPlayerTurnAnim());
                            },
                        });
                    } else {
                        this.animateBuff(this.enemySprite, '💔 Vulnerable', () => {
                            this.time.delayedCall(600, () => this.startPlayerTurnAnim());
                        });
                    }
```

> The existing non-data-driven path (no `enemyDef` provided) still calls `execAttacks`, so the Hollow Gardener flow continues to work identically when the scene is entered without an `enemyId`.

- [ ] **Step 6: Verify build compiles**

Run: `npm run build`
Expected: TypeScript compilation succeeds, vite build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/scenes/CombatScene.ts
git commit -m "feat(scene): CombatScene honors enemyId; data-driven sprites + Charge visual"
```

---

## Task 10: Fixture + QA panel button

**Files:**
- Modify: `src/qa/fixtures.ts`
- Modify: `src/ui/QaDebugPanel.ts`

- [ ] **Step 1: Extend `buildFixture` to accept an `enemyIdOverride`**

In `src/qa/fixtures.ts`, replace the `buildFixture` signature and the `COMBAT` branch. The full function becomes:

```ts
export function buildFixture(phase: RunPhase, opts: { enemyIdOverride?: string } = {}): RunState {
  const base = buildFreshRun({ seed: 42, epoch: 1, blueprint: witheredGardenBlueprint });
  base.phase = phase;

  switch (phase) {
    case 'BLESSING':
    case 'MAP':
      return base;
    case 'COMBAT':
      base.currentNodeId = 'f1-l0';
      if (opts.enemyIdOverride) {
        (base as unknown as { enemyIdOverride?: string }).enemyIdOverride = opts.enemyIdOverride;
      }
      return base;
    case 'REWARD':
      base.gold = 40;
      base.playerHp = 55;
      return base;
    case 'CHEST':
      base.gold = 30;
      return base;
    case 'MERCHANT':
      base.gold = 300;
      return base;
    case 'EVENT':
      base.gold = 50;
      return base;
    case 'REST':
      base.playerHp = 40;
      return base;
    case 'BOSS_VICTORY':
      base.visitedNodeIds = base.map.startNodeIds.slice();
      return base;
    case 'DEATH':
      base.playerHp = 0;
      return base;
    case 'EPOCH_UNLOCK':
      base.enemiesDefeated = 2;
      return base;
  }
}
```

> The override is stashed on the RunState for callers that want to read it; the QA button below launches CombatScene directly with an explicit `enemyId`, so the RunState field is informational.

- [ ] **Step 2: Add the QA button**

In `src/ui/QaDebugPanel.ts`, import `buildFixture` is already present. Add one line to the `utils` array inside `buildPanel()`, right after the `['Unlock all epochs', ...]` entry:

```ts
      ['⚔ Fight Cyber Knight', () => this.fightCyberKnight()],
```

Then add the handler method at the bottom of the class (next to `unlockAllEpochs`):

```ts
  private fightCyberKnight(): void {
    this.closeActiveBodyScene();
    const fresh = buildFixture('COMBAT', { enemyIdOverride: 'cyber-knight' });
    Object.assign(this.runState, fresh);
    const game = this.scene.game;
    if (game.scene.isActive('MapScene')) game.scene.stop('MapScene');
    this.scene.time.delayedCall(0, () => {
      this.hide();
      game.scene.start('CombatScene', {
        enemyId: 'cyber-knight',
        returnTo: 'MapScene',
        runState: this.runState,
        nodeType: 'elite',
      });
    });
  }
```

- [ ] **Step 3: Verify build compiles**

Run: `npm run build`
Expected: TypeScript compilation succeeds.

- [ ] **Step 4: Run the full test suite**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/qa/fixtures.ts src/ui/QaDebugPanel.ts
git commit -m "feat(qa): add Fight Cyber Knight button"
```

---

## Task 11: Manual smoke and regression verification

Phaser rendering cannot be fully asserted by vitest. This task walks through the gameplay to confirm the feature behaves as designed and that the Hollow Gardener still behaves identically.

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open the printed `http://localhost:<port>/` URL.

- [ ] **Step 2: Open the QA panel**

Press `` ` `` (backtick). The panel should open with the existing phase-jump grid and utility grid.

- [ ] **Step 3: Trigger the Cyber Knight fight**

Click `⚔ Fight Cyber Knight`. Expected:
- Panel closes.
- CombatScene fades in with the knight sprite on the right side of the arena, scaled similarly to the existing droid, feet resting near the floor ellipse.
- Idle animation loops smoothly (sword-at-ready sway).
- Enemy HP reads `90/90`.
- Intent text reads `⚡ Charging` in gold.

- [ ] **Step 4: Play a player turn and end turn**

Play a card or two, then click End Turn. Expected:
- Banner shows `ENEMY TURN`.
- Knight sprite pulses with a gold tint twice (600ms each way).
- Sprite clears tint and returns to idle.
- Player HP is unchanged.
- Next intent reads `⚔️ 33` in red.

- [ ] **Step 5: End another turn to trigger the Strike**

End Turn. Expected:
- Knight plays the windup animation, then the strike animation end-to-end.
- Player HP drops by 33 (modulo any block the player stacked).
- Player sprite plays the hurt animation at the moment of impact.
- Sprite returns to idle.
- Next intent reads `⚡ Charging` again.

- [ ] **Step 6: Verify strength ramp**

End Turn again (Charge 2 resolves). Intent should now read `⚔️ 36`. End Turn once more; player should take 36 damage on Strike 2.

- [ ] **Step 7: Hollow Gardener regression check**

Reload the page (without clicking the QA Cyber Knight button). Navigate normally to the first combat node from the map. Expected:
- The current droid sprite renders exactly as before.
- Enemy HP starts at 150.
- Intents follow the current Hollow Gardener pattern (every 3rd turn slam, etc.).
- No visual changes vs. the pre-refactor behavior.

- [ ] **Step 8: Build check**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 9: Commit empty marker if anything was tuned**

If Steps 4-6 revealed a number that felt wrong (e.g., the base Strike damage should be 28 instead of 30), adjust the relevant behavior and recommit. Otherwise, no commit.

---

## Self-Review Summary

Coverage against spec (`2026-04-19-cyber-knight-qa-enemy-design.md`):
- §1 Goal — achieved via Tasks 1-10.
- §2 Enemy definition (id, name, hp, tier, behaviorId, sprite) — Task 6.
- §3 `cyber_knight_charge` behavior (Charge/Strike alternation, strength ramp) — Tasks 2, 5, 8 (integration).
- §4 AI dispatch refactor — Tasks 3, 4, 5.
- §5 Data-driven `EnemyDef.sprite` + CombatScene consumption — Tasks 6, 9.
- §6 BootScene preload + animations — Task 7.
- §7 Asset preprocessing — Task 1.
- §8 QA panel entry + fixture override — Task 10.
- §9 Out of scope — nothing in this plan touches map blueprints, cards, relics, potions, sound design, death animations, or the existing enemies' balance.
- §10 Testing — unit coverage in `tests/behaviors.test.ts`, `tests/charge-action.test.ts`, `tests/enemies.test.ts`, `tests/cyber-knight-combat.test.ts`; integration checklist in Task 11.
