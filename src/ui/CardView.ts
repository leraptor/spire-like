// ABOUTME: Draggable Phaser container that renders a single card from the player's hand.
// ABOUTME: Handles hover/drag visuals, glow, trail particles, and affordability dimming.

import * as Phaser from 'phaser';
import type { Card } from '../models/Card';
import { CardType } from '../models/Card';
import type { CombatScene } from '../scenes/CombatScene';

export class CardView extends Phaser.GameObjects.Container {
    cardData: Card;
    scene: CombatScene;
    bgGraphic: Phaser.GameObjects.Graphics;
    glowGraphic: Phaser.GameObjects.Graphics;
    glowColor: number;
    trailEmitter: Phaser.GameObjects.Particles.ParticleEmitter;

    constructor(scene: CombatScene, x: number, y: number, card: Card) {
        super(scene, x, y);
        this.scene = scene;
        this.cardData = card;

        const colors: Record<string, number> = {
            [CardType.ATTACK]: 0xaa4444,
            [CardType.SKILL]: 0x44aa44,
            [CardType.POWER]: 0x6c5ce7
        };
        this.glowColor = colors[card.type] || 0xffffff;

        // Glow (hidden by default)
        this.glowGraphic = scene.add.graphics();
        this.glowGraphic.lineStyle(14, this.glowColor, 0.4);
        this.glowGraphic.strokeRoundedRect(-85, -125, 170, 250, 16);
        this.glowGraphic.setAlpha(0);
        this.add(this.glowGraphic);

        // Card Background
        this.bgGraphic = scene.add.graphics();
        this.bgGraphic.fillStyle(0x2d3436, 1);
        this.bgGraphic.fillRoundedRect(-80, -120, 160, 240, 12);
        this.bgGraphic.fillStyle(0x000000, 0.4);
        this.bgGraphic.fillRect(-70, -70, 140, 100);
        this.bgGraphic.lineStyle(6, this.glowColor, 1);
        this.bgGraphic.strokeRoundedRect(-80, -120, 160, 240, 12);
        this.add(this.bgGraphic);

        // Card Art
        const artKey = this.getArtKey(card);
        const art = scene.add.image(0, -20, artKey).setDisplaySize(130, 90);
        this.add(art);

        // Cost Badge
        const costBg = scene.add.circle(-65, -105, 20, 0x0984e3);
        costBg.setStrokeStyle(3, 0x74b9ff);
        this.add(costBg);
        const costText = scene.add.text(-65, -105, card.cost.toString(), {
            fontSize: '24px', fontStyle: 'bold', color: '#fff', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5);
        this.add(costText);

        // Title
        const titleBg = scene.add.graphics();
        titleBg.fillStyle(0x000000, 0.6);
        titleBg.fillRect(-70, -110, 140, 30);
        this.add(titleBg);
        const titleText = scene.add.text(0, -95, card.title, {
            fontSize: '18px', fontStyle: 'bold', color: '#fff'
        }).setOrigin(0.5);
        this.add(titleText);

        // Type
        const typeText = scene.add.text(0, 38, card.type, {
            fontSize: '12px', fontStyle: 'italic', color: '#b2bec3'
        }).setOrigin(0.5);
        this.add(typeText);

        // Description
        const descText = scene.add.text(0, 70, card.description, {
            fontSize: '13px', color: '#dfe6e9', align: 'center', wordWrap: { width: 140 }, lineSpacing: 1
        }).setOrigin(0.5, 0.5);
        this.add(descText);

        // Exhaust indicator
        if (card.exhaust) {
            const exText = scene.add.text(0, 108, 'Exhaust', {
                fontSize: '11px', fontStyle: 'italic', color: '#a29bfe'
            }).setOrigin(0.5);
            this.add(exText);
        }

        // Drag trail particle emitter
        this.trailEmitter = scene.add.particles(0, 0, 'flare', {
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.5, end: 0 },
            tint: this.glowColor,
            lifespan: 300,
            blendMode: 'ADD',
            emitting: false
        }).setDepth(1500);

        // Interactivity
        this.setSize(160, 240);
        this.setInteractive({ useHandCursor: true });
        scene.input.setDraggable(this);

        this.on('pointerover', () => {
            if (!(this as any).isDragging) {
                this.scene.sound.play('sfx-ui-hover', { volume: 0.4, rate: 1.0 + (Math.random() * 0.2 - 0.1) });
                this.scene.tweens.add({
                    targets: this,
                    scaleX: 1.4, scaleY: 1.4,
                    y: (this as any).baseY - 180,
                    rotation: 0,
                    duration: 150, ease: 'Power2'
                });
                this.setDepth(100);
                this.scene.handContainer.bringToTop(this);
                this.scene.handContainer.setDepth(100);
                this.glowGraphic.setAlpha(1);
            }
        });

        this.on('pointerout', () => {
            if (!(this as any).isDragging && !(this as any).played) {
                this.setDepth((this as any).baseDepth);
                this.scene.handContainer.sort('depth');
                this.scene.handContainer.setDepth(0);
                this.glowGraphic.setAlpha(0);
                this.scene.tweens.add({
                    targets: this,
                    scaleX: 1.0, scaleY: 1.0,
                    x: (this as any).baseX,
                    y: (this as any).baseY,
                    rotation: (this as any).baseRotation,
                    duration: 150, ease: 'Power2'
                });
            }
        });
    }

    getArtKey(card: Card): string {
        if (card.title === 'Strike') return 'card_strike';
        if (card.title === 'Defend') return 'card_defend';
        if (card.title === 'Shockwave') return 'card_ripAndTear';
        if (card.title === 'Empower') return 'card_ripAndTear';
        if (card.title === 'Flow') return 'card_defend';
        return 'card_ripAndTear';
    }

    updateAffordability(canAfford: boolean) {
        this.bgGraphic.clear();
        this.bgGraphic.fillStyle(0x2d3436, 1);
        this.bgGraphic.fillRoundedRect(-80, -120, 160, 240, 12);
        this.bgGraphic.fillStyle(0x000000, 0.4);
        this.bgGraphic.fillRect(-70, -70, 140, 100);
        this.bgGraphic.lineStyle(6, canAfford ? this.glowColor : 0x444444, 1);
        this.bgGraphic.strokeRoundedRect(-80, -120, 160, 240, 12);
        this.setAlpha(canAfford ? 1.0 : 0.6);
    }
}
