// ABOUTME: Full-screen non-linear epoch selection scene. Renders all epochs as islands on a Ghibli watercolor map.
// ABOUTME: Owns rendering + input; delegates state to EpochTimelineFlow. High-fidelity cartographic aesthetic.
import * as Phaser from 'phaser';
import { EpochProgress } from '../meta/EpochProgress';
import { EpochTimelineFlow, type EpochNodeView } from '../epoch-timeline/EpochTimelineFlow';
import { enterBodyScene } from './bodySceneHelpers';

export interface EpochTimelineSceneData {
  /** Ids of epochs that were just unlocked — rendered with celebration state. */
  newlyUnlockedIds?: ReadonlyArray<number>;
}

export class EpochTimelineScene extends Phaser.Scene {
  private flow!: EpochTimelineFlow;
  private nodesLayer!: Phaser.GameObjects.Container;
  private bg!: Phaser.GameObjects.Image;
  private fogLayer!: Phaser.GameObjects.Graphics;

  constructor() { super('EpochTimelineScene'); }

  init(data: EpochTimelineSceneData = {}): void {
    const progress = new EpochProgress(this.game);
    this.flow = new EpochTimelineFlow({
      unlockedIds: progress.unlockedIds(),
      newlyUnlockedIds: data.newlyUnlockedIds ?? [],
    });
  }

  preload(): void {
    // Unique Assets
    this.load.image('timeline_bg', 'assets/epoch-timeline/timeline_bg.png');
    this.load.image('label_bg', 'assets/epoch-timeline/label_bg.png');
    for (let i = 0; i < 5; i++) {
      this.load.image(`epoch_icon_${i}`, `assets/epoch-timeline/epoch_${i}.png`);
    }
  }

  create(): void {
    enterBodyScene(this);
    this.drawCeremonialBackground();
    
    this.nodesLayer = this.add.container(0, 0);
    this.drawTimeline();

    this.drawHeader();
    this.createAtmosphere();
  }

