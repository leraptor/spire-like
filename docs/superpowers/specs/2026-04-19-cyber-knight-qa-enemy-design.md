# Cyber Knight — QA-only second enemy

**Date:** 2026-04-19
**Status:** Draft
**Scope:** phaser/spire-like

## 1. Goal

Add a second enemy, **Cyber Knight**, reachable only via the existing QA debug panel (backtick to toggle). Not present in any map blueprint, random spawn, or run outcome. Doubles as the wedge that makes enemy data and rendering data-driven, since today everything routes to a single hardcoded droid.

## 2. Enemy definition

| Field | Value |
|---|---|
| id | `cyber-knight` |
| name | `Cyber Knight` |
| tier | `elite` |
| hp | `90` |
| behaviorId | `cyber_knight_charge` |
| sprite.idleKey | `cyber_knight_idle` |
| sprite.attackKey | `cyber_knight_attack` |
| sprite.scale | `1.4` |
| sprite.yOffset | `-20` |

Declared in `src/content/enemies.ts` alongside the existing roster.

## 3. Behavior: `cyber_knight_charge`

Two-turn cycle, alternating Charge and Strike. Strength accumulates across cycles, so successive Strikes escalate.

### Charge turn
- Intent displayed (from prior turn resolution): `⚡ Charging` in gold (`#fdcb6e`), no damage number.
- On resolve: `enemy.strength += 3`. No damage to player.
- Next action pre-generated: `Strike` with base `damage = 30`.
- Visual: knight stays on idle loop; a Phaser tween pulses `sprite.tint` between `0xffffff` and `0xfff5a0` (600ms, `yoyo: true`, `repeat: 1`) to signal the charge. No attack animation plays.

### Strike turn
- Intent displayed (from prior turn resolution): `⚔️ {damage}` in red (`#ff7675`), where `damage` is `calculateDamage(30, enemy)` including the accumulated strength.
- On resolve: single hit via `player.takeDamage(actualDamage)`.
- Next action pre-generated: `Charge` again.
- Visual: `cyber-knight-attack` animation plays end-to-end (windup → strike → recovery), then snaps back to idle loop.

### State tracking
Behavior needs a per-combat cycle counter. Simplest: store `turnCount` on `CombatState` (already exists, line 153) and have the behavior inspect `(turnCount % 2)` to branch. Charge is turn 1 (odd), Strike is turn 2 (even), repeat. No new state fields.

### Strength ramp
Chosen over flat damage for tension without introducing new mechanics. Expected damage curve, starting from a 0-strength player:
- Strike #1 (turn 2): `30 + 3 = 33`
- Strike #2 (turn 4): `30 + 6 = 36`
- Strike #3 (turn 6): `30 + 9 = 39`
- Etc.

Caps naturally when the fight ends. No decay. Does not affect other enemies.

## 4. Enemy AI dispatch refactor

### Problem
`CombatState.generateNextEnemyAction()` (lines 155–202) is hardcoded to the Hollow Gardener pattern. Every enemy in `ENEMIES` carries a `behaviorId` field, but it is not read anywhere. Adding a second behavior requires we start honoring that field.

### Change
- New file: `src/content/behaviors/index.ts`. Exports a registry keyed by `behaviorId`:

  ```ts
  type BehaviorCtx = { enemy: CombatEntity; player: CombatEntity; turnCount: number };
  type BehaviorFn = (ctx: BehaviorCtx) => EnemyAction;
  export const BEHAVIORS: Record<string, BehaviorFn>;
  ```

- One file per behavior: `simple_attack.ts`, `heavy_slow.ts`, `boss_phases.ts`, `cyber_knight_charge.ts`.
- `boss_phases` receives the full current logic verbatim (every-3rd-turn slam, low-HP burst, vulnerability exploitation, etc.).
- `simple_attack` and `heavy_slow` get pared-down versions — see Section 4.1.
- `generateNextEnemyAction()` in CombatState becomes a 3-line dispatcher:

  ```ts
  generateNextEnemyAction() {
    this.turnCount++;
    const behavior = BEHAVIORS[this.enemyDef.behaviorId] ?? BEHAVIORS.simple_attack;
    this.nextEnemyAction = behavior({ enemy: this.enemy, player: this.player, turnCount: this.turnCount });
  }
  ```

