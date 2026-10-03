import { describe, test, expect } from 'vitest';
import {
  canonicalizeInvestigationPerspective,
  computePerspectiveIdentity,
  INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
} from '../src/atlas/domain/InvestigationPerspective.ts';
import {
  canonicalizeCommittedInvestigationContext,
  checkContextCompatibility,
  computeCommittedContextIdentity,
  CommittedInvestigationContextLedger,
  CONTEXT_INCOMPATIBLE,
  COMMITTED_INVESTIGATION_CONTEXT_SCHEMA_V1,
  COMMITTED_INVESTIGATION_CONTEXT_SCHEMA_V2,
  type EpistemicPurpose,
} from '../src/atlas/domain/CommittedInvestigationContext.ts';
import { InvestigationGraph } from '../src/atlas/domain/InvestigationGraph.ts';
import type { InvestigationIntentV1 } from '../src/atlas/domain/InvestigationIntent.ts';

function intentOf(variables: string[]): InvestigationIntentV1 {
  return {
    schemaVersion: 1,
    researchQuestion: 'Does X drive Y?',
    variablesOfInterest: variables,
  };
}

function contextOf(
  nodeId: string,
  variables: string[],
  temporal?: 'recency' | 'historical',
  epistemicPurpose?: EpistemicPurpose
) {
  return {
    schemaVersion: COMMITTED_INVESTIGATION_CONTEXT_SCHEMA_V2,
    nodeId,
    epistemicPurpose,
    intent: intentOf(variables),
    ...(temporal === undefined
      ? {}
      : {
          perspective: {
            schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
            mode: 'foreground',
            temporalForegrounding: temporal,
          },
        }),
  };
}

describe('InvestigationPerspective V1', () => {
  test('A27-0: a view-only perspective leaves snapshot identity unchanged', () => {
    const recency = computePerspectiveIdentity({
      schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
      mode: 'foreground',
      temporalForegrounding: 'recency',
    });

    expect(
      Object.keys(
        canonicalizeInvestigationPerspective({
          schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
          mode: 'foreground',
          temporalForegrounding: 'recency',
        })
      ).sort()
    ).toEqual(['mode', 'schemaVersion', 'temporalForegrounding']);

    const a = canonicalizeCommittedInvestigationContext(contextOf('n1', ['x', 'y']));
    const b = canonicalizeCommittedInvestigationContext(contextOf('n1', ['x', 'y'], 'recency'));
    expect(b.intent).toEqual(a.intent);

    expect(recency).toMatch(/^sha256-perspective-v1-[0-9a-f]{64}$/);
  });

  test('A27-0: filters require analytical derivation, so narrowing fields refuse', () => {
    for (const field of ['filter', 'threshold', 'limit', 'topN', 'quantile', 'timeRange']) {
      expect(() =>
        canonicalizeInvestigationPerspective({
          schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
          mode: 'foreground',
          [field]: 'anything',
        })
      ).toThrow(/narrow the analysed population/);
    }
  });

  test('unknown fields refuse closed', () => {
    expect(() =>
      canonicalizeInvestigationPerspective({
        schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
        mode: 'foreground',
        notAViewField: 1,
      })
    ).toThrow(/Unsupported InvestigationPerspective field/);
  });

  test('non-enum foregrounding refuses rather than degrading', () => {
    expect(() =>
      canonicalizeInvestigationPerspective({
        schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
        mode: 'foreground',
        temporalForegrounding: 'newest-ten',
      })
    ).toThrow(/must be one of/);
  });

  test('absent optional foregrounding stays absent rather than becoming a default', () => {
    const canonical = canonicalizeInvestigationPerspective({
      schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
      mode: 'foreground',
    });
    expect(Object.keys(canonical).sort()).toEqual(['mode', 'schemaVersion']);
    expect('temporalForegrounding' in canonical).toBe(false);
    expect('uncertaintyForegrounding' in canonical).toBe(false);
    expect(computePerspectiveIdentity(canonical)).toMatch(/^sha256-perspective-v1-/);
  });

  test('wrong schema version refuses', () => {
    expect(() => canonicalizeInvestigationPerspective({ schemaVersion: 2 })).toThrow(
      /Unsupported InvestigationPerspective schema version/
    );
  });
});

