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

function evidence(extra: AnalyticalEvidence[] = [], densityVariation = 0): DatasetEvidence {
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
        globalDensity: 1,
        heuristicLocalDensityVariation: densityVariation,
        heuristicModeCount: 1,
        isSparse: false,
      }),
      item('cluster:global', 'cluster', {
        heuristicEstimatedCount: densityVariation > 0 ? 2 : 1,
        heuristicPartitionDetected: densityVariation > 0,
        heuristicSeparationScore: densityVariation > 0 ? 0.7 : 0,
        heuristicDensityVariation: densityVariation,
        legacySilhouetteDerivedScore: densityVariation > 0 ? 0.7 : 0,
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
  return {
    schema: {
      numericCount: 2,
      categoricalCount: 1,
      temporalCount: 0,
      geoCount: 0,
      textCount: 0,
      idCount: 0,
    },
    cardinality: { rowCount: 10, columnCount: 3, edgeCount: 0, depth: 0 },
    distribution: {
      hasOutliers: false,
      outlierFraction: 0,
      anomalyCount: 0,
      highVariance: false,
      maxSkewness: 0,
      meanEntropy: 0,
    },
    dependence: { maxCorrelation: 0, significantPairsCount: 0, rankDeficiency: false },
    clusterStructure: {
      estimatedCount: 1,
      hasClusters: false,
      separationScore: 0,
      densityVariation: 0,
    },
    topologicalStructure: { topology },
    temporalStructure: { isTimeSeries: false, trendDirection: 'flat', hasSeasonality: false },
    spatialStructure: { isGeospatial: false, coordinateDimensions: 0 },
    spectralStructure: null,
    provenance: {
      datasetFingerprint: FP,
      kernelVersion: KERNEL,
      analysisTimestamp: 0,
    },
  };
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
    const sourceEvidence = evidence([], 0.8);
    const authoritative = datasetEvidenceToSignature(sourceEvidence);
    const provided = structuredClone(authoritative);

    const result = new EvidenceBackedMoneta().arbitrate(sourceEvidence, provided);

    expect(authoritative.clusterStructure.densityVariation).toBe(0.8);
    expect(authoritative.clusterStructure.separationScore).toBe(0.7);
    expect(authoritative.clusterStructure.hasClusters).toBe(true);
    expect(result.decision.datasetSignature.clusterStructure.densityVariation).toBe(0.8);
    expect(result.decision.datasetSignature.clusterStructure.separationScore).toBe(0.7);
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

  it('rejects FitnessModel-relevant density drift instead of scoring caller placeholders', () => {
    const sourceEvidence = evidence([], 0.8);
    const source = datasetEvidenceToSignature(sourceEvidence);
    source.clusterStructure.densityVariation = 0.2;

    expect(() => assertEvidenceBacksSignature(sourceEvidence, source)).toThrow(/density variation/i);
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
    expect(assertEvidenceBacksSignature(sourceEvidence, source)).toContain('topology:graph');
  });

  it('fails closed for structure kinds the current Rust evidence ABI cannot establish', () => {
    expect(() => assertEvidenceBacksSignature(evidence(), signature('VECTOR_FIELD'))).toThrow(
      /cannot yet establish VECTOR_FIELD/i,
    );
  });
});
