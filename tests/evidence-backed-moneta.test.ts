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
  EvidenceBackedMoneta,
  assertEvidenceBacksSignature,
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

function evidence(extra: AnalyticalEvidence[] = []): DatasetEvidence {
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
      }),
      item('distribution:numeric', 'distribution', {}),
      item('density:global', 'density', {}),
      item('cluster:global', 'cluster', {}),
      item('anomaly:global', 'anomaly', {}),
      item('dependency:correlations', 'dependency', {}),
      item('distribution:categorical', 'distribution', {}),
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
    cardinality: { rowCount: 10, columnCount: 3, edgeCount: 0, depth: 1 },
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

  it('rejects a signature whose cardinality disagrees with Rust evidence', () => {
    const source = signature();
    source.cardinality.rowCount = 11;

    expect(() => assertEvidenceBacksSignature(evidence(), source)).toThrow(/row count/i);
  });

  it('rejects fingerprint drift between evidence and signature', () => {
    const source = signature();
    source.provenance.datasetFingerprint = 'sha256:other';

    expect(() => assertEvidenceBacksSignature(evidence(), source)).toThrow(/dataset fingerprint/i);
  });

  it('requires graph evidence before a GRAPH signature may drive Moneta', () => {
    expect(() => assertEvidenceBacksSignature(evidence(), signature('GRAPH'))).toThrow(
      /topology:graph/i,
    );
  });

  it('validates graph edge count when graph evidence is present', () => {
    const source = signature('GRAPH');
    source.cardinality.edgeCount = 12;
    const graphEvidence = item('topology:graph', 'topology', {
      isGraph: true,
      nodeCount: 10,
      edgeCount: 12,
      hasCycles: false,
      isConnected: true,
    });

    expect(assertEvidenceBacksSignature(evidence([graphEvidence]), source)).toContain('topology:graph');
  });

  it('fails closed for structure kinds the current Rust evidence ABI cannot establish', () => {
    expect(() => assertEvidenceBacksSignature(evidence(), signature('VECTOR_FIELD'))).toThrow(
      /cannot yet establish VECTOR_FIELD/i,
    );
  });
});
