// ABOUTME: Shared enter/exit helpers for body scenes (Merchant/Chest/Event/etc.). Consistent fade transitions + outcome application.
// ABOUTME: Keeps each body scene's entry and exit path a single call so the lifecycle stays consistent.
import type Phaser from 'phaser';
import type { RunState, RunPhase } from '../models/RunState';
import type { RunOutcome } from '../models/RunOutcome';
import { applyOutcomes } from '../run/applyOutcomes';
import { setPhase } from '../run/transitions';

const FADE_IN_MS = 280;
const FADE_OUT_MS = 220;
// Parchment-toned fade so transitions blend with the body scenes' backdrops.
const FADE_COLOR: [number, number, number] = [26, 15, 8];

/**
 * Call at the start of a body scene's create() to fade in from the transition color.
 * Applying this consistently in every body scene gives the game a unified feel across cuts.
 */
export function enterBodyScene(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(FADE_IN_MS, FADE_COLOR[0], FADE_COLOR[1], FADE_COLOR[2]);
}

export function exitBodyScene(
  scene: Phaser.Scene,
  runState: RunState,
  outcomes: RunOutcome[],
  nextPhase: RunPhase,
): void {
  scene.cameras.main.fadeOut(FADE_OUT_MS, FADE_COLOR[0], FADE_COLOR[1], FADE_COLOR[2]);
  scene.cameras.main.once('camerafadeoutcomplete', () => {
    finalizeExit(scene, runState, outcomes, nextPhase);
  });
}

function finalizeExit(
  scene: Phaser.Scene,
  runState: RunState,
  outcomes: RunOutcome[],
  nextPhase: RunPhase,
): void {
  const hasCombat = outcomes.some(o => o.kind === 'enter_combat');
  if (!hasCombat) setPhase(runState, nextPhase);
  applyOutcomes(runState, outcomes);

  if (hasCombat) {
    const combat = outcomes.find(o => o.kind === 'enter_combat') as {
      kind: 'enter_combat'; enemyId: string; returnPhase: string;
    };
    scene.scene.stop();
    scene.scene.start('CombatScene', { runState, enemyId: combat.enemyId, nodeType: 'combat' });
    return;
  }

  scene.scene.stop();
}
