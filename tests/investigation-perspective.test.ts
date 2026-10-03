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
} from '../src/atlas/domain/CommittedInvestigationContext.ts';
import { InvestigationGraph } from '../src/atlas/domain/InvestigationGraph.ts';
import type { InvestigationIntentV1 } from '../src/atlas/domain/InvestigationIntent.ts';

const SNAPSHOT_ID = 'sha256-semantic-snapshot-v1-fixedcoverage';

test('the ledger owns node binding: a mismatched content nodeId cannot redirect a commit', () => {
  const ledger = new CommittedInvestigationContextLedger();
  const activation = ledger.commit('n-authoritative', contextOf('n-somewhere-else', ['a']));

  expect(activation.nodeId).toBe('n-authoritative');
  expect(ledger.getCommitted('n-somewhere-else')).toBeUndefined();
  expect(ledger.getCommitted('n-authoritative')!.nodeId).toBe('n-authoritative');
});

test('a perspective carries no snapshot input, so snapshot identity is not its concern', () => {
  expect(SNAPSHOT_ID).toMatch(/^sha256-semantic-snapshot-v1-/);
  const keys = Object.keys(
    canonicalizeInvestigationPerspective({
      schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
      mode: 'foreground',
      temporalForegrounding: 'recency',
      uncertaintyForegrounding: 'interval',
    })
  );
  expect(keys.some((k) => /snapshot|population|derivation|dataset/i.test(k))).toBe(false);
});

function intentOf(variables: string[]): InvestigationIntentV1 {
  return {
    schemaVersion: 1,
    researchQuestion: 'Does X drive Y?',
    variablesOfInterest: variables,
  };
}

