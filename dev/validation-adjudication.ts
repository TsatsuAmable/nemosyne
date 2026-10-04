import {
  LOAD_TEST_THRESHOLDS,
  computeVerdict,
  type StepFrameStats,
  type StepResult,
  type VerdictGrade,
} from '../src/vr/scalability/LoadTestThresholds.ts';
import {
  GUIDED_UX_TASKS,
  validateGuidedUxSubmission,
  type GuidedUxSubmission,
} from '../src/validation/guided-ux-validation.ts';
import {
  QCA0_PROFILE_NAME,
  QUEST_PERFORMANCE_PROFILES,
  type GateDispositionStatus,
  type QuestPerformanceProfile,
  type ValidationManifest,
} from '../src/validation/validation-manifest.ts';
import type { Uxr4EvidenceObservation } from '../src/validation/uxr4-verification-envelope.ts';

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
  captureStatus: Qca0CaptureStatus;
  qca0Analysis: Qca0ScaleKneeAnalysis | null;
  validationErrors: string[];
  cohort: ValidationAdjudicationCohort;
  gateResults: GateAdjudication[];
  aggregateStatus: GateDispositionStatus;
  aggregateReasons: string[];
  /** UXR4 evidence contributed by this lane only. Cross-lane completeness is adjudicated separately. */
  uxr4Observations: Uxr4EvidenceObservation[];
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

export const QUEST_PERF_PROFILE: QuestPerformanceProfile = 'quest-3s-qualification';
const QUEST_BOUNDARY_PROFILE = 'quest-3s-rust-boundary-10m';

export interface QuestPerformanceStepPolicy {
  rowCount: number;
  durationSec: number;
  warmup: boolean;
  requiredForPerf04: boolean;
  label: string;
}

export interface QuestPerformanceProfilePolicy {
  profileName: QuestPerformanceProfile;
  repeatQualifying: boolean;
  steps: readonly QuestPerformanceStepPolicy[];
}

/**
 * Existing PERF-04 staircase policy remains the promotion authority. Long-session
 * profiles reuse the same fixed frame thresholds only as falsifiers; they do not
 * acquire a resource-boundedness PASS rule by existing.
 */
export const QUEST_PERF_STEP_POLICY = [
  { rowCount: 1_000, durationSec: 30, requiredForPerf04: true, label: '1k baseline' },
  { rowCount: 8_000, durationSec: 30, requiredForPerf04: true, label: '8k baseline' },
  { rowCount: 65_000, durationSec: 45, requiredForPerf04: true, label: '65k scale' },
  { rowCount: 100_000, durationSec: 300, requiredForPerf04: true, label: '100k soak' },
  { rowCount: 250_000, durationSec: 60, requiredForPerf04: false, label: '250k stretch' },
] as const;

export const QUEST_PERFORMANCE_PROFILE_POLICIES: Record<
  QuestPerformanceProfile,
  QuestPerformanceProfilePolicy
> = {
  'quest-3s-qualification': {
    profileName: 'quest-3s-qualification',
    repeatQualifying: true,
    steps: [
      {
        rowCount: 1_000,
        durationSec: 15,
        warmup: true,
        requiredForPerf04: false,
        label: 'warmup (ungraded)',
      },
      ...QUEST_PERF_STEP_POLICY.map((step) => ({ ...step, warmup: false })),
    ],
  },
  'uxr0-functional-5m': {
    profileName: 'uxr0-functional-5m',
    repeatQualifying: false,
    steps: [
      {
        rowCount: 100_000,
        durationSec: 30,
        warmup: true,
        requiredForPerf04: false,
        label: 'same-scale warmup (ungraded)',
      },
      {
        rowCount: 100_000,
        durationSec: 300,
        warmup: false,
        requiredForPerf04: true,
        label: 'functional-5m',
      },
    ],
  },
  'uxr0-resource-trend-30m': {
    profileName: 'uxr0-resource-trend-30m',
    repeatQualifying: false,
    steps: [
      {
        rowCount: 100_000,
        durationSec: 30,
        warmup: true,
        requiredForPerf04: false,
        label: 'same-scale warmup (ungraded)',
      },
      {
        rowCount: 100_000,
        durationSec: 1_800,
        warmup: false,
        requiredForPerf04: true,
        label: 'resource-trend-30m',
      },
    ],
  },
  'uxr0-sustained-60m': {
    profileName: 'uxr0-sustained-60m',
    repeatQualifying: false,
    steps: [
      {
        rowCount: 100_000,
        durationSec: 30,
        warmup: true,
        requiredForPerf04: false,
        label: 'same-scale warmup (ungraded)',
      },
      {
        rowCount: 100_000,
        durationSec: 3_600,
        warmup: false,
        requiredForPerf04: true,
        label: 'sustained-60m',
      },
    ],
  },
};

