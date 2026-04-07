// ============================================================
// src/models/Card.ts
// ============================================================

export enum CardType {
    ATTACK = 'Attack',
    SKILL = 'Skill',
    POWER = 'Power'
}

export enum TargetType {
    SINGLE_ENEMY = 'SingleEnemy',
    ALL_ENEMIES = 'AllEnemies',
    SELF = 'Self'
}

export interface CardEffect {
    damage?: number;
    block?: number;
}

export interface Card {
    id: string;
    title: string;
    cost: number;
    type: CardType;
    target: TargetType;
    description: string;
    effect: CardEffect;
}

export const STARTER_CARDS: Record<string, Card> = {
    strike: {
        id: 'strike',
        title: 'Strike',
        cost: 1,
        type: CardType.ATTACK,
        target: TargetType.SINGLE_ENEMY,
        description: 'Deal 6 damage.',
        effect: { damage: 6 }
    },
    defend: {
        id: 'defend',
        title: 'Defend',
        cost: 1,
        type: CardType.SKILL,
        target: TargetType.SELF,
        description: 'Gain 5 Block.',
        effect: { block: 5 }
    },
    ripAndTear: {
        id: 'ripAndTear',
        title: 'Mega',
        cost: 1,
        type: CardType.ATTACK,
        target: TargetType.SINGLE_ENEMY,
        description: 'Deal 7 damage. (Simplified)',
        effect: { damage: 7 }
    }
};

// ============================================================
// src/models/CombatEntity.ts
// ============================================================

export class CombatEntity {
    isPlayer: boolean;
    hp: number;
    maxHp: number;
    block: number;
    energy: number;
    maxEnergy: number;

    constructor(isPlayer: boolean, maxHp: number, maxEnergy: number = 0) {
        this.isPlayer = isPlayer;
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.block = 0;
        this.maxEnergy = maxEnergy;
        this.energy = maxEnergy;
    }

    takeDamage(amount: number): number {
        if (this.block > 0) {
            if (amount <= this.block) {
                this.block -= amount;
                return 0;
            } else {
                amount -= this.block;
                this.block = 0;
            }
        }
        this.hp = Math.max(0, this.hp - amount);
        return amount;
    }

    addBlock(amount: number) {
        this.block += amount;
    }

    resetBlock() {
        this.block = 0;
    }

    startTurn() {
        this.resetBlock();
        if (this.isPlayer) {
            this.energy = this.maxEnergy;
        }
    }
}

// ============================================================
// src/models/Deck.ts
// ============================================================

export class Deck {
    drawPile: Card[];
    hand: Card[];
    discardPile: Card[];
    exhaustPile: Card[];

    constructor(initialDeck: Card[]) {
        this.drawPile = [...initialDeck];
        this.hand = [];
        this.discardPile = [];
        this.exhaustPile = [];
        this.shuffleDrawPile();
    }

    shuffleDrawPile() {
        for (let i = this.drawPile.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = this.drawPile[i] as Card;
            this.drawPile[i] = this.drawPile[j] as Card;
            this.drawPile[j] = temp;
        }
    }

    draw(amount: number): Card[] {
        const drawnCards: Card[] = [];
        for (let i = 0; i < amount; i++) {
            if (this.drawPile.length === 0) {
                if (this.discardPile.length === 0) {
                    break;
                }
                this.drawPile = [...this.discardPile];
                this.discardPile = [];
                this.shuffleDrawPile();
            }
            const card = this.drawPile.pop();
            if (card) {
                this.hand.push(card);
                drawnCards.push(card);
            }
        }
        return drawnCards;
    }

    discard(cardId: string) {
        const index = this.hand.findIndex((c: Card) => c.id === cardId);
        if (index !== -1) {
            const [card] = this.hand.splice(index, 1);
            if (card) this.discardPile.push(card);
        }
    }

    discardHand() {
        while (this.hand.length > 0) {
            const card = this.hand.pop();
            if (card) this.discardPile.push(card);
        }
    }
}

// ============================================================
// src/models/CombatState.ts
// ============================================================

