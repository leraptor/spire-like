// ABOUTME: Orchestrates combat flow: turn phases, card resolution, and enemy AI.
// ABOUTME: Handles multi-hit attacks, status effects, exhaust, and 4 enemy action types.

import { Deck } from './Deck';
import { CombatEntity } from './CombatEntity';
import type { Card } from './Card';
import { STARTER_CARDS, TargetType } from './Card';
import { BEHAVIORS } from '../content/behaviors';

export enum TurnPhase {
    PLAYER_START = 'PlayerStart',
    PLAYER_ACTION = 'PlayerAction',
    ENEMY_START = 'EnemyStart',
    ENEMY_ACTION = 'EnemyAction',
    GAME_OVER = 'GameOver'
}

export class CombatState {
    player: CombatEntity;
    enemy: CombatEntity;
    deck: Deck;
    currentPhase: TurnPhase;

    nextEnemyAction!: {
        type: 'Attack' | 'Defend' | 'Debuff' | 'Charge',
        damage: number,
        slam?: boolean,
        strengthGain?: number,
    };

    onStateChanged: () => void = () => {};
    behaviorId: string = 'boss_phases';

    constructor() {
        this.player = new CombatEntity(true, 75, 3);
        this.enemy = new CombatEntity(false, 150);

        const initialCards = [
            {...STARTER_CARDS.strike, id: 's1'},
            {...STARTER_CARDS.strike, id: 's2'},
            {...STARTER_CARDS.strike, id: 's3'},
            {...STARTER_CARDS.strike, id: 's4'},
            {...STARTER_CARDS.defend, id: 'd1'},
            {...STARTER_CARDS.defend, id: 'd2'},
            {...STARTER_CARDS.defend, id: 'd3'},
            {...STARTER_CARDS.defend, id: 'd4'},
            {...STARTER_CARDS.mega, id: 'm1'},
            {...STARTER_CARDS.empower, id: 'e1'},
            {...STARTER_CARDS.shockwave, id: 'sw1'},
            {...STARTER_CARDS.flow, id: 'f1'},
        ];

        this.deck = new Deck(initialCards as Card[]);
        this.currentPhase = TurnPhase.PLAYER_START;
        this.generateNextEnemyAction();
    }

    startCombat() {
        this.startPlayerTurn();
    }

    startPlayerTurn() {
        this.currentPhase = TurnPhase.PLAYER_START;
        this.player.startTurn();
        this.deck.draw(5);
        this.currentPhase = TurnPhase.PLAYER_ACTION;
        this.onStateChanged();
    }

    playCard(cardId: string, target?: CombatEntity): { success: boolean, damages: number[] } {
        if (this.currentPhase !== TurnPhase.PLAYER_ACTION) return { success: false, damages: [] };

        const card = this.deck.hand.find(c => c.id === cardId);
        if (!card || this.player.energy < card.cost) return { success: false, damages: [] };
        if (card.unplayable) return { success: false, damages: [] };

        this.player.energy -= card.cost;
        this.deck.removeCard(card.id, card.exhaust);

        const damages: number[] = [];

        if (card.effect.selfDamage) {
            this.player.hp = Math.max(0, this.player.hp - card.effect.selfDamage);
        }
        if (card.effect.block) this.player.addBlock(card.effect.block);
        if (card.effect.strength) this.player.strength += card.effect.strength;
        if (card.effect.draw) this.deck.draw(card.effect.draw);

        const applyToTarget = (t: CombatEntity) => {
            if (card.effect.vulnerable) t.vulnerable += card.effect.vulnerable;
            if (card.effect.weak) t.weak += card.effect.weak;
            if (card.effect.damage) {
                const hits = card.effect.hits || 1;
                for (let i = 0; i < hits; i++) {
                    const dmg = t.calculateDamage(card.effect.damage, this.player);
                    t.takeDamage(dmg);
                    damages.push(dmg);
                }
            }
        };

        if (target) {
            applyToTarget(target);
        } else if (card.target === TargetType.ALL_ENEMIES) {
            applyToTarget(this.enemy);
        }

        this.checkGameOver();
        this.onStateChanged();
        return { success: true, damages };
    }

    endPlayerTurn() {
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

        if (this.currentPhase !== TurnPhase.PLAYER_ACTION) return;
        this.deck.discardHand();
        this.player.endTurn();
        this.startEnemyTurn();
    }

    startEnemyTurn() {
        this.currentPhase = TurnPhase.ENEMY_START;
        this.enemy.startTurn();
        this.onStateChanged();
    }

    executeEnemyAction() {
        this.currentPhase = TurnPhase.ENEMY_ACTION;
        const action = this.nextEnemyAction;
        let actualDamage = 0;

        if (action.type === 'Attack') {
            actualDamage = this.player.calculateDamage(action.damage, this.enemy);
            this.player.takeDamage(actualDamage);
        } else if (action.type === 'Defend') {
            this.enemy.addBlock(15);
        } else if (action.type === 'Charge') {
            this.enemy.strength += action.strengthGain ?? 0;
        } else {
            this.player.vulnerable += 2;
        }

        this.enemy.endTurn();
        this.generateNextEnemyAction();
        this.checkGameOver();
        this.onStateChanged();

        return { ...action, actualDamage };
    }

    turnCount = 0;

    generateNextEnemyAction() {
        this.turnCount++;
        const behavior = BEHAVIORS[this.behaviorId] ?? BEHAVIORS.boss_phases!;
        this.nextEnemyAction = behavior({
            enemy: this.enemy,
            player: this.player,
            turnCount: this.turnCount,
        });
    }

    getEnemyIntentDisplay(): { text: string, color: string } {
        const action = this.nextEnemyAction;
        if (action.type === 'Attack') {
            const displayDmg = this.player.calculateDamage(action.damage, this.enemy);
            const icon = action.slam ? '⚡' : '⚔️';
            return { text: `${icon} ${displayDmg}`, color: action.slam ? '#fdcb6e' : '#ff7675' };
        } else if (action.type === 'Defend') {
            return { text: '🛡️', color: '#74b9ff' };
        } else if (action.type === 'Charge') {
            return { text: '⚡ Charging', color: '#fdcb6e' };
        } else {
            return { text: '💔', color: '#a29bfe' };
        }
    }

    checkGameOver() {
        if (this.enemy.hp <= 0 || this.player.hp <= 0) {
            this.currentPhase = TurnPhase.GAME_OVER;
        }
    }
}
