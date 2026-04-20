// ABOUTME: Pre-canned RunState fixtures for each RunPhase, used by the QA debug panel.
// ABOUTME: Each buildFixture(phase) returns a fully-formed RunState suitable for testing that screen.
import type { RunState, RunPhase } from '../models/RunState';
import { buildFreshRun } from '../run/buildFreshRun';
import { witheredGardenBlueprint } from '../map/blueprints';
import { POTIONS } from '../content/potions';
import { RELICS } from '../content/relics';
import { spawn } from '../content/cards';

export function buildFixture(phase: RunPhase): RunState {
  const base = buildFreshRun({ seed: 42, epoch: 1, blueprint: witheredGardenBlueprint });
  base.phase = phase;

  switch (phase) {
    case 'BLESSING':
    case 'MAP':
      return base;
    case 'COMBAT':
      base.currentNodeId = 'f1-l0';
      return base;
    case 'REWARD':
      base.gold = 40;
      base.playerHp = 55;
      return base;
    case 'CHEST':
      base.gold = 30;
      return base;
    case 'MERCHANT':
      base.gold = 300;
      return base;
    case 'EVENT':
      base.gold = 50;
      return base;
    case 'REST':
      base.playerHp = 40;
      return base;
    case 'BOSS_VICTORY':
      base.visitedNodeIds = base.map.startNodeIds.slice();
      return base;
    case 'DEATH':
      base.playerHp = 0;
      return base;
    case 'EPOCH_UNLOCK':
      base.enemiesDefeated = 2;
      return base;
  }
}

export function fixtureWithStarterGear(): RunState {
  const s = buildFreshRun({ seed: 7, epoch: 1, blueprint: witheredGardenBlueprint });
  s.gold = 200;
  s.relics.push(RELICS[0]!);
  s.potions[0] = POTIONS[0]!;
  s.potions[1] = POTIONS[1]!;
  s.deck.push(spawn('Shockwave'));
  return s;
}
