# Run Foundation — Design Specification

## Overview

This spec designs the **run foundation** for Tower of Mirrors — a fully featured first-run loop. Starting from a run-start blessing screen, through every node type on the Region 1 map, through real combat with a potion system, through post-fight rewards, through chest/merchant/event/rest screens, through boss victory or death, and into a session-only epoch unlock.

The goal is **"fully featured first run"**: every screen and every system works end-to-end in-memory for one session. Content is intentionally skeletal (3 potions, 3 relics, 7 blessings, 5 events, 1 elite enemy, 3 exotic cards) so design and tuning can iterate on a stable structure.

**Critical architectural constraint:** game logic and presentation must be cleanly separated. All mutations go through pure transition functions. Presentation modals never mutate run state directly — they return typed `RunOutcome[]` objects that a coordinator applies. This lets visual design and game logic be worked on independently.

### Goals

1. Build `RunState` as the central run-level model, absorbing the current thin `RunProgress`.
2. Make every screen in the run walkable end-to-end: blessing → map → combat → reward → chest/merchant/event/rest → boss → death/victory → epoch unlock.
3. Introduce the potion system (3 slots, HUD bar, combat + map usage).
4. Introduce exotic card mechanics (Ethereal, Unplayable/curse, self-damage).
5. Introduce an elite node with harder enemy and guaranteed relic reward.
6. Build a session-only epoch unlock system so run 2 in the same browser session plays under harder rules.
7. Build a QA debug panel that lets the designer jump directly to any screen with a pre-canned fixture state.

### Non-Goals (v1)

- Firestore save/resume persistence
- Cross-session epoch unlocks (runs are fresh on page reload)
- Title screen, World Map (between-runs screen), Between-Runs Shop
- Seed Cards / longevity-app integration
- Full Region 1 content (12+ enemies, 10+ events, full relic roster) — skeletal pools only
- Rest Site's "Upgrade a card" option (Rest supports heal only for now)
- Music or SFX for new screens
- Keyboard shortcuts beyond backtick for QA

---

## Architecture

### Separation of concerns

Three layers, enforced by directory:

| Layer | Location | Phaser imports? |
|---|---|---|
| **Game logic (pure)** | `src/models/`, `src/run/`, `src/content/` | No |
| **Presentation (Phaser)** | `src/scenes/`, `src/ui/` | Yes |
| **Glue (coordinator)** | `src/scenes/MapScene.ts` | Yes |

All game state lives in `RunState`. All mutations happen via functions in `src/run/transitions.ts` (pure, tested in isolation). Presentation modals receive a reference to `runState` for reading, but **never mutate it directly** — they emit `RunOutcome[]` via their `onResolve` callback. The coordinator (`MapScene`) maps each outcome to a transition.

This means: swapping a modal's visuals, tuning a potion's heal amount, or adding a new event only requires touching one of the three layers at a time.

### The coordinator pattern

`MapScene` owns `runState` for the life of a run. It subscribes to `runState.onStateChanged`. When `runState.phase` changes, `MapScene` opens the matching modal or triggers the combat scene swap. Modals are short-lived presentation components — they render, collect a choice, call `onResolve(outcomes)`, and destroy themselves.

```
MapScene (coordinator, owns runState)
  │
  ├─ phase = MAP            → show map, accept node taps
  ├─ phase = COMBAT         → scene.start('CombatScene', { runState, enemyId })
  ├─ phase = REWARD         → new RewardModal(this, runState, onResolve)
  ├─ phase = CHEST          → new ChestModal(...)
  ├─ phase = MERCHANT       → new MerchantModal(...)
  ├─ phase = EVENT          → new EventModal(...)
  ├─ phase = REST           → new RestModal(...)
  ├─ phase = BOSS_VICTORY   → new BossVictoryModal(...)
  ├─ phase = DEATH          → new DeathModal(...)
  └─ phase = EPOCH_UNLOCK   → new EpochUnlockModal(...)
```

Only combat is a true scene swap; all other screens are overlays on the paused map.

---

## Data Model

### RunState

