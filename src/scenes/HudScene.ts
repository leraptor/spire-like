// ABOUTME: Always-running parallel scene that renders the persistent top HUD (HP, gold, potions, region, epoch).
// ABOUTME: Listens to `run-state-changed` on the game event bus and refreshes. Handles potion-slot clicks for map-usable potions.
import * as Phaser from 'phaser';
import type { RunState } from '../models/RunState';
import { usePotion } from '../run/transitions';
import { applyOutcomes } from '../run/applyOutcomes';

export const RUN_STATE_CHANGED = 'run-state-changed';

export class HudScene extends Phaser.Scene {
  private runState!: RunState;
  private text!: Phaser.GameObjects.Text;
  private bar!: Phaser.GameObjects.Graphics;
  private potionTiles: Phaser.GameObjects.Container[] = [];

  constructor() { super('HudScene'); }

  init(data: { runState: RunState }): void {
    this.runState = data.runState;
  }

  create(): void {
    this.bar = this.add.graphics();
    this.bar.fillStyle(0x000000, 0.7);
    this.bar.fillRect(0, 0, 1280, 45);
    this.bar.lineStyle(2, 0x74b9ff, 1);
    this.bar.strokeRect(0, 0, 1280, 45);

    this.text = this.add.text(20, 10, '', {
      fontSize: '20px', color: '#fff', fontStyle: 'bold',
    });

    const onChanged = (state: RunState) => {
      this.runState = state;
      this.refresh();
    };
    this.game.events.on(RUN_STATE_CHANGED, onChanged);
    this.events.once('shutdown', () => this.game.events.off(RUN_STATE_CHANGED, onChanged));

    this.refresh();
  }

  private refresh(): void {
    const s = this.runState;
    this.text.setText(
      `❤️ ${s.playerHp}/${s.playerMaxHp}    🪙 ${s.gold}    🗺️ Region 1    📜 Epoch ${s.currentEpoch}`,
    );

    this.potionTiles.forEach(t => t.destroy());
    this.potionTiles = [];
    for (let i = 0; i < s.potionSlots; i++) {
      const potion = s.potions[i] ?? null;
      const x = 900 + i * 50;
      const tile = this.add.container(x, 22);
      const bgCircle = this.add.circle(0, 0, 18, potion ? 0x6c5ce7 : 0x444444, 0.7)
        .setStrokeStyle(2, 0xa29bfe);
      tile.add(bgCircle);
      if (potion) {
        tile.add(this.add.text(0, 0, '🧪', { fontSize: '18px' }).setOrigin(0.5));
      }
      tile.setSize(36, 36);
      if (potion) {
        tile.setInteractive({ useHandCursor: true });
        tile.on('pointerdown', () => this.handlePotionClick(i));
        tile.on('pointerover', () => tile.setScale(1.15));
        tile.on('pointerout', () => tile.setScale(1.0));
      }
      this.potionTiles.push(tile);
    }
  }

  private handlePotionClick(slot: number): void {
    const potion = this.runState.potions[slot];
    if (!potion || !potion.usableInMap) return;
    if (potion.effect.kind === 'heal') {
      applyOutcomes(this.runState, [{ kind: 'heal', amount: potion.effect.amount }]);
    }
    usePotion(this.runState, slot);
    this.game.events.emit(RUN_STATE_CHANGED, this.runState);
  }
}