export enum TurnPhase {
    PLAYER_START = 'PlayerStart',
    PLAYER_ACTION = 'PlayerAction',
    ENEMY_START = 'EnemyStart',
    ENEMY_ACTION = 'EnemyAction',
    GAME_OVER = 'GameOver'
}

export class CombatState {
    player: CombatEntity;
    enemy: CombatEntity;
    deck: Deck;
    currentPhase: TurnPhase;

    enemyIntentDamage: number = 10;
    enemyIntentType: 'Attack' | 'Defend' = 'Attack';

    onStateChanged: () => void = () => {};
    onCardPlayed: (card: Card, target?: CombatEntity) => void = () => {};

    constructor() {
        this.player = new CombatEntity(true, 75, 3);
        this.enemy = new CombatEntity(false, 72);

        const initialCards = [
            {...STARTER_CARDS.strike, id: 's1'},
            {...STARTER_CARDS.strike, id: 's2'},
            {...STARTER_CARDS.strike, id: 's3'},
            {...STARTER_CARDS.defend, id: 'd1'},
            {...STARTER_CARDS.defend, id: 'd2'},
            {...STARTER_CARDS.ripAndTear, id: 'r1'},
        ];

        this.deck = new Deck(initialCards as Card[]);
        this.currentPhase = TurnPhase.PLAYER_START;
    }

    startCombat() {
        this.startPlayerTurn();
    }

    startPlayerTurn() {
        this.currentPhase = TurnPhase.PLAYER_START;
        this.player.startTurn();
        this.deck.draw(5);
        this.currentPhase = TurnPhase.PLAYER_ACTION;
        this.onStateChanged();
    }

    playCard(cardId: string, target?: CombatEntity): boolean {
        if (this.currentPhase !== TurnPhase.PLAYER_ACTION) return false;

        const cardIndex = this.deck.hand.findIndex((c: Card) => c.id === cardId);
        if (cardIndex === -1) return false;

        const card = this.deck.hand[cardIndex];
        if (!card) return false;

        if (this.player.energy < card.cost) return false;

        this.player.energy -= card.cost;

        if (card.effect.block) {
            this.player.addBlock(card.effect.block);
        }

        if (card.effect.damage && target) {
            target.takeDamage(card.effect.damage);
        }

        this.deck.discard(card.id);

        this.onCardPlayed(card, target);

        this.checkGameOver();
        this.onStateChanged();
        return true;
    }

    endPlayerTurn() {
        if (this.currentPhase !== TurnPhase.PLAYER_ACTION) return;

        this.deck.discardHand();
        this.startEnemyTurn();
    }

    startEnemyTurn() {
        this.currentPhase = TurnPhase.ENEMY_START;
        this.enemy.startTurn();
        this.onStateChanged();
    }

    executeEnemyAction() {
        this.currentPhase = TurnPhase.ENEMY_ACTION;
        const type = this.enemyIntentType;
        const damage = this.enemyIntentDamage;

        if (type === 'Attack') {
            this.player.takeDamage(damage);
        } else {
            this.enemy.addBlock(10);
        }

        this.enemyIntentType = Math.random() > 0.3 ? 'Attack' : 'Defend';
        if (this.enemyIntentType === 'Attack') {
            this.enemyIntentDamage = Math.floor(Math.random() * 8) + 6;
        }

        this.checkGameOver();
        this.onStateChanged();

        return { type, damage };
    }

    checkGameOver() {
        if (this.enemy.hp <= 0 || this.player.hp <= 0) {
            this.currentPhase = TurnPhase.GAME_OVER;
        }
    }
}

// ============================================================
// src/main.ts
// ============================================================

import Phaser from 'phaser';

class CardView extends Phaser.GameObjects.Container {
    cardData: Card;
    scene: CombatScene;
    bgGraphic: Phaser.GameObjects.Graphics;

