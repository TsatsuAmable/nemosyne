import { describe, expect, it } from 'vitest';
import type { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { InvestigationAggregate } from '../src/atlas/domain/InvestigationAggregate.ts';
import type { AnalysisResult, Finding, Observation } from '../src/atlas/types.ts';
import { DiscoveryReasoningService } from '../src/app/investigation/DiscoveryReasoningService.ts';
import { InvestigationJourneyController } from '../src/app/investigation/InvestigationJourneyController.ts';
import { bindInvestigationJourneyNilRuntime } from '../src/app/investigation/InvestigationJourneyNilRuntime.ts';
import { NilExecutor } from '../src/interaction/nil/NilExecutor.ts';

function fixture() {
  const aggregate = new InvestigationAggregate({ sessionId: 'pt5c-session', now: () => 100 });
  aggregate.graph.addNode({
    id: 'pt5c-session:v1',
    kind: 'dataset_version',
    parentId: null,
    datasetVersion: 1,
    datasetFingerprint: 'fp-1',
    label: 'Initial Dataset',
    timestamp: 1,
  });

  const observations: Observation[] = [];
  const findings: Finding[] = [];
  const results: AnalysisResult[] = [];
  let observationId = 0;
  let findingId = 0;

  const atlas = {
    aggregate,
    observations,
    findings,
    results,
    datasetFingerprint: 'fp-1',
    datasetVersion: 1,
    kernelVersion: () => 'kernel-test',
    activeRepresentationDecision: null,
    recordObservation: (input: { notes: string; targetIds?: string[]; tags?: string[] }) => {
      const observation: Observation = {
        id: `notice-${++observationId}`,
        timestamp: 110 + observationId,
        notes: input.notes,
        targetIds: input.targetIds,
        tags: input.tags,
        datasetFingerprint: 'fp-1',
        datasetVersion: 1,
      };
      observations.push(observation);
      return observation;
    },
    recordAnnotation: () => {
      throw new Error('not used');
    },
    recordFinding: (input: Omit<Finding, 'id' | 'timestamp' | 'datasetFingerprint' | 'datasetVersion'>) => {
      const finding: Finding = {
        ...input,
        id: `finding-${++findingId}`,
        timestamp: 200 + findingId,
        datasetFingerprint: 'fp-1',
        datasetVersion: 1,
      };
      findings.push(finding);
      return finding;
    },
  } as unknown as AtlasCore;

  let generatedId = 0;
  const reasoning = new DiscoveryReasoningService(atlas, {
    now: () => 300 + generatedId,
    idFactory: (prefix) => `${prefix}-${++generatedId}`,
    investigationVersion: 'test/pt5c',
  });
  const executor = new NilExecutor();
  const dispose = bindInvestigationJourneyNilRuntime(executor, atlas, reasoning);
  const journey = new InvestigationJourneyController({
    executor,
    reasoning,
    investigationId: () => aggregate.sessionId,
    idFactory: (prefix) => `${prefix}-command-${++generatedId}`,
    now: () => 400 + generatedId,
  });

  const addResult = (fingerprint = 'fp-1'): AnalysisResult => {
    const result: AnalysisResult = {
      resultId: `result-${results.length + 1}`,
      datasetFingerprint: fingerprint,
      datasetVersion: 1,
      spec: {
        datasetFingerprint: fingerprint,
        datasetVersion: 1,
        operation: { op: 'anomaly_zscore', column: 'value' },
        algorithmVersion: 'kernel-test',
      },
      dataset: { name: 'fixture', columns: [], rows: [] },
      provenance: null,
      implementationVersion: 'kernel-test',
      outputHash: `output-${results.length + 1}`,
      evidenceStatus: 'exploratory',
    };
    results.push(result);
    return result;
  };

  return { aggregate, atlas, observations, findings, results, reasoning, executor, journey, addResult, dispose };
}

async function reachHypothesis(f: ReturnType<typeof fixture>) {
  const notice = await f.journey.observe('Region A looks unusually separated.', ['region-a']);
  const discoveryId = await f.journey.ask(notice.id, 'Is the separation stable?');
  await f.journey.hypothesise(discoveryId, 'Region A remains separated under anomaly analysis.');
  return { notice, discoveryId };
}

describe('PT5C canonical investigation journey', () => {
  it('uses one sequenced NIL path from notice through evidence-backed discovery', async () => {
    const f = fixture();
    const { notice, discoveryId } = await reachHypothesis(f);
    const result = f.addResult();

    await f.journey.recordUnderstanding({
      discoveryId,
      title: 'Stable separation',
      description: 'The anomaly result preserves the observed separation.',
      resultId: result.resultId,
    });
    await f.journey.validate(discoveryId, result.resultId, 'SUPPORTS');

    const episode = f.reasoning.snapshot().discoveries.find((entry) => entry.discoveryId === discoveryId)!;
    expect(episode.notice).toBe(notice.notes);
    expect(episode.question).toBe('Is the separation stable?');
    expect(episode.hypothesis).toContain('remains separated');
    expect(episode.conclusion).toBe('The anomaly result preserves the observed separation.');
    expect(episode.validationStatus).toBe('SUPPORTED');
    expect(episode.analyticalTests).toHaveLength(1);
    expect(episode.analyticalTests[0]?.evidenceIds).toEqual([result.resultId]);
    expect(episode.evidenceIds).toEqual(expect.arrayContaining([notice.id, result.resultId, 'finding-1']));
    expect(f.findings).toHaveLength(1);
    expect(f.findings[0]?.observationIds).toEqual([notice.id]);
    expect(f.executor.expectedSequence(f.aggregate.sessionId)).toBe(5);

    const roles = f.aggregate.graph.nodes.map((node) => node.metadata?.discoveryRole).filter(Boolean);
    expect(roles).toEqual(expect.arrayContaining(['notice', 'question', 'hypothesis', 'understanding', 'validation']));
    expect(f.aggregate.graph.edges.some((edge) => edge.relationship === 'supports')).toBe(true);
    f.dispose();
  });

  it('does not record understanding or consume NIL sequence before analytical evidence exists', async () => {
    const f = fixture();
    const { discoveryId } = await reachHypothesis(f);
    const sequenceBefore = f.executor.expectedSequence(f.aggregate.sessionId);

    await expect(
      f.journey.recordUnderstanding({
        discoveryId,
        title: 'Unsupported understanding',
        description: 'This must not be recorded.',
        resultId: 'missing-result',
      }),
    ).rejects.toThrow(/analytical evidence not found/i);

    expect(f.findings).toHaveLength(0);
    expect(f.reasoning.snapshot().discoveries[0]?.conclusion).toBeUndefined();
    expect(f.executor.expectedSequence(f.aggregate.sessionId)).toBe(sequenceBefore);
    f.dispose();
  });

  it('requires explicit understanding before a terminal validation', async () => {
    const f = fixture();
    const { discoveryId } = await reachHypothesis(f);
    const result = f.addResult();
    const sequenceBefore = f.executor.expectedSequence(f.aggregate.sessionId);

    await expect(f.journey.validate(discoveryId, result.resultId, 'REFUTES')).rejects.toThrow(
      /record your understanding/i,
    );
    expect(f.reasoning.snapshot().discoveries[0]?.validationStatus).toBe('UNDER_INVESTIGATION');
    expect(f.executor.expectedSequence(f.aggregate.sessionId)).toBe(sequenceBefore);
    f.dispose();
  });

  it('rejects foreign-dataset analytical evidence before an Atlas finding is created', async () => {
    const f = fixture();
    const { discoveryId } = await reachHypothesis(f);
    const result = f.addResult('fp-foreign');
    const sequenceBefore = f.executor.expectedSequence(f.aggregate.sessionId);

    await expect(
      f.journey.recordUnderstanding({
        discoveryId,
        title: 'Foreign evidence',
        description: 'Should be rejected.',
        resultId: result.resultId,
      }),
    ).rejects.toThrow(/different dataset/i);
    expect(f.findings).toHaveLength(0);
    expect(f.executor.expectedSequence(f.aggregate.sessionId)).toBe(sequenceBefore);
    f.dispose();
  });

  it.each([
    ['REFUTES', 'REFUTED'],
    ['INCONCLUSIVE', 'INCONCLUSIVE'],
  ] as const)('records %s as a human validation only after cited understanding', async (outcome, status) => {
    const f = fixture();
    const { discoveryId } = await reachHypothesis(f);
    const result = f.addResult();
    await f.journey.recordUnderstanding({
      discoveryId,
      title: 'Evidence interpretation',
      description: 'The researcher explicitly interprets this result.',
      resultId: result.resultId,
    });
    await f.journey.validate(discoveryId, result.resultId, outcome);
    expect(f.reasoning.snapshot().discoveries[0]?.validationStatus).toBe(status);
    f.dispose();
  });

  it('persists the completed DiscoveryEpisode and explicit graph lineage in aggregate state', async () => {
    const f = fixture();
    const { discoveryId } = await reachHypothesis(f);
    const result = f.addResult();
    await f.journey.recordUnderstanding({
      discoveryId,
      title: 'Portable understanding',
      description: 'This reasoning must survive the investigation snapshot.',
      resultId: result.resultId,
    });
    await f.journey.validate(discoveryId, result.resultId, 'SUPPORTS');

    const state = f.aggregate.toState();
    expect(state.discoveryEpisodes?.episodes).toHaveLength(1);
    expect(state.discoveryEpisodes?.episodes[0]?.validationStatus).toBe('SUPPORTED');
    expect(state.discoveryEpisodes?.episodes[0]?.conclusion).toContain('survive');
    expect(state.investigationGraph?.nodes.some((node) => node.metadata?.discoveryRole === 'validation')).toBe(true);
    f.dispose();
  });
});
