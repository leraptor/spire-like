// ABOUTME: Full-screen chest body scene. Four-pass redesign: moonlit forgotten glade, hinge-opening chest,
// ABOUTME: ceremonial loot reveal with scroll-ribbon banners, "pick one" constraint messaging.
import * as Phaser from 'phaser';
import type { RunState } from '../models/RunState';
import type { RunOutcome } from '../models/RunOutcome';
import { RELICS } from '../content/relics';
import { pickCardsByRarity } from '../content/cards';
import { createRunRng, pickFrom } from '../run/rng';
import { CardPickerModal } from '../ui/modals/CardPickerModal';
import { enterBodyScene, exitBodyScene } from './bodySceneHelpers';

interface LootOption {
  key: string;
  label: string;
  sub: string;
  onClick: () => void;
}

export class ChestScene extends Phaser.Scene {
  private runState!: RunState;
  private isOpening = false;

  // Layers
  private chestLayer!: Phaser.GameObjects.Container;
  private lootLayer!: Phaser.GameObjects.Container;
  private narrationLayer!: Phaser.GameObjects.Container;
  private bgTint!: Phaser.GameObjects.Rectangle;

  // Chest refs
  private chestClosed!: Phaser.GameObjects.Image;
  private chestOpen!: Phaser.GameObjects.Image;
  private chestBreath!: Phaser.Tweens.Tween;
  private hintButton!: Phaser.GameObjects.Container;
  private chestShadow!: Phaser.GameObjects.Ellipse;

  private lootOptions: LootOption[] = [];
  private selectedIndex: number | null = null;

  constructor() { super('ChestScene'); }

  init(data: { runState: RunState }): void {
    this.runState = data.runState;
    this.isOpening = false;
    this.selectedIndex = null;
  }

  preload(): void {
    this.load.image('chest_bg', 'assets/chest/chest_bg.png');
    this.load.image('chest_closed', 'assets/chest/chest_closed.png');
    this.load.image('chest_open', 'assets/chest/chest_open.png');
    this.load.image('loot_gold', 'assets/chest/loot_gold.png');
    this.load.image('loot_relic', 'assets/chest/loot_relic.png');
    this.load.image('loot_card', 'assets/chest/loot_card.png');
  }

  create(): void {
    enterBodyScene(this);
    const rng = createRunRng(Date.now());
    const relic = pickFrom(RELICS, rng);
    const cards = pickCardsByRarity(rng, 3, 'uncommon');

    this.drawBackdrop();
    this.drawChestLayer();
    this.drawNarration();

    this.lootOptions = [
      {
        key: 'loot_gold', label: 'A Pouch of Coin', sub: '25 gold pieces, heavy in the hand.',
        onClick: () => this.finish([{ kind: 'gold', amount: 25 }]),
      },
      {
        key: 'loot_relic', label: relic.name, sub: relic.description,
        onClick: () => this.finish([{ kind: 'add_relic', relic }]),
      },
      {
        key: 'loot_card', label: 'A Mystic Scroll', sub: 'Three cards are hidden within. Pick one for your deck.',
        onClick: () => {
          const picker = new CardPickerModal(this,
            { title: 'Pick a card from the scroll', cards: [...cards], allowSkip: true },
            (picked) => this.finish(picked ? [{ kind: 'add_card', card: picked }] : [{ kind: 'none' }]));
          this.add.existing(picker);
        },
      },
    ];
    this.drawLootLayer();
  }

