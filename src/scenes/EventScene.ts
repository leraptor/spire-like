// ABOUTME: Full-screen narrative-event presentation. Two-stage flow: a narrative scene, then the choices.
// ABOUTME: Completely overhauled with unique Ghibli-inspired backgrounds and atmospheric particles for each event.
import * as Phaser from 'phaser';
import type { RunState } from '../models/RunState';
import { EventFlow, type EventView } from '../event/EventFlow';
import { CardPickerModal } from '../ui/modals/CardPickerModal';
import { pickCardsByRarity } from '../content/cards';
import { createRunRng } from '../run/rng';
import { enterBodyScene, exitBodyScene } from './bodySceneHelpers';

type Stage = 'narrative' | 'choices';

export class EventScene extends Phaser.Scene {
  private runState!: RunState;
  private flow!: EventFlow;
  private view!: EventView;
  private stage: Stage = 'narrative';
  private stageContainer!: Phaser.GameObjects.Container;
  private prosePlate!: Phaser.GameObjects.Container;
  private ambientParticles?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() { super('EventScene'); }

  init(data: { runState: RunState }): void {
    this.runState = data.runState;
    this.flow = new EventFlow();
    this.view = this.flow.view();
  }

  preload(): void {
    // Event Assets
    this.load.image('event_forked_path', 'assets/events/event_forked_path.png');
    this.load.image('event_shrine_of_mist', 'assets/events/event_shrine_of_mist.png');
    this.load.image('event_gem_hoard', 'assets/events/event_gem_hoard.png');
    this.load.image('event_cursed_altar', 'assets/events/event_cursed_altar.png');
    this.load.image('event_merchants_apprentice', 'assets/events/event_merchants_apprentice.png');
  }

  create(): void {
    enterBodyScene(this);
    this.drawSceneBackdrop();
    this.stageContainer = this.add.container(0, 0);
    this.showNarrativeStage();
  }

