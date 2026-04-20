// ABOUTME: Phaser 4 shader helper for the animated god-ray layer used in combat.
// ABOUTME: Keeps the shader key/path and uniform contract testable outside Phaser runtime.

import type * as Phaser from 'phaser';

export const GOD_RAYS_SHADER_KEY = 'god_rays_shader';
export const GOD_RAYS_SHADER_PATH = 'assets/fx/god-rays.glsl';

export interface GodRaysUniforms {
  uTime: number;
  uAngle: number;
  uPosition: number;
  uSpread: number;
  uCutoff: number;
  uFalloff: number;
  uEdgeFade: number;
  uSpeed: number;
  uRay1Density: number;
  uRay2Density: number;
  uRay2Intensity: number;
  uSeed: number;
  uColor: [number, number, number];
  uAlpha: number;
}

export function getGodRaysUniforms(elapsedMs: number): GodRaysUniforms {
  return {
    uTime: elapsedMs / 1000,
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
  };
}

export function createCombatGodRays(scene: Phaser.Scene): Phaser.GameObjects.Shader {
  const startedAt = scene.time.now;

  const shader = scene.add.shader({
    name: 'CombatGodRays',
    shaderName: 'CombatGodRays',
    fragmentKey: GOD_RAYS_SHADER_KEY,
    setupUniforms: (setUniform: (name: string, value: unknown) => void) => {
      const uniforms = getGodRaysUniforms(scene.time.now - startedAt);

      for (const [name, value] of Object.entries(uniforms)) {
        setUniform(name, value);
      }
    },
  }, 640, 320, 1280, 640);

  shader.setName('combat-god-rays');
  shader.setBlendMode('ADD');

  return shader;
}
