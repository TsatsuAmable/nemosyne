import {
  LOAD_TEST_THRESHOLDS,
  computeVerdict,
  type VerdictGrade,
} from '../src/vr/scalability/LoadTestThresholds.ts';
import {
  GUIDED_UX_TASKS,
  validateGuidedUxSubmission,
  type GuidedUxSubmission,
} from '../src/validation/guided-ux-validation.ts';
import type {
  GateDispositionStatus,
  ValidationManifest,
} from '../src/validation/validation-manifest.ts';

export const VALIDATION_ADJUDICATION_SCHEMA_VERSION = '1';
export const VALIDATION_ADJUDICATOR_VERSION = 'qv4-v1';
export const QUALIFICATION_REPEAT_TARGET = 3;

export interface GateAdjudication {
  gate: string;
  status: GateDispositionStatus;
  reasons: string[];
}

export interface ValidationAdjudicationCohort {
  perfPassingRunCount: number;
  perfCompletedRunCount: number;
  boundaryCompletedRunCount: number;
  boundaryAttemptCount: number;
}

export interface ValidationPrerequisiteState {
  satisfied: boolean;
  reason: string;
}

export interface ValidationAdjudicationInput {
  manifest: ValidationManifest;
  loadTestReports: unknown[];
  guidedUxSubmission: GuidedUxSubmission | null;
  cohort?: Partial<ValidationAdjudicationCohort>;
  prerequisites?: Record<string, ValidationPrerequisiteState[]>;
}

export interface ValidationAdjudicationResult {
  schemaVersion: typeof VALIDATION_ADJUDICATION_SCHEMA_VERSION;
  adjudicatorVersion: typeof VALIDATION_ADJUDICATOR_VERSION;
  sessionId: string;
  sessionLabel: string;
  buildId: string;
  validationMode: ValidationManifest['validationMode'];
  evidenceClass: ValidationManifest['evidenceClass'];
  analyzerValid: boolean;
  validationErrors: string[];
  cohort: ValidationAdjudicationCohort;
  gateResults: GateAdjudication[];
  aggregateStatus: GateDispositionStatus;
  aggregateReasons: string[];
}

export interface QuestPerfReportValidation {
  ok: boolean;
  errors: string[];
  aborted: boolean;
  corePass: boolean;
  coreFailureReasons: string[];
}

export interface QuestBoundaryReportValidation {
  ok: boolean;
  errors: string[];
  outcome: 'completed' | 'failed' | 'aborted' | null;
}

const QUEST_PERF_PROFILE = 'quest-3s-qualification';
const QUEST_BOUNDARY_PROFILE = 'quest-3s-rust-boundary-10m';

/**
 * Mirrors the production Quest profile deliberately. A test must compare this
 * signature against QUEST_3S_QUALIFICATION_PROFILE so profile drift cannot be
 * silently adjudicated under stale expectations.
 */
