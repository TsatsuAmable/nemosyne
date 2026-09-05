import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deriveValidationManifest,
  type QuestDeviceIdentity,
  type ValidationManifest,
  type ValidationMode,
} from '../src/validation/validation-manifest.ts';
import {
  GUIDED_UX_TASKS,
  type GuidedUxSubmission,
} from '../src/validation/guided-ux-validation.ts';
import { LOAD_TEST_THRESHOLDS } from '../src/vr/scalability/LoadTestThresholds.ts';
import { QUEST_PERF_STEP_POLICY } from '../dev/validation-adjudication.ts';
import {
  finalizeValidationSession,
  verifyFinalizedCustody,
} from '../dev/validation-finalizer.ts';
import { computeQualificationProgress } from '../dev/loadtest-server.ts';
import { recordValidationPrerequisite } from '../scripts/quest-validation-prerequisite.mjs';

const BUILD = '4d54a76c49ebb57ae8cac5a5166fe8a3dfd7c318';
const roots: string[] = [];

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'nemosyne-qv-fidelity-'));
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

function manifest(
  mode: ValidationMode,
  sessionLabel: string,
  sessionId: string
): ValidationManifest {
  return deriveValidationManifest({
    sessionId,
    sessionLabel,
    buildId: BUILD,
    worktree: 'clean',
    mode,
    createdAt: '2026-09-05T09:00:00.000Z',
    deviceIdentity: device(),
  });
}

function evidenceDir(root: string, value: ValidationManifest): string {
  return join(root, 'logs', 'validation', value.sessionLabel);
}

function writeManifest(root: string, value: ValidationManifest): string {
  const dir = evidenceDir(root, value);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return dir;
}