describe('CommittedInvestigationContext V2 (A27-1 / RFC 0011)', () => {
  test('identity is content-addressed V2, so revisit restores the exact value', () => {
    const first = contextOf('n1', ['a', 'b']);
    const recomputed = contextOf('n1', ['a', 'b']);

    expect(computeCommittedContextIdentity(first)).toBe(computeCommittedContextIdentity(recomputed));
    expect(computeCommittedContextIdentity(first)).toMatch(/^sha256-committed-context-v2-/);
  });

  test('changing epistemicPurpose changes context identity and revokes pending adoption', () => {
    const claimBearing = contextOf('n1', ['a'], undefined, 'CLAIM_BEARING');
    const exploratory = contextOf('n1', ['a'], undefined, 'EXPLORATORY_ABDUCTION');

    const idClaim = computeCommittedContextIdentity(claimBearing);
    const idExploratory = computeCommittedContextIdentity(exploratory);

    expect(idClaim).not.toBe(idExploratory);
  });

  test('invalid epistemicPurpose refuses closed', () => {
    expect(() =>
      canonicalizeCommittedInvestigationContext({
        ...contextOf('n1', ['a']),
        epistemicPurpose: 'INVALID_PURPOSE',
      })
    ).toThrow(/epistemicPurpose must be one of/);
  });

  test('V1 context upgrade defaults to CLAIM_BEARING for backward compatibility', () => {
    const v1Context = {
      schemaVersion: COMMITTED_INVESTIGATION_CONTEXT_SCHEMA_V1,
      nodeId: 'n1',
      intent: intentOf(['a']),
    };

    const canonical = canonicalizeCommittedInvestigationContext(v1Context);
    expect(canonical.schemaVersion).toBe(2);
    expect(canonical.epistemicPurpose).toBe('CLAIM_BEARING');
  });

  test('studyId and observerMode are not scientific input and are refused', () => {
    expect(() =>
      canonicalizeCommittedInvestigationContext({
        ...contextOf('n1', ['a']),
        studyId: 'study-1',
      })
    ).toThrow(/Unsupported CommittedInvestigationContext field: studyId/);

    expect(() =>
      canonicalizeCommittedInvestigationContext({
        ...contextOf('n1', ['a']),
        observerMode: 'explore',
      })
    ).toThrow(/Unsupported CommittedInvestigationContext field: observerMode/);
  });
});

describe('CommittedInvestigationContextLedger', () => {
  test('A27-0 & A27-1: draft/commit/branch/revisit preserve node IDs and DAG edges', () => {
    const graph = new InvestigationGraph();
    const ledger = new CommittedInvestigationContextLedger();

    graph.addNode({ id: 'n1', parentId: null, datasetVersion: 1, datasetFingerprint: 'fp', label: 'root', timestamp: 0 });
    const a = ledger.commit('n1', contextOf('n1', ['a']));
    expect(graph.activeNodeId).toBe('n1');

    graph.addNode({ id: 'n2', parentId: 'n1', datasetVersion: 1, datasetFingerprint: 'fp', label: 'branch', timestamp: 1 });
    graph.connect('n2', 'n1', 'branches_from');
    const b = ledger.commit('n2', contextOf('n2', ['a', 'c']));

    expect(b.revision).toBeGreaterThan(a.revision);
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(['n1', 'n2']);
    expect(graph.getEdges().map((e) => e.relationship)).toContain('branches_from');

    ledger.activate('n1');
    expect(ledger.getCommitted('n1')).toEqual(canonicalizeCommittedInvestigationContext(contextOf('n1', ['a'])));
  });

  test('F05: stale asynchronous adoption refuses with CONTEXT_INCOMPATIBLE before mutation', () => {
    const ledger = new CommittedInvestigationContextLedger();
    ledger.commit('n1', contextOf('n1', ['a']));

    const captured = ledger.currentBinding()!;
    ledger.commit('n2', contextOf('n2', ['b']));

    const revisionBefore = ledger.revision;
    const epochBefore = ledger.activationEpoch;
    const verdict = checkContextCompatibility(captured, ledger.current());
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.code).toBe(CONTEXT_INCOMPATIBLE);
    }

    expect(ledger.activeNodeId).toBe('n2');
    expect(ledger.revision).toBe(revisionBefore);
    expect(ledger.activationEpoch).toBe(epochBefore);

    const fresh = ledger.currentBinding()!;
    expect(checkContextCompatibility(fresh, ledger.current()).ok).toBe(true);
  });
});
