# Mission brief — Region Map visual polish

You are a senior frontend/game engineer working on a Phaser 4 + TypeScript roguelike card game (Slay-the-Spire-like). Your job is to elevate the visual design of the **Region Map** screen and generate any art assets you need using the Nano Banana image-generation tool available in your environment.

## Repo

Work exclusively inside `/Users/samibenhassine/antigravity/game/phaser/spire-like/` on branch `feature/region-map`. Do NOT touch other directories under `/Users/samibenhassine/antigravity/game/`.

Start by reading these in order:

1. `docs/superpowers/specs/2026-04-17-region-map-design.md` — full design spec (visual direction, layout, node types, scroll behavior).
2. `docs/superpowers/plans/2026-04-17-region-map.md` — implementation plan (already executed; read for context).
3. `src/scenes/MapScene.ts` — the Phaser scene that composes everything.
4. `src/ui/NodeView.ts`, `src/ui/PathRenderer.ts`, `src/ui/AvatarWalker.ts`, `src/ui/MapHud.ts`, `src/ui/RestModal.ts`, `src/ui/PlaceholderModal.ts` — the widgets.
5. `src/scenes/BootScene.ts` — preloads all texture/audio assets.

## Scope — what you CAN modify

- `src/scenes/MapScene.ts` — layout constants, layer composition, parchment background, camera behavior, ambient effects.
- `src/ui/*.ts` — all widgets. Replace primitive `Graphics` draws with real sprite-based rendering. Re-tune colors, radii, typography.
- `src/scenes/BootScene.ts` — add `this.load.image(...)` calls for any new assets you generate.
- `public/assets/` — drop new PNG/WebP assets here (keep pre-existing files alone unless the plan says otherwise).
- `index.html` — only if you need to add a font or meta tag.

## Scope — what you MUST NOT modify

- `src/models/**` — pure data types; do not edit.
- `src/map/**` — pure map logic (generator, validator, analyzer, rng, blueprints); do not edit.
- `src/fixtures/**` — fixture data; do not edit.
- `tests/**` — unit tests and e2e smoke. If you break them, fix your code, don't edit the test.
- `src/scenes/CombatScene.ts` — combat is out of scope for this pass.
- `src/ui/HealthBar.ts`, `src/ui/CardView.ts` — combat widgets; out of scope.

## Visual direction (from the spec)

- **Ghibli-inspired painted parchment.** Warm, painterly, magical-realism. Think Spirited Away / Howl's Moving Castle. Not pixel-art-themed, not dark fantasy.
- **Portrait column centered in the landscape 1280×720 frame.** Column x-range 360..920 (width 560). Parchment strips fill the sides, fixed to camera.
- **Scrollable vertical map**, ~1440px tall world, 5 floors stacked bottom-up.
- **Hybrid node hierarchy:**
  - **Illustrated objects** for bosses, elites, shops — unique painted sprites on floating platforms (think a gramophone on a blue water-disc, a thorny crown on a petal, a merchant lantern).
  - **Ink medallions** for combat, event, rest — parchment discs with hand-inked glyphs (crossed swords, question mark, campfire).
- **Ink-drawn paths** between nodes — cubic Bézier, hand-jittered, not geometric. Gold when completed; ink-black when available; faded when future.
- **Avatar** currently reuses `hero_idle` spritesheet at 0.7× scale. You MAY generate a new Ghibli-style avatar sprite or silhouette if it improves the aesthetic.

## Art generation (Nano Banana)

You have access to Nano Banana image generation. Existing art lives in `/Users/samibenhassine/antigravity/game/nanobanana-output/` and processed variants in `/Users/samibenhassine/antigravity/game/nanobanana-output/processed/`. There is a helper at `/Users/samibenhassine/antigravity/game/tools/process_nanobanana_assets.py` for post-processing (trim, alpha-matte, resize).

**Workflow:**

1. Use Nano Banana to generate the asset you need (platforms, illustrated objects, parchment textures, decorative flourishes, avatar). Prompts should specify:
   - Transparent background.
   - Ghibli painted style, soft watercolor, warm parchment palette.
   - Specific size hint (e.g., "render centered in a 512×512 frame, subject fills the inner 380px").
