// ABOUTME: Constructs a fresh RunState for a new run or a new epoch within a session.
// ABOUTME: Only place where initial deck + HP + potion slots are decided.
import type { RunState } from '../models/RunState';
import type { RegionBlueprint } from '../models/RegionBlueprint';
import type { Card } from '../models/Card';
import { generateRegionMap } from '../map/generator';
import { getEpoch } from '../content/epochs';
import { spawn } from '../content/cards';

export interface BuildFreshRunArgs {
  seed: number;
  epoch: number;
  blueprint: RegionBlueprint;
}

function startingDeck(): Card[] {
  const deck: Card[] = [];
  for (let i = 0; i < 5; i++) deck.push(spawn('Strike'));
  for (let i = 0; i < 4; i++) deck.push(spawn('Defend'));
  deck.push(spawn('Flow'));
  return deck;
}

export function buildFreshRun(args: BuildFreshRunArgs): RunState {
  const epochDef = getEpoch(args.epoch);
  const map = generateRegionMap(args.blueprint, args.seed);
  const potions: (null)[] = [];
  for (let i = 0; i < epochDef.potionSlots; i++) potions.push(null);

  return {
    regionId: args.blueprint.regionId,
    runId: `run-${args.seed}-${args.epoch}-${Date.now()}`,
    currentEpoch: args.epoch,
    map,
    currentNodeId: null,
    visitedNodeIds: [],
    playerHp: 75,
    playerMaxHp: 75,
    gold: 0,
    baseEnergy: 3,
    bonusCardsPerTurn: 0,
    deck: startingDeck(),
    upgradedCardIds: new Set(),
    relics: [],
    potions,
    potionSlots: epochDef.potionSlots,
    phase: 'BLESSING',
    enemiesDefeated: 0,
  };
}
