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
