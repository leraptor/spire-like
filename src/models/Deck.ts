// ABOUTME: Manages draw pile, hand, discard pile, and exhaust pile.
// ABOUTME: Handles shuffling, drawing, discarding, and exhausting cards.

import type { Card } from './Card';

export class Deck {
    drawPile: Card[];
    hand: Card[];
    discardPile: Card[];
    exhaustPile: Card[];

    constructor(initialDeck: Card[]) {
        this.drawPile = [...initialDeck];
        this.hand = [];
        this.discardPile = [];
        this.exhaustPile = [];
        this.shuffleDrawPile();
    }

    shuffleDrawPile() {
        for (let i = this.drawPile.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.drawPile[i], this.drawPile[j]] = [this.drawPile[j]!, this.drawPile[i]!];
        }
    }

    draw(amount: number): Card[] {
        const drawnCards: Card[] = [];
        for (let i = 0; i < amount; i++) {
            if (this.drawPile.length === 0) {
                if (this.discardPile.length === 0) {
                    break;
                }
                this.drawPile = [...this.discardPile];
                this.discardPile = [];
                this.shuffleDrawPile();
            }
            const card = this.drawPile.pop();
            if (card) {
                this.hand.push(card);
                drawnCards.push(card);
            }
        }
        return drawnCards;
    }

    removeCard(cardId: string, exhaust: boolean = false) {
        const index = this.hand.findIndex((c: Card) => c.id === cardId);
        if (index !== -1) {
            const [card] = this.hand.splice(index, 1);
            if (card) {
                if (exhaust) {
                    this.exhaustPile.push(card);
                } else {
                    this.discardPile.push(card);
                }
            }
        }
    }

    discardHand() {
        while (this.hand.length > 0) {
            const card = this.hand.pop();
            if (card) this.discardPile.push(card);
        }
    }
}