    constructor(scene: CombatScene, x: number, y: number, card: Card) {
        super(scene, x, y);
        this.scene = scene;
        this.cardData = card;

        // Card Background
        this.bgGraphic = scene.add.graphics();
        const color = card.type === CardType.ATTACK ? 0xaa4444 : (card.type === CardType.SKILL ? 0x44aa44 : 0x4444aa);

        this.bgGraphic.fillStyle(0x2d3436, 1);
        this.bgGraphic.fillRoundedRect(-80, -120, 160, 240, 12);

        // Inner Art box
        this.bgGraphic.fillStyle(0x000000, 0.4);
        this.bgGraphic.fillRect(-70, -70, 140, 100);

        this.bgGraphic.lineStyle(6, color, 1);
        this.bgGraphic.strokeRoundedRect(-80, -120, 160, 240, 12);
        this.add(this.bgGraphic);

        // Add Card Art Image
        const baseId = card.title === 'Strike' ? 'strike' : (card.title === 'Defend' ? 'defend' : 'ripAndTear');
        const art = scene.add.image(0, -20, 'card_' + baseId).setDisplaySize(130, 90);
        this.add(art);

        // Cost Badge
        const costBg = scene.add.circle(-65, -105, 20, 0x0984e3);
        costBg.setStrokeStyle(3, 0x74b9ff);
        this.add(costBg);
        const costText = scene.add.text(-65, -105, card.cost.toString(), { fontSize: '24px', fontStyle: 'bold', color: '#fff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
        this.add(costText);

        // Title
        const titleBg = scene.add.graphics();
        titleBg.fillStyle(0x000000, 0.6);
        titleBg.fillRect(-70, -110, 140, 30);
        this.add(titleBg);

        const titleText = scene.add.text(0, -95, card.title, { fontSize: '18px', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5);
        this.add(titleText);

        // Type
        const typeText = scene.add.text(0, 45, card.type, { fontSize: '14px', fontStyle: 'italic', color: '#b2bec3' }).setOrigin(0.5);
        this.add(typeText);

        // Description
        const descText = scene.add.text(0, 75, card.description, { fontSize: '16px', color: '#dfe6e9', align: 'center', wordWrap: { width: 140 } }).setOrigin(0.5);
        this.add(descText);

        // Interactivity
        this.setSize(160, 240);
        this.setInteractive({ useHandCursor: true });
        scene.input.setDraggable(this);

        this.on('pointerover', () => {
            if (!(this as any).isDragging) {
                this.scene.tweens.add({
                    targets: this,
                    scaleX: 1.4,
                    scaleY: 1.4,
                    y: (this as any).baseY - 180,
                    rotation: 0,
                    duration: 150,
                    ease: 'Power2'
                });
                this.setDepth(100);
                this.scene.handContainer.bringToTop(this);
                this.scene.handContainer.setDepth(100);
                this.scene.playerHpBar.setVisible(false);
                this.scene.playerHpText.setVisible(false);
                this.scene.playerBlockText.setVisible(false);
            }
        });

        this.on('pointerout', () => {
            if (!(this as any).isDragging && !(this as any).played) {
                this.setDepth((this as any).baseDepth);
                this.scene.handContainer.sort('depth');
                this.scene.handContainer.setDepth(0);
                this.scene.playerHpBar.setVisible(true);
                this.scene.playerHpText.setVisible(true);
                this.scene.playerBlockText.setVisible(this.scene.state.player.block > 0);
                this.scene.tweens.add({
                    targets: this,
                    scaleX: 1.0,
                    scaleY: 1.0,
                    x: (this as any).baseX,
                    y: (this as any).baseY,
                    rotation: (this as any).baseRotation,
                    duration: 150,
                    ease: 'Power2'
                });
            }
        });
    }
}

class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }

    preload() {
        this.load.image('bg', 'assets/bg.png');
        this.load.image('player', 'assets/player.png');
        this.load.image('enemy', 'assets/enemy.png');
        this.load.image('card_strike', 'assets/card_strike.png');
        this.load.image('card_defend', 'assets/card_defend.png');
        this.load.image('card_ripAndTear', 'assets/card_ripAndTear.png');
    }

    create() {
        this.scene.start('CombatScene');
    }
}

class CombatScene extends Phaser.Scene {
    state!: CombatState;
    playerSprite!: Phaser.GameObjects.Sprite;
    enemySprite!: Phaser.GameObjects.Sprite;
    handContainer!: Phaser.GameObjects.Container;

