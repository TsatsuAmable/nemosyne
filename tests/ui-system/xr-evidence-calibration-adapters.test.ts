import { describe, expect, it } from 'vitest';
import { calibrationObservationFromGuidedUx } from '../../dev/xr-lab/EvidenceCalibrationAdapters.ts';
import { GUIDED_UX_TASKS } from '../../src/validation/guided-ux-validation.ts';
import { deriveValidationManifest } from '../../src/validation/validation-manifest.ts';

const buildId = 'b'.repeat(40);
const sessionId = '11111111-1111-4111-8111-111111111111';
const fingerprint = 'quest-build-fingerprint';

function fixture() {
  const submission = {
    schemaVersion: '1' as const,
    sessionId,
    sessionLabel: 'q',
    buildId,
    deviceBuildFingerprint: fingerprint,
    evidenceKind: 'guided-physical-ux' as const,
    results: GUIDED_UX_TASKS.map(({ id: taskId }) => ({
      taskId,
      outcome: 'pass' as const,
      inputModality: 'controller' as const,
      modalityBasis: 'investigator-selected' as const,
      recordedAt: '2026-09-11T00:00:00Z',
      note: null,
    })),
    comfortObservation: { outcome: 'comfortable' as const, recordedAt: '2026-09-11T00:00:00Z', note: null },
    completedAt: '2026-09-11T00:01:00Z',
  };
  const manifest = deriveValidationManifest({
    sessionId,
    sessionLabel: 'q',
    buildId,
    worktree: 'clean',
    mode: 'quest-ux',
    deviceIdentity: {
      captureBasis: 'adb-system-property',
      model: 'Quest',
      manufacturer: 'Meta',
      buildIncremental: '1234',
      buildDisplayId: null,
      buildFingerprint: fingerprint,
      securityPatch: null,
    },
  });
  return { submission, manifest };
}

describe('XR calibration adapters', () => {
  it('requires governed device-bound evidence before assigning S4', () => {
    const { submission, manifest } = fixture();
    expect(calibrationObservationFromGuidedUx(submission, 's1', manifest)).toMatchObject({
      tier: 'S4',
      kind: 'physical-device',
      outcome: 'PASS',
    });
  });

  it('rejects a mismatched physical-device fingerprint', () => {
    const { submission, manifest } = fixture();
    submission.deviceBuildFingerprint = 'different-device';
    expect(() => calibrationObservationFromGuidedUx(submission, 's1', manifest)).toThrow(/device fingerprint/);
  });
});