export const QUEST_PERF_STEP_POLICY = [
  { rowCount: 1_000, durationSec: 30, requiredForPerf04: true, label: '1k baseline' },
  { rowCount: 8_000, durationSec: 30, requiredForPerf04: true, label: '8k baseline' },
  { rowCount: 65_000, durationSec: 45, requiredForPerf04: true, label: '65k scale' },
  { rowCount: 100_000, durationSec: 300, requiredForPerf04: true, label: '100k soak' },
  { rowCount: 250_000, durationSec: 60, requiredForPerf04: false, label: '250k stretch' },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function objectAt(record: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = record[key];
  return isRecord(value) ? value : null;
}

function exactThresholds(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Object.entries(LOAD_TEST_THRESHOLDS).every(([key, expected]) => value[key] === expected);
}

function validatePhysicalRuntimeIdentity(
  report: Record<string, unknown>,
  manifest: ValidationManifest,
  errors: string[]
): void {
  const device = objectAt(report, 'device');
  if (!device) {
    errors.push('device runtime evidence is missing');
    return;
  }
  if (device.declaredDeviceTarget !== 'META_QUEST_3S') {
    errors.push('device target must be META_QUEST_3S');
  }
  if (device.identityBasis !== 'adb-system-property') {
    errors.push('governed device identity basis must be adb-system-property');
  }
  if (device.buildId !== manifest.buildId) {
    errors.push('runtime buildId does not match the validation manifest');
  }
  const expectedFirmware = manifest.deviceIdentity?.buildIncremental ?? null;
  if (!expectedFirmware) {
    errors.push('manifest is missing machine-captured device identity');
  } else if (device.declaredFirmwareVersion !== expectedFirmware) {
    errors.push('runtime device build does not match the machine-captured manifest identity');
  }
  const xr = objectAt(device, 'xr');
  if (!xr || xr.active !== true) {
    errors.push('device runtime must confirm an active XR session');
  }
}

function validateCollectionPolicy(report: Record<string, unknown>, errors: string[]): void {
  const collection = objectAt(report, 'collection');
  if (!collection) {
    errors.push('bounded collection policy is missing');
    return;
  }
  if (collection.rawFrameTraceIncluded !== false) errors.push('raw frame trace policy missing');
  if (collection.datasetRowsIncluded !== false) errors.push('dataset row policy missing');
  if (collection.cameraPosesIncluded !== false) errors.push('camera pose policy missing');
}

function validatePerfStep(
  value: unknown,
  expected: (typeof QUEST_PERF_STEP_POLICY)[number],
  index: number,
  errors: string[]
): VerdictGrade | null {
  if (!isRecord(value)) {
    errors.push(`step ${index + 1} must be an object`);
    return null;
  }
  const spec = objectAt(value, 'spec');
  if (!spec) {
    errors.push(`step ${index + 1} is missing its spec`);
    return null;
  }
  if (spec.topology !== 'TABULAR') errors.push(`step ${index + 1} topology must be TABULAR`);
  if (spec.rowCount !== expected.rowCount) {
    errors.push(`step ${index + 1} rowCount must be ${expected.rowCount}`);
  }
  if (spec.durationSec !== expected.durationSec) {
    errors.push(`step ${index + 1} durationSec must be ${expected.durationSec}`);
  }

  const frames = objectAt(value, 'frames');
  if (!frames) {
    errors.push(`step ${index + 1} frame statistics are missing`);
    return null;
  }
  for (const field of ['p95Ms', 'p99Ms', 'droppedPct'] as const) {
    if (!finiteNumber(frames[field])) errors.push(`step ${index + 1} frames.${field} must be finite`);
  }
  if (!finiteNumber(value.criticalViolations) || value.criticalViolations < 0) {
    errors.push(`step ${index + 1} criticalViolations must be a non-negative number`);
    return null;
  }
  if (
    !finiteNumber(frames.p95Ms) ||
    !finiteNumber(frames.p99Ms) ||
    !finiteNumber(frames.droppedPct)
  ) {
    return null;
  }

  const recomputed = computeVerdict({
    frames: frames as unknown as Parameters<typeof computeVerdict>[0]['frames'],
    criticalViolations: value.criticalViolations,
  });
  if (value.grade !== recomputed.grade) {
    errors.push(
      `step ${index + 1} reported grade '${String(value.grade)}' does not match recomputed '${recomputed.grade}'`
    );
  }
  return recomputed.grade;
}

export function validateQuestPerformanceReport(
  value: unknown,
  manifest: ValidationManifest
): QuestPerfReportValidation {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return {
      ok: false,
      errors: ['performance report must be an object'],
      aborted: false,
      corePass: false,
      coreFailureReasons: [],
    };
  }
  if (value.version !== '2') errors.push('performance report version must be 2');
  if (value.profileName !== QUEST_PERF_PROFILE) errors.push(`profileName must be ${QUEST_PERF_PROFILE}`);
  if (value.xrActive !== true) errors.push('xrActive must be true');
  const aborted = value.aborted === true;
  if (typeof value.aborted !== 'boolean') errors.push('aborted must be boolean');
  validatePhysicalRuntimeIdentity(value, manifest, errors);
  validateCollectionPolicy(value, errors);
  if (!exactThresholds(value.thresholds)) {
    errors.push('reported thresholds do not match the governed fixed threshold authority');
  }

  const steps = Array.isArray(value.steps) ? value.steps : [];
  if (!Array.isArray(value.steps) || steps.length === 0) errors.push('steps must be non-empty');
  if (!aborted && steps.length !== QUEST_PERF_STEP_POLICY.length) {
    errors.push(`completed performance report must contain exactly ${QUEST_PERF_STEP_POLICY.length} steps`);
  }
  if (steps.length > QUEST_PERF_STEP_POLICY.length) {
    errors.push('performance report contains more steps than the governed profile');
  }

  const grades: Array<VerdictGrade | null> = [];
  for (let index = 0; index < steps.length && index < QUEST_PERF_STEP_POLICY.length; index += 1) {
    grades.push(validatePerfStep(steps[index], QUEST_PERF_STEP_POLICY[index], index, errors));
  }

  const coreFailureReasons: string[] = [];
  if (!aborted) {
    QUEST_PERF_STEP_POLICY.forEach((policy, index) => {
      if (!policy.requiredForPerf04) return;
      const grade = grades[index];
      if (grade !== 'green') {
        coreFailureReasons.push(`${policy.label} adjudicated ${grade ?? 'invalid'}; PERF-04 requires green`);
      }
    });
  }
  const corePass = !aborted && errors.length === 0 && coreFailureReasons.length === 0;
  return { ok: errors.length === 0, errors, aborted, corePass, coreFailureReasons };
}

