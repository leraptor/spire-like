// ABOUTME: Enemy roster for combat encounters. Data-driven via behaviorId + sprite config.
// ABOUTME: CombatState dispatches AI through BEHAVIORS; CombatScene builds sprites from sprite fields.

export interface EnemySpriteConfig {
  textureKey: string;
  idleAnimKey: string;
  attackAnimKeys: string[];
  scale: number;
  yOffset?: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  tier: 'normal' | 'elite' | 'boss';
  behaviorId: string;
  sprite: EnemySpriteConfig;
}

const DROID_SPRITE: EnemySpriteConfig = {
  textureKey: 'droid_idle',
  idleAnimKey: 'droid-idle',
  attackAnimKeys: ['droid-attack1'],
  scale: 6,
};

export const ENEMIES: readonly EnemyDef[] = [
  { id: 'thorn-creep',       name: 'Thorn Creep',         hp: 30,  tier: 'normal', behaviorId: 'simple_attack',      sprite: DROID_SPRITE },
  { id: 'fog-wisp',          name: 'Fog Wisp',            hp: 25,  tier: 'normal', behaviorId: 'simple_attack',      sprite: DROID_SPRITE },
  { id: 'rot-golem',         name: 'Rot Golem',           hp: 80,  tier: 'elite',  behaviorId: 'heavy_slow',         sprite: DROID_SPRITE },
  { id: 'hollow-gardener',   name: 'The Hollow Gardener', hp: 140, tier: 'boss',   behaviorId: 'boss_phases',        sprite: DROID_SPRITE },
  {
    id: 'cyber-knight',
    name: 'Cyber Knight',
    hp: 90,
    tier: 'elite',
    behaviorId: 'cyber_knight_charge',
    sprite: {
      textureKey: 'cyber_knight_idle',
      idleAnimKey: 'cyber-knight-idle',
      attackAnimKeys: ['cyber-knight-attack-windup', 'cyber-knight-attack-strike'],
      scale: 1.4,
      yOffset: -20,
    },
  },
] as const;

export function getEnemyById(id: string): EnemyDef | undefined {
  return ENEMIES.find(e => e.id === id);
}
