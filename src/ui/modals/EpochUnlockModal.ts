// ABOUTME: Run-end epoch unlock celebration. "Enter Epoch N" starts the next run in that epoch.
import * as Phaser from 'phaser';
import type { RunState } from '../../models/RunState';
import type { EpochDef } from '../../content/epochs';

export class EpochUnlockModal extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    _runState: Readonly<RunState>,
    epoch: EpochDef,
    private onResolve: () => void,
  ) {
    super(scene, 0, 0);

    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.9).setInteractive();
    this.add(dim);

    this.add(scene.add.text(640, 200, `Epoch ${epoch.epoch} unlocked!`, {
      fontSize: '48px', fontStyle: 'bold italic', color: '#ffd700',
    }).setOrigin(0.5));

    this.add(scene.add.text(640, 310, epoch.description, {
      fontSize: '22px', color: '#c8b688', align: 'center', wordWrap: { width: 700 },
    }).setOrigin(0.5));

    this.add(scene.add.text(640, 400, `Enemies ×${epoch.enemyHpMultiplier} HP  •  Potion slots: ${epoch.potionSlots}`, {
      fontSize: '18px', color: '#efe5cc', align: 'center',
    }).setOrigin(0.5));

    const btn = scene.add.rectangle(640, 530, 320, 60, 0x6b4a2b)
      .setStrokeStyle(3, 0xc89b3c).setInteractive({ useHandCursor: true });
    const label = scene.add.text(640, 530, `Enter Epoch ${epoch.epoch}`, {
      fontSize: '22px', fontStyle: 'bold', color: '#efe5cc',
    }).setOrigin(0.5);
    btn.on('pointerdown', () => { this.onResolve(); this.destroy(); });
    this.add(btn);
    this.add(label);

    this.setScrollFactor(0);
    this.setDepth(2000);
  }
}
