// ABOUTME: Full-screen epoch-unlock celebration. Owns rendering + input; delegates state to EpochUnlockFlow (pure logic).
// ABOUTME: Redesigned as a ceremonial scroll unfurling in a mystical library with unique centerpiece props.
import * as Phaser from 'phaser';
import type { RunState } from '../models/RunState';
import { EpochUnlockFlow } from '../run-end/RunEndFlow';
import { setPhase } from '../run/transitions';
import { enterBodyScene } from './bodySceneHelpers';

export class EpochUnlockScene extends Phaser.Scene {
  private runState!: RunState;
  private flow!: EpochUnlockFlow;

  constructor() { super('EpochUnlockScene'); }

  init(data: { runState: RunState }): void {
    this.runState = data.runState;
    this.flow = new EpochUnlockFlow(this.runState);
  }

  preload(): void {
    this.load.image('unlock_bg', 'assets/run-end/unlock_bg.png');
    this.load.image('scroll_long', 'assets/run-end/scroll_long.png');
    this.load.image('wax_seal', 'assets/run-end/wax_seal.png');
  }

  create(): void {
    enterBodyScene(this);
    const view = this.flow.view();
    if (!view) {
      setPhase(this.runState, 'MAP');
      this.scene.stop();
      return;
    }

    this.drawBackground();
    this.drawScroll(view);
  }

  private drawBackground(): void {
    const bg = this.add.image(640, 360, 'unlock_bg').setOrigin(0.5);
    this.tweens.add({ targets: bg, scale: 1.05, duration: 15000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Golden Particles
    this.add.particles(0, 0, 'flare', {
      x: { min: 0, max: 1280 }, y: { min: 0, max: 720 }, lifespan: 8000,
      speed: { min: 10, max: 30 }, scale: { start: 0.02, end: 0.05 },
      alpha: { start: 0, end: 0.3, ease: 'Sine.easeInOut' },
      tint: 0xffd700, frequency: 150, blendMode: Phaser.BlendModes.ADD
    });
  }

  private drawScroll(view: NonNullable<ReturnType<EpochUnlockFlow['view']>>): void {
    const scroll = this.add.container(640, 360);
    scroll.setAlpha(0);

    // Soft drop shadow grounds the scroll against the library backdrop.
    const shadow = this.add.ellipse(0, 330, 380, 80, 0x000000, 0.45);
    scroll.add(shadow);

    const scrollImg = this.add.image(0, 0, 'scroll_long').setScale(0.95);
    scroll.add(scrollImg);

    const title = this.add.text(0, -260, `EPOCH ${view.epoch} UNLOCKED`, {
      fontSize: '30px', fontStyle: 'bold italic', color: '#3a2418', align: 'center',
    }).setOrigin(0.5);
    scroll.add(title);

    // Ceremonial wax seal — sits between the title and description as a sigil of unlock.
    const seal = this.add.image(0, -155, 'wax_seal').setScale(0.25);
    this.tweens.add({ targets: seal, scale: 0.26, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scroll.add(seal);

    const desc = this.add.text(0, -40, view.description, {
      fontSize: '18px', color: '#4a321c', align: 'center', wordWrap: { width: 330 },
      lineSpacing: 6,
    }).setOrigin(0.5);
    scroll.add(desc);

    const stats = this.add.text(0, 120,
      `Challenge Level: Higher\nPotions: ${view.potionSlots} Slots`,
      { fontSize: '18px', color: '#3a2418', align: 'center', fontStyle: 'bold', lineSpacing: 4 }
    ).setOrigin(0.5);
    scroll.add(stats);

    // Unroll Animation with Magical Trail
    scroll.y = 800;
    this.sound.play('map-scroll-unfurl');
    
    const trail = this.add.particles(0, 0, 'flare', {
      lifespan: 1000, speed: { min: 20, max: 100 }, scale: { start: 0.1, end: 0 },
      alpha: { start: 0.8, end: 0 }, tint: 0xffd700, blendMode: Phaser.BlendModes.ADD,
      follow: scroll, followOffset: { x: -300, y: 0 } // left edge
    });

    this.tweens.add({
      targets: scroll, y: 360, alpha: 1, duration: 1200, ease: 'Back.easeOut',
      onComplete: () => { trail.stop(); this.time.delayedCall(1000, () => trail.destroy()); }
    });

    this.drawContinueButton(view, scroll);
  }

  private drawContinueButton(view: NonNullable<ReturnType<EpochUnlockFlow['view']>>, container: Phaser.GameObjects.Container): void {
    const btn = this.add.container(0, 260);
    container.add(btn);

    const bg = this.add.graphics();
    bg.fillStyle(0x4a321c, 1); bg.fillRoundedRect(-140, -30, 280, 60, 15);
    bg.lineStyle(4, 0xc89b3c, 1); bg.strokeRoundedRect(-140, -30, 280, 60, 15);
    btn.add(bg);

    btn.add(this.add.text(0, 0, `ENTER EPOCH ${view.epoch}`, { fontSize: '22px', fontStyle: 'bold', color: '#efe5cc', letterSpacing: 2 }).setOrigin(0.5));
    btn.setSize(280, 60).setInteractive({ useHandCursor: true });
    
    btn.on('pointerover', () => { this.tweens.add({ targets: btn, scale: 1.05, duration: 200 }); this.sound.play('sfx_hover', { volume: 0.3 }); });
    btn.on('pointerout', () => this.tweens.add({ targets: btn, scale: 1.0, duration: 200 }));
    btn.on('pointerdown', () => { this.sound.play('sfx_button'); this.confirm(); });
  }

  private confirm(): void {
    const action = this.flow.nextAction();
    this.cameras.main.fadeOut(800, 255, 255, 255);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop();
      const epoch = action.kind === 'restart_run' ? action.epoch : this.runState.currentEpoch;
      this.scene.start('BootScene', { forceNewRun: true, epoch });
    });
  }
}
