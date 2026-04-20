// ABOUTME: Shop screen. Cards, relics, potions, and card-removal service.
// ABOUTME: Uses RunState.gold read-only; emits spend_gold via outcomes through transitions.
import * as Phaser from 'phaser';
import type { RunState, Potion, Relic } from '../../models/RunState';
import type { RunOutcome } from '../../models/RunOutcome';
import type { Card } from '../../models/Card';
import { pickCardsByRarity } from '../../content/cards';
import { RELICS } from '../../content/relics';
import { POTIONS } from '../../content/potions';
import { createRunRng, pickFrom } from '../../run/rng';

interface ShopItem {
  kind: 'card' | 'relic' | 'potion' | 'remove';
  label: string;
  sub: string;
  price: number;
  outcome: RunOutcome | null;  // null = card removal, handled specially
}

export class MerchantModal extends Phaser.GameObjects.Container {
  private runState: Readonly<RunState>;
  private outcomesBuffer: RunOutcome[] = [];
  private goldSpent = 0;
  private items: ShopItem[] = [];

  constructor(
    scene: Phaser.Scene,
    runState: Readonly<RunState>,
    private onResolve: (outcomes: RunOutcome[]) => void,
  ) {
    super(scene, 0, 0);
    this.runState = runState;
    const rng = createRunRng(Date.now());

    const cards: Card[] = [
      pickCardsByRarity(rng, 1, 'common')[0]!,
      pickCardsByRarity(rng, 1, 'uncommon')[0]!,
      pickCardsByRarity(rng, 1, 'rare')[0]!,
    ];
    const relics: Relic[] = [pickFrom(RELICS, rng), pickFrom(RELICS, rng)];
    const potions: Potion[] = [pickFrom(POTIONS, rng), pickFrom(POTIONS, rng)];

    this.items = [
      { kind: 'card', label: cards[0]!.title, sub: 'common card', price: 50, outcome: { kind: 'add_card', card: cards[0]! } },
      { kind: 'card', label: cards[1]!.title, sub: 'uncommon card', price: 75, outcome: { kind: 'add_card', card: cards[1]! } },
      { kind: 'card', label: cards[2]!.title, sub: 'rare card', price: 100, outcome: { kind: 'add_card', card: cards[2]! } },
      { kind: 'relic', label: relics[0]!.name, sub: 'common relic', price: 100, outcome: { kind: 'add_relic', relic: relics[0]! } },
      { kind: 'relic', label: relics[1]!.name, sub: 'uncommon relic', price: 150, outcome: { kind: 'add_relic', relic: relics[1]! } },
      { kind: 'potion', label: potions[0]!.name, sub: 'potion', price: 15, outcome: { kind: 'add_potion', potion: potions[0]! } },
      { kind: 'potion', label: potions[1]!.name, sub: 'potion', price: 15, outcome: { kind: 'add_potion', potion: potions[1]! } },
      { kind: 'remove', label: 'Card Removal', sub: 'Remove 1 from deck', price: 50, outcome: null },
    ];

    this.render();
  }

  private render(): void {
    const dim = this.scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.75).setInteractive();
    this.add(dim);

    this.add(this.scene.add.text(640, 50, 'Merchant', {
      fontSize: '42px', fontStyle: 'bold italic', color: '#efe5cc',
    }).setOrigin(0.5));

    const goldText = this.scene.add.text(640, 95, `Gold: ${this.runState.gold - this.goldSpent}`, {
      fontSize: '18px', color: '#ffd700',
    }).setOrigin(0.5);
    this.add(goldText);

    this.items.forEach((item, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 280 + col * 260;
      const y = 220 + row * 180;

      const tile = this.scene.add.container(x, y);
      const bg = this.scene.add.graphics();
      bg.fillStyle(0xefe5cc, 1);
      bg.fillRoundedRect(-110, -75, 220, 150, 12);
      bg.lineStyle(3, 0x6b4a2b, 1);
      bg.strokeRoundedRect(-110, -75, 220, 150, 12);
      tile.add(bg);
      tile.add(this.scene.add.text(0, -35, item.label, {
        fontSize: '18px', fontStyle: 'bold', color: '#4a321c', align: 'center', wordWrap: { width: 200 },
      }).setOrigin(0.5));
      tile.add(this.scene.add.text(0, 0, item.sub, {
        fontSize: '12px', color: '#6b4a2b', align: 'center',
      }).setOrigin(0.5));
      tile.add(this.scene.add.text(0, 45, `🪙 ${item.price}`, {
        fontSize: '20px', fontStyle: 'bold', color: '#c89b3c',
      }).setOrigin(0.5));

      tile.setSize(220, 150);
      tile.setInteractive({ useHandCursor: true });
      tile.on('pointerdown', () => this.onBuy(i, goldText));
      tile.on('pointerover', () => tile.setScale(1.05));
      tile.on('pointerout', () => tile.setScale(1.0));
      this.add(tile);
    });

    const leaveBtn = this.scene.add.rectangle(640, 640, 200, 48, 0x6b4a2b)
      .setStrokeStyle(3, 0xc89b3c).setInteractive({ useHandCursor: true });
    const leaveText = this.scene.add.text(640, 640, 'Leave', {
      fontSize: '22px', fontStyle: 'bold', color: '#efe5cc',
    }).setOrigin(0.5);
    this.add(leaveBtn);
    this.add(leaveText);
    leaveBtn.on('pointerdown', () => this.leave());

    this.setScrollFactor(0);
    this.setDepth(2000);
  }

  private onBuy(idx: number, goldText: Phaser.GameObjects.Text): void {
    const item = this.items[idx]!;
    const available = this.runState.gold - this.goldSpent;
    if (available < item.price) return;

    if (item.kind === 'remove') {
      // For skeleton: the modal emits a sentinel; coordinator pops a CardPickerModal-style
      // picker over the current deck. For v1, we just charge gold and emit a placeholder.
      // A dedicated DeckPickerModal can replace this later.
      this.goldSpent += item.price;
      // No outcome emitted — card removal picker is a follow-up, omitted in v1 to keep scope
      // tight. Future: emit remove_card after the player picks from their deck.
    } else if (item.outcome) {
      this.goldSpent += item.price;
      this.outcomesBuffer.push(item.outcome);
    }

    goldText.setText(`Gold: ${this.runState.gold - this.goldSpent}`);
  }

  private leave(): void {
    // Emit a single damage-style outcome to deduct the spent gold.
    // Clean way: add a 'spend_gold' outcome. For skeleton we emit damage-like:
    if (this.goldSpent > 0) this.outcomesBuffer.unshift({ kind: 'gold', amount: -this.goldSpent });
    if (this.outcomesBuffer.length === 0) this.outcomesBuffer.push({ kind: 'none' });
    this.onResolve(this.outcomesBuffer);
    this.destroy();
  }
}