```ts
// src/models/RunState.ts

export type RunPhase =
  | 'BLESSING'
  | 'MAP'
  | 'COMBAT'
  | 'REWARD'
  | 'CHEST'
  | 'MERCHANT'
  | 'EVENT'
  | 'REST'
  | 'BOSS_VICTORY'
  | 'DEATH'
  | 'EPOCH_UNLOCK';

export interface RunState {
  // Identity
  regionId: string;
  runId: string;
  currentEpoch: number;          // 1 on fresh session, can rise within session

  // Map
  map: RegionMap;
  currentNodeId: string | null;
  visitedNodeIds: string[];

  // Player state
  playerHp: number;
  playerMaxHp: number;
  gold: number;
  baseEnergy: number;            // energy-per-turn; blessings/relics can increase
  bonusCardsPerTurn: number;     // blessing-driven draw boost, default 0

  // Inventory
  deck: Card[];
  upgradedCardIds: Set<string>;
  relics: Relic[];
  potions: (Potion | null)[];    // length = potionSlots
  potionSlots: number;           // 3 default, 4 in epoch 2+

  // Phase machine
  phase: RunPhase;

  // Run metrics (for epoch unlocks and run summary)
  enemiesDefeated: number;

  // Reactivity
  onStateChanged?: (state: RunState) => void;
}
```

### RunOutcome (the uniform reward contract)

Every modal emits an array of these. The coordinator dispatches each to a transition.

```ts
// src/models/RunOutcome.ts

export type RunOutcome =
  | { kind: 'gold';         amount: number }
  | { kind: 'heal';         amount: number }
  | { kind: 'damage';       amount: number }     // self-damage (curses, bargains)
  | { kind: 'maxHp';        amount: number }     // permanent max HP change
  | { kind: 'add_card';     card: Card }
  | { kind: 'remove_card';  cardId: string }
  | { kind: 'upgrade_card'; cardId: string }
  | { kind: 'add_relic';    relic: Relic }
  | { kind: 'add_potion';   potion: Potion }
  | { kind: 'enter_combat'; enemyId: string; returnPhase: RunPhase }
  | { kind: 'energy';       amount: number }     // permanent +energy per turn
  | { kind: 'draw_bonus';   amount: number }     // permanent +cards drawn per turn
  | { kind: 'none' };
```

### Potion and Relic

```ts
// src/models/Potion.ts
export interface Potion {
  id: string;
  name: string;
  description: string;
  usableInMap: boolean;
  usableInCombat: boolean;
  targets: 'none' | 'enemy' | 'self';
  effect: PotionEffect;
}

export type PotionEffect =
  | { kind: 'heal';       amount: number }
  | { kind: 'energy';     amount: number }                         // this-turn only
  | { kind: 'vulnerable'; stacks: number }                         // target enemy
  | { kind: 'add_card';   card: Card };                            // permanent

// src/models/Relic.ts
export interface Relic {
  id: string;
  name: string;
  description: string;
  trigger: 'turn_start' | 'combat_start' | 'first_turn' | 'passive';
  effect: RelicEffect;
}

export type RelicEffect =
  | { kind: 'gain_block'; amount: number }
  | { kind: 'gain_energy_first_turn'; amount: number }
  | { kind: 'shop_discount'; pct: number };
```

### Card engine extensions

Add two flags to the existing `Card` type and two fields to `CardEffect`:

```ts
export interface Card {
  // existing fields...
  ethereal?: boolean;    // at end of turn, exhausts if still in hand
  unplayable?: boolean;  // cannot be played; triggers onTurnEndSelf if any
}

export interface CardEffect {
  // existing fields...
  selfDamage?: number;     // damage to player on play
  onTurnEndSelf?: number;  // damage to player at turn end if in hand
}
```

### Pure transitions

All in `src/run/transitions.ts`. Each mutates `state` in place and fires `state.onStateChanged?.(state)`.

```ts
gainGold(state, amount)
spendGold(state, amount): boolean             // false if insufficient
takeDamage(state, amount)                     // clamps to 0; sets phase=DEATH if hp=0
heal(state, amount)                           // clamps to maxHp
gainMaxHp(state, amount)                      // also heals by same amount
addCardToDeck(state, card)
removeCardFromDeck(state, cardId)
upgradeCard(state, cardId)
addRelic(state, relic)
addPotion(state, potion): boolean             // false if all slots full
usePotion(state, slotIndex, target?)          // empties slot, applies effect
gainEnergy(state, amount)                     // permanent baseEnergy +=
gainDrawBonus(state, amount)
recordEnemyDefeated(state)
setPhase(state, phase)
setCurrentNode(state, nodeId)
```

### applyOutcomes

Single dispatch that maps outcome → transition:

```ts
// src/run/applyOutcomes.ts
export function applyOutcomes(state: RunState, outcomes: RunOutcome[]): void {
  for (const o of outcomes) {
    switch (o.kind) {
      case 'gold':         gainGold(state, o.amount); break;
      case 'heal':         heal(state, o.amount); break;
      case 'damage':       takeDamage(state, o.amount); break;
      case 'maxHp':        gainMaxHp(state, o.amount); break;
      case 'add_card':     addCardToDeck(state, o.card); break;
      case 'remove_card':  removeCardFromDeck(state, o.cardId); break;
      case 'upgrade_card': upgradeCard(state, o.cardId); break;
      case 'add_relic':    addRelic(state, o.relic); break;
      case 'add_potion':   addPotion(state, o.potion); break;
      case 'enter_combat': setPhase(state, 'COMBAT'); /* coordinator picks up */ break;
      case 'energy':       gainEnergy(state, o.amount); break;
      case 'draw_bonus':   gainDrawBonus(state, o.amount); break;
      case 'none':         break;
    }
  }
}
```

---

## Scene & Screen Graph

```
BootScene
  preload assets + build fresh RunState (via buildFreshRun) + scene.start('BlessingScene')

BlessingScene
  render 3 blessings (randomly drawn from pool of 7)
  on choice → apply outcomes + scene.start('MapScene', { runState })

MapScene (coordinator)
  owns runState. listens onStateChanged.
  phase dispatch as described above.
  on modal resolution: applyOutcomes(runState, outcomes); setPhase(runState, next).

CombatScene
  accepts runState reference + enemyId. Builds CombatState from runState.
  Renders HUD potion bar (reads runState.potions).
  Potion click during combat → usePotion → effect applied to CombatState.
  On end: update runState.playerHp, enemiesDefeated++; setPhase(REWARD / BOSS_VICTORY / DEATH).
  scene.start('MapScene', { runState }).

QA Debug Panel (overlay in MapScene at depth 10000, backtick key toggles)
  jump buttons for every phase → runState replaced with buildFixture(phase)
  utility buttons: +500g, add relic, fill potions, full heal, kill player, reset run
```

### Modal contract

Every modal follows the same signature:

```ts
class <ModalName> extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    runState: Readonly<RunState>,
    onResolve: (outcomes: RunOutcome[]) => void,
  ) { ... }
}
```

- The modal reads from `runState` to render (e.g., current gold).
- The modal never calls transitions.
- The modal always ends by calling `onResolve(outcomes)` — possibly `[{ kind: 'none' }]` for "skip / leave."
- The coordinator is the only code path that calls transitions or advances phase.

This is the seam that enforces separation.

---

## Content Tables

All in `src/content/*.ts` as exported `const` arrays.

### Potions (3)

| Id | Name | Effect | Usable |
|---|---|---|---|
| `potion_heal` | Heal Draft | Restore 25 HP | map + combat |
| `potion_power` | Power Elixir | +1 energy this turn | combat only |
| `potion_vulnerable` | Vulnerable Vial | Apply Vulnerable(3) to target | combat only |

### Relics (3)

| Id | Name | Trigger | Effect |
|---|---|---|---|
| `relic_bronze_scales` | Bronze Scales | turn_start | gain 4 block |
| `relic_anchor` | Anchor | combat_start | gain 10 block |
| `relic_lantern` | Lantern | first_turn | +1 energy |

### Blessings (7 in pool, 3 shown per run start)

| Id | Effect |
|---|---|
| `bless_rare_card` | Add 1 random rare card to deck |
| `bless_relic` | Gain 1 random relic |
| `bless_vitality` | +10 max HP and heal 10 |
| `bless_wealth` | +75 starting gold |
| `bless_potions` | Start with 2 random potions |
| `bless_power` | Permanent +1 energy per turn |
| `bless_knowledge` | Permanent +1 card draw per turn |

### Events (5, Region 1)

Each event is a narrative screen with 2–3 choices. Each choice emits `RunOutcome[]`.

| Id | Name | Choices |
|---|---|---|
| `event_forked_path` | The Forked Path | (A) thorny path → `enter_combat` with thorn-creep, reward on win. (B) clear → `none` |
| `event_shrine_of_mist` | Shrine of Mist | (A) `damage: 10` + `gold: 50`. (B) `none` |
| `event_gem_hoard` | Gem Hoard | (A) `gold: 30`. (B) `add_relic` random uncommon |
| `event_cursed_altar` | Cursed Altar | (A) `gold: 75` + `add_card` Doubt curse. (B) `none` |
| `event_merchants_apprentice` | Merchant's Apprentice | (A) `add_card` — opens CardPickerModal with 3 uncommons. (B) `none` |

