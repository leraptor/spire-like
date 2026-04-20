// ABOUTME: Reusable modal that presents 1-of-N cards for the player to pick.
// ABOUTME: Used by reward screens, chest, blessing, and event flows.
import * as Phaser from 'phaser';
import type { Card } from '../../models/Card';
import { CardType } from '../../models/Card';

export interface CardPickerArgs {
  title: string;
  cards: Card[];
  allowSkip: boolean;
}

export class CardPickerModal extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    args: CardPickerArgs,
    onResolve: (picked: Card | null) => void,
  ) {
    super(scene, 0, 0);

    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.7).setInteractive();
    this.add(dim);

    const title = scene.add.text(640, 100, args.title, {
      fontSize: '36px', fontStyle: 'bold', color: '#efe5cc',
    }).setOrigin(0.5);
    this.add(title);

    const colors: Record<string, number> = {
      [CardType.ATTACK]: 0xaa4444,
      [CardType.SKILL]: 0x44aa44,
      [CardType.POWER]: 0x6c5ce7,
    };

    args.cards.forEach((card, i) => {
      const x = 640 + (i - (args.cards.length - 1) / 2) * 200;
      const y = 360;

      const cardContainer = scene.add.container(x, y);
      const bg = scene.add.graphics();
      bg.fillStyle(0x2d3436, 1);
      bg.fillRoundedRect(-80, -120, 160, 240, 12);
      bg.lineStyle(6, colors[card.type] ?? 0xffffff, 1);
      bg.strokeRoundedRect(-80, -120, 160, 240, 12);
      cardContainer.add(bg);

      const costBg = scene.add.circle(-65, -105, 20, 0x0984e3).setStrokeStyle(3, 0x74b9ff);
      cardContainer.add(costBg);
      cardContainer.add(scene.add.text(-65, -105, card.cost.toString(), {
        fontSize: '22px', fontStyle: 'bold', color: '#fff',
      }).setOrigin(0.5));

      cardContainer.add(scene.add.text(0, -95, card.title, {
        fontSize: '18px', fontStyle: 'bold', color: '#fff',
      }).setOrigin(0.5));

      cardContainer.add(scene.add.text(0, 38, card.type, {
        fontSize: '12px', fontStyle: 'italic', color: '#b2bec3',
      }).setOrigin(0.5));

      cardContainer.add(scene.add.text(0, 70, card.description, {
        fontSize: '12px', color: '#dfe6e9', align: 'center', wordWrap: { width: 150 },
      }).setOrigin(0.5, 0));

      cardContainer.setSize(160, 240);
      cardContainer.setInteractive({ useHandCursor: true });
      cardContainer.on('pointerdown', () => {
        this.onResolveAndClose(onResolve, card);
      });
      cardContainer.on('pointerover', () => cardContainer.setScale(1.05));
      cardContainer.on('pointerout', () => cardContainer.setScale(1.0));
      this.add(cardContainer);
    });

    if (args.allowSkip) {
      const skipBtn = scene.add.rectangle(640, 620, 200, 50, 0x6b4a2b)
        .setStrokeStyle(3, 0xc89b3c).setInteractive({ useHandCursor: true });
      const skipText = scene.add.text(640, 620, 'Skip', {
        fontSize: '22px', fontStyle: 'bold', color: '#efe5cc',
      }).setOrigin(0.5);
      this.add(skipBtn);
      this.add(skipText);
      skipBtn.on('pointerdown', () => this.onResolveAndClose(onResolve, null));
    }

    this.setScrollFactor(0);
    this.setDepth(2000);
  }

  private onResolveAndClose(cb: (card: Card | null) => void, picked: Card | null): void {
    cb(picked);
    this.destroy();
  }
}