export function validateQuestBoundaryReport(
  value: unknown,
  manifest: ValidationManifest
): QuestBoundaryReportValidation {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, errors: ['boundary report must be an object'], outcome: null };
  }
  if (value.version !== '1') errors.push('boundary report version must be 1');
  if (value.profileName !== QUEST_BOUNDARY_PROFILE) errors.push(`profileName must be ${QUEST_BOUNDARY_PROFILE}`);
  if (value.xrActive !== true) errors.push('xrActive must be true');
  validatePhysicalRuntimeIdentity(value, manifest, errors);
  validateCollectionPolicy(value, errors);

  const scenario = objectAt(value, 'scenario');
  if (!scenario || scenario.rows !== 10_000_000) errors.push('boundary scenario must contain exactly 10M rows');
  const outcomeValue = objectAt(value, 'outcome')?.status;
  const outcome = ['completed', 'failed', 'aborted'].includes(String(outcomeValue))
    ? (outcomeValue as 'completed' | 'failed' | 'aborted')
    : null;
  if (!outcome) errors.push('boundary outcome status must be completed|failed|aborted');

  const qualification = objectAt(value, 'qualification');
  if (!qualification) {
    errors.push('boundary qualification guard is missing');
  } else {
    if (qualification.deviceQualifiedAt10m !== false) {
      errors.push('10M boundary evidence must never claim deviceQualifiedAt10m');
    }
    if (qualification.promotionBlockedByAudits !== true) {
      errors.push('10M boundary evidence must retain the audit/promotion block');
    }
  }

  if (outcome === 'completed') {
    const evidence = objectAt(value, 'evidence');
    if (!evidence) {
      errors.push('completed boundary report is missing evidence');
    } else {
      if (evidence.structureProfileRowCount !== 10_000_000) {
        errors.push('completed boundary report must contain a 10M structure profile');
      }
      if (evidence.rowMaterialisations !== 0) {
        errors.push('completed boundary report detected row materialisation');
      }
      if (evidence.checksumParity !== true) {
        errors.push('completed boundary report is missing borrowed-scan checksum parity');
      }
    }
  }
  return { ok: errors.length === 0, errors, outcome };
}

function emptyCohort(value?: Partial<ValidationAdjudicationCohort>): ValidationAdjudicationCohort {
  return {
    perfPassingRunCount: Math.max(0, value?.perfPassingRunCount ?? 0),
    perfCompletedRunCount: Math.max(0, value?.perfCompletedRunCount ?? 0),
    boundaryCompletedRunCount: Math.max(0, value?.boundaryCompletedRunCount ?? 0),
    boundaryAttemptCount: Math.max(0, value?.boundaryAttemptCount ?? 0),
  };
}

function gate(gateId: string, status: GateDispositionStatus, reasons: string[]): GateAdjudication {
  return { gate: gateId, status, reasons: reasons.slice(0, 32) };
}

