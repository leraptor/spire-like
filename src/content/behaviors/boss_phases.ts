// ABOUTME: Hollow Gardener AI. Every 3rd turn slam; reacts to player HP, vulnerable, block.
// ABOUTME: Verbatim port of the previous inline CombatState.generateNextEnemyAction body.

import type { BehaviorFn } from './index';

export const bossPhases: BehaviorFn = ({ enemy, player, turnCount }) => {
  const hpPct = enemy.hp / enemy.maxHp;
  const playerLow = player.hp < player.maxHp * 0.35;
  const playerVulnerable = player.vulnerable > 0;
  const enemyHurt = hpPct < 0.5;
  const playerBlocked = player.block >= 10;

  if (turnCount % 3 === 0) {
    return { type: 'Attack', damage: Math.floor(Math.random() * 4) + 14, slam: true };
  }

  if (playerLow) {
    return { type: 'Attack', damage: Math.floor(Math.random() * 6) + 10 };
  }

  if (playerVulnerable) {
    return { type: 'Attack', damage: Math.floor(Math.random() * 4) + 12 };
  }

  if (playerBlocked && Math.random() < 0.6) {
    return { type: 'Debuff', damage: 0 };
  }

  if (enemyHurt && enemy.block < 10 && Math.random() < 0.5) {
    return { type: 'Defend', damage: 0 };
  }

  const r = Math.random();
  if (r < 0.6) {
    return { type: 'Attack', damage: Math.floor(Math.random() * 6) + 10 };
  } else if (r < 0.8) {
    return { type: 'Debuff', damage: 0 };
  }
  return { type: 'Defend', damage: 0 };
};
