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
