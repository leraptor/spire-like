// ABOUTME: Region blueprints describing generation rules for each region of the tower.
// ABOUTME: V1 contains only Withered Garden (Region 1); more regions slot in as new exports.
import type { RegionBlueprint } from '../models/RegionBlueprint';

export const witheredGardenBlueprint: RegionBlueprint = {
  regionId: 'withered-garden',
  floorRules: [
    {
      floor: 1,
      lanes: [0, 2],
      allowedTypes: ['combat'],
      required: [{ types: ['combat'], exact: 2 }],
    },
    {
      floor: 2,
      lanes: [0, 1, 2],
      allowedTypes: ['combat', 'event'],
      required: [
        { types: ['combat'], min: 1 },
        { types: ['event'], min: 1 },
      ],
    },
    {
      floor: 3,
      lanes: [0, 1, 2],
      allowedTypes: ['shop', 'rest', 'combat', 'event', 'chest'],
      required: [{ types: ['shop', 'rest'], min: 1 }],
    },
    {
      floor: 4,
      lanes: [0, 1, 2],
      allowedTypes: ['elite', 'combat', 'event'],
      required: [{ types: ['elite'], exact: 1 }],
    },
    {
      floor: 5,
      lanes: [1],
      allowedTypes: ['boss'],
      required: [{ types: ['boss'], exact: 1 }],
    },
  ],
  enemyPools: {
    normal: ['thorn-creep', 'fog-wisp'],
    elite: ['rot-golem'],
    boss: 'hollow-gardener',
  },
};
