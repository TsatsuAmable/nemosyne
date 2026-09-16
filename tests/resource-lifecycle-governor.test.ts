import { describe, expect, it, vi } from 'vitest';

import {
  ResourceLifecycleGovernor,
  resourceIdentityKey,
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
});
