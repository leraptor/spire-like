// ABOUTME: Phaser scene that preloads all sprites, spritesheets, and audio, then starts gameplay.
// ABOUTME: Also generates the particle flare texture and registers all sprite animations.

import * as Phaser from 'phaser';
import { witheredGardenBlueprint } from '../map/blueprints';
import { tutorialMap } from '../fixtures/maps/tutorial-map';
import { buildFreshRun } from '../run/buildFreshRun';
import { GOD_RAYS_SHADER_KEY, GOD_RAYS_SHADER_PATH } from '../fx/godRays';
import { RUN_STATE_CHANGED } from './HudScene';
import type { RunState } from '../models/RunState';

export class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }

    init(data?: { forceNewRun?: boolean; epoch?: number }): void {
        // No persistent state to reset; just note if a forced epoch was requested.
        (this as any).__forceEpoch = data?.epoch;
    }

    preload() {
        // Map Assets
        this.load.image('node_elite_rotgolem', 'assets/map/node_elite_rotgolem.png');
        this.load.image('node_boss_hollowgardener', 'assets/map/node_boss_hollowgardener.png');
        this.load.image('node_shop', 'assets/map/node_shop.png');
        this.load.image('node_combat', 'assets/map/node_combat.png');
        this.load.image('node_rest', 'assets/map/node_rest.png');
        this.load.image('node_event', 'assets/map/node_event.png');
        this.load.image('map_bg', 'assets/map/map_bg.png');
        this.load.image('mist_cloud', 'assets/map/mist_cloud.png');
        this.load.image('ink_splash', 'assets/map/ink_splash.png');
        this.load.image('avatar_sprite', 'assets/map/avatar_sprite.png');
        this.load.glsl('ink_shader', 'assets/map/ink.glsl');
        this.load.glsl(GOD_RAYS_SHADER_KEY, GOD_RAYS_SHADER_PATH);

        // Map audio (CC0 from opengameart.org)
        this.load.audio('map-bgm', 'assets/audio/map/bgm-hot-springs.mp3');
        this.load.audio('map-scroll-unfurl', 'assets/audio/map/scroll-unfurl.ogg');
        this.load.audio('map-footstep-1', 'assets/audio/map/footstep-1.ogg');
        this.load.audio('map-footstep-2', 'assets/audio/map/footstep-2.ogg');
        this.load.audio('map-footstep-3', 'assets/audio/map/footstep-3.ogg');

        this.load.image('bg', 'assets/bg.png');
        this.load.image('player', 'assets/player.png');
        this.load.spritesheet('droid_idle', 'assets/droid_idle.png', { frameWidth: 57, frameHeight: 55 });
        this.load.spritesheet('droid_attack', 'assets/droid_attack.png', { frameWidth: 124, frameHeight: 55 });
        this.load.spritesheet('droid_hit', 'assets/droid_hit.png', { frameWidth: 57, frameHeight: 55 });
        this.load.spritesheet('droid_run', 'assets/droid_run.png', { frameWidth: 57, frameHeight: 55 });
        this.load.spritesheet('droid_slam', 'assets/droid_slam.png', { frameWidth: 142, frameHeight: 107 });
        this.load.spritesheet('cyber_knight_idle',   'assets/cyber_knight_idle.png',   { frameWidth: 108, frameHeight: 130 });
        this.load.spritesheet('cyber_knight_attack', 'assets/cyber_knight_attack.png', { frameWidth: 160, frameHeight: 160 });
        this.load.image('card_strike', 'assets/card_strike.png');
        this.load.image('card_defend', 'assets/card_defend.png');
        this.load.image('card_ripAndTear', 'assets/card_ripAndTear.png');
        this.load.spritesheet('hero_idle', 'assets/hero_idle.png', { frameWidth: 46, frameHeight: 55 });
        this.load.spritesheet('hero_walk', 'assets/hero_walk.png', { frameWidth: 45, frameHeight: 58 });
        this.load.spritesheet('hero_from_idle', 'assets/hero_from_idle.png', { frameWidth: 45, frameHeight: 58 });
        this.load.spritesheet('hero_atk1', 'assets/hero_atk1.png', { frameWidth: 160, frameHeight: 64 });
        this.load.spritesheet('hero_atk2', 'assets/hero_atk2.png', { frameWidth: 192, frameHeight: 64 });
        this.load.spritesheet('hero_atk3', 'assets/hero_atk3.png', { frameWidth: 126, frameHeight: 93 });
        this.load.spritesheet('hero_dodge', 'assets/hero_dodge.png', { frameWidth: 96, frameHeight: 64 });
        this.load.spritesheet('hero_heal', 'assets/hero_heal.png', { frameWidth: 97, frameHeight: 81 });
        this.load.spritesheet('hero_hurt', 'assets/hero_hurt.png', { frameWidth: 70, frameHeight: 72 });
        this.load.spritesheet('hero_hurt_hard', 'assets/hero_hurt_hard.png', { frameWidth: 79, frameHeight: 72 });
        this.load.spritesheet('hero_run', 'assets/hero_run.png', { frameWidth: 52, frameHeight: 48 });
        this.load.spritesheet('hit_fx_01', 'assets/hit_fx_01.png', { frameWidth: 125, frameHeight: 87 });
        this.load.spritesheet('hit_fx_02', 'assets/hit_fx_02.png', { frameWidth: 125, frameHeight: 87 });

        this.load.audio('sfx_slash', 'assets/audio/slash.wav');
        this.load.audio('sfx_slash2', 'assets/audio/slash2.wav');
        this.load.audio('sfx_slash3', 'assets/audio/slash3.wav');
        this.load.audio('sfx_hit_heavy', 'assets/audio/hit_heavy.ogg');
        this.load.audio('sfx_hit_heavy2', 'assets/audio/hit_heavy2.ogg');
        this.load.audio('sfx_block', 'assets/audio/block.ogg');
        this.load.audio('sfx_block2', 'assets/audio/block2.ogg');
        this.load.audio('sfx_slam', 'assets/audio/slam.ogg');
        this.load.audio('sfx_card_draw', 'assets/audio/card_draw.ogg');
        this.load.audio('sfx_card_draw2', 'assets/audio/card_draw2.ogg');
        this.load.audio('sfx_card_play', 'assets/audio/card_play.ogg');
        this.load.audio('sfx_hover', 'assets/audio/hover.ogg');
        this.load.audio('sfx_button', 'assets/audio/button.ogg');
        this.load.audio('sfx_turn_start', 'assets/audio/turn_start.ogg');
        this.load.audio('sfx_victory', 'assets/audio/victory.ogg');
        this.load.audio('sfx_defeat', 'assets/audio/defeat.ogg');
        this.load.audio('sfx_whoosh', 'assets/audio/whoosh.ogg');
        this.load.audio('sfx_draw_weapon', 'assets/audio/draw_weapon.ogg');

        // Audio
        this.load.audio('sfx-card-draw', 'audio/card-draw.wav');
        this.load.audio('sfx-card-play', 'audio/card-play.wav');
        this.load.audio('sfx-hit', 'audio/hit.wav');
        this.load.audio('sfx-block', 'audio/block.wav');
        this.load.audio('sfx-ui-hover', 'audio/ui-hover.wav');
        this.load.audio('sfx-ui-click', 'audio/ui-click.wav');
        this.load.audio('bgm-dungeon', 'audio/bgm-dungeon.ogg');
    }

    create() {
        // Generate a flare texture for particles
        const g = this.make.graphics({ x: 0, y: 0 });
        g.fillStyle(0xffffff, 1);
        g.fillCircle(16, 16, 16);
        g.generateTexture('flare', 32, 32);
        g.destroy();

        // Programmatic textures for map flourishes & particles
        const pG = this.make.graphics({ x: 0, y: 0 });
        pG.fillStyle(0xffffff, 1);
        pG.fillEllipse(8, 16, 8, 16);
        pG.generateTexture('petal', 16, 32);
        pG.destroy();

        this.anims.create({ key: 'hero-idle', frames: this.anims.generateFrameNumbers('hero_idle', { start: 0, end: 9 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'hero-from-idle', frames: this.anims.generateFrameNumbers('hero_from_idle', { start: 0, end: 1 }), frameRate: 8, repeat: 0 });
        this.anims.create({ key: 'hero-walk', frames: this.anims.generateFrameNumbers('hero_walk', { start: 0, end: 23 }), frameRate: 12, repeat: -1 });
        this.anims.create({ key: 'hero-atk1', frames: this.anims.generateFrameNumbers('hero_atk1', { start: 0, end: 16 }), frameRate: 20, repeat: 0 });
        this.anims.create({ key: 'hero-atk2', frames: this.anims.generateFrameNumbers('hero_atk2', { start: 0, end: 18 }), frameRate: 20, repeat: 0 });
        this.anims.create({ key: 'hero-atk3', frames: this.anims.generateFrameNumbers('hero_atk3', { start: 0, end: 23 }), frameRate: 18, repeat: 0 });
        this.anims.create({ key: 'hero-dodge', frames: this.anims.generateFrameNumbers('hero_dodge', { start: 0, end: 23 }), frameRate: 20, repeat: 0 });
        this.anims.create({ key: 'hero-heal', frames: this.anims.generateFrameNumbers('hero_heal', { start: 0, end: 17 }), frameRate: 12, repeat: 0 });
        this.anims.create({ key: 'hero-hurt', frames: this.anims.generateFrameNumbers('hero_hurt', { start: 0, end: 19 }), frameRate: 16, repeat: 0 });
        this.anims.create({ key: 'hero-hurt-hard', frames: this.anims.generateFrameNumbers('hero_hurt_hard', { start: 0, end: 29 }), frameRate: 16, repeat: 0 });
        this.anims.create({ key: 'hero-run', frames: this.anims.generateFrameNumbers('hero_run', { start: 0, end: 24 }), frameRate: 16, repeat: -1 });
        this.anims.create({ key: 'hit-fx-01', frames: this.anims.generateFrameNumbers('hit_fx_01', { start: 0, end: 4 }), frameRate: 15, repeat: 0 });
        this.anims.create({ key: 'hit-fx-02', frames: this.anims.generateFrameNumbers('hit_fx_02', { start: 0, end: 4 }), frameRate: 15, repeat: 0 });

        this.anims.create({ key: 'droid-idle', frames: this.anims.generateFrameNumbers('droid_idle', { start: 0, end: 6 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'droid-attack1', frames: this.anims.generateFrameNumbers('droid_attack', { start: 0, end: 9 }), frameRate: 18, repeat: 0 });
        this.anims.create({ key: 'droid-attack2', frames: this.anims.generateFrameNumbers('droid_attack', { start: 10, end: 18 }), frameRate: 18, repeat: 0 });
        this.anims.create({ key: 'droid-hit', frames: this.anims.generateFrameNumbers('droid_hit', { start: 0, end: 2 }), frameRate: 12, repeat: 0 });
        this.anims.create({ key: 'droid-death', frames: this.anims.generateFrameNumbers('droid_hit', { start: 0, end: 7 }), frameRate: 10, repeat: 0 });
        this.anims.create({ key: 'droid-run', frames: this.anims.generateFrameNumbers('droid_run', { start: 1, end: 8 }), frameRate: 14, repeat: -1 });
        this.anims.create({ key: 'droid-slam', frames: this.anims.generateFrameNumbers('droid_slam', { start: 0, end: 8 }), frameRate: 14, repeat: 0 });
        this.anims.create({
            key: 'cyber-knight-idle',
            frames: this.anims.generateFrameNumbers('cyber_knight_idle', { start: 0, end: 63 }),
            frameRate: 12,
            repeat: -1,
        });
        this.anims.create({
            key: 'cyber-knight-attack-windup',
            frames: this.anims.generateFrameNumbers('cyber_knight_attack', { start: 0, end: 39 }),
            frameRate: 20,
            repeat: 0,
        });
        this.anims.create({
            key: 'cyber-knight-attack-strike',
            frames: this.anims.generateFrameNumbers('cyber_knight_attack', { start: 40, end: 63 }),
            frameRate: 30,
            repeat: 0,
        });

        // Build a fresh run and hand off to BlessingScene.
        const params = new URLSearchParams(window.location.search);
        const mapParam = params.get('map');
        const seedParam = params.get('seed');
        const epochParam = params.get('epoch');

        const defaultDevSeed = 1;
        const seed = seedParam ? Number(seedParam) : (import.meta.env.DEV ? defaultDevSeed : Date.now());
        const epoch = epochParam ? Number(epochParam) : ((this as any).__forceEpoch ?? 1);

        const runState = buildFreshRun({ seed, epoch, blueprint: witheredGardenBlueprint });
        if (mapParam === 'tutorial') runState.map = tutorialMap;
        this.wireRunStateEmitter(runState);
        this.scene.start('BlessingScene', { runState });
    }

    /**
     * Wire runState.onStateChanged once at boot so every transition broadcasts over the
     * Phaser game event bus. HudScene + any future listeners (body scenes) subscribe to
     * RUN_STATE_CHANGED instead of fighting over the single callback slot.
     */
    private wireRunStateEmitter(runState: RunState): void {
        runState.onStateChanged = (s: RunState) => this.game.events.emit(RUN_STATE_CHANGED, s);
    }
}
