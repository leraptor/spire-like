// ABOUTME: Shown after boss defeat. Offers "Continue" to proceed to next phase.
// ABOUTME: If next-epoch criteria met, coordinator switches phase to EPOCH_UNLOCK instead.
import * as Phaser from 'phaser';
import type { RunState } from '../../models/RunState';

export class BossVictoryModal extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    _runState: Readonly<RunState>,
    private onResolve: () => void,
  ) {
    super(scene, 0, 0);

    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.85).setInteractive();
    this.add(dim);

    this.add(scene.add.text(640, 280, 'VICTORY', {
      fontSize: '80px', fontStyle: 'bold italic', color: '#ffd700',
      stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5));

    this.add(scene.add.text(640, 360, 'The region is cleared.', {
      fontSize: '22px', color: '#c8b688', fontStyle: 'italic',
    }).setOrigin(0.5));

    const btn = scene.add.rectangle(640, 480, 260, 60, 0x6b4a2b)
      .setStrokeStyle(3, 0xc89b3c).setInteractive({ useHandCursor: true });
    const label = scene.add.text(640, 480, 'Continue', {
      fontSize: '24px', fontStyle: 'bold', color: '#efe5cc',
    }).setOrigin(0.5);
    btn.on('pointerdown', () => { this.onResolve(); this.destroy(); });
    this.add(btn);
    this.add(label);

    this.setScrollFactor(0);
    this.setDepth(2000);
  }
}