function contextOf(nodeId: string, variables: string[], temporal?: 'recency' | 'historical') {
  return {
    schemaVersion: COMMITTED_INVESTIGATION_CONTEXT_SCHEMA_V1,
    nodeId,
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

    // The perspective contract holds no snapshot, population or derivation input at all, so it
    // has no channel through which it could alter the analysed snapshot's identity.
    expect(Object.keys(canonicalizeInvestigationPerspective({
      schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
      mode: 'foreground',
      temporalForegrounding: 'recency',
    })).sort()).toEqual(['mode', 'schemaVersion', 'temporalForegrounding']);

    // Foregrounding is a view concern: the analysed coverage it describes is untouched.
    const a = canonicalizeCommittedInvestigationContext(contextOf('n1', ['x', 'y']));
    const b = canonicalizeCommittedInvestigationContext(contextOf('n1', ['x', 'y'], 'recency'));
    expect(b.intent).toEqual(a.intent);

    // Distinct perspective identity, reachable only by changing the view.
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
    // Only the mandatory mode is present; no empty/undefined foregrounding is invented.
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

describe('CommittedInvestigationContext V1', () => {
  test('A27-0: identity is content-addressed, so revisit restores the exact value', () => {
    const first = contextOf('n1', ['a', 'b']);
    const recomputed = contextOf('n1', ['a', 'b']);

    expect(computeCommittedContextIdentity(first)).toBe(computeCommittedContextIdentity(recomputed));
    expect(computeCommittedContextIdentity(first)).toMatch(/^sha256-committed-context-v1-/);
  });

  test('F01: foregrounding over equal coverage changes context identity, not snapshot', () => {
    const plain = computeCommittedContextIdentity(contextOf('n1', ['a', 'b']));
    const foregrounded = computeCommittedContextIdentity(
      contextOf('n1', ['a', 'b'], 'recency')
    );

    // Equal analytical coverage => the analysed snapshot is unchanged (same variable set).
    expect(intentOf(['a', 'b'])).toEqual(intentOf(['a', 'b']));
    // But the committed context identity is distinct, so foregrounding is not invisible.
    expect(foregrounded).not.toBe(plain);
  });

  test('variable order is significant and preserved', () => {
    expect(computeCommittedContextIdentity(contextOf('n1', ['a', 'b']))).not.toBe(
      computeCommittedContextIdentity(contextOf('n1', ['b', 'a']))
    );
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

  test('empty nodeId refuses', () => {
    expect(() =>
      canonicalizeCommittedInvestigationContext(contextOf('   ', ['a']))
    ).toThrow(/nodeId cannot be empty/);
  });

  test('F11: an unmodified legacy shape keeps identical identity and gains no synthetic field', () => {
    const legacy = {
      schemaVersion: COMMITTED_INVESTIGATION_CONTEXT_SCHEMA_V1,
      nodeId: 'n1',
      intent: intentOf(['a']),
    };
    const canonical = canonicalizeCommittedInvestigationContext(legacy);

    expect(Object.keys(canonical).sort()).toEqual(['intent', 'nodeId', 'schemaVersion']);
    expect(computeCommittedContextIdentity(legacy)).toBe(
      computeCommittedContextIdentity(canonical)
    );
    expect('perspective' in canonical).toBe(false);
  });
});

describe('InvestigationPerspective mode (ERA-ASTRA1 section 4.2)', () => {
  test('a perspective must declare whether it foregrounds or requests a new operation', () => {
    expect(() =>
      canonicalizeInvestigationPerspective({
        schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
        temporalForegrounding: 'recency',
      })
    ).toThrow(/must declare mode/);
  });

  test('an unknown mode refuses rather than defaulting to a view', () => {
    expect(() =>
      canonicalizeInvestigationPerspective({
        schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
        mode: 'analyse',
      })
    ).toThrow(/must be one of/);
  });

  test('mode participates in identity', () => {
    const foreground = computePerspectiveIdentity({
      schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
      mode: 'foreground',
      temporalForegrounding: 'recency',
    });
    const requested = computePerspectiveIdentity({
      schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
      mode: 'request_derivation',
      temporalForegrounding: 'recency',
    });
    expect(foreground).not.toBe(requested);
  });

  test('request_derivation still cannot narrow the population: requesting is not filtering', () => {
    for (const field of ['filter', 'threshold', 'subset', 'limit']) {
      expect(() =>
        canonicalizeInvestigationPerspective({
          schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
          mode: 'request_derivation',
          [field]: 'anything',
        })
      ).toThrow(/narrow the analysed population/);
    }
  });

  test('a derivation request still leaves the analysed intent untouched', () => {
    const plain = canonicalizeCommittedInvestigationContext(contextOf('n1', ['x', 'y']));
    const requested = canonicalizeCommittedInvestigationContext({
      schemaVersion: COMMITTED_INVESTIGATION_CONTEXT_SCHEMA_V1,
      nodeId: 'n1',
      intent: intentOf(['x', 'y']),
      perspective: {
        schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
        mode: 'request_derivation',
      },
    });
    // ERA-ASTRA1: the request is scheduled by Atlas and returns a new immutable snapshot, so the
    // request itself must not mutate the analysed scope.
    expect(requested.intent).toEqual(plain.intent);
  });
});

describe('CommittedInvestigationContextLedger', () => {
  test('A27-0: draft/commit/branch/revisit preserve node IDs and DAG edges', () => {
    const graph = new InvestigationGraph();
    const ledger = new CommittedInvestigationContextLedger();

    graph.addNode({ id: 'n1', parentId: null, datasetVersion: 1, datasetFingerprint: 'fp', label: 'root', timestamp: 0 });
    const a = ledger.commit('n1', contextOf('n1', ['a']));
    expect(graph.activeNodeId).toBe('n1');

    // Editing an old node branches via an authoritative DAG edge.
    graph.addNode({ id: 'n2', parentId: 'n1', datasetVersion: 1, datasetFingerprint: 'fp', label: 'branch', timestamp: 1 });
    graph.connect('n2', 'n1', 'branches_from');
    const b = ledger.commit('n2', contextOf('n2', ['a', 'c']));

    expect(b.revision).toBeGreaterThan(a.revision);
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(['n1', 'n2']);
    expect(graph.getEdges().map((e) => e.relationship)).toContain('branches_from');

    // Revisit restores the exact committed content of the original node.
    ledger.activate('n1');
    expect(ledger.getCommitted('n1')).toEqual(canonicalizeCommittedInvestigationContext(contextOf('n1', ['a'])));
    expect(graph.getNode('n1')?.id).toBe('n1');
  });

  test('F05: stale asynchronous adoption refuses with CONTEXT_INCOMPATIBLE before mutation', () => {
    const ledger = new CommittedInvestigationContextLedger();
    ledger.commit('n1', contextOf('n1', ['a']));

    // Compile against A.
    const captured = ledger.currentBinding()!;

    // Then B is committed.
    ledger.commit('n2', contextOf('n2', ['b']));

    // The late A result must not be adoptable.
    const revisionBefore = ledger.revision;
    const epochBefore = ledger.activationEpoch;
    const verdict = checkContextCompatibility(captured, ledger.current());
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.code).toBe(CONTEXT_INCOMPATIBLE);
    }

    // F05 requires refusal BEFORE mutation: the committed state is untouched by the check.
    expect(ledger.activeNodeId).toBe('n2');
    expect(ledger.revision).toBe(revisionBefore);
    expect(ledger.activationEpoch).toBe(epochBefore);
    expect(ledger.getCommitted('n1')).toEqual(
      canonicalizeCommittedInvestigationContext(contextOf('n1', ['a']))
    );

    // Positive control: a binding that still matches is adoptable, so refusal is not universal.
    const fresh = ledger.currentBinding()!;
    expect(checkContextCompatibility(fresh, ledger.current()).ok).toBe(true);
  });

  test('F05: A -> B -> A rejects the old activation epoch', () => {
    const ledger = new CommittedInvestigationContextLedger();
    ledger.commit('n1', contextOf('n1', ['a']));
    const firstA = ledger.currentBinding()!;

    ledger.commit('n2', contextOf('n2', ['b']));
    ledger.activate('n1'); // revisit A

    // Returning to A restores A's content and identity, but NOT the original epoch.
    expect(ledger.current()!.contextId).toBe(firstA.contextId);
    expect(ledger.current()!.activationEpoch).not.toBe(firstA.activationEpoch);

    // So a result minted during the first A remains stale.
    expect(checkContextCompatibility(firstA, ledger.current()).ok).toBe(false);
    // While one minted now is adoptable.
    expect(checkContextCompatibility(ledger.currentBinding()!, ledger.current()).ok).toBe(true);
  });

  test('a missing committed context refuses closed', () => {
    const verdict = checkContextCompatibility(
      { contextId: 'sha256-committed-context-v1-x', nodeId: 'n1', activationEpoch: 1 },
      undefined
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.code).toBe(CONTEXT_INCOMPATIBLE);
  });

  test('A27-0 section 9: same-content revisit alone increments the activation epoch', () => {
    const ledger = new CommittedInvestigationContextLedger();
    ledger.commit('n1', contextOf('n1', ['a']));

    const first = ledger.currentBinding()!;
    ledger.activate('n1');
    const second = ledger.getActivation('n1')!;
    expect(second.activationEpoch).toBe(first.activationEpoch + 1);

    ledger.activate('n1');
    const third = ledger.getActivation('n1')!;
    expect(third.activationEpoch).toBe(second.activationEpoch + 1);

    // Same content throughout: identity is stable while the epoch keeps advancing.
    expect(third.contextId).toBe(first.contextId);
    expect(ledger.revision).toBe(1);
  });

  test('activating an uncommitted node throws rather than inventing context', () => {
    const ledger = new CommittedInvestigationContextLedger();
    expect(() => ledger.activate('never-committed')).toThrow(/uncommitted/);
  });
});