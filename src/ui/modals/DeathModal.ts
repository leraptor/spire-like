// ABOUTME: Shown when player HP hits 0. Offers a fresh new run.
// ABOUTME: Signals the coordinator to rebuild runState via buildFreshRun.
import * as Phaser from 'phaser';
import type { RunState } from '../../models/RunState';

export class DeathModal extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    _runState: Readonly<RunState>,
    private onResolve: () => void,
  ) {
    super(scene, 0, 0);

    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.92).setInteractive();
    this.add(dim);

    this.add(scene.add.text(640, 280, 'YOU DIED', {
      fontSize: '88px', fontStyle: 'bold italic', color: '#ff7675',
      stroke: '#000', strokeThickness: 10,
    }).setOrigin(0.5));

    const btn = scene.add.rectangle(640, 480, 260, 60, 0x6b4a2b)
      .setStrokeStyle(3, 0xc89b3c).setInteractive({ useHandCursor: true });
    const label = scene.add.text(640, 480, 'New Run', {
      fontSize: '24px', fontStyle: 'bold', color: '#efe5cc',
    }).setOrigin(0.5);
    btn.on('pointerdown', () => { this.onResolve(); this.destroy(); });
    this.add(btn);
    this.add(label);

    this.setScrollFactor(0);
    this.setDepth(2000);
  }
}