export type Qca0CaptureStatus = 'PENDING' | 'VALID_CAPTURE' | 'INVALID_RUN';
export type Qca0Authorization = 'QCA2' | 'QCA4';
export type Qca0BottleneckKind =
  'FRAME_CADENCE' | 'GPU_SCENE_COST' | 'LOAD_DURATION' | 'GOVERNOR_PRESSURE';
export type Qca0StepObservation = StepResult;

export interface Qca0BottleneckIndicator {
  kind: Qca0BottleneckKind;
  ratio: number;
  kneeRowCount: number;
  previousRowCount: number;
}

export interface Qca0KneeRatios {
  frame: number;
  load: number;
  scene: number;
  governor: number;
}

export interface Qca0ScaleKneeAnalysis {
  captureStatus: Qca0CaptureStatus;
  validationErrors: string[];
  steps: Qca0StepObservation[];
  lastGreenRowCount: number | null;
  kneeRowCount: number | null;
  kneeRatios: Qca0KneeRatios | null;
  bottleneckIndicators: Qca0BottleneckIndicator[];
  authorizations: Qca0Authorization[];
  nextExperiments: Partial<Record<Qca0Authorization, string>>;
}

const QCA0_STEP_POLICY = [
  { rowCount: 1_000, durationSec: 10, warmup: true },
  { rowCount: 1_000, durationSec: 15, warmup: false },
  { rowCount: 8_000, durationSec: 15, warmup: false },
  { rowCount: 32_000, durationSec: 15, warmup: false },
  { rowCount: 65_000, durationSec: 15, warmup: false },
  { rowCount: 100_000, durationSec: 30, warmup: false },
] as const;

const QCA0_QCA2_EXPERIMENT =
  'Add stage timing at the knee across Worker/WASM, arbitration, representation construction, and upload without changing execution behavior.';
const QCA0_QCA4_EXPERIMENT =
  'Hold source rows and load path at the knee constant; cap submitted/rendered nodes to the preceding graded cardinality.';

function invalidQca0(errors: string[]): Qca0ScaleKneeAnalysis {
  return {
    captureStatus: 'INVALID_RUN',
    validationErrors: errors.slice(0, 64),
    steps: [],
    lastGreenRowCount: null,
    kneeRowCount: null,
    kneeRatios: null,
    bottleneckIndicators: [],
    authorizations: [],
    nextExperiments: {},
  };
}

function validateQca0FrameStats(
  value: unknown,
  path: string,
  errors: string[]
): value is StepFrameStats {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return false;
  }
  for (const field of [
    'frameCount',
    'dropped',
    'droppedPct',
    'p50Ms',
    'p95Ms',
    'p99Ms',
    'avgMs',
    'minMs',
    'maxMs',
    'fpsAvg',
    'gcSpikes',
  ] as const) {
    if (!finiteNumber(value[field])) errors.push(`${path}.${field} must be finite`);
  }
  return true;
}

function nullableFinite(value: unknown): boolean {
  return value === null || finiteNumber(value);
}