### 4.1 Scope-limiting on simple/heavy
These behaviors are referenced by `thorn-creep`, `fog-wisp`, `rot-golem` today, but those enemies are not yet reachable in normal play (combat is hardcoded to Hollow Gardener). To keep this change tightly scoped and avoid accidentally changing gameplay the user hasn't seen:
- `simple_attack`: returns `Attack` with `damage = 8-12` (random). No other branches.
- `heavy_slow`: alternates `Attack` (18-22) and `Defend` (+15 block).
- Neither behavior is currently exercised in a user-facing flow. If Rot Golem is later wired into a map node, its behavior can be tuned then.

`boss_phases` behavior is unchanged — Hollow Gardener plays identically.

## 5. Rendering: data-driven EnemyDef

### Problem
`CombatScene.ts:122` does `this.add.sprite(950, 480, 'droid_idle')` — sprite key hardcoded. Animation keys (`droid-attack1`, `droid-idle`, etc.) are hardcoded across CombatScene. New enemies can't plug in.

### Change
Extend `EnemyDef` with a `sprite` sub-object:

```ts
export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  tier: 'normal' | 'elite' | 'boss';
  behaviorId: string;
  sprite: {
    textureKey: string;              // spritesheet texture key for the idle sheet, used at sprite construction
    idleAnimKey: string;             // Phaser animation key for the looping idle
    attackAnimKeys: string[];        // ordered animation keys played during an Attack (e.g. [windup, strike] or [single])
    scale: number;                   // Phaser sprite.setScale value
    yOffset?: number;                // vertical adjustment from (950, 480) anchor
  };
}
```

Keeping spritesheet keys and animation keys as explicit separate fields avoids string-munging (existing code uses `droid_idle` for the sheet but `droid-idle` for the anim — underscore vs dash). A single array for attack anim keys lets the knight chain `windup → strike` while the droid plays `droid-attack1` alone.

Every existing enemy gets filled in:
- `thorn-creep`, `fog-wisp`, `rot-golem`, `hollow-gardener`: all map to `{ textureKey: 'droid_idle', idleAnimKey: 'droid-idle', attackAnimKeys: ['droid-attack1'], scale: 1.0 }`. Zero visual regression.
- `cyber-knight`: `{ textureKey: 'cyber_knight_idle', idleAnimKey: 'cyber-knight-idle', attackAnimKeys: ['cyber-knight-attack-windup', 'cyber-knight-attack-strike'], scale: 1.4, yOffset: -20 }`.

CombatScene reads `this.state.enemyDef.sprite` when building the enemy sprite (`this.add.sprite(950, 480 + (yOffset ?? 0), textureKey).setScale(scale)`) and when playing attack sequences (chain animations in order, awaiting each `animationcomplete`).

### CombatScene `init()` fix
The scene's `init({ enemyId })` param is declared but ignored. When present, `getEnemyById(enemyId)` is called to resolve the def and hydrate `CombatState`. Fallback to the existing Hollow Gardener-ish default preserves today's behavior when CombatScene is entered without an `enemyId`.

## 6. Animation setup (BootScene)

Two new spritesheets loaded after the droid loads:

```ts
this.load.spritesheet('cyber_knight_idle',
  'assets/cyber_knight_idle.png',
  { frameWidth: 108, frameHeight: 130 });

this.load.spritesheet('cyber_knight_attack',
  'assets/cyber_knight_attack.png',
  { frameWidth: 160, frameHeight: 160 });
```

Frame dimensions come from the preprocessing output (Section 7).

Animations registered in BootScene.create():

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

Windup and Strike are separate anims so the Strike turn can play both back-to-back (windup completes, strike fires on the contact frame) while the Charge turn could optionally play the windup alone as a visual tell — not required for v1.

## 7. Asset preprocessing

Source PNGs are ~10 MB each at 5120×5120 / 3472×4144. Too heavy to ship raw.

Preprocess script at `scripts/prepare-cyber-knight-sprites.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
SRC_STAND="$HOME/Downloads/A-front-facing-cel-shaded-cybernetic-knight-depict-max-px-64 (1).png"
SRC_FIGHT="$HOME/Downloads/A-front-facing-cel-shaded-cybernetic-knight-depict-max-px-64.png"
OUT="$(git rev-parse --show-toplevel)/phaser/spire-like/public/assets"
magick "$SRC_STAND" -resize 25% "$OUT/cyber_knight_idle.png"
magick "$SRC_FIGHT" -resize 25% "$OUT/cyber_knight_attack.png"
```

Outputs:
- `cyber_knight_idle.png`: 868×1036, 8×8 grid, 108×130 per frame, ~500 KB.
- `cyber_knight_attack.png`: 1280×1280, 8×8 grid, 160×160 per frame, ~700 KB.

