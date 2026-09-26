import { describe, expect, it } from 'vitest';
import {
  DATASET_EVIDENCE_SCHEMA_VERSION,
  createDatasetEvidence,
  type AnalyticalEvidence,
  type DatasetEvidence,
  type EvidenceCategory,
  type JsonValue,
} from '../src/data/evidence/index.ts';
import {
  BOOTSTRAP_FITNESS_MODEL_VERSION,
  EvidenceBackedMoneta,
  NoFeasibleRepresentationError,
  assertEvidenceBacksSignature,
  createDefaultRequirements,
  datasetEvidenceToSignature,
  type DatasetSignature,
} from '../src/moneta/representation/index.ts';

const FP = 'sha256:evidence-backed';
const KERNEL = 'wasm-kernel-test';

function item(
  id: string,
  category: EvidenceCategory,
  value: JsonValue,
): AnalyticalEvidence {
  return {
    id,
    category,
    name: id,
    value,
    provenance: {
      method: `fixture/${id}`,
      methodVersion: '1',
      kernelVersion: KERNEL,
      parameters: {},
      deterministic: true,
      normalization: 'none',
      missingDataPolicy: 'reject',
      samplingPolicy: 'full-dataset',
      limitations: [],
    },
    uncertainty: { kind: 'none' },
  };
}

function evidence(extra: AnalyticalEvidence[] = [], clustered = false): DatasetEvidence {
  return createDatasetEvidence({
    schemaVersion: DATASET_EVIDENCE_SCHEMA_VERSION,
    datasetFingerprint: FP,
    kernelVersion: KERNEL,
    evidence: [
      item('cardinality:dataset', 'cardinality', { rowCount: 10, columnCount: 3 }),
      item('schema:dimensionality', 'schema', {
        totalColumns: 3,
        numericColumns: 2,
        categoricalColumns: 1,
        temporalColumns: 0,
        constantColumns: 0,
        redundantColumns: 0,
        effectiveDimensions: 3,
      }),
      item('distribution:numeric', 'distribution', {
        summaries: [],
        globalHasOutliers: false,
        globalHighVariance: false,
        maxSkewness: 0,
      }),
      item('density:global', 'density', {
        // 10 rows -> the producer's below-20 branch, and sparse by the
        // row-count threshold (wasm/src/data/profile.rs); 1 was unreachable.
        heuristicScaleDensityProxy: 0.15,
        heuristicModeCount: clustered ? 2 : 1,
        heuristicSparseByRowCount: true,
      }),
      item('cluster:global', 'cluster', {
        heuristicEstimatedCount: clustered ? 2 : 1,
        heuristicPartitionDetected: clustered,
        heuristicSeparationScore: clustered ? 0.7 : 0,
        // Producer relation: silhouette-derived score = separation * 0.9.
        legacySilhouetteDerivedScore: clustered ? 0.63 : 0,
      }),
      item('anomaly:global', 'anomaly', {
        totalAnomalies: 0,
        anomalyFraction: 0,
        heuristicAnomalyDetected: false,
        maxAnomalyScore: 0,
      }),
      item('dependency:correlations', 'dependency', {
        pairs: [],
        maxAbsolutePearsonCorrelation: 0,
        strongCorrelationPairCount: 0,
        heuristicRankDeficiency: false,
      }),
      item('distribution:categorical', 'distribution', {
        summaries: [],
        meanEntropy: 0,
        hasHighCardinality: false,
      }),
      ...extra,
    ],
  });
}

function signature(topology: DatasetSignature['topologicalStructure']['topology'] = 'TABULAR'): DatasetSignature {
  // Canonical tests should begin from the evidence-derived signature and mutate
  // only the fact under test. This prevents old false/zero placeholders from
  // obscuring the boundary behavior being exercised.
  const source = datasetEvidenceToSignature(evidence());
  source.topologicalStructure.topology = topology;
  return source;
}