    playerHpText!: Phaser.GameObjects.Text;
    playerHpBar!: Phaser.GameObjects.Graphics;
    playerBlockText!: Phaser.GameObjects.Text;

    enemyHpText!: Phaser.GameObjects.Text;
    enemyHpBar!: Phaser.GameObjects.Graphics;
    enemyBlockText!: Phaser.GameObjects.Text;
    enemyIntentText!: Phaser.GameObjects.Text;

    energyText!: Phaser.GameObjects.Text;
    deckText!: Phaser.GameObjects.Text;
    discardText!: Phaser.GameObjects.Text;

    endTurnBtn!: Phaser.GameObjects.Container;
    endTurnText!: Phaser.GameObjects.Text;
    topBarText!: Phaser.GameObjects.Text;

    constructor() { super('CombatScene'); }

    create() {
        this.state = new CombatState();
        this.state.onStateChanged = () => this.updateUI();

        this.add.image(640, 360, 'bg').setDisplaySize(1280, 720);

        const floor = this.add.graphics();
        floor.fillStyle(0x000000, 0.4);
        floor.fillEllipse(300, 560, 120, 25);
        floor.fillEllipse(950, 520, 150, 30);

        const topBar = this.add.graphics();
        topBar.fillStyle(0x000000, 0.7);
        topBar.fillRect(0, 0, 1280, 45);
        this.topBarText = this.add.text(20, 10, '❤️ 75/75    🪙 62    🧪 Potions    🗺️ Floor 8', { fontSize: '22px', color: '#fff', fontStyle: 'bold' });
        this.add.text(1200, 10, '⚙️ 🗺️', { fontSize: '22px', color: '#fff' });

        this.playerSprite = this.add.sprite(300, 560, 'player').setOrigin(0.5, 1).setScale(0.35).setInteractive();
        this.enemySprite = this.add.sprite(950, 520, 'enemy').setOrigin(0.5, 1).setScale(0.35).setInteractive();
        this.enemySprite.setFlipX(true);

        this.physics.add.existing(this.enemySprite);
        (this.enemySprite.body as Phaser.Physics.Arcade.Body).setSize(this.enemySprite.width * 0.8, this.enemySprite.height * 0.8);

        this.handContainer = this.add.container(640, 700);

        this.createUI();

        this.input.on('dragstart', (pointer: any, gameObject: CardView) => {
            if (this.state.currentPhase !== TurnPhase.PLAYER_ACTION) {
                this.showFloatingMessage('Not your turn!');
                return;
            }
            (gameObject as any).isDragging = true;
            gameObject.setDepth(200);
            this.tweens.killTweensOf(gameObject);
            gameObject.setScale(1.3);
            gameObject.rotation = 0;
        });

        this.input.on('drag', (pointer: any, gameObject: CardView, dragX: number, dragY: number) => {
            if (this.state.currentPhase !== TurnPhase.PLAYER_ACTION) return;
            gameObject.x = dragX;
            gameObject.y = dragY;
            gameObject.rotation = 0;
        });

        this.input.on('dragend', (pointer: any, gameObject: CardView) => {
            if (this.state.currentPhase !== TurnPhase.PLAYER_ACTION) return;
            (gameObject as any).isDragging = false;

            if (this.state.player.energy < gameObject.cardData.cost) {
                this.showFloatingMessage('Not enough energy!');
                this.returnCardToHand(gameObject);
                return;
            }

            let played = false;
            if (gameObject.cardData.target === TargetType.SINGLE_ENEMY) {
                const bounds = this.enemySprite.getBounds();
                if (bounds.contains(pointer.x, pointer.y)) {
                    played = this.state.playCard(gameObject.cardData.id, this.state.enemy);
                }
            } else if (gameObject.cardData.target === TargetType.SELF) {
                if (pointer.y < 500) {
                    played = this.state.playCard(gameObject.cardData.id, this.state.player);
                }
            }

            if (played) {
                (gameObject as any).played = true;
                this.playCardAnim(gameObject);
            } else {
                this.returnCardToHand(gameObject);
            }
        });

        this.state.startCombat();
    }

