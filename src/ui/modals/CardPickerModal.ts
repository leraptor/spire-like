// ABOUTME: Reusable modal that presents 1-of-N cards for the player to pick.
// ABOUTME: On pick, plays a "card flies into your deck" animation before resolving so the gain is legible.
import * as Phaser from 'phaser';
import type { Card } from '../../models/Card';
import { CardType } from '../../models/Card';

export interface CardPickerArgs {
  title: string;
  cards: Card[];
  allowSkip: boolean;
}

interface CardSlot {
  container: Phaser.GameObjects.Container;
  card: Card;
  x: number;
  y: number;
}

export class CardPickerModal extends Phaser.GameObjects.Container {
  private resolving = false;
  private slots: CardSlot[] = [];
  private titleText!: Phaser.GameObjects.Text;
  private skipControls: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly modalScene: Phaser.Scene,
    args: CardPickerArgs,
    private readonly onResolve: (picked: Card | null) => void,
  ) {
    super(modalScene, 0, 0);

    const dim = modalScene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.7).setInteractive();
    this.add(dim);

    this.titleText = modalScene.add.text(640, 100, args.title, {
      fontSize: '36px', fontStyle: 'bold', color: '#efe5cc',
    }).setOrigin(0.5);
    this.add(this.titleText);

    args.cards.forEach((card, i) => {
      const x = 640 + (i - (args.cards.length - 1) / 2) * 200;
      const y = 360;
      const cardContainer = this.buildCardView(card, x, y);
      cardContainer.on('pointerdown', () => this.pick(card, cardContainer));
      cardContainer.on('pointerover', () => { if (!this.resolving) cardContainer.setScale(1.05); });
      cardContainer.on('pointerout', () => { if (!this.resolving) cardContainer.setScale(1.0); });
      this.add(cardContainer);
      this.slots.push({ container: cardContainer, card, x, y });
    });

    if (args.allowSkip) {
      const skipBtn = modalScene.add.rectangle(640, 620, 200, 50, 0x6b4a2b)
        .setStrokeStyle(3, 0xc89b3c).setInteractive({ useHandCursor: true });
      const skipText = modalScene.add.text(640, 620, 'Skip', {
        fontSize: '22px', fontStyle: 'bold', color: '#efe5cc',
      }).setOrigin(0.5);
      this.add(skipBtn);
      this.add(skipText);
      skipBtn.on('pointerdown', () => this.skip());
      this.skipControls.push(skipBtn, skipText);
    }

    this.setScrollFactor(0);
    this.setDepth(2000);
  }

  private buildCardView(card: Card, x: number, y: number): Phaser.GameObjects.Container {
    const colors: Record<string, number> = {
      [CardType.ATTACK]: 0xaa4444,
      [CardType.SKILL]: 0x44aa44,
      [CardType.POWER]: 0x6c5ce7,
    };
    const c = this.modalScene.add.container(x, y);
    const bg = this.modalScene.add.graphics();
    bg.fillStyle(0x2d3436, 1);
    bg.fillRoundedRect(-80, -120, 160, 240, 12);
    bg.lineStyle(6, colors[card.type] ?? 0xffffff, 1);
    bg.strokeRoundedRect(-80, -120, 160, 240, 12);
    c.add(bg);
    const costBg = this.modalScene.add.circle(-65, -105, 20, 0x0984e3).setStrokeStyle(3, 0x74b9ff);
    c.add(costBg);
    c.add(this.modalScene.add.text(-65, -105, card.cost.toString(), {
      fontSize: '22px', fontStyle: 'bold', color: '#fff',
    }).setOrigin(0.5));
    c.add(this.modalScene.add.text(0, -95, card.title, {
      fontSize: '18px', fontStyle: 'bold', color: '#fff',
    }).setOrigin(0.5));
    c.add(this.modalScene.add.text(0, 38, card.type, {
      fontSize: '12px', fontStyle: 'italic', color: '#b2bec3',
    }).setOrigin(0.5));
    c.add(this.modalScene.add.text(0, 70, card.description, {
      fontSize: '12px', color: '#dfe6e9', align: 'center', wordWrap: { width: 150 },
    }).setOrigin(0.5, 0));
    c.setSize(160, 240).setInteractive({ useHandCursor: true });
    return c;
  }

  private skip(): void {
    if (this.resolving) return;
    this.resolving = true;
    this.onResolve(null);
    this.destroy();
  }

  private pick(card: Card, chosen: Phaser.GameObjects.Container): void {
    if (this.resolving) return;
    this.resolving = true;

    this.modalScene.sound.play('sfx_card_draw', { volume: 0.55 });

    // Fade the other slots + title + skip so attention locks on the chosen card.
    this.slots.forEach(slot => {
      if (slot.container === chosen) return;
      this.modalScene.tweens.add({
        targets: slot.container, alpha: 0, scale: 0.85, duration: 260, ease: 'Sine.easeIn',
      });
    });
    this.modalScene.tweens.add({ targets: this.titleText, alpha: 0, duration: 220 });
    this.skipControls.forEach(o => this.modalScene.tweens.add({ targets: o, alpha: 0, duration: 220 }));

    // Pop the chosen card forward, then fly to the bottom-right "deck" slot.
    const deckTargetX = 1210;
    const deckTargetY = 720 - 40;

    // Trailing sparkle particles that follow the card in flight.
    const trail = this.modalScene.add.particles(chosen.x, chosen.y, 'flare', {
      lifespan: 450,
      speed: { min: 10, max: 40 },
      scale: { start: 0.18, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xffe7a8, 0xfff3d0, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 30,
    }).setDepth(2100);

    // Stage 1: pop forward + a brief bright pulse.
    this.modalScene.tweens.add({
      targets: chosen, scale: 1.2, duration: 220, ease: 'Back.easeOut',
      onComplete: () => this.flyToDeck(chosen, card, deckTargetX, deckTargetY, trail),
    });
  }

  private flyToDeck(
    chosen: Phaser.GameObjects.Container,
    card: Card,
    tx: number, ty: number,
    trail: Phaser.GameObjects.Particles.ParticleEmitter,
  ): void {
    // Arc the card down-right toward the deck. Use an Update tick to move the trail emitter with it.
    const follow = this.modalScene.time.addEvent({
      delay: 16, loop: true,
      callback: () => trail.setPosition(chosen.x, chosen.y),
    });

    // Slight angular tilt so the card looks like it's being thrown.
    this.modalScene.tweens.add({
      targets: chosen, angle: 18, duration: 650, ease: 'Sine.easeIn',
    });

    this.modalScene.tweens.add({
      targets: chosen,
      x: tx, y: ty,
      scale: 0.25,
      duration: 650, ease: 'Cubic.easeIn',
      onComplete: () => {
        // Land: small flash at the target + a second card_draw sfx for "into deck" confirm.
        this.modalScene.sound.play('sfx_card_play', { volume: 0.4 });
        const flash = this.modalScene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(2100);
        flash.fillStyle(0xffe7a8, 0.8);
        flash.fillCircle(tx, ty, 22);
        flash.fillStyle(0xfff3d0, 0.55);
        flash.fillCircle(tx, ty, 34);
        this.modalScene.tweens.add({
          targets: flash, alpha: 0, scale: 2.2, duration: 350, ease: 'Cubic.easeOut',
          onComplete: () => flash.destroy(),
        });
        follow.remove();
        trail.stop();
        this.modalScene.time.delayedCall(500, () => trail.destroy());
        // Hand the card to the caller, then close.
        this.modalScene.time.delayedCall(180, () => {
          this.onResolve(card);
          this.destroy();
        });
      },
    });
  }
}
