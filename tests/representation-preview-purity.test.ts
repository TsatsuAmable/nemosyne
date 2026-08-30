import { describe, expect, it } from 'vitest';
import {
  DATASET_EVIDENCE_SCHEMA_VERSION,
  createDatasetEvidence,
  type AnalyticalEvidence,
  type DatasetEvidence,
  type EvidenceCategory,
  type JsonValue,
} from '../src/data/evidence/index.ts';
import { RepresentationState } from '../src/atlas/domain/RepresentationState.ts';
import { createDefaultRequirements } from '../src/moneta/representation/RepresentationRequirements.ts';

const FP = 'sha256:preview-purity';
const KERNEL = 'wasm-kernel-preview-test';

function item(id: string, category: EvidenceCategory, value: JsonValue): AnalyticalEvidence {
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

function evidence(): DatasetEvidence {
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
        heuristicLocalDensityVariation: 0,
        heuristicModeCount: 1,
        isSparse: false,
      }),
      item('cluster:global', 'cluster', {
        heuristicEstimatedCount: 1,
        heuristicPartitionDetected: false,
        heuristicSeparationScore: 0,
        heuristicDensityVariation: 0,
        legacySilhouetteDerivedScore: 0,
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
    ],
  });
}

describe('representation preview purity', () => {
  it('returns a decision without changing active decision, signature, strategy, or requirements', () => {
    const state = new RepresentationState();
    const source = evidence();
    const committedRequirements = createDefaultRequirements('individual-inspection');
    const committed = state.arbitrateRepresentationFromEvidence(source, committedRequirements);

    const before = {
      decision: state.activeDecision,
      signature: state.activeSignature,
      strategy: state.activeStrategy,
      requirements: state.activeRequirements,
    };

    const previewRequirements = createDefaultRequirements('group-comparison');
    const preview = state.previewRepresentationFromEvidence(source, previewRequirements);

    expect(preview).not.toBe(committed);
    expect(state.activeDecision).toBe(before.decision);
    expect(state.activeSignature).toBe(before.signature);
    expect(state.activeStrategy).toBe(before.strategy);
    expect(state.activeRequirements).toBe(before.requirements);
  });
});
