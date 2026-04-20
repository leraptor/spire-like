# Tower of Mirrors — Game Design Specification

## Overview

Tower of Mirrors is a single-player roguelike deck-building card combat game in the style of Slay the Spire. It is built with Phaser 3 and TypeScript, runs as a web app (and eventually as an embedded view in a Capacitor-based iOS app), and serves as the meta-game layer for a separate longevity/healthy habits app called "Antigravity Longevity."

The core idea: players earn currencies by completing healthy habits in real life (exercise, sleep, nutrition, meditation), then spend those currencies to grow stronger in the card game. Dying in the card game drives engagement back to the health app, because the player needs to accumulate more resources before their next run. The card game is the reward and spending mechanism; the health app is the earning mechanism.

The visual identity is inspired by Studio Ghibli's magical realism — warm, painterly, emotionally rich. Not pixel art, not dark fantasy, not anime. Think Spirited Away, Howl's Moving Castle, Princess Mononoke.

### The Narrative Frame

The longevity app uses a narrative concept called "The Green Door" — a portal that opens onto multiple mirrors/doors, each showing a different version of your future self. The version where you neglect your health leads to a withered, dying world. The version where you invest in your health leads to a vibrant, thriving one.

The card game literalizes this: you are climbing a tower, and each region you conquer represents a version of your future becoming more alive. The world gets more beautiful as you ascend — not darker. This is the Ghibli inversion of the typical dungeon crawler: instead of the environment getting scarier, it gets more lush and vibrant, but the challenge grows because what you're protecting matters more.

### Target Audience

Users of the Antigravity Longevity health app. These are health-conscious adults who may not be hardcore gamers. The game must be engaging and rewarding without being punishing or requiring deep genre knowledge. Casual-friendly roguelike — closer to Capybara Go than Slay the Spire in terms of accessibility, but with real strategic depth for players who want it.

---

## Game Loop & Progression

### The Tower — 4 Regions

The tower has 4 regions stacked vertically, each with 5 floors. Total: 20 floors.

| Region | Name | Theme | Visual Identity |
|--------|------|-------|-----------------|
| 1 (bottom) | The Withered Garden | Overgrown, fading, entropy winning | Muted greens and browns, wilting flora, cracked stone, faint golden light breaking through |
| 2 | The Mist Woods | Mysterious, half-alive, things waking up | Cool blues and silvers, drifting fog, bioluminescent plants |
| 3 | The Living Peaks | Vibrant, challenging, the future becoming real | Bright greens and warm golds, waterfalls, living stone, lush canopy |
| 4 (top) | The Summit / The Mirror | Full bloom, you face your ultimate self | Radiant light, crystalline structures, flowers everywhere, mirror at the peak |

**v1 scope: Region 1 (The Withered Garden) only, with all systems fully built.** Regions 2-4 are content expansions that slot into the existing systems.

### Region-Based Progression

- Each region has 5 floors arranged as a vertical branching map (Slay the Spire style).
- The player starts at the bottom of a region and works upward to the boss at floor 5.
- **Die → restart the current region from floor 1.** The player loses all in-run cards, relics, gold, and potions. They keep all permanent progression (Seed Cards, character upgrades, region clears).
- **Beat the region boss → region permanently cleared.** The next region unlocks. The player never has to redo a cleared region (though they can re-enter for fun/grinding).
- This creates a middle ground between full-restart roguelike (too punishing for casual health app users) and simple checkpoint resume (no tension). Within each region, there's genuine roguelike tension over 5 floors. Across regions, there's permanent visible progress.

### A Typical Session

1. Player opens the game → sees the World Map (tower with 4 region bands).
2. Region 1 is active (glowing). Regions 2-4 are locked (silhouetted).
3. Player taps Region 1 → sees the branching floor map (generated fresh for this run).
4. Player picks a path through 5 floors: combat encounters, events, shops, rest sites.
5. Player fights the boss on floor 5.
6. **If they win:** Region 1 is permanently cleared. Region 2 unlocks. Back to World Map with Region 2 now active.
7. **If they die:** Back to World Map. Region 1 is still active. Player returns to the longevity app, does healthy habits for a few days, earns more AMS and stars, comes back to the card game stronger.

### Run Initialization

When the player starts a new run in a region:
1. The player chooses how much AMS to invest (25/50/75/100, capped at 100 and limited by bank balance). The chosen amount converts to starting gold (1 AMS = 1 gold). Only the invested portion is deducted from the bank; the remainder stays banked for future runs.
2. Seed Card power levels are snapshotted from the player's current habit streaks in the longevity app. These levels are locked for the duration of the run.
3. The starting deck is assembled: 10 cards (base starters with any unlocked Seed Cards replacing their corresponding starters).
4. Player HP is set to their max HP (75 base + any star-purchased upgrades).
5. Player energy is set to 3 (fixed — no permanent energy upgrades exist).
6. Potion slots are empty (3 base + any star-purchased upgrades).
7. Gold is set to the converted AMS amount + any starting gold bonus from star upgrades.
8. A fresh branching map is procedurally generated for the region.
9. The run state is written to Firestore as `activeRun` for save/resume capability.

---

## Currency Bridge — Longevity App ↔ Card Game

### Stars (Permanent Currency)

**Earning:** Stars are earned in the longevity app from milestone achievements. These are significant accomplishments like completing a 7-day streak, hitting a longevity score threshold, or completing a specific health protocol. Stars are infrequent and valuable.

**Spending:** Stars are spent in the Between-Runs Shop (accessible from the World Map, not during runs). Purchases are permanent and persist forever across all future runs.

**What stars buy:**
- **Seed Cards:** Unlock new Seed Cards (one per habit category). Costs vary: 30-80 stars per card.
- **Character upgrades:**
  - Max HP +5 (costs 30 ★, repeatable 3 times: 75→80→85→90)
  - Card Reward +1 (costs 80 ★, one-time: see 4 card options at rewards instead of 3 — better draft quality without warping combat math)
  - Potion Slot +1 (costs 60 ★, one-time: 3→4)
  - Starting Gold Bonus +10 (costs 40 ★, repeatable 3 times: +0→+10→+20→+30)
  - Note: a permanent energy upgrade (+1 energy per turn) is deliberately excluded. A 33% energy increase would require balancing all future regions for two different energy levels. The Ember Seed relic provides a first-turn energy boost as a run-specific reward instead.

### AMS — Age Minutes Saved (Run Currency)

