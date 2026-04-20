// ABOUTME: Run-start blessing choice. 3 random blessings from the pool of 7.
// ABOUTME: Ceremonial Ghibli presentation — dark shrine, god rays, floating cards with shimmer on hover.
import * as Phaser from 'phaser';
import type { RunState } from '../models/RunState';
import type { BlessingDef } from '../content/blessings';
import { pickBlessings } from '../content/blessings';
import { applyOutcomes } from '../run/applyOutcomes';
import { setPhase } from '../run/transitions';
import { createRunRng } from '../run/rng';

export interface BlessingSceneData {
  runState: RunState;
}

export class BlessingScene extends Phaser.Scene {
  private runState!: RunState;
  private blessings!: BlessingDef[];

  constructor() { super('BlessingScene'); }

  init(data: BlessingSceneData): void {
    this.runState = data.runState;
    const rng = createRunRng(Date.now());
    this.blessings = pickBlessings(rng, 3);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1a0f06');
    this.cameras.main.fadeIn(600, 10, 5, 2);

    this.drawAtmosphere();
    this.drawHeader();
    this.drawOffers();
  }

  private drawAtmosphere(): void {
    // Soft god rays from the top of the screen — ceremonial shrine lighting.
    const rays = this.add.graphics().setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD);
    const drawRays = () => {
      rays.clear();
      rays.fillStyle(0xfff5d0, 0.4);
      [180, 520, 880].forEach(offset => {
        rays.beginPath();
        rays.moveTo(offset, -100);
        rays.lineTo(offset + 360, 800);
        rays.lineTo(offset + 540, 800);
        rays.lineTo(offset + 180, -100);
        rays.closePath();
        rays.fillPath();
      });
    };
    drawRays();
    this.tweens.add({ targets: rays, alpha: 0.08, duration: 7500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Floating dust motes for atmosphere.
    this.add.particles(0, 0, 'flare', {
      x: { min: 0, max: 1280 },
      y: { min: 0, max: 720 },
      lifespan: 8000,
      speed: { min: 5, max: 15 },
      scale: { start: 0.01, end: 0.04 },
      alpha: { start: 0, end: 0.22, ease: 'Sine.easeInOut' },
      tint: 0xfff5d0,
      frequency: 220,
      blendMode: Phaser.BlendModes.ADD,
    });
  }

  private drawHeader(): void {
    const title = this.add.text(640, 100, 'Choose your blessing', {
      fontSize: '44px', fontStyle: 'bold italic', color: '#efe5cc',
      shadow: { blur: 12, color: '#000', fill: true },
    }).setOrigin(0.5).setAlpha(0);

    const sub = this.add.text(640, 160, 'Your run begins with a gift.', {
      fontSize: '18px', color: '#c8b688', fontStyle: 'italic',
      shadow: { blur: 6, color: '#000', fill: true },
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: title, alpha: 1, y: 96, duration: 900, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: sub, alpha: 1, y: 156, duration: 900, delay: 200, ease: 'Sine.easeOut' });
  }

  private drawOffers(): void {
    this.blessings.forEach((b, i) => {
      const targetX = 640 + (i - 1) * 320;
      const targetY = 380;
      const card = this.add.container(targetX, targetY + 40).setAlpha(0);

      // Shadow grounds the card.
      card.add(this.add.ellipse(0, 170, 220, 32, 0x000000, 0.4));

      // Opaque parchment body — readable text against the dark shrine.
      const body = this.add.graphics();
      body.fillStyle(0xf4e8c5, 0.98);
      body.fillRoundedRect(-130, -150, 260, 300, 16);
      body.lineStyle(5, 0xc89b3c, 1);
      body.strokeRoundedRect(-130, -150, 260, 300, 16);
      body.lineStyle(2, 0x8a5a1c, 0.7);
      body.strokeRoundedRect(-122, -142, 244, 284, 12);
      card.add(body);

      // Title plate — wooden strip along the top.
      const plate = this.add.graphics();
      plate.fillStyle(0x3a2418, 0.92);
      plate.fillRoundedRect(-110, -175, 220, 46, 10);
      plate.lineStyle(2, 0xc89b3c, 1);
      plate.strokeRoundedRect(-110, -175, 220, 46, 10);
      card.add(plate);

      card.add(this.add.text(0, -152, b.name, {
        fontSize: '20px', fontStyle: 'bold', color: '#ffd700', align: 'center',
        wordWrap: { width: 200 },
      }).setOrigin(0.5));

      card.add(this.add.text(0, 10, b.description, {
        fontSize: '16px', color: '#3a2418', align: 'center',
        wordWrap: { width: 220 }, lineSpacing: 4,
      }).setOrigin(0.5));

      card.setSize(260, 300);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => this.pick(b, card));
      card.on('pointerover', () => {
        this.sound.play('sfx_hover', { volume: 0.25 });
        this.tweens.add({ targets: card, y: targetY - 10, scale: 1.05, duration: 260, ease: 'Back.easeOut' });
      });
      card.on('pointerout', () => {
        this.tweens.add({ targets: card, y: targetY, scale: 1.0, duration: 240, ease: 'Sine.easeOut' });
      });

      // Rise-in entrance, staggered.
      this.tweens.add({
        targets: card, y: targetY, alpha: 1,
        duration: 900, delay: 500 + i * 180, ease: 'Cubic.easeOut',
      });
    });
  }

  private pick(blessing: BlessingDef, card: Phaser.GameObjects.Container): void {
    this.sound.play('sfx_victory', { volume: 0.6 });
    // Chosen card pulses gold, others fade.
    this.tweens.add({ targets: card, scale: 1.12, duration: 280, yoyo: true, ease: 'Sine.easeInOut' });

    this.time.delayedCall(480, () => {
      const rng = createRunRng(Date.now() + 1);
      const outcomes = blessing.resolve(rng);
      applyOutcomes(this.runState, outcomes);
      setPhase(this.runState, 'MAP');
      this.cameras.main.fadeOut(500, 10, 5, 2);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('MapScene', { runState: this.runState });
      });
    });
  }
}
