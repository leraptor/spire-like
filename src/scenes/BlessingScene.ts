// ABOUTME: Run-start blessing choice. 3 random blessings from the pool of 7.
// ABOUTME: Player picks one; emitted outcomes are applied to runState then MapScene starts.
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

  create(): void {
    this.cameras.main.setBackgroundColor('#1a0f06');

    this.add.text(640, 100, 'Choose your blessing', {
      fontSize: '42px', fontStyle: 'bold italic', color: '#efe5cc',
    }).setOrigin(0.5);

    this.add.text(640, 150, 'Your run begins with a gift.', {
      fontSize: '18px', color: '#c8b688', fontStyle: 'italic',
    }).setOrigin(0.5);

    this.blessings.forEach((b, i) => {
      const x = 640 + (i - 1) * 320;
      const y = 360;
      const card = this.add.container(x, y);

      const bg = this.add.graphics();
      bg.fillStyle(0xefe5cc, 1);
      bg.fillRoundedRect(-130, -150, 260, 300, 16);
      bg.lineStyle(6, 0xc89b3c, 1);
      bg.strokeRoundedRect(-130, -150, 260, 300, 16);
      card.add(bg);

      card.add(this.add.text(0, -100, b.name, {
        fontSize: '22px', fontStyle: 'bold', color: '#4a321c', align: 'center',
        wordWrap: { width: 220 },
      }).setOrigin(0.5));

      card.add(this.add.text(0, 20, b.description, {
        fontSize: '16px', color: '#4a321c', align: 'center', wordWrap: { width: 220 },
      }).setOrigin(0.5));

      card.setSize(260, 300);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => this.pick(b));
      card.on('pointerover', () => card.setScale(1.05));
      card.on('pointerout', () => card.setScale(1.0));
    });
  }

  private pick(blessing: BlessingDef): void {
    const rng = createRunRng(Date.now() + 1);
    const outcomes = blessing.resolve(rng);
    applyOutcomes(this.runState, outcomes);
    setPhase(this.runState, 'MAP');
    this.scene.start('MapScene', { runState: this.runState });
  }
}
