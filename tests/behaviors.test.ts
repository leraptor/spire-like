// ABOUTME: Tests each enemy behavior function in isolation via the BEHAVIORS registry.
// ABOUTME: Verifies dispatch, parity with the previous inline AI, and cyber_knight_charge alternation.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CombatEntity } from '../src/models/CombatEntity';
import { BEHAVIORS } from '../src/content/behaviors';

function ctx(overrides: Partial<{
  enemy: CombatEntity; player: CombatEntity; turnCount: number;
}> = {}) {
  return {
    enemy: overrides.enemy ?? new CombatEntity(false, 80),
    player: overrides.player ?? new CombatEntity(true, 75, 3),
    turnCount: overrides.turnCount ?? 1,
  };
}

describe('BEHAVIORS registry', () => {
  it('has all four behaviors registered by id', () => {
    expect(BEHAVIORS.simple_attack).toBeTypeOf('function');
    expect(BEHAVIORS.heavy_slow).toBeTypeOf('function');
    expect(BEHAVIORS.boss_phases).toBeTypeOf('function');
    expect(BEHAVIORS.cyber_knight_charge).toBeTypeOf('function');
  });
});

describe('boss_phases behavior', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns a slam Attack every 3rd turn', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const action = BEHAVIORS.boss_phases!(ctx({ turnCount: 3 }));
    expect(action.type).toBe('Attack');
    expect(action.slam).toBe(true);
  });

  it('finishes off a low-HP player', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const player = new CombatEntity(true, 75, 3);
    player.hp = 10;
    const action = BEHAVIORS.boss_phases!(ctx({ player, turnCount: 1 }));
    expect(action.type).toBe('Attack');
    expect(action.slam).toBeFalsy();
    expect(action.damage).toBeGreaterThanOrEqual(10);
  });

  it('emits Defend when enemy is hurt and unblocked (random path)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const enemy = new CombatEntity(false, 80);
    enemy.hp = 20;
    const action = BEHAVIORS.boss_phases!(ctx({ enemy, turnCount: 1 }));
    expect(action.type).toBe('Defend');
  });
});

describe('simple_attack behavior', () => {
  afterEach(() => vi.restoreAllMocks());

  it('always returns an Attack between 8 and 12 damage', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(BEHAVIORS.simple_attack!(ctx())).toEqual({ type: 'Attack', damage: 8 });

    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    expect(BEHAVIORS.simple_attack!(ctx())).toEqual({ type: 'Attack', damage: 12 });
  });
});

describe('heavy_slow behavior', () => {
  it('attacks on odd turns', () => {
    const action = BEHAVIORS.heavy_slow!(ctx({ turnCount: 1 }));
    expect(action.type).toBe('Attack');
    expect(action.damage).toBeGreaterThanOrEqual(18);
    expect(action.damage).toBeLessThanOrEqual(22);
  });

  it('defends on even turns', () => {
    const action = BEHAVIORS.heavy_slow!(ctx({ turnCount: 2 }));
    expect(action).toEqual({ type: 'Defend', damage: 0 });
  });
});

describe('cyber_knight_charge behavior', () => {
  it('returns Charge on odd turns with strengthGain 3', () => {
    const action = BEHAVIORS.cyber_knight_charge!(ctx({ turnCount: 1 }));
    expect(action).toEqual({ type: 'Charge', damage: 0, strengthGain: 3 });

    const laterAction = BEHAVIORS.cyber_knight_charge!(ctx({ turnCount: 5 }));
    expect(laterAction).toEqual({ type: 'Charge', damage: 0, strengthGain: 3 });
  });

  it('returns Strike (base 30 Attack) on even turns', () => {
    const action = BEHAVIORS.cyber_knight_charge!(ctx({ turnCount: 2 }));
    expect(action).toEqual({ type: 'Attack', damage: 30 });

    const laterAction = BEHAVIORS.cyber_knight_charge!(ctx({ turnCount: 8 }));
    expect(laterAction).toEqual({ type: 'Attack', damage: 30 });
  });
});
