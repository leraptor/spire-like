// ABOUTME: Confirms the hand-crafted tutorial map validates against the Withered Garden blueprint.
import { describe, it, expect } from 'vitest';
import { tutorialMap } from '../src/fixtures/maps/tutorial-map';
import { validateRegionMap } from '../src/map/validator';
import { witheredGardenBlueprint } from '../src/map/blueprints';

describe('tutorialMap', () => {
  it('is a valid map for Withered Garden', () => {
    const res = validateRegionMap(tutorialMap, witheredGardenBlueprint);
    expect(res.errors).toEqual([]);
    expect(res.valid).toBe(true);
  });
});
