import { describe, expect, it, vi } from 'vitest';

import {
  ResourceLifecycleGovernor,
  resourceIdentityKey,
  type LifecycleStepResult,
  type ResourceIdentity,
  type ResourceLifecycleAdapter,
  type ResourceLifecyclePolicy,
  type ResourceRegistration,
  type WorkingSetDeclaration,
} from '../src/vr/scalability/ResourceLifecycleGovernor';

const policy: ResourceLifecyclePolicy = {
  policyVersion: 'test/v1',
  maxDeclarations: 1,
  maxActiveResources: 1,
  maxWarmResources: 1,
  maxColdDescriptors: 0,
  maxCleanupOperationsPerTick: 1,
  maxTransitionEvents: 8,
};

type TestDescriptor = { schemaVersion: 'test/v1'; id: string };
type TestRuntime = { id: string };

function identity(semanticId: string, overrides: Partial<ResourceIdentity> = {}): ResourceIdentity {
  return {
    family: 'TEST',
    datasetFingerprint: 'fp',
    datasetGeneration: 1,
    datasetVersion: 1,
    decisionId: 'decision',
    semanticId,
    ...overrides,
  };
}

function declaration(
  semanticId: string,
  desired: WorkingSetDeclaration['desired'] = 'ACTIVE'
): WorkingSetDeclaration {
  return {
    identity: identity(semanticId),
    desired,
    priority: desired === 'ACTIVE' ? 'FOCUS' : 'CONTEXT',
  };
}

function fakeRegistration(
  resourceIdentity: ResourceIdentity,
  overrides: Partial<ResourceLifecycleAdapter<TestRuntime, TestDescriptor>> = {}
): ResourceRegistration<TestRuntime, TestDescriptor> {
  return {
    identity: resourceIdentity,
    runtime: { id: resourceIdentity.semanticId },
    adapter: {
      family: 'TEST',
      validateDescriptor: (value): value is TestDescriptor =>
        typeof value === 'object' &&
        value !== null &&
        (value as TestDescriptor).schemaVersion === 'test/v1' &&
        typeof (value as TestDescriptor).id === 'string',
      detach: vi.fn(),
      coolStep: vi.fn(() => ({
        status: 'COMPLETE' as const,
        descriptor: { schemaVersion: 'test/v1' as const, id: resourceIdentity.semanticId },
      })),
      forceDispose: vi.fn(),
      ...overrides,
    },
  };
}

