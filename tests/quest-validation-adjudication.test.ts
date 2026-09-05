import { describe, expect, it } from 'vitest';
import {
  deriveValidationManifest,
  type QuestDeviceIdentity,
  type ValidationManifest,
  type ValidationMode,
} from '../src/validation/validation-manifest.ts';
import {
  GUIDED_UX_SCHEMA_VERSION,
  GUIDED_UX_TASKS,
  type GuidedUxSubmission,
} from '../src/validation/guided-ux-validation.ts';
import { QUEST_3S_QUALIFICATION_PROFILE } from '../src/vr/scalability/LoadTestDriver.ts';
import { LOAD_TEST_THRESHOLDS } from '../src/vr/scalability/LoadTestThresholds.ts';
import {
  QUEST_PERF_STEP_POLICY,
  adjudicateValidationEvidence,
  validateQuestBoundaryReport,
  validateQuestPerformanceReport,
} from '../dev/validation-adjudication.ts';

const BUILD = '4d54a76c49ebb57ae8cac5a5166fe8a3dfd7c318';
const SESSION_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const FINGERPRINT = 'oculus/panther/panther:12/SQ3A/5123456789:user/release-keys';

function device(): QuestDeviceIdentity {
  return {
    captureBasis: 'adb-system-property',
    model: 'Meta Quest 3S',
    manufacturer: 'Meta',
    buildIncremental: '5123456789012345678',
    buildDisplayId: 'SQ3A.220605.009.A1',
    buildFingerprint: FINGERPRINT,
    securityPatch: '2026-08-01',
  };
}

function manifest(
  mode: ValidationMode = 'quest-perf',
  worktree: 'clean' | 'dirty' = 'clean'
): ValidationManifest {
  return deriveValidationManifest({
    sessionId: SESSION_ID,
    sessionLabel: `${mode.replaceAll('-', '')}-4d54a76-20260905T100000`,
    buildId: BUILD,
    worktree,
    mode,
    createdAt: '2026-09-05T09:00:00.000Z',
    deviceIdentity: device(),
  });
}

function frameFor(grade: 'green' | 'yellow' | 'red') {
  if (grade === 'red') return { p95Ms: 20, p99Ms: 25, droppedPct: 2 };
  if (grade === 'yellow') return { p95Ms: 15, p99Ms: 20, droppedPct: 2 };
  return { p95Ms: 10, p99Ms: 12, droppedPct: 1 };
}

function perfReport(
  value: ValidationManifest,
  grades: Array<'green' | 'yellow' | 'red'> = [
    'green',
    'green',
    'green',
    'green',
    'green',
  ]
) {
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
    steps: QUEST_PERF_STEP_POLICY.map((policy, index) => ({
      spec: { topology: 'TABULAR', rowCount: policy.rowCount, durationSec: policy.durationSec },
      frames: frameFor(grades[index] ?? 'green'),
      criticalViolations: 0,
      grade: grades[index] ?? 'green',
    })),
  };
}

function boundaryReport(
  value: ValidationManifest,
  outcome: 'completed' | 'failed' | 'aborted' = 'completed'
) {
  return {
    version: '1',
    profileName: 'quest-3s-rust-boundary-10m',
    xrActive: true,
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
    scenario: { rows: 10_000_000 },
    outcome: { status: outcome },
    qualification: {
      deviceQualifiedAt10m: false,
      promotionBlockedByAudits: true,
    },
    evidence: {
      structureProfileRowCount: 10_000_000,
      rowMaterialisations: 0,
      checksumParity: true,
    },
  };
}

function uxSubmission(
  value: ValidationManifest,
  failedTask: string | null = null
): GuidedUxSubmission {
  return {
    schemaVersion: GUIDED_UX_SCHEMA_VERSION,
    sessionId: value.sessionId,
    sessionLabel: value.sessionLabel,
    buildId: value.buildId,
    deviceBuildFingerprint: value.deviceIdentity?.buildFingerprint ?? null,
    evidenceKind: 'guided-physical-ux',
    results: GUIDED_UX_TASKS.map((task, index) => ({
      taskId: task.id,
      outcome: task.id === failedTask ? 'fail' : 'pass',
      inputModality: index % 2 === 0 ? 'controller' : 'hand',
      modalityBasis: 'investigator-selected',
      recordedAt: '2026-09-05T09:10:00.000Z',
      note: null,
    })),
    comfortObservation: {
      outcome: 'comfortable',
      recordedAt: '2026-09-05T09:20:00.000Z',
      note: null,
    },
    completedAt: '2026-09-05T09:20:01.000Z',
  };
}

