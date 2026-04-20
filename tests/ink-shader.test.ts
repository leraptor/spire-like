import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const shader = readFileSync(join(process.cwd(), 'public/assets/map/ink.glsl'), 'utf8');

describe('map ink shader', () => {
  it('keeps attribution for the upstream material ink shader', () => {
    expect(shader).toContain('Matt DesLauriers');
    expect(shader).toContain('github.com/mattdesl/material/lib/shader/ink.glsl');
  });

  it('ports the upstream graffiti-spray ink layer stack', () => {
    const layers = [...shader.matchAll(/absorb\(sdf,\s*tex,\s*([0-9.]+),\s*([0-9.]+)\)\s*\*\s*([0-9.]+)/g)]
      .map((match) => ({
        scale: match[1],
        falloff: match[2],
        weight: match[3],
      }));

    expect(layers).toEqual([
      { scale: '600.0', falloff: '0.1', weight: '0.2' },
      { scale: '300.0', falloff: '0.1', weight: '0.2' },
      { scale: '20.0', falloff: '0.05', weight: '0.2' },
      { scale: '400.0', falloff: '0.05', weight: '0.2' },
      { scale: '100.0', falloff: '0.2', weight: '0.2' },
    ]);
  });
});