### Elite enemy

`enemy_rot_golem` — 80 HP, hits 12–14, every 3rd turn uses "Decay" (8 dmg + Weak). Drops a guaranteed relic.

### Exotic cards (3)

| Id | Name | Cost | Effect | Flags |
|---|---|---|---|---|
| `card_wild_strike` | Wild Strike | 1 | deal 12 damage | Ethereal |
| `card_self_flagellation` | Self-Flagellation | 0 | draw 2, selfDamage 4 | — |
| `card_curse_doubt` | Doubt | — | unplayable, onTurnEndSelf 2 | Unplayable |

### Merchant inventory (per visit, random within these slots)

- 3 cards: 1 common 50g, 1 uncommon 75g, 1 rare 100g (from Region 1 pool)
- 2 relics: 1 common 100g, 1 uncommon 150g
- 2 potions: 15g each
- Card removal: 50g base, +25g per subsequent removal within this run (resets on new run)

### Chest contents (3-option reward)

- `gold: 25` option
- `add_relic` option (60% common / 30% uncommon / 10% rare)
- `add_card` option (CardPickerModal with 3 uncommon-weighted cards)

### Post-fight reward (normal combat)

- Always: `gold: 10–20 random`
- Always: `add_card` via CardPickerModal (1 of 3)
- Sometimes (40%): `add_potion` random

If the potion roll fails, only 2 options are shown (not a fallback).

### Elite fight reward

- `gold: 25–40 random`
- `add_relic` guaranteed (from Region 1 pool)
- `add_card` via CardPickerModal
- Optional: `add_potion` at 60%

### Epoch

| Epoch | Unlock | Modifier | New capacity |
|---|---|---|---|
| 1 | default | base rules | — |
| 2 | defeat 2 enemies in a run | enemies +15% HP | potion slots = 4 |

Session-only: unlock persists in memory until page reload.

---

## QA Debug Panel

