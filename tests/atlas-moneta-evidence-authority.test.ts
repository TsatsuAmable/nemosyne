import { describe, expect, it } from 'vitest';
import { AtlasCore, type WasmRuntimeBridgeFull } from '../src/atlas/AtlasCore.ts';
import { datasetEvidenceFromKernelProfile } from '../src/atlas/MonetaEvidenceAuthority.ts';
import { RepresentationState } from '../src/atlas/domain/RepresentationState.ts';
import { Dataset } from '../src/data/Dataset.ts';
import type { DatasetJSON, Facts } from '../src/data/types.ts';
import type { RustDatasetStructureProfile } from '../src/data/evidence/index.ts';

function profile(): RustDatasetStructureProfile {
  return {
    datasetName: 'authority-fixture',
    rowCount: 128,
    columnCount: 3,
    dimensionality: {
      totalColumns: 3,
      numericColumns: 2,
      categoricalColumns: 1,
      temporalColumns: 0,
      constantColumns: 0,
      redundantColumns: 0,
      effectiveDimensions: 2,
    },
    distributions: {
      numericSummaries: [],
      globalHasOutliers: true,
      globalHighVariance: true,
      maxSkewness: 1.25,
    },
    correlations: {
      pairs: [],
      maxCorrelation: 0.7,
      pairsAboveMagnitudeThreshold: 1,
      isRankDeficient: false,
    },
    clusters: {
      estimatedCount: 4,
      hasClusters: true,
      separationScore: 0.8,
      heuristicSilhouettePartitionScore: 0.72,
      method: 'full-complete-row-kmeans',
      eligibleObservationCount: 128,
      sampleCount: 128,
      samplingSeed: null,
      sourceObservationsPerSample: 1,
      normalization: 'per-dimension-min-max-over-all-complete-rows',
      maximumCandidateClusters: 3,
      iterations: 5,
      silhouetteSampleCount: 50,
    },
    density: {
      heuristicScaleDensityProxy: 0.4,
      modeCount: 4,
      heuristicSparseByRowCount: false,
    },
    temporal: null,
    graph: null,
    hierarchy: null,
    spatial: null,
    anomalies: {
      totalAnomalies: 8,
      anomalyFraction: 0.0625,
      hasAnomalies: true,
      maxAnomalyScore: 3.2,
    },
    missingness: {
      totalMissing: 0,
      missingFraction: 0,
      hasMissingness: false,
      columnMissingness: {},
    },
    categorical: {
      summaries: [],
      meanEntropy: 0.45,
      hasHighCardinality: false,
    },
    spectral: null,
    provenance: {
      kernelVersion: 'wasm-kernel-authority-test',
      datasetFingerprint: 'sha256:authority-fixture',
      timestampMs: 123,
      algorithmSuite: 'structure-profile-v1',
    },
  };
}

function emptyFacts(): Facts {
  return {
    rowCount: 128,
    columnCount: 3,
    numeric: [],
    correlation: [],
    categorical: [],
    temporal: [],
    temporalStats: [],
  };
}

function kernel(): WasmRuntimeBridgeFull {
  let loaded: DatasetJSON | null = null;
  return {
    isReady: () => true,
    capabilities: () => 0,
    loadDatasetJson: (obj) => {
      loaded = obj;
      return 7;
    },
    loadCsv: () => 0,
    loadJson: () => 0,
    loadSample: () => 0,
    sampleKeys: () => [],
    getDatasetJson: () => loaded,
    destroyDataset: () => {},
    runOperation: () => 0,
    executeOperation: () => null,
    statistics: () => emptyFacts(),
    inferTopology: () => 'TABULAR',
    inferEncodings: () => ({}),
    parseDatasetBytes: () => null,
    kernelVersion: () => 'wasm-kernel-authority-test',
    datasetFingerprint: () => 'sha256:authority-fixture',
    computeDatasetStructureProfile: () => profile(),
  };
}

