// ABOUTME: Phaser scene rendering turn-based card combat between the player and a single enemy.
// ABOUTME: Handles card playing, targeting, animations, health bars, and combat state transitions.

import * as Phaser from 'phaser';
import { CombatState, TurnPhase } from '../models/CombatState';
import { CombatEntity } from '../models/CombatEntity';
import type { Card } from '../models/Card';
import { CardType, TargetType } from '../models/Card';
import { HealthBar } from '../ui/HealthBar';
import { CardView } from '../ui/CardView';
import { recordEnemyDefeated, setPhase } from '../run/transitions';
import { createCombatGodRays } from '../fx/godRays';

export class CombatScene extends Phaser.Scene {
    state!: CombatState;
    playerSprite!: Phaser.GameObjects.Sprite;
    enemySprite!: Phaser.GameObjects.Sprite;
    handContainer!: Phaser.GameObjects.Container;

    playerHpBar!: HealthBar;
    playerHpText!: Phaser.GameObjects.Text;
    playerBlockText!: Phaser.GameObjects.Text;

    enemyHpBar!: HealthBar;
    enemyHpText!: Phaser.GameObjects.Text;
    enemyBlockText!: Phaser.GameObjects.Text;
    enemyIntentText!: Phaser.GameObjects.Text;

    pStatuses!: Phaser.GameObjects.Container;
    eStatuses!: Phaser.GameObjects.Container;

    energyText!: Phaser.GameObjects.Text;
    deckText!: Phaser.GameObjects.Text;
    discardText!: Phaser.GameObjects.Text;
    exhaustText!: Phaser.GameObjects.Text;

    endTurnBtn!: Phaser.GameObjects.Container;
    topBarText!: Phaser.GameObjects.Text;
    targetArrow!: Phaser.GameObjects.Graphics;
    gameOverShown = false;

    constructor() { super('CombatScene'); }

    private launchData: {
        enemyId?: string;
        returnTo?: string;
        runState?: import('../models/RunState').RunState;
        nodeType?: string;
    } = {};

    init(data: {
        enemyId?: string;
        returnTo?: string;
        runState?: import('../models/RunState').RunState;
        nodeType?: string;
    }): void {
        this.launchData = data ?? {};
        this.gameOverShown = false;
    }

    playSfx(key: string, volume = 0.5) {
        this.sound.play(key, { volume });
    }

    playRandomSfx(keys: string[], volume = 0.5) {
        this.playSfx(keys[Math.floor(Math.random() * keys.length)]!, volume);
    }

