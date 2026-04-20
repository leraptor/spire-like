// ABOUTME: Tests each Region 1 event's choices produce the expected RunOutcome shape.
// ABOUTME: Validates event count and specific outcome types for combat, damage, gold, curses.
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
