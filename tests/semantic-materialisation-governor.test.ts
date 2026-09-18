import { describe, expect, it, vi } from 'vitest';
import {
  SemanticMaterialisationGovernor,
  semanticIdentityKey,
  type SemanticMaterialisationIdentity,
} from '../src/vr/scalability/SemanticMaterialisationGovernor.ts';

const identity = (semanticId: string): SemanticMaterialisationIdentity => ({
  datasetFingerprint: 'dataset-fp',
  datasetGeneration: 1,
  datasetVersion: 1,
  decisionId: 'decision-1',
  semanticId,
});

const policy = {
  policyVersion: 'test/v1',
  maxResident: 2,
  maxQueued: 2,
  maxMaterialisationsPerTick: 1,
} as const;

describe('SemanticMaterialisationGovernor', () => {
  it('keeps nullable and string decision identities in separate key domains', () => {
    expect(semanticIdentityKey({ ...identity('a'), decisionId: null })).not.toBe(
      semanticIdentityKey({ ...identity('a'), decisionId: 'null' })
    );
  });

  it('applies materialisation backpressure without silently dropping focus', () => {
    const governor = new SemanticMaterialisationGovernor<string>(policy);
    expect(governor.request({ identity: identity('a'), level: 'COARSE' }, () => 'a').accepted).toBe(
      true
    );
    expect(governor.request({ identity: identity('b'), level: 'COARSE' }, () => 'b').accepted).toBe(
      true
    );
    expect(governor.request({ identity: identity('c'), level: 'COARSE' }, () => 'c')).toEqual({
      accepted: false,
      reason: 'SEMANTIC_BACKPRESSURE_QUEUE_FULL',
    });
    expect(governor.snapshot()).toMatchObject({ queued: 2, resident: 0, refused: 1 });
  });

  it('materialises no more than the per-tick budget', () => {
    const governor = new SemanticMaterialisationGovernor<string>(policy);
    governor.request({ identity: identity('a'), level: 'COARSE' }, () => 'a');
    governor.request({ identity: identity('b'), level: 'COARSE' }, () => 'b');
    expect(governor.tick()).toHaveLength(1);
    expect(governor.snapshot()).toMatchObject({ queued: 1, resident: 1, materialised: 1 });
  });

  it('keeps coarse and refined projections bound to the same durable semantic identity', () => {
    const governor = new SemanticMaterialisationGovernor<string>({
      ...policy,
      maxMaterialisationsPerTick: 2,
    });
    const semantic = identity('cluster-7');
    governor.request({ identity: semantic, level: 'COARSE' }, () => 'coarse');
    governor.request({ identity: semantic, level: 'REFINED' }, () => 'refined');
    governor.tick();
    expect(governor.get(semantic, 'COARSE')).toBeUndefined();
    expect(governor.get(semantic, 'REFINED')).toBe('refined');
    expect(governor.snapshot()).toMatchObject({ resident: 1, promoted: 1 });
  });

  it('promotes coarse to refined without double-counting one semantic identity', () => {
    const governor = new SemanticMaterialisationGovernor<string>({
      ...policy,
      maxResident: 1,
      maxMaterialisationsPerTick: 2,
    });
    const semantic = identity('cluster-7');
    governor.request({ identity: semantic, level: 'COARSE' }, () => 'coarse');
    governor.tick();
    expect(
      governor.request({ identity: semantic, level: 'REFINED' }, () => 'refined').accepted
    ).toBe(true);
    governor.tick();
    expect(governor.get(semantic, 'COARSE')).toBeUndefined();
    expect(governor.get(semantic, 'REFINED')).toBe('refined');
    expect(governor.snapshot()).toMatchObject({ resident: 1, queued: 0, promoted: 1 });
  });

  it('collapses refined back to coarse without exceeding a full residency bound', () => {
    const governor = new SemanticMaterialisationGovernor<string>({
      ...policy,
      maxResident: 1,
      maxMaterialisationsPerTick: 2,
    });
    const semantic = identity('cluster-7');
    governor.request({ identity: semantic, level: 'REFINED' }, () => 'refined');
    governor.tick();

    expect(governor.request({ identity: semantic, level: 'COARSE' }, () => 'coarse')).toEqual({
      accepted: true,
    });
    governor.tick();

    expect(governor.get(semantic, 'REFINED')).toBeUndefined();
    expect(governor.get(semantic, 'COARSE')).toBe('coarse');
    expect(governor.snapshot()).toMatchObject({ resident: 1, queued: 0, collapsed: 1 });
  });

  it('preserves refined residency when collapse materialisation fails', () => {
    const governor = new SemanticMaterialisationGovernor<string>({ ...policy, maxResident: 1 });
    const semantic = identity('cluster-7');
    governor.request({ identity: semantic, level: 'REFINED' }, () => 'refined');
    governor.tick();
    governor.request({ identity: semantic, level: 'COARSE' }, () => {
      throw new Error('coarse reconstruction failed');
    });

    expect(governor.tick()).toEqual([
      { status: 'REFUSED', reason: 'coarse reconstruction failed' },
    ]);
    expect(governor.get(semantic, 'REFINED')).toBe('refined');
    expect(governor.get(semantic, 'COARSE')).toBeUndefined();
    expect(governor.snapshot()).toMatchObject({ resident: 1, collapsed: 0, refused: 1 });
  });

  it('does not starve an admissible refinement behind a capacity-blocked queue head', () => {
    const governor = new SemanticMaterialisationGovernor<string>({
      ...policy,
      maxResident: 1,
      maxQueued: 3,
    });
    const semantic = identity('cluster-7');
    governor.request({ identity: semantic, level: 'COARSE' }, () => 'coarse');
    governor.request({ identity: identity('other'), level: 'COARSE' }, () => 'other');
    governor.tick();
    governor.request({ identity: semantic, level: 'REFINED' }, () => 'refined');
    governor.tick();
    expect(governor.get(semantic, 'REFINED')).toBe('refined');
    expect(governor.snapshot()).toMatchObject({ resident: 1, queued: 1, promoted: 1 });
  });

  it('release cancels queued refinement and frees resident capacity', () => {
    const governor = new SemanticMaterialisationGovernor<string>(policy);
    const semantic = identity('cluster-7');
    governor.request({ identity: semantic, level: 'COARSE' }, () => 'coarse');
    governor.tick();
    governor.request({ identity: semantic, level: 'REFINED' }, () => 'refined');
    governor.release(semantic);
    expect(governor.snapshot()).toMatchObject({ resident: 0, queued: 0 });
    expect(governor.tick()).toHaveLength(0);
  });

  it('evicts to an identity-only descriptor and reconstructs the exact semantic level', () => {
    const governor = new SemanticMaterialisationGovernor<string>({ ...policy, maxResident: 1 });
    const semantic = identity('cluster-7');
    governor.request({ identity: semantic, level: 'REFINED' }, () => 'refined');
    governor.tick();

    const descriptor = governor.evict(semantic, 'REFINED');
    expect(descriptor).toEqual({
      schemaVersion: 'semantic-materialisation-descriptor/v1',
      identity: semantic,
      level: 'REFINED',
    });
    expect(Object.keys(descriptor ?? {}).sort()).toEqual(['identity', 'level', 'schemaVersion']);
    expect(governor.snapshot()).toMatchObject({ resident: 0, evicted: 1 });

    const materialise = vi.fn(() => 'reconstructed');
    expect(
      governor.reconstruct(descriptor!, { identity: semantic, level: 'REFINED' }, materialise)
    ).toEqual({ accepted: true });
    expect(materialise).not.toHaveBeenCalled();
    governor.tick();

    expect(governor.get(semantic, 'REFINED')).toBe('reconstructed');
    expect(governor.snapshot()).toMatchObject({
      resident: 1,
      evicted: 1,
      reconstructed: 1,
    });
  });

  it('refuses reconstruction when any durable identity field or level is stale', () => {
    const governor = new SemanticMaterialisationGovernor<string>({ ...policy, maxResident: 1 });
    const semantic = identity('cluster-7');
    governor.request({ identity: semantic, level: 'REFINED' }, () => 'refined');
    governor.tick();
    const descriptor = governor.evict(semantic, 'REFINED')!;
    const materialise = vi.fn(() => 'stale');

    const staleRequests = [
      { identity: { ...semantic, datasetFingerprint: 'other-fp' }, level: 'REFINED' },
      { identity: { ...semantic, datasetGeneration: 2 }, level: 'REFINED' },
      { identity: { ...semantic, datasetVersion: 2 }, level: 'REFINED' },
      { identity: { ...semantic, decisionId: 'other-decision' }, level: 'REFINED' },
      { identity: { ...semantic, semanticId: 'other-semantic' }, level: 'REFINED' },
      { identity: semantic, level: 'COARSE' },
    ] as const;

    for (const request of staleRequests) {
      expect(governor.reconstruct(descriptor, request, materialise)).toEqual({
        accepted: false,
        reason: 'SEMANTIC_RECONSTRUCTION_DESCRIPTOR_MISMATCH',
      });
    }
    governor.tick();

    expect(materialise).not.toHaveBeenCalled();
    expect(governor.snapshot()).toMatchObject({ resident: 0, queued: 0, refused: 6 });
  });

  it('fails closed when durable semantic or dataset identity is absent', () => {
    const governor = new SemanticMaterialisationGovernor<string>(policy);
    const materialise = vi.fn(() => 'x');
    expect(
      governor.request(
        { identity: { ...identity('x'), datasetFingerprint: '' }, level: 'COARSE' },
        materialise
      ).accepted
    ).toBe(false);
    expect(
      governor.request(
        { identity: { ...identity('x'), semanticId: '' }, level: 'COARSE' },
        materialise
      ).accepted
    ).toBe(false);
    governor.tick();
    expect(materialise).not.toHaveBeenCalled();
  });

  it('does not grow residency with session age', () => {
    const governor = new SemanticMaterialisationGovernor<string>(policy);
    for (let i = 0; i < 50; i += 1) {
      const semantic = identity(`semantic-${i}`);
      expect(
        governor.request({ identity: semantic, level: 'COARSE' }, () => String(i)).accepted
      ).toBe(true);
      governor.tick();
      governor.release(semantic);
    }
    expect(governor.snapshot()).toMatchObject({ resident: 0, queued: 0, materialised: 50 });
  });
});
