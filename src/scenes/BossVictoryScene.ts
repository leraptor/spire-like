// ABOUTME: Full-screen boss victory presentation. Owns rendering + input; delegates state to BossVictoryFlow (pure logic).
// ABOUTME: Redesigned as a triumphant Ghibli dawn ceremony with unique centerpiece props and atmospheric framing.
import * as Phaser from 'phaser';
import type { RunState } from '../models/RunState';
import { BossVictoryFlow } from '../run-end/RunEndFlow';
import { enterBodyScene } from './bodySceneHelpers';
import { EpochProgress } from '../meta/EpochProgress';

export class BossVictoryScene extends Phaser.Scene {
  private runState!: RunState;
  private flow!: BossVictoryFlow;

  constructor() { super('BossVictoryScene'); }

  init(data: { runState: RunState }): void {
    this.runState = data.runState;
    this.flow = new BossVictoryFlow(this.runState);
  }

  preload(): void {
    this.load.image('victory_bg', 'assets/run-end/victory_bg.png');
    this.load.image('prop_victory', 'assets/run-end/prop_victory.png');
  }

  create(): void {
    enterBodyScene(this);
    this.drawCeremonialBackground();
    this.drawVignetteFrame();
    this.drawContent();
    this.drawContinueButton();
  }

  private drawCeremonialBackground(): void {
    const bg = this.add.image(640, 360, 'victory_bg').setOrigin(0.5);
    this.tweens.add({ targets: bg, scale: 1.05, duration: 15000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // God Rays
    const rays = this.add.graphics().setAlpha(0.2).setBlendMode(Phaser.BlendModes.ADD);
    const draw = () => {
      rays.clear(); rays.fillStyle(0xfff3d0, 0.4);
      [100, 400, 700, 1000].forEach(offset => {
        rays.beginPath(); rays.moveTo(offset, -100); rays.lineTo(offset + 300, 800);
        rays.lineTo(offset + 500, 800); rays.lineTo(offset + 200, -100);
        rays.closePath(); rays.fillPath();
      });
    };
    draw();
    this.tweens.add({ targets: rays, alpha: 0.1, duration: 8000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Golden Particles
    this.add.particles(0, 0, 'flare', {
      x: { min: 0, max: 1280 }, y: { min: 0, max: 720 }, lifespan: 8000,
      speed: { min: 5, max: 20 }, scale: { start: 0.01, end: 0.04 },
      alpha: { start: 0, end: 0.2, ease: 'Sine.easeInOut' },
      tint: [0xffd700, 0xffffff], frequency: 150, blendMode: Phaser.BlendModes.ADD
    });
  }

  private drawVignetteFrame(): void {
    const g = this.add.graphics().setDepth(5).setAlpha(0.7);
    g.fillStyle(0x1a0f08, 0.4);
    g.fillRect(0, 0, 1280, 720);
    // Radial cutout focus
    g.setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  private drawContent(): void {
    const v = this.flow.view();

    // Center Prop
    const halo = this.add.sprite(640, 420, 'flare').setTint(0xffd700).setAlpha(0.2).setScale(4).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: halo, alpha: 0.4, scale: 4.5, duration: 2000, yoyo: true, repeat: -1 });

    const prop = this.add.image(640, 420, 'prop_victory').setOrigin(0.5).setScale(0.8);
    this.tweens.add({ targets: prop, y: 410, duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const title = this.add.text(640, 150, 'TRIUMPH', {
      fontSize: '84px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#8a5a1c', strokeThickness: 12, letterSpacing: 10,
      shadow: { blur: 20, color: '#000', fill: true }
    }).setOrigin(0.5);

    this.add.text(640, 230, 'The region yields to your strength.', {
      fontSize: '24px', color: '#efe5cc', fontStyle: 'italic',
      shadow: { blur: 10, color: '#000', fill: true }
    }).setOrigin(0.5);

    // Stats
    const stats = [
      `Victories: ${v.enemiesDefeated}`,
      `Health: ${v.finalHp} / ${v.maxHp}`,
      `Treasures: ${v.gold} G · ${v.relicCount} Relics`,
    ].join('   ·   ');
    
    this.add.text(640, 520, stats, {
      fontSize: '20px', fontStyle: 'bold', color: '#ffffff', align: 'center',
      backgroundColor: 'rgba(0,0,0,0.3)', padding: { x: 20, y: 10 }
    }).setOrigin(0.5);
  }

  private drawContinueButton(): void {
    const btn = this.add.container(640, 620);
    const bg = this.add.graphics();
    bg.fillStyle(0x4a321c, 1); bg.fillRoundedRect(-130, -30, 260, 60, 15);
    bg.lineStyle(4, 0xc89b3c, 1); bg.strokeRoundedRect(-130, -30, 260, 60, 15);
    btn.add(bg);

    const text = this.add.text(0, 0, 'CONTINUE', { fontSize: '28px', fontStyle: 'bold', color: '#efe5cc', letterSpacing: 2 }).setOrigin(0.5);
    btn.add(text);

    btn.setSize(260, 60).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => { this.tweens.add({ targets: btn, scale: 1.1, duration: 200, ease: 'Back.easeOut' }); this.sound.play('sfx_hover', { volume: 0.3 }); });
    btn.on('pointerout', () => this.tweens.add({ targets: btn, scale: 1.0, duration: 200 }));
    btn.on('pointerdown', () => { this.sound.play('sfx_button'); this.confirm(); });
  }

  private confirm(): void {
    // Record unlocks from this completed run, then route to the between-runs epoch timeline.
    const progress = new EpochProgress(this.game);
    const newlyUnlockedIds = progress.recordRunEnd(this.runState);

    this.cameras.main.fadeOut(800, 255, 255, 255);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop();
      if (this.scene.isActive('MapScene')) this.scene.stop('MapScene');
      if (this.scene.isActive('HudScene')) this.scene.stop('HudScene');
      this.scene.start('EpochTimelineScene', { newlyUnlockedIds });
    });
  }
}