  private drawCeremonialBackground(): void {
    // Parallax background
    this.bg = this.add.image(640, 360, 'timeline_bg').setOrigin(0.5).setScale(1.1);
    this.tweens.add({
      targets: this.bg,
      scale: 1.15,
      duration: 20000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Dark vignette for focus
    const vignette = this.add.graphics().setDepth(5).setAlpha(0.4);
    vignette.fillStyle(0x000000, 1);
    vignette.fillRect(0, 0, 1280, 720);
    vignette.setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  private createAtmosphere(): void {
    // Golden dust motes
    this.add.particles(0, 0, 'flare', {
      x: { min: 0, max: 1280 },
      y: { min: 0, max: 720 },
      lifespan: 10000,
      speed: { min: 4, max: 12 },
      scale: { start: 0.01, end: 0.04 },
      alpha: { start: 0, end: 0.15, ease: 'Sine.easeInOut' },
      tint: 0xfff5d0,
      frequency: 200,
      blendMode: Phaser.BlendModes.ADD
    }).setDepth(100);
  }

  private drawHeader(): void {
    const header = this.add.container(640, 60).setDepth(200);
    
    header.add(this.add.text(0, 0, 'EPOCH TIMELINE', {
      fontSize: '52px', fontStyle: 'bold italic', color: '#ffffff',
      shadow: { blur: 20, color: '#000', fill: true }
    }).setOrigin(0.5));

    header.add(this.add.text(0, 45, 'Reflect on the past. Choose your next path.', {
      fontSize: '18px', fontStyle: 'italic', color: '#efe5cc',
      shadow: { blur: 8, color: '#000', fill: true }
    }).setOrigin(0.5));
  }

  private drawTimeline(): void {
    const view = this.flow.view();
    const positions = this.gridPositions(view.nodes.length);
    
    this.drawHandDrawnPaths(positions);

    view.nodes.forEach((node, i) => {
      const pos = positions[i];
      if (!pos) return;
      this.drawEpochNode(node, pos.x, pos.y, i);
    });
  }

  private drawHandDrawnPaths(positions: Array<{x: number, y: number}>): void {
     const g = this.add.graphics().setDepth(2);
     g.lineStyle(3, 0x2a1a0d, 0.4);
     
     for (let i = 0; i < positions.length - 1; i++) {
        const p1 = positions[i]!;
        const p2 = positions[i+1]!;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        
        const curve = new Phaser.Curves.CubicBezier(
           new Phaser.Math.Vector2(p1.x, p1.y),
           new Phaser.Math.Vector2(p1.x + dx * 0.4, p1.y + dy * 0.05),
           new Phaser.Math.Vector2(p1.x + dx * 0.6, p1.y + dy * 0.95),
           new Phaser.Math.Vector2(p2.x, p2.y)
        );
        curve.draw(g);
     }
  }

  private gridPositions(count: number): Array<{ x: number; y: number }> {
    const layout = [
      { x: 300, y: 380 },
      { x: 550, y: 260 },
      { x: 880, y: 260 },
      { x: 1120, y: 380 },
      { x: 710, y: 540 },
    ];
    return layout.slice(0, count);
  }

  private drawEpochNode(node: EpochNodeView, x: number, y: number, index: number): void {
    const container = this.add.container(x, y).setDepth(10);
    this.nodesLayer.add(container);

    const locked = node.state === 'locked';
    const newly = node.state === 'newly_unlocked';

    // Shadow
    container.add(this.add.ellipse(0, 60, 160, 40, 0x000000, 0.2));

    // Icon
    const icon = this.add.image(0, 0, `epoch_icon_${index}`).setScale(0.7);
    if (locked) {
      icon.setTint(0x1a1108).setAlpha(0.65);
    }
    container.add(icon);

    // Label Scroll
    const labelContainer = this.add.container(0, 115);
    container.add(labelContainer);

    const plate = this.add.image(0, 0, 'label_bg').setScale(0.85);
    if (locked) plate.setTint(0xaa9a8a).setAlpha(0.85);
    labelContainer.add(plate);

    // Opaque cream panel inside the scroll so the busy map watercolor doesn't bleed
    // through behind the text. Sized to sit inside the scroll's decorative rolled ends.
    const panel = this.add.rectangle(0, -8, 240, 96, 0xefe5cc, 0.97);
    if (locked) panel.setFillStyle(0xd9c9a0, 0.92);
    labelContainer.add(panel);

    const title = this.add.text(0, -35, node.name, {
      fontSize: '20px', fontStyle: 'bold', color: locked ? '#4a321c' : '#3a2418',
    }).setOrigin(0.5);
    labelContainer.add(title);

    const descText = locked ? `LOCKED · ${node.goalLabel}` : node.description;
    labelContainer.add(this.add.text(0, 8, descText, {
      fontSize: '14px', color: locked ? '#5a3a1a' : '#4a321c', align: 'center',
      wordWrap: { width: 220 }, lineSpacing: 2, fontStyle: locked ? 'bold italic' : 'italic',
    }).setOrigin(0.5));

    if (newly) {
      // Golden ceremonial glow
      const glow = this.add.sprite(0, 0, 'flare').setTint(0xffd700).setAlpha(0.6).setScale(2.5).setBlendMode(Phaser.BlendModes.ADD);
      container.addAt(glow, 0);
      this.tweens.add({ targets: glow, alpha: 0.1, scale: 3.5, duration: 1500, yoyo: true, repeat: -1 });
      
      // Floating animation
      this.tweens.add({ targets: container, y: y - 15, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    if (!locked) {
      container.setSize(240, 320);
      container.setInteractive({ useHandCursor: true });
      container.on('pointerdown', () => this.startRunIn(node.id));
      container.on('pointerover', () => {
        this.tweens.add({ targets: container, scale: 1.1, duration: 250, ease: 'Back.easeOut' });
        this.sound.play('sfx_hover', { volume: 0.2 });
      });
      container.on('pointerout', () => {
        this.tweens.add({ targets: container, scale: 1.0, duration: 200 });
      });
    }
  }

  private startRunIn(epochId: number): void {
    if (!this.flow.select(epochId)) return;
    this.sound.play('sfx_button');
    this.cameras.main.fadeOut(800, 255, 255, 255);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop();
      this.scene.start('BootScene', { forceNewRun: true, epoch: epochId });
    });
  }
}
