import { describe, expect, it } from 'vitest';
import { buildArchitectureCampaign } from '../../dev/xr-lab/XRArchitectureCampaign.ts';

describe('XR architecture comparison campaign', () => {
  it('creates all three arms for every matched block with identical governing provenance', () => {
    const runs = buildArchitectureCampaign({
      protocolId: 'uxr3-architecture-comparison',
      protocolVersion: '1',
      datasetId: 'tiny',
      datasetFingerprint: 'sha256:tiny-v1',
      oracleId: 'known-structure:tiny:v1',
      replayTraceId: 'teleport-flood:v1',
      resourceBudgetId: 'quest3-class-default-v1',
      seeds: [11, 22],
    });
    expect(runs).toHaveLength(6);
    for (const seed of [11, 22]) {
      const block = runs.filter((r) => r.evidence.seed === seed);
      expect(new Set(block.map((r) => r.evidence.architecture))).toEqual(
        new Set(['SWSE_BASELINE', 'COUPLED_STAIRCASE', 'ORTHOGONAL_MATRIX'])
      );
      expect(new Set(block.map((r) => r.evidence.datasetFingerprint)).size).toBe(1);
      expect(new Set(block.map((r) => r.evidence.replayTraceId)).size).toBe(1);
    }
  });

  it('uses deterministic counterbalanced arm order rather than a fixed architecture order', () => {
    const first = buildArchitectureCampaign({
      protocolId: 'p', protocolVersion: '1', datasetId: 'd', datasetFingerprint: 'fp',
      oracleId: 'o', replayTraceId: 't', resourceBudgetId: 'quest3-class-default-v1', seeds: [1, 2, 3, 4, 5, 6],
    });
    const second = buildArchitectureCampaign({
      protocolId: 'p', protocolVersion: '1', datasetId: 'd', datasetFingerprint: 'fp',
      oracleId: 'o', replayTraceId: 't', resourceBudgetId: 'quest3-class-default-v1', seeds: [1, 2, 3, 4, 5, 6],
    });
    expect(first.map((r) => r.evidence.architecture)).toEqual(second.map((r) => r.evidence.architecture));
    const firstArms = [1,2,3,4,5,6].map((seed) => first.find((r) => r.evidence.seed === seed)!.evidence.architecture);
    expect(new Set(firstArms).size).toBeGreaterThan(1);
  });

  it('fails closed on duplicate or invalid seeds', () => {
    const common = { protocolId:'p', protocolVersion:'1', datasetId:'d', datasetFingerprint:'fp', oracleId:'o', replayTraceId:'t', resourceBudgetId:'quest3-class-default-v1' };
    expect(() => buildArchitectureCampaign({ ...common, seeds: [7, 7] })).toThrow(/duplicate seed/i);
    expect(() => buildArchitectureCampaign({ ...common, seeds: [Number.NaN] })).toThrow(/seed/i);
  });
});



