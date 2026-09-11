import { describe, expect, it } from 'vitest';
import { createEvidenceCalibrationPair, summarizeCalibrationPairs, type CalibrationObservation } from '../../dev/xr-lab/EvidenceCalibration.ts';

const observation = (overrides: Partial<CalibrationObservation>): CalibrationObservation => ({
  evidenceId: 'sim-1', scenarioId: 'journey-a', buildHash: 'abc123', tier: 'S2', kind: 'simulator', outcome: 'PASS', failureClasses: [], ...overrides,
});

describe('XR evidence calibration', () => {
  it('detects failures invisible to all cheap evidence', () => {
    const pair = createEvidenceCalibrationPair({
      calibrationId: 'cal-1', createdAt: '2026-09-11T00:00:00.000Z',
      cheapEvidence: [observation({ evidenceId: 'iwer', tier: 'S2' }), observation({ evidenceId: 'browser', tier: 'S1', kind: 'browser' })],
      highFidelityEvidence: observation({ evidenceId: 'quest', tier: 'S4', kind: 'physical-device', outcome: 'FAIL', failureClasses: ['frame-pacing'] }),
    });
    expect(pair.counterSimulationFailure).toBe(true);
    expect(pair.missedFailureClasses).toEqual(['frame-pacing']);
    expect(pair.cheapConsensus).toBe('PASS');
  });

  it('preserves cheap-evidence disagreement as an escalation signal', () => {
    const pair = createEvidenceCalibrationPair({
      calibrationId: 'cal-2',
      cheapEvidence: [observation({ evidenceId: 'clean', outcome: 'PASS' }), observation({ evidenceId: 'hostile', tier: 'S3', outcome: 'FAIL', failureClasses: ['tracking-loss'] })],
      highFidelityEvidence: observation({ evidenceId: 'quest', tier: 'S4', kind: 'physical-device', outcome: 'PASS' }),
    });
    expect(pair.cheapEvidenceDisagreement).toBe(true);
    expect(pair.cheapConsensus).toBe('DISAGREE');
    expect(pair.counterSimulationFailure).toBe(false);
  });

  it('fails closed when lower-tier evidence is presented as the oracle', () => {
    expect(() => createEvidenceCalibrationPair({
      calibrationId: 'bad', cheapEvidence: [observation({})], highFidelityEvidence: observation({ evidenceId: 'pretend-physical', tier: 'S3', kind: 'physical-device' }),
    })).toThrow(/S4 or S5/);
  });

  it('refuses physical or human evidence in the cheap-evidence lane', () => {
    expect(() => createEvidenceCalibrationPair({
      calibrationId: 'bad-kind',
      cheapEvidence: [observation({ evidenceId: 'misclassified', tier: 'S2', kind: 'physical-device' })],
      highFidelityEvidence: observation({ evidenceId: 'quest', tier: 'S4', kind: 'physical-device' }),
    })).toThrow(/simulator or browser evidence/);
  });

  it('refuses cross-build or cross-scenario pairing', () => {
    expect(() => createEvidenceCalibrationPair({
      calibrationId: 'bad-build', cheapEvidence: [observation({ buildHash: 'old' })], highFidelityEvidence: observation({ evidenceId: 'quest', tier: 'S4', kind: 'physical-device' }),
    })).toThrow(/build mismatch/);
  });

  it('summarizes calibration debt without inventing a ground-truth score', () => {
    const pair = createEvidenceCalibrationPair({
      calibrationId: 'cal-3', cheapEvidence: [observation({})],
      highFidelityEvidence: observation({ evidenceId: 'quest', tier: 'S4', kind: 'physical-device', outcome: 'FAIL', failureClasses: ['thermal', 'frame-pacing'] }),
    });
    expect(summarizeCalibrationPairs([pair])).toMatchObject({ pairs: 1, counterSimulationFailures: 1, counterSimulationRate: 1, missedFailureClasses: { thermal: 1, 'frame-pacing': 1 } });
    expect(summarizeCalibrationPairs([]).counterSimulationRate).toBeNull();
  });
});
