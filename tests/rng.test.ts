// ABOUTME: Tests for the seeded Mulberry32 PRNG.
// ABOUTME: Verifies determinism, range, and distribution.
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/map/rng';

describe('createRng', () => {
  it('produces deterministic sequences for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a()).not.toBe(b());
  });

  it('returns floats in [0, 1)', () => {
    const r = createRng(123);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('has reasonable distribution across 0..1', () => {
    const r = createRng(7);
    const buckets: number[] = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) {
      const idx = Math.floor(r() * 4);
      const bucket = buckets[idx];
      if (bucket !== undefined) {
        buckets[idx] = bucket + 1;
      }
    }
    for (const b of buckets) {
      expect(b).toBeGreaterThan(800);
      expect(b).toBeLessThan(1200);
    }
  });
});
