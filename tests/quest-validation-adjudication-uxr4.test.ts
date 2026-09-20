import { describe, expect, it } from 'vitest';
import { adjudicateUxr4Envelope, UXR4_EVIDENCE_CLASSES, UXR4_QUALIFICATION_PROFILES } from '../src/validation/uxr4-verification-envelope';
describe('UXR4 verification envelope', () => {
 it('freezes governed profiles and evidence classes',()=>{ expect(UXR4_QUALIFICATION_PROFILES).toEqual(['functional-5m','resource-trend-30m','sustained-60m','scale-staircase']); expect(UXR4_EVIDENCE_CLASSES).toEqual(['interaction','responsiveness','frame-render','memory-resource','semantic-scale']); });
 it('keeps failure classes independent',()=>{ const observations=UXR4_EVIDENCE_CLASSES.map((evidenceClass)=>({evidenceClass,status:evidenceClass==='memory-resource'?'FAIL' as const:'PASS' as const,reasons:[evidenceClass]})); const result=adjudicateUxr4Envelope({schemaVersion:1,profile:'resource-trend-30m',evidenceClass:'governed-physical-validation',observations}); expect(result.aggregateStatus).toBe('FAIL'); expect(result.results['frame-render'].status).toBe('PASS'); expect(result.results['memory-resource'].status).toBe('FAIL'); });
 it('fails closed when a governed evidence class is absent',()=>{ const observations=UXR4_EVIDENCE_CLASSES.filter((x)=>x!=='semantic-scale').map((evidenceClass)=>({evidenceClass,status:'PARTIAL' as const,reasons:['captured without a governed automatic threshold']})); const result=adjudicateUxr4Envelope({schemaVersion:1,profile:'functional-5m',evidenceClass:'governed-physical-validation',observations}); expect(result.results['semantic-scale'].status).toBe('INVALID_RUN'); expect(result.aggregateStatus).toBe('INVALID_RUN'); });
});

import { deriveUxr4LaneObservations } from '../dev/validation-adjudication';
import type { ValidationManifest } from '../src/validation/validation-manifest';

function laneManifest(validationMode: ValidationManifest['validationMode']): ValidationManifest {
  return { validationMode } as ValidationManifest;
}

describe('UXR4 QV4 lane integration', () => {
  it('maps perf gates only to frame/render and memory/resource', () => {
    expect(deriveUxr4LaneObservations(laneManifest('quest-perf'), [
      { gate: 'PERF-04', status: 'PASS', reasons: ['frame'] },
      { gate: 'PERF-05', status: 'PARTIAL', reasons: ['no invented threshold'] },
    ])).toEqual([
      { evidenceClass: 'frame-render', status: 'PASS', reasons: ['PERF-04: frame'] },
      { evidenceClass: 'memory-resource', status: 'PARTIAL', reasons: ['PERF-05: no invented threshold'] },
    ]);
  });
  it('maps guided UX only to interaction and responsiveness', () => {
    const observations = deriveUxr4LaneObservations(laneManifest('quest-ux'), [
      { gate: 'UX-03', status: 'FAIL', reasons: ['task failed'] },
      { gate: 'RF-049', status: 'PARTIAL', reasons: ['review'] },
    ]);
    expect(observations.map((x) => x.evidenceClass)).toEqual(['interaction', 'responsiveness']);
    expect(observations[0].status).toBe('FAIL');
    expect(observations[1].status).toBe('FAIL');
  });
  it('does not manufacture absent cross-lane observations', () => {
    expect(deriveUxr4LaneObservations(laneManifest('quest-10m'), [
      { gate: 'RF-029', status: 'PASS', reasons: ['bounded'] },
      { gate: 'RF-051', status: 'PASS', reasons: ['bounded'] },
    ])).toEqual([{ evidenceClass: 'semantic-scale', status: 'PASS', reasons: ['RF-029: bounded', 'RF-051: bounded'] }]);
  });
});

import { composeUxr4LaneEvidence } from '../src/validation/uxr4-verification-envelope';

const exactLane = (sessionId: string, observations: any[], overrides: Record<string, unknown> = {}) => ({
  sessionId, buildId: 'build-a', deviceBuildFingerprint: 'device-a',
  evidenceClass: 'governed-physical-validation' as const, custodyValid: true, observations, ...overrides,
});

describe('UXR4 cross-session composition', () => {
  const obs = (evidenceClass: any, status: any = 'PASS') => ({ evidenceClass, status, reasons: [evidenceClass] });
  it('composes exact-build exact-device lanes without averaging class status', () => {
    const result = composeUxr4LaneEvidence('scale-staircase', [
      exactLane('ux', [obs('interaction'), obs('responsiveness')]),
      exactLane('perf', [obs('frame-render'), obs('memory-resource', 'PARTIAL')]),
      exactLane('scale', [obs('semantic-scale')]),
    ]);
    expect(result.aggregateStatus).toBe('PARTIAL');
    expect(result.results['frame-render'].status).toBe('PASS');
    expect(result.results['memory-resource'].status).toBe('PARTIAL');
  });
  it('fails closed on build or device mismatch', () => {
    const result = composeUxr4LaneEvidence('scale-staircase', [
      exactLane('ux', [obs('interaction'), obs('responsiveness')]),
      exactLane('perf', [obs('frame-render'), obs('memory-resource')], { buildId: 'build-b' }),
      exactLane('scale', [obs('semantic-scale')], { deviceBuildFingerprint: 'device-b' }),
    ]);
    expect(result.aggregateStatus).toBe('INVALID_RUN');
    expect(result.results.interaction.reasons.join(' ')).toContain('multiple build identities');
    expect(result.results.interaction.reasons.join(' ')).toContain('shared device build fingerprint');
  });
  it('fails closed on invalid custody', () => {
    const result = composeUxr4LaneEvidence('functional-5m', [exactLane('ux', [obs('interaction')], { custodyValid: false })]);
    expect(result.aggregateStatus).toBe('INVALID_RUN');
    expect(result.results.interaction.reasons.join(' ')).toContain('custody');
  });
  it('fails closed on duplicate or missing evidence classes', () => {
    const result = composeUxr4LaneEvidence('functional-5m', [
      exactLane('a', [obs('interaction'), obs('responsiveness')]),
      exactLane('b', [obs('interaction'), obs('frame-render'), obs('memory-resource')]),
    ]);
    expect(result.results.interaction.status).toBe('INVALID_RUN');
    expect(result.results['semantic-scale'].status).toBe('INVALID_RUN');
    expect(result.aggregateStatus).toBe('INVALID_RUN');
  });
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { finalizeUxr4Cohort } from '../dev/uxr4-cohort-finalizer';

describe('UXR4 cohort finalizer', () => {
  it('fails closed when supplied sessions are not finalized custody bundles', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uxr4-cohort-'));
    fs.mkdirSync(path.join(root, 'not-finalized'));
    const artifact = finalizeUxr4Cohort({
      validationLogRoot: root, profile: 'functional-5m', sessionLabels: ['not-finalized'],
    });
    expect(artifact.adjudication.aggregateStatus).toBe('INVALID_RUN');
    expect(artifact.adjudication.results.interaction.reasons.join(' ')).toContain('custody');
  });
});
