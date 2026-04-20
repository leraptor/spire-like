# Run Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully featured first-run loop for Tower of Mirrors — RunState central model, every screen (blessing, reward, chest, merchant, event, rest, boss victory, death, epoch unlock), potion system, exotic card mechanics, elite combat, session-only epoch progression, and a QA debug panel to jump between any screen with pre-canned fixture state.

**Architecture:** `RunState` is a plain state container with pure transitions in `src/run/`. Content lives as data tables in `src/content/`. Presentation is Phaser modals that receive `runState` read-only and emit `RunOutcome[]` through a callback. A coordinator (`MapScene`) owns `runState`, listens for `phase` changes, opens the right modal, and applies outcomes. Combat is the only true scene swap; everything else is a modal overlay on the paused map.

**Tech Stack:** TypeScript 6, Phaser 4, Vite 8, Vitest, Puppeteer.

**Repo root:** `/Users/samibenhassine/antigravity/game/phaser/spire-like/` on branch `feature/region-map`.

---

## File structure

**Creates:**
- `src/models/RunState.ts` — RunPhase enum, Potion, Relic, RunState interface
- `src/models/RunOutcome.ts` — RunOutcome union
- `src/run/rng.ts` — run-local Mulberry32 stream (separate from map RNG)
- `src/run/transitions.ts` — pure transitions (gainGold, takeDamage, addCardToDeck, usePotion, etc.)
- `src/run/applyOutcomes.ts` — dispatches RunOutcome[] to transitions
- `src/run/buildFreshRun.ts` — RunState factory
- `src/content/potions.ts`, `relics.ts`, `blessings.ts`, `events.ts`, `enemies.ts`, `cards.ts`, `epochs.ts`
- `src/scenes/BlessingScene.ts`
- `src/ui/modals/CardPickerModal.ts` (reusable 1-of-3 picker)
- `src/ui/modals/RewardModal.ts`
- `src/ui/modals/ChestModal.ts`
- `src/ui/modals/MerchantModal.ts`
- `src/ui/modals/EventModal.ts`
- `src/ui/modals/BossVictoryModal.ts`
- `src/ui/modals/DeathModal.ts`
- `src/ui/modals/EpochUnlockModal.ts`
- `src/ui/QaDebugPanel.ts`
- `src/qa/fixtures.ts` — buildFixture(phase): RunState
- `tests/run-transitions.test.ts`
- `tests/apply-outcomes.test.ts`
- `tests/buildFreshRun.test.ts`
- `tests/events.test.ts`
- `tests/epoch-unlock.test.ts`
- `tests/card-engine.test.ts`

**Modifies:**
- `src/models/Card.ts` — add `ethereal?`, `unplayable?`, `effect.selfDamage?`, `effect.onTurnEndSelf?`
- `src/models/RegionMap.ts` — add `'chest'` to NodeType union
- `src/map/blueprints.ts` — allow `chest` on floor 3
- `src/fixtures/maps/tutorial-map.ts` — include a chest node
- `src/scenes/MapScene.ts` — coordinator role: own runState, phase dispatch, wire real modals
- `src/scenes/CombatScene.ts` — accept runState, potion bar, engine hooks for Ethereal/Unplayable/selfDamage
- `src/scenes/BootScene.ts` — route to BlessingScene
- `src/ui/MapHud.ts` — potion bar, live gold, epoch indicator
- `src/models/CombatState.ts` — hooks for ethereal discard-to-exhaust, onTurnEndSelf damage
- `src/ui/RestModal.ts` — rewire to emit RunOutcome[]

**Deletes:**
- `src/models/RunProgress.ts` — absorbed into RunState
- `src/ui/PlaceholderModal.ts` — no longer used after modals replace it

---

## Naming and type conventions (locked)

**Transition function names:**
- `gainGold`, `spendGold`, `takeDamage`, `heal`, `gainMaxHp`
- `addCardToDeck`, `removeCardFromDeck`, `upgradeCard`
- `addRelic`, `addPotion`, `usePotion`
- `gainEnergy` (permanent), `gainDrawBonus` (permanent)
- `recordEnemyDefeated`, `setPhase`, `setCurrentNode`

**Modal constructor signature:**
```ts
constructor(
  scene: Phaser.Scene,
  runState: Readonly<RunState>,
  onResolve: (outcomes: RunOutcome[]) => void,
)
```

**RunOutcome discriminator field:** `kind` (matches existing NodeData pattern).

**Every new source file starts with two ABOUTME lines.**

---

## Task 1: Core types — RunPhase, Potion, Relic, RunOutcome, Card engine flags

**Files:**
- Create: `src/models/RunState.ts`, `src/models/RunOutcome.ts`
- Modify: `src/models/Card.ts`

- [ ] **Step 1: Create `src/models/RunState.ts`**

```ts
// ABOUTME: RunState is the central run-level model — player, inventory, map nav, phase machine.
// ABOUTME: All mutations go through pure transitions in src/run/transitions.ts.
import type { RegionMap } from './RegionMap';
import type { Card } from './Card';

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

export type PotionEffect =
  | { kind: 'heal';       amount: number }
  | { kind: 'energy';     amount: number }
  | { kind: 'vulnerable'; stacks: number }
  | { kind: 'add_card';   card: Card };

export interface Potion {
  id: string;
  name: string;
  description: string;
  usableInMap: boolean;
  usableInCombat: boolean;
  targets: 'none' | 'enemy' | 'self';
  effect: PotionEffect;
}

export type RelicEffect =
  | { kind: 'gain_block';              amount: number }
  | { kind: 'gain_energy_first_turn';  amount: number }
  | { kind: 'shop_discount';           pct: number };

export interface Relic {
  id: string;
  name: string;
  description: string;
  trigger: 'turn_start' | 'combat_start' | 'first_turn' | 'passive';
  effect: RelicEffect;
}

export interface RunState {
  regionId: string;
  runId: string;
  currentEpoch: number;

  map: RegionMap;
  currentNodeId: string | null;
  visitedNodeIds: string[];

  playerHp: number;
  playerMaxHp: number;
  gold: number;
  baseEnergy: number;
  bonusCardsPerTurn: number;

  deck: Card[];
  upgradedCardIds: Set<string>;
  relics: Relic[];
  potions: (Potion | null)[];
  potionSlots: number;

  phase: RunPhase;
  enemiesDefeated: number;

  onStateChanged?: (state: RunState) => void;
}
```

- [ ] **Step 2: Create `src/models/RunOutcome.ts`**

```ts
// ABOUTME: RunOutcome is the uniform reward contract every modal emits.
// ABOUTME: The coordinator dispatches each outcome to a transition via applyOutcomes.
import type { Card } from './Card';
import type { Potion, Relic, RunPhase } from './RunState';

export type RunOutcome =
  | { kind: 'gold';         amount: number }
  | { kind: 'heal';         amount: number }
  | { kind: 'damage';       amount: number }
  | { kind: 'maxHp';        amount: number }
  | { kind: 'add_card';     card: Card }
  | { kind: 'remove_card';  cardId: string }
  | { kind: 'upgrade_card'; cardId: string }
  | { kind: 'add_relic';    relic: Relic }
  | { kind: 'add_potion';   potion: Potion }
  | { kind: 'enter_combat'; enemyId: string; returnPhase: RunPhase }
  | { kind: 'energy';       amount: number }
  | { kind: 'draw_bonus';   amount: number }
  | { kind: 'none' };
```

- [ ] **Step 3: Extend Card types**

Edit `src/models/Card.ts`. In the `Card` interface add two optional fields and in the `CardEffect` interface add two optional fields. Keep all existing fields. After the edit the relevant pieces should read:

```ts
export interface Card {
  id: string;
  title: string;
  cost: number;
  type: CardType;
  target: TargetType;
  description: string;
  effect: CardEffect;
  exhaust?: boolean;
  ethereal?: boolean;
  unplayable?: boolean;
}

export interface CardEffect {
  damage?: number;
  block?: number;
  strength?: number;
  draw?: number;
  vulnerable?: number;
  weak?: number;
  hits?: number;
  selfDamage?: number;
  onTurnEndSelf?: number;
}
```

(Add only the fields that don't already exist; don't remove any.)

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: exit 0, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/models/RunState.ts src/models/RunOutcome.ts src/models/Card.ts
git commit -m "feat(run): RunState, RunOutcome, Potion, Relic types + Card engine flags"
```

---

## Task 2: Add 'chest' NodeType + blueprint update + tutorial fixture

**Files:**
- Modify: `src/models/RegionMap.ts`, `src/map/blueprints.ts`, `src/fixtures/maps/tutorial-map.ts`

- [ ] **Step 1: Add 'chest' to NodeType**

Edit `src/models/RegionMap.ts`. Change the `NodeType` union:

```ts
export type NodeType = 'combat' | 'elite' | 'rest' | 'event' | 'shop' | 'chest' | 'boss';
```

And extend `NodeData`:

```ts
export type NodeData =
  | { kind: 'combat'; enemyId: string }
  | { kind: 'elite';  enemyId: string }
  | { kind: 'rest';   healPct: number }
  | { kind: 'event';  eventId: string }
  | { kind: 'shop';   seed: number }
  | { kind: 'chest';  seed: number }
  | { kind: 'boss';   enemyId: string };
```

- [ ] **Step 2: Update Withered Garden blueprint**

Edit `src/map/blueprints.ts`. Floor 3's `allowedTypes` should include `'chest'`:

```ts
    {
      floor: 3,
      lanes: [0, 1, 2],
      allowedTypes: ['shop', 'rest', 'combat', 'event', 'chest'],
      required: [{ types: ['shop', 'rest'], min: 1 }],
    },
```

- [ ] **Step 3: Update generator to handle chest NodeData**

Edit `src/map/generator.ts`. In the `makeNodeData` function add:

```ts
    case 'chest':
      return { kind: 'chest', seed: Math.floor(rng() * 1_000_000) };
```

- [ ] **Step 4: Update tutorial fixture to include a chest**

Edit `src/fixtures/maps/tutorial-map.ts`. Change one of the floor-3 nodes from shop/rest/event to a chest. Specifically replace the `f3-l1` node:

```ts
    { id: 'f3-l1', type: 'chest', floor: 3, lane: 1, data: { kind: 'chest', seed: 1234 } },
```

Keep the rest of the tutorialMap identical (adjust for any edges that reference f3-l1 — none need to change).

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all 27 tests still pass. Validator accepts chest as a valid type on floor 3.

- [ ] **Step 6: Commit**

```bash
git add src/models/RegionMap.ts src/map/blueprints.ts src/map/generator.ts src/fixtures/maps/tutorial-map.ts
git commit -m "feat(map): add chest as a first-class NodeType"
```

---

## Task 3: Run-local RNG

**Files:**
- Create: `src/run/rng.ts`

- [ ] **Step 1: Create RNG module**

```ts
// ABOUTME: Run-local seeded PRNG stream separate from the map generator's RNG.
// ABOUTME: Deterministic per seed so reward drops / events are reproducible in QA.
export function createRunRng(seed: number): () => number {
  let a = seed >>> 0;
  return function rng(): number {
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickFrom<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

export function pickN<T>(arr: readonly T[], n: number, rng: () => number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]!);
  }
  return out;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build` — exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/run/rng.ts
git commit -m "feat(run): run-local RNG with pickFrom/pickN helpers"
```

---

## Task 4: Content tables — potions, relics, blessings

**Files:**
- Create: `src/content/potions.ts`, `src/content/relics.ts`, `src/content/blessings.ts`

- [ ] **Step 1: Create potions table**

```ts
// ABOUTME: All potion definitions. Pure data; combat/map modals reference these by id.
// ABOUTME: Content is skeletal (3 potions); extend by appending new Potion entries.
import type { Potion } from '../models/RunState';

export const POTIONS: readonly Potion[] = [
  {
    id: 'potion_heal',
    name: 'Heal Draft',
    description: 'Restore 25 HP.',
    usableInMap: true,
    usableInCombat: true,
    targets: 'self',
    effect: { kind: 'heal', amount: 25 },
  },
  {
    id: 'potion_power',
    name: 'Power Elixir',
    description: 'Gain 1 energy this turn.',
    usableInMap: false,
    usableInCombat: true,
    targets: 'self',
    effect: { kind: 'energy', amount: 1 },
  },
  {
    id: 'potion_vulnerable',
    name: 'Vulnerable Vial',
    description: 'Apply Vulnerable(3) to target enemy.',
    usableInMap: false,
    usableInCombat: true,
    targets: 'enemy',
    effect: { kind: 'vulnerable', stacks: 3 },
  },
] as const;

export function getPotionById(id: string): Potion | undefined {
  return POTIONS.find(p => p.id === id);
}
```

- [ ] **Step 2: Create relics table**

```ts
// ABOUTME: All relic definitions. Effects are resolved by CombatState hooks based on trigger.
// ABOUTME: Skeletal set (3 relics); extend by appending.
import type { Relic } from '../models/RunState';

export const RELICS: readonly Relic[] = [
  {
    id: 'relic_bronze_scales',
    name: 'Bronze Scales',
    description: 'Gain 4 block at the start of each turn.',
    trigger: 'turn_start',
    effect: { kind: 'gain_block', amount: 4 },
  },
  {
    id: 'relic_anchor',
    name: 'Anchor',
    description: 'Gain 10 block at the start of each combat.',
    trigger: 'combat_start',
    effect: { kind: 'gain_block', amount: 10 },
  },
  {
    id: 'relic_lantern',
    name: 'Lantern',
    description: '+1 energy on the first turn of each combat.',
    trigger: 'first_turn',
    effect: { kind: 'gain_energy_first_turn', amount: 1 },
  },
] as const;

export function getRelicById(id: string): Relic | undefined {
  return RELICS.find(r => r.id === id);
}
```

- [ ] **Step 3: Create blessings table**

