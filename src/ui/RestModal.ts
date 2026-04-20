// ABOUTME: In-scene modal for Rest nodes. Confirms a 30% heal and returns control to MapScene.
// ABOUTME: Used inside MapScene; not a separate Phaser scene.
import * as Phaser from 'phaser';

export interface RestModalResult {
  healedBy: number;
}

export class RestModal extends Phaser.GameObjects.Container {
  private onResolve: (res: RestModalResult) => void;
  private healAmount: number;

  constructor(
    scene: Phaser.Scene,
    hp: number,
    maxHp: number,
    healPct: number,
    onResolve: (res: RestModalResult) => void,
  ) {
    super(scene, 0, 0);
    this.onResolve = onResolve;
    this.healAmount = Math.min(maxHp - hp, Math.ceil(maxHp * healPct));

    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.6).setInteractive();
    this.add(dim);

    const panel = scene.add.graphics();
    panel.fillStyle(0xefe5cc, 1);
    panel.fillRoundedRect(440, 240, 400, 240, 24);
    panel.lineStyle(4, 0x6b4a2b, 1);
    panel.strokeRoundedRect(440, 240, 400, 240, 24);
    this.add(panel);

    const title = scene.add.text(640, 290, 'Rest Site', {
      fontSize: '32px', fontStyle: 'bold', color: '#4a321c',
    }).setOrigin(0.5);
    this.add(title);

    const body = scene.add.text(640, 355,
      `You sit by the fire.\nHP ${hp} → ${hp + this.healAmount} (+${this.healAmount})`,
      { fontSize: '20px', color: '#4a321c', align: 'center' },
    ).setOrigin(0.5);
    this.add(body);

    const btn = scene.add.rectangle(640, 440, 180, 48, 0x6b4a2b).setStrokeStyle(3, 0xc89b3c).setInteractive({ useHandCursor: true });
    const btnText = scene.add.text(640, 440, 'Rest', {
      fontSize: '22px', fontStyle: 'bold', color: '#efe5cc',
    }).setOrigin(0.5);
    this.add(btn);
    this.add(btnText);

    btn.on('pointerdown', () => {
      this.close();
    });

    this.setDepth(2000);
    this.setScrollFactor(0);
  }

  private close(): void {
    this.onResolve({ healedBy: this.healAmount });
    this.destroy();
  }
}
