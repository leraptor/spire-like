// ABOUTME: Full-screen post-combat reward presentation. Owns rendering + input; delegates all state to RewardChoices (pure logic).
// ABOUTME: Two-stage Ghibli experience: dramatic victory celebration followed by a magical loot reveal.
import * as Phaser from 'phaser';
import type { RunState } from '../models/RunState';
import { RewardChoices } from '../reward/RewardChoices';
import { CardPickerModal } from '../ui/modals/CardPickerModal';
import { enterBodyScene, exitBodyScene } from './bodySceneHelpers';

interface TileRefs {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
}

export class RewardScene extends Phaser.Scene {
  private runState!: RunState;
  private rewards!: RewardChoices;

  // Layers
  private bgLayer!: Phaser.GameObjects.Image;
  private introLayer!: Phaser.GameObjects.Container;
  private lootLayer!: Phaser.GameObjects.Container;
  private inspectOverlay!: Phaser.GameObjects.Container;

  // Refs
  private tiles: TileRefs[] = [];
  private victoryBanner!: Phaser.GameObjects.Image;
  private inspectIcon!: Phaser.GameObjects.Image;
  private inspectTitle!: Phaser.GameObjects.Text;
  private inspectDesc!: Phaser.GameObjects.Text;
  private inspectCollectBtn!: Phaser.GameObjects.Container;
  private selectedLootIndex: number | null = null;
  private lootOptions: any[] = [];

  constructor() { super('RewardScene'); }

  init(data: { runState: RunState }): void {
    this.runState = data.runState;
    this.rewards = new RewardChoices();
  }

  preload(): void {
    // Reward Scene Assets
    this.load.image('reward_bg', 'assets/reward/reward_bg.png');
    this.load.image('victory_banner', 'assets/reward/victory_banner.png');
    this.load.image('reward_icon_gold', 'assets/reward/icon_gold.png');
    this.load.image('reward_icon_card', 'assets/reward/icon_card_pick.png');
    this.load.image('reward_icon_potion', 'assets/reward/icon_potion.png');
  }

  create(): void {
    enterBodyScene(this);
    // 1. Static Backdrop
    this.add.rectangle(640, 360, 1280, 720, 0xf4ecd8).setOrigin(0.5);
    this.bgLayer = this.add.image(640, 360, 'reward_bg').setOrigin(0.5).setAlpha(0);

    // 2. Prepare Layers
    this.drawLootLayer();
    this.drawIntroLayer();
    this.drawInspectLayer();

    // Subtle atmospheric polish
    this.createSubtleDust();

    // Start Stage 1: Victory Celebration
    this.celebrateVictory();
  }

  private celebrateVictory(): void {
    this.sound.play('sfx_victory');
    
    // Victory Banner Drop
    this.victoryBanner.y = -200;
    this.victoryBanner.setAlpha(0);
    this.tweens.add({
      targets: this.victoryBanner,
      y: 360,
      alpha: 1,
      duration: 1000,
      ease: 'Back.easeOut'
    });

    // Particle Burst
    const emitter = this.add.particles(640, 360, 'flare', {
      lifespan: 2000,
      speed: { min: 150, max: 500 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xfff3d0, 0xffd700, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false
    });
    emitter.explode(60);

    // Automatic Transition to Stage 2 after 1.8s
    this.time.delayedCall(1800, () => this.transitionToLoot());
  }

  private transitionToLoot(): void {
    this.tweens.add({
      targets: this.introLayer,
      alpha: 0,
      duration: 600,
      onComplete: () => this.introLayer.destroy()
    });

    this.bgLayer.setAlpha(0);
    this.tweens.add({ targets: this.bgLayer, alpha: 1, duration: 1000 });

    this.lootLayer.setVisible(true);
    this.tweens.add({ targets: this.lootLayer, alpha: 1, duration: 800 });

    // Staggered entry for loot tiles
    this.tiles.forEach((tile, i) => {
      const targetY = tile.container.y;
      tile.container.y += 150;
      tile.container.alpha = 0;
      this.tweens.add({
        targets: tile.container,
        y: targetY,
        alpha: 1,
        duration: 800,
        delay: 400 + (i * 120),
        ease: 'Cubic.easeOut'
      });
    });
  }

  private drawIntroLayer(): void {
    this.introLayer = this.add.container(0, 0);
    const shade = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.4);
    this.introLayer.add(shade);

    this.victoryBanner = this.add.image(640, 360, 'victory_banner').setScale(1.2);
    this.introLayer.add(this.victoryBanner);
  }