Backtick (`` ` ``) toggles an overlay at depth 10000. Two sections:

**Jump to phase** — one button per `RunPhase` value. Clicking calls:

```ts
const fixture = buildFixture(phase);
Object.assign(runState, fixture);
setPhase(runState, phase);
```

`buildFixture(phase)` in `src/qa/fixtures.ts` is a switch that returns a fully-formed RunState appropriate for testing that phase (e.g., for MERCHANT: 500 gold, full deck, fresh shop inventory). One place to tune as the designer iterates each screen.

**Utility buttons:**
- `+500 gold`
- `Add random relic`
- `Fill all potion slots`
- `Full heal`
- `Kill player → DEATH`
- `Reset to fresh run`

Gated at `import.meta.env.DEV` for future prod builds; always on in dev.

---

## File Layout

### New files

```
src/
  models/
    RunState.ts              # RunState, RunPhase, Potion, Relic types
    RunOutcome.ts            # outcome union
  run/
    transitions.ts
    applyOutcomes.ts
    buildFreshRun.ts         # fresh RunState factory (takes seed, epoch, blessing result)
    rng.ts                   # run-local seeded RNG (separate from map RNG stream)
  content/
    potions.ts
    relics.ts
    blessings.ts
    events.ts
    enemies.ts
    cards.ts                 # Region 1 pool + exotic cards
    epochs.ts
  scenes/
    BlessingScene.ts
  ui/
    modals/
      RewardModal.ts
      ChestModal.ts
      MerchantModal.ts
      EventModal.ts
      BossVictoryModal.ts
      DeathModal.ts
      EpochUnlockModal.ts
      CardPickerModal.ts     # reusable "pick 1 of 3 cards" submodal
    QaDebugPanel.ts
  qa/
    fixtures.ts              # buildFixture(phase): RunState
tests/
  run-transitions.test.ts
  apply-outcomes.test.ts
  buildFreshRun.test.ts
  events.test.ts
  epoch-unlock.test.ts
```

### Modified files

- `src/models/Card.ts` — add `ethereal?`, `unplayable?`, `effect.selfDamage?`, `effect.onTurnEndSelf?`
- `src/models/RegionMap.ts` — add `'chest'` to `NodeType` union (bringing the total to 7)
- `src/models/RegionBlueprint.ts` — no schema change; `allowedTypes` per floor rule will gain `'chest'` as a valid entry
- `src/map/blueprints.ts` — Withered Garden blueprint updated so floor 3 can place a chest node (add `'chest'` to the allowed types on floor 3)
- `src/map/generator.ts` — no generator change needed; it already dispatches on type
- `src/map/validator.ts` — no rule change needed; the new type is just another valid category
- `src/fixtures/maps/tutorial-map.ts` — add one chest node so the tutorial map exercises all 7 types
- `src/models/RunProgress.ts` — **delete**. Absorbed into RunState.
- `src/scenes/BootScene.ts` — route to BlessingScene, not MapScene
- `src/scenes/MapScene.ts` — coordinator role (own runState, phase dispatch, real modals replace placeholders)
- `src/scenes/CombatScene.ts` — accept runState reference; potion bar hooks; end-of-turn Ethereal/Unplayable engine; selfDamage handling; push results back to runState
- `src/ui/MapHud.ts` — add potion bar (3–4 slots) with click-to-use, live gold display, current epoch indicator
- `src/ui/PlaceholderModal.ts` — delete after modals replace its callers

---

## Testing

### Unit tests (Vitest)

- `run-transitions.test.ts` — each transition in isolation (gainGold, spendGold, takeDamage clamping, addPotion when full, usePotion effects, etc.).
- `apply-outcomes.test.ts` — each `RunOutcome` kind dispatches to the right transition with correct args.
- `buildFreshRun.test.ts` — fresh run has expected shape (HP = 75, gold = 0 unless bless_wealth applied, 3 empty potion slots, starting deck is 10 cards, currentEpoch preserved across session).
- `events.test.ts` — each of the 5 events' choices produces the expected outcomes.
- `epoch-unlock.test.ts` — after `recordEnemyDefeated` called twice, epoch 2 unlock is reported on run end; fresh run thereafter uses epoch 2 rules.

Target: ~20 new tests. All 27 existing tests must still pass.

### Manual smoke

QA panel makes this fast. Click through every phase, confirm each modal opens, renders reasonable fixture state, and closes cleanly back to MAP.

### Playwright e2e

Extend existing `tests/e2e/map-smoke.test.ts`: load page → wait for BlessingScene → click first blessing → wait for MapScene → open QA panel → click REWARD → confirm modal visible. Catches scene-graph regressions.

---

## Ship List — v1

- [ ] `RunState`, `RunPhase`, `RunOutcome`, `Potion`, `Relic` types
- [ ] Transitions module (all ~15 functions, tested)
- [ ] `applyOutcomes` dispatcher (tested)
- [ ] `buildFreshRun(seed, epoch, blessingOutcomes)`
- [ ] Content tables: potions, relics, blessings, events, enemies, cards, epochs
- [ ] Card engine: Ethereal, Unplayable, selfDamage, onTurnEndSelf (tested via CombatState)
- [ ] `BlessingScene` with 7-pool / 3-choice
- [ ] `MapScene` refactored as coordinator; owns runState; phase dispatch
- [ ] `CardPickerModal` reusable "pick 1 of 3 cards"
- [ ] `RewardModal` (gold / card / maybe-potion)
- [ ] `ChestModal` (3 options: gold / relic / card)
- [ ] `MerchantModal` (cards / relics / potions / card removal)
- [ ] `EventModal` with 5 Region-1 events (tested outcomes)
- [ ] `RestModal` re-wired to `RunOutcome[]`
- [ ] `BossVictoryModal`, `DeathModal`, `EpochUnlockModal`
- [ ] Elite fight: rot_golem enemy + guaranteed relic reward flow
- [ ] Potion bar on `MapHud` (click-to-use in map), potion bar in combat (click-to-use), potion effects applied
- [ ] Epoch 2 unlock: triggers on 2 kills; toast on run end; next run has +15% enemy HP + 4 potion slots
- [ ] QA Debug Panel: backtick toggles; all phases + utility buttons; fixture states wired
- [ ] Node-action dispatch in MapScene covers all 7 node types with real modals (no placeholders remain)
- [ ] All 27 existing unit tests still pass
- [ ] ~20 new unit tests pass
- [ ] Playwright smoke test extended and passes
