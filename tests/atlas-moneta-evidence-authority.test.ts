import { describe, expect, it } from 'vitest';
import { datasetEvidenceFromKernelProfile } from '../src/atlas/MonetaEvidenceAuthority.ts';
import { RepresentationState } from '../src/atlas/domain/RepresentationState.ts';
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
      significantPairsCount: 1,
      isRankDeficient: false,
    },
    clusters: {
      estimatedCount: 4,
      hasClusters: true,
      separationScore: 0.8,
      densityVariation: 0.61,
      stabilityConfidence: 0.72,
    },
    density: {
      globalDensity: 0.4,
      localDensityVariation: 0.61,
      modeCount: 4,
      isSparse: false,
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

describe('Atlas → Moneta evidence authority boundary', () => {
  it('transports a Rust structure profile into canonical DatasetEvidence without recomputation', () => {
    const evidence = datasetEvidenceFromKernelProfile(
      {
        computeDatasetStructureProfile: () => profile(),
        datasetFingerprint: () => 'sha256:authority-fixture',
      },
      7,
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
        7,
      ),
    ).toThrow(/fingerprint drift/i);
  });

  it('rejects invalid or unavailable Rust dataset handles', () => {
    expect(() =>
      datasetEvidenceFromKernelProfile(
        { computeDatasetStructureProfile: () => profile() },
        0,
      ),
    ).toThrow(/valid Rust dataset handle/i);

    expect(() =>
      datasetEvidenceFromKernelProfile(
        { computeDatasetStructureProfile: () => null },
        7,
      ),
    ).toThrow(/structureprofile unavailable/i);
  });

  it('lets RepresentationState rank only the signature reconstructed from Rust evidence', () => {
    const evidence = datasetEvidenceFromKernelProfile(
      {
        computeDatasetStructureProfile: () => profile(),
        datasetFingerprint: () => 'sha256:authority-fixture',
      },
      7,
    );
    const state = new RepresentationState();

    const decision = state.arbitrateRepresentationFromEvidence(evidence);

    expect(decision.datasetFingerprint).toBe('sha256:authority-fixture');
    expect(state.activeSignature?.clusterStructure).toMatchObject({
      estimatedCount: 4,
      hasClusters: true,
      separationScore: 0.8,
      densityVariation: 0.61,
    });
    expect(state.activeDecision).toBe(decision);
    expect(state.activeStrategy).toBe(decision.embodiment.spatialStrategy);
  });
});