**Earning:** AMS is earned daily in the longevity app by completing healthy habits. Each habit has an `amsBase` value (2-23 AMS depending on the habit's impact and evidence grade). AMS accumulates in a bank over days/weeks.

**Spending:** At run start, the player **chooses how much AMS to invest** in the run. A simple selection screen presents preset options:

```
"How much to invest in this run?"
[25 AMS]  [50 AMS]  [75 AMS]  [100 AMS]
         Bank: 340 AMS remaining
```

The chosen amount converts to starting gold (1 AMS = 1 gold), capped at 100 per run. The deducted AMS is removed from the bank; the remainder stays safely banked for future runs. Gold is spent at in-run shops to buy cards, relics, potions, and card removal during the run.

This gives the player agency over their own risk. A cautious player can do low-stakes 25g runs while saving up. A confident player can go all-in at 100g. The cap prevents trivialization (can't dump 500 AMS into one run), and the choice prevents devastating loss (the player decided how much to risk).

**On death:** All gold (spent and unspent) is lost. Only the invested portion of AMS was consumed — the rest remains banked. A player who invested 50 AMS and dies with 20 unspent gold loses all 50 AMS worth of gold. This makes the investment choice meaningful.

**The loop:**
```
Do habits daily → earn AMS + occasionally stars
         ↓
Start a card game run (AMS → starting gold)
         ↓
Play through 5 floors (spend gold at shops)
         ↓
Win → region cleared, unlock next region
Die → return to habits, earn more AMS/stars
         ↓
Spend stars on permanent upgrades in Between-Runs Shop
         ↓
Start next run stronger (better cards, more gold, higher stats)
```

### Technical Bridge

Both apps share the same Firebase backend. The longevity app already uses Firestore with a `users/{userId}` document structure.

**Firestore document additions:**

```
users/{userId}/
├── ... (existing longevity app data)
│
├── gameProfile/                    # Permanent game progression
│   ├── stars: number               # Current star balance
│   ├── amsBank: number             # Accumulated AMS not yet spent on a run
│   ├── unlockedSeedCards: string[] # e.g. ['sunstride', 'still-waters']
│   ├── upgrades: {
│   │   maxHpBonus: number          # 0, 5, 10, or 15
│   │   cardRewardBonus: number     # 0 or 1 (see 4 card options instead of 3)
│   │   potionSlotBonus: number     # 0 or 1
│   │   startingGoldBonus: number   # 0, 10, 20, or 30
│   │ }
│   ├── regionClears: string[]      # e.g. ['withered-garden']
│   ├── streaks: {                  # Snapshotted from longevity app habit data
│   │   movement: number            # Current streak in days
│   │   recovery: number
│   │   nutrition: number
│   │   maintenance: number
│   │ }
│   └── runHistory: [               # Past run records for stats tracking
│       {
│         runId: string,
│         regionId: string,
│         result: 'victory' | 'death',
│         floorsReached: number,
│         enemiesDefeated: number,
│         cardsPlayed: number,
│         damageDealt: number,
│         date: timestamp
│       }
│     ]
│
├── activeRun/                      # Current in-progress run (null if none)
│   ├── runId: string
│   ├── regionId: string
│   ├── map: serialized RegionMap
│   ├── currentNodeId: string
│   ├── visitedNodeIds: string[]
│   ├── playerHp: number
│   ├── playerMaxHp: number
│   ├── playerGold: number
│   ├── playerEnergy: number
│   ├── deck: serialized Card[]
│   ├── upgradedCardIds: string[]
│   ├── relics: serialized Relic[]
│   ├── potions: serialized (Potion | null)[]
│   ├── seedCardLevels: Record<string, number>
│   └── phase: RunPhase
```

**Sync flow:**
1. **Game launch:** Read `gameProfile` and `activeRun` from Firestore. If `activeRun` exists, offer to resume. Otherwise, show World Map.
2. **Run start:** Read latest `streaks` from longevity app data. Snapshot `amsBank` as starting gold (then zero out `amsBank`). Write initial `activeRun`.
3. **During run:** After every state change (node completion, card reward, shop purchase, etc.), write updated `activeRun` to Firestore. This enables save/resume if the player closes the game.
4. **Run end (death):** Delete `activeRun`. Append to `runHistory`.
5. **Run end (victory):** Delete `activeRun`. Append to `runHistory`. Add region to `regionClears`.
6. **Star purchases:** Deduct from `stars`, update `unlockedSeedCards` or `upgrades`. Immediate write.
7. **Longevity app side:** When user completes a habit, the longevity app writes AMS to `gameProfile.amsBank`. When user earns stars, writes to `gameProfile.stars`.

**Offline handling:**
- The game is playable offline for an active run (all game logic is client-side).
- Run state is cached locally (localStorage or IndexedDB) as a fallback.
- On reconnection, local state syncs to Firestore.
- Star shop and run initialization require connectivity (must read latest profile).

---

## Seed Cards

### Concept

Seed Cards are permanent cards earned from the longevity app that are always in the player's starting deck. Their power scales with the player's real-world habit streaks. A player who exercises daily for 30 days has a stronger Movement Seed Card than someone with a 3-day streak.

This is the strongest link between the two apps: your cards literally grow because you showed up in real life.

### The 4 Seed Cards

Each maps to one of the longevity app's habit categories.

**Sunstride (Movement category)**
- Type: Attack
- Cost: 1 energy
- Base effect (no streak): Deal 5 damage to a single enemy
- 7-day streak: Deal 7 damage to a single enemy
- 30-day streak: Deal 9 damage to a single enemy + draw 1 card
- Linked habits: Zone 2 Walk, strength training, HIIT, yoga, any exercise-tagged habit

**Still Waters (Recovery category)**
- Type: Skill
- Cost: 1 energy
- Base effect (no streak): Gain 4 block
- 7-day streak: Gain 6 block
- 30-day streak: Gain 8 block + heal 2 HP
- Linked habits: Sleep Wind Down, cold shower, sauna, NSDR, meditation (recovery-tagged)

**Root Feast (Nutrition category)**
- Type: Power
- Cost: 2 energy
- Base effect (no streak): Gain 2 Strength. Exhaust.
- 7-day streak: Gain 3 Strength. Exhaust.
- 30-day streak: Cost reduced to 1 energy. Gain 3 Strength. Exhaust. Innate (always starts in your opening hand). A guaranteed, cheap Turn-1 Strength buff is a massive power spike without the game-breaking infinite scaling of a non-exhausting Strength card.
- Linked habits: Protein Meal, supplements, hydration, diet-tagged habits

**Inner Light (Maintenance category)**
- Type: Skill
- Cost: 1 energy
- Base effect (no streak): Draw 2 cards
- 7-day streak: Draw 2 cards + gain 1 energy
- 30-day streak: Draw 3 cards + gain 1 energy
- Linked habits: Meditation, journaling, gratitude, social connection, maintenance-tagged habits

### Streak Tracking

- The longevity app already tracks behavior history per day (which tasks were completed).
- A "streak" for a category = consecutive days where at least one habit in that category was completed.
- At run start, the game snapshots each category's current streak from Firestore.
- Seed Card power level is locked for the duration of the run (no mid-run changes if your streak breaks or extends).

### Streak Tier Thresholds

- **Base tier:** 0-6 days streak (or Seed Card just unlocked)
- **Tier 2:** 7-29 days streak
- **Tier 3:** 30+ days streak

### Wilting Grace Period

Missing a day does NOT immediately break a streak. Instead, Seed Cards use a forgiving "wilting" system designed for a health app audience (people get sick, travel, have bad days):

- **Miss 1 day:** The Seed Card enters a "Wilting" state. Visual change only (glowing particles fade, leaves look dry). No mechanical change — the streak tier is preserved. If the player resumes the habit the next day, the card blooms back to full health and the streak continues unbroken.
- **Miss 2 consecutive days:** Still wilting. Still no tier drop. The visual wilting intensifies slightly.
- **Miss 3 consecutive days:** The Seed Card drops ONE tier (not to base — just one step down). A Tier 3 card drops to Tier 2. A Tier 2 card drops to Tier 1/base. The streak counter resets.
- **Resuming after a drop:** The streak begins counting again from 0. The player needs to rebuild to the next tier threshold (7 or 30 days).

This grace period prevents the Duolingo-style streak anxiety that drives users away from habit apps. A health app that mechanically punishes users for getting the flu is counterproductive. The wilting visual is a gentle nudge, not a slap.

### Unlocking Seed Cards

- Players start with 0 Seed Cards.
- Each Seed Card costs stars in the Between-Runs Shop:
  - Sunstride: 30 ★
  - Still Waters: 30 ★
  - Root Feast: 50 ★
  - Inner Light: 50 ★
- **Seed Cards replace starter cards, not add to them.** When a player unlocks Sunstride, it permanently replaces one Strike in the starter deck. When they unlock Still Waters, it replaces a Defend. Root Feast replaces a Strike. Inner Light replaces a Defend. The deck size stays at 10 — quality improves without diluting draw consistency.
- The game is playable without any Seed Cards (the base 10-card starter deck works). Seed Cards are a meaningful upgrade, not a requirement.
- Recommended unlock order (by value): Sunstride or Still Waters first (cheap, immediately useful), then Root Feast or Inner Light (more expensive, more powerful).

### Visual Identity

- Seed Cards have a **living vine border** — subtle animation where leaves shift, buds pulse, and the vine grows more lush at higher streak tiers.
- Base tier: sparse, dry-looking vines with few leaves.
- Tier 2: green vines with small leaves and occasional buds.
- Tier 3: lush, flowering vines with glowing particles.
- This is visually distinct from regular cards, which have a parchment/wood border.
- When a Seed Card is played in combat, vine tendrils briefly extend from the card before retracting (0.5s animation).

---

## Content Unlock System

### Overview

The game uses a progressive unlock system inspired by Slay the Spire's ascension model. Not all content is available from the first run. As the player progresses through the game AND the longevity app, new cards, relics, potions, and events are unlocked and added to the regional pools. This means each run draws from an ever-expanding set of possibilities.

This serves three purposes:
1. **New players aren't overwhelmed.** A first run offers a small, learnable set of cards and relics. Decision-making is simpler.
2. **Veterans keep discovering.** A player on their 20th run is still encountering new cards and relics they haven't seen before.
3. **The health app has infinite hooks.** Every longevity milestone can unlock something new in the game world, giving the health app a continuous stream of meaningful rewards.

### Starting Pool vs. Unlockable Content

**Starting pool (~60% of Region 1 content):** Available from the very first run. Primarily common and uncommon items that teach core mechanics.

**Unlockable content (~40% of Region 1 content):** Rare and legendary items that get added to the pool over time. Once unlocked, they have a *chance* to appear in future runs as card rewards, shop items, or event discoveries. Unlocking an item doesn't give it to you — it makes it *possible* to encounter.

**Region 1 starting pool:**

*Cards (available from run 1):*
- All starter cards (Strike, Defend, Mega, Flow)
- Vine Lash, Bark Skin, Shed (common cards)
- Thorn Burst, Mist Veil (uncommon cards)

*Cards (unlockable):*
- Reclaim, Dig In (uncommon — unlocked via game achievements)
- Empower, Shockwave (uncommon — unlocked via game achievements)
- Overgrowth, Photosynthesis (rare — unlocked via longevity app milestones or boss victories)

*Relics (available from run 1):*
- Wilted Crown, Morning Dew, Mossy Compass, Ember Seed (common relics)

*Relics (unlockable):*
- Root Charm, Thorn Ring (uncommon — unlocked via game/app achievements)
- Faded Lens, Garden Key (rare — unlocked via boss victories or significant longevity milestones)

*Potions (available from run 1):*
- Healing Salve, Thorn Tonic, Swift Sip

*Potions (unlockable):*
- Fury Drop, Fog Flask (unlocked via game/app achievements)

*Events (available from run 1):*
- The Dried Fountain, The Overgrown Path, The Whispering Stump

*Events (unlockable):*
- The Sleeping Fox, The Cracked Mirror (unlocked via game achievements)
- Additional surprise events (unlocked via longevity milestones)

### First Run: The Spirit Encounter

The very first run has a special scripted event on floor 1: a spirit appears and grants the player one powerful card or ability. This hooks the player immediately by showing them what's possible, and gives them a taste of the game's full potential.

The spirit offers a choice of 2 cards from the unlockable rare pool (e.g., Overgrowth or Photosynthesis). This card is available for the duration of the first run only — it's a preview. To permanently add it to the pool, the player must earn the unlock through gameplay or the longevity app.

### Unlock Sources

**From playing the game (explicit, permanent):**

| Achievement | Unlock |
|-------------|--------|
| Win your first combat | Empower card added to pool |
| Reach floor 3 | Shockwave card added to pool |
| Defeat the Elite (Rot Golem) | Root Charm relic added to pool |
| Defeat the Boss (Hollow Gardener) | Faded Lens relic + Overgrowth card added to pool |
| Win a run with ≤ 12 cards in deck | Garden Key relic added to pool |
| Win a run without resting | Dig In card added to pool |
| Use 5 potions in a single run | Fog Flask potion added to pool |
| Discover 3 events in a single run | The Cracked Mirror event added to pool |

**From the longevity app (explicit, permanent):**

| Longevity Milestone | Unlock |
|---------------------|--------|
| 7-day exercise streak | Reclaim card added to pool |
| 7-day sleep streak | Mist Veil card added to pool (if not already available) |
| Reach longevity score 70 | Thorn Ring relic added to pool |
| Complete first health screening | Fury Drop potion added to pool |
| 30-day any-category streak | Photosynthesis card added to pool |
| Complete health profile | The Sleeping Fox event added to pool |

These are examples — the exact mapping can be tuned during playtesting. The principle is: longevity milestones unlock content that thematically connects to the achievement (exercise streak → attack card, sleep streak → defensive card).

### In-Run Discoveries (Temporary)

Separate from permanent unlocks, each run can contain **surprise discoveries** that are only available during that run:

- **Surprise Chests:** A hidden node type that can appear on the map (rare, ~15% chance per run). Contains a random item from a special "discovery pool" that includes items not yet permanently unlocked. If the player finds a powerful card this way, they get to use it for this run — and a tooltip says "Unlock permanently by [achievement description]."
- **Secret Events:** Rare event variants that only trigger under specific conditions (e.g., entering floor 3 with less than 20 HP triggers a "Mercy of the Garden" event that offers a full heal but removes your best card).
- **Elite Drops:** Elite victories can occasionally drop a card or relic from the unlockable pool as a one-time discovery, even if the player hasn't permanently unlocked it yet. This serves as a preview/teaser.

These temporary discoveries create moments of delight and also serve as advertisements for the unlock system — "I found this amazing relic in a chest, now I want to permanently unlock it."

### Collection Screen (Future)

A dedicated screen (accessible from the World Map) showing all discoverable content in the game, organized as a collection or "epoch" system:

- **Cards tab:** Grid of all cards. Unlocked = full color with art. Locked = silhouette with unlock condition shown (e.g., "Defeat the Boss" or "7-day exercise streak").
- **Relics tab:** Same format.
- **Potions tab:** Same format.
- **Events tab:** Same format, but event details are hidden until discovered (just shows the event name and unlock condition).
- **Progress bar:** "42 / 68 items discovered" — overall collection progress.
- **Filter:** By unlock source (game achievements vs. longevity app milestones).

This screen gives long-term players a clear picture of what's left to discover and what they need to do to find it. It's built later — not required for v1 launch, but the unlock tracking infrastructure should be in the data model from the start.

### Data Model for Unlocks

The `gameProfile` Firestore document tracks unlocks:

```
users/{userId}/
├── gameProfile/
│   ├── ... (existing fields)
│   ├── unlockedContent: {
│   │   cards: string[]           # e.g. ['empower', 'reclaim', 'overgrowth']
│   │   relics: string[]          # e.g. ['root-charm', 'faded-lens']
│   │   potions: string[]         # e.g. ['fury-drop']
│   │   events: string[]          # e.g. ['sleeping-fox']
│   │ }
│   ├── achievements: {
│   │   gameAchievements: string[]    # e.g. ['first-combat-win', 'boss-defeated']
│   │   appMilestones: string[]       # e.g. ['exercise-7-streak', 'score-70']
│   │ }
```

When generating card rewards, shop inventories, and event pools during a run, the game filters the full content catalog by `unlockedContent` to determine what can appear. Items not in the unlock list are excluded from pools (except for in-run surprise discoveries).

---

## Combat System

### Overview

Combat is turn-based. The player has a deck of cards, draws a hand each turn, spends energy to play cards, and tries to reduce the enemy's HP to 0 before their own HP reaches 0. This is the core gameplay loop inherited from the existing prototype.

### Core Resources

**Health Points (HP):**
- Player starts with 75 HP (upgradeable to 80, 85, 90 via star purchases in the Between-Runs Shop).
- HP persists between encounters within a run. The player does NOT heal to full after each fight.
- HP can be restored at Rest Sites (heal 30% of max HP), via certain events/potions/relics, or via the Photosynthesis card (1 HP per turn in combat).
- When HP reaches 0, the run ends (death).

**Energy:**
- Player starts each turn with 3 energy (upgradeable to 4 via star purchase).
- Energy is spent to play cards. Each card has an energy cost of 0-3.
- Unspent energy does NOT carry over between turns.
- Energy resets to the player's max at the start of each player turn.

**Block:**
- Temporary shield that absorbs incoming damage before HP is reduced.
- Block resets to 0 at the START of the player's next turn (not the enemy's turn).
- Applied by playing Skill cards (e.g., "Defend" gives 5 block).
- Multiple block sources stack additively (Defend + Bark Skin = 13 block).
- Damage resolution: first reduce block, then reduce HP for any remainder. If block fully absorbs the hit, HP is untouched.

**Gold:**
- Earned from combat victories (10-20 gold per normal fight, 25-40 per elite, 50 per boss).
- Starting gold at run start = banked AMS from the longevity app + starting gold bonus from star upgrades.
- Spent at in-run shops to buy cards, relics, potions, and card removal.
- Lost entirely on death.

### Status Effects

All status effects are tracked as integer stacks on the affected entity (player or enemy). At the end of the affected entity's turn, each status effect decreases by 1 stack. At 0 stacks, the effect is removed.

| Status | Effect | Visual |
|--------|--------|--------|
| **Strength** | Adds +N damage to ALL attacks dealt by this entity | Warm amber badge with number |
| **Vulnerable** | This entity takes 50% more damage from attacks (×1.5, rounded down) | Soft red-orange badge |
| **Weak** | This entity deals 25% less damage with attacks (×0.75, rounded down) | Cool purple-gray badge |

### Damage Calculation

```
1. Start with card's base damage value
2. Add attacker's Strength stacks:  baseDamage = card.damage + attacker.strength
3. If attacker has Weak:             baseDamage = floor(baseDamage × 0.75)
4. If defender has Vulnerable:       baseDamage = floor(baseDamage × 1.5)
5. Apply block:
   a. effectiveDamage = max(0, baseDamage - defender.block)
   b. defender.block = max(0, defender.block - baseDamage)
6. Reduce HP:                        defender.hp -= effectiveDamage
```

Example: Player has 2 Strength, plays Strike (6 base damage) against an enemy with Vulnerable (1 stack) and 3 block.
- Base: 6 + 2 = 8
- Weak: not applicable (player isn't Weak)
- Vulnerable: floor(8 × 1.5) = 12
- Block absorbs 3: effectiveDamage = 12 - 3 = 9
- Enemy loses 9 HP, enemy block goes to 0.

### Card Types

**Attack cards (red border):**
- Deal damage to enemies.
- Can target a single enemy or all enemies (specified per card).
- Damage is modified by Strength, Weak, and Vulnerable.

**Skill cards (blue border):**
- Provide block, draw cards, apply debuffs, or other utility.
- Never deal direct damage.
- Primary source of block/defense.

**Power cards (yellow border):**
- Provide persistent effects for the rest of the current combat.
- Always exhaust (removed from deck for rest of combat after playing).
- Effects last until combat ends, not between encounters.
- Examples: "gain 1 block at start of each turn," "heal 1 HP each turn."

**Seed cards (green vine border):**
- Special permanent cards from the longevity app (see Seed Cards section above).
- Always in the starting deck at the beginning of every run.
- Cannot be removed, sold, or exhausted.
- Can function as Attack, Skill, or Power type underneath their Seed classification.

### Deck Mechanics

**Starting deck (without Seed Cards) — 10 cards:**
- 4× Strike (Attack, cost 1): Deal 6 damage to a single enemy
- 4× Defend (Skill, cost 1): Gain 5 block
- 1× Mega (Attack, cost 2): Deal 4 damage × 3 hits to a single enemy
- 1× Flow (Skill, cost 0): Draw 2 cards

**Starting deck (with Seed Cards) — still 10 cards.** Each unlocked Seed Card replaces a starter card: Sunstride replaces a Strike, Still Waters replaces a Defend, Root Feast replaces a Strike, Inner Light replaces a Defend. The deck size stays constant — quality improves without diluting draw consistency. With all 4 Seed Cards unlocked, the deck is: 2× Strike, 2× Defend, 1× Mega, 1× Flow, 1× Sunstride, 1× Still Waters, 1× Root Feast, 1× Inner Light.

The smaller 10-card deck is deliberate for the compressed 5-floor run format. With only 2-3 card rewards per run, each drafted card needs to make up a meaningful percentage of the deck. In a 10-card deck, adding 1 card is a 10% change — enough to feel impactful immediately.

**Deck piles:**
- **Draw pile:** Cards available to draw. When empty, the discard pile is shuffled and becomes the new draw pile.
- **Hand:** Cards currently held by the player (drawn at start of turn). Maximum 10 cards in hand. If drawing would exceed 10, excess cards are discarded.
- **Discard pile:** Cards that have been played (non-exhaust) or discarded from hand. Reshuffled into draw pile when draw pile empties.
- **Exhaust pile:** Cards permanently removed from the deck for the current combat. Cannot be recovered.

**Turn flow (detailed):**

1. **Player Turn Start:**
   - Energy resets to player's max (3 or 4).
   - Block resets to 0.
   - Draw 5 cards from draw pile to hand. If draw pile has fewer than 5, draw what's available, shuffle discard into draw pile, draw the remainder.
   - Trigger "start of turn" effects: relics with `turn_start` trigger activate; Power card ongoing effects activate (e.g., Overgrowth grants block, Photosynthesis heals).
   - Status effects do NOT tick down yet.

2. **Player Action Phase:**
   - Player plays cards from hand by dragging them onto valid targets.
   - Attack cards targeting a single enemy: drag onto that enemy.
   - Attack cards targeting all enemies: drag anywhere on the enemy side.
   - Skill cards (self-targeting): drag upward out of the hand area.
   - Power cards: drag upward out of the hand area.
   - Each card played deducts its energy cost. Cards that cost more than current energy cannot be played (they appear dimmed in hand).
   - Player can play as many cards as energy allows, in any order.
   - Player can view: draw pile card count (tap to see list), discard pile contents (tap to see list), exhaust pile contents (tap to see list, only shown when non-empty).
   - Player can use potions during this phase (tap a potion slot to use it; no energy cost).

3. **End Turn:**
   - Player presses "End Turn" button.
   - All remaining cards in hand are moved to discard pile.
   - Trigger "end of turn" effects for the player.
   - Status effects on the player tick down by 1 stack each.

4. **Enemy Turn:**
   - The enemy executes the action that was telegraphed by its intent icon.
   - Enemy may: deal damage to the player, gain block, apply status effects to the player, buff itself, summon allies.
   - After acting, status effects on the enemy tick down by 1 stack each.
   - The enemy's NEXT action is chosen (based on its AI pattern) and its intent icon updates to show what it will do next turn.
   - Return to step 1 (Player Turn Start).

5. **Combat End:**
   - **Victory (all enemies at 0 HP):** Enemy death animation plays. "Victory!" banner. Gold reward (random within range for enemy tier). Transition to Card Reward screen.
   - **Death (player at 0 HP):** Player character falls. Screen desaturates. "Defeated" banner. Transition to Death Screen.
   - **Boss victory:** Extended victory animation. Region Clear transition.

### Enemy Intent System

Enemies telegraph their next action with an icon displayed above their head. The player can see what the enemy will do BEFORE their turn, allowing strategic planning.

**Intent types and their icons:**
- ⚔️ **Attack:** Shows the damage number the enemy will deal. Red icon.
- 🛡️ **Defend:** Enemy will gain block. Blue icon. Shows block amount.
- 💀 **Debuff:** Enemy will apply a status effect to the player. Purple icon.
- ⚡ **Slam:** Heavy attack. Orange/lightning icon. Shows damage number (higher than normal attack).
- 📣 **Summon:** Enemy will spawn an ally. Green icon.
- 🔄 **Buff:** Enemy will strengthen itself (gain Strength or other buff). Yellow icon.

The intent is determined at the end of the enemy's turn for the NEXT turn. Players always have one full turn of advance knowledge. The Faded Lens relic extends this to two turns of advance knowledge.

### Potions

Consumable items usable during the player's action phase without spending energy. The player can hold up to 3 potions (4 with the Potion Slot upgrade).

**Region 1 potions:**

| Potion | Effect | Shop Price | Notes |
|--------|--------|------------|-------|
| Healing Salve | Restore 20 HP | 20 gold | Usable in or out of combat |
| Thorn Tonic | Gain 10 block immediately | 15 gold | Combat only |
| Fury Drop | Gain 2 Strength for this combat | 25 gold | Combat only, lasts until combat ends |
| Fog Flask | Apply 2 Weak to ALL enemies | 20 gold | Combat only |
| Swift Sip | Draw 3 cards immediately | 15 gold | Combat only |

Potions are found from: events (random drops), shop purchases, elite enemy drops (guaranteed 1 random potion from elite victories).

---

## Map System

### The World Map

The World Map is the first screen after the title screen. It shows the full tower in cross-section — 4 horizontal region bands stacked vertically.

**Region states:**
- **Locked:** Dark silhouette with padlock icon. Cannot enter. Tooltip: "Clear the region below to unlock."
- **Active:** Full color, glowing border. Player can enter and begin a new run.
- **Cleared:** Full color with a golden checkmark overlay. Player can re-enter for practice but no progression reward.
- **In Progress:** Full color, pulsing border, shows "In Progress — Floor 3/5." Player taps to resume.

**UI elements:**
- Player stats bar (top): star count, AMS bank balance, total regions cleared.
- Shop button (top-right): bag icon with star count → opens Between-Runs Shop.
- Back button → return to Title Screen.

### The Region Map (Branching Floor Map)

Each region has a vertical branching map with 5 rows of nodes connected by paths. Player starts at the bottom and works upward to the boss at the top.

**Layout example for Region 1:**
```
Floor 5 (top):     [BOSS: The Hollow Gardener]
                    /        |        \
Floor 4:        [Shop]   [Rest]    [Shop]
                  |  \     / |  \    / |
Floor 3:       [Elite]  [Combat] [Event]
                  |  \   / |  \   / |
Floor 2:       [Combat] [Event] [Combat]
                   \      |      /
Floor 1 (bottom): [Combat]  [Combat]
```

The Elite is on floor 3, with a guaranteed recovery opportunity (shop/rest) on floor 4 before the boss. This prevents the "death trap" of entering a boss fight immediately after an HP-taxing elite with no way to heal. It also creates a better narrative arc: learn (floor 1-2) → hard test (floor 3) → prepare (floor 4) → final exam (floor 5).

**Map generation rules:**
- Floor 1: Always 2 combat nodes (easy intro fights). Positions [0, 1].
- Floor 2: 2-3 nodes. At least 1 combat node, at least 1 event node. Random fill.
- Floor 3: 2-3 nodes. Must include exactly 1 elite node. Remaining nodes are combat or event.
- Floor 4: 2-3 nodes. Must include at least 1 shop OR rest site (player recovers before the boss). Random fill for remaining slots.
- Floor 5: Always exactly 1 boss node at center position. All floor 4 paths converge here.
- Connections: each node on floor N connects to 1-2 random nodes on floor N+1. Every node must be reachable from at least one node below. Every node must connect to at least one node above. Orphaned nodes get a forced connection added.
- Node positions: each node has a horizontal position (0, 1, or 2) used for visual layout.
- RNG: seeded with `runId` so the map is deterministic and reproducible for debugging.

**Map visuals:**
- Nodes are circular icons (~60px) with type symbols (sword, skull, question mark, coin bag, campfire, crown).
- Visited nodes: full color, golden border.
- Available next nodes: glowing, slightly enlarged, tappable.
- Future nodes: visible but dimmed/desaturated.
- Paths are organic curved lines (not straight), drawn as ink-on-paper style.
- Current player position: small character icon on the last visited node.
- Completed paths are lit up in gold.
- New paths "draw themselves" with an ink-flow animation when a floor is reached.

**Fixed UI on Region Map:**
- Top bar: Player HP (heart + number), Gold (coin + number), Potion slots (up to 3-4 circles), Floor indicator ("Floor 2 / 5").
- Bottom bar: Deck button (card count, tap to view full deck list), Relic bar (small icons of collected relics, tap to see detail).
- Pause/Menu button: Save & Quit (preserves run, returns to World Map), Settings, Abandon Run (with confirmation dialog).

### Node Types

**Combat Node (crossed swords icon):**
- Fight 1 enemy (or 2 for Bramble Twins encounter).
- Enemy type chosen randomly from region pool, weighted by floor (easier enemies more common on lower floors).
- Rewards on victory: 10-20 gold (random) + choice of 1 card from 3 random options (player can skip the card).
- Card options are drawn from the region's card pool, weighted by rarity.

**Elite Combat Node (red skull icon):**
- Harder enemy with more HP, higher damage, special mechanics.
- In Region 1, the elite is always the Rot Golem.
- Rewards: 25-40 gold + 1 guaranteed relic (random from region pool) + 1 guaranteed potion (random) + choice of 1 card from 3 options.
- Elites are the primary source of relics.

**Event Node (golden question mark icon):**
- Narrative encounter with 2-3 choices. No combat unless the player opts into it.
- Events are drawn randomly from the region's event pool without replacement (same event won't appear twice in one run).
- Full-screen event illustration with narrative text and choice buttons.
- Outcomes are immediate (HP change, card gain/removal, gold change, potion gain, relic gain).

**Shop Node (coin bag icon):**
- Shop inventory (generated fresh per visit):
  - 3 random cards from region pool. Prices: Common 50g, Uncommon 75g, Rare 100g.
  - 2 random relics. Prices: Common 100g, Uncommon 150g, Rare 200g.
  - 2 random potions. Prices: 15-25g.
  - Card Removal service: 50g to permanently remove 1 card from deck. Price increases by 25g for each subsequent removal in the same run (50→75→100→...). Price resets to 50g on a new run.
- Player can buy as many items as they can afford, then leave.

**Run-scoped items:** All in-run items (gold, relics, potions, added cards, card upgrades) are lost on death. They exist only for the duration of a single run attempt. Potions, relics, and deck modifications do NOT carry between runs. Only permanent progression (stars, Seed Cards, character upgrades, region clears) persists.

**Rest Site Node (campfire icon):**
- Player chooses ONE option:
  - **Rest:** Heal 30% of max HP (rounded up). Example: 75 max HP → heal 23 HP.
  - **Train:** Upgrade one card in the deck. Opens deck view, player selects a card. Upgraded cards have improved stats (see Card Upgrades section). Each card can only be upgraded once.
- Strategic choice: survive (heal) vs. invest (stronger deck).

**Boss Node (crown icon):**
- Final node on floor 5. All paths converge here.
- Region 1 boss: The Hollow Gardener (detailed below).
- Rewards: 50 gold + region clear (unlock next region).
- No card reward from boss (the region unlock IS the reward).

---

## Region 1 Content — The Withered Garden

### Enemies

**Thorn Creep (Normal)**
- HP: 30
- AI: Pattern (simple repeating cycle)
  - Turn 1: Attack (6-8 damage, random within range)
  - Turn 2: Attack (6-8 damage)
  - Turn 3: Defend (gain 5 block)
  - Repeat from turn 1
- Intent: always accurately telegraphs next action
- Role: Tutorial enemy. Simple, predictable. Teaches the player to read intents and use block.
- Sprite: small thorny plant creature, shuffling movements

**Fog Wisp (Normal)**
- HP: 20
- AI: Pattern
  - Turn 1: Debuff (apply 2 Weak to player)
  - Turn 2: Attack (4-6 damage)
  - Turn 3: Debuff (apply 1 Vulnerable to player)
  - Repeat from turn 1
- Role: Low HP but dangerous debuffer. Teaches the player to prioritize targets. When paired with another enemy (via boss summon), killing the Wisp first prevents debuff stacking.
- Sprite: translucent mist creature with soft glow, drifting movement

**Rot Golem (Elite)**
- HP: 50
- AI: Adaptive
  - Default behavior: alternates Attack (10-12 damage) and Defend (gain 8 block)
  - Every 3rd turn: Slam (14-18 damage). Telegraphed 1 turn in advance with lightning intent icon.
  - When below 50% HP: gains a silent +3 Strength buff (all future attacks deal +3 damage). No visual indicator for this — the player must notice the damage increase. This rewards attentive play.
- Role: Tanky, hits hard. Requires either burst damage or sustained block strategy. The slam creates tension every 3 turns.
- Sprite: large mossy stone creature, slow heavy movements

**Bramble Twins (Normal — 2 enemies)**
- Twin A ("Briar"): HP 25
  - Every turn: Attack (7-9 damage)
- Twin B ("Thorn"): HP 25
  - Odd turns: Buff (give Twin A +2 Strength)
  - Even turns: Attack (5-7 damage)
- Role: Kill-order puzzle. Killing Thorn first prevents Strength stacking on Briar (which would become lethal). Killing Briar first leaves a weaker enemy but wastes the Strength that was already applied. Optimal play: kill Thorn first, then clean up Briar.
- Sprite: two intertwined thorny sprites, slightly different color tints to distinguish them

**The Hollow Gardener (Boss)**
- HP: 120
- AI: Adaptive, two phases
- **Phase 1 (HP > 60):**
  - Turn 1: Summon (spawn 1 Thorn Creep with 15 HP — weaker than normal)
  - Turn 2: Attack (10-12 damage)
  - Turn 3: Defend (gain 10 block)
  - Turn 4: Attack (10-12 damage)
  - Turn 5: If previous summon is dead → Summon again. Otherwise → Attack (12-14 damage).
  - Repeat from turn 2.
  - Maximum 2 Thorn Creeps alive at once.
  - Phase 1 strategy: manage the summons while chipping away at the boss's HP. Can ignore summons and rush the boss, or clear summons for safety.

- **Phase 2 (HP ≤ 60):**
  - Transition event: screen shake (0.5s), text overlay: "The Hollow Gardener roars — vines erupt!", boss sprite changes to enraged pose.
  - Immediately gains 3 Strength (permanent for rest of fight).
  - All existing summoned Thorn Creeps die (the boss absorbs their life force, thematically).
  - Turn cycle becomes:
    - Turn A: Attack (14-18 damage, boosted by Strength)
    - Turn B: Debuff (apply 1 Vulnerable to player)
    - Turn C: Attack (14-18 damage)
    - Turn D: Slam (18-22 damage)
    - Repeat from A.
  - No more summoning, no more defending — pure aggression.
  - Phase 2 strategy: the player must have strong block or burst damage. The Vulnerability application makes subsequent attacks devastating. This is the DPS/survival check.

- Estimated fight duration: 8-15 turns depending on player deck strength.
- Sprite: tall spectral figure made of dead vines and bark, carrying garden shears. Phase 2: vines glow red, shears are open/aggressive.

### Cards

**Existing starter cards (4 types, 10 cards in starting deck):**

| Card | Type | Cost | Effect | Copies in Starter |
|------|------|------|--------|-------------------|
| Strike | Attack | 1 | Deal 6 damage to single enemy | 4 |
| Defend | Skill | 1 | Gain 5 block | 4 |
| Mega | Attack | 2 | Deal 4 damage × 3 hits to single enemy | 1 |
| Flow | Skill | 0 | Draw 2 cards | 1 |

**Cards available as rewards/shop finds (not in starter deck):**

| Card | Type | Cost | Effect |
|------|------|------|--------|
| Empower | Power | 3 | Gain +3 Strength. Exhaust. |
| Shockwave | Skill | 2 | Apply 2 Vulnerable + 2 Weak to ALL enemies. Exhaust. |

Empower and Shockwave are deliberately excluded from the starter deck. In the compressed 5-floor format, they serve as exciting card rewards or shop finds rather than dead draws in a lean starting hand.

**Region 1 new cards (15 cards, available from card rewards and shops):**

*Attacks:*

| Card | Rarity | Cost | Effect |
|------|--------|------|--------|
| Vine Lash | Common | 1 | Deal 8 damage to single enemy. Apply 1 Weak. |
| Thorn Burst | Uncommon | 2 | Deal 4 damage to ALL enemies. |
| Reclaim | Uncommon | 1 | Deal 6 damage to single enemy. If target is Vulnerable, draw 1 card. |

*Skills:*

| Card | Rarity | Cost | Effect |
|------|--------|------|--------|
| Bark Skin | Common | 1 | Gain 8 block. |
| Dig In | Uncommon | 2 | Gain 12 block. Gain 1 Strength. |
| Shed | Common | 0 | Lose ALL block. Draw 2 cards. |
| Mist Veil | Uncommon | 1 | Gain 5 block. Apply 1 Weak to a single enemy. |

*Powers (exhaust on play):*

| Card | Rarity | Cost | Effect |
|------|--------|------|--------|
| Overgrowth | Rare | 2 | At the start of each turn, gain 1 block. (Lasts rest of combat.) |
| Photosynthesis | Rare | 1 | At the start of each turn, heal 1 HP. (Lasts rest of combat.) |

**Card rarity distribution for rewards:**
- Common: 60% chance to appear in a reward option
- Uncommon: 30% chance
- Rare: 10% chance

**Card upgrades (via Rest Site → Train):**

| Card | Upgraded Name | Change |
|------|---------------|--------|
| Strike | Strike+ | Damage 6 → 9 |
| Defend | Defend+ | Block 5 → 8 |
| Mega | Mega+ | Damage per hit 4 → 5 |
| Empower | Empower+ | Strength 3 → 4 |
| Shockwave | Shockwave+ | Vulnerable 2 → 3, Weak 2 → 3 |
| Flow | Flow+ | Draw 2 → 3 |
| Vine Lash | Vine Lash+ | Damage 8 → 11, Weak 1 → 2 |
| Thorn Burst | Thorn Burst+ | Damage 4 → 6 to all |
| Reclaim | Reclaim+ | Damage 6 → 8, draw 1 → draw 2 if Vulnerable |
| Bark Skin | Bark Skin+ | Block 8 → 11 |
| Dig In | Dig In+ | Block 12 → 15, Strength 1 → 2 |
| Shed | Shed+ | Draw 2 → 3 |
| Mist Veil | Mist Veil+ | Block 5 → 8, Weak 1 → 2 |
| Overgrowth | Overgrowth+ | Block per turn 1 → 2 |
| Photosynthesis | Photosynthesis+ | Heal per turn 1 → 2 |

Seed Cards CANNOT be upgraded at rest sites (they upgrade via real-world habit streaks).

### Events

**Event 1: The Dried Fountain**
- Illustration: a stone fountain covered in moss and cracks, with a faint blue glow in the dry basin.
- Narrative: "You come upon a fountain, long dry. Faded carvings suggest it once held healing waters. A faint shimmer pulses deep within the basin."
- Option A: "[Lose 5 HP] Reach into the basin" → Gain 1 random card from region pool. Text: "You pull a card from the basin's depths... You gained [card name]!"
- Option B: "[Safe] Cup the remaining drops" → Heal 10 HP. Text: "The few remaining drops taste like morning dew. You feel refreshed."
- Strategy: Option A is better if healthy (trading HP for deck improvement); Option B is better if low on HP.

**Event 2: The Overgrown Path**
- Illustration: a fork in a tangled hedge path. One way is dark and thorny, the other is clear and easy.
- Narrative: "The path forks. Through the thorny way you glimpse something glinting — but the vines are thick and the shadows move."
- Option A: "[Fight a Thorn Creep] Take the thorny path" → Immediate combat with a Thorn Creep (30 HP, normal AI). If player wins, gain 1 random relic from region pool. Text: "Among the fallen thorns, you find a curious artifact."
- Option B: "[Safe] Take the clear path" → Nothing happens. Text: "The clear path is uneventful. Sometimes the wise choice is the quiet one."
- Strategy: A free relic is extremely valuable, but you spend HP and cards fighting for it. Good if you have a strong deck; risky if you're struggling.

**Event 3: The Whispering Stump**
- Illustration: a hollow tree stump glowing faintly from within, with spectral wisps circling it.
- Narrative: "A hollow stump pulses with pale light. Whispers curl from its depths — not words, but feelings. Something wants to be released."
- Option A: "[Remove a card] Offer a card to the stump" → Opens deck view. Player selects a card to permanently remove from their deck for this run. Text: "The card dissolves into light and feeds the stump. The whispers quiet." 
- Option B: "[Leave] The whispers unsettle you" → Nothing happens. Text: "You step away. Some things are better left undisturbed."
- Strategy: Deck thinning (removing weak starter cards like Strike and Defend) is one of the strongest strategies in Spire-like games. This event is almost always valuable. Experienced players will always choose option A.

**Event 4: The Sleeping Fox**
- Illustration: a small silver fox curled up on a moss-covered stone, with a potion bottle tucked under its paw.
- Narrative: "A silver fox sleeps soundly on a mossy stone. Tucked under its paw, a glass bottle catches the light. Its breathing is slow and peaceful."
- Option A: "[Lose 10 gold] Gently take the potion" → Gain 1 random potion. Text: "You slide the bottle free without waking the fox. It's a [potion name]."
- Option B: "[Lose 5 HP] Startle the fox" → It bites, then drops 2 potions and runs. Gain 2 random potions. Text: "The fox snaps at your hand and bolts, leaving two bottles behind."
- Option C: "[Leave] Let it sleep" → Nothing. Text: "You watch it breathe for a moment, then move on."
- Strategy: Option B is best value (2 potions for 5 HP) but costs HP. Option A is safe but costs gold. Option C if you already have max potions.

**Event 5: The Cracked Mirror**
- Illustration: a tall ornate mirror, cracked but still reflective. A distorted shadow moves within — the boss.
- Narrative: "An ornate mirror stands among the dead hedges, its surface cracked but still holding reflections. As you approach, a shadow moves within — tall, thin, carrying something sharp."
- Option A: "[Look] Peer into the mirror" → Reveals the boss's full stats and attack pattern. Text overlay: "The Hollow Gardener — 120 HP. Phase 1: Summons Thorn Creeps. Phase 2 (below 50% HP): Enrages, gains Strength, applies Vulnerable. Its slam hits for 18-22 damage."
- Option B: "[Leave] Turn away" → Nothing. Text: "Some futures are better faced in the moment."
- Strategy: Pure information reward. No cost. Valuable for players who haven't fought the boss before, or who want to plan their deck strategy for the boss fight.

### Relics

| Relic | Rarity | Trigger | Effect | Strategy Notes |
|-------|--------|---------|--------|----------------|
| **Wilted Crown** | Common | Start of each combat | Gain 3 block | Reliable passive defense. Slightly reduces damage every fight. |
| **Root Charm** | Uncommon | When a Seed Card is played | That Seed Card costs 1 less energy (minimum 0) | Extremely powerful if 3-4 Seed Cards are unlocked. Useless with 0 Seed Cards. Creates interesting decision around Seed Card investment. |
| **Morning Dew** | Common | After winning a combat | Heal 2 HP | Small but compounds over 4-5 fights per run. Worth ~8-10 HP per run. |
| **Thorn Ring** | Uncommon | When player has block and enemy attacks | Deal 1 damage to the attacking enemy | Synergizes with block-heavy decks. Weak individually but adds up over many turns. Thematic. |
| **Mossy Compass** | Common | Passive (always active) | All map nodes on all floors are fully revealed (no fog/hidden info) | Information advantage — see the full map before choosing any path. Helps plan routes to desired node types. |
| **Ember Seed** | Common | Start of combat (first turn only) | Gain 1 extra energy on the first turn of each combat | Strong opener. Turn 1 with 4 energy enables powerful opening plays (e.g., Empower + Strike). |
| **Faded Lens** | Rare | Passive (always active) | See enemy intent for 2 turns ahead instead of 1 | Very powerful for planning. Shows the current turn's intent AND next turn's intent simultaneously. Stacks with information from The Cracked Mirror event. |
| **Garden Key** | Rare | After winning a combat | Gold reward from combats is doubled | Extremely strong for economy. Turns 10-20 gold per fight into 20-40. Makes shops much more accessible. Best relic for gold-starved runs. |

---

## UI/UX Flow — Every Screen

### Navigation Map

```
App Launch → Title Screen → World Map
                              ├── Between-Runs Shop ←→ World Map
                              ↓
                           Region Map
                              ├── Combat → Victory → Card Reward → Region Map
                              ├── Combat → Death → World Map
                              ├── Boss Combat → Region Clear → World Map
                              ├── Event → Region Map
                              ├── Shop → Region Map
                              └── Rest Site → Region Map
```

### Title Screen

**Visual:** The Green Door slightly ajar, warm golden light spilling through. Subtle particle effects (floating motes, gentle leaf drift). The tower is visible through the crack as a distant silhouette.

**Elements:**
- Game title: "Tower of Mirrors" (working title)
- **Play** button → World Map. If active run exists, says "Continue" and pulses.
- **Settings** button → audio volume, music toggle, SFX toggle, fullscreen toggle.
- Player identity from longevity app (small avatar/name, top corner).
- Audio: soft ambient piano + nature sounds. Not the combat BGM.

### World Map Screen

**Visual:** Tower cross-section, 4 horizontal region bands stacked vertically. Each band shows region art, name, status.

**Elements:**
- 4 region bands (scrollable vertically). Tap active/cleared region → Region Map.
- Shop button (top-right, bag icon + star count) → Between-Runs Shop.
- Player stats bar (top): stars, AMS bank, regions cleared.
- If active run exists, the region pulses with "In Progress — Floor X/5."

### Between-Runs Shop Screen

**Visual:** Cozy Ghibli merchant tent interior. Warm lighting, shelves, friendly forest creature shopkeeper.

**Layout:**
- Left panel — Seed Cards: all 4 shown. Unlocked = full color with streak tier. Locked = silhouette with star price.
- Right panel — Character Upgrades: Max HP +5 (30★, ×3), Card Reward +1 (80★, ×1), Potion Slot +1 (60★, ×1), Starting Gold +10 (40★, ×3).
- Top bar: star balance, back button.
- Purchase interaction: tap item → detail popup → "Buy for X ★" or "Need X more ★" (grayed).

### Region Map Screen

Described in Map System section above. Vertical branching map with node icons, paths, top bar (HP/gold/potions/floor), bottom bar (deck/relics).

### Combat Screen

Existing prototype with additions:
- **Keep:** Background, character sprites with animations, curved card hand with drag-and-drop, card glow/particles, health bars with catchup trail, status badges, enemy intent display, energy orb, End Turn button, floating damage numbers, hit flash/knockback, audio.
- **Add:** Relic bar (top-right, icons flash on activation), potion slots (top-left, tap to use), gold counter, floor indicator, Seed Card vine borders, draw/discard/exhaust pile counters (tappable for list view).

### Card Reward Screen

**Visual:** Dimmed combat background. 3 cards face-up, fanned out.
- Cards animate in (flip from face-down with stagger).
- Tap card → enlarges, others dim, "Add to Deck?" confirmation.
- Skip button at bottom. Brief confirmation.
- Gold earned displayed at top.
- Relic display (if elite fight) above cards.

### Event Screen

**Visual:** Full-screen painted illustration (top 60%), narrative text (middle), choice buttons (bottom).
- Each choice button clearly states action AND consequence: "[Lose 5 HP] Reach into the basin."
- After choosing: result text (2 seconds), then auto-transition to Region Map.

### Shop Screen

**Visual:** Outdoor market stall in the garden.
- Cards row (3 cards with prices), Relics row (2 with prices), Potions row (2 with prices), Card Removal (50g+).
- Gold balance at top, updates live on purchase.
- Leave Shop button.

### Rest Site Screen

**Visual:** Campfire clearing with fireflies. Hero sits by fire. Crackling audio.
- Two choices: Rest (heal 30% max HP) or Train (upgrade a card).
- Train opens deck view showing upgradeable cards with before/after stats.

### Death Screen

**Visual:** Scene desaturates. Golden light pulse. Tone is "rest and return," not punishing.
- Run summary: floor reached, enemies defeated, damage dealt, cards played, gold spent, turns survived.
- Motivational hooks connecting to longevity app: "Your Sunstride seed needs 3 more days to reach the next tier," "You have 45 AMS banked — 45 starting gold on your next run."
- Buttons: "Return to Tower" (→ World Map), "Open Longevity" (deep link to health app).
- No "retry immediately" button. The player should go do habits first. This IS the loop.

### Boss Victory / Region Clear Screen

**Visual:** Transformation animation — color floods back into the withered garden. Flowers bloom, sky brightens, the Hollow Gardener dissolves into light and becomes part of the garden. Ghibli-style magical transformation (3-5 seconds, skippable).
- "Region Cleared!" banner.
- Run stats.
- "Next region unlocked: The Mist Woods" with teaser illustration.
- Buttons: "Continue to Tower" (→ World Map), "Open Longevity" (deep link).

---

## Technical Architecture

### Tech Stack

- **Phaser 3.90.0** — WebGL game engine
- **TypeScript 6.0** — strict mode
- **Vite 8.0** — dev server (port 3001) and build tool
- **Firebase / Firestore** — shared backend with longevity app for user profiles, run persistence, cross-app currency sync
- **Capacitor** (future) — for embedding in longevity app's iOS shell

### Architecture: Model-View Separation

All game logic lives in pure TypeScript model classes that can be tested without Phaser. All rendering lives in Phaser Scene and View classes that consume model state via callbacks.

### File Structure

```
src/
├── models/                    # Pure game logic — no Phaser imports
│   ├── Card.ts               # Card definitions, effects, upgrade paths
│   ├── CombatEntity.ts       # HP, block, energy, status effects, damage calc
│   ├── CombatState.ts        # Turn phases, card plays, enemy AI for one fight
│   ├── Deck.ts               # Draw/discard/exhaust pile management
│   ├── RunState.ts           # Full run state machine (the conductor)
│   ├── MapGenerator.ts       # Procedural branching map generation
│   ├── EnemyCatalog.ts       # Enemy definitions, stats, AI patterns
│   ├── RelicCatalog.ts       # Relic definitions and triggered effects
│   ├── EventCatalog.ts       # Event definitions, options, outcomes
│   ├── ShopGenerator.ts      # Shop inventory generation and pricing
│   ├── SeedCard.ts           # Seed Card definitions, streak tier logic
│   └── PlayerProfile.ts      # Permanent progression (stars, upgrades, unlocks)
│
├── scenes/                    # Phaser rendering — consumes model state
│   ├── BootScene.ts          # Asset loading (exists, will expand)
│   ├── TitleScene.ts         # Title screen
│   ├── WorldMapScene.ts      # Tower overview, region selection
│   ├── RegionMapScene.ts     # Branching floor map navigation
│   ├── CombatScene.ts        # Card combat (refactored from monolith)
│   ├── CardRewardScene.ts    # Post-combat card selection
│   ├── EventScene.ts         # Narrative events
│   ├── ShopScene.ts          # In-run shop
│   ├── RestSiteScene.ts      # Rest/Train choice
│   ├── StarShopScene.ts      # Between-runs permanent shop
│   ├── DeathScene.ts         # Run failure summary
│   └── RegionClearScene.ts   # Boss victory celebration
│
├── views/                     # Reusable Phaser UI components
│   ├── CardView.ts           # Card rendering, drag/drop, glow, particles
│   ├── HandView.ts           # Curved hand layout, card spacing
│   ├── HealthBarView.ts      # HP bar with animated trail + block
│   ├── StatusBadgeView.ts    # Strength/weak/vulnerable indicators
│   ├── IntentView.ts         # Enemy intent icon display
│   ├── EnergyOrbView.ts      # Energy counter orb
│   ├── RelicBarView.ts       # Row of relic icons with activation flash
│   ├── PotionSlotView.ts     # Potion slot UI
│   ├── MapNodeView.ts        # Map node icon with type/state
│   ├── MapPathView.ts        # Curved path lines between nodes
│   └── TopBarView.ts         # HP/gold/potions/floor persistent bar
│
├── services/                  # External communication
│   ├── FirebaseSync.ts       # Read/write gameProfile and activeRun
│   └── AudioManager.ts       # SFX and BGM management
│
├── data/                      # Static game content definitions
│   ├── regions/
│   │   └── witheredGarden.ts # Region 1: enemies, cards, events, relics, boss
│   ├── starterDeck.ts        # Base 10-card starter deck
│   └── seedCards.ts          # All 4 Seed Card definitions with streak tiers
│
└── main.ts                    # Phaser game config, scene registration, entry
```

### RunState — The Central Conductor

RunState is the most important model. It orchestrates an entire run from region entry to death or victory. CombatState (already exists) handles a single fight. RunState handles everything above that.

**RunState interface:**

```typescript
interface RunState {
  // Identity
  regionId: string;              // 'withered-garden'
  runId: string;                 // Unique ID for this run attempt

  // Map
  map: RegionMap;                // Generated branching map
  currentNodeId: string | null;  // Current node
  visitedNodeIds: string[];      // Completed nodes
  availableNodeIds: string[];    // Nodes player can move to

  // Player state (persists across encounters within a run)
  playerHp: number;
  playerMaxHp: number;
  playerGold: number;
  playerEnergy: number;          // Base energy per turn
  deck: Card[];                  // Full deck including starters + added + seeds
  upgradedCardIds: string[];     // Cards that have been upgraded
  relics: Relic[];               // Collected relics
  potions: (Potion | null)[];    // Potion slots (null = empty)
  seedCardLevels: Record<string, number>; // Streak tiers snapshotted at run start

  // State machine
  phase: RunPhase;
  // 'MAP_SELECT' | 'COMBAT' | 'CARD_REWARD' | 'EVENT' | 'SHOP' | 'REST' | 'BOSS' | 'VICTORY' | 'DEATH'

  // Methods
  startRun(profile: PlayerProfile): void;
  selectNode(nodeId: string): void;
  startCombat(enemyId: string): CombatState;
  endCombat(result: 'victory' | 'death'): void;
  selectCardReward(card: Card | null): void;
  resolveEvent(choiceId: string): EventOutcome;
  purchaseShopItem(itemId: string): boolean;
  restSiteChoice(choice: 'rest' | 'train', cardId?: string): void;
  serialize(): SerializedRunState;
  static deserialize(data: SerializedRunState): RunState;
  onStateChanged: (state: RunState) => void;
}
```

**RunState lifecycle:**
1. Player enters region → `startRun()` generates map, builds deck, snapshots currencies.
2. `MAP_SELECT` phase → player taps node → `selectNode()` transitions to `COMBAT`/`EVENT`/`SHOP`/`REST`.
3. `COMBAT` → `startCombat()` creates CombatState. CombatScene renders it. Combat ends → `endCombat()` → `CARD_REWARD` or `DEATH`.
4. `CARD_REWARD` → player picks or skips → `selectCardReward()` → back to `MAP_SELECT`.
5. `EVENT`/`SHOP`/`REST` → player makes choices → RunState updates → back to `MAP_SELECT`.
6. Boss victory → `VICTORY` → write region clear to Firestore.
7. Death → `DEATH` → clear `activeRun`, write to `runHistory`.
8. After every state change, `serialize()` is called and written to Firestore for save/resume.

### Relationship Between RunState and CombatState

```
RunState (manages the full run)
    │
    ├── Creates CombatState for each fight
    │   CombatState receives: player HP, energy, deck, relics, enemy definition
    │   CombatState manages: turn loop, card plays, damage, enemy AI
    │   CombatState returns: victory/death, remaining HP, modified deck state
    │
    └── RunState updates from CombatState results:
        - playerHp = combat result HP
        - deck may have new exhausted cards
        - relics may have triggered/consumed
```

CombatState needs minimal changes from the current prototype. RunState wraps around it.

### MapGenerator

```typescript
interface RegionMap {
  nodes: MapNode[];
  connections: MapConnection[];
}

interface MapNode {
  id: string;          // 'floor-1-node-0'
  floor: number;       // 1-5
  position: number;    // Horizontal (0, 1, or 2)
  type: NodeType;      // 'combat' | 'elite' | 'event' | 'shop' | 'rest' | 'boss'
  enemyId?: string;    // For combat/elite nodes
  eventId?: string;    // For event nodes
}

interface MapConnection {
  fromNodeId: string;
  toNodeId: string;
}
```

Generation algorithm described in Map System section above.

### Data-Driven Enemy Definitions

```typescript
interface EnemyDefinition {
  id: string;
  name: string;
  regionId: string;
  tier: 'normal' | 'elite' | 'boss';
  hp: number;
  sprite: string;
  animations: { idle: string; attack: string; hurt: string; death: string; slam?: string; };
  ai: EnemyAI;
}

interface EnemyAI {
  type: 'pattern' | 'adaptive';
  actions: EnemyAction[];
  decisionLogic: string;  // References a decision function by name
}

interface EnemyAction {
  type: 'attack' | 'defend' | 'debuff' | 'slam' | 'summon' | 'buff';
  damage?: [number, number];     // [min, max] range
  block?: number;
  statusEffect?: { type: string; stacks: number; target: 'player' | 'self' };
  summonId?: string;
  intent: IntentIcon;
}
```

### Data-Driven Relic Definitions

```typescript
interface RelicDefinition {
  id: string;
  name: string;
  description: string;
  regionId: string;
  rarity: 'common' | 'uncommon' | 'rare';
  trigger: RelicTrigger;
  effect: RelicEffect;
  sprite: string;
}

type RelicTrigger =
  | { type: 'combat_start' }
  | { type: 'turn_start' }
  | { type: 'on_block' }
  | { type: 'on_enemy_attack' }
  | { type: 'combat_end_victory' }
  | { type: 'card_play'; cardType?: string }
  | { type: 'passive' }
  | { type: 'seed_card_play' };

type RelicEffect =
  | { type: 'gain_block'; amount: number }
  | { type: 'deal_damage'; amount: number; target: 'attacker' | 'all_enemies' }
  | { type: 'heal'; amount: number }
  | { type: 'modify_energy'; amount: number }
  | { type: 'modify_gold_reward'; multiplier: number }
  | { type: 'modify_seed_cost'; amount: number }
  | { type: 'reveal_map' }
  | { type: 'extra_intent_turns'; amount: number };
```

### CombatScene Refactoring Plan

The current `main.ts` is ~1400 lines containing everything. Refactor by extracting views one at a time:

| Extract | From | To | ~Lines |
|---------|------|----|--------|
| Card creation, drag/drop, glow, particles, dimming | main.ts | views/CardView.ts | ~200 |
| Curved hand layout, spacing, hover reorg | main.ts | views/HandView.ts | ~100 |
| HP bar, animated trail, block border | main.ts | views/HealthBarView.ts | ~80 |
| Status badges | main.ts | views/StatusBadgeView.ts | ~50 |
| Enemy intent display | main.ts | views/IntentView.ts | ~40 |
| Energy orb | main.ts | views/EnergyOrbView.ts | ~30 |
| SFX/BGM loading, playback, randomization | main.ts | services/AudioManager.ts | ~60 |
| Remaining orchestration | main.ts | scenes/CombatScene.ts | ~400 |

Approach: extract one piece at a time, verify the game still works after each extraction. Start with the most self-contained (HealthBarView, StatusBadgeView, EnergyOrbView), then CardView/HandView, then AudioManager.

### Scene Transitions

All scenes are registered at startup. RunState is passed between scenes by reference via `scene.start('SceneName', { runState })`.

```
BootScene → TitleScene
TitleScene → WorldMapScene
WorldMapScene ↔ StarShopScene
WorldMapScene → RegionMapScene
RegionMapScene → CombatScene / EventScene / ShopScene / RestSiteScene
CombatScene → CardRewardScene / DeathScene / RegionClearScene
CardRewardScene → RegionMapScene
EventScene → RegionMapScene (or → CombatScene if event triggers fight)
ShopScene → RegionMapScene
RestSiteScene → RegionMapScene
DeathScene → WorldMapScene
RegionClearScene → WorldMapScene
```

---

## Visual & Audio Direction

### Art Style — Studio Ghibli Magical Realism

The visual identity draws from Studio Ghibli's painterly, warm, emotionally rich aesthetic. Not pixel art, not dark fantasy, not anime. Warm, hand-painted, and alive.

**Color palette:**
- Region 1 base: muted earth tones — dusty greens, faded browns, desaturated lavender. Hints of warm golden light breaking through. Abandoned greenhouse at golden hour.
- Seed Card / vitality elements: vivid greens and warm golds. Alive against the muted backdrop.
- UI chrome: soft creams and warm whites. Borders feel like aged paper or carved wood. No harsh blacks or neon.
- Damage/danger: warm reds and ambers (autumn leaves, not blood).
- Healing/block: soft blues and teals (morning dew, clear water).
- Status effects: Strength = warm amber. Vulnerable = soft red-orange. Weak = cool purple-gray.

**Character design:**
- Hero: Ghibli protagonist — young, determined, relatable. Simple clothing with vine embroidery. Carries a staff or organic weapon. Not a musclebound warrior.
- Enemies: parts of the garden gone wrong — not evil, but lost. The Thorn Creep is a plant that grew wrong. The Fog Wisp is confused morning mist. The Hollow Gardener was the garden's caretaker. Melancholy quality. You're reclaiming, not destroying.
- NPCs: friendly forest creatures. Tanuki merchant, wise owl, fox spirit. Warm eyes, expressive.

**Environment art:**
- Backgrounds: watercolor paintings with depth. 3 parallax layers (foreground foliage, midground scene, background sky).
- Subtle background animation: swaying branches, drifting particles, shifting light. The world breathes.
- The withered→alive transformation is the core visual story. Cleared areas visually transform.

**Card art:**
- Each card is a small vignette in Ghibli style. Circular/oval illustration within the card border.
- Strike: swift slash through falling leaves. Defend: roots rising as a barrier. Vine Lash: thorny vine curling through air.
- Regular cards: parchment/wood border. Seed Cards: living vine border with animation.

**Sprite specifications:**
- Character sprites: ~128×128px per frame minimum (1280×720 base resolution).
- Sprite sheets: horizontal strip format, consistent frame sizes.
- Frame counts: Idle 4-6 (loop), Walk 6-8 (loop), Attack 6-10 (one-shot), Hurt 3-4 (one-shot), Death 6-8 (one-shot), Slam/special 8-12 (one-shot).
- Transparent backgrounds. Consistent lighting (upper-left). Full 32-bit RGBA.

**UI specifications:**
- Map nodes: 64×64px with glow variants.
- Relic/potion icons: 48×48px.
- Card dimensions: ~200×280px at 1× scale (5:7 ratio).
- Hand-crafted feel: slightly irregular edges, warm textures, no perfectly straight lines.

### Animation & Effects

**Existing (keep):** Hit flash (white→red), knockback, floating damage numbers, card drag particle trail, card glow on hover.

**New animations needed:**
- Screen transitions: zoom/cross-fade between scenes (0.4-0.5s).
- Combat: enemy summon (ground cracks, sprite rises), phase transition (screen shake, text overlay), relic activation flash, potion use (bottle tips), Seed Card vine tendrils on play.
- Map: node completion golden ripple, available node pulse, path ink-flow reveal.
- Region Clear: color flood transformation (2-3s, skippable).
- Death: desaturation (1s), golden pulse, gentle camera pull-back.

### Audio

**Music philosophy:** Ghibli film score — melodic, piano and strings, woodwinds. Joe Hisaishi as reference. Warm, human, acoustic.

**Tracks for v1:**

| Track | Context | Mood | Duration |
|-------|---------|------|----------|
| The Green Door | Title Screen | Wonder, invitation | 60-90s loop |
| The Tower Awaits | World Map | Hopeful, grand | 90-120s loop |
| Withered Paths | Region Map, Events | Melancholy beauty | 90-120s loop |
| Thorns and Mist | Combat (normal) | Tense, determined | 60-90s loop |
| The Gardener's Wake | Boss combat | Intense, emotional | 90-120s loop |
| A Moment's Rest | Shop, Rest Site | Safe, warm | 60-90s loop |
| Reclaimed | Region Clear | Triumphant joy | 15-20s one-shot |
| Until Tomorrow | Death Screen | Gentle, not sad | 10-15s one-shot |

**SFX:** Keep all existing combat SFX (slash ×3, hit_heavy ×2, block ×2, slam, card_draw ×2, card_play, hover, click, turn_start, victory, defeat, whoosh, draw_weapon). Keep randomized variant system and pitch variation (±5%).

**New SFX needed:** map_node_select, map_path_reveal, shop_purchase, shop_browse, potion_use, relic_pickup, relic_activate, seed_card_play, seed_card_grow, event_choose, rest_heal, rest_train, boss_phase_transition, boss_summon, region_clear, death_sting, star_spend, gold_gain, card_reward_flip, card_remove, card_upgrade.

**Audio implementation:** SFX as .wav + .ogg. BGM as .ogg (streamed). BGM crossfade between scenes (0.5s out, 0.3s silence, 0.5s in). BGM volume 0.3, SFX volume 0.7. Global mute persists (localStorage).

### Typography

- Primary font: soft, slightly hand-drawn serif (Crimson Text, Lora, or similar). Storybook feel.
- Numbers/stats: bolder variant of primary font. Instantly readable at small sizes.
- Card titles: slightly more decorative.
- All text as Phaser BitmapText for performance (pre-rendered font atlases).

### Responsive & Mobile

- Base resolution: 1280×720 (16:9). Phaser Scale.FIT mode.
- Landscape only. No portrait support.
- All tap targets minimum 44×44px.
- No hover-dependent UI (tap-to-reveal alternatives for all tooltips).
- Fullscreen on first tap (Android/iOS, already implemented).
- Safe area insets for notch/dynamic island.
- 2 active touch pointers supported.

---

## Asset Requirements Summary

### Sprites to Commission

**Characters (6):**
1. Hero — idle, walk, attack ×3, dodge, hurt, death, heal
2. Thorn Creep — idle, attack, hurt, death
3. Fog Wisp — idle, attack (debuff), hurt, death
4. Rot Golem — idle, attack, slam, hurt, death, defend
5. Bramble Twins (×2 variants) — idle, attack, buff, hurt, death
6. The Hollow Gardener — idle, attack, summon, hurt, phase-transition, death/dissolve

**Backgrounds (10):**
1. Title screen (The Green Door)
2. World Map (tower cross-section)
3. Region Map (dead garden paths, top-down)
4. Combat (withered garden, side view)
5. Event illustrations ×5 (Fountain, Path, Stump, Fox, Mirror)
6. Shop (outdoor market stall)
7. Star Shop (merchant tent interior)
8. Rest Site (campfire clearing)
9. Region Clear (garden blooming — transformation frames or shader)

**Cards (19 illustrations):**
- 15 Region 1 card art pieces
- 4 Seed Card art pieces (with 3 vine border tiers each)
- Card back design

**UI (30+ icons):**
- Map nodes ×6 types
- Relics ×8
- Potions ×5
- Intent icons ×6
- Currency icons (star, gold, AMS)
- Miscellaneous UI elements

**Audio (8 BGM tracks + 20+ new SFX):**
- See Audio section above for full list.

---

## Scope Summary — v1

**What ships in v1:**
- All game systems (map, combat, events, shop, rest sites, relics, potions, card rewards, deck management, Seed Cards, Between-Runs Shop, save/resume, Firebase sync)
- Region 1 content only (The Withered Garden): 5 enemies, 15+6 cards, 5 events, 8 relics, 5 potions, 1 boss
- World Map showing Region 1 active, Regions 2-4 locked (visual only)
- Full currency bridge with longevity app (stars + AMS)
- Mobile-optimized, landscape

**What ships in future content updates:**
- Regions 2-4 (new enemies, cards, events, relics, bosses per region)
- More Seed Cards or Seed Card upgrades
- More star shop items
- Achievement system
- Daily challenges / special runs
- Multiplayer / leaderboards (much later, if ever)

---

## Existing Codebase — Current State

The project already has a working single-encounter card combat prototype at `/phaser/spire-like/`. Here is what exists today and how it maps to the plan above.

**Existing models (in `src/models/`):**
- `Card.ts` — 6 card types, effects, targets. Will be extended with 15 new cards + Seed Cards.
- `CombatEntity.ts` — player/enemy HP, block, energy, status effects, damage calculation. Needs minimal changes.
- `CombatState.ts` — turn phases, card plays, enemy AI, phase transitions. Needs relic hook integration but core logic stays.
- `Deck.ts` — draw/discard/exhaust pile management. Needs no changes.

**Existing scene (in `src/main.ts`):**
- `CombatScene` — 1400+ lines containing ALL rendering, input handling, animations, and audio. Must be refactored into separate view components (see CombatScene Refactoring Plan above).

**Existing assets:**
- Hero sprite sheet with 20+ animations (idle, walk, attack ×3, dodge, heal, hurt, run)
- Enemy sprite sheet (droid — will be replaced with garden-themed enemies)
- Card art for 3 types (strike, defend, rip-and-tear)
- 50+ audio files (slash ×3, hit ×2, block ×2, slam, card sounds, BGM)
- Background image (dungeon — will be replaced with garden theme)

**What needs to happen (high-level implementation order):**
1. Refactor CombatScene monolith into views/ components
2. Build RunState model and MapGenerator model
3. Build data layer (EnemyCatalog, RelicCatalog, EventCatalog, SeedCard)
4. Build new scenes (Title, WorldMap, RegionMap, Event, Shop, RestSite, StarShop, Death, RegionClear, CardReward)
5. Build FirebaseSync service
6. Commission and integrate new art assets
7. Commission and integrate new audio
8. Playtest and balance