  private drawLootLayer(): void {
    this.lootLayer = this.add.container(0, 0).setAlpha(0).setVisible(false);
    const view = this.rewards.view();

    this.lootOptions = [
      {
        key: 'reward_icon_gold',
        label: `${view.gold} Gold`,
        sub: 'Coin pouch gathered from the battlefield.',
        onClick: () => exitBodyScene(this, this.runState, this.rewards.asGoldOutcomes(), 'MAP'),
      },
      {
        key: 'reward_icon_card',
        label: 'Pick a Card',
        sub: 'A mystical choice from your fallen foes.',
        onClick: () => this.openCardPicker(),
      },
    ];

    if (view.potion) {
      this.lootOptions.push({
        key: 'reward_icon_potion',
        label: view.potion.name,
        sub: 'A powerful draught left behind.',
        onClick: () => exitBodyScene(this, this.runState, this.rewards.asPotionOutcomes(), 'MAP'),
      });
    }

    this.lootOptions.forEach((opt, i) => {
      const x = 640 + (i - (this.lootOptions.length - 1) / 2) * 320;
      const y = 340;
      this.tiles.push(this.drawLootTile(i, opt, x, y));
    });

    this.drawSkipButton();
  }

  private drawLootTile(index: number, opt: any, x: number, y: number): TileRefs {
    const container = this.add.container(x, y);
    this.lootLayer.add(container);

    container.add(this.add.ellipse(0, 75, 180, 45, 0x000000, 0.2));

    const icon = this.add.image(0, 0, opt.key).setScale(0.85).setInteractive({ useHandCursor: true });
    container.add(icon);

    const plate = this.add.graphics();
    plate.fillStyle(0x000000, 0.55);
    plate.fillRoundedRect(-100, 50, 200, 50, 10);
    container.add(plate);

    const label = this.add.text(0, 75, opt.label, {
      fontSize: '22px', fontStyle: 'bold', color: '#ffffff', align: 'center', wordWrap: { width: 180 }
    }).setOrigin(0.5);
    container.add(label);

    icon.on('pointerdown', () => this.openInspect(index));
    icon.on('pointerover', () => {
      this.tweens.add({ targets: container, y: y - 12, scale: 1.08, duration: 250, ease: 'Back.easeOut' });
      this.sound.play('sfx_hover', { volume: 0.2 });
    });
    icon.on('pointerout', () => this.tweens.add({ targets: container, y: y, scale: 1.0, duration: 200 }));

    return { container, label };
  }

  private drawInspectLayer(): void {
    this.inspectOverlay = this.add.container(0, 0).setAlpha(0).setVisible(false).setDepth(300);
    const shade = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.7).setInteractive();
    this.inspectOverlay.add(shade);

    const panel = this.add.container(640, 360);
    this.inspectOverlay.add(panel);

    const plate = this.add.graphics();
    plate.fillStyle(0xefe5cc, 1);
    plate.fillRoundedRect(-320, -260, 640, 520, 20);
    plate.lineStyle(6, 0x4a321c, 1);
    plate.strokeRoundedRect(-320, -260, 640, 520, 20);
    panel.add(plate);

    this.inspectIcon = this.add.image(0, -100, 'reward_icon_gold').setScale(1.2);
    this.inspectTitle = this.add.text(0, 45, '', { fontSize: '36px', fontStyle: 'bold', color: '#4a321c' }).setOrigin(0.5);
    this.inspectDesc = this.add.text(0, 105, '', { fontSize: '20px', color: '#6b4a2b', align: 'center', wordWrap: { width: 540 } }).setOrigin(0.5);
    
    this.inspectCollectBtn = this.add.container(0, 200);
    const buyBg = this.add.graphics();
    buyBg.fillStyle(0x6b4a2b, 1); buyBg.fillRoundedRect(-140, -35, 280, 70, 12);
    buyBg.lineStyle(4, 0xc89b3c, 1); buyBg.strokeRoundedRect(-140, -35, 280, 70, 12);
    this.inspectCollectBtn.add(buyBg);

