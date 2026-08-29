from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(rel: str, old: str, new: str) -> None:
    path = ROOT / rel
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{rel}: expected one match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


# RepresentationState gets a pure evaluation path. The existing arbitrate path
# remains the mutating/committing authority.
old = '''  arbitrateRepresentationFromEvidence(
    evidence: DatasetEvidence,
    requirements?: RepresentationRequirements,
  ): RepresentationDecision {
    const req = requirements ?? this.activeRequirements ?? createDefaultRequirements();
    const signature = this.computeDatasetSignatureFromEvidence(evidence);
    const bootstrapDecision = new EvidenceBackedMoneta().arbitrate(
      evidence,
      signature,
      req,
    ).decision;
    const decision = this.learnedRuntime
      ? applyPinnedLearnedFitnessRuntime(bootstrapDecision, this.learnedRuntime)
      : bootstrapDecision;
    this.activeDecision = decision;
    this.activeStrategy = decision.embodiment.spatialStrategy;
    this.activeRequirements = req;
    return decision;
  }
'''
new = '''  /**
   * Evaluate a representation decision without mutating canonical representation
   * state. UI previews and other speculative callers must use this path rather
   * than the committing arbitration method below.
   */
  previewRepresentationFromEvidence(
    evidence: DatasetEvidence,
    requirements?: RepresentationRequirements,
  ): RepresentationDecision {
    const req = requirements ?? this.activeRequirements ?? createDefaultRequirements();
    // Deliberately bypass computeDatasetSignatureFromEvidence(), which updates
    // activeSignature. Preview must leave every active* field untouched.
    const signature = datasetEvidenceToSignature(evidence);
    return this.rankRepresentationFromEvidence(evidence, signature, req);
  }

  arbitrateRepresentationFromEvidence(
    evidence: DatasetEvidence,
    requirements?: RepresentationRequirements,
  ): RepresentationDecision {
    const req = requirements ?? this.activeRequirements ?? createDefaultRequirements();
    const signature = this.computeDatasetSignatureFromEvidence(evidence);
    const decision = this.rankRepresentationFromEvidence(evidence, signature, req);
    this.activeDecision = decision;
    this.activeStrategy = decision.embodiment.spatialStrategy;
    this.activeRequirements = req;
    return decision;
  }

  private rankRepresentationFromEvidence(
    evidence: DatasetEvidence,
    signature: DatasetSignature,
    requirements: RepresentationRequirements,
  ): RepresentationDecision {
    const bootstrapDecision = new EvidenceBackedMoneta().arbitrate(
      evidence,
      signature,
      requirements,
    ).decision;
    return this.learnedRuntime
      ? applyPinnedLearnedFitnessRuntime(bootstrapDecision, this.learnedRuntime)
      : bootstrapDecision;
  }
'''
replace_once('src/atlas/domain/RepresentationState.ts', old, new)

atlas_old = '''  arbitrateRepresentation(
    requirements?: RepresentationRequirements,
    _input?: DracoDataInput,
    _spectralFacts?: SpectralFacts | null
  ): RepresentationDecision {
    return this._aggregate.representation.arbitrateRepresentationFromEvidence(
      this.datasetEvidence(),
      requirements
    );
  }
'''
atlas_new = '''  /** Evaluate Moneta ranking without changing the active representation state. */
  previewRepresentation(
    requirements?: RepresentationRequirements,
  ): RepresentationDecision {
    return this._aggregate.representation.previewRepresentationFromEvidence(
      this.datasetEvidence(),
      requirements
    );
  }

  arbitrateRepresentation(
    requirements?: RepresentationRequirements,
    _input?: DracoDataInput,
    _spectralFacts?: SpectralFacts | null
  ): RepresentationDecision {
    return this._aggregate.representation.arbitrateRepresentationFromEvidence(
      this.datasetEvidence(),
      requirements
    );
  }
'''
replace_once('src/atlas/AtlasCore.ts', atlas_old, atlas_new)

replace_once(
    'src/vr/World.ts',
    '      const previewDecision = this.atlas.arbitrateRepresentation(newReq);',
    '      const previewDecision = this.atlas.previewRepresentation(newReq);',
)

# Strengthen the existing B-U2 regression to forbid the mutating API in preview.
test_path = ROOT / 'tests/bu2-post-merge-truthfulness.test.ts'
test = test_path.read_text(encoding='utf-8')
test = test.replace(
    "    expect(world).toContain('previewedAction.id !== action.id');\n",
    "    expect(world).toContain('previewedAction.id !== action.id');\n"
    "    expect(world).toContain('this.atlas.previewRepresentation(newReq)');\n"
    "    expect(world).not.toContain('const previewDecision = this.atlas.arbitrateRepresentation(newReq)');\n",
)
test_path.write_text(test, encoding='utf-8')

(ROOT / 'tests/representation-preview-purity.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
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
''', encoding='utf-8')

print('Pure representation preview boundary applied')
