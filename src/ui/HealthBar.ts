// ABOUTME: Animated health bar widget with a "catchup trail" that chases the real HP down.
// ABOUTME: Used by CombatScene for player and enemy HP readouts.

import * as Phaser from 'phaser';

export class HealthBar {
    scene: Phaser.Scene;
    x: number;
    y: number;
    width: number;
    height: number;
    bg: Phaser.GameObjects.Graphics;
    catchup: Phaser.GameObjects.Graphics;
    fg: Phaser.GameObjects.Graphics;
    border: Phaser.GameObjects.Graphics;
    currentHp: number;

    constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number, hp: number) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.bg = scene.add.graphics();
        this.catchup = scene.add.graphics();
        this.fg = scene.add.graphics();
        this.border = scene.add.graphics();
        this.currentHp = hp;
    }

    setVisible(visible: boolean) {
        this.bg.setVisible(visible);
        this.catchup.setVisible(visible);
        this.fg.setVisible(visible);
        this.border.setVisible(visible);
    }

    update(hp: number, maxHp: number, block: number) {
        const pct = Math.max(0, hp / maxHp);
        const startX = this.x - this.width / 2;

        this.bg.clear();
        this.bg.fillStyle(0x2d3436, 0.9);
        this.bg.fillRoundedRect(startX, this.y, this.width, this.height, 6);

        this.fg.clear();
        this.fg.fillStyle(0xd63031, 1);
        if (pct > 0) this.fg.fillRoundedRect(startX, this.y, this.width * pct, this.height, 6);

        if (this.currentHp > hp) {
            const oldPct = Math.max(0, this.currentHp / maxHp);
            this.catchup.clear();
            this.catchup.fillStyle(0xffffff, 0.8);
            this.catchup.fillRoundedRect(startX, this.y, this.width * oldPct, this.height, 6);

            this.scene.tweens.addCounter({
                from: oldPct * 1000, to: pct * 1000, duration: 600, delay: 200, ease: 'Power2',
                onUpdate: (tw) => {
                    const v = (tw.getValue() ?? 0) / 1000;
                    this.catchup.clear();
                    this.catchup.fillStyle(0xffffff, 0.8);
                    if (v > 0) this.catchup.fillRoundedRect(startX, this.y, this.width * v, this.height, 6);
                }
            });
        } else if (this.currentHp < hp) {
            this.catchup.clear();
        }

        this.currentHp = hp;

        this.border.clear();
        if (block > 0) {
            this.border.lineStyle(4, 0x0984e3, 1);
            this.border.strokeRoundedRect(startX - 2, this.y - 2, this.width + 4, this.height + 4, 8);
        } else {
            this.border.lineStyle(2, 0x000000, 1);
            this.border.strokeRoundedRect(startX, this.y, this.width, this.height, 6);
        }
    }
}
