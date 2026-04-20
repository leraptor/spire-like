// ABOUTME: Chest node reward. 3-choice: gold / relic / card pick.
// ABOUTME: Presents a treasure chest with three reward options.
import * as Phaser from 'phaser';
import type { RunState } from '../../models/RunState';
import type { RunOutcome } from '../../models/RunOutcome';
import { RELICS } from '../../content/relics';
import { pickCardsByRarity } from '../../content/cards';
import { createRunRng, pickFrom } from '../../run/rng';
import { CardPickerModal } from './CardPickerModal';

export class ChestModal extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    _runState: Readonly<RunState>,
    private onResolve: (outcomes: RunOutcome[]) => void,
  ) {
    super(scene, 0, 0);
    const rng = createRunRng(Date.now());

    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.7).setInteractive();
    this.add(dim);

    this.add(scene.add.text(640, 80, 'A treasure chest...', {
      fontSize: '42px', fontStyle: 'bold italic', color: '#ffd700',
    }).setOrigin(0.5));

    const relic = pickFrom(RELICS, rng);
    const cards = pickCardsByRarity(rng, 3, 'uncommon');

    const options = [
      {
        label: '🪙 +25 gold',
        sub: 'Scoop up the coins',
        onClick: () => this.finish([{ kind: 'gold', amount: 25 }]),
      },
      {
        label: `✨ ${relic.name}`,
        sub: relic.description,
        onClick: () => this.finish([{ kind: 'add_relic', relic }]),
      },
      {
        label: 'Pick a card',
        sub: 'Choose 1 of 3',
        onClick: () => {
          const picker = new CardPickerModal(scene,
            { title: 'Pick a card from the chest', cards, allowSkip: true },
            (picked) => this.finish(picked ? [{ kind: 'add_card', card: picked }] : [{ kind: 'none' }]));
          scene.add.existing(picker);
        },
      },
    ];

    options.forEach((opt, i) => {
      const x = 640 + (i - 1) * 280;
      const y = 340;
      const card = scene.add.container(x, y);

      const bg = scene.add.graphics();
      bg.fillStyle(0xefe5cc, 1);
      bg.fillRoundedRect(-120, -90, 240, 180, 16);
      bg.lineStyle(4, 0xc89b3c, 1);
      bg.strokeRoundedRect(-120, -90, 240, 180, 16);
      card.add(bg);

      card.add(scene.add.text(0, -30, opt.label, {
        fontSize: '22px', fontStyle: 'bold', color: '#4a321c', align: 'center',
        wordWrap: { width: 220 },
      }).setOrigin(0.5));
      card.add(scene.add.text(0, 30, opt.sub, {
        fontSize: '14px', color: '#6b4a2b', align: 'center', wordWrap: { width: 220 },
      }).setOrigin(0.5));

      card.setSize(240, 180);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', opt.onClick);
      card.on('pointerover', () => card.setScale(1.05));
      card.on('pointerout', () => card.setScale(1.0));
      this.add(card);
    });

    this.setScrollFactor(0);
    this.setDepth(2000);
  }

  private finish(outcomes: RunOutcome[]): void {
    this.onResolve(outcomes);
    this.destroy();
  }
}
