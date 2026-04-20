// ABOUTME: Full-screen death presentation. Owns rendering + input; delegates state to DeathFlow (pure logic).
// ABOUTME: Redesigned as a somber, dignified winter scene with unique centerpiece props and a quiet atmosphere.
import * as Phaser from 'phaser';
import type { RunState } from '../models/RunState';
import { DeathFlow } from '../run-end/RunEndFlow';
import { enterBodyScene } from './bodySceneHelpers';
import { EpochProgress } from '../meta/EpochProgress';

export class DeathScene extends Phaser.Scene {
  private runState!: RunState;
  private flow!: DeathFlow;

  constructor() { super('DeathScene'); }

  init(data: { runState: RunState }): void {
    this.runState = data.runState;
    this.flow = new DeathFlow(this.runState);
  }

  preload(): void {
    this.load.image('death_bg', 'assets/run-end/death_bg.png');
    this.load.image('prop_death', 'assets/run-end/prop_death.png');
  }

  create(): void {
    enterBodyScene(this);
    this.drawBackground();
    this.createSnow();
    this.drawContent();
    this.drawContinueButton();
  }

  private drawBackground(): void {
    const bg = this.add.image(640, 360, 'death_bg').setOrigin(0.5);
    // Cold, desaturated feel with slow cinematic zoom-in
    this.tweens.add({ targets: bg, scale: 1.1, duration: 30000, repeat: 0, ease: 'Sine.easeOut' });
  }

  private createSnow(): void {
    this.add.particles(0, 0, 'flare', {
      x: { min: 0, max: 1280 }, y: -50, lifespan: 10000,
      speedY: { min: 20, max: 50 }, speedX: { min: -10, max: 10 },
      scale: { start: 0.1, end: 0.2 }, alpha: { start: 0.6, end: 0 },
      tint: 0xeeeeff, frequency: 300, gravityY: 10
    });
  }

  private drawContent(): void {
    const v = this.flow.view();

    const prop = this.add.image(640, 420, 'prop_death').setOrigin(0.5).setScale(0.85);
    this.tweens.add({ targets: prop, alpha: 0.6, duration: 3000, yoyo: true, repeat: -1 });

    const title = this.add.text(640, 180, 'REST IN PEACE', {
      fontSize: '84px', fontStyle: 'bold italic', color: '#dfe6e9',
      shadow: { blur: 15, color: '#000', fill: true }
    }).setOrigin(0.5);
    title.setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 3000, ease: 'Sine.easeIn' });

    const summary = [
      `Foes vanquished: ${v.enemiesDefeated}`,
      `Gold gathered: ${v.gold} G   ·   Relics found: ${v.relicCount}`,
      `End of Epoch ${v.epoch}`,
    ].join('   ·   ');
    
    const statsText = this.add.text(640, 520, summary, {
      fontSize: '20px', color: '#b2bec3', align: 'center', fontStyle: 'bold'
    }).setOrigin(0.5);
    statsText.setAlpha(0);
    this.tweens.add({ targets: statsText, alpha: 1, duration: 2000, delay: 1500, ease: 'Sine.easeIn' });
  }

  private drawContinueButton(): void {
    const btn = this.add.container(640, 620);
    btn.setAlpha(0);

    const bg = this.add.graphics();
    bg.fillStyle(0x2d3436, 0.8); bg.fillRoundedRect(-130, -30, 260, 60, 15);
    bg.lineStyle(3, 0x636e72, 1); bg.strokeRoundedRect(-130, -30, 260, 60, 15);
    btn.add(bg);

    btn.add(this.add.text(0, 0, 'NEW RUN', { fontSize: '24px', fontStyle: 'bold', color: '#dfe6e9', letterSpacing: 2 }).setOrigin(0.5));
    btn.setSize(260, 60).setInteractive({ useHandCursor: true });
    
    this.tweens.add({ targets: btn, alpha: 1, duration: 1500, delay: 3000, ease: 'Sine.easeIn' });

    btn.on('pointerover', () => { this.tweens.add({ targets: btn, scale: 1.05, duration: 200 }); this.sound.play('sfx_hover', { volume: 0.2 }); });
    btn.on('pointerout', () => this.tweens.add({ targets: btn, scale: 1.0, duration: 200 }));
    btn.on('pointerdown', () => { this.sound.play('sfx_button'); this.confirm(); });
  }

  private confirm(): void {
    const progress = new EpochProgress(this.game);
    const newlyUnlockedIds = progress.recordRunEnd(this.runState);

    this.cameras.main.fadeOut(1000, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop();
      if (this.scene.isActive('MapScene')) this.scene.stop('MapScene');
      if (this.scene.isActive('HudScene')) this.scene.stop('HudScene');
      this.scene.start('EpochTimelineScene', { newlyUnlockedIds });
    });
  }
}