  private drawBackdrop(): void {
    // Opaque dark-indigo base so the painted bg can be slightly scaled without edge bleed.
    this.add.rectangle(640, 360, 1280, 720, 0x0a0812).setOrigin(0.5);
    const bg = this.add.image(640, 360, 'chest_bg').setOrigin(0.5);
    const sx = 1280 / bg.width;
    const sy = 720 / bg.height;
    bg.setScale(Math.max(sx, sy));
    this.tweens.add({
      targets: bg, scale: Math.max(sx, sy) * 1.02,
      duration: 18000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Drifting fireflies atmosphere layer.
    this.add.particles(0, 0, 'flare', {
      x: { min: 0, max: 1280 },
      y: { min: 120, max: 620 },
      lifespan: 6000,
      speedX: { min: -14, max: 14 },
      speedY: { min: -8, max: 8 },
      scale: { start: 0.06, end: 0.02 },
      alpha: { start: 0, end: 0.55, ease: 'Sine.easeInOut' },
      tint: [0xffd89a, 0xc8f0d0, 0xffe7a8],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 180,
    }).setDepth(8);

    // Overlay that darkens scene on pre-open, lifts + warms when chest opens.
    this.bgTint = this.add.rectangle(640, 360, 1280, 720, 0x0a0812, 0.25).setOrigin(0.5).setDepth(4);
  }

  private drawNarration(): void {
    this.narrationLayer = this.add.container(0, 0);
    // Strip at the top so the narration reads regardless of the scene detail behind it.
    const strip = this.add.graphics();
    strip.fillStyle(0x000000, 0.4);
    strip.fillRect(0, 30, 1280, 62);
    this.narrationLayer.add(strip);

    const line = this.add.text(640, 62, 'An old tomb-chest, long forgotten. Its seal still holds.', {
      fontSize: '24px', fontStyle: 'italic', color: '#ffe7a8', align: 'center',
      shadow: { blur: 10, color: '#000', fill: true, offsetY: 1 },
    }).setOrigin(0.5).setAlpha(0);
    this.narrationLayer.add(line);
    this.tweens.add({ targets: line, alpha: 1, duration: 1400, delay: 500, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: strip, alpha: { from: 0, to: 1 }, duration: 800, delay: 200, ease: 'Sine.easeOut' });
  }

  private drawChestLayer(): void {
    this.chestLayer = this.add.container(640, 440).setDepth(20);

    // Soft cast-shadow pool on the ground, stays grounded no matter what the chest does.
    this.chestShadow = this.add.ellipse(0, 140, 360, 38, 0x000000, 0.6);
    this.chestLayer.add(this.chestShadow);

    // Soft warm floor-pool of light the chest casts forward when open. Subtle halo,
    // not a neon cone — reads as ambient "the ground is lit" rather than geometry.
    const lightCone = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    lightCone.fillStyle(0xffd89a, 0.16);
    lightCone.fillEllipse(0, 140, 420, 110);
    lightCone.fillStyle(0xfff3d0, 0.12);
    lightCone.fillEllipse(0, 140, 320, 80);
    lightCone.fillStyle(0xffe7a8, 0.08);
    lightCone.fillEllipse(0, 140, 240, 56);
    this.chestLayer.add(lightCone);
    (this.chestLayer as unknown as { __lightCone: Phaser.GameObjects.Graphics }).__lightCone = lightCone;

    // Open chest sits underneath the closed one, hidden until reveal.
    this.chestOpen = this.add.image(0, 0, 'chest_open').setOrigin(0.5, 0.85).setScale(0.48).setVisible(false);
    this.chestLayer.add(this.chestOpen);

    this.chestClosed = this.add.image(0, 0, 'chest_closed').setOrigin(0.5, 0.85).setScale(0.48)
      .setInteractive({ useHandCursor: true });
    this.chestLayer.add(this.chestClosed);

    // Anticipation: chest breathes subtly and a faint warm glow pulses from the keyhole area.
    this.chestBreath = this.tweens.add({
      targets: this.chestClosed, y: -4,
      duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Faint keyhole glow pulse.
    const keyGlow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    keyGlow.fillStyle(0xffd89a, 0.35);
    keyGlow.fillCircle(0, -40, 28);
    this.chestLayer.add(keyGlow);
    this.tweens.add({
      targets: keyGlow, alpha: { from: 0.25, to: 0.7 },
      duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Visible "OPEN" button below the chest — offset so it stays fully in the viewport.
    this.hintButton = this.makeButton(0, 220, 'OPEN THE CHEST', () => this.openChest());
    this.chestLayer.add(this.hintButton);

    this.chestClosed.on('pointerdown', () => this.openChest());
    this.chestClosed.on('pointerover', () => {
      this.tweens.add({ targets: this.chestClosed, scale: 0.5, duration: 180, ease: 'Back.easeOut' });
    });
    this.chestClosed.on('pointerout', () => {
      this.tweens.add({ targets: this.chestClosed, scale: 0.48, duration: 180, ease: 'Sine.easeOut' });
    });
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const btn = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(0x3a1f10, 0.94);
    bg.fillRoundedRect(-150, -28, 300, 56, 12);
    bg.lineStyle(3, 0xc8b688, 1);
    bg.strokeRoundedRect(-150, -28, 300, 56, 12);
    bg.lineStyle(1, 0xffd89a, 0.6);
    bg.strokeRoundedRect(-144, -22, 288, 44, 8);
    btn.add(bg);
    btn.add(this.add.text(0, 0, label, {
      fontSize: '20px', fontStyle: 'bold italic', color: '#ffe7a8', letterSpacing: 2,
    }).setOrigin(0.5));
    btn.setSize(300, 56).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => { this.sound.play('sfx_button', { volume: 0.4 }); onClick(); });
    btn.on('pointerover', () => this.tweens.add({ targets: btn, scale: 1.06, duration: 160, ease: 'Back.easeOut' }));
    btn.on('pointerout', () => this.tweens.add({ targets: btn, scale: 1.0, duration: 160 }));
    return btn;
  }

  private drawLootLayer(): void {
    this.lootLayer = this.add.container(640, 360).setAlpha(0).setVisible(false).setDepth(30);

    // "Pick only ONE" constraint banner.
    const constraint = this.add.text(0, -220, 'BUT YOU MAY TAKE ONLY ONE', {
      fontSize: '20px', fontStyle: 'bold italic', color: '#ffd89a', letterSpacing: 3,
      shadow: { blur: 10, color: '#000', fill: true, offsetY: 1 },
    }).setOrigin(0.5);
    this.lootLayer.add(constraint);

    this.lootOptions.forEach((opt, i) => {
      // Wider spread so side items clearly flank the chest instead of overlapping its body.
      const x = (i - 1) * 380;
      const y = 20;
      const card = this.add.container(x, y);
      this.lootLayer.add(card);

      // Grounding shadow.
      card.add(this.add.ellipse(4, 170, 170, 22, 0x000000, 0.55));

      const icon = this.add.image(0, 0, opt.key);
      // Normalize display size — cap by the larger dimension to ~200px regardless of source.
      const iconScale = 200 / Math.max(icon.width, icon.height);
      icon.setScale(iconScale);
      card.add(icon);
      // Subtle golden halo behind each loot icon.
      const halo = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8);
      halo.fillStyle(0xffd89a, 0.12);
      halo.fillCircle(0, 0, 100);
      halo.fillStyle(0xffe7a8, 0.08);
      halo.fillCircle(0, 0, 130);
      card.addAt(halo, 1);

      // Scroll-ribbon banner label — painted, not UI-chromed.
      const ribbon = this.add.graphics();
      ribbon.fillStyle(0x2a1410, 0.94);
      ribbon.fillRoundedRect(-110, 100, 220, 52, 8);
      ribbon.lineStyle(2, 0xc8b688, 1);
      ribbon.strokeRoundedRect(-110, 100, 220, 52, 8);
      ribbon.lineStyle(1, 0xffd89a, 0.6);
      ribbon.strokeRoundedRect(-104, 106, 208, 40, 6);
      // Ribbon tails on both sides for a scroll feel.
      ribbon.fillTriangle(-110, 100, -124, 126, -110, 152);
      ribbon.fillTriangle(110, 100, 124, 126, 110, 152);
      ribbon.lineStyle(2, 0xc8b688, 1);
      ribbon.strokeTriangle(-110, 100, -124, 126, -110, 152);
      ribbon.strokeTriangle(110, 100, 124, 126, 110, 152);
      card.add(ribbon);

      card.add(this.add.text(0, 126, opt.label, {
        fontSize: '19px', fontStyle: 'bold italic', color: '#ffe7a8', align: 'center',
        wordWrap: { width: 208 },
        shadow: { blur: 6, color: '#000', fill: true, offsetY: 1 },
      }).setOrigin(0.5));

      // Interactive hit area covers the whole card zone.
      card.setSize(240, 300);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => this.pickLoot(i));
      card.on('pointerover', () => {
        this.sound.play('sfx_hover', { volume: 0.3 });
        // Lift the focused card; slightly recede the others for competition.
        this.tweens.add({ targets: card, y: y - 18, scale: 1.08, duration: 220, ease: 'Back.easeOut' });
        this.lootLayer.list.forEach((c: Phaser.GameObjects.GameObject) => {
          if (c === card || c === constraint) return;
          this.tweens.add({ targets: c, scale: 0.94, alpha: 0.75, duration: 220, ease: 'Sine.easeOut' });
        });
      });
      card.on('pointerout', () => {
        this.tweens.add({ targets: card, y, scale: 1.0, duration: 220, ease: 'Sine.easeOut' });
        this.lootLayer.list.forEach((c: Phaser.GameObjects.GameObject) => {
          if (c === card || c === constraint) return;
          this.tweens.add({ targets: c, scale: 1.0, alpha: 1.0, duration: 220, ease: 'Sine.easeOut' });
        });
      });
    });

    // Skip button in the corner — lets players leave empty-handed if they want.
    const skip = this.add.text(640, 380, 'Close the chest and walk away', {
      fontSize: '14px', fontStyle: 'italic', color: '#a8a8b8',
      shadow: { blur: 6, color: '#000', fill: true },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    skip.on('pointerdown', () => this.finish([{ kind: 'none' }]));
    skip.on('pointerover', () => skip.setColor('#ffd89a'));
    skip.on('pointerout', () => skip.setColor('#a8a8b8'));
    this.lootLayer.add(skip);
  }

  private openChest(): void {
    if (this.isOpening) return;
    this.isOpening = true;

    this.sound.play('map-scroll-unfurl', { volume: 0.5 });

    // Freeze anticipation + kill the OPEN button.
    this.chestBreath.stop();
    this.tweens.add({ targets: this.hintButton, alpha: 0, scale: 0.8, duration: 220, ease: 'Sine.easeIn' });
    this.tweens.add({ targets: this.narrationLayer, alpha: 0, duration: 350, ease: 'Sine.easeIn' });

    // Camera punch-in on the chest.
    this.cameras.main.pan(640, 460, 450, 'Sine.easeInOut');
    this.cameras.main.zoomTo(1.2, 450, 'Sine.easeInOut');
    this.time.delayedCall(600, () => {
      this.cameras.main.zoomTo(1.0, 500, 'Sine.easeOut');
      this.cameras.main.pan(640, 360, 500, 'Sine.easeOut');
    });

    // Lid hinge: tilt closed image up, swap to open asset at peak, small shake.
    this.tweens.add({
      targets: this.chestClosed, angle: -8, y: -18,
      duration: 220, ease: 'Cubic.easeIn',
      onComplete: () => {
        this.chestClosed.setVisible(false);
        this.chestOpen.setVisible(true);
        this.chestOpen.setScale(0.44);
        this.tweens.add({ targets: this.chestOpen, scale: 0.48, duration: 300, ease: 'Back.easeOut' });
        this.cameras.main.shake(160, 0.004);
        this.sound.play('sfx_slam', { volume: 0.35 });

        // Fade in the warm light cone spilling forward from the opened chest.
        const cone = (this.chestLayer as unknown as { __lightCone?: Phaser.GameObjects.Graphics }).__lightCone;
        if (cone) this.tweens.add({ targets: cone, alpha: 0.7, duration: 500, ease: 'Sine.easeOut' });
      },
    });

    // Light burst spilling out of the chest.
    this.add.particles(640, 430, 'flare', {
      lifespan: 1600,
      speed: { min: 120, max: 480 },
      angle: { min: 240, max: 300 },
      scale: { start: 0.35, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xfff3d0, 0xffd700, 0xffe7a8],
      blendMode: Phaser.BlendModes.ADD,
      quantity: 80, duration: 200,
    }).setDepth(25);

    // Atmospheric warm-up: bg tint brightens + turns warmer during reveal.
    this.tweens.add({
      targets: this.bgTint, fillAlpha: 0.08,
      duration: 500, ease: 'Sine.easeOut',
    });
    this.bgTint.fillColor = 0xffa844;

    // Loot reveal after the chest settles.
    this.time.delayedCall(650, () => this.revealLoot());
  }

  private revealLoot(): void {
    this.lootLayer.setVisible(true);
    this.tweens.add({ targets: this.lootLayer, alpha: 1, duration: 500 });

    // Each loot card rises from the chest with a slight overshoot, as if being pushed up by the burst.
    this.lootLayer.list.forEach((go: Phaser.GameObjects.GameObject, i: number) => {
      if ((go as Phaser.GameObjects.Text).type === 'Text') return;
      const c = go as Phaser.GameObjects.Container;
      const targetY = c.y;
      c.y = targetY + 180;
      c.alpha = 0;
      c.setScale(0.6);
      this.tweens.add({
        targets: c, y: targetY, alpha: 1, scale: 1.0,
        duration: 1000, delay: 120 + i * 160, ease: 'Back.easeOut',
      });
    });

    // Constraint text slides in after items are up.
    const constraint = this.lootLayer.list[0] as Phaser.GameObjects.Text | undefined;
    if (constraint) {
      constraint.setAlpha(0);
      this.tweens.add({ targets: constraint, alpha: 1, duration: 500, delay: 900, ease: 'Sine.easeOut' });
    }
  }

  private pickLoot(index: number): void {
    if (this.selectedIndex !== null) return;
    this.selectedIndex = index;

    this.sound.play('sfx_card_play', { volume: 0.6 });
    const opt = this.lootOptions[index]!;

    // Fade non-selected cards.
    this.lootLayer.list.forEach((go: Phaser.GameObjects.GameObject, i: number) => {
      if ((go as Phaser.GameObjects.Text).type === 'Text') {
        this.tweens.add({ targets: go, alpha: 0, duration: 250 });
        return;
      }
      if (i - 1 === index) {
        // +1 offset because container children include the constraint text at index 0.
        // Pulse the chosen card.
        this.tweens.add({ targets: go, scale: 1.15, duration: 300, yoyo: true, ease: 'Sine.easeInOut' });
      } else {
        this.tweens.add({ targets: go, alpha: 0, scale: 0.85, duration: 320, ease: 'Sine.easeIn' });
      }
    });

    this.time.delayedCall(600, () => opt.onClick());
  }

  private finish(outcomes: RunOutcome[]): void {
    exitBodyScene(this, this.runState, outcomes, 'MAP');
  }
}
