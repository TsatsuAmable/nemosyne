import { describe, test, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import {
  NIL_VERSION,
  NilExecutor,
  bindAtlasNilHandlers,
  type NilCommand,
} from '../src/interaction/nil/index.ts';

describe('FM2-R2: NIL Alternative & Intent Product Actions Qualification Battery', () => {
  function makeMultiDimensionalDataset(): Dataset {
    const rows = [];
    for (let i = 0; i < 30; i++) {
      rows.push({
        dim1: i * 2.0,
        dim2: (i % 5) * 1.5,
        dim3: (i % 3) * 4.0,
        category: i % 2 === 0 ? 'TypeA' : 'TypeB',
      });
    }
    return new Dataset(
      'fm2-multi-dim-ds',
      [
        { name: 'dim1', type: ColumnType.NUMERIC },
        { name: 'dim2', type: ColumnType.NUMERIC },
        { name: 'dim3', type: ColumnType.NUMERIC },
        { name: 'category', type: ColumnType.CATEGORICAL },
      ],
      rows
    );
  }

  function nilCmd(
    sequence: number,
    verb: NilCommand['verb'],
    parameters: NilCommand['parameters'] = {},
    targetIds: readonly string[] = []
  ): NilCommand {
    return {
      nilVersion: NIL_VERSION,
      commandId: `cmd-fm2-${sequence}`,
      investigationId: 'investigation-fm2',
      sequence,
      verb,
      targetIds,
      parameters,
      actor: 'researcher',
    };
  }

  test('falsifier 1: REQUEST_ALTERNATIVE and COMPARE query candidates and return shared anchors while leaving active decision and graph invariant', async () => {
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
    atlas.loadDataset(makeMultiDimensionalDataset());
    const executor = new NilExecutor();

    let alternativesReceived: unknown[] = [];
    let comparisonReceived: unknown = undefined;

    bindAtlasNilHandlers(executor, atlas, {
      onAlternativesRequested: (_cmd, alts) => {
        alternativesReceived = [...alts];
      },
      onAlternativeCompared: (_cmd, comp) => {
        comparisonReceived = comp;
      },
    });

    // Arbitrate representation to populate baseline decision and alternatives
    atlas.arbitrateRepresentation();
    const activeDecisionBefore = atlas.activeRepresentationDecision;
    const activeNodeBefore = atlas.getActiveNodeId();
    const digestBefore = await atlas.computeDigest();

    // 1. Execute REQUEST_ALTERNATIVE
    await executor.execute(nilCmd(0, 'REQUEST_ALTERNATIVE'));
    expect(alternativesReceived.length).toBeGreaterThan(0);
    const eligibleAlt = (alternativesReceived as any[]).find(
      (a) => a.eligibility !== 'DISQUALIFIED' && a.eligibility !== 'ABSTAIN'
    );
    expect(eligibleAlt).toBeDefined();

    // 2. Execute COMPARE
    await executor.execute(
      nilCmd(1, 'COMPARE', { candidateId: eligibleAlt.candidateId })
    );
    expect(comparisonReceived).toBeDefined();
    const comp = comparisonReceived as any;
    expect(comp.alternative.candidateId).toBe(eligibleAlt.candidateId);
    expect(comp.sharedAnchors).toBeDefined();
    expect(Array.isArray(comp.sharedAnchors)).toBe(true);

    // Assert strict invariance of active representation and graph digest
    expect(atlas.activeRepresentationDecision?.id).toBe(activeDecisionBefore?.id);
    expect(atlas.getActiveNodeId()).toBe(activeNodeBefore);
    expect(await atlas.computeDigest()).toBe(digestBefore);
    expect(executor.expectedSequence('investigation-fm2')).toBe(2);
  });

  test('falsifier 2: PREFER branches investigation to alternative via Road Not Taken, preserving parent lineage and binding context', async () => {
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
    atlas.loadDataset(makeMultiDimensionalDataset());
    const executor = new NilExecutor();

    bindAtlasNilHandlers(executor, atlas);

    // Initialise root context
    const rootNodeId = atlas.getActiveNodeId()!;
    atlas.commitInvestigationContext(rootNodeId, {
      schemaVersion: 2,
      nodeId: rootNodeId,
      intent: {
        schemaVersion: 1,
        researchQuestion: 'Initial cluster variance across dimensions?',
        hypothesis: 'Primary dimensions drive variance.',
      },
      epistemicPurpose: 'EXPLORATORY_ABDUCTION',
    });

    // Populate alternatives
    atlas.arbitrateRepresentation();
    const alternatives = atlas.getRepresentationAlternatives();
    const eligible = alternatives.find(
      (a) => a.eligibility !== 'DISQUALIFIED' && a.eligibility !== 'ABSTAIN'
    );
    expect(eligible).toBeDefined();

    const parentDigest = await atlas.computeDigest();

    // Execute PREFER with intent override
    await executor.execute(
      nilCmd(0, 'PREFER', {
        candidateId: eligible!.candidateId,
        researchQuestion: 'Counterfactual cluster structure on alternative layout?',
        hypothesis: 'Alternative representation resolves cluster ambiguities.',
      })
    );

    // Assert active node advanced to child branch
    const childNodeId = atlas.getActiveNodeId()!;
    expect(childNodeId).not.toBe(rootNodeId);
    expect(childNodeId).toContain('branch-rnt-');

    // Assert active decision switched to the chosen alternative
    expect(atlas.activeRepresentationDecision?.chosenFamily).toBe(eligible!.family);
    expect(atlas.activeRepresentationDecision?.chosenLayout).toBe(eligible!.layout);

    // Assert child context reflects overridden intent while inheriting purpose
    const childContext = atlas.getActiveInvestigationContext();
    expect(childContext).toBeDefined();
    expect(childContext?.nodeId).toBe(childNodeId);
    expect(childContext?.intent.researchQuestion).toBe(
      'Counterfactual cluster structure on alternative layout?'
    );
    expect(childContext?.intent.hypothesis).toBe(
      'Alternative representation resolves cluster ambiguities.'
    );
    expect(childContext?.epistemicPurpose).toBe('EXPLORATORY_ABDUCTION');

    // Assert parent node state in graph remains unchanged
    const graph = atlas.toState().investigationGraph!;
    const parentNode = graph.nodes.find((n) => n.id === rootNodeId);
    expect(parentNode).toBeDefined();
    expect(parentNode?.parentId).toBeNull();

    // Assert investigation digest reflects branch addition and is reproducible
    const branchDigest = await atlas.computeDigest();
    expect(branchDigest).not.toBe(parentDigest);
    expect(await atlas.computeDigest()).toBe(branchDigest);
  });

  test('falsifier 3: REJECT records attributable embodiment critique against candidate without altering graph structure', async () => {
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
    atlas.loadDataset(makeMultiDimensionalDataset());
    const executor = new NilExecutor();

    let critiqueEmitted: any = undefined;
    bindAtlasNilHandlers(executor, atlas, {
      onAlternativeRejected: (_cmd, critique) => {
        critiqueEmitted = critique;
      },
    });

    atlas.arbitrateRepresentation();
    const alternatives = atlas.getRepresentationAlternatives();
    expect(alternatives.length).toBeGreaterThan(0);
    const candidateToReject = alternatives[0];

    const digestBefore = await atlas.computeDigest();
    const activeNodeBefore = atlas.getActiveNodeId();

    await executor.execute(
      nilCmd(0, 'REJECT', {
        candidateId: candidateToReject.candidateId,
        rationale: 'High occlusion of cluster centroids under spatial scatter',
      })
    );

    expect(critiqueEmitted).toBeDefined();
    expect(critiqueEmitted.planId).toBe(candidateToReject.candidateId);
    expect(critiqueEmitted.critiqueText).toBe(
      'High occlusion of cluster centroids under spatial scatter'
    );
    expect(critiqueEmitted.status).toBe('REJECTED');
    expect(critiqueEmitted.confirmed).toBe(true);

    // Verify stored critique in atlas
    const storedCritiques = atlas.getEmbodimentCritiques();
    expect(storedCritiques.length).toBe(1);
    expect(storedCritiques[0].planId).toBe(candidateToReject.candidateId);

    // Assert graph and active node are untouched
    expect(atlas.getActiveNodeId()).toBe(activeNodeBefore);
    expect(await atlas.computeDigest()).toBe(digestBefore);
  });

  test('falsifier 4: EXPLAIN generates authoritative decision report without mutating investigation state', async () => {
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
    atlas.loadDataset(makeMultiDimensionalDataset());
    const executor = new NilExecutor();

    let explanationReceived = '';
    bindAtlasNilHandlers(executor, atlas, {
      onDecisionExplained: (_cmd, explanation) => {
        explanationReceived = explanation;
      },
    });

    atlas.arbitrateRepresentation();
    const digestBefore = await atlas.computeDigest();

    await executor.execute(
      nilCmd(0, 'EXPLAIN', { preference: 'SIMPLER' })
    );

    expect(explanationReceived.length).toBeGreaterThan(0);
    expect(explanationReceived).toMatch(/Moneta ranks|Representation Decision:/);

    // Digest remains invariant
    expect(await atlas.computeDigest()).toBe(digestBefore);
  });

  test('falsifier 5: QUESTION and HYPOTHESISE update active context intent while preserving dataset fingerprint bitwise', async () => {
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
    atlas.loadDataset(makeMultiDimensionalDataset());
    const executor = new NilExecutor();

    bindAtlasNilHandlers(executor, atlas);

    const fpBefore = atlas.datasetFingerprint;

    // 1. Question
    await executor.execute(
      nilCmd(0, 'QUESTION', {
        question: 'What is the correlation between dim1 and dim2?',
        variables: ['dim1', 'dim2'],
        task: 'correlation_analysis',
      })
    );

    let ctx = atlas.getActiveInvestigationContext();
    expect(ctx).toBeDefined();
    expect(ctx?.intent.researchQuestion).toBe('What is the correlation between dim1 and dim2?');
    expect(ctx?.intent.variablesOfInterest).toEqual(['dim1', 'dim2']);
    expect(ctx?.intent.currentTask).toBe('correlation_analysis');

    // 2. Hypothesise
    await executor.execute(
      nilCmd(1, 'HYPOTHESISE', {
        hypothesis: 'dim1 and dim2 exhibit strong positive collinearity.',
      })
    );

    ctx = atlas.getActiveInvestigationContext();
    expect(ctx?.intent.researchQuestion).toBe('What is the correlation between dim1 and dim2?');
    expect(ctx?.intent.hypothesis).toBe('dim1 and dim2 exhibit strong positive collinearity.');

    // Assert dataset fingerprint remains bitwise invariant
    expect(atlas.datasetFingerprint).toBe(fpBefore);
  });

  test('falsifier 6: fail-closed refusal on invalid candidate identifiers or missing parameters without consuming sequence', async () => {
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
    atlas.loadDataset(makeMultiDimensionalDataset());
    const executor = new NilExecutor();

    bindAtlasNilHandlers(executor, atlas);
    atlas.arbitrateRepresentation();

    // 1. Missing candidateId on COMPARE
    await expect(executor.execute(nilCmd(0, 'COMPARE', {}))).rejects.toThrow(
      /NIL COMPARE requires non-empty parameter 'candidateId' or targetId/
    );
    expect(executor.expectedSequence('investigation-fm2')).toBe(0);

    // 2. Missing candidateId on PREFER
    await expect(executor.execute(nilCmd(0, 'PREFER', {}))).rejects.toThrow(
      /NIL PREFER requires non-empty parameter 'candidateId' or targetId/
    );
    expect(executor.expectedSequence('investigation-fm2')).toBe(0);

    // 3. Non-existent candidateId on PREFER
    await expect(
      executor.execute(nilCmd(0, 'PREFER', { candidateId: 'NON_EXISTENT_ID' }))
    ).rejects.toThrow(/Alternative candidate "NON_EXISTENT_ID"/);
    expect(executor.expectedSequence('investigation-fm2')).toBe(0);

    // 4. Empty question on QUESTION
    await expect(
      executor.execute(nilCmd(0, 'QUESTION', { question: '   ' }))
    ).rejects.toThrow(/NIL QUESTION requires non-empty string parameter 'question'/);
    expect(executor.expectedSequence('investigation-fm2')).toBe(0);
  });

  test('falsifier 7: replay of complete command stream produces identical investigation graph, alternative branches, and bitwise digest', async () => {
    const fixedSessionId = 'deterministic-fm2-replay-session';
    const fixedTime = 1700000000000;

    // 1. Execute live command sequence on instance A
    const atlasA = new AtlasCore({
      kernel: makeKernelMockBridge(),
      sessionId: fixedSessionId,
      researchContext: { now: () => fixedTime },
    });
    atlasA.loadDataset(makeMultiDimensionalDataset());
    const executorA = new NilExecutor();
    bindAtlasNilHandlers(executorA, atlasA);

    atlasA.arbitrateRepresentation();
    const eligibleAlt = atlasA.getRepresentationAlternatives().find(
      (a) => a.eligibility !== 'DISQUALIFIED' && a.eligibility !== 'ABSTAIN'
    )!;

    const stream: NilCommand[] = [
      nilCmd(0, 'OBSERVE', { notes: 'Centroid separation observed in primary view' }),
      nilCmd(1, 'QUESTION', {
        question: 'Are clusters separable in dimension 1 and 2?',
        variables: ['dim1', 'dim2'],
      }),
      nilCmd(2, 'HYPOTHESISE', {
        hypothesis: 'Alternative projection separates clusters better.',
      }),
      nilCmd(3, 'COMPARE', { candidateId: eligibleAlt.candidateId }),
      nilCmd(4, 'PREFER', {
        candidateId: eligibleAlt.candidateId,
        researchQuestion: 'Branched cluster verification',
      }),
      nilCmd(5, 'EXPLAIN', { preference: 'BALANCED' }),
      nilCmd(6, 'REJECT', {
        candidateId: 'UNWANTED_ALT_CANDIDATE',
        rationale: 'Sub-optimal spatial resolution',
      }),
    ];

    for (const cmd of stream) {
      await executorA.execute(cmd);
    }

    const stateA = atlasA.toState();
    const digestA = await atlasA.computeDigest();
    const activeContextA = atlasA.getActiveInvestigationContext();

    // 2. Replay the identical stream on fresh instance B
    const atlasB = new AtlasCore({
      kernel: makeKernelMockBridge(),
      sessionId: fixedSessionId,
      researchContext: { now: () => fixedTime },
    });
    atlasB.loadDataset(makeMultiDimensionalDataset());
    atlasB.arbitrateRepresentation(); // prepare initial candidate set
    const executorB = new NilExecutor();
    bindAtlasNilHandlers(executorB, atlasB);

    await executorB.replay(stream);

    const stateB = atlasB.toState();
    const digestB = await atlasB.computeDigest();
    const activeContextB = atlasB.getActiveInvestigationContext();

    // Assert full structural isomorphism between live execution and replay
    expect(stateB.investigationGraph?.nodes.length).toBe(stateA.investigationGraph?.nodes.length);
    expect(stateB.investigationGraph?.edges.length).toBe(stateA.investigationGraph?.edges.length);
    expect(stateB.investigationGraph?.activeNodeId).toBe(stateA.investigationGraph?.activeNodeId);
    expect(activeContextB?.intent.researchQuestion).toBe(activeContextA?.intent.researchQuestion);
    expect(atlasB.getEmbodimentCritiques().length).toBe(atlasA.getEmbodimentCritiques().length);
    expect(digestB).toBe(digestA);
  });
});