describe('ResourceLifecycleGovernor', () => {
  it('separates identities using every durable identity field', () => {
    const base = identity('resource');
    const variants: ResourceIdentity[] = [
      identity('resource', { family: 'OTHER' }),
      identity('resource', { datasetFingerprint: 'other-fp' }),
      identity('resource', { datasetGeneration: 2 }),
      identity('resource', { datasetVersion: 2 }),
      identity('resource', { decisionId: 'other-decision' }),
      identity('other-resource'),
    ];

    expect(new Set([resourceIdentityKey(base), ...variants.map(resourceIdentityKey)]).size).toBe(
      variants.length + 1
    );
    expect(resourceIdentityKey(identity('a|b'))).not.toBe(resourceIdentityKey(identity('a%7Cb')));
  });

  it('keeps nullable and primitive identity domains distinct', () => {
    expect(resourceIdentityKey(identity('resource', { datasetFingerprint: null }))).not.toBe(
      resourceIdentityKey(identity('resource', { datasetFingerprint: '' }))
    );
    expect(resourceIdentityKey(identity('resource', { datasetGeneration: 1 }))).not.toBe(
      resourceIdentityKey(
        identity('resource', {
          datasetGeneration: '1' as unknown as ResourceIdentity['datasetGeneration'],
        })
      )
    );
  });

  it('refuses invalid complete declarations without mutating the prior safe state', () => {
    const governor = new ResourceLifecycleGovernor(policy);
    governor.register(fakeRegistration(identity('a')));
    expect(governor.reconcile([declaration('a')]).accepted).toBe(true);
    const before = governor.getSnapshot();

    const refused = [
      [declaration('a'), declaration('b')],
      [declaration('a'), declaration('a')],
      [declaration('a'), declaration('b', 'WARM')],
    ];

    for (const workingSet of refused) {
      expect(governor.validateWorkingSet(workingSet)).toEqual(
        expect.objectContaining({ accepted: false, reason: expect.any(String) })
      );
      expect(governor.reconcile(workingSet)).toEqual(
        expect.objectContaining({ accepted: false, reason: expect.any(String) })
      );
      expect(governor.getSnapshot()).toEqual(before);
    }
  });

  it('enforces ACTIVE and declared-WARM capacities independently', () => {
    const governor = new ResourceLifecycleGovernor({
      ...policy,
      maxDeclarations: 3,
      maxActiveResources: 1,
      maxWarmResources: 1,
    });

    expect(governor.validateWorkingSet([declaration('a'), declaration('b')])).toEqual(
      expect.objectContaining({ accepted: false })
    );
    expect(
      governor.validateWorkingSet([declaration('a', 'WARM'), declaration('b', 'WARM')])
    ).toEqual(expect.objectContaining({ accepted: false }));
  });

  it('refuses reconcile-level ACTIVE and declared-WARM overflow without mutating state', () => {
    const governor = new ResourceLifecycleGovernor({
      ...policy,
      maxDeclarations: 3,
      maxActiveResources: 1,
      maxWarmResources: 1,
    });
    governor.register(fakeRegistration(identity('a')));
    governor.register(fakeRegistration(identity('b')));
    expect(governor.reconcile([declaration('a')]).accepted).toBe(true);
    const before = governor.getSnapshot();

    expect(governor.reconcile([declaration('a'), declaration('b')])).toEqual(
      expect.objectContaining({ accepted: false, reason: expect.any(String) })
    );
    expect(governor.getSnapshot()).toEqual(before);

    expect(governor.reconcile([declaration('a', 'WARM'), declaration('b', 'WARM')])).toEqual(
      expect.objectContaining({ accepted: false, reason: expect.any(String) })
    );
    expect(governor.getSnapshot()).toEqual(before);
  });

  it('accepts an unregistered preflight candidate but rejects mutating reconciliation', () => {
    const governor = new ResourceLifecycleGovernor(policy);
    const candidate = declaration('candidate');
    const before = governor.getSnapshot();

    expect(governor.validateWorkingSet([candidate])).toEqual({ accepted: true });
    expect(governor.reconcile([candidate])).toEqual(
      expect.objectContaining({ accepted: false, reason: expect.any(String) })
    );
    expect(governor.getSnapshot()).toEqual(before);
  });

  it('protects declared ACTIVE authority and detaches only after it leaves the working set', () => {
    const registration = fakeRegistration(identity('a'));
    const governor = new ResourceLifecycleGovernor(policy);
    governor.register(registration);

    expect(governor.reconcile([declaration('a')]).accepted).toBe(true);
    expect(governor.getSnapshot().counts).toEqual({
      ACTIVE: 1,
      WARM: 0,
      COLD: 0,
      EVICTED: 0,
    });
    expect(registration.adapter.detach).not.toHaveBeenCalled();

    expect(governor.reconcile([declaration('a')]).accepted).toBe(true);
    expect(registration.adapter.detach).not.toHaveBeenCalled();

    expect(governor.reconcile([]).accepted).toBe(true);
    expect(registration.adapter.detach).toHaveBeenCalledTimes(1);
    expect(governor.getSnapshot().counts).toEqual({
      ACTIVE: 0,
      WARM: 1,
      COLD: 0,
      EVICTED: 0,
    });
  });

  it('preserves governor state when a required detach throws', () => {
    const roomyPolicy = {
      ...policy,
      maxDeclarations: 2,
      maxActiveResources: 2,
      maxWarmResources: 2,
    };
    const first = fakeRegistration(identity('a'));
    const second = fakeRegistration(identity('b'), {
      detach: vi.fn(() => {
        throw new Error('detach failed');
      }),
    });
    const governor = new ResourceLifecycleGovernor(roomyPolicy);
    governor.register(first);
    governor.register(second);
    expect(governor.reconcile([declaration('a'), declaration('b')]).accepted).toBe(true);
    const before = governor.getSnapshot();

    expect(governor.reconcile([])).toEqual({ accepted: false, reason: 'detach failed' });
    expect(first.adapter.detach).toHaveBeenCalledTimes(1);
    expect(second.adapter.detach).toHaveBeenCalledTimes(1);
    expect(governor.getSnapshot()).toEqual(before);
  });

  it('keeps snapshot counts deterministic regardless of registration order', () => {
    const roomyPolicy = {
      ...policy,
      maxDeclarations: 2,
      maxActiveResources: 2,
      maxWarmResources: 2,
    };
    const forward = new ResourceLifecycleGovernor(roomyPolicy);
    const reverse = new ResourceLifecycleGovernor(roomyPolicy);

    forward.register(fakeRegistration(identity('a')));
    forward.register(fakeRegistration(identity('b')));
    reverse.register(fakeRegistration(identity('b')));
    reverse.register(fakeRegistration(identity('a')));

    expect(forward.reconcile([declaration('a'), declaration('b', 'WARM')]).accepted).toBe(true);
    expect(reverse.reconcile([declaration('b', 'WARM'), declaration('a')]).accepted).toBe(true);
    expect(forward.getSnapshot()).toEqual(reverse.getSnapshot());
  });

  it('rejects a registration whose adapter family does not own the identity', () => {
    const governor = new ResourceLifecycleGovernor(policy);
    const registration = fakeRegistration(identity('a'));
    registration.adapter.family = 'OTHER';

    expect(() => governor.register(registration)).toThrow(/family/i);
    expect(governor.getSnapshot().counts.WARM).toBe(0);
  });

  it('discards only an unclaimed WARM candidate and force-disposes its runtime exactly once', () => {
    const governor = new ResourceLifecycleGovernor(policy);
    const registration = fakeRegistration(identity('candidate'));
    governor.register(registration);

    expect(governor.discardUnclaimedWarm(identity('candidate'))).toEqual({ accepted: true });
    expect(registration.adapter.forceDispose).toHaveBeenCalledTimes(1);
    expect(registration.adapter.forceDispose).toHaveBeenCalledWith(registration.runtime);
    expect(governor.getSnapshot().counts).toEqual({
      ACTIVE: 0,
      WARM: 0,
      COLD: 0,
      EVICTED: 0,
    });
    expect(() => governor.register(fakeRegistration(identity('candidate')))).not.toThrow();
  });

  it('refuses discard for ACTIVE or declared records and preserves duplicate registration rules', () => {
    const activeGovernor = new ResourceLifecycleGovernor(policy);
    const activeRegistration = fakeRegistration(identity('active'));
    activeGovernor.register(activeRegistration);
    expect(activeGovernor.reconcile([declaration('active')])).toEqual({ accepted: true });

    expect(activeGovernor.discardUnclaimedWarm(identity('active'))).toEqual(
      expect.objectContaining({ accepted: false, reason: expect.any(String) })
    );
    expect(activeRegistration.adapter.forceDispose).not.toHaveBeenCalled();
    expect(activeGovernor.getSnapshot().counts.ACTIVE).toBe(1);
    expect(() => activeGovernor.register(fakeRegistration(identity('active')))).toThrow(
      /already registered/i
    );

    const declaredWarmGovernor = new ResourceLifecycleGovernor(policy);
    const declaredWarmRegistration = fakeRegistration(identity('declared-warm'));
    declaredWarmGovernor.register(declaredWarmRegistration);
    expect(declaredWarmGovernor.reconcile([declaration('declared-warm', 'WARM')])).toEqual({
      accepted: true,
    });

    expect(declaredWarmGovernor.discardUnclaimedWarm(identity('declared-warm'))).toEqual(
      expect.objectContaining({ accepted: false, reason: expect.any(String) })
    );
    expect(declaredWarmRegistration.adapter.forceDispose).not.toHaveBeenCalled();
    expect(declaredWarmGovernor.getSnapshot().counts.WARM).toBe(1);
  });

  it('starts no more than the cleanup budget per tick and does not restart in-flight work', () => {
    const started: string[] = [];
    const governor = new ResourceLifecycleGovernor({
      ...policy,
      maxDeclarations: 20,
      maxActiveResources: 20,
      maxWarmResources: 0,
      maxCleanupOperationsPerTick: 3,
    });

    for (let index = 0; index < 20; index += 1) {
      const resourceIdentity = identity(`resource-${index}`);
      governor.register(
        fakeRegistration(resourceIdentity, {
          coolStep: vi.fn(
            (runtime) =>
              new Promise<LifecycleStepResult<TestDescriptor>>(() => {
                started.push(runtime.id);
              })
          ),
        })
      );
    }

    governor.tick();
    expect(started).toHaveLength(3);
    expect(new Set(started).size).toBe(3);
    expect(governor.getSnapshot().queuedCleanupCount).toBe(17);

    governor.tick();
    expect(started).toHaveLength(6);
    expect(new Set(started).size).toBe(6);
    expect(governor.getSnapshot().queuedCleanupCount).toBe(14);
  });

  it('ignores a delayed cool completion after the existing record revision advances', async () => {
    let resolveDeferred!: (value: LifecycleStepResult<TestDescriptor>) => void;
    const deferred = new Promise<LifecycleStepResult<TestDescriptor>>((resolve) => {
      resolveDeferred = resolve;
    });
    const governor = new ResourceLifecycleGovernor({ ...policy, maxWarmResources: 0 });
    governor.register(fakeRegistration(identity('a'), { coolStep: () => deferred }));
    expect(governor.reconcile([declaration('a')]).accepted).toBe(true);
    expect(governor.reconcile([]).accepted).toBe(true);
    governor.tick();

    // Advance the same registered record's authority revision; duplicate registration remains
    // forbidden by the Task 1 identity contract.
    expect(governor.reconcile([declaration('a')]).accepted).toBe(true);
    resolveDeferred({
      status: 'COMPLETE',
      descriptor: { schemaVersion: 'test/v1', id: 'stale' },
    });
    await Promise.resolve();
    await Promise.resolve();

    const snapshot = governor.getSnapshot();
    expect(snapshot.counts).toEqual({ ACTIVE: 1, WARM: 0, COLD: 0, EVICTED: 0 });
    expect(snapshot.cumulative.cooled).toBe(0);
    const successfulRevisions = snapshot.transitions
      .filter((transition) => transition.outcome === 'SUCCEEDED')
      .map((transition) => transition.revision);
    expect(successfulRevisions).toEqual([...successfulRevisions].sort((a, b) => a - b));
    expect(new Set(successfulRevisions).size).toBe(successfulRevisions.length);
  });

  it('cools validated runtimes and evicts the oldest excess cold descriptor immediately', () => {
    const validateA = vi.fn((value: unknown) =>
      Boolean(value && (value as TestDescriptor).id === 'a')
    );
    const validateB = vi.fn((value: unknown) =>
      Boolean(value && (value as TestDescriptor).id === 'b')
    );
    const governor = new ResourceLifecycleGovernor({
      ...policy,
      maxDeclarations: 2,
      maxActiveResources: 2,
      maxWarmResources: 0,
      maxColdDescriptors: 1,
      maxCleanupOperationsPerTick: 2,
    });
    governor.register(
      fakeRegistration(identity('a'), {
        validateDescriptor: (value): value is TestDescriptor => validateA(value),
      })
    );
    governor.register(
      fakeRegistration(identity('b'), {
        validateDescriptor: (value): value is TestDescriptor => validateB(value),
      })
    );

    governor.tick();

    const snapshot = governor.getSnapshot();
    expect(validateA).toHaveBeenCalledTimes(1);
    expect(validateB).toHaveBeenCalledTimes(1);
    expect(snapshot.counts).toEqual({ ACTIVE: 0, WARM: 0, COLD: 1, EVICTED: 0 });
    expect(snapshot.cumulative).toEqual({ cooled: 2, evicted: 1, reconstructed: 0, failed: 0 });
    expect(snapshot.transitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          identity: identity('a'),
          from: 'WARM',
          to: 'COLD',
          outcome: 'SUCCEEDED',
        }),
        expect.objectContaining({
          identity: identity('a'),
          from: 'COLD',
          to: 'EVICTED',
          outcome: 'SUCCEEDED',
        }),
      ])
    );
    expect(() => governor.register(fakeRegistration(identity('a')))).not.toThrow();
  });

  it('keeps a resource warm and reports bounded failure telemetry for an invalid descriptor', () => {
    const governor = new ResourceLifecycleGovernor({
      ...policy,
      maxWarmResources: 0,
      maxTransitionEvents: 1,
    });
    const forceDispose = vi.fn();
    const rejectDescriptor = vi.fn((_value: unknown) => false);
    governor.register(
      fakeRegistration(identity('a'), {
        validateDescriptor: (value): value is TestDescriptor => rejectDescriptor(value),
        forceDispose,
      })
    );

    governor.tick();

    const snapshot = governor.getSnapshot();
    expect(snapshot.counts).toEqual({ ACTIVE: 0, WARM: 1, COLD: 0, EVICTED: 0 });
    expect(snapshot.queuedCleanupCount).toBe(1);
    expect(snapshot.cumulative).toEqual({ cooled: 0, evicted: 0, reconstructed: 0, failed: 1 });
    expect(snapshot.transitions).toHaveLength(1);
    expect(snapshot.transitions[0]).toEqual(
      expect.objectContaining({
        identity: identity('a'),
        from: 'WARM',
        to: 'WARM',
        outcome: 'FAILED',
        reason: expect.stringMatching(/descriptor/i),
      })
    );
    expect(forceDispose).not.toHaveBeenCalled();
  });

  it('caps the transition ring and reports live counts separately from terminal telemetry', () => {
    const governor = new ResourceLifecycleGovernor({
      ...policy,
      maxWarmResources: 0,
      maxColdDescriptors: 0,
      maxTransitionEvents: 2,
    });
    governor.register(fakeRegistration(identity('a')));
    expect(governor.reconcile([declaration('a')]).accepted).toBe(true);
    expect(governor.reconcile([]).accepted).toBe(true);
    governor.tick();

    const snapshot = governor.getSnapshot();
    expect(snapshot).toEqual(
      expect.objectContaining({
        policyVersion: 'test/v1',
        declaredWorkingSetSize: 0,
        counts: { ACTIVE: 0, WARM: 0, COLD: 0, EVICTED: 0 },
        queuedCleanupCount: 0,
        cumulative: { cooled: 1, evicted: 1, reconstructed: 0, failed: 0 },
      })
    );
    expect(snapshot.transitions).toHaveLength(2);
    expect(snapshot.transitions.map(({ from, to }) => `${from}->${to}`)).toEqual([
      'WARM->COLD',
      'COLD->EVICTED',
    ]);
  });

  it('force-disposes every remaining live runtime once and permanently closes registration', async () => {
    let finishAsyncDispose!: () => void;
    const asyncDispose = new Promise<void>((resolve) => {
      finishAsyncDispose = resolve;
    });
    const forceDisposeA = vi.fn(() => asyncDispose);
    const forceDisposeB = vi.fn();
    const governor = new ResourceLifecycleGovernor({
      ...policy,
      maxDeclarations: 2,
      maxActiveResources: 2,
      maxWarmResources: 2,
    });
    governor.register(fakeRegistration(identity('a'), { forceDispose: forceDisposeA }));
    governor.register(fakeRegistration(identity('b'), { forceDispose: forceDisposeB }));

    const firstDispose = governor.dispose();
    const secondDispose = governor.dispose();
    expect(forceDisposeA).toHaveBeenCalledTimes(1);
    expect(forceDisposeB).toHaveBeenCalledTimes(1);
    expect(governor.getSnapshot().counts).toEqual({
      ACTIVE: 0,
      WARM: 0,
      COLD: 0,
      EVICTED: 0,
    });
    expect(governor.getSnapshot().queuedCleanupCount).toBe(0);
    expect(() => governor.register(fakeRegistration(identity('c')))).toThrow(/disposed/i);

    let settled = false;
    firstDispose.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    finishAsyncDispose();
    await expect(firstDispose).resolves.toBeUndefined();
    await expect(secondDispose).resolves.toBeUndefined();
    expect(forceDisposeA).toHaveBeenCalledTimes(1);
    expect(forceDisposeB).toHaveBeenCalledTimes(1);
  });

  it('ignores a cool completion that settles after disposal', async () => {
    let resolveDeferred!: (value: LifecycleStepResult<TestDescriptor>) => void;
    const deferred = new Promise<LifecycleStepResult<TestDescriptor>>((resolve) => {
      resolveDeferred = resolve;
    });
    const validateDescriptor = vi.fn((_value: unknown) => true);
    const forceDispose = vi.fn();
    const governor = new ResourceLifecycleGovernor({ ...policy, maxWarmResources: 0 });
    const registration = fakeRegistration(identity('a'), {
      coolStep: () => deferred,
      validateDescriptor: (value): value is TestDescriptor => validateDescriptor(value),
      forceDispose,
    });
    governor.register(registration);
    governor.tick();

    await expect(governor.dispose()).resolves.toBeUndefined();
    const disposedSnapshot = governor.getSnapshot();
    expect(forceDispose).toHaveBeenCalledTimes(1);
    expect(forceDispose).toHaveBeenCalledWith(registration.runtime);

    resolveDeferred({
      status: 'COMPLETE',
      descriptor: { schemaVersion: 'test/v1', id: 'late' },
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(validateDescriptor).not.toHaveBeenCalled();
    expect(forceDispose).toHaveBeenCalledTimes(1);
    expect(governor.getSnapshot()).toEqual(disposedSnapshot);
  });
});
