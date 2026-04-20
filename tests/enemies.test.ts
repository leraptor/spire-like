// ABOUTME: Tests EnemyDef shape invariants: every enemy has a non-empty sprite config.
// ABOUTME: Also verifies the cyber-knight entry exists with the expected behavior/sprite wiring.
import { describe, it, expect } from 'vitest';
import { ENEMIES, getEnemyById } from '../src/content/enemies';

describe('ENEMIES sprite config', () => {
  it('every enemy has a populated sprite config', () => {
    for (const enemy of ENEMIES) {
      expect(enemy.sprite.textureKey, `${enemy.id} textureKey`).not.toBe('');
      expect(enemy.sprite.idleAnimKey, `${enemy.id} idleAnimKey`).not.toBe('');
      expect(enemy.sprite.attackAnimKeys.length, `${enemy.id} attackAnimKeys`).toBeGreaterThan(0);
      expect(enemy.sprite.scale, `${enemy.id} scale`).toBeGreaterThan(0);
    }
  });
});

describe('cyber-knight EnemyDef', () => {
  it('is registered with the expected stats and sprite wiring', () => {
    const def = getEnemyById('cyber-knight');
    expect(def).toBeDefined();
    expect(def!.name).toBe('Cyber Knight');
    expect(def!.hp).toBe(90);
    expect(def!.tier).toBe('elite');
    expect(def!.behaviorId).toBe('cyber_knight_charge');
    expect(def!.sprite.textureKey).toBe('cyber_knight_idle');
    expect(def!.sprite.idleAnimKey).toBe('cyber-knight-idle');
    expect(def!.sprite.attackAnimKeys).toEqual(['cyber-knight-attack-windup', 'cyber-knight-attack-strike']);
    expect(def!.sprite.scale).toBe(1.4);
  });
});
