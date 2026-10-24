/** Accepted RFC 0013 / SHADOW-0017 falsifiers: no positional evidence substitution. */
import { describe, expect, it, vi } from 'vitest';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { buildDatasetSignature } from '../src/moneta/representation/SignatureBuilder.ts';
import { RepresentationGraphGrammar } from '../src/moneta/search/RepresentationGraphGrammar.ts';
import { RepresentationSearchEngine } from '../src/moneta/search/RepresentationSearchEngine.ts';
import { FormaResolutionBroker } from '../src/moneta/forma/FormaResolutionBroker.ts';
import { FormaMultiElementRuntime } from '../src/moneta/forma/FormaMultiElementRuntime.ts';
import { canonicalizeCommittedInvestigationContext } from '../src/atlas/domain/CommittedInvestigationContext.ts';
import {
  FullMonetaEngine, selectFM8CompositionEvidence,
} from '../src/moneta/adaptation/FullMonetaEngine.ts';
import {
  normalizeEnvelopeToSnapshot, type SemanticSnapshotV1,
} from '../src/moneta/representation/SemanticSnapshotV1.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.ts';
import type { RepresentationPrimitiveKind } from '../src/moneta/representation/RepresentationGraph.ts';

const FINGERPRINT = 'rfc0013-dataset-alpha';
const context = canonicalizeCommittedInvestigationContext({
  schemaVersion: 2,
  nodeId: 'rfc0013-context',
  intent: {
    schemaVersion: 1, researchQuestion: 'How do categories distribute?',
    variablesOfInterest: ['count'], currentTask: 'inspect-distribution',
  },
  epistemicPurpose: 'CLAIM_BEARING',
});

function snapshot(
  kind: 'AGGREGATE' | 'DISTRIBUTION',
  datasetFingerprint = FINGERPRINT,
  kernelVersion = '1.0.0',
  methodVersion = '1.0.0',
): SemanticSnapshotV1 {
  const aggregate = kind === 'AGGREGATE';
  const envelope: SemanticEmbodimentEnvelopeV1 = {
    schemaVersion: 1,
    datasetFingerprint,
    candidateId: aggregate ? 'AGGREGATE_VOLUME' : 'DISTRIBUTION_FIELD',
    representationFamily: kind,
    analyticalMethod: {
      name: aggregate ? 'aggregateVolume' : 'empiricalDistribution',
      version: methodVersion,
      parameters: aggregate
        ? { groupingFields: ['category'], measure: 'COUNT' }
        : { field: 'count', binCount: 2 },
    },
    approximation: { mode: 'EXACT', representedRowCount: 4 },
    informationContract: { preserves: ['count'], loses: ['row-identity'] },
    resource: { sourceRowCount: 4, elementCount: 2, maxElementCount: 4096 },
    provenance: {
      kernelVersion,
      algorithmVersion: '1.0.0',
      decisionId: 'decision-fixture',
      decisionModelVersion: 'fixture',
      decisionModelArtifactHash: 'fixture-hash',
    },
    result: {
      status: 'READY',
      payload: aggregate
        ? {
            kind: 'AGGREGATE_VOLUME',
            data: {
              groupingFields: ['category'], measure: { function: 'COUNT' },
              groups: [
                { semanticId: 'region-a', key: 'A', count: 2 },
                { semanticId: 'region-b', key: 'B', count: 2 },
              ],
            },
          }
        : {
            kind: 'EMPIRICAL_DISTRIBUTION',
            data: {
              measureField: 'count', domain: { min: 0, max: 4 },
              counts: { sourceCount: 4, validCount: 4, excludedCount: 0 },
              histogram: [
                { semanticId: 'bin-0', lowerBound: 0, upperBound: 2, count: 2, upperInclusive: false },
                { semanticId: 'bin-1', lowerBound: 2, upperBound: 4, count: 2, upperInclusive: true },
              ],
              ecdf: [], quantiles: [],
            },
          },
    },
  };
  return normalizeEnvelopeToSnapshot(envelope);
}

function graph(...kinds: RepresentationPrimitiveKind[]) {
  return {
    ...RepresentationGraphGrammar.createEmptyGraph('rfc0013-graph', FINGERPRINT),
    primitives: kinds.map((kind, index) => ({
      id: `p${index}`,
      kind,
      semanticInputs: ['count'],
      visualEncoding: {},
      interactionAffordances: [],
      analyticalDependencies: [],
      parameters: {},
      limitations: [],
    })),
  };
}

const primary = snapshot('AGGREGATE');
const distribution = snapshot('DISTRIBUTION');
const dataset = new Dataset(
  'rfc0013-dataset',
  [{ name: 'count', type: ColumnType.NUMERIC }],
  [{ count: 1 }, { count: 2 }, { count: 3 }, { count: 4 }],
);
const signature = buildDatasetSignature(dataset);

function controlledSearch(selectedKind: RepresentationPrimitiveKind = 'DISTRIBUTION') {
  const original = RepresentationSearchEngine.search(signature, {
    context, maxGenerations: 1, populationSize: 4,
  });
  const controlled = { ...original.referenceCandidate, graph: graph(selectedKind) };
  return vi.spyOn(RepresentationSearchEngine, 'search').mockReturnValue({
    ...original, paretoFrontier: [controlled], referenceCandidate: controlled,
  });
}

