// ABOUTME: Pure narrative-event logic. Picks an event from the region pool and resolves player choices into outcomes.
// ABOUTME: No Phaser dependencies — the presentation layer (EventScene) reads view() and calls resolveChoice(id).
import type { RunOutcome } from '../models/RunOutcome';
import { createRunRng } from '../run/rng';
import { pickEvent, type EventDef } from '../content/events';

export interface EventChoiceView {
  readonly id: string;
  readonly label: string;
}

export interface EventView {
  readonly id: string;
  readonly name: string;
  readonly body: string;
  readonly choices: ReadonlyArray<EventChoiceView>;
}

export interface EventOptions {
  seed?: number;
  event?: EventDef; // override for tests/QA
}

export class EventFlow {
  private readonly event: EventDef;
  private readonly rng: () => number;

  constructor(opts: EventOptions = {}) {
    this.rng = createRunRng(opts.seed ?? Date.now());
    this.event = opts.event ?? pickEvent(this.rng);
  }

  view(): EventView {
    return {
      id: this.event.id,
      name: this.event.name,
      body: this.event.body,
      choices: this.event.choices.map(c => ({ id: c.id, label: c.label })),
    };
  }

  resolveChoice(choiceId: string): RunOutcome[] {
    const choice = this.event.choices.find(c => c.id === choiceId);
    if (!choice) return [{ kind: 'none' }];
    return choice.resolve(this.rng);
  }
}
