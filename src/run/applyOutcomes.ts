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