    create() {
        this.state = new CombatState();
        this.state.onStateChanged = () => this.updateUI();

        this.add.image(640, 320, 'bg').setDisplaySize(1280, 720);
        createCombatGodRays(this);

        // Ambient floating particles
        this.add.particles(640, 360, 'flare', {
            x: { min: 0, max: 1280 },
            y: { min: 0, max: 500 },
            scale: { start: 0.15, end: 0 },
            alpha: { start: 0.3, end: 0 },
            tint: [0x74b9ff, 0xa29bfe, 0xffffff],
            speed: { min: 5, max: 20 },
            angle: { min: 250, max: 290 },
            lifespan: { min: 3000, max: 6000 },
            frequency: 300,
            blendMode: 'ADD'
        });

        // Vignette overlay
        const vignette = this.add.graphics();
        vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.7, 0.7, 0, 0);
        vignette.fillRect(0, 0, 1280, 120);
        vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.7, 0.7);
        vignette.fillRect(0, 600, 1280, 120);

        const floor = this.add.graphics();
        floor.fillStyle(0x000000, 0.4);
        floor.fillEllipse(300, 510, 120, 25);
        floor.fillEllipse(950, 480, 150, 30);

        const topBar = this.add.graphics();
        topBar.fillStyle(0x000000, 0.7);
        topBar.fillRect(0, 0, 1280, 45);
        topBar.lineStyle(2, 0x74b9ff, 1);
        topBar.strokeRect(0, 0, 1280, 45);
        this.topBarText = this.add.text(20, 10, '', { fontSize: '22px', color: '#fff', fontStyle: 'bold' });

        const bgm = this.sound.add('bgm-dungeon', { loop: true, volume: 0.3 });
        bgm.play();

        const muteBtn = this.add.text(1150, 10, '🔊', { fontSize: '22px', color: '#fff' }).setInteractive({ useHandCursor: true });
        muteBtn.on('pointerdown', () => {
            bgm.mute = !bgm.mute;
            muteBtn.setText(bgm.mute ? '🔇' : '🔊');
        });

        this.add.text(1200, 10, '⚙️ 🗺️', { fontSize: '22px', color: '#fff' });

        this.playerSprite = this.add.sprite(300, 510, 'hero_idle').setOrigin(0.5, 1).setScale(4).setInteractive();
        this.playerSprite.setFlipX(true);
        this.playerSprite.play('hero-idle');
        this.enemySprite = this.add.sprite(950, 480, 'droid_idle').setOrigin(0.5, 1).setScale(6).setFlipX(true).setInteractive();
        this.enemySprite.play('droid-idle');
        (this.playerSprite as any).baseX = 300;
        (this.enemySprite as any).baseX = 950;

        this.physics.add.existing(this.enemySprite);
        (this.enemySprite.body as Phaser.Physics.Arcade.Body).setSize(this.enemySprite.width * 0.8, this.enemySprite.height * 0.8);

        this.targetArrow = this.add.graphics().setDepth(1500);
        this.handContainer = this.add.container(640, 700);

        this.createUI();
        this.setupDragHandlers();
        this.state.startCombat();
        this.showBanner('PLAYER TURN', '#74b9ff');

        // Fullscreen on first tap (mobile)
        if (this.sys.game.device.os.android || this.sys.game.device.os.iOS) {
            this.input.once('pointerdown', () => {
                this.scale.startFullscreen();
            });
        }
    }

    setupDragHandlers() {
        this.input.on('dragstart', (_pointer: any, gameObject: CardView) => {
            if (this.state.currentPhase !== TurnPhase.PLAYER_ACTION) {
                this.showFloatingMessage('Not your turn!');
                return;
            }
            (gameObject as any).isDragging = true;
            gameObject.setDepth(200);
            this.tweens.killTweensOf(gameObject);
            gameObject.setScale(1.3);
            gameObject.rotation = 0;
            gameObject.glowGraphic.setAlpha(1);
            gameObject.trailEmitter.start();
        });

        this.input.on('drag', (pointer: any, gameObject: CardView, dragX: number, dragY: number) => {
            if (this.state.currentPhase !== TurnPhase.PLAYER_ACTION) return;
            gameObject.trailEmitter.setPosition(pointer.x, pointer.y);

            // Targeting arrow for cards that target enemies
            if ((gameObject.cardData.target === TargetType.SINGLE_ENEMY || gameObject.cardData.target === TargetType.ALL_ENEMIES) && dragY < 550) {
                gameObject.x = (gameObject as any).baseX;
                gameObject.y = (gameObject as any).baseY;
                gameObject.rotation = (gameObject as any).baseRotation;
                gameObject.setScale(1.0);
                const isTargeting = this.enemySprite.getBounds().contains(pointer.x, pointer.y);
                this.drawTargetingArrow(
                    gameObject.x + 640, gameObject.y + 580,
                    pointer.x, pointer.y, isTargeting
                );
                if (isTargeting) {
                    this.enemySprite.setTint(0xff4444);
                    this.enemySprite.setScale(6.3);
                } else {
                    this.enemySprite.clearTint();
                    this.enemySprite.setScale(6);
                }
            } else {
                this.targetArrow.clear();
                this.enemySprite.clearTint();
                this.enemySprite.setScale(6);
                gameObject.x = dragX;
                gameObject.y = dragY;
                gameObject.rotation = 0;
            }
        });

        this.input.on('dragend', (pointer: any, gameObject: CardView) => {
            if (this.state.currentPhase !== TurnPhase.PLAYER_ACTION) return;
            (gameObject as any).isDragging = false;
            this.targetArrow.clear();
            this.enemySprite.clearTint();
            this.enemySprite.setScale(6);
            gameObject.glowGraphic.setAlpha(0);
            gameObject.trailEmitter.stop();

            if (this.state.player.energy < gameObject.cardData.cost) {
                this.showFloatingMessage('Not enough energy!');
                this.returnCardToHand(gameObject);
                return;
            }

            let target: any = undefined;
            if (gameObject.cardData.target === TargetType.SINGLE_ENEMY) {
                const bounds = this.enemySprite.getBounds();
                if (bounds.contains(pointer.x, pointer.y)) {
                    target = this.state.enemy;
                }
            } else if (gameObject.cardData.target === TargetType.ALL_ENEMIES) {
                if (pointer.y < 500) target = this.state.enemy;
            } else if (gameObject.cardData.target === TargetType.SELF) {
                if (pointer.y < 500) target = this.state.player;
            }

            if (gameObject.cardData.target === TargetType.SINGLE_ENEMY && !target) {
                this.returnCardToHand(gameObject);
                return;
            }

            if (target || gameObject.cardData.target !== TargetType.SINGLE_ENEMY) {
                if ((gameObject.cardData.target === TargetType.SELF || gameObject.cardData.target === TargetType.ALL_ENEMIES) && pointer.y >= 550) {
                    this.returnCardToHand(gameObject);
                    return;
                }
                const result = this.state.playCard(gameObject.cardData.id, target);
                if (result.success) {
                    (gameObject as any).played = true;
                    this.playCardAnim(gameObject, target === this.state.enemy ? this.enemySprite : this.playerSprite, result.damages);
                } else {
                    this.returnCardToHand(gameObject);
                }
            } else {
                this.returnCardToHand(gameObject);
            }
        });
    }

    drawTargetingArrow(startX: number, startY: number, endX: number, endY: number, isTargeted: boolean) {
        this.targetArrow.clear();
        const color = isTargeted ? 0xff4444 : 0xffd700;
        this.targetArrow.lineStyle(6, color, 0.8);
        const curve = new Phaser.Curves.CubicBezier(
            new Phaser.Math.Vector2(startX, startY),
            new Phaser.Math.Vector2(startX, startY - 200),
            new Phaser.Math.Vector2(endX, endY + 200),
            new Phaser.Math.Vector2(endX, endY)
        );
        curve.draw(this.targetArrow);
        // Arrowhead
        const tangent = curve.getTangent(1);
        const angle = Math.atan2(tangent.y, tangent.x);
        this.targetArrow.fillStyle(color, 1);
        this.targetArrow.beginPath();
        this.targetArrow.moveTo(endX, endY);
        this.targetArrow.lineTo(endX - 25 * Math.cos(angle - Math.PI / 6), endY - 25 * Math.sin(angle - Math.PI / 6));
        this.targetArrow.lineTo(endX - 25 * Math.cos(angle + Math.PI / 6), endY - 25 * Math.sin(angle + Math.PI / 6));
        this.targetArrow.closePath();
        this.targetArrow.fillPath();
        if (isTargeted) {
            this.targetArrow.fillStyle(color, 0.2);
            this.targetArrow.fillCircle(endX, endY, 50);
        }
    }

    returnCardToHand(cardView: CardView) {
        cardView.setDepth((cardView as any).baseDepth);
        this.tweens.add({
            targets: cardView,
            scaleX: 1.0, scaleY: 1.0,
            x: (cardView as any).baseX,
            y: (cardView as any).baseY,
            rotation: (cardView as any).baseRotation,
            duration: 200, ease: 'Power2'
        });
    }

    createUI() {
        this.playerHpBar = new HealthBar(this, 300, 520, 160, 20, this.state.player.hp);
        this.playerHpText = this.add.text(300, 490, '', { fontSize: '20px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
        this.playerBlockText = this.add.text(210, 475, '', { fontSize: '26px', color: '#0984e3', fontStyle: 'bold', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);

        this.enemyHpBar = new HealthBar(this, 950, 490, 180, 22, this.state.enemy.hp);
        this.enemyHpText = this.add.text(950, 460, '', { fontSize: '20px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
        this.enemyBlockText = this.add.text(1050, 445, '', { fontSize: '26px', color: '#0984e3', fontStyle: 'bold', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
        this.enemyIntentText = this.add.text(950, 280, '', { fontSize: '42px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);

        this.pStatuses = this.add.container(230, 550);
        this.eStatuses = this.add.container(880, 520);

        const energyBg = this.add.graphics();
        energyBg.fillStyle(0x0984e3, 1);
        energyBg.lineStyle(6, 0x74b9ff, 1);
        energyBg.fillCircle(120, 600, 60);
        energyBg.strokeCircle(120, 600, 60);
        const energyOrb = this.add.circle(120, 600, 60, 0x0984e3, 0).setStrokeStyle(6, 0x74b9ff);
        this.tweens.add({ targets: energyOrb, scale: 1.06, alpha: 0.3, duration: 800, yoyo: true, repeat: -1 });
        this.energyText = this.add.text(120, 600, '', { fontSize: '50px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);

        this.add.rectangle(80, 690, 60, 80, 0x2d3436).setStrokeStyle(3, 0x636e72);
        this.deckText = this.add.text(80, 690, '', { fontSize: '28px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

        this.add.rectangle(1120, 690, 60, 80, 0x2d3436).setStrokeStyle(3, 0x6c5ce7);
        this.exhaustText = this.add.text(1120, 690, '', { fontSize: '28px', color: '#a29bfe', fontStyle: 'bold' }).setOrigin(0.5);

        this.add.rectangle(1200, 690, 60, 80, 0x2d3436).setStrokeStyle(3, 0x636e72);
        this.discardText = this.add.text(1200, 690, '', { fontSize: '28px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

        this.endTurnBtn = this.add.container(1150, 580);
        const btnBg = this.add.graphics();
        btnBg.fillStyle(0x6c5ce7, 1);
        btnBg.fillRoundedRect(-80, -30, 160, 60, 30);
        btnBg.lineStyle(4, 0xa29bfe, 1);
        btnBg.strokeRoundedRect(-80, -30, 160, 60, 30);

        const endTurnText = this.add.text(0, 0, 'End Turn', { fontSize: '24px', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5);
        this.endTurnBtn.add([btnBg, endTurnText]);
        this.endTurnBtn.setSize(160, 60);
        this.endTurnBtn.setInteractive({ useHandCursor: true });

        this.endTurnBtn.on('pointerdown', () => {
            this.sound.play('sfx-ui-click', { volume: 0.6 });
            if (this.state.currentPhase === TurnPhase.PLAYER_ACTION) {
                this.playSfx('sfx_button', 0.4);
                this.state.endPlayerTurn();
                this.showBanner('ENEMY TURN', '#ff7675');

                this.time.delayedCall(1200, () => {
                    const action = this.state.executeEnemyAction();
                    if (action.type === 'Attack' && action.slam) {
                        this.execSlamAttack(action.actualDamage, () => {
                            this.time.delayedCall(600, () => this.startPlayerTurnAnim());
                        });
                    } else if (action.type === 'Attack') {
                        this.execAttacks(this.enemySprite, this.playerSprite, -1, [action.actualDamage], () => {
                            this.time.delayedCall(600, () => this.startPlayerTurnAnim());
                        });
                    } else if (action.type === 'Defend') {
                        this.animateBuff(this.enemySprite, '🛡️ +15', () => {
                            this.time.delayedCall(600, () => this.startPlayerTurnAnim());
                        });
                    } else {
                        this.animateBuff(this.enemySprite, '💔 Vulnerable', () => {
                            this.time.delayedCall(600, () => this.startPlayerTurnAnim());
                        });
                    }
                });
            }
        });
        this.endTurnBtn.on('pointerover', () => {
            btnBg.clear();
            btnBg.fillStyle(0xa29bfe, 1).fillRoundedRect(-80, -30, 160, 60, 30);
            btnBg.lineStyle(4, 0xa29bfe, 1).strokeRoundedRect(-80, -30, 160, 60, 30);
        });
        this.endTurnBtn.on('pointerout', () => {
            btnBg.clear();
            btnBg.fillStyle(0x6c5ce7, 1).fillRoundedRect(-80, -30, 160, 60, 30);
            btnBg.lineStyle(4, 0xa29bfe, 1).strokeRoundedRect(-80, -30, 160, 60, 30);
        });
    }

    startPlayerTurnAnim() {
        if (this.state.currentPhase === TurnPhase.GAME_OVER) return;
        this.playSfx('sfx_turn_start', 0.4);
        this.state.startPlayerTurn();
        this.showBanner('PLAYER TURN', '#74b9ff');
    }

    renderStatuses(entity: CombatEntity, container: Phaser.GameObjects.Container) {
        container.removeAll(true);
        let offsetX = 0;
        const addStatus = (icon: string, val: number, color: string) => {
            if (val <= 0) return;
            const bg = this.add.graphics();
            bg.fillStyle(0x000000, 0.7);
            bg.fillRoundedRect(offsetX, 0, 40, 40, 6);
            bg.lineStyle(2, parseInt(color.replace('#', ''), 16), 1);
            bg.strokeRoundedRect(offsetX, 0, 40, 40, 6);
            const iconText = this.add.text(offsetX + 20, 12, icon, { fontSize: '16px' }).setOrigin(0.5);
            const valText = this.add.text(offsetX + 20, 30, val.toString(), {
                fontSize: '14px', color: color, fontStyle: 'bold'
            }).setOrigin(0.5);
            container.add([bg, iconText, valText]);
            offsetX += 46;
        };
        addStatus('💪', entity.strength, '#ffd700');
        addStatus('💔', entity.vulnerable, '#ff7675');
        addStatus('📉', entity.weak, '#74b9ff');
    }

    updateUI() {
        this.topBarText.setText(`❤️ ${this.state.player.hp}/${this.state.player.maxHp}    🪙 62    🧪 Potions    🗺️ Floor 8`);

        this.playerHpBar.update(this.state.player.hp, this.state.player.maxHp, this.state.player.block);
        this.playerHpText.setText(`${this.state.player.hp}/${this.state.player.maxHp}`);
        this.playerBlockText.setText(`🛡️ ${this.state.player.block}`);
        this.playerBlockText.setVisible(this.state.player.block > 0);

        this.enemyHpBar.update(this.state.enemy.hp, this.state.enemy.maxHp, this.state.enemy.block);
        this.enemyHpText.setText(`${this.state.enemy.hp}/${this.state.enemy.maxHp}`);
        this.enemyBlockText.setText(`🛡️ ${this.state.enemy.block}`);
        this.enemyBlockText.setVisible(this.state.enemy.block > 0);

        this.energyText.setText(`${this.state.player.energy}/${this.state.player.maxEnergy}`);
        this.deckText.setText(`🎴\n${this.state.deck.drawPile.length}`);
        this.discardText.setText(`🗑️\n${this.state.deck.discardPile.length}`);
        this.exhaustText.setText(`🔥\n${this.state.deck.exhaustPile.length}`);

        const intent = this.state.getEnemyIntentDisplay();
        this.enemyIntentText.setText(intent.text);
        this.enemyIntentText.setColor(intent.color);

        this.renderStatuses(this.state.player, this.pStatuses);
        this.renderStatuses(this.state.enemy, this.eStatuses);

        if (this.state.currentPhase === TurnPhase.PLAYER_START) {
            this.renderHand(true);
        } else if (this.state.currentPhase === TurnPhase.PLAYER_ACTION || this.state.currentPhase === TurnPhase.ENEMY_ACTION || this.state.currentPhase === TurnPhase.ENEMY_START) {
            this.renderHand();
        }

        if (this.state.currentPhase === TurnPhase.GAME_OVER && !this.gameOverShown) {
            this.gameOverShown = true;
            const playerWon = this.state.enemy.hp <= 0;
            const msg = playerWon ? 'VICTORY' : 'YOU DIED';
            const color = playerWon ? '#ffd700' : '#ff7675';

            this.playSfx(playerWon ? 'sfx_victory' : 'sfx_defeat', 0.7);
            if (playerWon) {
                this.enemySprite.play('droid-death');
                this.tweens.add({ targets: this.enemySprite, alpha: 0, duration: 800, delay: 400 });
            }

            const t = this.add.text(640, 360, msg, {
                fontSize: '100px', color: color, fontStyle: 'bold', stroke: '#000', strokeThickness: 12
            }).setOrigin(0.5).setDepth(1000).setAlpha(0);
            this.tweens.add({ targets: t, alpha: 1, duration: 300, delay: playerWon ? 600 : 0, onComplete: () => {
                this.tweens.add({ targets: t, scale: 1.05, duration: 800, yoyo: true, repeat: -1 });
            }});
            this.endTurnBtn.setVisible(false);

            this.time.delayedCall(2200, () => {
                const runState = this.launchData.runState;
                if (!runState) {
                    // Fallback: standalone combat test. Return to BootScene.
                    this.scene.start('BootScene');
                    return;
                }
                runState.playerHp = this.state.player.hp;
                if (playerWon) {
                    recordEnemyDefeated(runState);
                    const nextPhase = this.launchData.nodeType === 'boss' ? 'BOSS_VICTORY' : 'REWARD';
                    setPhase(runState, nextPhase);
                } else {
                    setPhase(runState, 'DEATH');
                }
                this.scene.start('MapScene', { runState });
            });
        } else {
            this.endTurnBtn.setVisible(this.state.currentPhase === TurnPhase.PLAYER_ACTION);
        }
    }

    renderHand(isInitialDraw = false) {
        const cards = this.state.deck.hand;
        const count = cards.length;
        const angleSpacing = 0.1;
        const totalAngle = (count - 1) * angleSpacing;
        const startAngle = count > 1 ? -totalAngle / 2 : 0;
        const radius = 1000;

        const existingViews = this.handContainer.getAll() as CardView[];

        existingViews.forEach(view => {
            if (!cards.find(c => c.id === view.cardData.id) && !(view as any).isPlayed) {
                view.destroy();
            }
        });

        cards.forEach((card: Card, i: number) => {
            const angle = startAngle + (i * angleSpacing);
            const targetX = Math.sin(angle) * radius;
            const targetY = -Math.cos(angle) * radius + radius - 30;

            let cardView = existingViews.find(v => v.cardData.id === card.id && !(v as any).isPlayed) as CardView;

            if (!cardView) {
                cardView = new CardView(this, targetX, targetY, card);
                this.handContainer.add(cardView);

                cardView.x = -560;
                cardView.y = -10;
                cardView.rotation = -Math.PI / 4;
                cardView.setScale(0.1);
                cardView.setAlpha(0);

                this.time.delayedCall(i * 120, () => this.playRandomSfx(['sfx_card_draw', 'sfx_card_draw2'], 0.3));
                this.tweens.add({
                    targets: cardView,
                    x: targetX, y: targetY,
                    rotation: angle,
                    scaleX: 1, scaleY: 1, alpha: 1,
                    duration: 500,
                    delay: i * 120,
                    ease: 'Back.easeOut'
                });
            } else {
                if (!(cardView as any).isDragging) {
                    this.tweens.add({
                        targets: cardView,
                        x: targetX, y: targetY,
                        rotation: angle,
                        duration: 300, ease: 'Power2'
                    });
                }
            }

            cardView.setDepth(i);
            (cardView as any).baseX = targetX;
            (cardView as any).baseY = targetY;
            (cardView as any).baseRotation = angle;
            (cardView as any).baseDepth = i;

            // Dim cards the player can't afford
            cardView.updateAffordability(this.state.player.energy >= card.cost);
        });
    }

    playCardAnim(cardView: CardView, targetSprite: Phaser.GameObjects.Sprite | undefined, damages: number[]) {
        (cardView as any).isPlayed = true;
        this.handContainer.bringToTop(cardView);
        this.playSfx('sfx_card_play', 0.5);

        this.tweens.add({
            targets: cardView,
            x: 0, y: -340,
            scaleX: 1.8, scaleY: 1.8,
            rotation: 0,
            duration: 250, ease: 'Power2',
            onComplete: () => {
                this.cameras.main.shake(80, 0.004);
                const flash = this.add.rectangle(640, 360, 1280, 720, 0xffffff, 0.25).setDepth(2000).setBlendMode('ADD');
                this.tweens.add({ targets: flash, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
                this.spawnParticles(640, 360, cardView.glowColor, 30);

                if (cardView.cardData.type === CardType.ATTACK && targetSprite) {
                    this.sound.play('sfx-hit', { volume: 0.7 });
                    this.execAttacks(this.playerSprite, targetSprite, 1, damages, () => this.finishCardDiscard(cardView));
                } else {
                    if (cardView.cardData.effect.block) this.sound.play('sfx-block', { volume: 0.6 });
                    let txt = '';
                    if (cardView.cardData.effect.block) txt += `🛡️+${cardView.cardData.effect.block} `;
                    if (cardView.cardData.effect.strength) txt += `💪+${cardView.cardData.effect.strength} `;
                    if (cardView.cardData.effect.draw) txt += `🃏+${cardView.cardData.effect.draw} `;
                    if (cardView.cardData.effect.vulnerable) txt += `💔+${cardView.cardData.effect.vulnerable} `;
                    if (cardView.cardData.effect.weak) txt += `📉+${cardView.cardData.effect.weak} `;

                    // Pick skill animation based on card effect
                    if (cardView.cardData.effect.block) {
                        this.playHeroOverlay('hero-dodge', 'hero_dodge', () => {
                            this.animateBuff(targetSprite || this.playerSprite, txt.trim(), () => this.finishCardDiscard(cardView));
                        });
                    } else {
                        this.animateBuff(
                            targetSprite || this.playerSprite,
                            txt.trim() || cardView.cardData.title,
                            () => this.finishCardDiscard(cardView)
                        );
                    }
                }
            }
        });
    }

    finishCardDiscard(cardView: CardView) {
        const destX = cardView.cardData.exhaust ? 480 : 560;
        this.tweens.add({
            targets: cardView,
            x: destX, y: -10,
            scaleX: 0.1, scaleY: 0.1, alpha: 0,
            duration: 250, ease: 'Power2',
            onComplete: () => {
                cardView.destroy();
                this.renderHand();
            }
        });
    }

    playHeroOverlay(animKey: string, textureKey: string, onComplete?: () => void) {
        const action = this.add.sprite(this.playerSprite.x, this.playerSprite.y, textureKey)
            .setOrigin(0.5, 1)
            .setScale(4)
            .setFlipX(true)
            .setDepth(this.playerSprite.depth + 1);
        this.playerSprite.setVisible(false);
        action.play(animKey);
        action.once('animationcomplete', () => {
            action.destroy();
            this.playerSprite.setVisible(true);
            if (onComplete) onComplete();
        });
    }

    spawnHitFx(x: number, y: number) {
        const fxKey = Phaser.Math.Between(0, 1) === 0 ? 'hit_fx_01' : 'hit_fx_02';
        const fxAnim = fxKey === 'hit_fx_01' ? 'hit-fx-01' : 'hit-fx-02';
        const fx = this.add.sprite(x, y, fxKey).setScale(3).setDepth(500).setBlendMode('ADD');
        fx.play(fxAnim);
        fx.once('animationcomplete', () => fx.destroy());
    }

    execAttacks(attacker: Phaser.GameObjects.Sprite, defender: Phaser.GameObjects.Sprite, direction: 1 | -1, damages: number[], onDone: () => void) {
        if (damages.length === 0) { onDone(); return; }
        const startX = (attacker as any).baseX;
        const isPlayer = attacker === this.playerSprite;
        const approachDist = isPlayer ? 350 : 350;
        const approachX = startX + (approachDist * direction);

        // Pick attack animation based on hit count
        let atkAnimKey = 'hero-atk1';
        let atkTexture = 'hero_atk1';
        if (damages.length === 2) { atkAnimKey = 'hero-atk2'; atkTexture = 'hero_atk2'; }
        if (damages.length >= 3) { atkAnimKey = 'hero-atk3'; atkTexture = 'hero_atk3'; }

        // Run toward the target
        this.playSfx('sfx_whoosh', 0.3);
        if (!isPlayer) attacker.play('droid-run');
        this.tweens.add({
            targets: attacker,
            x: approachX,
            duration: 350, ease: 'Power2',
            onComplete: () => {
                // Spawn an overlay sprite for the attack animation
                let actionSprite: Phaser.GameObjects.Sprite | null = null;
                this.playRandomSfx(['sfx_slash', 'sfx_slash2', 'sfx_slash3'], 0.5);
                if (isPlayer) {
                    attacker.setVisible(false);
                    actionSprite = this.add.sprite(approachX, attacker.y, atkTexture)
                        .setOrigin(0.5, 1).setScale(4).setFlipX(true)
                        .setDepth(attacker.depth + 1);
                    actionSprite.play(atkAnimKey);
                } else {
                    this.playSfx('sfx_draw_weapon', 0.4);
                    attacker.play(Math.random() < 0.5 ? 'droid-attack1' : 'droid-attack2');
                }

                let delay = 0;
                const hitInterval = damages.length >= 3 ? 200 : 280;

                damages.forEach((dmg, i) => {
                    this.time.delayedCall(delay, () => {
                        const lungeTarget = actionSprite || attacker;
                        this.tweens.add({
                            targets: lungeTarget,
                            x: approachX + (40 * direction),
                            duration: 60, ease: 'Power2',
                            onComplete: () => {
                                this.animateHit(defender, dmg);
                                this.spawnHitFx(defender.x + Phaser.Math.Between(-30, 30), defender.y - 80);
                                this.time.delayedCall(60, () => {
                                    this.tweens.add({
                                        targets: lungeTarget,
                                        x: approachX,
                                        duration: 100, ease: 'Power2',
                                        onComplete: () => {
                                            if (i === damages.length - 1) {
                                                // Clean up action sprite, walk back with idle sprite
                                                if (actionSprite) actionSprite.destroy();
                                                attacker.setVisible(true);
                                                if (!isPlayer) attacker.play('droid-idle');
                                                this.tweens.add({
                                                    targets: attacker,
                                                    x: startX,
                                                    duration: 400, ease: 'Power2',
                                                    onComplete: () => onDone()
                                                });
                                            }
                                        }
                                    });
                                });
                            }
                        });
                    });
                    delay += hitInterval;
                });
            }
        });
    }

    execSlamAttack(damage: number, onDone: () => void) {
        const enemyBaseX = (this.enemySprite as any).baseX;

        // Enemy vanishes
        this.enemySprite.setAlpha(0);

        // Spawn slam overlay above the player
        const slam = this.add.sprite(this.playerSprite.x, this.playerSprite.y - 100, 'droid_slam')
            .setOrigin(0.5, 1).setScale(6).setFlipX(true).setDepth(500);
        slam.play('droid-slam');

        // Hit lands mid-animation
        this.time.delayedCall(400, () => {
            this.playSfx('sfx_slam', 0.8);
            this.cameras.main.shake(250, 0.03);
            this.animateHit(this.playerSprite, damage);
            this.spawnHitFx(this.playerSprite.x, this.playerSprite.y - 80);
        });

        slam.once('animationcomplete', () => {
            slam.destroy();
            // Enemy reappears at base position
            this.enemySprite.setAlpha(1);
            this.enemySprite.play('droid-idle');
            onDone();
        });
    }

    animateHit(target: Phaser.GameObjects.Sprite, damage: number) {
        this.cameras.main.shake(120, 0.012);
        this.playRandomSfx(['sfx_hit_heavy', 'sfx_hit_heavy2'], 0.6);
        target.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
        this.time.delayedCall(50, () => target.setTint(0xff4444).setTintMode(Phaser.TintModes.MULTIPLY));
        this.time.delayedCall(150, () => {
            target.clearTint();
            if (target === this.enemySprite) {
                target.play('droid-hit');
                target.once('animationcomplete', () => target.play('droid-idle'));
            }
        });

        const baseX = (target as any).baseX;
        target.x = baseX + (target === this.playerSprite ? -20 : 20);
        this.tweens.add({ targets: target, x: baseX, duration: 200, ease: 'Bounce.easeOut' });

        const fText = this.add.text(
            target.x + Phaser.Math.Between(-20, 20), target.y - 120,
            `-${damage}`,
            { fontSize: '55px', color: '#ff7675', fontStyle: 'bold', stroke: '#000', strokeThickness: 8 }
        ).setOrigin(0.5).setDepth(300);
        this.tweens.add({
            targets: fText,
            y: target.y - 250, alpha: 0,
            scale: { from: 0.5, to: 1.3 },
            duration: 800, ease: 'Cubic.easeOut',
            onComplete: () => fText.destroy()
        });

        this.spawnParticles(target.x, target.y - 50, 0xff4444, 15);
    }

    animateBuff(target: Phaser.GameObjects.Sprite, text: string, onComplete: () => void) {
        this.playRandomSfx(['sfx_block', 'sfx_block2'], 0.4);
        target.setTint(0x74b9ff);
        this.time.delayedCall(150, () => target.clearTint());

        const fText = this.add.text(target.x, target.y - 150, text, {
            fontSize: '36px', color: '#74b9ff', fontStyle: 'bold', stroke: '#000', strokeThickness: 8
        }).setOrigin(0.5).setDepth(300);
        this.tweens.add({
            targets: fText,
            y: target.y - 250, alpha: 0,
            duration: 800, ease: 'PowerOut',
            onComplete: () => { fText.destroy(); onComplete(); }
        });

        this.spawnParticles(target.x, target.y - 50, 0x74b9ff, 15);
    }

    spawnParticles(x: number, y: number, color: number, qty: number) {
        const emitter = this.add.particles(x, y, 'flare', {
            speed: { min: 80, max: 400 },
            scale: { start: 0.5, end: 0 },
            alpha: { start: 1, end: 0 },
            tint: color,
            lifespan: 600,
            blendMode: 'ADD',
            emitting: false
        }).setDepth(1500);
        emitter.explode(qty);
        this.time.delayedCall(800, () => emitter.destroy());
    }

    showFloatingMessage(msg: string) {
        const text = this.add.text(640, 400, msg, {
            fontSize: '32px', color: '#fdcb6e', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 6
        }).setOrigin(0.5).setDepth(500);
        this.tweens.add({
            targets: text,
            y: 340, alpha: 0,
            duration: 1000, ease: 'Power2',
            onComplete: () => text.destroy()
        });
    }

    showBanner(txt: string, color: string) {
        const bg = this.add.rectangle(640, 360, 1280, 140, 0x000000, 0.8).setDepth(2000).setScale(1, 0);
        const t = this.add.text(640, 360, txt, {
            fontSize: '80px', color: color, fontStyle: 'bold italic',
            stroke: '#000', strokeThickness: 10
        }).setOrigin(0.5).setDepth(2001).setAlpha(0).setScale(0.5);

        this.tweens.add({ targets: bg, scaleY: 1, duration: 200, ease: 'Power2' });
        this.tweens.add({
            targets: t, alpha: 1, scale: 1,
            duration: 300, ease: 'Back.easeOut',
            onComplete: () => {
                this.time.delayedCall(700, () => {
                    this.tweens.add({
                        targets: [bg, t], alpha: 0, duration: 200,
                        onComplete: () => { bg.destroy(); t.destroy(); }
                    });
                });
            }
        });
    }
}