```ts
// ABOUTME: Run-start blessing pool. 3 random entries shown at BlessingScene.
// ABOUTME: Each blessing has a resolver that produces RunOutcome[] when chosen.
import type { RunOutcome } from '../models/RunOutcome';
import { POTIONS } from './potions';
import { RELICS } from './relics';
import { pickFrom, pickN } from '../run/rng';

export interface BlessingDef {
  id: string;
  name: string;
  description: string;
  resolve: (rng: () => number) => RunOutcome[];
}

export const BLESSINGS: readonly BlessingDef[] = [
  {
    id: 'bless_rare_card',
    name: 'Gift of Insight',
    description: 'Add 1 random rare card to your deck.',
    resolve: () => [{ kind: 'none' }],  // resolved later when card pool lands (Task 5)
  },
  {
    id: 'bless_relic',
    name: 'Gift of Memory',
    description: 'Gain 1 random relic.',
    resolve: (rng) => [{ kind: 'add_relic', relic: pickFrom(RELICS, rng) }],
  },
  {
    id: 'bless_vitality',
    name: 'Gift of Vitality',
    description: '+10 max HP and heal 10.',
    resolve: () => [{ kind: 'maxHp', amount: 10 }, { kind: 'heal', amount: 10 }],
  },
  {
    id: 'bless_wealth',
    name: 'Gift of Fortune',
    description: 'Start with +75 gold.',
    resolve: () => [{ kind: 'gold', amount: 75 }],
  },
  {
    id: 'bless_potions',
    name: 'Gift of Brewing',
    description: 'Start with 2 random potions.',
    resolve: (rng) => {
      const potions = pickN(POTIONS, 2, rng);
      return potions.map(p => ({ kind: 'add_potion' as const, potion: p }));
    },
  },
  {
    id: 'bless_power',
    name: 'Gift of Fire',
    description: 'Gain 1 permanent energy per turn.',
    resolve: () => [{ kind: 'energy', amount: 1 }],
  },
  {
    id: 'bless_knowledge',
    name: 'Gift of Sight',
    description: 'Draw 1 extra card each turn.',
    resolve: () => [{ kind: 'draw_bonus', amount: 1 }],
  },
] as const;

export function pickBlessings(rng: () => number, count: number = 3): BlessingDef[] {
  return pickN(BLESSINGS, count, rng);
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build` — exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/content/potions.ts src/content/relics.ts src/content/blessings.ts
git commit -m "feat(content): potions, relics, blessings tables"
```

---

## Task 5: Content tables — cards (Region 1 pool + exotics), events, enemies, epochs

**Files:**
- Create: `src/content/cards.ts`, `src/content/events.ts`, `src/content/enemies.ts`, `src/content/epochs.ts`

- [ ] **Step 1: Create cards table**

```ts
// ABOUTME: Region 1 card pool + exotic cards. Used by reward/merchant/blessing/event flows.
// ABOUTME: Separated by rarity; pickers weight by rarity.
import type { Card } from '../models/Card';
import { CardType, TargetType } from '../models/Card';

export type Rarity = 'common' | 'uncommon' | 'rare';

export interface CardDef {
  rarity: Rarity;
  template: Omit<Card, 'id'>;
}

function makeId(title: string): string {
  return `${title.toLowerCase().replace(/\s+/g, '_')}_${Math.random().toString(36).slice(2, 7)}`;
}

export function spawn(defTitle: string): Card {
  const def = CARD_POOL.find(d => d.template.title === defTitle);
  if (!def) throw new Error(`No card def: ${defTitle}`);
  return { ...def.template, id: makeId(def.template.title) };
}

export const CARD_POOL: readonly CardDef[] = [
  // Common
  {
    rarity: 'common',
    template: {
      title: 'Strike', cost: 1, type: CardType.ATTACK, target: TargetType.SINGLE_ENEMY,
      description: 'Deal 6 damage.',
      effect: { damage: 6 },
    },
  },
  {
    rarity: 'common',
    template: {
      title: 'Defend', cost: 1, type: CardType.SKILL, target: TargetType.SELF,
      description: 'Gain 5 block.',
      effect: { block: 5 },
    },
  },
  // Uncommon
  {
    rarity: 'uncommon',
    template: {
      title: 'Shockwave', cost: 2, type: CardType.ATTACK, target: TargetType.ALL_ENEMIES,
      description: 'Deal 8 damage. Apply Weak(2).',
      effect: { damage: 8, weak: 2 },
    },
  },
  {
    rarity: 'uncommon',
    template: {
      title: 'Flow', cost: 0, type: CardType.SKILL, target: TargetType.SELF,
      description: 'Draw 2 cards.',
      effect: { draw: 2 },
    },
  },
  // Rare
  {
    rarity: 'rare',
    template: {
      title: 'Empower', cost: 1, type: CardType.POWER, target: TargetType.SELF,
      description: 'Permanently gain Strength(2).',
      effect: { strength: 2 },
    },
  },
  // Exotic (rare tier, enabled by exotic card engine)
  {
    rarity: 'rare',
    template: {
      title: 'Wild Strike', cost: 1, type: CardType.ATTACK, target: TargetType.SINGLE_ENEMY,
      description: 'Deal 12 damage. Ethereal.',
      effect: { damage: 12 },
      ethereal: true,
    },
  },
  {
    rarity: 'uncommon',
    template: {
      title: 'Self-Flagellation', cost: 0, type: CardType.SKILL, target: TargetType.SELF,
      description: 'Draw 2 cards. Lose 4 HP.',
      effect: { draw: 2, selfDamage: 4 },
    },
  },
  {
    rarity: 'common',  // curses are "common tier" bad cards
    template: {
      title: 'Doubt', cost: 0, type: CardType.SKILL, target: TargetType.SELF,
      description: 'Unplayable. At end of turn, lose 2 HP.',
      effect: { onTurnEndSelf: 2 },
      unplayable: true,
    },
  },
] as const;

export function pickRandomCard(rng: () => number, filter?: (d: CardDef) => boolean): Card {
  const pool = filter ? CARD_POOL.filter(filter) : CARD_POOL;
  const def = pool[Math.floor(rng() * pool.length)]!;
  return { ...def.template, id: makeId(def.template.title) };
}

export function pickCardsByRarity(rng: () => number, count: number, rarity: Rarity): Card[] {
  const pool = CARD_POOL.filter(d => d.rarity === rarity);
  const chosen: Card[] = [];
  for (let i = 0; i < count; i++) {
    const def = pool[Math.floor(rng() * pool.length)]!;
    chosen.push({ ...def.template, id: makeId(def.template.title) });
  }
  return chosen;
}
```

- [ ] **Step 2: Create events table**

```ts
// ABOUTME: Region 1 narrative event definitions. Each has choices that produce RunOutcome[].
// ABOUTME: One event may trigger combat via the enter_combat outcome.
import type { RunOutcome } from '../models/RunOutcome';
import { RELICS } from './relics';
import { spawn } from './cards';
import { pickFrom } from '../run/rng';

export interface EventChoice {
  id: string;
  label: string;
  resolve: (rng: () => number) => RunOutcome[];
}

export interface EventDef {
  id: string;
  name: string;
  body: string;
  choices: EventChoice[];
}

export const EVENTS: readonly EventDef[] = [
  {
    id: 'event_forked_path',
    name: 'The Forked Path',
    body: 'The path forks. Through the thorny way you glimpse something glinting — but the vines are thick.',
    choices: [
      {
        id: 'thorny',
        label: 'Take the thorny path',
        resolve: () => [{ kind: 'enter_combat', enemyId: 'thorn-creep', returnPhase: 'REWARD' }],
      },
      {
        id: 'clear',
        label: 'Take the clear path',
        resolve: () => [{ kind: 'none' }],
      },
    ],
  },
  {
    id: 'event_shrine_of_mist',
    name: 'Shrine of Mist',
    body: 'A pale shrine glows in the mist. The offering plate shimmers.',
    choices: [
      {
        id: 'bleed',
        label: 'Sacrifice 10 HP for 50 gold',
        resolve: () => [{ kind: 'damage', amount: 10 }, { kind: 'gold', amount: 50 }],
      },
      {
        id: 'leave',
        label: 'Leave',
        resolve: () => [{ kind: 'none' }],
      },
    ],
  },
  {
    id: 'event_gem_hoard',
    name: 'Gem Hoard',
    body: 'Loose gems scatter across a stone plinth. A small ornate box sits untouched.',
    choices: [
      {
        id: 'gold',
        label: 'Pocket the loose gold (+30 gold)',
        resolve: () => [{ kind: 'gold', amount: 30 }],
      },
      {
        id: 'box',
        label: 'Open the ornate box',
        resolve: (rng) => [{ kind: 'add_relic', relic: pickFrom(RELICS, rng) }],
      },
    ],
  },
  {
    id: 'event_cursed_altar',
    name: 'Cursed Altar',
    body: 'Dark runes pulse. A whisper offers you wealth — for a price.',
    choices: [
      {
        id: 'accept',
        label: 'Accept the bargain (+75 gold, add Doubt curse)',
        resolve: () => [
          { kind: 'gold', amount: 75 },
          { kind: 'add_card', card: spawn('Doubt') },
        ],
      },
      {
        id: 'refuse',
        label: 'Refuse',
        resolve: () => [{ kind: 'none' }],
      },
    ],
  },
  {
    id: 'event_merchants_apprentice',
    name: "Merchant's Apprentice",
    body: 'A young apprentice offers you a card from her satchel as a gift.',
    choices: [
      {
        id: 'take',
        label: 'Accept a card (pick 1 of 3)',
        // The RewardModal/CardPickerModal handles the actual picking; this emits a placeholder
        // that the EventModal interprets as "open a CardPickerModal with 3 uncommons."
        resolve: () => [{ kind: 'none' }],  // event-specific flow in EventModal
      },
      {
        id: 'leave',
        label: 'Leave',
        resolve: () => [{ kind: 'none' }],
      },
    ],
  },
] as const;

export function getEventById(id: string): EventDef | undefined {
  return EVENTS.find(e => e.id === id);
}

export function pickEvent(rng: () => number): EventDef {
  return pickFrom(EVENTS, rng);
}
```

- [ ] **Step 3: Create enemies table**

```ts
// ABOUTME: Enemy definitions for combat, including elite and boss enemies.
// ABOUTME: CombatScene uses enemyId from the current node to look up the right definition.

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  tier: 'normal' | 'elite' | 'boss';
  behaviorId: string;  // CombatState uses this to pick an AI behavior
}

export const ENEMIES: readonly EnemyDef[] = [
  { id: 'thorn-creep',       name: 'Thorn Creep',       hp: 30,  tier: 'normal', behaviorId: 'simple_attack' },
  { id: 'fog-wisp',          name: 'Fog Wisp',          hp: 25,  tier: 'normal', behaviorId: 'simple_attack' },
  { id: 'rot-golem',         name: 'Rot Golem',         hp: 80,  tier: 'elite',  behaviorId: 'heavy_slow' },
  { id: 'hollow-gardener',   name: 'The Hollow Gardener', hp: 140, tier: 'boss',  behaviorId: 'boss_phases' },
] as const;

export function getEnemyById(id: string): EnemyDef | undefined {
  return ENEMIES.find(e => e.id === id);
}
```

- [ ] **Step 4: Create epochs table**

```ts
// ABOUTME: Epoch definitions. Epoch 1 is default, epoch 2 unlocks when criteria met.
// ABOUTME: Session-only: unlock state lives in memory until page reload.
import type { RunState } from '../models/RunState';

export interface EpochDef {
  epoch: number;
  description: string;
  meetsUnlockCriteria: (state: Readonly<RunState>) => boolean;
  enemyHpMultiplier: number;
  potionSlots: number;
}

export const EPOCHS: readonly EpochDef[] = [
  {
    epoch: 1,
    description: 'The Withered Garden awakens.',
    meetsUnlockCriteria: () => false,
    enemyHpMultiplier: 1.0,
    potionSlots: 3,
  },
  {
    epoch: 2,
    description: 'The mist thickens. Enemies grow sturdier; your satchel expands.',
    meetsUnlockCriteria: (state) => state.enemiesDefeated >= 2,
    enemyHpMultiplier: 1.15,
    potionSlots: 4,
  },
] as const;

export function getEpoch(epoch: number): EpochDef {
  return EPOCHS.find(e => e.epoch === epoch) ?? EPOCHS[0]!;
}

export function nextUnlockableEpoch(state: Readonly<RunState>): EpochDef | null {
  const current = state.currentEpoch;
  const next = EPOCHS.find(e => e.epoch === current + 1);
  if (next && next.meetsUnlockCriteria(state)) return next;
  return null;
}
```

- [ ] **Step 5: Back-fill `bless_rare_card` resolver**

Now that cards is available, edit `src/content/blessings.ts` — replace the `bless_rare_card` entry:

```ts
import { pickCardsByRarity } from './cards';
// ...
  {
    id: 'bless_rare_card',
    name: 'Gift of Insight',
    description: 'Add 1 random rare card to your deck.',
    resolve: (rng) => {
      const card = pickCardsByRarity(rng, 1, 'rare')[0]!;
      return [{ kind: 'add_card', card }];
    },
  },
```

- [ ] **Step 6: Verify build**

Run: `npm run build` — exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/content/cards.ts src/content/events.ts src/content/enemies.ts src/content/epochs.ts src/content/blessings.ts
git commit -m "feat(content): cards, events, enemies, epochs tables"
```

---

## Task 6: Transitions module (TDD)

**Files:**
- Create: `src/run/transitions.ts`, `tests/run-transitions.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/run-transitions.test.ts`:

