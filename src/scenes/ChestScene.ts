// ABOUTME: Full-screen chest body scene. Two-stage Ghibli experience: closed chest first, then loot reveal.
// ABOUTME: Completely overhauled visuals and interactions to match the high-taste "Curiosity Cabinet" aesthetic.
import * as Phaser from 'phaser';
import type { RunState } from '../models/RunState';
import type { RunOutcome } from '../models/RunOutcome';
import { RELICS } from '../content/relics';
import { pickCardsByRarity } from '../content/cards';
import { createRunRng, pickFrom } from '../run/rng';
import { CardPickerModal } from '../ui/modals/CardPickerModal';
import { enterBodyScene, exitBodyScene } from './bodySceneHelpers';

export class ChestScene extends Phaser.Scene {
  private runState!: RunState;
  private isOpening = false;

  // Layer containers
  private bgLayer!: Phaser.GameObjects.Image;
  private chestLayer!: Phaser.GameObjects.Container;
  private lootLayer!: Phaser.GameObjects.Container;
  private inspectLayer!: Phaser.GameObjects.Container;

  // Chest refs
  private chestClosed!: Phaser.GameObjects.Image;
  private chestOpen!: Phaser.GameObjects.Image;
  private glowParticles!: Phaser.GameObjects.Particles.ParticleEmitter;

  // Inspection refs
  private inspectIcon!: Phaser.GameObjects.Image;
  private inspectTitle!: Phaser.GameObjects.Text;
  private inspectDesc!: Phaser.GameObjects.Text;
  private inspectBuyBtn!: Phaser.GameObjects.Container;
  private selectedLootIndex: number | null = null;
  private lootOptions: any[] = [];

  constructor() { super('ChestScene'); }

  init(data: { runState: RunState }): void { this.runState = data.runState; }

  preload(): void {
    // Chest Scene Assets
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

    // 1. Backdrop
    this.add.rectangle(640, 360, 1280, 720, 0xf4ecd8).setOrigin(0.5);
    this.bgLayer = this.add.image(640, 360, 'chest_bg').setOrigin(0.5).setAlpha(0.8);

    // 2. Chest Layer (Stage 1)
    this.drawChestLayer();

    // 3. Loot Layer (Stage 2 - Hidden)
    this.lootOptions = [
      {
        key: 'loot_gold',
        label: 'Coin Pouch',
        sub: 'A heavy bag containing 25 gold pieces.',
        outcome: [{ kind: 'gold' as const, amount: 25 }],
        onClick: () => this.finish([{ kind: 'gold', amount: 25 }]),
      },
      {
        key: 'loot_relic',
        label: relic.name,
        sub: relic.description,
        outcome: [{ kind: 'add_relic' as const, relic }],
        onClick: () => this.finish([{ kind: 'add_relic', relic }]),
      },
      {
        key: 'loot_card',
        label: 'Mystic Scroll',
        sub: 'Glimpse into the future. Choose 1 of 3 cards to add to your deck.',
        outcome: null, // Cards handled by picker
        onClick: () => {
          const picker = new CardPickerModal(this,
            { title: 'Pick a card from the chest', cards, allowSkip: true },
            (picked) => this.finish(picked ? [{ kind: 'add_card', card: picked }] : [{ kind: 'none' }]));
          this.add.existing(picker);
        },
      },
    ];
    this.drawLootLayer();

    // 4. Inspection Layer (Hidden)
    this.drawInspectLayer();

    // Atmospheric Polish
    this.createSubtleDust();
  }