function qca0VerdictFrames(step: StepResult): StepFrameStats {
  return step.frameCadence.frameCount > 0 ? step.frameCadence : step.frames;
}

function ratio(current: number, previous: number): number {
  return current / Math.max(previous, 1);
}

function nullableRatio(current: number | null, previous: number | null): number | null {
  return current === null || previous === null ? null : ratio(current, previous);
}

function deriveQca0Knee(steps: StepResult[]): {
  lastGreenRowCount: number | null;
  kneeIndex: number | null;
} {
  const graded = steps.filter((step) => step.spec.warmup !== true);
  let kneeIndex = graded.findIndex((step) => step.grade === 'red');
  if (kneeIndex < 0) {
    kneeIndex = graded.findIndex((step, index) => {
      if (index === 0) return false;
      const previous = qca0VerdictFrames(graded[index - 1]);
      const current = qca0VerdictFrames(step);
      return (
        (previous.p95Ms <= LOAD_TEST_THRESHOLDS.FRAME_GREEN_MS &&
          current.p95Ms > LOAD_TEST_THRESHOLDS.FRAME_GREEN_MS) ||
        (previous.droppedPct < LOAD_TEST_THRESHOLDS.DROPPED_GREEN_PCT &&
          current.droppedPct >= LOAD_TEST_THRESHOLDS.DROPPED_GREEN_PCT)
      );
    });
  }
  const normalizedKneeIndex = kneeIndex < 0 ? null : kneeIndex;
  const greenBeforeKnee = graded.filter(
    (step, index) =>
      step.grade === 'green' && (normalizedKneeIndex === null || index < normalizedKneeIndex)
  );
  return {
    lastGreenRowCount:
      greenBeforeKnee.length > 0
        ? Math.max(...greenBeforeKnee.map((step) => step.spec.rowCount))
        : null,
    kneeIndex: normalizedKneeIndex,
  };
}

function deriveQca0Ratios(previous: StepResult, knee: StepResult): Qca0KneeRatios {
  const previousFrames = qca0VerdictFrames(previous);
  const kneeFrames = qca0VerdictFrames(knee);
  const sceneRatios = [
    ratio(knee.gpu.trianglesAvg, previous.gpu.trianglesAvg),
    ratio(knee.gpu.drawCallsAvg, previous.gpu.drawCallsAvg),
    nullableRatio(
      knee.representation.visibleSceneObjectCountEnd,
      previous.representation.visibleSceneObjectCountEnd
    ),
    nullableRatio(knee.representation.renderedNodeCount, previous.representation.renderedNodeCount),
  ].filter((value): value is number => value !== null && Number.isFinite(value));
  return {
    frame: ratio(kneeFrames.p95Ms, previousFrames.p95Ms),
    load: ratio(knee.loadDurationMs, previous.loadDurationMs),
    scene: Math.max(...sceneRatios),
    governor: ratio(
      knee.representation.governorThrottleEvents,
      previous.representation.governorThrottleEvents
    ),
  };
}

function rankQca0Indicators(
  ratios: Qca0KneeRatios,
  knee: StepResult,
  previous: StepResult
): Qca0BottleneckIndicator[] {
  const priority: Record<Qca0BottleneckKind, number> = {
    FRAME_CADENCE: 0,
    GPU_SCENE_COST: 1,
    LOAD_DURATION: 2,
    GOVERNOR_PRESSURE: 3,
  };
  const values: Array<[Qca0BottleneckKind, number]> = [
    ['FRAME_CADENCE', ratios.frame],
    ['GPU_SCENE_COST', ratios.scene],
    ['LOAD_DURATION', ratios.load],
    ['GOVERNOR_PRESSURE', ratios.governor],
  ];
  return values
    .filter(([, value]) => Number.isFinite(value))
    .sort(([aKind, a], [bKind, b]) => b - a || priority[aKind] - priority[bKind])
    .slice(0, 3)
    .map(([kind, value]) => ({
      kind,
      ratio: value,
      kneeRowCount: knee.spec.rowCount,
      previousRowCount: previous.spec.rowCount,
    }));
}

