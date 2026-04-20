// ABOUTME: Dev-only debug panel. Backtick toggles. Jump to any phase with a fixture state.
// ABOUTME: Also: utility buttons (+gold, full heal, kill, reset).
import * as Phaser from 'phaser';
import type { RunState, RunPhase } from '../models/RunState';
import { setPhase, gainGold, heal, takeDamage, addRelic, addPotion } from '../run/transitions';
import { RELICS } from '../content/relics';
import { POTIONS } from '../content/potions';
import { buildFixture } from '../qa/fixtures';

const PHASES: RunPhase[] = [
  'BLESSING', 'MAP', 'COMBAT', 'REWARD', 'CHEST', 'MERCHANT',
  'EVENT', 'REST', 'BOSS_VICTORY', 'DEATH', 'EPOCH_UNLOCK',
];

export class QaDebugPanel extends Phaser.GameObjects.Container {
  private panel!: Phaser.GameObjects.Container;
  private open = false;
  private runState: RunState;

  constructor(scene: Phaser.Scene, runState: RunState) {
    super(scene, 0, 0);
    this.runState = runState;
    this.buildPanel();
    this.setDepth(10000);
    this.setScrollFactor(0);
    this.hide();
  }

  toggle(): void {
    this.open = !this.open;
    this.panel.setVisible(this.open);
  }

  private hide(): void { this.open = false; this.panel.setVisible(false); }

  private buildPanel(): void {
    this.panel = this.scene.add.container(0, 0);
    this.add(this.panel);

    const bg = this.scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.8);
    this.panel.add(bg);

    const title = this.scene.add.text(640, 40, 'QA Debug Panel', {
      fontSize: '28px', fontStyle: 'bold', color: '#ffd700',
    }).setOrigin(0.5);
    this.panel.add(title);

    const hint = this.scene.add.text(640, 72, 'Backtick (`) to close', {
      fontSize: '14px', color: '#c8b688',
    }).setOrigin(0.5);
    this.panel.add(hint);

    // Phase jump buttons
    this.panel.add(this.scene.add.text(100, 110, 'Jump to phase:', {
      fontSize: '18px', color: '#efe5cc',
    }));
    PHASES.forEach((phase, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 100 + col * 220;
      const y = 150 + row * 50;
      const btn = this.scene.add.rectangle(x + 100, y + 16, 200, 32, 0x3a2418)
        .setStrokeStyle(2, 0x6b4a2b).setInteractive({ useHandCursor: true });
      const label = this.scene.add.text(x + 100, y + 16, phase, {
        fontSize: '14px', color: '#efe5cc',
      }).setOrigin(0.5);
      btn.on('pointerdown', () => this.jumpToPhase(phase));
      this.panel.add(btn);
      this.panel.add(label);
    });

    // Utility buttons
    this.panel.add(this.scene.add.text(100, 360, 'Utilities:', {
      fontSize: '18px', color: '#efe5cc',
    }));
    const utils: Array<[string, () => void]> = [
      ['+500 gold',          () => gainGold(this.runState, 500)],
      ['Add relic',          () => addRelic(this.runState, RELICS[0]!)],
      ['Fill potions',       () => POTIONS.forEach(p => addPotion(this.runState, p))],
      ['Full heal',          () => heal(this.runState, 999)],
      ['Kill player',        () => takeDamage(this.runState, 9999)],
    ];
    utils.forEach(([label, fn], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 100 + col * 220;
      const y = 400 + row * 50;
      const btn = this.scene.add.rectangle(x + 100, y + 16, 200, 32, 0x6b4a2b)
        .setStrokeStyle(2, 0xc89b3c).setInteractive({ useHandCursor: true });
      const txt = this.scene.add.text(x + 100, y + 16, label, {
        fontSize: '14px', color: '#efe5cc',
      }).setOrigin(0.5);
      btn.on('pointerdown', fn);
      this.panel.add(btn);
      this.panel.add(txt);
    });
  }

  private jumpToPhase(phase: RunPhase): void {
    const fresh = buildFixture(phase);
    // Copy fresh into the live runState (keep reference identity).
    Object.assign(this.runState, fresh);
    setPhase(this.runState, phase);  // triggers onStateChanged
    this.hide();
  }
}
