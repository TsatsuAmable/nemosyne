import { beforeAll, describe, expect, it } from 'vitest';
import type { DatasetJSON } from '../src/data/types.ts';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import { assertRustDatasetStructureProfile } from '../src/atlas/MonetaEvidenceAuthority.ts';
import {
  generatePlantedThreeClusterDataset,
  perturbKnownStructure,
  runKnownStructureCampaign,
  type ClusterProfileObservation,
} from '../dev/xr-lab/MonetaKnownStructureCampaign.ts';

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

describe('Moneta known-structure campaign through Rust/WASM authority', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) throw new Error('real WASM runtime unavailable');
  });

  it('generates deterministic planted structure and bounded deterministic perturbations', () => {
    const a = generatePlantedThreeClusterDataset(17, 8, 0.4);
    const b = generatePlantedThreeClusterDataset(17, 8, 0.4);
    expect(a).toEqual(b);
    expect(new Set(a.map((point) => point.label))).toEqual(new Set([0, 1, 2]));

    const pa = perturbKnownStructure(a, 99, 0.1);
    const pb = perturbKnownStructure(a, 99, 0.1);
    expect(pa).toEqual(pb);
    expect(pa.map((point) => point.label)).toEqual(a.map((point) => point.label));
    expect(pa.some((point, index) => point.x !== a[index].x || point.y !== a[index].y)).toBe(true);
  });

  it('falsifies a collapsed representation while retaining planted structure under valid transforms', () => {
    const results = runKnownStructureCampaign(rustProfile, {
      seed: 20260911,
      pointsPerCluster: 48,
      perturbationRuns: 8,
      perturbationMagnitude: 0.1,
    });
    const byId = new Map(results.map((result) => [result.candidateId, result]));
    const identity = byId.get('preserve-xy')!;
    const rotated = byId.get('rotate-xy')!;
    const collapsed = byId.get('collapse')!;

    expect(identity.evidenceDecision.disposition).toBe('ELIGIBLE');
    expect(rotated.evidenceDecision.disposition).toBe('ELIGIBLE');
    expect(collapsed.evidenceDecision.disposition).toBe('ELIGIBLE');

    expect(identity.plantedClusterRecoveryRate).toBe(1);
    expect(rotated.plantedClusterRecoveryRate).toBe(1);
    expect(identity.baseProfile.estimatedCount).toBe(3);
    expect(rotated.baseProfile.estimatedCount).toBe(3);

    expect(collapsed.plantedClusterRecoveryRate).toBe(0);
    expect(collapsed.baseProfile.hasClusters).toBe(false);
    expect(collapsed.meanSeparationScore).toBeLessThan(identity.meanSeparationScore);
  });
});