    const buyText = this.add.text(0, 0, 'COLLECT', { fontSize: '24px', fontStyle: 'bold', color: '#efe5cc' }).setOrigin(0.5);
    this.inspectCollectBtn.add(buyText);
    this.inspectCollectBtn.setSize(280, 70).setInteractive({ useHandCursor: true });
    this.inspectCollectBtn.on('pointerdown', () => this.confirmLoot());

    const cancelTip = this.add.text(0, 280, '( Tap anywhere to return )', { fontSize: '16px', color: '#ffffff' }).setOrigin(0.5).setAlpha(0.8);

    panel.add([this.inspectIcon, this.inspectTitle, this.inspectDesc, this.inspectCollectBtn]);
    this.inspectOverlay.add(cancelTip);

    shade.on('pointerdown', () => this.closeInspect());
  }

  private openInspect(index: number): void {
    const opt = this.lootOptions[index]!;
    this.selectedLootIndex = index;

    this.inspectIcon.setTexture(opt.key);
    this.inspectTitle.setText(opt.label);
    this.inspectDesc.setText(opt.sub);

    this.inspectOverlay.setVisible(true);
    this.tweens.add({ targets: this.inspectOverlay, alpha: 1, duration: 200 });
    this.sound.play('sfx_card_draw');
  }

  private closeInspect(): void {
    this.tweens.add({
      targets: this.inspectOverlay, alpha: 0, duration: 200,
      onComplete: () => {
        this.inspectOverlay.setVisible(false);
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

  private drawSkipButton(): void {
    const skipContainer = this.add.container(640, 620);
    this.lootLayer.add(skipContainer);

    const sign = this.add.graphics();
    sign.fillStyle(0x4a321c, 1);
    sign.fillRoundedRect(-90, 0, 180, 60, 12);
    sign.lineStyle(4, 0xc89b3c, 1);
    sign.strokeRoundedRect(-90, 0, 180, 60, 12);
    skipContainer.add(sign);

    const text = this.add.text(0, 30, 'SKIP ALL', {
      fontSize: '24px', fontStyle: 'bold', color: '#efe5cc', letterSpacing: 2
    }).setOrigin(0.5);
    skipContainer.add(text);

    // Hanging chains
    const chains = this.add.graphics();
    chains.lineStyle(2, 0x2a1a0d, 1);
    chains.lineBetween(-70, -40, -70, 0);
    chains.lineBetween(70, -40, 70, 0);
    skipContainer.add(chains);

    skipContainer.setSize(180, 100).setInteractive({ useHandCursor: true });
    
    skipContainer.on('pointerdown', () => {
      this.sound.play('sfx_button');
      exitBodyScene(this, this.runState, this.rewards.asSkipOutcomes(), 'MAP');
    });
    
    skipContainer.on('pointerover', () => {
      this.tweens.add({
        targets: skipContainer,
        rotation: 0.08,
        duration: 800,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1
      });
      text.setColor('#ffd700');
    });
    
    skipContainer.on('pointerout', () => {
      this.tweens.add({
        targets: skipContainer,
        rotation: 0,
        duration: 500,
        ease: 'Bounce.easeOut'
      });
      text.setColor('#efe5cc');
    });
  }

  private openCardPicker(): void {
    const view = this.rewards.view();
    const picker = new CardPickerModal(
      this,
      { title: 'Choose a Reward Card', cards: [...view.cards], allowSkip: true },
      (picked) => {
        exitBodyScene(this, this.runState, this.rewards.asCardOutcomes(picked), 'MAP');
      },
    );
    this.add.existing(picker);
  }

  private createSubtleDust(): void {
    this.add.particles(0, 0, 'flare', {
      x: { min: 0, max: 1280 }, y: { min: 0, max: 720 }, lifespan: 8000,
      speed: { min: 4, max: 12 }, scale: { start: 0.01, end: 0.05 },
      alpha: { start: 0, end: 0.15, ease: 'Sine.easeInOut' },
      rotate: { min: 0, max: 360 }, frequency: 200, tint: 0xffffff, blendMode: Phaser.BlendModes.ADD
    }).setDepth(100);
  }
}