/**
 * Clone the authoritative fixture into a plain mutable payload so a single
 * field can be dropped, or a retired pre-TEC2 name re-introduced, the way a
 * stale kernel build or a `#[serde(alias)]` would.
 */
function mutatedProfile(
  mutate: (raw: Record<string, unknown>) => void
): RustDatasetStructureProfile {
  const raw = JSON.parse(JSON.stringify(profile())) as Record<string, unknown>;
  mutate(raw);
  return raw as unknown as RustDatasetStructureProfile;
}

function dataset(): Dataset {
  return Dataset.fromJSON({
    name: 'authority-fixture',
    columns: [
      { name: 'x', type: 'numeric' },
      { name: 'y', type: 'numeric' },
      { name: 'group', type: 'categorical' },
    ],
    rows: Array.from({ length: 128 }, (_, index) => ({
      x: index,
      y: index * 2,
      group: index % 2 === 0 ? 'A' : 'B',
    })),
  });
}

describe('Atlas → Moneta evidence authority boundary', () => {
  it('transports a Rust structure profile into canonical DatasetEvidence without recomputation', () => {
    const evidence = datasetEvidenceFromKernelProfile(
      {
        computeDatasetStructureProfile: () => profile(),
        datasetFingerprint: () => 'sha256:authority-fixture',
      },
      7
    );

    expect(evidence.datasetFingerprint).toBe('sha256:authority-fixture');
    expect(evidence.kernelVersion).toBe('wasm-kernel-authority-test');
    expect(evidence.evidence.some((item) => item.id === 'cluster:global')).toBe(true);
  });

  it('fails closed when the profile identity disagrees with the live Rust handle', () => {
    expect(() =>
      datasetEvidenceFromKernelProfile(
        {
          computeDatasetStructureProfile: () => profile(),
          datasetFingerprint: () => 'sha256:different-live-handle',
        },
        7
      )
    ).toThrow(/fingerprint drift/i);
  });

  it('rejects invalid or unavailable Rust dataset handles', () => {
    expect(() =>
      datasetEvidenceFromKernelProfile({ computeDatasetStructureProfile: () => profile() }, 0)
    ).toThrow(/valid Rust dataset handle/i);

    expect(() =>
      datasetEvidenceFromKernelProfile({ computeDatasetStructureProfile: () => null }, 7)
    ).toThrow(/structureprofile unavailable/i);
  });

  it('fails closed when a TEC2-renamed kernel field is missing from the payload', () => {
    const missingDensity = mutatedProfile((raw) => {
      delete (raw.density as Record<string, unknown>).heuristicScaleDensityProxy;
    });
    expect(() =>
      datasetEvidenceFromKernelProfile({ computeDatasetStructureProfile: () => missingDensity }, 7)
    ).toThrow(/heuristicScaleDensityProxy/);

    const missingCluster = mutatedProfile((raw) => {
      delete (raw.clusters as Record<string, unknown>).heuristicSilhouettePartitionScore;
    });
    expect(() =>
      datasetEvidenceFromKernelProfile({ computeDatasetStructureProfile: () => missingCluster }, 7)
    ).toThrow(/heuristicSilhouettePartitionScore/);
  });

  it('rejects a payload that still carries a retired pre-TEC2 field name', () => {
    const retiredDensity = mutatedProfile((raw) => {
      (raw.density as Record<string, unknown>).localDensityVariation = 0.3;
    });
    expect(() =>
      datasetEvidenceFromKernelProfile({ computeDatasetStructureProfile: () => retiredDensity }, 7)
    ).toThrow(/localDensityVariation/);

    const retiredCorrelation = mutatedProfile((raw) => {
      (raw.correlations as Record<string, unknown>).significantPairsCount = 1;
    });
    expect(() =>
      datasetEvidenceFromKernelProfile(
        { computeDatasetStructureProfile: () => retiredCorrelation },
        7
      )
    ).toThrow(/significantPairsCount/);

    const retiredPairFlag = mutatedProfile((raw) => {
      const correlations = raw.correlations as Record<string, unknown>;
      correlations.pairs = [
        { columnA: 'x', columnB: 'y', r: 0.9, exceedsMagnitudeThreshold: true, isStrong: true },
      ];
    });
    expect(() =>
      datasetEvidenceFromKernelProfile(
        { computeDatasetStructureProfile: () => retiredPairFlag },
        7
      )
    ).toThrow(/isStrong/);

    // The worst case: the retired name is still present *and* the new name was
    // emitted alongside it, which is what a `#[serde(alias)]` would look like.
    const aliasedSpectral = mutatedProfile((raw) => {
      raw.spectral = {
        periodicityHeuristicScore: 0.8,
        hasPeriodicity: true,
        periodicityConfidence: 0.8,
      };
    });
    expect(() =>
      datasetEvidenceFromKernelProfile({ computeDatasetStructureProfile: () => aliasedSpectral }, 7)
    ).toThrow(/periodicityConfidence/);

    const aliasedPeriodicity = mutatedProfile((raw) => {
      raw.temporal = { periodicities: [{ heuristicScore: 0.8, confidence: 0.8 }] };
    });
    expect(() =>
      datasetEvidenceFromKernelProfile(
        { computeDatasetStructureProfile: () => aliasedPeriodicity },
        7
      )
    ).toThrow(/confidence/);

    // `ClusterProfile.density_variation` was removed rather than renamed (TEC2):
    // it was a two-valued proxy with no estimand, so re-accepting the key from a
    // stale kernel build would silently republish a bogus density quantity.
    const retiredClusterDensity = mutatedProfile((raw) => {
      (raw.clusters as Record<string, unknown>).densityVariation = 0.25;
    });
    expect(() =>
      datasetEvidenceFromKernelProfile(
        { computeDatasetStructureProfile: () => retiredClusterDensity },
        7
      )
    ).toThrow(/densityVariation/);
  });

  it('lets RepresentationState rank only the signature reconstructed from Rust evidence', () => {
    const evidence = datasetEvidenceFromKernelProfile(
      {
        computeDatasetStructureProfile: () => profile(),
        datasetFingerprint: () => 'sha256:authority-fixture',
      },
      7
    );
    const state = new RepresentationState();

    const decision = state.arbitrateRepresentationFromEvidence(evidence);

    expect(decision.datasetFingerprint).toBe('sha256:authority-fixture');
    expect(state.activeSignature?.clusterStructure).toMatchObject({
      estimatedCount: 4,
      hasClusters: true,
      separationScore: 0.8,
    });
    // Canonical cluster evidence carries no density-variation fact: the
    // two-valued Rust proxy is retired, so the signature must leave the
    // compatibility field unset rather than manufacturing a value.
    expect(state.activeSignature?.clusterStructure.densityVariation).toBeUndefined();
    expect(state.activeSignature?.epistemic?.facts['clusterStructure.densityVariation'].source).toBe('unknown');
    expect(state.activeDecision).toBe(decision);
    expect(state.activeStrategy).toBe(decision.embodiment.spatialStrategy);
  });

  it('routes AtlasCore production arbitration through the live Rust structure profile', () => {
    const atlas = new AtlasCore({ kernel: kernel() });
    atlas.loadDataset(dataset());

    const decision = atlas.arbitrateRepresentation();

    expect(decision.datasetFingerprint).toBe('sha256:authority-fixture');
    expect(atlas.activeDatasetSignature?.clusterStructure).toMatchObject({
      estimatedCount: 4,
      hasClusters: true,
      separationScore: 0.8,
    });
    expect(atlas.activeDatasetSignature?.clusterStructure.densityVariation).toBeUndefined();
    expect(atlas.activeRepresentationDecision).toBe(decision);
  });

  it('fails closed when production Atlas lacks the structure-profile ABI', () => {
    const runtime = kernel();
    runtime.computeDatasetStructureProfile = undefined;
    const atlas = new AtlasCore({ kernel: runtime });
    atlas.loadDataset(dataset());

    expect(() => atlas.arbitrateRepresentation()).toThrow(/structureprofile ABI unavailable/i);
  });
});