2. Save the raw output to `/Users/samibenhassine/antigravity/game/nanobanana-output/` (or a subfolder if grouping).
3. Post-process with the helper script to strip backgrounds / center / resize. Target dimensions:
   - Illustrated node sprites: 96×96 (2× for crisp rendering = 192×192 source).
   - Medallion parchment discs: 72×72 (144×144 source).
   - Boss/elite platforms: 128×128 (256×256 source).
   - Parchment background tile (if used): 512×512, seamlessly tileable.
   - Decorative flourishes (grass tufts, ink swirls): 64×64 (128×128 source).
4. Copy final PNGs into `/Users/samibenhassine/antigravity/game/phaser/spire-like/public/assets/map/` (create the dir if missing — keep map assets grouped).
5. Preload each new image in `BootScene.ts` using `this.load.image('key', 'assets/map/filename.png')`.
6. Reference by key in `NodeView.ts` / `MapScene.ts` (e.g., `scene.add.image(0, 0, 'node_elite_rotgolem')`).

## Conventions (enforced)

- **Every new `.ts` file starts with two lines:**
  ```ts
  // ABOUTME: <what this file does, one line>
  // ABOUTME: <scope or dependency note, one line>
  ```
- **TypeScript strict mode.** The project uses `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Array index access returns `T | undefined` — handle with `!` after a length check or an explicit guard. `Record<K, V>` index access is also `V | undefined`.
- **No `any`.** Use concrete types or discriminated unions.
- **Don't rename public method names** that other files depend on — specifically `NodeView.setNodeState(state)`, `PathRenderer.setState(edge, state)`, `AvatarWalker.walkTo(from, to, cb)`, `MapHud.update(data)`, `RestModal` / `PlaceholderModal` constructor signatures. They are consumed by `MapScene`.

## Verification (required before you declare done)

1. `npm run build` — must exit 0. No TypeScript errors.
2. `npm test` — all 27 unit tests must still pass. Do not touch tests to make them pass.
3. `npm run dev` — open http://localhost:3001/ (and also http://localhost:3001/?map=tutorial). Visually confirm:
   - Map renders with parchment column, nodes, paths, avatar, HUD.
   - Tapping a glowing floor-1 node walks the avatar and launches CombatScene.
   - Scrolling works (wheel + touch-drag). Camera auto-pans on selection.
   - Tutorial fixture also renders identically.
4. Take a screenshot of the map (headed or headless puppeteer is fine) and save as `docs/screenshots/map-v2.png` for posterity.

## Commit discipline

- Commit frequently, one concern per commit. Example messages:
  - `feat(map): illustrated boss platform asset`
  - `feat(map): Ghibli parchment background tile`
  - `style(map): re-tune medallion palette and shadow`
  - `feat(map): avatar sprite replacement`
- Stage only files you changed. Do NOT run `git add -A` — several artifact files in the repo are untracked and should stay that way.
- Do NOT modify `main` branch or any branch other than `feature/region-map`.

## Deliverable

When complete, write a short summary to `docs/map-polish-summary.md`:
- What you changed visually.
- Assets generated (with filenames and rough prompts used).
- Any decisions you made where the spec was silent.
- Any known limitations or follow-ups.

## When to stop and ask instead of guessing

- If the spec conflicts with itself. (Ask; don't invent.)
- If generating an asset would require > 10 attempts to get right. (Ask; maybe the style target is wrong.)
- If a visual change would require modifying `src/models/` or `src/map/`. (Ask; that's out of scope for this brief.)
- If you find a correctness bug in logic (generator, validator, etc.). (Note it in your summary; do not fix it.)

## Anti-goals

- Do NOT rewrite architecture.
- Do NOT introduce new dependencies without explicit justification.
- Do NOT change the portrait-column layout to landscape.
- Do NOT replace the existing combat scene's art.
- Do NOT add features beyond visual polish + asset generation.

Go.
