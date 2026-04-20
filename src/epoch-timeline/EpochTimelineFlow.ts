// ABOUTME: Pure logic for the epoch timeline scene. Reads epoch definitions + session unlock state, exposes a view for rendering.
// ABOUTME: No Phaser dependencies in this file — the scene constructs EpochProgress and passes the resulting id set in.
import { EPOCHS, type EpochDef } from '../content/epochs';

export type EpochNodeState = 'unlocked' | 'locked' | 'newly_unlocked';

export interface EpochNodeView {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly goalLabel: string;
  readonly enemyHpMultiplier: number;
  readonly potionSlots: number;
  readonly state: EpochNodeState;
}

export interface EpochTimelineView {
  readonly nodes: ReadonlyArray<EpochNodeView>;
  readonly newlyUnlockedIds: ReadonlyArray<number>;
}

export interface EpochTimelineOptions {
  /** IDs that were newly unlocked by the last run — rendered with celebration state. */
  newlyUnlockedIds?: ReadonlyArray<number>;
  /** All ids currently unlocked in the session. */
  unlockedIds: ReadonlySet<number>;
}

export class EpochTimelineFlow {
  private readonly options: EpochTimelineOptions;

  constructor(options: EpochTimelineOptions) {
    this.options = options;
  }

  view(): EpochTimelineView {
    const newly = new Set(this.options.newlyUnlockedIds ?? []);
    const nodes = EPOCHS.map<EpochNodeView>(ep => ({
      id: ep.epoch,
      name: ep.name,
      description: ep.description,
      goalLabel: ep.goalLabel,
      enemyHpMultiplier: ep.enemyHpMultiplier,
      potionSlots: ep.potionSlots,
      state: newly.has(ep.epoch)
        ? 'newly_unlocked'
        : this.options.unlockedIds.has(ep.epoch)
          ? 'unlocked'
          : 'locked',
    }));
    return { nodes, newlyUnlockedIds: [...newly] };
  }

  /** Returns the EpochDef for a chosen id, or null if the id is locked / unknown. */
  select(epochId: number): EpochDef | null {
    const ep = EPOCHS.find(e => e.epoch === epochId);
    if (!ep) return null;
    if (!this.options.unlockedIds.has(epochId)) return null;
    return ep;
  }
}