  private drawChestLayer(): void {
    this.chestLayer = this.add.container(640, 480);
    
    // Shadow
    this.chestLayer.add(this.add.ellipse(0, 80, 400, 80, 0x000000, 0.2));

    this.chestOpen = this.add.image(0, 0, 'chest_open').setScale(0.8).setVisible(false);
    this.chestClosed = this.add.image(0, 0, 'chest_closed').setScale(0.8).setInteractive({ useHandCursor: true });
    
    this.chestLayer.add([this.chestOpen, this.chestClosed]);

    const hintText = this.add.text(0, 180, '( Tap to open )', {
      fontSize: '24px', color: '#ffffff', fontStyle: 'bold italic',
      stroke: '#4a321c', strokeThickness: 6
    }).setOrigin(0.5);
    this.chestLayer.add(hintText);
    this.tweens.add({ targets: hintText, alpha: 0.5, duration: 1000, yoyo: true, repeat: -1 });

    this.chestClosed.on('pointerdown', () => this.openChest());
    this.chestClosed.on('pointerover', () => this.tweens.add({ targets: this.chestLayer, scale: 1.05, duration: 200 }));
    this.chestClosed.on('pointerout', () => this.tweens.add({ targets: this.chestLayer, scale: 1.0, duration: 200 }));
  }

  private drawLootLayer(): void {
    this.lootLayer = this.add.container(640, 360).setAlpha(0).setVisible(false);

    this.lootOptions.forEach((opt, i) => {
      const x = (i - 1) * 320;
      const y = -100;
      const container = this.add.container(x, y);
      this.lootLayer.add(container);

      // Shadow
      container.add(this.add.ellipse(0, 70, 160, 40, 0x000000, 0.2));

      const icon = this.add.image(0, 0, opt.key).setScale(0.8).setInteractive({ useHandCursor: true });
      container.add(icon);

      // Label backing
      const plate = this.add.graphics();
      plate.fillStyle(0x000000, 0.5);
      plate.fillRoundedRect(-100, 50, 200, 50, 10);
      container.add(plate);

      const label = this.add.text(0, 75, opt.label, {
        fontSize: '20px', fontStyle: 'bold', color: '#ffffff', align: 'center', wordWrap: { width: 180 }
      }).setOrigin(0.5);
      container.add(label);

      icon.on('pointerdown', () => this.openInspect(i));
      icon.on('pointerover', () => this.tweens.add({ targets: container, y: y - 10, scale: 1.08, duration: 200, ease: 'Back.easeOut' }));
      icon.on('pointerout', () => this.tweens.add({ targets: container, y: y, scale: 1.0, duration: 200 }));
    });
  }

  private drawInspectLayer(): void {
    this.inspectLayer = this.add.container(0, 0).setAlpha(0).setVisible(false).setDepth(300);
    const shade = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.7).setInteractive();
    this.inspectLayer.add(shade);

    const panel = this.add.container(640, 360);
    this.inspectLayer.add(panel);

    const plate = this.add.graphics();
    plate.fillStyle(0xefe5cc, 1);
    plate.fillRoundedRect(-320, -260, 640, 520, 20);
    plate.lineStyle(6, 0x4a321c, 1);
    plate.strokeRoundedRect(-320, -260, 640, 520, 20);
    panel.add(plate);

    this.inspectIcon = this.add.image(0, -100, 'loot_gold').setScale(1.2);
    this.inspectTitle = this.add.text(0, 45, '', { fontSize: '36px', fontStyle: 'bold', color: '#4a321c' }).setOrigin(0.5);
    this.inspectDesc = this.add.text(0, 105, '', { fontSize: '20px', color: '#6b4a2b', align: 'center', wordWrap: { width: 540 } }).setOrigin(0.5);
    
    this.inspectBuyBtn = this.add.container(0, 200);
    const buyBg = this.add.graphics();
    buyBg.fillStyle(0x6b4a2b, 1); buyBg.fillRoundedRect(-140, -35, 280, 70, 12);
    buyBg.lineStyle(4, 0xc89b3c, 1); buyBg.strokeRoundedRect(-140, -35, 280, 70, 12);
    this.inspectBuyBtn.add(buyBg);

    const buyText = this.add.text(0, 0, 'COLLECT', { fontSize: '24px', fontStyle: 'bold', color: '#efe5cc' }).setOrigin(0.5);
    this.inspectBuyBtn.add(buyText);
    this.inspectBuyBtn.setSize(280, 70).setInteractive({ useHandCursor: true });
    this.inspectBuyBtn.on('pointerdown', () => this.confirmLoot());

