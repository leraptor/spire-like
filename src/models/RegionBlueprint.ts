// ABOUTME: Blueprint types describing how a region's map is generated.
// ABOUTME: One blueprint per region (Withered Garden, Mist Woods, etc.).
import type { NodeType } from './RegionMap';

export interface RequiredCount {
  types: NodeType[];
  min?: number;
  max?: number;
  exact?: number;
}

export interface FloorRule {
  floor: number;
  lanes: number[];
  allowedTypes: NodeType[];
  required?: RequiredCount[];
}

export interface RegionBlueprint {
  regionId: string;
  floorRules: FloorRule[];
  enemyPools: {
    normal: string[];
    elite: string[];
    boss: string;
  };
}
