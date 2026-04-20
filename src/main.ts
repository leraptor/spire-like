// ABOUTME: Phaser game entry point. Configures the renderer and boots BootScene.
// ABOUTME: All scenes, widgets, and gameplay logic live in their own modules.
import * as Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { BlessingScene } from './scenes/BlessingScene';
import { MapScene } from './scenes/MapScene';
import { CombatScene } from './scenes/CombatScene';
import { HudScene } from './scenes/HudScene';
import { MerchantScene } from './scenes/MerchantScene';
import { ChestScene } from './scenes/ChestScene';
import { EventScene } from './scenes/EventScene';
import { RewardScene } from './scenes/RewardScene';
import { RestScene } from './scenes/RestScene';
import { BossVictoryScene } from './scenes/BossVictoryScene';
import { DeathScene } from './scenes/DeathScene';
import { EpochUnlockScene } from './scenes/EpochUnlockScene';
import { EpochTimelineScene } from './scenes/EpochTimelineScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    pixelArt: true,
    preserveDrawingBuffer: true,
    scene: [
        BootScene,
        BlessingScene,
        MapScene,
        CombatScene,
        RewardScene,
        ChestScene,
        MerchantScene,
        EventScene,
        RestScene,
        BossVictoryScene,
        DeathScene,
        EpochUnlockScene,
        EpochTimelineScene,
        HudScene, // top bar — listed last so it renders above body scenes
    ],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        fullscreenTarget: 'game-container'
    },
    input: {
        activePointers: 2
    },
    physics: {
        default: 'arcade',
        arcade: { debug: false }
    }
};

const game = new Phaser.Game(config);
(window as any).game = game;