describe('QV4 governed policy binding', () => {
  it('keeps the adjudicator staircase signature synchronized with the production Quest profile', () => {
    expect(
      QUEST_PERF_STEP_POLICY.map(({ rowCount, durationSec, label }) => ({
        rowCount,
        durationSec,
        label,
      }))
    ).toEqual(
      QUEST_3S_QUALIFICATION_PROFILE.steps.map(({ rowCount, durationSec, label }) => ({
        rowCount,
        durationSec,
        label,
      }))
    );
  });

  it('separates analyzer validity from a PERF-04 gate failure', () => {
    const value = manifest();
    const report = perfReport(value, ['green', 'green', 'green', 'yellow', 'green']);
    const checked = validateQuestPerformanceReport(report, value);
    expect(checked.ok).toBe(true);
    expect(checked.corePass).toBe(false);

    const result = adjudicateValidationEvidence({
      manifest: value,
      loadTestReports: [report],
      guidedUxSubmission: null,
      cohort: { perfCompletedRunCount: 1, perfPassingRunCount: 0 },
    });
    expect(result.analyzerValid).toBe(true);
    expect(result.gateResults.find((gate) => gate.gate === 'PERF-04')?.status).toBe('FAIL');
  });

  it('requires three independently captured passing render runs before PERF-04 can pass', () => {
    const value = manifest();
    const report = perfReport(value);
    const partial = adjudicateValidationEvidence({
      manifest: value,
      loadTestReports: [report],
      guidedUxSubmission: null,
      cohort: { perfCompletedRunCount: 1, perfPassingRunCount: 1 },
    });
    expect(partial.gateResults.find((gate) => gate.gate === 'PERF-04')?.status).toBe('PARTIAL');

    const passing = adjudicateValidationEvidence({
      manifest: value,
      loadTestReports: [report],
      guidedUxSubmission: null,
      cohort: { perfCompletedRunCount: 3, perfPassingRunCount: 3 },
    });
    expect(passing.gateResults.find((gate) => gate.gate === 'PERF-04')?.status).toBe('PASS');
    expect(passing.gateResults.find((gate) => gate.gate === 'PERF-05')?.status).toBe('PARTIAL');
  });

  it('does not make the 250k stretch step a hidden PERF-04 pass requirement', () => {
    const value = manifest();
    const report = perfReport(value, ['green', 'green', 'green', 'green', 'red']);
    expect(validateQuestPerformanceReport(report, value)).toMatchObject({ ok: true, corePass: true });
  });

  it('fails foreign runtime identity and dirty source attribution closed as INVALID_RUN', () => {
    const value = manifest();
    const foreign = perfReport(value);
    foreign.device.buildId = 'a'.repeat(40);
    expect(validateQuestPerformanceReport(foreign, value).ok).toBe(false);

    const dirty = manifest('quest-perf', 'dirty');
    const result = adjudicateValidationEvidence({
      manifest: dirty,
      loadTestReports: [perfReport(dirty)],
      guidedUxSubmission: null,
    });
    expect(result.aggregateStatus).toBe('INVALID_RUN');
  });

  it('turns an unsatisfied explicit prerequisite into BLOCKED rather than a pass', () => {
    const value = manifest();
    const result = adjudicateValidationEvidence({
      manifest: value,
      loadTestReports: [perfReport(value)],
      guidedUxSubmission: null,
      cohort: { perfPassingRunCount: 3, perfCompletedRunCount: 3 },
      prerequisites: {
        'PERF-04': [
          { satisfied: false, reason: 'clean-production prerequisite is not satisfied' },
        ],
      },
    });
    expect(result.gateResults.find((gate) => gate.gate === 'PERF-04')).toMatchObject({
      status: 'BLOCKED',
    });
  });
});

describe('QV4 10M non-qualification guard', () => {
  it('can adjudicate repeated RF boundary evidence without ever creating PERF-04 evidence', () => {
    const value = manifest('quest-10m');
    const report = boundaryReport(value);
    expect(validateQuestBoundaryReport(report, value).ok).toBe(true);
    const result = adjudicateValidationEvidence({
      manifest: value,
      loadTestReports: [report],
      guidedUxSubmission: null,
      cohort: { boundaryAttemptCount: 3, boundaryCompletedRunCount: 3 },
    });
    expect(result.gateResults.map((gate) => gate.gate)).toEqual(['RF-029', 'RF-051']);
    expect(result.gateResults.every((gate) => gate.status === 'PASS')).toBe(true);
    expect(
      result.gateResults.some((gate) =>
        gate.reasons.some((reason) => reason.includes('does not qualify PERF-04'))
      )
    ).toBe(true);
  });

  it('rejects any boundary report that claims final 10M device qualification', () => {
    const value = manifest('quest-10m');
    const report = boundaryReport(value);
    report.qualification.deviceQualifiedAt10m = true;
    const result = adjudicateValidationEvidence({
      manifest: value,
      loadTestReports: [report],
      guidedUxSubmission: null,
    });
    expect(result.aggregateStatus).toBe('INVALID_RUN');
  });
});

describe('QV4 guided UX claim boundary', () => {
  it('keeps a complete all-pass guided run PARTIAL until governed human/cross-session criteria exist', () => {
    const value = manifest('quest-ux');
    const result = adjudicateValidationEvidence({
      manifest: value,
      loadTestReports: [],
      guidedUxSubmission: uxSubmission(value),
    });
    expect(result.aggregateStatus).toBe('PARTIAL');
  });

  it('records a task failure as FAIL', () => {
    const value = manifest('quest-ux');
    const result = adjudicateValidationEvidence({
      manifest: value,
      loadTestReports: [],
      guidedUxSubmission: uxSubmission(value, GUIDED_UX_TASKS[0].id),
    });
    expect(result.aggregateStatus).toBe('FAIL');
  });
});