export function analyzeQca0ScaleKneeReport(
  value: unknown,
  manifest: ValidationManifest
): Qca0ScaleKneeAnalysis {
  const errors: string[] = [];
  if (manifest.validationMode !== 'quest-qca0') errors.push('manifest mode must be quest-qca0');
  if (manifest.profile !== QCA0_PROFILE_NAME) {
    errors.push(`manifest profile must be ${QCA0_PROFILE_NAME}`);
  }
  if (manifest.invalidations.length > 0 || !manifest.promotionEligible) {
    errors.push(...manifest.invalidations);
    if (manifest.invalidations.length === 0)
      errors.push('manifest is not eligible for governed capture');
  }
  if (!isRecord(value)) return invalidQca0([...errors, 'QCA0 report must be one object']);
  if (value.version !== '2') errors.push('QCA0 report version must be 2');
  if (value.profileName !== QCA0_PROFILE_NAME) {
    errors.push(`profileName must be ${QCA0_PROFILE_NAME}`);
  }
  if (value.xrActive !== true) errors.push('xrActive must be true');
  if (value.aborted !== false) errors.push('completed QCA0 report must not be aborted');
  if (value.failure != null) errors.push('completed QCA0 report must not contain a failure');
  validatePhysicalRuntimeIdentity(value, manifest, errors);
  validateCollectionPolicy(value, errors);
  if (!exactThresholds(value.thresholds)) {
    errors.push('reported thresholds do not match the governed fixed threshold authority');
  }

  const rawSteps = Array.isArray(value.steps) ? value.steps : [];
  if (rawSteps.length !== QCA0_STEP_POLICY.length) {
    errors.push(`completed QCA0 report must contain exactly ${QCA0_STEP_POLICY.length} steps`);
  }
  const steps: StepResult[] = [];
  for (let index = 0; index < rawSteps.length && index < QCA0_STEP_POLICY.length; index += 1) {
    const raw = rawSteps[index];
    const expected = QCA0_STEP_POLICY[index];
    if (!isRecord(raw)) {
      errors.push(`step ${index + 1} must be an object`);
      continue;
    }
    const spec = objectAt(raw, 'spec');
    if (!spec) {
      errors.push(`step ${index + 1} is missing its spec`);
      continue;
    }
    if (spec.topology !== 'TABULAR') errors.push(`step ${index + 1} topology must be TABULAR`);
    if (spec.rowCount !== expected.rowCount) {
      errors.push(`step ${index + 1} rowCount must be ${expected.rowCount}`);
    }
    if (spec.durationSec !== expected.durationSec) {
      errors.push(`step ${index + 1} durationSec must be ${expected.durationSec}`);
    }
    if ((spec.warmup === true) !== expected.warmup) {
      errors.push(`step ${index + 1} warmup flag does not match the governed profile`);
    }
    const framesOk = validateQca0FrameStats(raw.frames, `step ${index + 1} frames`, errors);
    const cadenceOk = validateQca0FrameStats(
      raw.frameCadence,
      `step ${index + 1} frameCadence`,
      errors
    );
    const gpu = objectAt(raw, 'gpu');
    if (!gpu) {
      errors.push(`step ${index + 1} GPU statistics are missing`);
    } else {
      for (const field of [
        'drawCallsMax',
        'drawCallsAvg',
        'trianglesMax',
        'trianglesAvg',
        'pointsMax',
        'pointsAvg',
        'linesMax',
        'linesAvg',
        'geometriesMax',
        'texturesMax',
      ] as const) {
        if (!finiteNumber(gpu[field])) errors.push(`step ${index + 1} gpu.${field} must be finite`);
      }
    }
    const memory = objectAt(raw, 'memory');
    if (!memory) {
      errors.push(`step ${index + 1} memory statistics are missing`);
    } else {
      for (const field of [
        'jsHeapStartBytes',
        'jsHeapPeakBytes',
        'jsHeapEndBytes',
        'jsHeapDeltaBytes',
        'wasmStartBytes',
        'wasmPeakBytes',
        'wasmEndBytes',
        'wasmDeltaBytes',
      ] as const) {
        if (!nullableFinite(memory[field])) {
          errors.push(`step ${index + 1} memory.${field} must be finite or null`);
        }
      }
    }
    const representation = objectAt(raw, 'representation');
    if (!representation) {
      errors.push(`step ${index + 1} representation evidence is missing`);
    } else {
      if (representation.sourceRowCount !== expected.rowCount) {
        errors.push(`step ${index + 1} representation sourceRowCount must be ${expected.rowCount}`);
      }
      if (
        !finiteNumber(representation.renderedNodeCount) ||
        representation.renderedNodeCount <= 0
      ) {
        errors.push(`step ${index + 1} renderedNodeCount must be positive`);
      }
      if (representation.coverageMode !== 'ROW_ADDRESSABLE') {
        errors.push(`step ${index + 1} coverageMode must be ROW_ADDRESSABLE`);
      }
      if (
        representation.candidateId !== 'POINT_SET' &&
        representation.candidateId !== 'MATRIX_FIELD'
      ) {
        errors.push(`step ${index + 1} candidateId must be POINT_SET or MATRIX_FIELD`);
      }
      if (representation.semanticEmbodimentStatus !== null) {
        errors.push(`step ${index + 1} semanticEmbodimentStatus must be null`);
      }
      if (representation.geometry !== 'INSTANCED_POINT_CLOUD') {
        errors.push(`step ${index + 1} geometry must be INSTANCED_POINT_CLOUD`);
      }
      if (representation.layout !== 'GRID_3D')
        errors.push(`step ${index + 1} layout must be GRID_3D`);
      if (representation.usefulRepresentation !== true) {
        errors.push(`step ${index + 1} representation must be useful`);
      }
      for (const field of [
        'sceneObjectCountStart',
        'sceneObjectCountEnd',
        'sceneObjectCountDelta',
        'visibleSceneObjectCountStart',
        'visibleSceneObjectCountEnd',
        'visibleSceneObjectCountDelta',
        'governorLodScaleMinimum',
        'governorLodScaleFinal',
      ] as const) {
        if (!nullableFinite(representation[field])) {
          errors.push(`step ${index + 1} representation.${field} must be finite or null`);
        }
      }
      if (!finiteNumber(representation.governorThrottleEvents)) {
        errors.push(`step ${index + 1} governorThrottleEvents must be finite`);
      }
    }
    if (!finiteNumber(raw.loadDurationMs) || raw.loadDurationMs < 0) {
      errors.push(`step ${index + 1} loadDurationMs must be a non-negative finite number`);
    }
    if (!finiteNumber(raw.criticalViolations) || raw.criticalViolations < 0) {
      errors.push(`step ${index + 1} criticalViolations must be non-negative`);
    }
    if (framesOk && cadenceOk && representation && finiteNumber(raw.criticalViolations)) {
      const step = raw as unknown as StepResult;
      const recomputed = computeVerdict({
        frames: qca0VerdictFrames(step),
        criticalViolations: step.criticalViolations,
        representation: step.representation,
      });
      if (raw.grade !== recomputed.grade) {
        errors.push(
          `step ${index + 1} reported grade '${String(raw.grade)}' does not match recomputed '${recomputed.grade}'`
        );
      }
      steps.push(step);
    }
  }
  if (errors.length > 0 || steps.length !== QCA0_STEP_POLICY.length) return invalidQca0(errors);

  const graded = steps.filter((step) => step.spec.warmup !== true);
  const { lastGreenRowCount, kneeIndex } = deriveQca0Knee(steps);
  if (kneeIndex === null) {
    return {
      captureStatus: 'VALID_CAPTURE',
      validationErrors: [],
      steps,
      lastGreenRowCount,
      kneeRowCount: null,
      kneeRatios: null,
      bottleneckIndicators: [],
      authorizations: [],
      nextExperiments: {},
    };
  }
  const knee = graded[kneeIndex];
  const previous = kneeIndex > 0 ? graded[kneeIndex - 1] : null;
  if (!previous) {
    return {
      captureStatus: 'VALID_CAPTURE',
      validationErrors: [],
      steps,
      lastGreenRowCount,
      kneeRowCount: knee.spec.rowCount,
      kneeRatios: null,
      bottleneckIndicators: [],
      authorizations: [],
      nextExperiments: {},
    };
  }
  const kneeRatios = deriveQca0Ratios(previous, knee);
  const bottleneckIndicators = rankQca0Indicators(kneeRatios, knee, previous);
  const authorizations: Qca0Authorization[] = [];
  const nextExperiments: Partial<Record<Qca0Authorization, string>> = {};
  if (kneeRatios.load >= 1.5) {
    authorizations.push('QCA2');
    nextExperiments.QCA2 = QCA0_QCA2_EXPERIMENT;
  }
  if (
    (knee.representation.renderedNodeCount ?? 0) >
      (previous.representation.renderedNodeCount ?? 0) &&
    (kneeRatios.scene >= 1.25 || kneeRatios.governor >= 1.25)
  ) {
    authorizations.push('QCA4');
    nextExperiments.QCA4 = QCA0_QCA4_EXPERIMENT;
  }
  return {
    captureStatus: 'VALID_CAPTURE',
    validationErrors: [],
    steps,
    lastGreenRowCount,
    kneeRowCount: knee.spec.rowCount,
    kneeRatios,
    bottleneckIndicators,
    authorizations,
    nextExperiments,
  };
}

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
  expected: QuestPerformanceStepPolicy,
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
  if ((spec.warmup === true) !== expected.warmup) {
    errors.push(
      `step ${index + 1} warmup must be ${expected.warmup ? 'true' : 'false'} for the governed profile`
    );
  }

  const frames = objectAt(value, 'frames');
  if (!frames) {
    errors.push(`step ${index + 1} frame statistics are missing`);
    return null;
  }
  for (const field of ['p95Ms', 'p99Ms', 'droppedPct'] as const) {
    if (!finiteNumber(frames[field]))
      errors.push(`step ${index + 1} frames.${field} must be finite`);
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

  // Grade-signal parity with the device collector (`LoadTestCollector.endStep`
  // grades XR frame cadence when present, else app frame times). The previous
  // frames-only recompute deterministically disagreed with the device on
  // cadence-graded steps (observed: app-green vs cadence-yellow dispute).
  const cadence = objectAt(value, 'frameCadence');
  const graded =
    cadence &&
    finiteNumber(cadence.frameCount) &&
    cadence.frameCount > 0 &&
    finiteNumber(cadence.p95Ms) &&
    finiteNumber(cadence.p99Ms) &&
    finiteNumber(cadence.droppedPct)
      ? cadence
      : frames;
  const recomputed = computeVerdict({
    frames: graded as unknown as Parameters<typeof computeVerdict>[0]['frames'],
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

  const manifestProfile =
    typeof manifest.profile === 'string' &&
    QUEST_PERFORMANCE_PROFILES.includes(manifest.profile as QuestPerformanceProfile)
      ? (manifest.profile as QuestPerformanceProfile)
      : null;
  const policy = manifestProfile ? QUEST_PERFORMANCE_PROFILE_POLICIES[manifestProfile] : null;

  if (!policy) {
    errors.push('manifest does not bind a supported governed Quest performance profile');
  }
  if (value.version !== '2') errors.push('performance report version must be 2');
  if (value.profileName !== manifestProfile) {
    errors.push(
      `profileName '${String(value.profileName)}' does not match manifest profile '${manifestProfile ?? 'null'}'`
    );
  }
  if (value.xrActive !== true) errors.push('xrActive must be true');
  const aborted = value.aborted === true;
  if (typeof value.aborted !== 'boolean') errors.push('aborted must be boolean');
  validatePhysicalRuntimeIdentity(value, manifest, errors);
  validateCollectionPolicy(value, errors);
  if (!exactThresholds(value.thresholds)) {
    errors.push('reported thresholds do not match the governed fixed threshold authority');
  }

  const steps = Array.isArray(value.steps) ? value.steps : [];
  const expectedSteps = policy?.steps ?? [];
  if (!Array.isArray(value.steps) || steps.length === 0) errors.push('steps must be non-empty');
  if (!aborted && steps.length !== expectedSteps.length) {
    errors.push(
      `completed performance report for ${manifestProfile ?? 'unknown'} must contain exactly ${expectedSteps.length} steps`
    );
  }
  if (steps.length > expectedSteps.length) {
    errors.push('performance report contains more steps than the manifest-bound governed profile');
  }

  const grades: Array<VerdictGrade | null> = [];
  for (let index = 0; index < steps.length && index < expectedSteps.length; index += 1) {
    grades.push(validatePerfStep(steps[index], expectedSteps[index], index, errors));
  }

  const coreFailureReasons: string[] = [];
  if (!aborted && policy) {
    policy.steps.forEach((stepPolicy, index) => {
      if (!stepPolicy.requiredForPerf04) return;
      const grade = grades[index];
      if (grade !== 'green') {
        coreFailureReasons.push(
          `${stepPolicy.label} adjudicated ${grade ?? 'invalid'}; governed frame threshold requires green`
        );
      }
    });
  }
  const corePass =
    !aborted && errors.length === 0 && coreFailureReasons.length === 0 && Boolean(policy);
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
  if (value.profileName !== QUEST_BOUNDARY_PROFILE)
    errors.push(`profileName must be ${QUEST_BOUNDARY_PROFILE}`);
  if (value.xrActive !== true) errors.push('xrActive must be true');
  validatePhysicalRuntimeIdentity(value, manifest, errors);
  validateCollectionPolicy(value, errors);

  const scenario = objectAt(value, 'scenario');
  if (!scenario || scenario.rows !== 10_000_000)
    errors.push('boundary scenario must contain exactly 10M rows');
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

function aggregate(results: GateAdjudication[]): {
  status: GateDispositionStatus;
  reasons: string[];
} {
  if (results.length === 0) {
    return {
      status: 'PARTIAL',
      reasons: ['no governed gate is adjudicable in this validation mode'],
    };
  }
  const order: GateDispositionStatus[] = ['INVALID_RUN', 'FAIL', 'BLOCKED', 'PARTIAL', 'PASS'];
  const status =
    order.find((candidate) => results.some((result) => result.status === candidate)) ?? 'PARTIAL';
  const reasons = results
    .filter((result) => result.status === status)
    .flatMap((result) => result.reasons.map((reason) => `${result.gate}: ${reason}`));
  return { status, reasons: reasons.slice(0, 32) };
}

export function deriveUxr4LaneObservations(
  manifest: ValidationManifest,
  gateResults: GateAdjudication[]
): Uxr4EvidenceObservation[] {
  const byGate = new Map(gateResults.map((result) => [result.gate, result]));
  const observation = (
    evidenceClass: Uxr4EvidenceObservation['evidenceClass'],
    gates: string[],
    fallback: string
  ): Uxr4EvidenceObservation => {
    const present = gates.flatMap((gateId) => (byGate.has(gateId) ? [byGate.get(gateId)!] : []));
    if (present.length === 0) return { evidenceClass, status: 'PARTIAL', reasons: [fallback] };
    const result = aggregate(present);
    return { evidenceClass, status: result.status, reasons: result.reasons };
  };
  if (manifest.validationMode === 'quest-ux') {
    return [
      observation(
        'interaction',
        ['UX-03', 'RF-049', 'RF-050', 'P1-U9'],
        'guided interaction evidence is not adjudicable'
      ),
      observation('responsiveness', ['UX-03'], 'guided responsiveness evidence is not adjudicable'),
    ];
  }
  if (manifest.validationMode === 'quest-perf') {
    return [
      observation('frame-render', ['PERF-04'], 'frame/render evidence is not adjudicable'),
      observation('memory-resource', ['PERF-05'], 'memory/resource evidence is not adjudicable'),
    ];
  }
  if (manifest.validationMode === 'quest-10m') {
    return [
      observation(
        'semantic-scale',
        ['RF-029', 'RF-051'],
        'semantic-scale evidence is not adjudicable'
      ),
    ];
  }
  return [];
}

export function adjudicateValidationEvidence(
  input: ValidationAdjudicationInput
): ValidationAdjudicationResult {
  const { manifest } = input;
  const cohort = emptyCohort(input.cohort);
  const validationErrors: string[] = [];
  let gateResults: GateAdjudication[] = [];
  let captureStatus: Qca0CaptureStatus = 'PENDING';
  let qca0Analysis: Qca0ScaleKneeAnalysis | null = null;

  const manifestInvalidations = blockingManifestInvalidations(manifest);
  if (manifest.validationMode === 'quest-qca0') {
    const reports = input.loadTestReports;
    if (reports.length === 0 && manifestInvalidations.length === 0) {
      captureStatus = 'PENDING';
    } else {
      const candidate: unknown = reports.length === 1 ? reports[0] : reports;
      qca0Analysis = analyzeQca0ScaleKneeReport(candidate, manifest);
      captureStatus = qca0Analysis.captureStatus;
      validationErrors.push(...qca0Analysis.validationErrors);
      if (reports.length !== 1 && qca0Analysis.validationErrors.length === 0) {
        validationErrors.push(
          `QCA0 session contains ${reports.length} terminal reports; governed runs require exactly one report per session`
        );
        captureStatus = 'INVALID_RUN';
      }
    }
    gateResults = [];
  } else if (manifestInvalidations.length > 0) {
    captureStatus = 'INVALID_RUN';
    gateResults = manifest.gates.map((gateId) =>
      gate(gateId, 'INVALID_RUN', manifestInvalidations)
    );
    validationErrors.push(...manifestInvalidations);
  } else if (manifest.validationMode === 'quest-perf') {
    const reports = input.loadTestReports.filter((candidate) => isRecord(candidate));
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
      } else if (manifest.profile === QUEST_PERF_PROFILE) {
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
      } else {
        const perf04 = checked.corePass
          ? gate('PERF-04', 'PARTIAL', [
              `${manifest.profile} completed within the existing fixed frame thresholds, but long-session evidence does not satisfy the repeated staircase PERF-04 promotion criterion`,
            ])
          : gate('PERF-04', 'FAIL', checked.coreFailureReasons);
        const perf05 = gate('PERF-05', 'PARTIAL', [
          `${manifest.profile} captured bounded JS heap, WASM, GPU/scene and sustained-performance aggregates, but no governed automatic resource-trend PASS threshold exists; QV4 will not invent one`,
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
  const uxr4Observations = deriveUxr4LaneObservations(manifest, gateResults);
  return {
    schemaVersion: VALIDATION_ADJUDICATION_SCHEMA_VERSION,
    adjudicatorVersion: VALIDATION_ADJUDICATOR_VERSION,
    sessionId: manifest.sessionId,
    sessionLabel: manifest.sessionLabel,
    buildId: manifest.buildId,
    validationMode: manifest.validationMode,
    evidenceClass: manifest.evidenceClass,
    analyzerValid: validationErrors.length === 0,
    captureStatus,
    qca0Analysis,
    validationErrors: validationErrors.slice(0, 64),
    cohort,
    gateResults,
    aggregateStatus: aggregateResult.status,
    aggregateReasons: aggregateResult.reasons,
    uxr4Observations,
  };
}
