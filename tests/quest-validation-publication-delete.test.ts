import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deriveValidationManifest,
  type QuestDeviceIdentity,
} from '../src/validation/validation-manifest.ts';
import { LOAD_TEST_THRESHOLDS } from '../src/vr/scalability/LoadTestThresholds.ts';
import { QUEST_PERF_STEP_POLICY } from '../dev/validation-adjudication.ts';
import { finalizeValidationSession } from '../dev/validation-finalizer.ts';

const roots: string[] = [];
const BUILD = '4d54a76c49ebb57ae8cac5a5166fe8a3dfd7c318';

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'nemosyne-qv-publish-delete-'));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function device(): QuestDeviceIdentity {
  return {
    captureBasis: 'adb-system-property',
    model: 'Meta Quest 3S',
    manufacturer: 'Meta',
    buildIncremental: '5123456789012345678',
    buildDisplayId: 'SQ3A.220605.009.A1',
    buildFingerprint: 'oculus/panther/panther:12/SQ3A/5123456789:user/release-keys',
    securityPatch: '2026-08-01',
  };
}

describe('validation publication omission resistance', () => {
  it('refuses publication when custody.json is deleted from an otherwise finalized bundle', () => {
    const root = tempRoot();
    const manifest = deriveValidationManifest({
      sessionId: 'cf2504e0-4f89-41d3-9a0c-0305e82c3310',
      sessionLabel: 'PERF04-4d54a76-20260905T094000',
      buildId: BUILD,
      worktree: 'clean',
      mode: 'quest-perf',
      createdAt: '2026-09-05T09:40:00.000Z',
      deviceIdentity: device(),
    });
    const validationRoot = join(root, 'logs', 'validation');
    const evidenceDir = join(validationRoot, manifest.sessionLabel);
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(join(evidenceDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    writeFileSync(
      join(evidenceDir, 'loadtest-results.jsonl'),
      `${JSON.stringify({
        version: '2',
        profileName: 'quest-3s-qualification',
        xrActive: true,
        aborted: false,
        thresholds: { ...LOAD_TEST_THRESHOLDS },
        device: {
          buildId: BUILD,
          declaredDeviceTarget: 'META_QUEST_3S',
          identityBasis: 'adb-system-property',
          declaredFirmwareVersion: manifest.deviceIdentity?.buildIncremental,
          xr: { active: true },
        },
        collection: {
          rawFrameTraceIncluded: false,
          datasetRowsIncluded: false,
          cameraPosesIncluded: false,
        },
        steps: QUEST_PERF_STEP_POLICY.map((policy) => ({
          spec: { topology: 'TABULAR', rowCount: policy.rowCount, durationSec: policy.durationSec },
          frames: { p95Ms: 10, p99Ms: 12, droppedPct: 1 },
          criticalViolations: 0,
          grade: 'green',
        })),
      })}\n`
    );

    expect(
      finalizeValidationSession({
        validationLogRoot: validationRoot,
        sessionLabel: manifest.sessionLabel,
      }).status
    ).toBe('finalized');
    expect(existsSync(join(evidenceDir, 'evidence-index.json'))).toBe(true);
    unlinkSync(join(evidenceDir, 'custody.json'));

    const script = fileURLToPath(new URL('../scripts/publish-validation-docs.mjs', import.meta.url));
    const published = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
    expect(published.status).not.toBe(0);
    expect(published.stderr).toContain('custody.json is missing or invalid');
    expect(existsSync(join(root, 'docs', 'validation', 'generated'))).toBe(false);
  });
});