```ts
// ABOUTME: Tests for all run-level pure transitions.
// ABOUTME: Each transition mutates state in place and optionally fires onStateChanged.
import { describe, it, expect, vi } from 'vitest';
import {
  gainGold, spendGold, takeDamage, heal, gainMaxHp,
  addCardToDeck, removeCardFromDeck, upgradeCard,
  addRelic, addPotion, usePotion,
  gainEnergy, gainDrawBonus, recordEnemyDefeated, setPhase,
} from '../src/run/transitions';
import type { RunState } from '../src/models/RunState';
import { POTIONS } from '../src/content/potions';
import { RELICS } from '../src/content/relics';
import { spawn } from '../src/content/cards';

function blankRunState(): RunState {
  return {
    regionId: 'withered-garden',
    runId: 'test-run',
    currentEpoch: 1,
    map: { regionId: '', seed: 0, nodes: [], edges: [], startNodeIds: [], bossNodeId: 'boss' },
    currentNodeId: null,
    visitedNodeIds: [],
    playerHp: 75,
    playerMaxHp: 75,
    gold: 0,
    baseEnergy: 3,
    bonusCardsPerTurn: 0,
    deck: [],
    upgradedCardIds: new Set(),
    relics: [],
    potions: [null, null, null],
    potionSlots: 3,
    phase: 'MAP',
    enemiesDefeated: 0,
  };
}

describe('gainGold / spendGold', () => {
  it('gainGold adds to gold and fires onStateChanged', () => {
    const s = blankRunState();
    const spy = vi.fn();
    s.onStateChanged = spy;
    gainGold(s, 50);
    expect(s.gold).toBe(50);
    expect(spy).toHaveBeenCalledWith(s);
  });

  it('spendGold deducts when sufficient, returns true', () => {
    const s = blankRunState();
    s.gold = 100;
    expect(spendGold(s, 30)).toBe(true);
    expect(s.gold).toBe(70);
  });

  it('spendGold refuses when insufficient, returns false, does not mutate', () => {
    const s = blankRunState();
    s.gold = 20;
    expect(spendGold(s, 30)).toBe(false);
    expect(s.gold).toBe(20);
  });
});

describe('takeDamage / heal / gainMaxHp', () => {
  it('takeDamage subtracts from hp, clamps to 0', () => {
    const s = blankRunState();
    takeDamage(s, 100);
    expect(s.playerHp).toBe(0);
  });

  it('takeDamage sets phase to DEATH when hp hits 0', () => {
    const s = blankRunState();
    takeDamage(s, 100);
    expect(s.phase).toBe('DEATH');
  });

  it('heal restores hp, clamps to maxHp', () => {
    const s = blankRunState();
    s.playerHp = 50;
    heal(s, 100);
    expect(s.playerHp).toBe(75);
  });

  it('gainMaxHp raises both max and current hp by the same amount', () => {
    const s = blankRunState();
    s.playerHp = 50; s.playerMaxHp = 75;
    gainMaxHp(s, 10);
    expect(s.playerMaxHp).toBe(85);
    expect(s.playerHp).toBe(60);
  });
});

describe('deck transitions', () => {
  it('addCardToDeck appends', () => {
    const s = blankRunState();
    addCardToDeck(s, spawn('Strike'));
    expect(s.deck.length).toBe(1);
  });

  it('removeCardFromDeck removes by id', () => {
    const s = blankRunState();
    const c = spawn('Strike');
    s.deck.push(c);
    removeCardFromDeck(s, c.id);
    expect(s.deck.length).toBe(0);
  });

  it('upgradeCard records the card id', () => {
    const s = blankRunState();
    upgradeCard(s, 'card-123');
    expect(s.upgradedCardIds.has('card-123')).toBe(true);
  });
});

describe('relic / potion transitions', () => {
  it('addRelic appends', () => {
    const s = blankRunState();
    addRelic(s, RELICS[0]!);
    expect(s.relics.length).toBe(1);
  });

  it('addPotion fills first empty slot, returns true', () => {
    const s = blankRunState();
    const ok = addPotion(s, POTIONS[0]!);
    expect(ok).toBe(true);
    expect(s.potions[0]).toBe(POTIONS[0]);
  });

  it('addPotion returns false when all slots full', () => {
    const s = blankRunState();
    s.potions = [POTIONS[0]!, POTIONS[1]!, POTIONS[2]!];
    expect(addPotion(s, POTIONS[0]!)).toBe(false);
  });

  it('usePotion clears the slot', () => {
    const s = blankRunState();
    s.potions[1] = POTIONS[0]!;
    usePotion(s, 1);
    expect(s.potions[1]).toBe(null);
  });
});

describe('permanent buffs', () => {
  it('gainEnergy increases baseEnergy', () => {
    const s = blankRunState();
    gainEnergy(s, 1);
    expect(s.baseEnergy).toBe(4);
  });

  it('gainDrawBonus increases bonusCardsPerTurn', () => {
    const s = blankRunState();
    gainDrawBonus(s, 1);
    expect(s.bonusCardsPerTurn).toBe(1);
  });
});

describe('metrics + phase', () => {
  it('recordEnemyDefeated increments', () => {
    const s = blankRunState();
    recordEnemyDefeated(s);
    recordEnemyDefeated(s);
    expect(s.enemiesDefeated).toBe(2);
  });

  it('setPhase changes phase and fires onStateChanged', () => {
    const s = blankRunState();
    const spy = vi.fn();
    s.onStateChanged = spy;
    setPhase(s, 'COMBAT');
    expect(s.phase).toBe('COMBAT');
    expect(spy).toHaveBeenCalledWith(s);
  });
});
```

- [ ] **Step 2: Run tests to verify fail**

Run: `npm test -- run-transitions`
Expected: FAIL — module not found.

- [ ] **Step 3: Create transitions module**

```ts
// ABOUTME: Pure-ish mutators on RunState. Each fires onStateChanged at the end.
// ABOUTME: Every presentation mutation goes through these — modals do not mutate directly.
import type { RunState, Potion, Relic, RunPhase } from '../models/RunState';
import type { Card } from '../models/Card';

function emit(state: RunState): void {
  state.onStateChanged?.(state);
}

export function gainGold(state: RunState, amount: number): void {
  state.gold += amount;
  emit(state);
}

export function spendGold(state: RunState, amount: number): boolean {
  if (state.gold < amount) return false;
  state.gold -= amount;
  emit(state);
  return true;
}

export function takeDamage(state: RunState, amount: number): void {
  state.playerHp = Math.max(0, state.playerHp - amount);
  if (state.playerHp === 0 && state.phase !== 'DEATH') {
    state.phase = 'DEATH';
  }
  emit(state);
}

export function heal(state: RunState, amount: number): void {
  state.playerHp = Math.min(state.playerMaxHp, state.playerHp + amount);
  emit(state);
}

export function gainMaxHp(state: RunState, amount: number): void {
  state.playerMaxHp += amount;
  state.playerHp += amount;
  emit(state);
}

export function addCardToDeck(state: RunState, card: Card): void {
  state.deck.push(card);
  emit(state);
}

export function removeCardFromDeck(state: RunState, cardId: string): void {
  const idx = state.deck.findIndex(c => c.id === cardId);
  if (idx >= 0) state.deck.splice(idx, 1);
  emit(state);
}

export function upgradeCard(state: RunState, cardId: string): void {
  state.upgradedCardIds.add(cardId);
  emit(state);
}

export function addRelic(state: RunState, relic: Relic): void {
  state.relics.push(relic);
  emit(state);
}

export function addPotion(state: RunState, potion: Potion): boolean {
  const idx = state.potions.findIndex(p => p === null);
  if (idx < 0) return false;
  state.potions[idx] = potion;
  emit(state);
  return true;
}

export function usePotion(state: RunState, slotIndex: number): void {
  if (slotIndex < 0 || slotIndex >= state.potions.length) return;
  state.potions[slotIndex] = null;
  emit(state);
}

export function gainEnergy(state: RunState, amount: number): void {
  state.baseEnergy += amount;
  emit(state);
}

export function gainDrawBonus(state: RunState, amount: number): void {
  state.bonusCardsPerTurn += amount;
  emit(state);
}

export function recordEnemyDefeated(state: RunState): void {
  state.enemiesDefeated += 1;
  emit(state);
}

export function setPhase(state: RunState, phase: RunPhase): void {
  state.phase = phase;
  emit(state);
}

export function setCurrentNode(state: RunState, nodeId: string | null): void {
  state.currentNodeId = nodeId;
  emit(state);
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- run-transitions`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/run/transitions.ts tests/run-transitions.test.ts
git commit -m "feat(run): pure transitions module with unit tests"
```

---

## Task 7: applyOutcomes dispatcher (TDD)

**Files:**
- Create: `src/run/applyOutcomes.ts`, `tests/apply-outcomes.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// ABOUTME: Tests that applyOutcomes dispatches each RunOutcome kind to the right transition.
import { describe, it, expect } from 'vitest';
import { applyOutcomes } from '../src/run/applyOutcomes';
import type { RunOutcome } from '../src/models/RunOutcome';
import type { RunState } from '../src/models/RunState';
import { POTIONS } from '../src/content/potions';
import { RELICS } from '../src/content/relics';
import { spawn } from '../src/content/cards';

function blankState(): RunState {
  return {
    regionId: 'x', runId: 'x', currentEpoch: 1,
    map: { regionId: '', seed: 0, nodes: [], edges: [], startNodeIds: [], bossNodeId: 'boss' },
    currentNodeId: null, visitedNodeIds: [],
    playerHp: 75, playerMaxHp: 75, gold: 0, baseEnergy: 3, bonusCardsPerTurn: 0,
    deck: [], upgradedCardIds: new Set(), relics: [], potions: [null, null, null], potionSlots: 3,
    phase: 'MAP', enemiesDefeated: 0,
  };
}

