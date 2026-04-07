// ABOUTME: Orchestrates combat flow: turn phases, card resolution, and enemy AI.
// ABOUTME: Handles multi-hit attacks, status effects, exhaust, and 3 enemy action types.

import { Deck } from './Deck';
import { CombatEntity } from './CombatEntity';
import type { Card } from './Card';
import { STARTER_CARDS, TargetType } from './Card';

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

    nextEnemyAction!: { type: 'Attack' | 'Defend' | 'Debuff', damage: number };

    onStateChanged: () => void = () => {};

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

        this.player.energy -= card.cost;
        this.deck.removeCard(card.id, card.exhaust);

        const damages: number[] = [];

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
        } else {
            this.player.vulnerable += 2;
        }

        this.enemy.endTurn();
        this.generateNextEnemyAction();
        this.checkGameOver();
        this.onStateChanged();

        return { ...action, actualDamage };
    }

    generateNextEnemyAction() {
        const r = Math.random();
        if (r < 0.45) {
            this.nextEnemyAction = { type: 'Attack', damage: Math.floor(Math.random() * 6) + 10 };
        } else if (r < 0.75) {
            this.nextEnemyAction = { type: 'Defend', damage: 0 };
        } else {
            this.nextEnemyAction = { type: 'Debuff', damage: 0 };
        }
    }

    getEnemyIntentDisplay(): { text: string, color: string } {
        const action = this.nextEnemyAction;
        if (action.type === 'Attack') {
            const displayDmg = this.player.calculateDamage(action.damage, this.enemy);
            return { text: `⚔️ ${displayDmg}`, color: '#ff7675' };
        } else if (action.type === 'Defend') {
            return { text: '🛡️', color: '#74b9ff' };
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
