// ABOUTME: Full-screen rest-site presentation. Owns rendering + input; delegates state to RestChoice (pure logic).
// ABOUTME: Completely redesigned as a cozy Ghibli-style hot spring moment with animated steam and HP restoration juice.
import * as Phaser from 'phaser';
import type { RunState } from '../models/RunState';
import { RestChoice } from '../rest/RestChoice';
import { enterBodyScene, exitBodyScene } from './bodySceneHelpers';

export class RestScene extends Phaser.Scene {
  private runState!: RunState;
  private rest!: RestChoice;
  private steamParticles!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() { super('RestScene'); }

  init(data: { runState: RunState }): void {
    this.runState = data.runState;
    this.rest = new RestChoice(this.runState);
  }

  preload(): void {
    this.load.image('rest_bg', 'assets/rest/rest_bg.png');
    this.load.image('rest_prop', 'assets/rest/rest_prop.png');
  }

  create(): void {
    enterBodyScene(this);
    const view = this.rest.view();

    // 1. Environment
    this.drawAtmosphere();

    // 2. HP Display & Interaction
    this.drawCozyUI(view);
  }

  private drawAtmosphere(): void {
    // Backdrop
    const bg = this.add.image(640, 360, 'rest_bg').setOrigin(0.5);
    
    // Subtle background breathing
    this.tweens.add({
      targets: bg,
      scale: 1.02,
      duration: 12000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Rising Steam Particles
    this.steamParticles = this.add.particles(640, 720, 'flare', {
      x: { min: 0, max: 1280 },
      y: { min: 400, max: 720 },
      lifespan: 4000,
      speedY: { min: -20, max: -50 },
      scale: { start: 0.2, end: 1.0 },
      alpha: { start: 0, end: 0.15, ease: 'Sine.easeInOut' },
      tint: 0xeeeeff,
      frequency: 150,
      blendMode: Phaser.BlendModes.ADD
    }).setDepth(10);

    // Warm Lantern Glow
    const glow = this.add.graphics();
    glow.fillStyle(0xffaa00, 0.05);
    glow.fillCircle(1100, 200, 300);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: glow,
      alpha: 0.1,
      duration: 3000,
      yoyo: true,
      repeat: -1
    });
  }

  private drawCozyUI(view: ReturnType<RestChoice['view']>): void {
    const isFullHealth = view.healAmount === 0;

    // The Prop (Wooden Bucket)
    const prop = this.add.image(640, 480, 'rest_prop').setScale(0.9);
    this.tweens.add({
      targets: prop,
      y: 470,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // HP Information Plate
    const plate = this.add.container(640, 280);
    const plateBg = this.add.graphics();
    plateBg.fillStyle(0x000000, 0.4);
    plateBg.fillRoundedRect(-200, -80, 400, 160, 20);
    plate.add(plateBg);

    const title = this.add.text(0, -40, isFullHealth ? 'Peaceful Reflection' : 'Cozy Rest', {
      fontSize: '36px', fontStyle: 'bold italic', color: '#ffffff',
      shadow: { blur: 10, color: '#000', fill: true }
    }).setOrigin(0.5);
    plate.add(title);

    // HP Bar
    const barWidth = 300;
    const barHeight = 24;
    const barX = -150;
    const barY = 10;
    
    const barBg = this.add.rectangle(0, barY + barHeight/2, barWidth, barHeight, 0x222222).setOrigin(0.5);
    plate.add(barBg);

    const currentWidth = (view.currentHp / view.maxHp) * barWidth;
    const healedWidth = (view.healedHp / view.maxHp) * barWidth;

    const barFill = this.add.rectangle(barX, barY, currentWidth, barHeight, 0x44aa44).setOrigin(0, 0);
    plate.add(barFill);

    let barHeal: Phaser.GameObjects.Rectangle | undefined;
    if (!isFullHealth) {
      barHeal = this.add.rectangle(barX + currentWidth, barY, healedWidth - currentWidth, barHeight, 0x88ff88).setOrigin(0, 0).setAlpha(0.6);
      plate.add(barHeal);

      this.tweens.add({
        targets: barHeal,
        alpha: 0.2,
        duration: 800,
        yoyo: true,
        repeat: -1
      });
    }

    const hpText = this.add.text(0, 55, isFullHealth ? `HP ${view.currentHp} / ${view.maxHp} (Max)` : `HP ${view.currentHp} → ${view.healedHp} (+${view.healAmount})`, {
      fontSize: '20px', fontStyle: 'bold', color: '#efe5cc'
    }).setOrigin(0.5);
    plate.add(hpText);

    // Interaction Button
    const btnContainer = this.add.container(640, 600);
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x4a321c, 1);
    btnBg.fillRoundedRect(-120, -30, 240, 60, 15);
    btnBg.lineStyle(4, 0xc89b3c, 1);
    btnBg.strokeRoundedRect(-120, -30, 240, 60, 15);
    btnContainer.add(btnBg);

    const btnText = this.add.text(0, 0, isFullHealth ? 'LEAVE' : 'REST', {
      fontSize: '28px', fontStyle: 'bold', color: '#efe5cc', letterSpacing: 2
    }).setOrigin(0.5);
    btnContainer.add(btnText);

    btnContainer.setSize(240, 60);
    btnContainer.setInteractive({ useHandCursor: true });
    
    btnContainer.on('pointerdown', () => {
      this.sound.play('sfx_button');
      btnContainer.disableInteractive();

      if (isFullHealth) {
        exitBodyScene(this, this.runState, this.rest.asSkipOutcomes(), 'MAP');
      } else {
        // CELEBRATION & HEAL ANIMATION
        this.sound.play('sfx_card_play'); // Reuse card play for 'action' sound
        
        if (barHeal) barHeal.destroy();
        
        // Particle Burst
        const emitter = this.add.particles(640, 480, 'flare', {
            lifespan: 1000,
            speed: { min: 100, max: 300 },
            scale: { start: 0.4, end: 0 },
            alpha: { start: 1, end: 0 },
            tint: 0x88ff88,
            blendMode: Phaser.BlendModes.ADD,
            emitting: false
        });
        emitter.explode(30);

        this.tweens.add({
          targets: barFill,
          width: healedWidth,
          duration: 800,
          ease: 'Cubic.easeOut',
          onUpdate: (tween) => {
            const progress = (tween.getValue() as number) ?? 0;
            const currentVal = Math.round(view.currentHp + (view.healAmount * progress));
            hpText.setText(`HP ${currentVal} / ${view.maxHp}`);
          },
          onComplete: () => {
            this.time.delayedCall(500, () => {
              exitBodyScene(this, this.runState, this.rest.asRestOutcomes(), 'MAP');
            });
          }
        });

        this.tweens.add({
            targets: hpText,
            scale: 1.2,
            duration: 200,
            yoyo: true,
            ease: 'Back.easeOut'
        });
      }
    });

    btnContainer.on('pointerover', () => {
      this.tweens.add({ targets: btnContainer, scale: 1.1, duration: 200, ease: 'Back.easeOut' });
      this.sound.play('sfx_hover', { volume: 0.2 });
    });

    btnContainer.on('pointerout', () => {
      this.tweens.add({ targets: btnContainer, scale: 1.0, duration: 200 });
    });
  }
}