function applyPrerequisites(
  result: GateAdjudication,
  prerequisites: Record<string, ValidationPrerequisiteState[]> | undefined
): GateAdjudication {
  const missing = (prerequisites?.[result.gate] ?? []).filter((item) => !item.satisfied);
  if (missing.length === 0) return result;
  return gate(
    result.gate,
    'BLOCKED',
    missing.map((item) => item.reason || `prerequisite for ${result.gate} is not satisfied`)
  );
}

function blockingManifestInvalidations(manifest: ValidationManifest): string[] {
  if (manifest.validationMode !== 'quest-10m') return [...manifest.invalidations];
  return manifest.invalidations.filter(
    (reason) => reason !== 'quest-10m boundary probe is not final 10M device qualification'
  );
}

function aggregate(results: GateAdjudication[]): { status: GateDispositionStatus; reasons: string[] } {
  if (results.length === 0) {
    return { status: 'PARTIAL', reasons: ['no governed gate is adjudicable in this validation mode'] };
  }
  const order: GateDispositionStatus[] = ['INVALID_RUN', 'FAIL', 'BLOCKED', 'PARTIAL', 'PASS'];
  const status = order.find((candidate) => results.some((result) => result.status === candidate)) ?? 'PARTIAL';
  const reasons = results
    .filter((result) => result.status === status)
    .flatMap((result) => result.reasons.map((reason) => `${result.gate}: ${reason}`));
  return { status, reasons: reasons.slice(0, 32) };
}