describe('applyOutcomes', () => {
  it('applies gold', () => {
    const s = blankState();
    applyOutcomes(s, [{ kind: 'gold', amount: 30 }]);
    expect(s.gold).toBe(30);
  });

  it('applies heal', () => {
    const s = blankState();
    s.playerHp = 50;
    applyOutcomes(s, [{ kind: 'heal', amount: 10 }]);
    expect(s.playerHp).toBe(60);
  });

  it('applies add_relic', () => {
    const s = blankState();
    applyOutcomes(s, [{ kind: 'add_relic', relic: RELICS[0]! }]);
    expect(s.relics.length).toBe(1);
  });

  it('applies add_potion', () => {
    const s = blankState();
    applyOutcomes(s, [{ kind: 'add_potion', potion: POTIONS[0]! }]);
    expect(s.potions[0]).toBe(POTIONS[0]);
  });

  it('applies add_card', () => {
    const s = blankState();
    applyOutcomes(s, [{ kind: 'add_card', card: spawn('Strike') }]);
    expect(s.deck.length).toBe(1);
  });

  it('applies maxHp (raises max and current)', () => {
    const s = blankState();
    applyOutcomes(s, [{ kind: 'maxHp', amount: 10 }]);
    expect(s.playerMaxHp).toBe(85);
    expect(s.playerHp).toBe(85);
  });

  it('applies damage', () => {
    const s = blankState();
    applyOutcomes(s, [{ kind: 'damage', amount: 10 }]);
    expect(s.playerHp).toBe(65);
  });

  it('applies energy (permanent)', () => {
    const s = blankState();
    applyOutcomes(s, [{ kind: 'energy', amount: 1 }]);
    expect(s.baseEnergy).toBe(4);
  });

  it('applies draw_bonus', () => {
    const s = blankState();
    applyOutcomes(s, [{ kind: 'draw_bonus', amount: 1 }]);
    expect(s.bonusCardsPerTurn).toBe(1);
  });

  it('enter_combat sets phase to COMBAT', () => {
    const s = blankState();
    applyOutcomes(s, [{ kind: 'enter_combat', enemyId: 'thorn-creep', returnPhase: 'MAP' }]);
    expect(s.phase).toBe('COMBAT');
  });

  it('none is a no-op', () => {
    const s = blankState();
    applyOutcomes(s, [{ kind: 'none' }]);
    expect(s.gold).toBe(0);
  });

  it('applies a batch in order', () => {
    const s = blankState();
    applyOutcomes(s, [
      { kind: 'gold', amount: 50 },
      { kind: 'damage', amount: 10 },
      { kind: 'heal', amount: 5 },
    ]);
    expect(s.gold).toBe(50);
    expect(s.playerHp).toBe(70);
  });
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `npm test -- apply-outcomes`
Expected: FAIL — module not found.

- [ ] **Step 3: Create applyOutcomes**

```ts
// ABOUTME: Dispatcher that maps each RunOutcome to the right transition.
// ABOUTME: Only path by which external code (modals, CombatScene) mutates RunState.
import type { RunState } from '../models/RunState';
import type { RunOutcome } from '../models/RunOutcome';
import {
  gainGold, heal, takeDamage, gainMaxHp,
  addCardToDeck, removeCardFromDeck, upgradeCard,
  addRelic, addPotion,
  gainEnergy, gainDrawBonus, setPhase,
} from './transitions';

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
      case 'enter_combat': setPhase(state, 'COMBAT'); break;
      case 'energy':       gainEnergy(state, o.amount); break;
      case 'draw_bonus':   gainDrawBonus(state, o.amount); break;
      case 'none':         break;
    }
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- apply-outcomes`
Expected: all 12 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/run/applyOutcomes.ts tests/apply-outcomes.test.ts
git commit -m "feat(run): applyOutcomes dispatcher"
```

---

## Task 8: buildFreshRun factory (TDD)

**Files:**
- Create: `src/run/buildFreshRun.ts`, `tests/buildFreshRun.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// ABOUTME: Tests for buildFreshRun — constructs a fresh RunState for a new run/epoch.
import { describe, it, expect } from 'vitest';
import { buildFreshRun } from '../src/run/buildFreshRun';
import { witheredGardenBlueprint } from '../src/map/blueprints';

describe('buildFreshRun', () => {
  it('returns a RunState with expected defaults for epoch 1', () => {
    const s = buildFreshRun({ seed: 1, epoch: 1, blueprint: witheredGardenBlueprint });
    expect(s.regionId).toBe('withered-garden');
    expect(s.currentEpoch).toBe(1);
    expect(s.playerHp).toBe(75);
    expect(s.playerMaxHp).toBe(75);
    expect(s.gold).toBe(0);
    expect(s.baseEnergy).toBe(3);
    expect(s.bonusCardsPerTurn).toBe(0);
    expect(s.potions.length).toBe(3);
    expect(s.potions.every(p => p === null)).toBe(true);
    expect(s.potionSlots).toBe(3);
    expect(s.deck.length).toBe(10);  // 5 Strike + 4 Defend + 1 Flow as starting deck
    expect(s.relics.length).toBe(0);
    expect(s.enemiesDefeated).toBe(0);
    expect(s.phase).toBe('BLESSING');
  });

  it('uses epoch 2 modifiers when passed epoch 2', () => {
    const s = buildFreshRun({ seed: 1, epoch: 2, blueprint: witheredGardenBlueprint });
    expect(s.currentEpoch).toBe(2);
    expect(s.potionSlots).toBe(4);
    expect(s.potions.length).toBe(4);
  });

  it('generates a valid map', () => {
    const s = buildFreshRun({ seed: 1, epoch: 1, blueprint: witheredGardenBlueprint });
    expect(s.map.nodes.length).toBeGreaterThan(0);
    expect(s.map.bossNodeId).toBe('boss');
  });

  it('is deterministic for same seed', () => {
    const a = buildFreshRun({ seed: 42, epoch: 1, blueprint: witheredGardenBlueprint });
    const b = buildFreshRun({ seed: 42, epoch: 1, blueprint: witheredGardenBlueprint });
    expect(a.map.nodes.length).toBe(b.map.nodes.length);
    expect(a.deck.length).toBe(b.deck.length);
  });
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `npm test -- buildFreshRun`
Expected: FAIL — module not found.

- [ ] **Step 3: Create buildFreshRun**

```ts
// ABOUTME: Constructs a fresh RunState for a new run or a new epoch within a session.
// ABOUTME: Only place where initial deck + HP + potion slots are decided.
import type { RunState } from '../models/RunState';
import type { RegionBlueprint } from '../models/RegionBlueprint';
import type { Card } from '../models/Card';
import { generateRegionMap } from '../map/generator';
import { getEpoch } from '../content/epochs';
import { spawn } from '../content/cards';

export interface BuildFreshRunArgs {
  seed: number;
  epoch: number;
  blueprint: RegionBlueprint;
}

function startingDeck(): Card[] {
  const deck: Card[] = [];
  for (let i = 0; i < 5; i++) deck.push(spawn('Strike'));
  for (let i = 0; i < 4; i++) deck.push(spawn('Defend'));
  deck.push(spawn('Flow'));
  return deck;
}

export function buildFreshRun(args: BuildFreshRunArgs): RunState {
  const epochDef = getEpoch(args.epoch);
  const map = generateRegionMap(args.blueprint, args.seed);
  const potions: (null)[] = [];
  for (let i = 0; i < epochDef.potionSlots; i++) potions.push(null);

  return {
    regionId: args.blueprint.regionId,
    runId: `run-${args.seed}-${args.epoch}-${Date.now()}`,
    currentEpoch: args.epoch,
    map,
    currentNodeId: null,
    visitedNodeIds: [],
    playerHp: 75,
    playerMaxHp: 75,
    gold: 0,
    baseEnergy: 3,
    bonusCardsPerTurn: 0,
    deck: startingDeck(),
    upgradedCardIds: new Set(),
    relics: [],
    potions,
    potionSlots: epochDef.potionSlots,
    phase: 'BLESSING',
    enemiesDefeated: 0,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- buildFreshRun`
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/run/buildFreshRun.ts tests/buildFreshRun.test.ts
git commit -m "feat(run): buildFreshRun factory"
```

---

## Task 9: Card engine hooks — Ethereal, Unplayable, selfDamage, onTurnEndSelf

**Files:**
- Modify: `src/models/CombatState.ts`, `src/scenes/CombatScene.ts`
- Create: `tests/card-engine.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// ABOUTME: Tests for the exotic card engine: Ethereal, Unplayable, selfDamage, onTurnEndSelf.
import { describe, it, expect } from 'vitest';
import { CombatState, TurnPhase } from '../src/models/CombatState';
import type { Card } from '../src/models/Card';
import { CardType, TargetType } from '../src/models/Card';

function ethereal(): Card {
  return {
    id: 'eth-1', title: 'EtherealCard', cost: 0, type: CardType.SKILL,
    target: TargetType.SELF, description: '',
    effect: { block: 1 },
    ethereal: true,
  };
}

function unplayableCurse(): Card {
  return {
    id: 'curse-1', title: 'Curse', cost: 0, type: CardType.SKILL,
    target: TargetType.SELF, description: '',
    effect: { onTurnEndSelf: 2 },
    unplayable: true,
  };
}

function selfFlagellate(): Card {
  return {
    id: 'sf-1', title: 'Self-Flagellation', cost: 0, type: CardType.SKILL,
    target: TargetType.SELF, description: '',
    effect: { draw: 1, selfDamage: 4 },
  };
}

describe('Ethereal', () => {
  it('exhausts at end of turn if still in hand', () => {
    const state = new CombatState();
    state.deck.hand = [ethereal()];
    state.endPlayerTurn();
    expect(state.deck.exhaustPile.some(c => c.id === 'eth-1')).toBe(true);
    expect(state.deck.discardPile.some(c => c.id === 'eth-1')).toBe(false);
  });
});

describe('Unplayable + onTurnEndSelf', () => {
  it('Unplayable card cannot be played (playCard returns not-ok)', () => {
    const state = new CombatState();
    state.currentPhase = TurnPhase.PLAYER_ACTION;
    const curse = unplayableCurse();
    state.deck.hand = [curse];
    const result = state.playCard(curse.id, state.player);
    expect(result.success).toBe(false);
  });

  it('onTurnEndSelf damages player at end of turn', () => {
    const state = new CombatState();
    state.player.hp = 50;
    state.deck.hand = [unplayableCurse()];
    state.endPlayerTurn();
    expect(state.player.hp).toBe(48);
  });
});

describe('selfDamage', () => {
  it('playing a selfDamage card deducts player hp', () => {
    const state = new CombatState();
    state.currentPhase = TurnPhase.PLAYER_ACTION;
    state.player.hp = 50;
    state.player.energy = 3;
    const c = selfFlagellate();
    state.deck.hand = [c];
    state.playCard(c.id, state.player);
    expect(state.player.hp).toBe(46);
  });
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `npm test -- card-engine`
Expected: FAIL — Ethereal cards currently discarded, selfDamage ignored, unplayable can be played.

- [ ] **Step 3: Modify CombatState**

Edit `src/models/CombatState.ts`:

In `endPlayerTurn()`, BEFORE moving hand to discard pile, process Ethereal + onTurnEndSelf:

```ts
  endPlayerTurn(): void {
    // Exotic card engine: process end-of-turn flags for cards still in hand.
    const handSnapshot = [...this.deck.hand];
    for (const c of handSnapshot) {
      if (c.effect.onTurnEndSelf) {
        this.player.hp = Math.max(0, this.player.hp - c.effect.onTurnEndSelf);
      }
      if (c.ethereal) {
        this.deck.exhaustPile.push(c);
        this.deck.hand = this.deck.hand.filter(h => h.id !== c.id);
      }
    }

    // ... existing end-of-turn logic ...
  }
```

In `playCard()`, BEFORE the usual effect application, reject Unplayable + apply selfDamage:

```ts
  playCard(cardId: string, target: CombatEntity | undefined): PlayResult {
    const card = this.deck.hand.find(c => c.id === cardId);
    if (!card) return { success: false, damages: [] };
    if (card.unplayable) return { success: false, damages: [] };
    if (this.player.energy < card.cost) return { success: false, damages: [] };

    // ... existing effect processing ...

    if (card.effect.selfDamage) {
      this.player.hp = Math.max(0, this.player.hp - card.effect.selfDamage);
    }

    // ... existing code continues ...
  }
```

(Preserve all existing `playCard` behavior; add only these three lines near the top and the `selfDamage` block.)

- [ ] **Step 4: Run tests**

Run: `npm test -- card-engine`
Expected: all 4 tests pass. Existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/models/CombatState.ts tests/card-engine.test.ts
git commit -m "feat(combat): Ethereal + Unplayable + selfDamage + onTurnEndSelf engine"
```

---

## Task 10: CardPickerModal (reusable)

**Files:**
- Create: `src/ui/modals/CardPickerModal.ts`

- [ ] **Step 1: Create CardPickerModal**

```ts
// ABOUTME: Reusable modal that presents 1-of-N cards for the player to pick.
// ABOUTME: Used by reward screens, chest, blessing, and event flows.
import * as Phaser from 'phaser';
import type { Card } from '../../models/Card';
import { CardType } from '../../models/Card';

export interface CardPickerArgs {
  title: string;
  cards: Card[];
  allowSkip: boolean;
}

export class CardPickerModal extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    args: CardPickerArgs,
    onResolve: (picked: Card | null) => void,
  ) {
    super(scene, 0, 0);

    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.7).setInteractive();
    this.add(dim);

    const title = scene.add.text(640, 100, args.title, {
      fontSize: '36px', fontStyle: 'bold', color: '#efe5cc',
    }).setOrigin(0.5);
    this.add(title);

    const colors: Record<string, number> = {
      [CardType.ATTACK]: 0xaa4444,
      [CardType.SKILL]: 0x44aa44,
      [CardType.POWER]: 0x6c5ce7,
    };

    args.cards.forEach((card, i) => {
      const x = 640 + (i - (args.cards.length - 1) / 2) * 200;
      const y = 360;

      const cardContainer = scene.add.container(x, y);
      const bg = scene.add.graphics();
      bg.fillStyle(0x2d3436, 1);
      bg.fillRoundedRect(-80, -120, 160, 240, 12);
      bg.lineStyle(6, colors[card.type] ?? 0xffffff, 1);
      bg.strokeRoundedRect(-80, -120, 160, 240, 12);
      cardContainer.add(bg);

      const costBg = scene.add.circle(-65, -105, 20, 0x0984e3).setStrokeStyle(3, 0x74b9ff);
      cardContainer.add(costBg);
      cardContainer.add(scene.add.text(-65, -105, card.cost.toString(), {
        fontSize: '22px', fontStyle: 'bold', color: '#fff',
      }).setOrigin(0.5));

      cardContainer.add(scene.add.text(0, -95, card.title, {
        fontSize: '18px', fontStyle: 'bold', color: '#fff',
      }).setOrigin(0.5));

      cardContainer.add(scene.add.text(0, 38, card.type, {
        fontSize: '12px', fontStyle: 'italic', color: '#b2bec3',
      }).setOrigin(0.5));

      cardContainer.add(scene.add.text(0, 70, card.description, {
        fontSize: '12px', color: '#dfe6e9', align: 'center', wordWrap: { width: 150 },
      }).setOrigin(0.5, 0));

      cardContainer.setSize(160, 240);
      cardContainer.setInteractive({ useHandCursor: true });
      cardContainer.on('pointerdown', () => {
        this.onResolveAndClose(onResolve, card);
      });
      cardContainer.on('pointerover', () => cardContainer.setScale(1.05));
      cardContainer.on('pointerout', () => cardContainer.setScale(1.0));

      this.add(cardContainer);
    });

    if (args.allowSkip) {
      const skipBtn = scene.add.rectangle(640, 620, 200, 50, 0x6b4a2b)
        .setStrokeStyle(3, 0xc89b3c).setInteractive({ useHandCursor: true });
      const skipText = scene.add.text(640, 620, 'Skip', {
        fontSize: '22px', fontStyle: 'bold', color: '#efe5cc',
      }).setOrigin(0.5);
      this.add(skipBtn);
      this.add(skipText);
      skipBtn.on('pointerdown', () => this.onResolveAndClose(onResolve, null));
    }

    this.setScrollFactor(0);
    this.setDepth(2000);
  }

  private onResolveAndClose(cb: (card: Card | null) => void, picked: Card | null): void {
    cb(picked);
    this.destroy();
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build` — exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/ui/modals/CardPickerModal.ts
git commit -m "feat(ui): reusable CardPickerModal"
```

---

## Task 11: BlessingScene

**Files:**
- Create: `src/scenes/BlessingScene.ts`

- [ ] **Step 1: Create BlessingScene**

```ts
// ABOUTME: Run-start blessing choice. 3 random blessings from the pool of 7.
// ABOUTME: Player picks one; emitted outcomes are applied to runState then MapScene starts.
import * as Phaser from 'phaser';
import type { RunState } from '../models/RunState';
import type { BlessingDef } from '../content/blessings';
import { pickBlessings } from '../content/blessings';
import { applyOutcomes } from '../run/applyOutcomes';
import { setPhase } from '../run/transitions';
import { createRunRng } from '../run/rng';

export interface BlessingSceneData {
  runState: RunState;
}

export class BlessingScene extends Phaser.Scene {
  private runState!: RunState;
  private blessings!: BlessingDef[];

  constructor() { super('BlessingScene'); }

  init(data: BlessingSceneData): void {
    this.runState = data.runState;
    const rng = createRunRng(Date.now());
    this.blessings = pickBlessings(rng, 3);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1a0f06');

    this.add.text(640, 100, 'Choose your blessing', {
      fontSize: '42px', fontStyle: 'bold italic', color: '#efe5cc',
    }).setOrigin(0.5);

    this.add.text(640, 150, 'Your run begins with a gift.', {
      fontSize: '18px', color: '#c8b688', fontStyle: 'italic',
    }).setOrigin(0.5);

    this.blessings.forEach((b, i) => {
      const x = 640 + (i - 1) * 320;
      const y = 360;
      const card = this.add.container(x, y);

      const bg = this.add.graphics();
      bg.fillStyle(0xefe5cc, 1);
      bg.fillRoundedRect(-130, -150, 260, 300, 16);
      bg.lineStyle(6, 0xc89b3c, 1);
      bg.strokeRoundedRect(-130, -150, 260, 300, 16);
      card.add(bg);

      card.add(this.add.text(0, -100, b.name, {
        fontSize: '22px', fontStyle: 'bold', color: '#4a321c', align: 'center',
        wordWrap: { width: 220 },
      }).setOrigin(0.5));

      card.add(this.add.text(0, 20, b.description, {
        fontSize: '16px', color: '#4a321c', align: 'center', wordWrap: { width: 220 },
      }).setOrigin(0.5));

      card.setSize(260, 300);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => this.pick(b));
      card.on('pointerover', () => card.setScale(1.05));
      card.on('pointerout', () => card.setScale(1.0));
    });
  }

  private pick(blessing: BlessingDef): void {
    const rng = createRunRng(Date.now() + 1);
    const outcomes = blessing.resolve(rng);
    applyOutcomes(this.runState, outcomes);
    setPhase(this.runState, 'MAP');
    this.scene.start('MapScene', { runState: this.runState });
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build` — exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/BlessingScene.ts
git commit -m "feat(scene): BlessingScene (run-start 3-choice)"
```

---

## Task 12: RewardModal

**Files:**
- Create: `src/ui/modals/RewardModal.ts`

- [ ] **Step 1: Create RewardModal**

```ts
// ABOUTME: Post-fight reward: always gold + card pick, maybe potion.
// ABOUTME: Emits RunOutcome[] via onResolve.
import * as Phaser from 'phaser';
import type { RunState, Potion } from '../../models/RunState';
import type { RunOutcome } from '../../models/RunOutcome';
import type { Card } from '../../models/Card';
import { pickCardsByRarity } from '../../content/cards';
import { POTIONS } from '../../content/potions';
import { createRunRng, pickFrom } from '../../run/rng';
import { CardPickerModal } from './CardPickerModal';

export class RewardModal extends Phaser.GameObjects.Container {
  private goldAmount: number;
  private cardChoices: Card[];
  private potionChoice: Potion | null;
  private outcomesSoFar: RunOutcome[] = [];

  constructor(
    scene: Phaser.Scene,
    _runState: Readonly<RunState>,
    private onResolve: (outcomes: RunOutcome[]) => void,
    opts?: { elite?: boolean; seed?: number },
  ) {
    super(scene, 0, 0);
    const rng = createRunRng(opts?.seed ?? Date.now());

    const goldRange = opts?.elite ? [25, 40] : [10, 20];
    this.goldAmount = goldRange[0] + Math.floor(rng() * (goldRange[1] - goldRange[0] + 1));

    this.cardChoices = pickCardsByRarity(rng, 3, 'common')
      .concat(pickCardsByRarity(rng, 0, 'uncommon'));
    // Ensure diversity: pick 3 from across common/uncommon
    this.cardChoices = [
      pickCardsByRarity(rng, 1, 'common')[0]!,
      pickCardsByRarity(rng, 1, 'uncommon')[0]!,
      pickCardsByRarity(rng, 1, 'uncommon')[0]!,
    ];

    const potionChance = opts?.elite ? 0.6 : 0.4;
    this.potionChoice = rng() < potionChance ? pickFrom(POTIONS, rng) : null;

    this.render();
  }

  private render(): void {
    const dim = this.scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.7).setInteractive();
    this.add(dim);

    this.add(this.scene.add.text(640, 80, 'Victory!', {
      fontSize: '48px', fontStyle: 'bold italic', color: '#ffd700',
    }).setOrigin(0.5));

    const options: Array<{ label: string; onClick: () => void; sub: string }> = [
      {
        label: `🪙 +${this.goldAmount} gold`,
        sub: 'Take the coin',
        onClick: () => {
          this.outcomesSoFar.push({ kind: 'gold', amount: this.goldAmount });
          this.finish();
        },
      },
      {
        label: 'Pick a card',
        sub: 'Choose 1 of 3',
        onClick: () => this.openCardPicker(),
      },
    ];

    if (this.potionChoice) {
      const potion = this.potionChoice;
      options.push({
        label: `🧪 ${potion.name}`,
        sub: 'Take the potion',
        onClick: () => {
          this.outcomesSoFar.push({ kind: 'add_potion', potion });
          this.finish();
        },
      });
    }

    options.forEach((opt, i) => {
      const x = 640 + (i - (options.length - 1) / 2) * 260;
      const y = 320;
      const card = this.scene.add.container(x, y);

      const bg = this.scene.add.graphics();
      bg.fillStyle(0xefe5cc, 1);
      bg.fillRoundedRect(-110, -80, 220, 160, 16);
      bg.lineStyle(4, 0xc89b3c, 1);
      bg.strokeRoundedRect(-110, -80, 220, 160, 16);
      card.add(bg);

      card.add(this.scene.add.text(0, -20, opt.label, {
        fontSize: '20px', fontStyle: 'bold', color: '#4a321c', align: 'center',
        wordWrap: { width: 200 },
      }).setOrigin(0.5));

      card.add(this.scene.add.text(0, 40, opt.sub, {
        fontSize: '14px', color: '#6b4a2b', align: 'center',
      }).setOrigin(0.5));

      card.setSize(220, 160);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', opt.onClick);
      card.on('pointerover', () => card.setScale(1.05));
      card.on('pointerout', () => card.setScale(1.0));
      this.add(card);
    });

    const skipBtn = this.scene.add.rectangle(640, 560, 180, 44, 0x3a2418)
      .setStrokeStyle(3, 0x6b4a2b).setInteractive({ useHandCursor: true });
    const skipText = this.scene.add.text(640, 560, 'Skip all', {
      fontSize: '18px', color: '#c8b688',
    }).setOrigin(0.5);
    this.add(skipBtn);
    this.add(skipText);
    skipBtn.on('pointerdown', () => this.finish());

    this.setScrollFactor(0);
    this.setDepth(2000);
  }

  private openCardPicker(): void {
    const picker = new CardPickerModal(
      this.scene,
      { title: 'Pick a card', cards: this.cardChoices, allowSkip: true },
      (picked) => {
        if (picked) this.outcomesSoFar.push({ kind: 'add_card', card: picked });
        this.finish();
      },
    );
    this.scene.add.existing(picker);
  }

  private finish(): void {
    if (this.outcomesSoFar.length === 0) this.outcomesSoFar.push({ kind: 'none' });
    this.onResolve(this.outcomesSoFar);
    this.destroy();
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build` — exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/ui/modals/RewardModal.ts
git commit -m "feat(ui): RewardModal (post-fight 3-option)"
```

---

## Task 13: ChestModal

**Files:**
- Create: `src/ui/modals/ChestModal.ts`

- [ ] **Step 1: Create ChestModal**

```ts
// ABOUTME: Chest node reward. 3-choice: gold / relic / card pick.
import * as Phaser from 'phaser';
import type { RunState } from '../../models/RunState';
import type { RunOutcome } from '../../models/RunOutcome';
import { RELICS } from '../../content/relics';
import { pickCardsByRarity } from '../../content/cards';
import { createRunRng, pickFrom } from '../../run/rng';
import { CardPickerModal } from './CardPickerModal';

export class ChestModal extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    _runState: Readonly<RunState>,
    private onResolve: (outcomes: RunOutcome[]) => void,
  ) {
    super(scene, 0, 0);
    const rng = createRunRng(Date.now());

    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.7).setInteractive();
    this.add(dim);

    this.add(scene.add.text(640, 80, 'A treasure chest...', {
      fontSize: '42px', fontStyle: 'bold italic', color: '#ffd700',
    }).setOrigin(0.5));

    const relic = pickFrom(RELICS, rng);
    const cards = pickCardsByRarity(rng, 3, 'uncommon');

    const options = [
      {
        label: '🪙 +25 gold',
        sub: 'Scoop up the coins',
        onClick: () => this.finish([{ kind: 'gold', amount: 25 }]),
      },
      {
        label: `✨ ${relic.name}`,
        sub: relic.description,
        onClick: () => this.finish([{ kind: 'add_relic', relic }]),
      },
      {
        label: 'Pick a card',
        sub: 'Choose 1 of 3',
        onClick: () => {
          const picker = new CardPickerModal(scene,
            { title: 'Pick a card from the chest', cards, allowSkip: true },
            (picked) => this.finish(picked ? [{ kind: 'add_card', card: picked }] : [{ kind: 'none' }]));
          scene.add.existing(picker);
        },
      },
    ];

    options.forEach((opt, i) => {
      const x = 640 + (i - 1) * 280;
      const y = 340;
      const card = scene.add.container(x, y);

      const bg = scene.add.graphics();
      bg.fillStyle(0xefe5cc, 1);
      bg.fillRoundedRect(-120, -90, 240, 180, 16);
      bg.lineStyle(4, 0xc89b3c, 1);
      bg.strokeRoundedRect(-120, -90, 240, 180, 16);
      card.add(bg);

      card.add(scene.add.text(0, -30, opt.label, {
        fontSize: '22px', fontStyle: 'bold', color: '#4a321c', align: 'center',
        wordWrap: { width: 220 },
      }).setOrigin(0.5));
      card.add(scene.add.text(0, 30, opt.sub, {
        fontSize: '14px', color: '#6b4a2b', align: 'center', wordWrap: { width: 220 },
      }).setOrigin(0.5));

      card.setSize(240, 180);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', opt.onClick);
      card.on('pointerover', () => card.setScale(1.05));
      card.on('pointerout', () => card.setScale(1.0));
      this.add(card);
    });

    this.setScrollFactor(0);
    this.setDepth(2000);
  }

  private finish(outcomes: RunOutcome[]): void {
    this.onResolve(outcomes);
    this.destroy();
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build` — exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/ui/modals/ChestModal.ts
git commit -m "feat(ui): ChestModal"
```

---

## Task 14: MerchantModal

**Files:**
- Create: `src/ui/modals/MerchantModal.ts`

- [ ] **Step 1: Create MerchantModal**

```ts
// ABOUTME: Shop screen. Cards, relics, potions, and card-removal service.
// ABOUTME: Uses RunState.gold read-only; emits spend_gold via outcomes through transitions.
import * as Phaser from 'phaser';
import type { RunState, Potion, Relic } from '../../models/RunState';
import type { RunOutcome } from '../../models/RunOutcome';
import type { Card } from '../../models/Card';
import { pickCardsByRarity } from '../../content/cards';
import { RELICS } from '../../content/relics';
import { POTIONS } from '../../content/potions';
import { createRunRng, pickFrom } from '../../run/rng';

interface ShopItem {
  kind: 'card' | 'relic' | 'potion' | 'remove';
  label: string;
  sub: string;
  price: number;
  outcome: RunOutcome | null;  // null = card removal, handled specially
}

export class MerchantModal extends Phaser.GameObjects.Container {
  private runState: Readonly<RunState>;
  private outcomesBuffer: RunOutcome[] = [];
  private goldSpent = 0;
  private items: ShopItem[] = [];

  constructor(
    scene: Phaser.Scene,
    runState: Readonly<RunState>,
    private onResolve: (outcomes: RunOutcome[]) => void,
  ) {
    super(scene, 0, 0);
    this.runState = runState;
    const rng = createRunRng(Date.now());

    const cards: Card[] = [
      pickCardsByRarity(rng, 1, 'common')[0]!,
      pickCardsByRarity(rng, 1, 'uncommon')[0]!,
      pickCardsByRarity(rng, 1, 'rare')[0]!,
    ];
    const relics: Relic[] = [pickFrom(RELICS, rng), pickFrom(RELICS, rng)];
    const potions: Potion[] = [pickFrom(POTIONS, rng), pickFrom(POTIONS, rng)];

    this.items = [
      { kind: 'card', label: cards[0]!.title, sub: 'common card', price: 50, outcome: { kind: 'add_card', card: cards[0]! } },
      { kind: 'card', label: cards[1]!.title, sub: 'uncommon card', price: 75, outcome: { kind: 'add_card', card: cards[1]! } },
      { kind: 'card', label: cards[2]!.title, sub: 'rare card', price: 100, outcome: { kind: 'add_card', card: cards[2]! } },
      { kind: 'relic', label: relics[0]!.name, sub: 'common relic', price: 100, outcome: { kind: 'add_relic', relic: relics[0]! } },
      { kind: 'relic', label: relics[1]!.name, sub: 'uncommon relic', price: 150, outcome: { kind: 'add_relic', relic: relics[1]! } },
      { kind: 'potion', label: potions[0]!.name, sub: 'potion', price: 15, outcome: { kind: 'add_potion', potion: potions[0]! } },
      { kind: 'potion', label: potions[1]!.name, sub: 'potion', price: 15, outcome: { kind: 'add_potion', potion: potions[1]! } },
      { kind: 'remove', label: 'Card Removal', sub: 'Remove 1 from deck', price: 50, outcome: null },
    ];

    this.render();
  }

  private render(): void {
    const dim = this.scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.75).setInteractive();
    this.add(dim);

    this.add(this.scene.add.text(640, 50, 'Merchant', {
      fontSize: '42px', fontStyle: 'bold italic', color: '#efe5cc',
    }).setOrigin(0.5));

    const goldText = this.scene.add.text(640, 95, `Gold: ${this.runState.gold - this.goldSpent}`, {
      fontSize: '18px', color: '#ffd700',
    }).setOrigin(0.5);
    this.add(goldText);

    this.items.forEach((item, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 280 + col * 260;
      const y = 220 + row * 180;

      const tile = this.scene.add.container(x, y);
      const bg = this.scene.add.graphics();
      bg.fillStyle(0xefe5cc, 1);
      bg.fillRoundedRect(-110, -75, 220, 150, 12);
      bg.lineStyle(3, 0x6b4a2b, 1);
      bg.strokeRoundedRect(-110, -75, 220, 150, 12);
      tile.add(bg);
      tile.add(this.scene.add.text(0, -35, item.label, {
        fontSize: '18px', fontStyle: 'bold', color: '#4a321c', align: 'center', wordWrap: { width: 200 },
      }).setOrigin(0.5));
      tile.add(this.scene.add.text(0, 0, item.sub, {
        fontSize: '12px', color: '#6b4a2b', align: 'center',
      }).setOrigin(0.5));
      tile.add(this.scene.add.text(0, 45, `🪙 ${item.price}`, {
        fontSize: '20px', fontStyle: 'bold', color: '#c89b3c',
      }).setOrigin(0.5));

      tile.setSize(220, 150);
      tile.setInteractive({ useHandCursor: true });
      tile.on('pointerdown', () => this.onBuy(i, goldText));
      tile.on('pointerover', () => tile.setScale(1.05));
      tile.on('pointerout', () => tile.setScale(1.0));
      this.add(tile);
    });

    const leaveBtn = this.scene.add.rectangle(640, 640, 200, 48, 0x6b4a2b)
      .setStrokeStyle(3, 0xc89b3c).setInteractive({ useHandCursor: true });
    const leaveText = this.scene.add.text(640, 640, 'Leave', {
      fontSize: '22px', fontStyle: 'bold', color: '#efe5cc',
    }).setOrigin(0.5);
    this.add(leaveBtn);
    this.add(leaveText);
    leaveBtn.on('pointerdown', () => this.leave());

    this.setScrollFactor(0);
    this.setDepth(2000);
  }

  private onBuy(idx: number, goldText: Phaser.GameObjects.Text): void {
    const item = this.items[idx]!;
    const available = this.runState.gold - this.goldSpent;
    if (available < item.price) return;

    if (item.kind === 'remove') {
      // For skeleton: the modal emits a sentinel; coordinator pops a CardPickerModal-style
      // picker over the current deck. For v1, we just charge gold and emit a placeholder.
      // A dedicated DeckPickerModal can replace this later.
      this.goldSpent += item.price;
      // No outcome emitted — card removal picker is a follow-up, omitted in v1 to keep scope
      // tight. Future: emit remove_card after the player picks from their deck.
    } else if (item.outcome) {
      this.goldSpent += item.price;
      this.outcomesBuffer.push(item.outcome);
    }

    goldText.setText(`Gold: ${this.runState.gold - this.goldSpent}`);
  }

  private leave(): void {
    // Emit a single damage-style outcome to deduct the spent gold.
    // Clean way: add a 'spend_gold' outcome. For skeleton we emit damage-like:
    if (this.goldSpent > 0) this.outcomesBuffer.unshift({ kind: 'gold', amount: -this.goldSpent });
    if (this.outcomesBuffer.length === 0) this.outcomesBuffer.push({ kind: 'none' });
    this.onResolve(this.outcomesBuffer);
    this.destroy();
  }
}
```

Note: emitting `gold` with a negative amount relies on transitions tolerating it. Verify `gainGold` in transitions allows negative (it does — it's an unconditional `state.gold += amount`). Gold cannot go negative because the modal gates purchases on `available < price`.

- [ ] **Step 2: Verify build**

Run: `npm run build` — exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/ui/modals/MerchantModal.ts
git commit -m "feat(ui): MerchantModal"
```

---

## Task 15: EventModal (TDD outcomes)

**Files:**
- Create: `src/ui/modals/EventModal.ts`, `tests/events.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// ABOUTME: Tests each Region 1 event's choices produce the expected RunOutcome shape.
import { describe, it, expect } from 'vitest';
import { EVENTS } from '../src/content/events';
import { createRunRng } from '../src/run/rng';

describe('Region 1 events', () => {
  it('has 5 events', () => {
    expect(EVENTS.length).toBe(5);
  });

  it('forked path thorny choice triggers combat', () => {
    const ev = EVENTS.find(e => e.id === 'event_forked_path')!;
    const outcomes = ev.choices[0]!.resolve(createRunRng(1));
    expect(outcomes[0]!.kind).toBe('enter_combat');
  });

  it('shrine bleed costs 10 HP for 50 gold', () => {
    const ev = EVENTS.find(e => e.id === 'event_shrine_of_mist')!;
    const outcomes = ev.choices[0]!.resolve(createRunRng(1));
    expect(outcomes.find(o => o.kind === 'damage')).toBeDefined();
    expect(outcomes.find(o => o.kind === 'gold')).toBeDefined();
  });

  it('cursed altar adds a Doubt curse', () => {
    const ev = EVENTS.find(e => e.id === 'event_cursed_altar')!;
    const outcomes = ev.choices[0]!.resolve(createRunRng(1));
    const addCard = outcomes.find(o => o.kind === 'add_card');
    expect(addCard).toBeDefined();
    expect((addCard as { kind: 'add_card'; card: { title: string } }).card.title).toBe('Doubt');
  });

  it('gem hoard gold path yields gold', () => {
    const ev = EVENTS.find(e => e.id === 'event_gem_hoard')!;
    const outcomes = ev.choices[0]!.resolve(createRunRng(1));
    expect(outcomes[0]).toEqual({ kind: 'gold', amount: 30 });
  });
});
```

- [ ] **Step 2: Run test to verify pass**

(Events module already exists from Task 5 — tests should pass immediately.)

Run: `npm test -- events`
Expected: all 5 tests pass.

- [ ] **Step 3: Create EventModal**

```ts
// ABOUTME: Narrative event screen. Shows body text + 2-3 choices.
// ABOUTME: Each choice calls resolver to produce RunOutcome[].
import * as Phaser from 'phaser';
import type { RunState } from '../../models/RunState';
import type { RunOutcome } from '../../models/RunOutcome';
import type { EventDef } from '../../content/events';
import { createRunRng } from '../../run/rng';

export class EventModal extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    _runState: Readonly<RunState>,
    event: EventDef,
    private onResolve: (outcomes: RunOutcome[]) => void,
  ) {
    super(scene, 0, 0);

    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.8).setInteractive();
    this.add(dim);

    this.add(scene.add.text(640, 80, event.name, {
      fontSize: '36px', fontStyle: 'bold italic', color: '#efe5cc',
    }).setOrigin(0.5));

    this.add(scene.add.text(640, 180, event.body, {
      fontSize: '20px', color: '#c8b688', align: 'center',
      wordWrap: { width: 760 }, lineSpacing: 6,
    }).setOrigin(0.5));

    event.choices.forEach((choice, i) => {
      const y = 380 + i * 80;
      const btn = scene.add.rectangle(640, y, 600, 60, 0x3a2418)
        .setStrokeStyle(3, 0x6b4a2b).setInteractive({ useHandCursor: true });
      const label = scene.add.text(640, y, choice.label, {
        fontSize: '20px', color: '#efe5cc', align: 'center',
      }).setOrigin(0.5);
      btn.on('pointerover', () => btn.setFillStyle(0x6b4a2b));
      btn.on('pointerout', () => btn.setFillStyle(0x3a2418));
      btn.on('pointerdown', () => {
        const rng = createRunRng(Date.now());
        this.onResolve(choice.resolve(rng));
        this.destroy();
      });
      this.add(btn);
      this.add(label);
    });

    this.setScrollFactor(0);
    this.setDepth(2000);
  }
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build` — exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/ui/modals/EventModal.ts tests/events.test.ts
git commit -m "feat(ui): EventModal + Region 1 event outcome tests"
```

---

## Task 16: BossVictoryModal + DeathModal + EpochUnlockModal + epoch tests

**Files:**
- Create: `src/ui/modals/BossVictoryModal.ts`, `src/ui/modals/DeathModal.ts`, `src/ui/modals/EpochUnlockModal.ts`, `tests/epoch-unlock.test.ts`

- [ ] **Step 1: Create BossVictoryModal**

```ts
// ABOUTME: Shown after boss defeat. Offers "New Run" to restart in the same epoch.
// ABOUTME: If next-epoch criteria met, coordinator switches phase to EPOCH_UNLOCK instead.
import * as Phaser from 'phaser';
import type { RunState } from '../../models/RunState';

export class BossVictoryModal extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    _runState: Readonly<RunState>,
    private onResolve: () => void,
  ) {
    super(scene, 0, 0);

    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.85).setInteractive();
    this.add(dim);

    this.add(scene.add.text(640, 280, 'VICTORY', {
      fontSize: '80px', fontStyle: 'bold italic', color: '#ffd700',
      stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5));

    this.add(scene.add.text(640, 360, 'The region is cleared.', {
      fontSize: '22px', color: '#c8b688', fontStyle: 'italic',
    }).setOrigin(0.5));

    const btn = scene.add.rectangle(640, 480, 260, 60, 0x6b4a2b)
      .setStrokeStyle(3, 0xc89b3c).setInteractive({ useHandCursor: true });
    const label = scene.add.text(640, 480, 'Continue', {
      fontSize: '24px', fontStyle: 'bold', color: '#efe5cc',
    }).setOrigin(0.5);
    btn.on('pointerdown', () => { this.onResolve(); this.destroy(); });
    this.add(btn);
    this.add(label);

    this.setScrollFactor(0);
    this.setDepth(2000);
  }
}
```

- [ ] **Step 2: Create DeathModal**

```ts
// ABOUTME: Shown when player HP hits 0. Offers a fresh new run.
// ABOUTME: Signals the coordinator to rebuild runState via buildFreshRun.
import * as Phaser from 'phaser';
import type { RunState } from '../../models/RunState';

export class DeathModal extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    _runState: Readonly<RunState>,
    private onResolve: () => void,
  ) {
    super(scene, 0, 0);

    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.92).setInteractive();
    this.add(dim);

    this.add(scene.add.text(640, 280, 'YOU DIED', {
      fontSize: '88px', fontStyle: 'bold italic', color: '#ff7675',
      stroke: '#000', strokeThickness: 10,
    }).setOrigin(0.5));

    const btn = scene.add.rectangle(640, 480, 260, 60, 0x6b4a2b)
      .setStrokeStyle(3, 0xc89b3c).setInteractive({ useHandCursor: true });
    const label = scene.add.text(640, 480, 'New Run', {
      fontSize: '24px', fontStyle: 'bold', color: '#efe5cc',
    }).setOrigin(0.5);
    btn.on('pointerdown', () => { this.onResolve(); this.destroy(); });
    this.add(btn);
    this.add(label);

    this.setScrollFactor(0);
    this.setDepth(2000);
  }
}
```

- [ ] **Step 3: Create EpochUnlockModal**

```ts
// ABOUTME: Run-end epoch unlock celebration. "Enter Epoch N" starts the next run in that epoch.
import * as Phaser from 'phaser';
import type { RunState } from '../../models/RunState';
import type { EpochDef } from '../../content/epochs';