  private drawSceneBackdrop(): void {
    // 1. Static solid background to prevent bleeding
    this.add.rectangle(640, 360, 1280, 720, 0x1a0f08).setOrigin(0.5);

    // 2. Event-specific watercolor background
    const bg = this.add.image(640, 360, this.view.id).setOrigin(0.5);
    
    // Subtle "breathing" animation for the Ghibli background
    this.tweens.add({
      targets: bg,
      scale: 1.03,
      duration: 12000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 3. Ambient atmospheric particles based on event identity
    this.createAmbientAtmosphere();
  }

  private createAmbientAtmosphere(): void {
    let tint: number[] = [0xffffff];
    let frequency = 250;
    let alpha = 0.3;
    let speedX = { min: -10, max: 10 };
    let speedY = { min: -10, max: 10 };

    switch (this.view.id) {
      case 'event_cursed_altar': // Dark magical forest
        tint = [0x5010a0, 0x101030];
        alpha = 0.5;
        frequency = 150;
        break;
      case 'event_shrine_of_mist': // Cozy tea house fire
        tint = [0xffaa00, 0xff4400];
        speedY = { min: -20, max: -40 };
        frequency = 300;
        break;
      case 'event_forked_path': // Bamboo grove sun-dappled motes
        tint = [0xf4ecd8, 0xffffff];
        alpha = 0.2;
        break;
      case 'event_gem_hoard': // Dusty attic
        tint = [0xffffff, 0xaaaaaa];
        alpha = 0.15;
        frequency = 400;
        break;
    }

    this.ambientParticles = this.add.particles(0, 0, 'flare', {
      x: { min: 0, max: 1280 },
      y: { min: 0, max: 720 },
      lifespan: 6000,
      speedX, speedY,
      scale: { start: 0.05, end: 0.01 },
      alpha: { start: 0, end: alpha, ease: 'Sine.easeInOut' },
      tint,
      frequency
    }).setDepth(10);
  }

  // ---------- Stage 1: Narrative ----------
  private showNarrativeStage(): void {
    this.stage = 'narrative';
    this.clearStage();

    this.prosePlate = this.add.container(640, 360);
    this.stageContainer.add(this.prosePlate);

    const plateBg = this.add.graphics();
    plateBg.fillStyle(0xefe5cc, 0.95);
    plateBg.fillRoundedRect(-450, -200, 900, 400, 24);
    plateBg.lineStyle(6, 0x4a321c, 1);
    plateBg.strokeRoundedRect(-450, -200, 900, 400, 24);
    this.prosePlate.add(plateBg);

    const nameText = this.add.text(0, -150, this.view.name, {
      fontSize: '44px', fontStyle: 'bold italic', color: '#4a321c',
    }).setOrigin(0.5);
    this.prosePlate.add(nameText);

    const bodyText = this.add.text(0, 20, this.view.body, {
      fontSize: '24px', color: '#6b4a2b', align: 'center',
      wordWrap: { width: 780 }, lineSpacing: 10,
    }).setOrigin(0.5);
    this.prosePlate.add(bodyText);

    const prompt = this.add.text(0, 160, '( Tap to advance )', {
      fontSize: '18px', fontStyle: 'italic', color: '#8a5a1c',
    }).setOrigin(0.5);
    this.prosePlate.add(prompt);
    this.tweens.add({ targets: prompt, alpha: 0.4, duration: 1000, yoyo: true, repeat: -1 });

    const catcher = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    catcher.on('pointerdown', () => this.showChoicesStage());
    this.stageContainer.add(catcher);
  }

  // ---------- Stage 2: Choices ----------
  private showChoicesStage(): void {
    this.stage = 'choices';

    // Slide the prose plate up to make room for choices
    this.tweens.add({
      targets: this.prosePlate,
      y: 220,
      scale: 0.9,
      duration: 600,
      ease: 'Cubic.easeInOut'
    });

    this.view.choices.forEach((choice, i) => {
      const y = 460 + i * 100;
      const container = this.add.container(640, y);
      this.stageContainer.add(container);

      const btn = this.add.rectangle(0, 0, 600, 70, 0x3a2418)
        .setStrokeStyle(3, 0x6b4a2b)
        .setInteractive({ useHandCursor: true });
      
      const label = this.add.text(0, 0, choice.label, {
        fontSize: '22px', fontStyle: 'bold', color: '#efe5cc', align: 'center',
      }).setOrigin(0.5);

      container.add([btn, label]);

      btn.on('pointerover', () => {
        btn.setFillStyle(0x6b4a2b);
        container.setScale(1.05);
        this.sound.play('sfx_hover', { volume: 0.3 });
      });
      btn.on('pointerout', () => {
        btn.setFillStyle(0x3a2418);
        container.setScale(1.0);
      });
      btn.on('pointerdown', () => this.pick(choice.id));

      // Entrance animation for buttons
      container.setScale(0);
      this.tweens.add({
        targets: container,
        scale: 1,
        duration: 400,
        delay: 300 + (i * 150),
        ease: 'Back.easeOut'
      });
    });
  }

  private pick(choiceId: string): void {
    // Special handling for the Merchant Apprentice card pick
    if (this.view.id === 'event_merchants_apprentice' && choiceId === 'pick') {
      this.openCardPicker();
      return;
    }

    this.sound.play('sfx_card_play');
    exitBodyScene(this, this.runState, this.flow.resolveChoice(choiceId), 'MAP');
  }

  private openCardPicker(): void {
    const rng = createRunRng(Date.now());
    const cards = pickCardsByRarity(rng, 3, 'uncommon');
    
    const picker = new CardPickerModal(
      this,
      { title: 'A gift of inspiration...', cards: [...cards], allowSkip: true },
      (picked) => {
        const outcomes = picked 
          ? [{ kind: 'add_card' as const, card: picked }] 
          : [{ kind: 'none' as const }];
        exitBodyScene(this, this.runState, outcomes, 'MAP');
      },
    );
    this.add.existing(picker);
  }

  private clearStage(): void {
    this.stageContainer.each((child: Phaser.GameObjects.GameObject) => child.destroy());
    this.stageContainer.removeAll();
  }
}
