// ABOUTME: Defines card types, targeting, effects, and the starter card catalog.
// ABOUTME: Cards can deal damage (multi-hit), grant block, buff/debuff, draw cards, or exhaust.

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
    hits?: number;
    strength?: number;
    vulnerable?: number;
    weak?: number;
    draw?: number;
    selfDamage?: number;
    onTurnEndSelf?: number;
}

export interface Card {
    id: string;
    title: string;
    cost: number;
    type: CardType;
    target: TargetType;
    description: string;
    effect: CardEffect;
    exhaust?: boolean;
    ethereal?: boolean;
    unplayable?: boolean;
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
    mega: {
        id: 'mega',
        title: 'Mega',
        cost: 2,
        type: CardType.ATTACK,
        target: TargetType.SINGLE_ENEMY,
        description: 'Deal 4 damage 3 times.',
        effect: { damage: 4, hits: 3 }
    },
    empower: {
        id: 'empower',
        title: 'Empower',
        cost: 3,
        type: CardType.POWER,
        target: TargetType.SELF,
        description: 'Gain 3 Strength.',
        effect: { strength: 3 },
        exhaust: true
    },
    shockwave: {
        id: 'shockwave',
        title: 'Shockwave',
        cost: 2,
        type: CardType.SKILL,
        target: TargetType.ALL_ENEMIES,
        description: 'Apply 2 Vulnerable\n& 2 Weak.',
        effect: { vulnerable: 2, weak: 2 },
        exhaust: true
    },
    flow: {
        id: 'flow',
        title: 'Flow',
        cost: 0,
        type: CardType.SKILL,
        target: TargetType.SELF,
        description: 'Draw 2 cards.',
        effect: { draw: 2 }
    }
};
