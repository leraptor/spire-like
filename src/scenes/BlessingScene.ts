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

  preload(): void {
    this.load.image('blessing_shrine_bg', 'assets/blessing/shrine_bg.png');
    this.load.image('blessing_deity', 'assets/blessing/deity.png');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0a0612');
    this.cameras.main.fadeIn(700, 10, 5, 2);

    this.drawBackdrop();
    this.drawDeity();
    this.drawMistVeil();     // depth plane between deity and camera
    this.drawSnow();         // full-screen snow shader on top of the scene
    this.drawAtmosphere();
    this.drawHeader();
    this.drawOffers();       // staggered delay so intro lands first

    // A single scroll-unfurl on entry — thematic, already CC0 in the project.
    this.sound.play('map-scroll-unfurl', { volume: 0.4 });
  }

  private drawSnow(): void {
    // Two-layer particle snowfall: distant small flakes (slow, pale) + near larger flakes
    // (faster, brighter). Gives depth without the shader-port headaches.
    this.add.particles(0, 0, 'flare', {
      x: { min: -40, max: 1320 },
      y: { min: -40, max: 0 },
      lifespan: 9000,
      gravityY: 16,
      speedX: { min: -12, max: -2 },
      scale: { start: 0.08, end: 0.05 },
      alpha: { start: 0, end: 0.55, ease: 'Sine.easeInOut' },
      tint: [0xffffff, 0xe4ecff, 0xd8e0f0],
      frequency: 90,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(48);

    this.add.particles(0, 0, 'flare', {
      x: { min: -40, max: 1320 },
      y: { min: -40, max: 0 },
      lifespan: 7000,
      gravityY: 36,
      speedX: { min: -30, max: -5 },
      scale: { start: 0.18, end: 0.1 },
      alpha: { start: 0, end: 0.85, ease: 'Sine.easeInOut' },
      tint: 0xffffff,
      frequency: 180,
      rotate: { min: 0, max: 360 },
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(50);
  }

  private drawMistVeil(): void {
    // Slow-drifting mist layer between the deity and the camera. Sells depth.
    this.add.particles(0, 0, 'flare', {
      x: { min: 0, max: 1280 },
      y: { min: 120, max: 440 },
      lifespan: 9000,
      speedX: { min: -8, max: 12 },
      scale: { start: 0.4, end: 1.1 },
      alpha: { start: 0, end: 0.08, ease: 'Sine.easeInOut' },
      tint: [0xc8b688, 0xa8aacc, 0xeed89a],
      frequency: 320,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(25);
  }

  private drawBackdrop(): void {
    const bg = this.add.image(640, 360, 'blessing_shrine_bg').setOrigin(0.5);
    const sx = 1280 / bg.width;
    const sy = 720 / bg.height;
    bg.setScale(Math.max(sx, sy));
    // Gentle breathing — very subtle so it reads as atmosphere, not motion sickness.
    this.tweens.add({
      targets: bg, scale: Math.max(sx, sy) * 1.015,
      duration: 14000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    // Dim the bg slightly so cards + deity catch focus.
    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.18);
  }

  private drawDeity(): void {
    // Soft golden aura sits behind the deity.
    const aura = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    for (let i = 0; i < 6; i++) {
      aura.fillStyle(0xffd89a, 0.06 + i * 0.02);
      aura.fillCircle(640, 260, 240 - i * 30);
    }
    this.tweens.add({ targets: aura, alpha: 0.9, duration: 2200, delay: 700, ease: 'Sine.easeOut' });
    this.tweens.add({
      targets: aura, alpha: 0.55,
      duration: 3400, delay: 2900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Floor glow where the deity "stands" — sells her presence in the scene.
    const floorGlow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    for (let i = 0; i < 4; i++) {
      floorGlow.fillStyle(0xffd89a, 0.12 + i * 0.04);
      floorGlow.fillEllipse(620, 360, 260 - i * 40, 28 - i * 4);
    }
    this.tweens.add({ targets: floorGlow, alpha: 0.85, duration: 1800, delay: 1200, ease: 'Sine.easeOut' });

    const deity = this.add.image(620, 50, 'blessing_deity').setOrigin(0.5, 0).setAlpha(0);
    // Upper ~300px of screen — head at y=50, feet around y=350. Slight off-center x=620 for asymmetry.
    deity.setScale(300 / deity.height);
    deity.y = 80;
    this.tweens.add({
      targets: deity, alpha: 1, y: 50,
      duration: 1800, delay: 400, ease: 'Sine.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: deity, y: 44,
          duration: 4200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      },
    });
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
    // Gold-leaf title + hand-drawn brushstroke underline to anchor it.
    const title = this.add.text(640, 370, 'A Spirit\'s Gift', {
      fontSize: '42px', fontStyle: 'bold italic', color: '#ffe7a8',
      shadow: { blur: 14, color: '#000', fill: true, offsetX: 0, offsetY: 2 },
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 1400, delay: 1800, ease: 'Sine.easeOut' });

    // Ink brushstroke under the title — tapered ellipses simulating a painted flourish.
    const stroke = this.add.graphics().setAlpha(0);
    stroke.fillStyle(0xc8b688, 0.92);
    stroke.fillEllipse(640, 397, 180, 3);
    stroke.fillStyle(0xc8b688, 0.75);
    stroke.fillEllipse(640, 397, 220, 1.4);
    stroke.fillStyle(0x8a5a1c, 0.6);
    stroke.fillCircle(528, 397, 2);
    stroke.fillCircle(752, 397, 2.5);
    this.tweens.add({ targets: stroke, alpha: 1, duration: 1000, delay: 2200, ease: 'Sine.easeOut' });

    const sub = this.add.text(640, 418, 'Accept what the spirit offers. The road answers to your choice.', {
      fontSize: '17px', color: '#efe5cc', fontStyle: 'italic',
      shadow: { blur: 8, color: '#000', fill: true },
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 0.85, duration: 1200, delay: 2400, ease: 'Sine.easeOut' });
  }

  private drawOffers(): void {
    // Delayed entrance — intro beats (deity rise, title, aura bloom) land first.
    const baseDelay = 2600;

    this.blessings.forEach((b, i) => {
      const targetX = 640 + (i - 1) * 320;
      const targetY = 565;
      const card = this.add.container(targetX, targetY + 60).setAlpha(0);

      // Shadow grounds the card against the dark shrine floor.
      card.add(this.add.ellipse(4, 170, 220, 28, 0x000000, 0.55));

      // Deep indigo body echoing the scene palette — not shop cream.
      const body = this.add.graphics();
      body.fillStyle(0x1a1834, 0.96);
      body.fillRoundedRect(-130, -150, 260, 300, 14);
      body.lineStyle(3, 0xc8b688, 0.9);
      body.strokeRoundedRect(-130, -150, 260, 300, 14);
      body.lineStyle(1, 0xffd89a, 0.55);
      body.strokeRoundedRect(-122, -142, 244, 284, 10);
      card.add(body);

      // Parchment inset where the description reads — keeps text legible.
      const inset = this.add.graphics();
      inset.fillStyle(0xefe5cc, 0.94);
      inset.fillRoundedRect(-110, -80, 220, 180, 10);
      inset.lineStyle(1, 0x8a5a1c, 0.6);
      inset.strokeRoundedRect(-110, -80, 220, 180, 10);
      card.add(inset);

      // Hand-drawn ink sigil centered in the inset — faint so it sits behind text.
      const sigil = this.add.graphics().setAlpha(0.18);
      sigil.lineStyle(2, 0x3a2418, 1);
      sigil.strokeCircle(0, 8, 48);
      sigil.lineStyle(1.5, 0x3a2418, 1);
      sigil.strokeCircle(0, 8, 36);
      // Three small brush dots at cardinal points for a sealed-gift feel.
      sigil.fillStyle(0x8a5a1c, 1);
      sigil.fillCircle(0, -34, 3);
      sigil.fillCircle(32, 8, 2.5);
      sigil.fillCircle(-32, 8, 2.5);
      sigil.fillCircle(0, 50, 2.5);
      card.add(sigil);

      // Title plate — ink-black ribbon with gold trim along the top edge.
      const plate = this.add.graphics();
      plate.fillStyle(0x0a0818, 1);
      plate.fillRoundedRect(-115, -178, 230, 52, 10);
      plate.lineStyle(2, 0xc8b688, 1);
      plate.strokeRoundedRect(-115, -178, 230, 52, 10);
      plate.lineStyle(1, 0xffd89a, 0.7);
      plate.strokeRoundedRect(-109, -172, 218, 40, 7);
      card.add(plate);

      card.add(this.add.text(0, -152, b.name, {
        fontSize: '20px', fontStyle: 'bold italic', color: '#ffe7a8', align: 'center',
        wordWrap: { width: 210 },
      }).setOrigin(0.5));

      card.add(this.add.text(0, 10, b.description, {
        fontSize: '15px', color: '#3a2418', align: 'center',
        wordWrap: { width: 200 }, lineSpacing: 4,
      }).setOrigin(0.5));

      card.setSize(260, 300);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => this.pick(b, card));
      card.on('pointerover', () => {
        this.sound.play('sfx_hover', { volume: 0.3 });
        this.tweens.add({ targets: card, y: targetY - 14, scale: 1.05, duration: 260, ease: 'Back.easeOut' });
      });
      card.on('pointerout', () => {
        this.tweens.add({ targets: card, y: targetY, scale: 1.0, duration: 240, ease: 'Sine.easeOut' });
      });

      this.tweens.add({
        targets: card, y: targetY, alpha: 1,
        duration: 900, delay: baseDelay + i * 180, ease: 'Cubic.easeOut',
      });
    });
  }

  private pick(blessing: BlessingDef, card: Phaser.GameObjects.Container): void {
    this.sound.play('sfx_victory', { volume: 0.5 });
    // Card pulse.
    this.tweens.add({ targets: card, scale: 1.12, duration: 280, yoyo: true, ease: 'Sine.easeInOut' });

    // Deity reaction — a golden shock-ring expanding from her hands toward the player.
    const ring = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9);
    ring.lineStyle(6, 0xffe7a8, 1);
    ring.strokeCircle(620, 220, 30);
    this.tweens.add({
      targets: ring, scaleX: 14, scaleY: 14, alpha: 0,
      duration: 700, ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });

    // Aura flash from the deity — radial gold burst particles.
    this.add.particles(620, 260, 'flare', {
      lifespan: 900,
      speed: { min: 140, max: 320 },
      scale: { start: 0.55, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffe7a8, 0xffd89a, 0xfff6d0],
      blendMode: Phaser.BlendModes.ADD,
      quantity: 60,
      duration: 200,
    });

    this.time.delayedCall(700, () => {
      const rng = createRunRng(Date.now() + 1);
      const outcomes = blessing.resolve(rng);
      applyOutcomes(this.runState, outcomes);
      setPhase(this.runState, 'MAP');
      this.cameras.main.fadeOut(600, 10, 5, 2);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('MapScene', { runState: this.runState });
      });
    });
  }
}
