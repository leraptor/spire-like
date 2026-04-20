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