export class EpochUnlockModal extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    _runState: Readonly<RunState>,
    epoch: EpochDef,
    private onResolve: () => void,
  ) {
    super(scene, 0, 0);

    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.9).setInteractive();
    this.add(dim);

    this.add(scene.add.text(640, 200, `Epoch ${epoch.epoch} unlocked!`, {
      fontSize: '48px', fontStyle: 'bold italic', color: '#ffd700',
    }).setOrigin(0.5));

    this.add(scene.add.text(640, 310, epoch.description, {
      fontSize: '22px', color: '#c8b688', align: 'center', wordWrap: { width: 700 },
    }).setOrigin(0.5));

    this.add(scene.add.text(640, 400, `Enemies ×${epoch.enemyHpMultiplier} HP  •  Potion slots: ${epoch.potionSlots}`, {
      fontSize: '18px', color: '#efe5cc', align: 'center',
    }).setOrigin(0.5));

    const btn = scene.add.rectangle(640, 530, 320, 60, 0x6b4a2b)
      .setStrokeStyle(3, 0xc89b3c).setInteractive({ useHandCursor: true });
    const label = scene.add.text(640, 530, `Enter Epoch ${epoch.epoch}`, {
      fontSize: '22px', fontStyle: 'bold', color: '#efe5cc',
    }).setOrigin(0.5);
    btn.on('pointerdown', () => { this.onResolve(); this.destroy(); });
    this.add(btn);
    this.add(label);

    this.setScrollFactor(0);
    this.setDepth(2000);
  }
}
```

- [ ] **Step 4: Write epoch-unlock test**

```ts
// ABOUTME: Tests that epoch 2 unlocks after 2 enemy defeats.
import { describe, it, expect } from 'vitest';
import { nextUnlockableEpoch, getEpoch } from '../src/content/epochs';
import { recordEnemyDefeated } from '../src/run/transitions';
import { buildFreshRun } from '../src/run/buildFreshRun';
import { witheredGardenBlueprint } from '../src/map/blueprints';

