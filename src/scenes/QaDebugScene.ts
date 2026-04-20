// ABOUTME: Always-on-top debug scene that hosts the QaDebugPanel. Sits above map, body scenes, and HUD.
// ABOUTME: Listens for the backtick key to toggle, and routes phase-jumps through MapScene.closeActiveModal.
import * as Phaser from 'phaser';
import type { RunState } from '../models/RunState';
import { QaDebugPanel } from '../ui/QaDebugPanel';

interface MapSceneLike extends Phaser.Scene {
  closeActiveModal?: () => void;
}

export class QaDebugScene extends Phaser.Scene {
  private runState!: RunState;
  private panel!: QaDebugPanel;

  constructor() { super('QaDebugScene'); }

  init(data: { runState: RunState }): void { this.runState = data.runState; }

  create(): void {
    const closeActiveBodyScene = () => {
      const map = this.scene.get('MapScene') as MapSceneLike;
      map.closeActiveModal?.();
    };
    this.panel = new QaDebugPanel(this, this.runState, closeActiveBodyScene);
    this.add.existing(this.panel);

    this.input.keyboard?.on('keydown-BACKTICK', () => this.panel.toggle());
  }

  isOpen(): boolean { return this.panel?.isOpen() ?? false; }
}
