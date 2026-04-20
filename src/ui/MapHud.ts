// ABOUTME: Fixed top-bar HUD for MapScene. Shows HP, gold (live), potion slots, floor, epoch.
// ABOUTME: Potion slot clicks call onUsePotion(slotIndex) callback.
import * as Phaser from 'phaser';
import type { RunState } from '../models/RunState';

export class MapHud extends Phaser.GameObjects.Container {
  private text: Phaser.GameObjects.Text;
  private potionTiles: Phaser.GameObjects.Container[] = [];
  private onUsePotion: (slot: number) => void;

  constructor(scene: Phaser.Scene, onUsePotion: (slot: number) => void) {
    super(scene, 0, 0);
    this.onUsePotion = onUsePotion;

    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, 1280, 45);
    bg.lineStyle(2, 0x74b9ff, 1);
    bg.strokeRect(0, 0, 1280, 45);
    this.add(bg);

    this.text = scene.add.text(20, 10, '', {
      fontSize: '20px', color: '#fff', fontStyle: 'bold',
    });
    this.add(this.text);

    this.setScrollFactor(0);
    this.setDepth(1000);
  }

  update(state: RunState): void {
    this.text.setText(
      `❤️ ${state.playerHp}/${state.playerMaxHp}    🪙 ${state.gold}    🗺️ Region 1    📜 Epoch ${state.currentEpoch}`,
    );

    // Rebuild potion tiles to match current slots + contents.
    this.potionTiles.forEach(t => t.destroy());
    this.potionTiles = [];
    for (let i = 0; i < state.potionSlots; i++) {
      const potion = state.potions[i] ?? null;
      const x = 900 + i * 50;
      const tile = this.scene.add.container(x, 22);

      const bgCircle = this.scene.add.circle(0, 0, 18, potion ? 0x6c5ce7 : 0x444444, 0.7)
        .setStrokeStyle(2, 0xa29bfe);
      tile.add(bgCircle);
      if (potion) {
        tile.add(this.scene.add.text(0, 0, '🧪', { fontSize: '18px' }).setOrigin(0.5));
      }
      tile.setSize(36, 36);
      if (potion) {
        tile.setInteractive({ useHandCursor: true });
        tile.on('pointerdown', () => this.onUsePotion(i));
        tile.on('pointerover', () => tile.setScale(1.15));
        tile.on('pointerout', () => tile.setScale(1.0));
      }
      this.add(tile);
      this.potionTiles.push(tile);
    }
  }
}