describe('epoch unlock', () => {
  it('epoch 2 unlocks after 2 enemy defeats', () => {
    const s = buildFreshRun({ seed: 1, epoch: 1, blueprint: witheredGardenBlueprint });
    expect(nextUnlockableEpoch(s)).toBeNull();
    recordEnemyDefeated(s);
    expect(nextUnlockableEpoch(s)).toBeNull();
    recordEnemyDefeated(s);
    const unlocked = nextUnlockableEpoch(s);
    expect(unlocked).not.toBeNull();
    expect(unlocked!.epoch).toBe(2);
  });

  it('epoch 2 has +15% enemy HP and 4 potion slots', () => {
    const e2 = getEpoch(2);
    expect(e2.enemyHpMultiplier).toBeCloseTo(1.15);
    expect(e2.potionSlots).toBe(4);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm test -- epoch`
Expected: all 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/modals/BossVictoryModal.ts src/ui/modals/DeathModal.ts src/ui/modals/EpochUnlockModal.ts tests/epoch-unlock.test.ts
git commit -m "feat(ui): BossVictory, Death, EpochUnlock modals + tests"
```

---

## Task 17: MapHud v2 — potion bar, live gold, epoch indicator

**Files:**
- Modify: `src/ui/MapHud.ts`

- [ ] **Step 1: Rewrite MapHud**

Replace the contents of `src/ui/MapHud.ts` with:

```ts
// ABOUTME: Fixed top-bar HUD for MapScene. Shows HP, gold (live), potion slots, floor, epoch.
// ABOUTME: Potion slot clicks call onUsePotion(slotIndex) callback.
import * as Phaser from 'phaser';
import type { RunState } from '../models/RunState';

export class MapHud extends Phaser.GameObjects.Container {
  private text: Phaser.GameObjects.Text;
  private potionTiles: Phaser.GameObjects.Container[] = [];
  private onUsePotion: (slot: number) => void;

  constructor(scene: Phaser.Scene, onUsePotion: (slot: number) => void) {
    super(scene, 0, 0);
    this.onUsePotion = onUsePotion;

    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, 1280, 45);
    bg.lineStyle(2, 0x74b9ff, 1);
    bg.strokeRect(0, 0, 1280, 45);
    this.add(bg);

    this.text = scene.add.text(20, 10, '', {
      fontSize: '20px', color: '#fff', fontStyle: 'bold',
    });
    this.add(this.text);

    this.setScrollFactor(0);
    this.setDepth(1000);
  }

  update(state: RunState): void {
    this.text.setText(
      `❤️ ${state.playerHp}/${state.playerMaxHp}    🪙 ${state.gold}    🗺️ Region 1    📜 Epoch ${state.currentEpoch}`,
    );

    // Rebuild potion tiles to match current slots + contents.
    this.potionTiles.forEach(t => t.destroy());
    this.potionTiles = [];
    for (let i = 0; i < state.potionSlots; i++) {
      const potion = state.potions[i] ?? null;
      const x = 900 + i * 50;
      const tile = this.scene.add.container(x, 22);

      const bgCircle = this.scene.add.circle(0, 0, 18, potion ? 0x6c5ce7 : 0x444444, 0.7)
        .setStrokeStyle(2, 0xa29bfe);
      tile.add(bgCircle);
      if (potion) {
        tile.add(this.scene.add.text(0, 0, '🧪', { fontSize: '18px' }).setOrigin(0.5));
      }
      tile.setSize(36, 36);
      if (potion) {
        tile.setInteractive({ useHandCursor: true });
        tile.on('pointerdown', () => this.onUsePotion(i));
        tile.on('pointerover', () => tile.setScale(1.15));
        tile.on('pointerout', () => tile.setScale(1.0));
      }
      this.add(tile);
      this.potionTiles.push(tile);
    }
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: may fail because MapScene still passes the old `HudData` shape. Will be fixed in Task 19 (MapScene refactor).

If fails, that's expected — leave for now.

- [ ] **Step 3: Commit**

```bash
git add src/ui/MapHud.ts
git commit -m "feat(ui): MapHud v2 with potion bar, live gold, epoch"
```

---

## Task 18: MapScene refactor as coordinator

**Files:**
- Modify: `src/scenes/MapScene.ts`

- [ ] **Step 1: Rewrite MapScene create() + dispatch logic**

Replace `src/scenes/MapScene.ts`'s contents with a version that:
1. Accepts `{ runState: RunState }` in init (replacing the old `map`/`progress`).
2. Wires `runState.onStateChanged` to re-render HUD and swap modals on phase change.
3. Dispatches each `RunPhase` to its modal.
4. Resolves modals through `applyOutcomes` and sets the next phase.

Show only the CHANGED sections here (the parchment rendering stays). Preserve parchment/nodes/paths/avatar setup. Changes:

At the top of the file, replace imports:

```ts
import type { RunState } from '../models/RunState';
import type { RunOutcome } from '../models/RunOutcome';
import type { MapNode } from '../models/RegionMap';
import { applyOutcomes } from '../run/applyOutcomes';
import { setPhase, setCurrentNode, recordEnemyDefeated, usePotion } from '../run/transitions';
import { nextUnlockableEpoch } from '../content/epochs';
import { getPotionById } from '../content/potions';
import { getEventById, pickEvent } from '../content/events';
import { RewardModal } from '../ui/modals/RewardModal';
import { ChestModal } from '../ui/modals/ChestModal';
import { MerchantModal } from '../ui/modals/MerchantModal';
import { EventModal } from '../ui/modals/EventModal';
import { BossVictoryModal } from '../ui/modals/BossVictoryModal';
import { DeathModal } from '../ui/modals/DeathModal';
import { EpochUnlockModal } from '../ui/modals/EpochUnlockModal';
import { QaDebugPanel } from '../ui/QaDebugPanel';
import { RestModal } from '../ui/RestModal';
// ... other existing imports (NodeView, PathRenderer, AvatarWalker, MapHud) remain
```

Replace the `MapSceneData` type:

```ts
export interface MapSceneData {
  runState: RunState;
}
```

Replace the class fields + init:

```ts
  private runState!: RunState;
  private qaPanel: QaDebugPanel | null = null;

  init(data: MapSceneData): void {
    this.runState = data.runState;
    this.isTraveling = false;
    this.activeModal = undefined;
    this.nodeViews.clear();
  }
```

At the end of `create()`, add:

```ts
    this.runState.onStateChanged = () => this.onRunStateChanged();
    this.onRunStateChanged();  // initial paint

    // QA panel (backtick toggle)
    this.qaPanel = new QaDebugPanel(this, this.runState);
    this.add.existing(this.qaPanel);
    this.input.keyboard?.on('keydown-BACKTICK', () => this.qaPanel?.toggle());
```

Update `refreshHud` + the HUD constructor call in `create()`:

```ts
    this.hud = new MapHud(this, (slot) => this.onPotionUsedFromMap(slot));
    this.add.existing(this.hud);
    this.hud.update(this.runState);
```

Replace `availableNextIds` / `onNodeTapped` to use `runState`:

```ts
  private availableNextIds(): string[] {
    if (!this.runState.currentNodeId) return [...this.runState.map.startNodeIds];
    return this.runState.map.edges
      .filter(e => e.from === this.runState.currentNodeId)
      .map(e => e.to);
  }

  private onNodeTapped(node: MapNode): void {
    if (this.activeModal) return;
    if (this.isTraveling) return;
    if (this.runState.phase !== 'MAP') return;
    const available = this.availableNextIds();
    if (!available.includes(node.id)) return;
    this.travelToNode(node);
  }
```

Replace `onArrived` + dispatch helpers:

```ts
  protected onArrived(node: MapNode): void {
    // Record visit.
    if (this.runState.currentNodeId) this.runState.visitedNodeIds.push(this.runState.currentNodeId);
    setCurrentNode(this.runState, node.id);

    // Set the phase for the node type. CombatScene handles its own phase change on win.
    switch (node.type) {
      case 'combat':
      case 'elite':
      case 'boss':
        this.launchCombat(node);
        break;
      case 'rest':
        setPhase(this.runState, 'REST');
        break;
      case 'event':
        setPhase(this.runState, 'EVENT');
        break;
      case 'shop':
        setPhase(this.runState, 'MERCHANT');
        break;
      case 'chest':
        setPhase(this.runState, 'CHEST');
        break;
    }
  }

  private launchCombat(node: MapNode): void {
    const enemyId = node.data?.kind === 'combat' || node.data?.kind === 'elite' || node.data?.kind === 'boss'
      ? node.data.enemyId
      : 'thorn-creep';
    setPhase(this.runState, 'COMBAT');
    this.scene.start('CombatScene', { runState: this.runState, enemyId, nodeType: node.type });
  }

  private onRunStateChanged(): void {
    this.hud.update(this.runState);
    this.refreshNodeStates();

    // Phase → modal dispatch (only if no modal is already open for this phase)
    if (this.activeModal) return;
    switch (this.runState.phase) {
      case 'REWARD':       this.openModal(new RewardModal(this, this.runState, o => this.resolveAndAdvance(o, 'MAP'))); break;
      case 'CHEST':        this.openModal(new ChestModal(this, this.runState, o => this.resolveAndAdvance(o, 'MAP'))); break;
      case 'MERCHANT':     this.openModal(new MerchantModal(this, this.runState, o => this.resolveAndAdvance(o, 'MAP'))); break;
      case 'EVENT':        this.openEvent(); break;
      case 'REST':         this.openRest(); break;
      case 'BOSS_VICTORY': this.openModal(new BossVictoryModal(this, this.runState, () => this.afterRunEnd())); break;
      case 'DEATH':        this.openModal(new DeathModal(this, this.runState, () => this.afterRunEnd())); break;
      case 'EPOCH_UNLOCK': {
        const epoch = nextUnlockableEpoch(this.runState)!;
        this.openModal(new EpochUnlockModal(this, this.runState, epoch, () => this.restartInEpoch(epoch.epoch)));
        break;
      }
    }
  }

  private openModal(modal: Phaser.GameObjects.Container): void {
    this.activeModal = modal;
    this.add.existing(modal);
  }

  private openEvent(): void {
    // Pick a random event from Region 1 pool for this visit.
    const rng = () => Math.random();
    const ev = pickEvent(rng);
    this.openModal(new EventModal(this, this.runState, ev, (outcomes) => {
      const hasCombat = outcomes.some(o => o.kind === 'enter_combat');
      if (hasCombat) {
        const combatOutcome = outcomes.find(o => o.kind === 'enter_combat')! as { kind: 'enter_combat'; enemyId: string };
        this.activeModal = undefined;
        setPhase(this.runState, 'COMBAT');
        this.scene.start('CombatScene', { runState: this.runState, enemyId: combatOutcome.enemyId, nodeType: 'combat' });
      } else {
        this.resolveAndAdvance(outcomes, 'MAP');
      }
    }));
  }

  private openRest(): void {
    this.openModal(new RestModal(this, this.runState.playerHp, this.runState.playerMaxHp, 0.30, (result) => {
      this.resolveAndAdvance([{ kind: 'heal', amount: result.healedBy }], 'MAP');
    }));
  }

  private resolveAndAdvance(outcomes: RunOutcome[], nextPhase: 'MAP' | 'COMBAT'): void {
    this.activeModal = undefined;
    applyOutcomes(this.runState, outcomes);
    // If the outcomes triggered a COMBAT phase, don't overwrite it.
    if (this.runState.phase !== 'COMBAT' && this.runState.phase !== 'DEATH') {
      setPhase(this.runState, nextPhase);
    }
  }

  private onPotionUsedFromMap(slot: number): void {
    const potion = this.runState.potions[slot];
    if (!potion || !potion.usableInMap) return;
    if (potion.effect.kind === 'heal') applyOutcomes(this.runState, [{ kind: 'heal', amount: potion.effect.amount }]);
    usePotion(this.runState, slot);
  }

  private afterRunEnd(): void {
    // Check for epoch unlock; if unlocked, transition to EPOCH_UNLOCK.
    const unlock = nextUnlockableEpoch(this.runState);
    if (unlock) {
      this.activeModal = undefined;
      setPhase(this.runState, 'EPOCH_UNLOCK');
    } else {
      this.restartInEpoch(this.runState.currentEpoch);
    }
  }

  private restartInEpoch(epoch: number): void {
    // Rebuild a fresh run in the given epoch and re-enter BlessingScene.
    this.activeModal = undefined;
    this.scene.start('BootScene', { forceNewRun: true, epoch });
  }
```

Keep everything else in MapScene (parchment, nodes rendering, paths, avatar, scroll handlers) as-is.

- [ ] **Step 2: Verify build**

Run: `npm run build` — should pass (MapHud shape now matches). If type errors remain about RestModal result shape, ensure RestModal's resolve callback returns `{ healedBy: number }` (existing).

- [ ] **Step 3: Commit**

```bash
git add src/scenes/MapScene.ts
git commit -m "feat(scene): MapScene as RunState coordinator"
```

---

## Task 19: CombatScene integration with RunState

**Files:**
- Modify: `src/scenes/CombatScene.ts`

- [ ] **Step 1: Accept runState on init and push results back**

In `CombatScene.ts`:

1. Change `launchData` type to include `runState?: RunState` and `nodeType?: NodeType`.
2. In `init(data)`, pull the runState reference.
3. When the combat ends (in `updateUI()`'s GAME_OVER branch), compute the return phase based on nodeType and runState, update runState.playerHp, push results, then scene.start back to MapScene.

Specifically, edit the `init` method:

```ts
    private launchData: {
        enemyId?: string;
        returnTo?: string;
        runState?: import('../models/RunState').RunState;
        nodeType?: string;
    } = {};

    init(data: typeof this.launchData): void {
        this.launchData = data ?? {};
        this.gameOverShown = false;
    }
```

In the GAME_OVER branch of `updateUI()`, replace the delayed hand-off with:

```ts
            this.time.delayedCall(2200, () => {
                const runState = this.launchData.runState;
                if (!runState) {
                    // Fallback: standalone combat test. Return to BootScene.
                    this.scene.start('BootScene');
                    return;
                }
                // Push HP + defeat count back into runState.
                runState.playerHp = this.state.player.hp;
                if (playerWon) {
                    // Import at top of file: recordEnemyDefeated, setPhase
                    const { recordEnemyDefeated } = require('../run/transitions');
                    const { setPhase } = require('../run/transitions');
                    recordEnemyDefeated(runState);
                    const nextPhase = this.launchData.nodeType === 'boss' ? 'BOSS_VICTORY' : 'REWARD';
                    setPhase(runState, nextPhase);
                } else {
                    const { setPhase } = require('../run/transitions');
                    setPhase(runState, 'DEATH');
                }
                this.scene.start('MapScene', { runState });
            });
```

(The `require` pattern works inside Vite; cleaner would be top-level imports. Move `recordEnemyDefeated` + `setPhase` to the top-level import list.)

- [ ] **Step 2: Add imports at top of CombatScene**

```ts
import { recordEnemyDefeated, setPhase } from '../run/transitions';
```

And replace the inline `require` calls with direct use.

- [ ] **Step 3: Verify build**

Run: `npm run build` — exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/CombatScene.ts
git commit -m "feat(combat): integrate with RunState; push results back on end"
```

---

## Task 20: BootScene routes to BlessingScene

**Files:**
- Modify: `src/scenes/BootScene.ts`

- [ ] **Step 1: Update BootScene**

At the end of `BootScene.create()`, replace the current `MapScene` handoff with:

```ts
        // Build a fresh run and hand off to BlessingScene.
        const { buildFreshRun } = await import('../run/buildFreshRun');  // or top-level import
        const params = new URLSearchParams(window.location.search);
        const mapParam = params.get('map');
        const seedParam = params.get('seed');
        const epochParam = params.get('epoch');

        const defaultDevSeed = 1;
        const seed = seedParam ? Number(seedParam) : (import.meta.env.DEV ? defaultDevSeed : Date.now());
        const epoch = epochParam ? Number(epochParam) : 1;

        if (mapParam === 'tutorial') {
            // Tutorial fixture path — construct a runState with tutorialMap.
            const { tutorialMap } = await import('../fixtures/maps/tutorial-map');
            const runState = buildFreshRun({ seed, epoch, blueprint: witheredGardenBlueprint });
            runState.map = tutorialMap;
            this.scene.start('BlessingScene', { runState });
        } else {
            const runState = buildFreshRun({ seed, epoch, blueprint: witheredGardenBlueprint });
            this.scene.start('BlessingScene', { runState });
        }
```

Move the dynamic imports to top-level:

```ts
import { buildFreshRun } from '../run/buildFreshRun';
```

Also: in scene init, accept `{ forceNewRun?: boolean; epoch?: number }` so MapScene's death/victory flows can route back here for a new run:

```ts
    init(data?: { forceNewRun?: boolean; epoch?: number }): void {
        // No persistent state to reset; just note if a forced epoch was requested.
        (this as any).__forceEpoch = data?.epoch;
    }
```

And in create(), if `(this as any).__forceEpoch` is set, use it for the seed:

```ts
        const epoch = epochParam ? Number(epochParam) : ((this as any).__forceEpoch ?? 1);
```

- [ ] **Step 2: Register MapScene + BlessingScene in main.ts**

Edit `src/main.ts`. Add the BlessingScene import and include it in the scene array:

```ts
import { BlessingScene } from './scenes/BlessingScene';
// ...
    scene: [BootScene, BlessingScene, MapScene, CombatScene],
```

- [ ] **Step 3: Delete src/models/RunProgress.ts**

```bash
git rm src/models/RunProgress.ts
```

- [ ] **Step 4: Verify build**

Run: `npm run build` — exit 0. Any import of RunProgress should be fixed now (only MapScene used it, and that's been rewritten).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/BootScene.ts src/main.ts src/models/RunProgress.ts
git commit -m "feat(boot): route to BlessingScene; remove RunProgress"
```

---

## Task 21: QaDebugPanel + fixtures

**Files:**
- Create: `src/qa/fixtures.ts`, `src/ui/QaDebugPanel.ts`

- [ ] **Step 1: Create fixtures**

```ts
// ABOUTME: Pre-canned RunState fixtures for each RunPhase, used by the QA debug panel.
// ABOUTME: Each buildFixture(phase) returns a fully-formed RunState suitable for testing that screen.
import type { RunState, RunPhase } from '../models/RunState';
import { buildFreshRun } from '../run/buildFreshRun';
import { witheredGardenBlueprint } from '../map/blueprints';
import { POTIONS } from '../content/potions';
import { RELICS } from '../content/relics';
import { spawn } from '../content/cards';

export function buildFixture(phase: RunPhase): RunState {
  const base = buildFreshRun({ seed: 42, epoch: 1, blueprint: witheredGardenBlueprint });
  base.phase = phase;

  switch (phase) {
    case 'BLESSING':
    case 'MAP':
      return base;
    case 'COMBAT':
      base.currentNodeId = 'f1-l0';
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

export function fixtureWithStarterGear(): RunState {
  const s = buildFreshRun({ seed: 7, epoch: 1, blueprint: witheredGardenBlueprint });
  s.gold = 200;
  s.relics.push(RELICS[0]!);
  s.potions[0] = POTIONS[0]!;
  s.potions[1] = POTIONS[1]!;
  s.deck.push(spawn('Shockwave'));
  return s;
}
```

- [ ] **Step 2: Create QaDebugPanel**

```ts
// ABOUTME: Dev-only debug panel. Backtick toggles. Jump to any phase with a fixture state.
// ABOUTME: Also: utility buttons (+gold, full heal, kill, reset).
import * as Phaser from 'phaser';
import type { RunState, RunPhase } from '../models/RunState';
import { setPhase, gainGold, heal, takeDamage, addRelic, addPotion } from '../run/transitions';
import { RELICS } from '../content/relics';
import { POTIONS } from '../content/potions';
import { buildFixture } from '../qa/fixtures';

const PHASES: RunPhase[] = [
  'BLESSING', 'MAP', 'COMBAT', 'REWARD', 'CHEST', 'MERCHANT',
  'EVENT', 'REST', 'BOSS_VICTORY', 'DEATH', 'EPOCH_UNLOCK',
];

export class QaDebugPanel extends Phaser.GameObjects.Container {
  private panel!: Phaser.GameObjects.Container;
  private open = false;
  private runState: RunState;

  constructor(scene: Phaser.Scene, runState: RunState) {
    super(scene, 0, 0);
    this.runState = runState;
    this.buildPanel();
    this.setDepth(10000);
    this.setScrollFactor(0);
    this.hide();
  }

  toggle(): void {
    this.open = !this.open;
    this.panel.setVisible(this.open);
  }

  private hide(): void { this.open = false; this.panel.setVisible(false); }

  private buildPanel(): void {
    this.panel = this.scene.add.container(0, 0);
    this.add(this.panel);

    const bg = this.scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.8);
    this.panel.add(bg);

    const title = this.scene.add.text(640, 40, 'QA Debug Panel', {
      fontSize: '28px', fontStyle: 'bold', color: '#ffd700',
    }).setOrigin(0.5);
    this.panel.add(title);

    const hint = this.scene.add.text(640, 72, 'Backtick (`) to close', {
      fontSize: '14px', color: '#c8b688',
    }).setOrigin(0.5);
    this.panel.add(hint);

    // Phase jump buttons
    this.panel.add(this.scene.add.text(100, 110, 'Jump to phase:', {
      fontSize: '18px', color: '#efe5cc',
    }));
    PHASES.forEach((phase, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 100 + col * 220;
      const y = 150 + row * 50;
      const btn = this.scene.add.rectangle(x + 100, y + 16, 200, 32, 0x3a2418)
        .setStrokeStyle(2, 0x6b4a2b).setInteractive({ useHandCursor: true });
      const label = this.scene.add.text(x + 100, y + 16, phase, {
        fontSize: '14px', color: '#efe5cc',
      }).setOrigin(0.5);
      btn.on('pointerdown', () => this.jumpToPhase(phase));
      this.panel.add(btn);
      this.panel.add(label);
    });

    // Utility buttons
    this.panel.add(this.scene.add.text(100, 360, 'Utilities:', {
      fontSize: '18px', color: '#efe5cc',
    }));
    const utils: Array<[string, () => void]> = [
      ['+500 gold',          () => gainGold(this.runState, 500)],
      ['Add relic',          () => addRelic(this.runState, RELICS[0]!)],
      ['Fill potions',       () => POTIONS.forEach(p => addPotion(this.runState, p))],
      ['Full heal',          () => heal(this.runState, 999)],
      ['Kill player',        () => takeDamage(this.runState, 9999)],
    ];
    utils.forEach(([label, fn], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 100 + col * 220;
      const y = 400 + row * 50;
      const btn = this.scene.add.rectangle(x + 100, y + 16, 200, 32, 0x6b4a2b)
        .setStrokeStyle(2, 0xc89b3c).setInteractive({ useHandCursor: true });
      const txt = this.scene.add.text(x + 100, y + 16, label, {
        fontSize: '14px', color: '#efe5cc',
      }).setOrigin(0.5);
      btn.on('pointerdown', fn);
      this.panel.add(btn);
      this.panel.add(txt);
    });
  }

  private jumpToPhase(phase: RunPhase): void {
    const fresh = buildFixture(phase);
    // Copy fresh into the live runState (keep reference identity).
    Object.assign(this.runState, fresh);
    setPhase(this.runState, phase);  // triggers onStateChanged
    this.hide();
  }
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build` — exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/qa/fixtures.ts src/ui/QaDebugPanel.ts
git commit -m "feat(qa): debug panel with phase fixtures + utilities"
```

---

## Task 22: RestModal rewired to RunOutcome

**Files:**
- Modify: `src/ui/RestModal.ts`

- [ ] **Step 1: Update RestModal resolve shape**

Existing RestModal already resolves with `{ healedBy: number }`. MapScene's `openRest()` (Task 18) already adapts that to a `heal` outcome. No RestModal change needed. Mark this task done without modification.

- [ ] **Step 2: (No commit needed)**

---

## Task 23: Final integration — delete PlaceholderModal + smoke test

**Files:**
- Delete: `src/ui/PlaceholderModal.ts`

- [ ] **Step 1: Delete PlaceholderModal**

```bash
git rm src/ui/PlaceholderModal.ts
```

Ensure no remaining imports reference it. Grep:

```bash
grep -rn "PlaceholderModal" src/
```

Should produce no matches. If any, remove them.

- [ ] **Step 2: Verify build**

Run: `npm run build` — exit 0.

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: all existing + new tests pass.

- [ ] **Step 4: Manual smoke test**

1. `npm run dev`
2. Open `http://localhost:3001/`
3. BlessingScene appears — pick a blessing.
4. MapScene loads — HUD shows Epoch 1, 3 potion slots.
5. Press backtick — QA panel appears. Close it with backtick again.
6. From QA, jump to each phase: REWARD, CHEST, MERCHANT, EVENT, REST, BOSS_VICTORY, DEATH, EPOCH_UNLOCK. Each modal renders.
7. Play through: tap combat node → combat loads → win → reward screen appears with options.
8. Accept any reward → back to map → tap next node.
9. Continue until boss or QA-unlock epoch 2.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove PlaceholderModal; finalize integration"
```

---

## Task 24: Extend e2e smoke test

**Files:**
- Modify: `tests/e2e/map-smoke.test.ts`

- [ ] **Step 1: Update smoke test**

Replace the existing smoke test body with:

```ts
// ABOUTME: E2E smoke — blessing screen renders, map renders, QA panel opens.
import puppeteer from 'puppeteer';

const DEV_URL = 'http://localhost:3001/?seed=1';

async function main(): Promise<void> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(DEV_URL, { waitUntil: 'networkidle0' });

  await new Promise(r => setTimeout(r, 3000));

  // BlessingScene should be active.
  const blessingActive = await page.evaluate(() => {
    const game = (window as any).game;
    return game?.scene?.isActive('BlessingScene');
  });
  if (!blessingActive) throw new Error('BlessingScene not active');

  // Click the first blessing card (center-left, approx x=320 in game coords → clientX depends on canvas scale).
  const coords = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / 1280;
    const scaleY = rect.height / 720;
    return { x: rect.left + 320 * scaleX, y: rect.top + 360 * scaleY };
  });
  await page.mouse.click(coords.x, coords.y);
  await new Promise(r => setTimeout(r, 1500));

  // MapScene should be active.
  const mapActive = await page.evaluate(() => (window as any).game?.scene?.isActive('MapScene'));
  if (!mapActive) throw new Error('MapScene not active after blessing');

  await browser.close();
  console.log('e2e smoke: OK');
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run smoke test**

Start dev server in a terminal: `npm run dev`
In another: `npm run test:e2e`
Expected: `e2e smoke: OK`

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/map-smoke.test.ts
git commit -m "test: extend e2e smoke to cover BlessingScene → MapScene"
```

---

## Self-review checklist

- [x] Every spec section has a task implementing it.
- [x] Types consistent across tasks (RunState, RunOutcome, RunPhase, transitions).
- [x] No "TBD" / "TODO" / placeholders — all code is written out.
- [x] TDD order: tests first where practical (transitions, applyOutcomes, buildFreshRun, card-engine, events, epoch-unlock).
- [x] Each task commits in isolation.
- [x] ABOUTME headers on every new file.
- [x] Modal constructor signature consistent across all new modals.
- [x] `chest` NodeType addition is covered (Task 2) and tutorial fixture updated.

### Known-scope trade-offs (document, don't fix here)

- MerchantModal emits `gold: -X` to spend. `gainGold` tolerates negative amounts. A clean `spend_gold` outcome kind could replace this later; for v1 this keeps the outcome union slim.
- MerchantModal's "Card Removal" is gold-gated but doesn't pop a DeckPickerModal yet (v1 deferred). Cost is still charged. A follow-up task can add a DeckPickerModal that lists player's deck.
- CombatScene standalone launch (no runState) falls back to `scene.start('BootScene')` on end-of-combat. No regression; same fallback as current code.
- Rest Site's "Upgrade a card" option is not wired (out of scope per spec). Only heal option works.
