// ABOUTME: Represents a player or enemy in combat with HP, block, energy, and status effects.
// ABOUTME: Handles damage calculation factoring in strength, vulnerable, and weak.

export class CombatEntity {
    isPlayer: boolean;
    hp: number;
    maxHp: number;
    block: number;
    energy: number;
    maxEnergy: number;
    strength: number = 0;
    vulnerable: number = 0;
    weak: number = 0;

    constructor(isPlayer: boolean, maxHp: number, maxEnergy: number = 0) {
        this.isPlayer = isPlayer;
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.block = 0;
        this.maxEnergy = maxEnergy;
        this.energy = maxEnergy;
    }

    calculateDamage(baseDamage: number, source: CombatEntity): number {
        let dmg = baseDamage + source.strength;
        if (source.weak > 0) dmg = Math.floor(dmg * 0.75);
        if (this.vulnerable > 0) dmg = Math.floor(dmg * 1.5);
        return Math.max(0, dmg);
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

    startTurn() {
        this.block = 0;
        if (this.isPlayer) {
            this.energy = this.maxEnergy;
        }
    }

    endTurn() {
        if (this.vulnerable > 0) this.vulnerable--;
        if (this.weak > 0) this.weak--;
    }
}