Committed preprocessed PNGs to `public/assets/`. Script committed so re-runs are trivial when Sami sends updated sheets. Source PNGs stay in `~/Downloads/` and are not committed.

## 8. QA panel entry

Add one button to `src/ui/QaDebugPanel.ts` utility section:

```
[ ⚔ Fight Cyber Knight ]
```

Placement: new row below the existing 3×3 utilities grid, full-width brown/gold styling matching current panel conventions.

Handler:
1. Build a `RunState` at `COMBAT` phase (reuse existing `buildFixture('COMBAT')`).
2. Override the current combat node's `enemyId` to `'cyber-knight'`.
3. `scene.start('CombatScene', { enemyId: 'cyber-knight', returnTo: 'MapScene', runState })`.

Minor adjustment to `src/qa/fixtures.ts`: accept an optional `enemyIdOverride` param on the `COMBAT` fixture builder so the new button can reuse it cleanly. Default behavior (no override) unchanged.

## 9. Explicitly out of scope

- Not added to any map blueprint, seed, or route
- No new card, relic, potion, status effect, or player mechanic
- No new sound effects — reuse existing enemy-hit and slash cues as-is
- No out-of-combat "stand mode" context yet (standing sheet IS the in-combat idle; no map portrait, no lobby appearance)
- No death animation for the knight — reuses existing enemy fade-out
- No balance pass on existing enemies — `simple_attack` and `heavy_slow` get minimum viable logic to support future reuse, but none of them are reachable yet
- No difficulty scaling / seed scaling for the knight — same stats every time the QA button is pressed

## 10. Testing

### Unit
- `behaviors/cyber_knight_charge.test.ts`
  - Given `turnCount: 1`, returns Charge (no damage, sets up Strike at 30 base).
  - Given `turnCount: 2` with `enemy.strength: 3`, returns Strike of 30 (calculateDamage applies the +3 at resolve time).
  - Given `turnCount: 3`, returns Charge again.
- `behaviors/boss_phases.test.ts`
  - Parity: same turns with same RNG seed as current hardcoded logic produce the same actions. Ensures the refactor doesn't change Hollow Gardener behavior.
- `enemies.test.ts`
  - Every `EnemyDef` in `ENEMIES` has a populated `sprite` object with non-empty `idleKey` and `attackKey`.

### Integration (manual)
1. `npm run dev`, load app in browser.
2. Press `` ` `` — QA panel opens.
3. Click `⚔ Fight Cyber Knight` — routes into CombatScene.
4. Verify: knight sprite visible at ~220 px tall, roughly centered on the enemy position, idle animation looping smoothly.
5. Verify: first-turn intent reads `⚡ Charging` in gold.
6. End player turn — knight resolves Charge (no HP loss), next intent shows `⚔️ 30` (or calculateDamage-adjusted value in red).
7. End player turn — knight plays attack animation end-to-end, player takes ~30 damage, next intent is `⚡ Charging` again.
8. Repeat 6–7 once more — verify damage scales up (33, then 36, etc.).
9. Kill the knight (debug via Full Heal + damage cards) — verify existing death fade plays.
10. Verify: Hollow Gardener fight (via existing route) still plays identically (regression check).

## 11. Files touched

New:
- `src/content/behaviors/index.ts`
- `src/content/behaviors/simple_attack.ts`
- `src/content/behaviors/heavy_slow.ts`
- `src/content/behaviors/boss_phases.ts`
- `src/content/behaviors/cyber_knight_charge.ts`
- `src/content/behaviors/cyber_knight_charge.test.ts`
- `src/content/behaviors/boss_phases.test.ts`
- `scripts/prepare-cyber-knight-sprites.sh`
- `public/assets/cyber_knight_idle.png`
- `public/assets/cyber_knight_attack.png`

Modified:
- `src/content/enemies.ts` — extend `EnemyDef.sprite`, add cyber-knight entry, fill sprite fields for existing enemies
- `src/models/CombatState.ts` — replace `generateNextEnemyAction` body with registry dispatch; honor `enemyDef` on construction
- `src/scenes/BootScene.ts` — preload two spritesheets, register three animations
- `src/scenes/CombatScene.ts` — honor `enemyId` init param; data-driven sprite build + attack anim keys
- `src/ui/QaDebugPanel.ts` — add "Fight Cyber Knight" button
- `src/qa/fixtures.ts` — optional `enemyIdOverride` on COMBAT fixture

Roughly 10 new small files plus 6 focused edits. No large-scale refactor.
