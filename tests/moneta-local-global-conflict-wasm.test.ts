import { beforeAll, describe, expect, it } from 'vitest';
import type { DatasetJSON } from '../src/data/types.ts';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import { assertRustDatasetStructureProfile } from '../src/atlas/MonetaEvidenceAuthority.ts';
import type { ClusterProfileObservation } from '../dev/xr-lab/MonetaKnownStructureCampaign.ts';
import {
  localNeighbourRetention,
  runLocalGlobalConflictCampaign,
  scrambleWithinClusters,
} from '../dev/xr-lab/MonetaLocalGlobalConflictCampaign.ts';
import { generatePlantedThreeClusterDataset } from '../dev/xr-lab/MonetaKnownStructureCampaign.ts';

function rustProfile(dataset: DatasetJSON): ClusterProfileObservation {
  const handle = bridge.loadDatasetJson(dataset);
  if (handle <= 0) throw new Error(`failed to load campaign dataset ${dataset.name}`);
  try {
    const profile = bridge.computeDatasetStructureProfile(handle);
    if (!profile) throw new Error(`Rust structure profile unavailable for ${dataset.name}`);
    assertRustDatasetStructureProfile(profile);
    return {
      hasClusters: profile.clusters.hasClusters,
      estimatedCount: profile.clusters.estimatedCount,
      separationScore: profile.clusters.separationScore,
    };
  } finally {
    bridge.destroyDataset(handle);
  }
}

describe('Moneta local/global conflict campaign through Rust/WASM authority', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) throw new Error('real WASM runtime unavailable');
  });

  it('preserves coordinate multiset while corrupting observation-local neighbourhoods', () => {
    const points = generatePlantedThreeClusterDataset(20260911, 48, 0.55);
    const scrambled = scrambleWithinClusters(points, 12345);

    const coordinates = (values: typeof points) =>
      values
        .map((point) => `${point.label}:${point.x.toFixed(12)}:${point.y.toFixed(12)}`)
        .sort();

    expect(coordinates(scrambled)).toEqual(coordinates(points));
    expect(localNeighbourRetention(points, points, 5)).toBe(1);
    expect(localNeighbourRetention(points, scrambled, 5)).toBeLessThan(0.35);
  });

  it('demonstrates that perfect global cluster recovery can coexist with weak local fidelity', () => {
    const result = runLocalGlobalConflictCampaign(rustProfile, {
      seed: 20260911,
      pointsPerCluster: 48,
      perturbationRuns: 8,
      perturbationMagnitude: 0.1,
      neighbours: 5,
    });

    expect(result.baseProfile.hasClusters).toBe(true);
    expect(result.baseProfile.estimatedCount).toBe(3);
    expect(result.scrambledProfile.hasClusters).toBe(true);
    expect(result.scrambledProfile.estimatedCount).toBe(3);
    expect(result.plantedClusterRecoveryRate).toBe(1);
    expect(result.meanLocalNeighbourRetention).toBeLessThan(0.35);
  });
});
