// ABOUTME: Post-fight reward: always gold + card pick, maybe potion.
// ABOUTME: Emits RunOutcome[] via onResolve.
import * as Phaser from 'phaser';
import type { RunState, Potion } from '../../models/RunState';
import type { RunOutcome } from '../../models/RunOutcome';
import type { Card } from '../../models/Card';
import { pickCardsByRarity } from '../../content/cards';
import { POTIONS } from '../../content/potions';
import { createRunRng, pickFrom } from '../../run/rng';
import { CardPickerModal } from './CardPickerModal';

export class RewardModal extends Phaser.GameObjects.Container {
  private goldAmount: number;
  private cardChoices: Card[];
  private potionChoice: Potion | null;
  private outcomesSoFar: RunOutcome[] = [];

  constructor(
    scene: Phaser.Scene,
    _runState: Readonly<RunState>,
    private onResolve: (outcomes: RunOutcome[]) => void,
    opts?: { elite?: boolean; seed?: number },
  ) {
    super(scene, 0, 0);
    const rng = createRunRng(opts?.seed ?? Date.now());

    const goldRange = opts?.elite ? [25, 40] : [10, 20];
    const min = goldRange[0]!;
    const max = goldRange[1]!;
    this.goldAmount = min + Math.floor(rng() * (max - min + 1));

    // Ensure diversity: pick 1 common + 2 uncommon
    this.cardChoices = [
      pickCardsByRarity(rng, 1, 'common')[0]!,
      pickCardsByRarity(rng, 1, 'uncommon')[0]!,
      pickCardsByRarity(rng, 1, 'uncommon')[0]!,
    ];

    const potionChance = opts?.elite ? 0.6 : 0.4;
    this.potionChoice = rng() < potionChance ? pickFrom(POTIONS, rng) : null;

    this.render();
  }

  private render(): void {
    const dim = this.scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.7).setInteractive();
    this.add(dim);

    this.add(this.scene.add.text(640, 80, 'Victory!', {
      fontSize: '48px', fontStyle: 'bold italic', color: '#ffd700',
    }).setOrigin(0.5));

    const options: Array<{ label: string; onClick: () => void; sub: string }> = [
      {
        label: `🪙 +${this.goldAmount} gold`,
        sub: 'Take the coin',
        onClick: () => {
          this.outcomesSoFar.push({ kind: 'gold', amount: this.goldAmount });
          this.finish();
        },
      },
      {
        label: 'Pick a card',
        sub: 'Choose 1 of 3',
        onClick: () => this.openCardPicker(),
      },
    ];

    if (this.potionChoice) {
      const potion = this.potionChoice;
      options.push({
        label: `🧪 ${potion.name}`,
        sub: 'Take the potion',
        onClick: () => {
          this.outcomesSoFar.push({ kind: 'add_potion', potion });
          this.finish();
        },
      });
    }

    options.forEach((opt, i) => {
      const x = 640 + (i - (options.length - 1) / 2) * 260;
      const y = 320;
      const card = this.scene.add.container(x, y);

      const bg = this.scene.add.graphics();
      bg.fillStyle(0xefe5cc, 1);
      bg.fillRoundedRect(-110, -80, 220, 160, 16);
      bg.lineStyle(4, 0xc89b3c, 1);
      bg.strokeRoundedRect(-110, -80, 220, 160, 16);
      card.add(bg);

      card.add(this.scene.add.text(0, -20, opt.label, {
        fontSize: '20px', fontStyle: 'bold', color: '#4a321c', align: 'center',
        wordWrap: { width: 200 },
      }).setOrigin(0.5));

      card.add(this.scene.add.text(0, 40, opt.sub, {
        fontSize: '14px', color: '#6b4a2b', align: 'center',
      }).setOrigin(0.5));

      card.setSize(220, 160);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', opt.onClick);
      card.on('pointerover', () => card.setScale(1.05));
      card.on('pointerout', () => card.setScale(1.0));
      this.add(card);
    });

    const skipBtn = this.scene.add.rectangle(640, 560, 180, 44, 0x3a2418)
      .setStrokeStyle(3, 0x6b4a2b).setInteractive({ useHandCursor: true });
    const skipText = this.scene.add.text(640, 560, 'Skip all', {
      fontSize: '18px', color: '#c8b688',
    }).setOrigin(0.5);
    this.add(skipBtn);
    this.add(skipText);
    skipBtn.on('pointerdown', () => this.finish());

    this.setScrollFactor(0);
    this.setDepth(2000);
  }

  private openCardPicker(): void {
    const picker = new CardPickerModal(
      this.scene,
      { title: 'Pick a card', cards: this.cardChoices, allowSkip: true },
      (picked) => {
        if (picked) this.outcomesSoFar.push({ kind: 'add_card', card: picked });
        this.finish();
      },
    );
    this.scene.add.existing(picker);
  }

  private finish(): void {
    if (this.outcomesSoFar.length === 0) this.outcomesSoFar.push({ kind: 'none' });
    this.onResolve(this.outcomesSoFar);
    this.destroy();
  }
}
