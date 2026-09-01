import { describe, expect, it } from 'vitest';
import type { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { InvestigationAggregate } from '../src/atlas/domain/InvestigationAggregate.ts';
import type { AnalysisResult, Observation } from '../src/atlas/types.ts';
import {
  DiscoveryReasoningService,
  type DiscoveryTestOutcome,
} from '../src/app/investigation/DiscoveryReasoningService.ts';

function fixture() {
  const aggregate = new InvestigationAggregate({ sessionId: 'c4-session', now: () => 100 });
  aggregate.graph.addNode({
    id: 'c4-session:v1',
    kind: 'dataset_version',
    parentId: null,
    datasetVersion: 1,
    datasetFingerprint: 'fp-1',
    label: 'Initial Dataset',
    timestamp: 1,
  });

  const observations: Observation[] = [
    {
      id: 'observation-1',
      timestamp: 10,
      notes: 'Region A appears unusually separated.',
      datasetFingerprint: 'fp-1',
      datasetVersion: 1,
      targetIds: ['region-a'],
    },
  ];
  const results: AnalysisResult[] = [
    {
      resultId: 'result-anomaly-1',
      datasetFingerprint: 'fp-1',
      datasetVersion: 1,
      spec: {
        datasetFingerprint: 'fp-1',
        datasetVersion: 1,
        operation: { op: 'anomaly_zscore', column: 'value' },
        algorithmVersion: 'kernel-test',
      },
      dataset: { name: 'fixture', columns: [], rows: [] },
      provenance: null,
      implementationVersion: 'kernel-test',
      outputHash: 'output-1',
      evidenceStatus: 'exploratory',
    },
  ];

  const atlas = {
    aggregate,
    observations,
    results,
    datasetFingerprint: 'fp-1',
    datasetVersion: 1,
    kernelVersion: () => 'kernel-test',
    activeRepresentationDecision: null,
  } as unknown as AtlasCore;

  let id = 0;
  const service = new DiscoveryReasoningService(atlas, {
    now: () => 200 + id,
    idFactory: (prefix) => `${prefix}-${++id}`,
    investigationVersion: 'test/1',
  });

  return { aggregate, observations, results, service };
}

function start(service: DiscoveryReasoningService) {
  return service.start({
    observationId: 'observation-1',
    question: 'Is the separation stable?',
    hypothesis: 'Region A remains separated under anomaly analysis.',
  });
}

function record(
  service: DiscoveryReasoningService,
  discoveryId: string,
  outcome: DiscoveryTestOutcome,
) {
  return service.recordTest({
    discoveryId,
    resultId: 'result-anomaly-1',
    outcome,
    conclusion: `Researcher conclusion for ${outcome}`,
  });
}

describe('P1-UV C4 governed discovery reasoning', () => {
  it('records explicit observation -> question -> hypothesis lineage without analytical inference', () => {
    const { aggregate, service } = fixture();
    const episode = start(service);

    expect(episode.validationStatus).toBe('UNDER_INVESTIGATION');
    expect(episode.notice).toBe('Region A appears unusually separated.');
    expect(episode.question).toBe('Is the separation stable?');
    expect(episode.hypothesis).toBe('Region A remains separated under anomaly analysis.');
    expect(episode.analyticalTests).toEqual([]);
    expect(episode.evidenceIds).toEqual(['observation-1']);
    expect(aggregate.discoveries.get(episode.discoveryId)).toEqual(episode);

    const observationNode = aggregate.graph.getNode('observation-1');
    const questionNode = aggregate.graph.nodes.find(
      (node) => node.metadata?.discoveryRole === 'question',
    );
    const hypothesisNode = aggregate.graph.nodes.find(
      (node) => node.metadata?.discoveryRole === 'hypothesis',
    );
    expect(observationNode?.metadata?.epistemicKind).toBe('notice');
    expect(questionNode?.metadata?.epistemicKind).toBe('question');
    expect(hypothesisNode?.metadata?.epistemicKind).toBe('hypothesis');
    expect(aggregate.graph.edges.filter((edge) => edge.relationship === 'motivates')).toHaveLength(2);
  });

  it.each([
    ['SUPPORTS', 'SUPPORTED', 'supports', 'finding'],
    ['REFUTES', 'REFUTED', 'refutes', 'contradiction'],
    ['INCONCLUSIVE', 'INCONCLUSIVE', 'produces', 'finding'],
  ] as const)(
    'records %s only by citing an existing analytical result',
    (outcome, status, relationship, epistemicKind) => {
      const { aggregate, service } = fixture();
      const episode = start(service);
      const updated = record(service, episode.discoveryId, outcome);

      expect(updated.validationStatus).toBe(status);
      expect(updated.analyticalTests).toHaveLength(1);
      expect(updated.analyticalTests[0]?.evidenceIds).toEqual(['result-anomaly-1']);
      expect(updated.analyticalTests[0]?.outcome).toBe(outcome);
      expect(updated.evidenceIds).toContain('result-anomaly-1');

      const conclusion = aggregate.graph.nodes.find(
        (node) => node.metadata?.discoveryRole === 'conclusion',
      );
      expect(conclusion?.metadata?.epistemicKind).toBe(epistemicKind);
      expect(conclusion?.metadata?.humanJudgement).toBe(true);
      expect(
        aggregate.graph.edges.some((edge) => edge.relationship === relationship),
      ).toBe(true);
    },
  );

  it('refuses a terminal support/refute/inconclusive claim when the cited analytical result is absent', () => {
    const { service, results } = fixture();
    const episode = start(service);
    results.splice(0, results.length);

    expect(() => record(service, episode.discoveryId, 'SUPPORTS')).toThrow(
      'Analysis evidence not found: result-anomaly-1',
    );
    expect(service.snapshot().discoveries[0]?.validationStatus).toBe('UNDER_INVESTIGATION');
  });

  it('creates an explicit branches_from edge only after a tested conclusion exists', () => {
    const { aggregate, service } = fixture();
    const episode = start(service);
    expect(() => service.branch({ discoveryId: episode.discoveryId })).toThrow(
      'Record a tested conclusion before branching this reasoning path.',
    );

    record(service, episode.discoveryId, 'REFUTES');
    const branch = service.branch({ discoveryId: episode.discoveryId, label: 'Alternative cause' });

    expect(branch.metadata?.epistemicKind).toBe('branch_point');
    expect(branch.metadata?.humanJudgement).toBe(true);
    const branchEdge = aggregate.graph.edges.find((edge) => edge.target === branch.id);
    expect(branchEdge?.relationship).toBe('branches_from');
    const source = branchEdge ? aggregate.graph.getNode(branchEdge.source) : null;
    expect(source?.metadata?.discoveryRole).toBe('conclusion');
  });

  it('returns to the tested conclusion without erasing branch provenance', () => {
    const { aggregate, service } = fixture();
    const episode = start(service);
    record(service, episode.discoveryId, 'REFUTES');
    const branch = service.branch({ discoveryId: episode.discoveryId, label: 'Alternative cause' });
    const branchEdge = aggregate.graph.edges.find((edge) => edge.target === branch.id);

    expect(service.snapshot().activeGraphNodeId).toBe(branch.id);
    expect(service.snapshot().activeGraphNode?.metadata?.discoveryRole).toBe('branch');

    const conclusion = service.returnToConclusion(episode.discoveryId);

    expect(conclusion.metadata?.discoveryRole).toBe('conclusion');
    expect(service.snapshot().activeGraphNodeId).toBe(conclusion.id);
    expect(aggregate.graph.getNode(branch.id)).toEqual(branch);
    expect(branchEdge).toBeDefined();
    expect(aggregate.graph.edges).toContainEqual(branchEdge);
    expect(branchEdge?.source).toBe(conclusion.id);
    expect(branchEdge?.relationship).toBe('branches_from');
  });

  it('rejects missing researcher question or hypothesis instead of manufacturing one', () => {
    const { service } = fixture();
    expect(() =>
      service.start({
        observationId: 'observation-1',
        question: '   ',
        hypothesis: 'A hypothesis',
      }),
    ).toThrow('Question is required.');
    expect(() =>
      service.start({
        observationId: 'observation-1',
        question: 'A question',
        hypothesis: '',
      }),
    ).toThrow('Hypothesis is required.');
    expect(service.snapshot().discoveries).toHaveLength(0);
  });
});