    const cancelTip = this.add.text(0, 280, '( Tap anywhere to return )', { fontSize: '16px', color: '#ffffff' }).setOrigin(0.5).setAlpha(0.8);

    panel.add([this.inspectIcon, this.inspectTitle, this.inspectDesc, this.inspectBuyBtn]);
    this.inspectLayer.add(cancelTip);

    shade.on('pointerdown', () => this.closeInspect());
  }

  private openChest(): void {
    if (this.isOpening) return;
    this.isOpening = true;

    this.sound.play('map-scroll-unfurl');

    // 1. Lid animation
    this.chestClosed.setVisible(false);
    this.chestOpen.setVisible(true);
    this.chestOpen.setScale(0.1);
    this.tweens.add({ targets: this.chestOpen, scale: 0.8, duration: 400, ease: 'Back.easeOut' });

    // 2. Light Burst
    this.glowParticles = this.add.particles(640, 440, 'flare', {
      lifespan: 1500,
      speed: { min: 100, max: 400 },
      scale: { start: 0.2, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xfff3d0, 0xffd700],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false
    }).setDepth(50);
    this.glowParticles.explode(50);

    // 3. Reveal Loot
    this.time.delayedCall(400, () => {
      this.lootLayer.setVisible(true);
      this.tweens.add({ targets: this.lootLayer, alpha: 1, duration: 600 });
      
      // Items float up from chest
      this.lootLayer.list.forEach((container: any, i: number) => {
        const targetY = container.y;
        container.y += 100;
        container.alpha = 0;
        this.tweens.add({
          targets: container, y: targetY, alpha: 1,
          duration: 800, delay: i * 150, ease: 'Cubic.easeOut'
        });
      });
    });
  }

  private openInspect(index: number): void {
    const opt = this.lootOptions[index]!;
    this.selectedLootIndex = index;

    this.inspectIcon.setTexture(opt.key);
    this.inspectTitle.setText(opt.label);
    this.inspectDesc.setText(opt.sub);

    this.inspectLayer.setVisible(true);
    this.tweens.add({ targets: this.inspectLayer, alpha: 1, duration: 200 });
    this.sound.play('sfx_card_draw');
  }

  private closeInspect(): void {
    this.tweens.add({
      targets: this.inspectLayer, alpha: 0, duration: 200,
      onComplete: () => {
        this.inspectLayer.setVisible(false);
        this.selectedLootIndex = null;
      }
    });
  }

  private confirmLoot(): void {
    if (this.selectedLootIndex === null) return;
    const opt = this.lootOptions[this.selectedLootIndex]!;
    this.sound.play('sfx_card_play');
    opt.onClick();
  }

  private createSubtleDust(): void {
    this.add.particles(0, 0, 'flare', {
      x: { min: 0, max: 1280 }, y: { min: 0, max: 720 }, lifespan: 8000,
      speed: { min: 5, max: 15 }, scale: { start: 0.01, end: 0.05 },
      alpha: { start: 0, end: 0.15, ease: 'Sine.easeInOut' },
      rotate: { min: 0, max: 360 }, frequency: 200, tint: 0xffffff, blendMode: Phaser.BlendModes.ADD
    }).setDepth(100);
  }

  private finish(outcomes: RunOutcome[]): void {
    exitBodyScene(this, this.runState, outcomes, 'MAP');
  }

  private drawLeaveButton(): void {
    const leaveText = this.add.text(120, 680, 'SKIP', {
      fontSize: '28px', fontStyle: 'bold', color: '#ffffff', stroke: '#4a321c', strokeThickness: 6
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    this.lootLayer.add(leaveText);

    leaveText.on('pointerdown', () => this.finish([{ kind: 'none' }]));
    leaveText.on('pointerover', () => leaveText.setScale(1.1).setColor('#ffd700'));
    leaveText.on('pointerout', () => leaveText.setScale(1.0).setColor('#ffffff'));
  }
}