describe('RFC0013 explicit multi-snapshot binding', () => {
  it('preserves omitted-list primary assertion, but refuses explicit empty lists', () => {
    const omitted = selectFM8CompositionEvidence(graph('AGGREGATION', 'POINT_IDENTITY'), primary);
    expect(omitted.map((x) => x.basis)).toEqual(['PRIMARY_ASSERTED', 'PRIMARY_ASSERTED']);
    expect(omitted.every((x) => x.snapshot.snapshotId === primary.snapshotId)).toBe(true);
    expect(() => selectFM8CompositionEvidence(graph('DISTRIBUTION'), primary, []))
      .toThrow(/EVIDENCE_BINDING_EMPTY_LIST/);
  });

  it('uses only approved sources, independent of list order or positional fallback', () => {
    const selected = graph('DISTRIBUTION', 'DISTRIBUTION');
    const a = selectFM8CompositionEvidence(selected, primary, [primary, distribution]);
    const b = selectFM8CompositionEvidence(selected, primary, [distribution, primary]);
    expect(a.map((x) => [x.primitiveId, x.snapshot.snapshotId, x.basis, x.sourceFamily]))
      .toEqual(b.map((x) => [x.primitiveId, x.snapshot.snapshotId, x.basis, x.sourceFamily]));
    expect(a.every((x) => x.snapshot.snapshotId === distribution.snapshotId)).toBe(true);
    expect(a.every((x) => x.basis === 'FAMILY_MATCHED')).toBe(true);
    expect(() => selectFM8CompositionEvidence(selected, primary, [primary]))
      .toThrow(/EVIDENCE_BINDING_MISSING_FAMILY/);
    expect(() => selectFM8CompositionEvidence(graph('AGGREGATION'), primary, [primary]))
      .toThrow(/EVIDENCE_BINDING_UNMAPPED_KIND.*AGGREGATION/);
  });

  it('rejects unrelated datasets, mismatched kernel versions and ambiguous matches', () => {
    expect(() => selectFM8CompositionEvidence(graph('DISTRIBUTION'), primary, [
      distribution, snapshot('DISTRIBUTION', 'foreign-dataset'),
    ])).toThrow(/EVIDENCE_BINDING_DATASET_MISMATCH/);
    expect(() => selectFM8CompositionEvidence(graph('DISTRIBUTION'), primary, [
      distribution, snapshot('DISTRIBUTION', FINGERPRINT, '9.9.9'),
    ])).toThrow(/EVIDENCE_BINDING_KERNEL_MISMATCH/);
    expect(() => selectFM8CompositionEvidence(graph('DISTRIBUTION'), primary, [
      distribution, snapshot('DISTRIBUTION', FINGERPRINT, '1.0.0', '2.0.0'),
    ])).toThrow(/EVIDENCE_BINDING_AMBIGUOUS_FAMILY/);
    expect(selectFM8CompositionEvidence(graph('DISTRIBUTION'), primary, [
      distribution, distribution,
    ])).toHaveLength(1); // same content identity is not two contradictory sources
  });

  it('commits exact selected snapshot, slice, primitive and binding basis to v2 identity', () => {
    const spy = controlledSearch();
    try {
      const result = FullMonetaEngine.synthesizeOrAdapt(signature, context, undefined, {
        snapshot: primary,
        snapshots: [primary, distribution],
        maxGenerations: 1,
        populationSize: 4,
        mandatoryChannels: ['spatial_scatter'],
      });
      expect(result.composedState.schemaVersion).toBe(2);
      expect(result.composedState.composedIdentity).toMatch(/^composed-forma-v2:[a-f0-9]{64}$/);
      const record = result.composedState.elements[0];
      expect(record).toMatchObject({
        elementId: 'element-p0',
        snapshotId: distribution.snapshotId,
        evidenceBinding: {
          primitiveId: 'p0',
          basis: 'FAMILY_MATCHED',
          sourceFamily: 'DISTRIBUTION',
          analyticalDatasetFingerprint: FINGERPRINT,
          kernelVersion: '1.0.0',
        },
      });
      expect(record.sliceId).toBeTruthy();
      expect(record.snapshotId).not.toBe(result.resolutionVariant.slice.snapshotId);

      const altered = new FormaMultiElementRuntime();
      altered.registerElement(record.elementId, result.resolutionVariant.slice, record.phenomenonFamily, {
        primitiveId: 'p0', basis: 'PRIMARY_ASSERTED', sourceFamily: null,
        analyticalDatasetFingerprint: FINGERPRINT, kernelVersion: '1.0.0',
      });
      expect(altered.computeComposedIdentity()).not.toBe(result.composedState.composedIdentity);
    } finally {
      spy.mockRestore();
    }
  });

  it('fails an unadmitted secondary variant instead of silently registering primary', () => {
    const spy = controlledSearch();
    const broker = new FormaResolutionBroker();
    const original = broker.brokerVariant.bind(broker);
    const refused = vi.spyOn(broker, 'brokerVariant').mockImplementation((...args) =>
      args[0].snapshotId === distribution.snapshotId
        ? { status: 'REFUSED', refusal: { code: 'BUDGET_EXCEEDED', message: 'secondary budget test' } }
        : original(...args)
    );
    try {
      expect(() => FullMonetaEngine.synthesizeOrAdapt(signature, context, undefined, {
        snapshot: primary,
        snapshots: [primary, distribution],
        broker,
        mandatoryChannels: ['spatial_scatter'],
        maxGenerations: 1,
        populationSize: 4,
      })).toThrow(/EVIDENCE_BINDING_VARIANT_REFUSED.*p0.*BUDGET_EXCEEDED/);
      expect(refused).toHaveBeenCalledTimes(2);
    } finally {
      refused.mockRestore();
      spy.mockRestore();
    }
  });
});
