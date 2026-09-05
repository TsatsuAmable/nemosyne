import { describe, expect, it } from 'vitest';
import {
  validationManifestConfirmationIssue,
  type BrowserValidationContext,
} from '../src/validation/browser-validation-session.ts';
import { deriveValidationManifest, type QuestDeviceIdentity } from '../src/validation/validation-manifest.ts';

const BUILD = '277c2e73f9206f5b387a856bc8298d8247e39376';
const SESSION = {
  label: 'PERF04-277c2e7-20260905T020000',
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
};

function device(fingerprint = 'oculus/panther/panther:12/SQ3A/5123456789:user/release-keys'): QuestDeviceIdentity {
  return {
    captureBasis: 'adb-system-property',
    model: 'Meta Quest 3S',
    manufacturer: 'Meta',
    buildIncremental: '5123456789012345678',
    buildDisplayId: 'SQ3A.220605.009.A1',
    buildFingerprint: fingerprint,
    securityPatch: '2026-08-01',
  };
}

function manifest(overrides: {
  buildId?: string;
  mode?: 'quest-perf' | 'quest-10m';
  worktree?: 'clean' | 'dirty' | 'unknown';
  deviceIdentity?: QuestDeviceIdentity | null;
} = {}) {
  return deriveValidationManifest({
    sessionId: SESSION.id,
    sessionLabel: SESSION.label,
    buildId: overrides.buildId ?? BUILD,
    worktree: overrides.worktree ?? 'clean',
    mode: overrides.mode ?? 'quest-perf',
    createdAt: '2026-09-05T02:00:00.000Z',
    deviceIdentity: overrides.deviceIdentity === undefined ? device() : overrides.deviceIdentity,
  });
}

function context(): BrowserValidationContext {
  return {
    session: SESSION,
    manifest: manifest(),
    attributable: true,
    attributionIssue: 'launcher env projected; exact manifest confirmation is pending from the evidence sink',
    source: 'launcher-env-provisional',
  };
}

describe('validation sink manifest confirmation', () => {
  it('accepts an exact promotion-critical identity match', () => {
    expect(validationManifestConfirmationIssue(context(), manifest())).toBeNull();
  });

  it('rejects same-session build, lane, worktree and ADB identity drift', () => {
    expect(
      validationManifestConfirmationIssue(context(), manifest({ buildId: 'a'.repeat(40) }))
    ).toMatch(/build/i);
    expect(
      validationManifestConfirmationIssue(context(), manifest({ mode: 'quest-10m' }))
    ).toMatch(/lane/i);
    expect(
      validationManifestConfirmationIssue(context(), manifest({ worktree: 'dirty' }))
    ).toMatch(/worktree/i);
    expect(
      validationManifestConfirmationIssue(
        context(),
        manifest({ deviceIdentity: device('different/device/fingerprint') })
      )
    ).toMatch(/device identity/i);
  });
});
