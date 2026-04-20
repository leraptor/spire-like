// ABOUTME: Smoke test verifying the Vitest harness works.
// ABOUTME: Asserts 2 + 2 === 4 to prove the pipeline runs.
import { describe, it, expect } from 'vitest';

describe('vitest harness', () => {
  it('runs basic assertions', () => {
    expect(2 + 2).toBe(4);
  });
});
