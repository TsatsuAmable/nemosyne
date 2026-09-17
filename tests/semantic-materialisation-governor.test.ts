import { describe, expect, it, vi } from 'vitest';
import {
  SemanticMaterialisationGovernor,
  type SemanticMaterialisationIdentity,
} from '../src/vr/scalability/SemanticMaterialisationGovernor.ts';

const identity = (semanticId: string): SemanticMaterialisationIdentity => ({
  datasetFingerprint: 'dataset-fp',
  datasetGeneration: 1,
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
  it('applies materialisation backpressure without silently dropping focus', () => {
    const governor = new SemanticMaterialisationGovernor<string>(policy);
    expect(governor.request({ identity: identity('a'), level: 'COARSE' }, () => 'a').accepted).toBe(true);
    expect(governor.request({ identity: identity('b'), level: 'COARSE' }, () => 'b').accepted).toBe(true);
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
    const governor = new SemanticMaterialisationGovernor<string>({ ...policy, maxMaterialisationsPerTick: 2 });
    const semantic = identity('cluster-7');
    governor.request({ identity: semantic, level: 'COARSE' }, () => 'coarse');
    governor.request({ identity: semantic, level: 'REFINED' }, () => 'refined');
    governor.tick();
    expect(governor.get(semantic, 'COARSE')).toBeUndefined();
    expect(governor.get(semantic, 'REFINED')).toBe('refined');
    expect(governor.snapshot()).toMatchObject({ resident: 1, promoted: 1 });
  });

  it('promotes coarse to refined without double-counting one semantic identity', () => {
    const governor = new SemanticMaterialisationGovernor<string>({ ...policy, maxResident: 1, maxMaterialisationsPerTick: 2 });
    const semantic = identity('cluster-7');
    governor.request({ identity: semantic, level: 'COARSE' }, () => 'coarse');
    governor.tick();
    expect(governor.request({ identity: semantic, level: 'REFINED' }, () => 'refined').accepted).toBe(true);
    governor.tick();
    expect(governor.get(semantic, 'COARSE')).toBeUndefined();
    expect(governor.get(semantic, 'REFINED')).toBe('refined');
    expect(governor.snapshot()).toMatchObject({ resident: 1, queued: 0, promoted: 1 });
  });

  it('does not starve an admissible refinement behind a capacity-blocked queue head', () => {
    const governor = new SemanticMaterialisationGovernor<string>({ ...policy, maxResident: 1, maxQueued: 3 });
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

  it('fails closed when durable semantic or dataset identity is absent', () => {
    const governor = new SemanticMaterialisationGovernor<string>(policy);
    const materialise = vi.fn(() => 'x');
    expect(governor.request({ identity: { ...identity('x'), datasetFingerprint: '' }, level: 'COARSE' }, materialise).accepted).toBe(false);
    expect(governor.request({ identity: { ...identity('x'), semanticId: '' }, level: 'COARSE' }, materialise).accepted).toBe(false);
    governor.tick();
    expect(materialise).not.toHaveBeenCalled();
  });

  it('does not grow residency with session age', () => {
    const governor = new SemanticMaterialisationGovernor<string>(policy);
    for (let i = 0; i < 50; i += 1) {
      const semantic = identity(`semantic-${i}`);
      expect(governor.request({ identity: semantic, level: 'COARSE' }, () => String(i)).accepted).toBe(true);
      governor.tick();
      governor.release(semantic);
    }
    expect(governor.snapshot()).toMatchObject({ resident: 0, queued: 0, materialised: 50 });
  });
});