    returnCardToHand(cardView: CardView) {
        cardView.setDepth((cardView as any).baseDepth);
        this.tweens.add({
            targets: cardView,
            scaleX: 1.0,
            scaleY: 1.0,
            x: (cardView as any).baseX,
            y: (cardView as any).baseY,
            rotation: (cardView as any).baseRotation,
            duration: 200,
            ease: 'Power2'
        });
    }

    createUI() {
        this.playerHpBar = this.add.graphics();
        this.playerHpText = this.add.text(300, 540, '', { fontSize: '20px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
        this.playerBlockText = this.add.text(210, 525, '', { fontSize: '26px', color: '#0984e3', fontStyle: 'bold', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);

        this.enemyHpBar = this.add.graphics();
        this.enemyHpText = this.add.text(950, 500, '', { fontSize: '20px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
        this.enemyBlockText = this.add.text(1050, 485, '', { fontSize: '26px', color: '#0984e3', fontStyle: 'bold', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
        this.enemyIntentText = this.add.text(950, 320, '', { fontSize: '42px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);

        const energyBg = this.add.graphics();
        energyBg.fillStyle(0x0984e3, 1);
        energyBg.lineStyle(6, 0x74b9ff, 1);
        energyBg.fillCircle(120, 600, 60);
        energyBg.strokeCircle(120, 600, 60);
        this.energyText = this.add.text(120, 600, '', { fontSize: '50px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);

        this.add.rectangle(80, 690, 60, 80, 0x2d3436).setStrokeStyle(3, 0x636e72);
        this.deckText = this.add.text(80, 690, '', { fontSize: '28px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

        this.add.rectangle(1200, 690, 60, 80, 0x2d3436).setStrokeStyle(3, 0x636e72);
        this.discardText = this.add.text(1200, 690, '', { fontSize: '28px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

        this.endTurnBtn = this.add.container(1150, 580);
        const btnBg = this.add.graphics();
        btnBg.fillStyle(0x6c5ce7, 1);
        btnBg.fillRoundedRect(-80, -30, 160, 60, 30);
        btnBg.lineStyle(4, 0xa29bfe, 1);
        btnBg.strokeRoundedRect(-80, -30, 160, 60, 30);

        this.endTurnText = this.add.text(0, 0, 'End Turn', { fontSize: '24px', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5);
        this.endTurnBtn.add([btnBg, this.endTurnText]);

        this.endTurnBtn.setSize(160, 60);
        this.endTurnBtn.setInteractive({ useHandCursor: true });

        this.endTurnBtn.on('pointerdown', () => {
            if (this.state.currentPhase === TurnPhase.PLAYER_ACTION) {
                this.state.endPlayerTurn();
                this.state.startEnemyTurn();

                // Orchestrate Enemy Turn Animations
                this.time.delayedCall(800, () => {
                    const action = this.state.executeEnemyAction();
                    if (action.type === 'Attack') {
                        this.animateAttack(this.enemySprite, this.playerSprite, -1, action.damage, () => {
                            this.time.delayedCall(500, () => {
                                if (this.state.currentPhase !== TurnPhase.GAME_OVER) {
                                    this.state.startPlayerTurn();
                                }
                            });
                        });
                    } else {
                        this.animateBuff(this.enemySprite, '🛡️ +10', () => {
                            this.time.delayedCall(500, () => {
                                if (this.state.currentPhase !== TurnPhase.GAME_OVER) {
                                    this.state.startPlayerTurn();
                                }
                            });
                        });
                    }
                });
            }
        });
        this.endTurnBtn.on('pointerover', () => { btnBg.clear(); btnBg.fillStyle(0xa29bfe, 1); btnBg.fillRoundedRect(-80, -30, 160, 60, 30); btnBg.lineStyle(4, 0xa29bfe, 1); btnBg.strokeRoundedRect(-80, -30, 160, 60, 30); });
        this.endTurnBtn.on('pointerout', () => { btnBg.clear(); btnBg.fillStyle(0x6c5ce7, 1); btnBg.fillRoundedRect(-80, -30, 160, 60, 30); btnBg.lineStyle(4, 0xa29bfe, 1); btnBg.strokeRoundedRect(-80, -30, 160, 60, 30); });
    }

    drawHealthBar(graphics: Phaser.GameObjects.Graphics, x: number, y: number, hp: number, maxHp: number, block: number) {
        graphics.clear();
        const width = 160;
        const height = 20;
        const startX = x - width / 2;

        graphics.fillStyle(0x2d3436, 1);
        graphics.fillRect(startX, y, width, height);

        const hpPercent = Math.max(0, hp / maxHp);
        graphics.fillStyle(0xd63031, 1);
        graphics.fillRect(startX, y, width * hpPercent, height);

        if (block > 0) {
            graphics.lineStyle(4, 0x0984e3, 1);
            graphics.strokeRect(startX, y, width, height);
        } else {
            graphics.lineStyle(2, 0x000000, 1);
            graphics.strokeRect(startX, y, width, height);
        }
    }

    updateUI() {
        this.topBarText.setText(`❤️ ${this.state.player.hp}/${this.state.player.maxHp}    🪙 62    🧪 Potions    🗺️ Floor 8`);

        this.drawHealthBar(this.playerHpBar, 300, 570, this.state.player.hp, this.state.player.maxHp, this.state.player.block);
        this.playerHpText.setText(`${this.state.player.hp}/${this.state.player.maxHp}`);
        this.playerBlockText.setText(`🛡️ ${this.state.player.block}`);
        this.playerBlockText.setVisible(this.state.player.block > 0);

        this.drawHealthBar(this.enemyHpBar, 950, 530, this.state.enemy.hp, this.state.enemy.maxHp, this.state.enemy.block);
        this.enemyHpText.setText(`${this.state.enemy.hp}/${this.state.enemy.maxHp} Terror Eel`);
        this.enemyBlockText.setText(`🛡️ ${this.state.enemy.block}`);
        this.enemyBlockText.setVisible(this.state.enemy.block > 0);

        this.energyText.setText(`${this.state.player.energy}/${this.state.player.maxEnergy}`);
        this.deckText.setText(`${this.state.deck.drawPile.length}`);
        this.discardText.setText(`${this.state.deck.discardPile.length}`);

        if (this.state.enemyIntentType === 'Attack') {
            this.enemyIntentText.setText(`⚔️ ${this.state.enemyIntentDamage}`);
            this.enemyIntentText.setColor('#ff7675');
        } else {
            this.enemyIntentText.setText(`🛡️`);
            this.enemyIntentText.setColor('#74b9ff');
        }

        if (this.state.currentPhase === TurnPhase.PLAYER_START) {
            this.renderHand(true);
        } else if (this.state.currentPhase === TurnPhase.PLAYER_ACTION || this.state.currentPhase === TurnPhase.ENEMY_ACTION || this.state.currentPhase === TurnPhase.ENEMY_START) {
            this.renderHand();
        }

        if (this.state.currentPhase === TurnPhase.GAME_OVER) {
            const msg = this.state.player.hp <= 0 ? 'DEFEAT' : 'VICTORY';
            this.add.text(640, 360, msg, { fontSize: '100px', color: '#fdcb6e', fontStyle: 'bold', stroke: '#000', strokeThickness: 12 }).setOrigin(0.5).setDepth(1000);
            this.endTurnBtn.setVisible(false);
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

        // Get current views
        const existingViews = this.handContainer.getAll() as CardView[];

        // Remove views that are no longer in hand (unless they are currently being played/animated)
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
                // New card (animate drawing from deck)
                cardView = new CardView(this, targetX, targetY, card);
                this.handContainer.add(cardView);

                cardView.x = -560;
                cardView.y = -10;
                cardView.rotation = -Math.PI / 4;
                cardView.setScale(0.1);
                cardView.setAlpha(0);

                this.tweens.add({
                    targets: cardView,
                    x: targetX,
                    y: targetY,
                    rotation: angle,
                    scaleX: 1,
                    scaleY: 1,
                    alpha: 1,
                    duration: 500,
                    delay: i * 120,
                    ease: 'Back.easeOut'
                });
            } else {
                // Existing card, just slide it to the new position if we aren't dragging it
                if (!(cardView as any).isDragging) {
                    this.tweens.add({
                        targets: cardView,
                        x: targetX,
                        y: targetY,
                        rotation: angle,
                        duration: 300,
                        ease: 'Power2'
                    });
                }
            }

            cardView.setDepth(i);

            (cardView as any).baseX = targetX;
            (cardView as any).baseY = targetY;
            (cardView as any).baseRotation = angle;
            (cardView as any).baseDepth = i;
        });
    }

    playCardAnim(cardView: CardView) {
        (cardView as any).isPlayed = true;
        this.handContainer.bringToTop(cardView);

        this.tweens.add({
            targets: cardView,
            x: 0,
            y: -300,
            scaleX: 1.5,
            scaleY: 1.5,
            rotation: 0,
            duration: 250,
            ease: 'Power2',
            onComplete: () => {
                if (cardView.cardData.type === CardType.ATTACK) {
                    this.animateAttack(this.playerSprite, this.enemySprite, 1, cardView.cardData.effect.damage || 0, () => this.finishCardDiscard(cardView));
                } else {
                    this.animateBuff(this.playerSprite, `🛡️ +${cardView.cardData.effect.block}`, () => this.finishCardDiscard(cardView));
                }
            }
        });
    }

    finishCardDiscard(cardView: CardView) {
        this.tweens.add({
            targets: cardView,
            x: 560,
            y: -10,
            scaleX: 0.1,
            scaleY: 0.1,
            alpha: 0,
            duration: 250,
            ease: 'Power2',
            onComplete: () => {
                cardView.destroy();
                this.renderHand();
            }
        });
    }

    animateAttack(attacker: Phaser.GameObjects.Sprite, defender: Phaser.GameObjects.Sprite, direction: 1 | -1, damage: number, onComplete: () => void) {
        const startX = attacker.x;
        this.tweens.add({
            targets: attacker,
            x: startX + (100 * direction),
            duration: 120,
            yoyo: true,
            ease: 'Power2',
            onYoyo: () => {
                this.animateHit(defender, damage);
            },
            onComplete: () => {
                if (onComplete) onComplete();
            }
        });
    }

    animateHit(target: Phaser.GameObjects.Sprite, damage: number) {
        target.setTint(0xff4444);
        this.time.delayedCall(150, () => target.clearTint());

        const startX = target.x;
        this.tweens.add({
            targets: target,
            x: startX - 15,
            duration: 40,
            yoyo: true,
            repeat: 3,
            onComplete: () => target.x = startX
        });

        const fText = this.add.text(target.x, target.y - 150, `-${damage}`, { fontSize: '50px', color: '#ff7675', fontStyle: 'bold', stroke: '#000', strokeThickness: 8 }).setOrigin(0.5);
        fText.setDepth(300);
        this.tweens.add({
            targets: fText,
            y: target.y - 250,
            alpha: 0,
            duration: 800,
            ease: 'PowerOut',
            onComplete: () => fText.destroy()
        });
    }

    animateBuff(target: Phaser.GameObjects.Sprite, text: string, onComplete: () => void) {
        target.setTint(0x74b9ff);
        this.time.delayedCall(150, () => target.clearTint());

        const fText = this.add.text(target.x, target.y - 150, text, { fontSize: '40px', color: '#74b9ff', fontStyle: 'bold', stroke: '#000', strokeThickness: 8 }).setOrigin(0.5);
        fText.setDepth(300);
        this.tweens.add({
            targets: fText,
            y: target.y - 250,
            alpha: 0,
            duration: 800,
            ease: 'PowerOut',
            onComplete: () => {
                fText.destroy();
                if (onComplete) onComplete();
            }
        });
    }

    showFloatingMessage(msg: string) {
        const text = this.add.text(640, 400, msg, {
            fontSize: '32px', color: '#fdcb6e', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 6
        }).setOrigin(0.5).setDepth(500);
        this.tweens.add({
            targets: text,
            y: 340,
            alpha: 0,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => text.destroy()
        });
    }
}

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    preserveDrawingBuffer: true,
    scene: [BootScene, CombatScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: { debug: false }
    }
};

const game = new Phaser.Game(config);
(window as any).game = game;