describe('Evidence-backed Moneta boundary', () => {
  it('permits representation reasoning only after core evidence agrees with the signature', () => {
    const result = new EvidenceBackedMoneta().arbitrate(evidence(), signature());

    expect(result.datasetFingerprint).toBe(FP);
    expect(result.kernelVersion).toBe(KERNEL);
    expect(result.evidenceIds).toContain('cardinality:dataset');
    expect(result.decision.datasetFingerprint).toBe(FP);
  });

  it('builds decision-relevant signature values directly from Rust evidence', () => {
    const sourceEvidence = evidence([], true);
    const authoritative = datasetEvidenceToSignature(sourceEvidence);
    const provided = structuredClone(authoritative);

    const result = new EvidenceBackedMoneta().arbitrate(sourceEvidence, provided);

    expect(authoritative.clusterStructure.separationScore).toBe(0.7);
    expect(authoritative.clusterStructure.hasClusters).toBe(true);
    expect(authoritative.clusterStructure.estimatedCount).toBe(2);
    expect(result.decision.datasetSignature.clusterStructure.separationScore).toBe(0.7);
    // Canonical Rust cluster evidence no longer carries a density-variation
    // fact (the two-valued proxy is retired), so the signature must leave the
    // compatibility field unset with an unknown epistemic source instead of
    // manufacturing one from cluster evidence.
    expect(authoritative.clusterStructure.densityVariation).toBeUndefined();
    expect(
      authoritative.epistemic?.facts['clusterStructure.densityVariation'].source
    ).toBe('unknown');
    expect(result.decision.datasetSignature.clusterStructure.densityVariation).toBeUndefined();
  });

  it('preserves physical-unit spectral frequencies in the Moneta signature', () => {
    const spectralEvidence = item('spectral:global', 'spectral', {
      dominantFrequenciesPerTimeUnit: [0.125, 0.25],
      spectralEntropy: 0.2,
      powerSpectrumPeak: 0.8,
      heuristicPeriodicityDetected: true,
      periodicityHeuristicScore: 0.7,
      method: 'regular-time-fft',
      observedCount: 64,
      transformLength: 64,
      sourceObservationsPerBin: 1,
      frequencyResolutionPerTimeUnit: 0.03125,
      maximumFrequencyPerTimeUnit: 1,
      windowFunction: 'hann',
    });

    const authoritative = datasetEvidenceToSignature(evidence([spectralEvidence]));

    expect(authoritative.spectralStructure).toMatchObject({
      dominantFrequencies: [0.125, 0.25],
      hasPeriodicity: true,
      periodicityHeuristicScore: 0.7,
    });
    expect(authoritative.epistemic?.facts['spectralStructure.hasPeriodicity'].source).toBe(
      'heuristic',
    );
  });

  it('preserves authoritative evidence and model identity when Moneta returns NIL', () => {
    const requirements = createDefaultRequirements('individual-inspection');
    requirements.hardwareConstraints = { ...requirements.hardwareConstraints, maxElements: 1 };

    try {
      new EvidenceBackedMoneta().arbitrate(evidence(), signature(), requirements);
      throw new Error('expected NIL outcome');
    } catch (error) {
      expect(error).toBeInstanceOf(NoFeasibleRepresentationError);
      const nil = error as NoFeasibleRepresentationError;
      expect(nil.provenance).toMatchObject({
        datasetFingerprint: FP,
        kernelVersion: KERNEL,
        fitnessModelVersion: BOOTSTRAP_FITNESS_MODEL_VERSION,
        fitnessModelArtifactHash: null,
      });
      expect(nil.provenance?.evidenceIds).toContain('cardinality:dataset');
      expect(nil.provenance?.requirements?.hardwareConstraints.maxElements).toBe(1);
      expect(nil.nearMisses.length).toBeGreaterThan(0);
      expect(nil.traces.some((trace) => !trace.passed)).toBe(true);
    }
  });

  it('enforces bounded reasoning at the canonical evidence-backed boundary', () => {
    const moneta = new EvidenceBackedMoneta(undefined, {
      maxCandidates: 1,
      maxSensitivityScenarios: 64,
    });

    expect(() => moneta.arbitrate(evidence(), signature())).toThrow(/candidate budget exceeded/i);
  });

  it('rejects a signature whose cardinality disagrees with Rust evidence', () => {
    const source = signature();
    source.cardinality.rowCount = 11;

    expect(() => assertEvidenceBacksSignature(evidence(), source)).toThrow(/row count/i);
  });

  it('tolerates a legacy densityVariation in the caller signature without letting it drive the decision', () => {
    // Historical signatures may legitimately carry `clusterStructure.densityVariation`
    // (it was persisted in pre-TEC2 decisions and the field remains a
    // compatibility surface), and the canonical gate no longer compares it
    // because Rust evidence no longer emits it. The value must therefore pass
    // the boundary — but the FitnessModel consumes only the signature
    // reconstructed from Rust evidence, so the caller's value cannot leak into
    // the decision.
    const sourceEvidence = evidence([], true);
    const source = datasetEvidenceToSignature(sourceEvidence);
    source.clusterStructure.densityVariation = 0.2;

    const result = new EvidenceBackedMoneta().arbitrate(sourceEvidence, source);

    expect(result.decision.datasetSignature.clusterStructure.densityVariation).toBeUndefined();
    expect(source.clusterStructure.densityVariation).toBe(0.2);
    expect(source.epistemic?.facts['clusterStructure.densityVariation'].source).toBe('unknown');
  });

  it('rejects fingerprint drift between evidence and signature', () => {
    const source = signature();
    source.provenance.datasetFingerprint = 'sha256:other';

    expect(() => assertEvidenceBacksSignature(evidence(), source)).toThrow(/dataset fingerprint/i);
  });

  it('requires graph evidence before a GRAPH signature may drive Moneta', () => {
    expect(() => assertEvidenceBacksSignature(evidence(), signature('GRAPH'))).toThrow(/topology/i);
  });

  it('validates graph edge count when graph evidence is present', () => {
    const graphEvidence = item('topology:graph', 'topology', {
      isGraph: true,
      nodeCount: 10,
      edgeCount: 12,
      hasCycles: false,
      isConnected: true,
    });
    const sourceEvidence = evidence([graphEvidence]);
    const source = datasetEvidenceToSignature(sourceEvidence);

    expect(source.topologicalStructure.topology).toBe('GRAPH');
    expect(source.cardinality.edgeCount).toBe(12);
    expect(source.epistemic?.facts['topologicalStructure.hasCycles']).toMatchObject({
      source: 'derived',
      evidenceId: 'topology:graph',
    });
    expect(assertEvidenceBacksSignature(sourceEvidence, source)).toContain('topology:graph');
  });

  it('fails closed for structure kinds the current Rust evidence ABI cannot establish', () => {
    expect(() => assertEvidenceBacksSignature(evidence(), signature('VECTOR_FIELD'))).toThrow(
      /cannot yet establish VECTOR_FIELD/i,
    );
  });
});
