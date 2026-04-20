// ABOUTME: Session-level epoch unlock tracker. Lives in Phaser's game registry so unlocks persist across runs within a session.
// ABOUTME: Pure-ish — takes a Phaser.Game reference only to read/write registry. No scene dependencies.
import type Phaser from 'phaser';
import type { RunState } from '../models/RunState';
import { EPOCHS } from '../content/epochs';

const REGISTRY_KEY = 'epoch_unlocked_ids';

export class EpochProgress {
  constructor(private readonly game: Phaser.Game) {}

  /** Returns the set of unlocked epoch ids. Seeds with `unlockedByDefault` epochs if empty. */
  unlockedIds(): Set<number> {
    const stored = this.game.registry.get(REGISTRY_KEY) as Set<number> | undefined;
    if (stored) return new Set(stored);
    const seed = new Set<number>();
    for (const ep of EPOCHS) {
      if (ep.unlockedByDefault) seed.add(ep.epoch);
    }
    this.game.registry.set(REGISTRY_KEY, seed);
    return new Set(seed);
  }

  isUnlocked(epochId: number): boolean {
    return this.unlockedIds().has(epochId);
  }

  /**
   * Evaluate every epoch's criteria against a completed run's final state.
   * Marks newly-passing epochs as unlocked and returns their ids for UI celebration.
   */
  recordRunEnd(runState: Readonly<RunState>): number[] {
    const unlocked = this.unlockedIds();
    const newlyUnlocked: number[] = [];

    for (const ep of EPOCHS) {
      if (unlocked.has(ep.epoch)) continue;
      if (ep.unlockedByDefault) { unlocked.add(ep.epoch); newlyUnlocked.push(ep.epoch); continue; }
      if (ep.meetsUnlockCriteria(runState)) {
        unlocked.add(ep.epoch);
        newlyUnlocked.push(ep.epoch);
      }
    }

    this.game.registry.set(REGISTRY_KEY, unlocked);
    return newlyUnlocked;
  }

  /** Dev / QA helper — marks every epoch unlocked. Reversible via reset(). */
  unlockAll(): void {
    const all = new Set(EPOCHS.map(e => e.epoch));
    this.game.registry.set(REGISTRY_KEY, all);
  }

  /** Dev / QA helper — clears unlock state back to defaults. */
  reset(): void {
    this.game.registry.remove(REGISTRY_KEY);
  }
}