function greenReport(value: ValidationManifest) {
  return {
    version: '2',
    profileName: 'quest-3s-qualification',
    xrActive: true,
    aborted: false,
    thresholds: { ...LOAD_TEST_THRESHOLDS },
    device: {
      buildId: value.buildId,
      declaredDeviceTarget: 'META_QUEST_3S',
      identityBasis: 'adb-system-property',
      declaredFirmwareVersion: value.deviceIdentity?.buildIncremental,
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
  };
}

function writePerfEvidence(root: string, value: ValidationManifest): string {
  const dir = writeManifest(root, value);
  writeFileSync(
    join(dir, 'loadtest-results.jsonl'),
    `${JSON.stringify(greenReport(value))}\n`,
    'utf8'
  );
  return dir;
}

function uxSubmission(value: ValidationManifest): GuidedUxSubmission {
  const recordedAt = '2026-09-05T09:20:00.000Z';
  return {
    schemaVersion: '1',
    sessionId: value.sessionId,
    sessionLabel: value.sessionLabel,
    buildId: value.buildId,
    deviceBuildFingerprint: value.deviceIdentity?.buildFingerprint ?? null,
    evidenceKind: 'guided-physical-ux',
    results: GUIDED_UX_TASKS.map((task) => ({
      taskId: task.id,
      outcome: 'pass',
      inputModality: 'controller',
      modalityBasis: 'investigator-selected',
      recordedAt,
      note: null,
    })),
    comfortObservation: {
      outcome: 'comfortable',
      recordedAt,
      note: null,
    },
    completedAt: '2026-09-05T09:25:00.000Z',
  };
}

function writeUxEvidence(root: string, value: ValidationManifest): string {
  const dir = writeManifest(root, value);
  const submission = uxSubmission(value);
  writeFileSync(
    join(dir, 'ux-results.json'),
    `${JSON.stringify({
      schemaVersion: submission.schemaVersion,
      sessionId: submission.sessionId,
      sessionLabel: submission.sessionLabel,
      buildId: submission.buildId,
      deviceBuildFingerprint: submission.deviceBuildFingerprint,
      evidenceKind: submission.evidenceKind,
      results: submission.results,
      completedAt: submission.completedAt,
    }, null, 2)}\n`,
    'utf8'
  );
  writeFileSync(
    join(dir, 'comfort-observation.json'),
    `${JSON.stringify({
      schemaVersion: submission.schemaVersion,
      sessionId: submission.sessionId,
      sessionLabel: submission.sessionLabel,
      buildId: submission.buildId,
      deviceBuildFingerprint: submission.deviceBuildFingerprint,
      ...submission.comfortObservation,
    }, null, 2)}\n`,
    'utf8'
  );
  return dir;
}

describe('QV lifecycle fidelity', () => {
  it('does not finalize quest-ux launch placeholders before physical evidence exists', () => {
    const root = tempRoot();
    const value = manifest(
      'quest-ux',
      'UX03-4d54a76-20260905T090000',
      '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
    );
    const dir = writeManifest(root, value);
    for (const name of ['ux-results.json', 'comfort-observation.json']) {
      writeFileSync(
        join(dir, name),
        `${JSON.stringify({ status: 'not-run', note: 'launch placeholder' })}\n`,
        'utf8'
      );
    }

    expect(
      finalizeValidationSession({
        validationLogRoot: join(root, 'logs', 'validation'),
        sessionLabel: value.sessionLabel,
      })
    ).toMatchObject({ status: 'pending' });
    expect(existsSync(join(dir, 'custody.json'))).toBe(false);
  });

  it('finalizes real UX evidence while failing closed on missing P1-U9 prerequisite state', () => {
    const root = tempRoot();
    const value = manifest(
      'quest-ux',
      'UX03-4d54a76-20260905T090100',
      '4f2504e0-4f89-41d3-9a0c-0305e82c3302'
    );
    const dir = writeUxEvidence(root, value);
    const result = finalizeValidationSession({
      validationLogRoot: join(root, 'logs', 'validation'),
      sessionLabel: value.sessionLabel,
    });
    expect(result).toMatchObject({ status: 'finalized', aggregateStatus: 'BLOCKED' });
    const analysis = JSON.parse(readFileSync(join(dir, 'analysis.json'), 'utf8'));
    expect(
      analysis.gateResults.find((gate: { gate: string }) => gate.gate === 'P1-U9')
    ).toMatchObject({ status: 'BLOCKED' });
  });

  it('accepts explicit prerequisite attestation only before custody is frozen', () => {
    const root = tempRoot();
    const value = manifest(
      'quest-ux',
      'UX03-4d54a76-20260905T090200',
      '5f2504e0-4f89-41d3-9a0c-0305e82c3303'
    );
    writeUxEvidence(root, value);
    const file = recordValidationPrerequisite({
      root,
      sessionLabel: value.sessionLabel,
      gate: 'P1-U9',
      satisfied: true,
      reason: 'Reviewed converged P1-UV treatment is the treatment under test.',
    });
    expect(existsSync(file)).toBe(true);
    expect(
      finalizeValidationSession({
        validationLogRoot: join(root, 'logs', 'validation'),
        sessionLabel: value.sessionLabel,
      })
    ).toMatchObject({ status: 'finalized', aggregateStatus: 'PARTIAL' });
    expect(() =>
      recordValidationPrerequisite({
        root,
        sessionLabel: value.sessionLabel,
        gate: 'P1-U9',
        satisfied: false,
        reason: 'attempted post-finalization mutation',
      })
    ).toThrow(/write-locked/);
  });
});

describe('QV cohort and ledger fidelity', () => {
  it('projects the same unique custody-verified cohort used by adjudication', () => {
    const root = tempRoot();
    const validationRoot = join(root, 'logs', 'validation');
    const active = manifest(
      'quest-perf',
      'PERF04-4d54a76-20260905T091000',
      '6f2504e0-4f89-41d3-9a0c-0305e82c3304'
    );
    writePerfEvidence(root, active);

    const prior = manifest(
      'quest-perf',
      'PERF04-4d54a76-20260905T090500',
      '7f2504e0-4f89-41d3-9a0c-0305e82c3305'
    );
    const priorDir = writePerfEvidence(root, prior);

    expect(computeQualificationProgress(validationRoot, active)?.renderCompleted).toBe(1);
    expect(
      finalizeValidationSession({
        validationLogRoot: validationRoot,
        sessionLabel: prior.sessionLabel,
      }).status
    ).toBe('finalized');
    expect(computeQualificationProgress(validationRoot, active)?.renderCompleted).toBe(2);

    appendFileSync(join(priorDir, 'loadtest-results.jsonl'), `${JSON.stringify({ injected: true })}\n`);
    expect(verifyFinalizedCustody(priorDir).ok).toBe(false);
    expect(computeQualificationProgress(validationRoot, active)?.renderCompleted).toBe(1);

    appendFileSync(
      join(evidenceDir(root, active), 'loadtest-results.jsonl'),
      `${JSON.stringify(greenReport(active))}\n`
    );
    expect(computeQualificationProgress(validationRoot, active)?.renderCompleted).toBe(0);
  });

  it('surfaces a tampered finalized session in the local ledger instead of projecting it as valid', () => {
    const root = tempRoot();
    const validationRoot = join(root, 'logs', 'validation');
    const first = manifest(
      'quest-perf',
      'PERF04-4d54a76-20260905T092000',
      '8f2504e0-4f89-41d3-9a0c-0305e82c3306'
    );
    const firstDir = writePerfEvidence(root, first);
    expect(
      finalizeValidationSession({
        validationLogRoot: validationRoot,
        sessionLabel: first.sessionLabel,
      }).status
    ).toBe('finalized');
    appendFileSync(join(firstDir, 'loadtest-results.jsonl'), `${JSON.stringify({ injected: true })}\n`);

    const second = manifest(
      'quest-perf',
      'PERF04-4d54a76-20260905T092100',
      '9f2504e0-4f89-41d3-9a0c-0305e82c3307'
    );
    writePerfEvidence(root, second);
    expect(
      finalizeValidationSession({
        validationLogRoot: validationRoot,
        sessionLabel: second.sessionLabel,
      }).status
    ).toBe('finalized');

    const ledger = readFileSync(join(validationRoot, 'VALIDATION_LEDGER.md'), 'utf8');
    expect(ledger).toContain(first.sessionLabel);
    expect(ledger).toContain('TAMPER-DETECTED');
    expect(ledger).toContain('UNVERIFIED');
  });
});

describe('QV publication fidelity', () => {
  it('refuses the whole publication when any finalized candidate fails custody verification', () => {
    const root = tempRoot();
    const validationRoot = join(root, 'logs', 'validation');
    const first = manifest(
      'quest-perf',
      'PERF04-4d54a76-20260905T093000',
      'af2504e0-4f89-41d3-9a0c-0305e82c3308'
    );
    const firstDir = writePerfEvidence(root, first);
    expect(
      finalizeValidationSession({
        validationLogRoot: validationRoot,
        sessionLabel: first.sessionLabel,
      }).status
    ).toBe('finalized');

    const second = manifest(
      'quest-perf',
      'PERF04-4d54a76-20260905T093100',
      'bf2504e0-4f89-41d3-9a0c-0305e82c3309'
    );
    writePerfEvidence(root, second);
    expect(
      finalizeValidationSession({
        validationLogRoot: validationRoot,
        sessionLabel: second.sessionLabel,
      }).status
    ).toBe('finalized');

    appendFileSync(join(firstDir, 'loadtest-results.jsonl'), `${JSON.stringify({ injected: true })}\n`);
    const script = fileURLToPath(new URL('../scripts/publish-validation-docs.mjs', import.meta.url));
    const published = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(published.status).not.toBe(0);
    expect(published.stderr).toContain('Refusing to publish validation documentation');
    expect(existsSync(join(root, 'docs', 'validation', 'generated'))).toBe(false);
  });
});
