import { describe, expect, it } from 'vitest';
import { buildArchitectureCampaign } from '../../dev/xr-lab/XRArchitectureCampaign.ts';
describe('portable architecture campaign config', () => {
  it('binds resource budget into every comparable run', () => {
    const runs = buildArchitectureCampaign({protocolId:'p',protocolVersion:'1',datasetId:'d',datasetFingerprint:'fp',oracleId:'o',replayTraceId:'t',resourceBudgetId:'budget-q3-v1',seeds:[1]});
    expect(runs).toHaveLength(3);
    expect(new Set(runs.map(r => r.evidence.resourceBudgetId))).toEqual(new Set(['budget-q3-v1']));
  });
  it('refuses comparison across resource budgets', async () => {
    const { createExperimentEvidenceBinding, assertComparableExperimentEvidence } = await import('../../dev/xr-lab/XRExperimentEvidenceContract.ts');
    const base={architecture:'SWSE_BASELINE' as const,protocolId:'p',protocolVersion:'1',datasetId:'d',datasetFingerprint:'fp',oracleId:'o',seed:1,replayTraceId:'t',resourceBudgetId:'a'};
    const a=createExperimentEvidenceBinding(base);
    const b=createExperimentEvidenceBinding({...base,architecture:'ORTHOGONAL_MATRIX',resourceBudgetId:'b'});
    expect(()=>assertComparableExperimentEvidence(a,b)).toThrow(/resourceBudgetId/);
  });
});