import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GOD_RAYS_SHADER_KEY,
  GOD_RAYS_SHADER_PATH,
  getGodRaysUniforms,
} from '../src/fx/godRays';

const root = process.cwd();

describe('combat god rays', () => {
  it('exposes the Phaser 4 shader asset key and path', () => {
    expect(GOD_RAYS_SHADER_KEY).toBe('god_rays_shader');
    expect(GOD_RAYS_SHADER_PATH).toBe('assets/fx/god-rays.glsl');
  });

  it('maps elapsed time into the shader uniform contract', () => {
    expect(getGodRaysUniforms(2500)).toEqual({
      uTime: 2.5,
      uAngle: -0.22,
      uPosition: -0.08,
      uSpread: 0.58,
      uCutoff: 0.08,
      uFalloff: 0.32,
      uEdgeFade: 0.2,
      uSpeed: 0.85,
      uRay1Density: 7.0,
      uRay2Density: 26.0,
      uRay2Intensity: 0.28,
      uSeed: 11.0,
      uColor: [1.0, 0.88, 0.52],
      uAlpha: 0.34,
    });
  });

  it('preloads the shader and mounts it in CombatScene', () => {
    const boot = readFileSync(join(root, 'src/scenes/BootScene.ts'), 'utf8');
    const combat = readFileSync(join(root, 'src/scenes/CombatScene.ts'), 'utf8');

    expect(existsSync(join(root, 'public', GOD_RAYS_SHADER_PATH))).toBe(true);
    expect(boot).toContain(`this.load.glsl(GOD_RAYS_SHADER_KEY, GOD_RAYS_SHADER_PATH)`);
    expect(combat).toContain(`createCombatGodRays(this)`);
  });
});