export function adjudicateValidationEvidence(
  input: ValidationAdjudicationInput
): ValidationAdjudicationResult {
  const { manifest } = input;
  const cohort = emptyCohort(input.cohort);
  const validationErrors: string[] = [];
  let gateResults: GateAdjudication[] = [];

  const manifestInvalidations = blockingManifestInvalidations(manifest);
  if (manifestInvalidations.length > 0) {
    gateResults = manifest.gates.map((gateId) => gate(gateId, 'INVALID_RUN', manifestInvalidations));
    validationErrors.push(...manifestInvalidations);
  } else if (manifest.validationMode === 'quest-perf') {
    const reports = input.loadTestReports.filter(
      (candidate) => isRecord(candidate) && candidate.profileName === QUEST_PERF_PROFILE
    );
    if (reports.length === 0) {
      gateResults = manifest.gates.map((gateId) =>
        gate(gateId, 'PARTIAL', ['performance evidence has not been captured'])
      );
    } else if (reports.length !== 1) {
      const errors = [
        `performance session contains ${reports.length} terminal reports; governed runs require exactly one report per session`,
      ];
      validationErrors.push(...errors);
      gateResults = manifest.gates.map((gateId) => gate(gateId, 'INVALID_RUN', errors));
    } else {
      const checked = validateQuestPerformanceReport(reports[0], manifest);
      validationErrors.push(...checked.errors);
      if (!checked.ok) {
        gateResults = manifest.gates.map((gateId) => gate(gateId, 'INVALID_RUN', checked.errors));
      } else if (checked.aborted) {
        gateResults = manifest.gates.map((gateId) =>
          gate(gateId, 'PARTIAL', [
            'performance run was aborted; retained as evidence but cannot pass a gate',
          ])
        );
      } else {
        const perf04 = checked.corePass
          ? cohort.perfPassingRunCount >= QUALIFICATION_REPEAT_TARGET
            ? gate('PERF-04', 'PASS', [
                `${cohort.perfPassingRunCount} independently captured qualifying render runs match the exact build/device`,
              ])
            : gate('PERF-04', 'PARTIAL', [
                `current run meets governed frame thresholds, but ${cohort.perfPassingRunCount}/${QUALIFICATION_REPEAT_TARGET} qualifying repeated runs are captured`,
              ])
          : gate('PERF-04', 'FAIL', checked.coreFailureReasons);
        const perf05 = gate('PERF-05', 'PARTIAL', [
          'allocation/GC evidence was captured, but PERF-05 has no fixed automatic device pass threshold; QV4 will not invent one',
        ]);
        gateResults = [perf04, perf05];
      }
    }
  } else if (manifest.validationMode === 'quest-10m') {
    const reports = input.loadTestReports.filter(
      (candidate) => isRecord(candidate) && candidate.profileName === QUEST_BOUNDARY_PROFILE
    );
    if (reports.length === 0) {
      gateResults = manifest.gates.map((gateId) =>
        gate(gateId, 'PARTIAL', ['10M boundary evidence has not been captured'])
      );
    } else if (reports.length !== 1) {
      const errors = [
        `10M boundary session contains ${reports.length} terminal reports; governed runs require exactly one report per session`,
      ];
      validationErrors.push(...errors);
      gateResults = manifest.gates.map((gateId) => gate(gateId, 'INVALID_RUN', errors));
    } else {
      const checked = validateQuestBoundaryReport(reports[0], manifest);
      validationErrors.push(...checked.errors);
      if (!checked.ok) {
        gateResults = manifest.gates.map((gateId) => gate(gateId, 'INVALID_RUN', checked.errors));
      } else if (checked.outcome === 'failed') {
        gateResults = manifest.gates.map((gateId) =>
          gate(gateId, 'FAIL', [
            '10M boundary exercise failed; failure is preserved as governed evidence',
          ])
        );
      } else if (checked.outcome === 'aborted') {
        gateResults = manifest.gates.map((gateId) =>
          gate(gateId, 'PARTIAL', [
            '10M boundary exercise was aborted; no qualification claim is made',
          ])
        );
      } else {
        const status: GateDispositionStatus =
          cohort.boundaryCompletedRunCount >= QUALIFICATION_REPEAT_TARGET ? 'PASS' : 'PARTIAL';
        const reasons =
          status === 'PASS'
            ? [
                `${cohort.boundaryCompletedRunCount} completed 10M boundary runs match the exact build/device; this still does not qualify PERF-04`,
              ]
            : [
                `10M boundary path completed, but ${cohort.boundaryCompletedRunCount}/${QUALIFICATION_REPEAT_TARGET} repeated completed runs are captured; this does not qualify PERF-04`,
              ];
        gateResults = manifest.gates.map((gateId) => gate(gateId, status, reasons));
      }
    }
  } else if (manifest.validationMode === 'quest-ux') {
    const submission = input.guidedUxSubmission;
    if (!submission) {
      gateResults = manifest.gates.map((gateId) =>
        gate(gateId, 'PARTIAL', ['guided UX evidence has not been submitted'])
      );
    } else {
      const errors = validateGuidedUxSubmission(submission);
      validationErrors.push(...errors);
      if (errors.length > 0) {
        gateResults = manifest.gates.map((gateId) => gate(gateId, 'INVALID_RUN', errors));
      } else {
        const failures = submission.results.filter((result) => result.outcome === 'fail');
        const notRun = submission.results.filter((result) => result.outcome === 'not-run');
        const baseStatus: GateDispositionStatus = failures.length > 0 ? 'FAIL' : 'PARTIAL';
        const reasons =
          failures.length > 0
            ? failures.map((result) => `${result.taskId} failed on ${result.inputModality}`)
            : notRun.length > 0
              ? [`${notRun.length}/${GUIDED_UX_TASKS.length} governed tasks remain NOT RUN`]
              : [
                  'complete guided physical UX evidence captured; no current UX gate has a fixed automatic promotion criterion, so human/cross-session review remains required',
                ];
        gateResults = manifest.gates.map((gateId) => gate(gateId, baseStatus, reasons));
      }
    }
  } else {
    gateResults = [];
  }

  gateResults = gateResults.map((result) => applyPrerequisites(result, input.prerequisites));
  const aggregateResult = aggregate(gateResults);
  return {
    schemaVersion: VALIDATION_ADJUDICATION_SCHEMA_VERSION,
    adjudicatorVersion: VALIDATION_ADJUDICATOR_VERSION,
    sessionId: manifest.sessionId,
    sessionLabel: manifest.sessionLabel,
    buildId: manifest.buildId,
    validationMode: manifest.validationMode,
    evidenceClass: manifest.evidenceClass,
    analyzerValid: validationErrors.length === 0,
    validationErrors: validationErrors.slice(0, 64),
    cohort,
    gateResults,
    aggregateStatus: aggregateResult.status,
    aggregateReasons: aggregateResult.reasons,
  };
}
