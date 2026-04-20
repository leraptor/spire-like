// ABOUTME: Narrative event screen. Shows body text + 2-3 choices.
// ABOUTME: Each choice calls resolver to produce RunOutcome[].
import * as Phaser from 'phaser';
import type { RunState } from '../../models/RunState';
import type { RunOutcome } from '../../models/RunOutcome';
import type { EventDef } from '../../content/events';
import { createRunRng } from '../../run/rng';

export class EventModal extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    _runState: Readonly<RunState>,
    event: EventDef,
    private onResolve: (outcomes: RunOutcome[]) => void,
  ) {
    super(scene, 0, 0);

    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.8).setInteractive();
    this.add(dim);

    this.add(scene.add.text(640, 80, event.name, {
      fontSize: '36px', fontStyle: 'bold italic', color: '#efe5cc',
    }).setOrigin(0.5));

    this.add(scene.add.text(640, 180, event.body, {
      fontSize: '20px', color: '#c8b688', align: 'center',
      wordWrap: { width: 760 }, lineSpacing: 6,
    }).setOrigin(0.5));

    event.choices.forEach((choice, i) => {
      const y = 380 + i * 80;
      const btn = scene.add.rectangle(640, y, 600, 60, 0x3a2418)
        .setStrokeStyle(3, 0x6b4a2b).setInteractive({ useHandCursor: true });
      const label = scene.add.text(640, y, choice.label, {
        fontSize: '20px', color: '#efe5cc', align: 'center',
      }).setOrigin(0.5);
      btn.on('pointerover', () => btn.setFillStyle(0x6b4a2b));
      btn.on('pointerout', () => btn.setFillStyle(0x3a2418));
      btn.on('pointerdown', () => {
        const rng = createRunRng(Date.now());
        this.onResolve(choice.resolve(rng));
        this.destroy();
      });
      this.add(btn);
      this.add(label);
    });

    this.setScrollFactor(0);
    this.setDepth(2000);
  }
}
