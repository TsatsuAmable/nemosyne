export const GUIDED_UX_SCHEMA_VERSION = '1';

export type GuidedUxInputModality = 'controller' | 'hand';
export type GuidedUxOutcome = 'pass' | 'fail' | 'not-run';
export type GuidedComfortOutcome = 'comfortable' | 'issue' | 'not-run';

export interface GuidedUxTaskDefinition {
  id: string;
  label: string;
  instruction: string;
}

/**
 * QV5 task vocabulary. These are semantic outcomes, not raw gesture traces.
 * Keep this list aligned with the governed QV5 roadmap rather than inventing a
 * second physical-UX taxonomy inside the panel.
 */
export const GUIDED_UX_TASKS: readonly GuidedUxTaskDefinition[] = [
  {
    id: 'select-commit-cancel',
    label: 'SELECT / COMMIT / CANCEL',
    instruction: 'Select a target, commit once, then cancel a second pending action.',
  },
  {
    id: 'direct-touch-commit',
    label: 'DIRECT TOUCH COMMIT',
    instruction: 'Use the supported near/direct-touch path to commit one panel action.',
  },
  {
    id: 'near-retreat-ray',
    label: 'NEAR → RETREAT → RAY',
    instruction: 'Approach a target, retreat, then complete the task with the ray path.',
  },
  {
    id: 'capture-cancel-recovery',
    label: 'CAPTURE / CANCEL / RECOVERY',
    instruction: 'Cross a target boundary, cancel, then recover after a tracking interruption.',
  },
  {
    id: 'dense-precision-escape',
    label: 'DENSE PRECISION ESCAPE',
    instruction: 'Complete a precision selection in dense data and escape without accidental commit.',
  },
  {
    id: 'panel-spatial-controls',
    label: 'PANEL GRAB / PIN / FOLLOW',
    instruction: 'Exercise panel grab, pin/follow and scrolling where available.',
  },
  {
    id: 'representation-semantic-stability',
    label: 'REPRESENTATION STABILITY',
    instruction: 'Change representation and verify the intended semantic command remains stable.',
  },
  {
    id: 'disabled-reason-comprehension',
    label: 'DISABLED REASON',
    instruction: 'Encounter an unavailable command and confirm its disabled reason is understandable.',
  },
  {
    id: 'accessibility-treatment',
    label: 'ACCESSIBILITY TREATMENT',
    instruction: 'Exercise large text, high contrast or reduced-motion treatment as applicable.',
  },
  {
    id: 'error-recovery-first-insight',
    label: 'ERROR / RECOVERY / INSIGHT',
    instruction: 'Recover from one error path and complete a core first-insight or skeptical-investigation task.',
  },
] as const;

export interface GuidedUxTaskResult {
  taskId: string;
  outcome: GuidedUxOutcome;
  inputModality: GuidedUxInputModality;
  modalityBasis: 'investigator-selected';
  recordedAt: string;
  note: null;
}

export interface GuidedUxSubmission {
  schemaVersion: typeof GUIDED_UX_SCHEMA_VERSION;
  sessionId: string;
  sessionLabel: string;
  buildId: string;
  deviceBuildFingerprint: string | null;
  evidenceKind: 'guided-physical-ux';
  results: GuidedUxTaskResult[];
  comfortObservation: {
    outcome: GuidedComfortOutcome;
    recordedAt: string;
    note: null;
  };
  completedAt: string;
}

function isoString(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 20 || value.length > 64) return false;
  return Number.isFinite(Date.parse(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validateGuidedUxSubmission(value: unknown): string[] {
  if (!isRecord(value)) return ['guided UX submission must be an object'];
  const errors: string[] = [];
  if (value.schemaVersion !== GUIDED_UX_SCHEMA_VERSION) errors.push('unsupported guided UX schemaVersion');
  if (typeof value.sessionId !== 'string' || value.sessionId.length > 64) errors.push('sessionId is invalid');
  if (typeof value.sessionLabel !== 'string' || value.sessionLabel.length > 128) errors.push('sessionLabel is invalid');
  if (typeof value.buildId !== 'string' || !/^[0-9a-f]{40}$/i.test(value.buildId)) errors.push('buildId must be an exact commit SHA');
  if (value.deviceBuildFingerprint !== null && (typeof value.deviceBuildFingerprint !== 'string' || value.deviceBuildFingerprint.length > 512)) {
    errors.push('deviceBuildFingerprint must be a bounded string or null');
  }
  if (value.evidenceKind !== 'guided-physical-ux') errors.push("evidenceKind must be 'guided-physical-ux'");
  if (!Array.isArray(value.results)) {
    errors.push('results must be an array');
  } else {
    const known = new Set(GUIDED_UX_TASKS.map((task) => task.id));
    const seen = new Set<string>();
    for (const item of value.results) {
      if (!isRecord(item)) {
        errors.push('each result must be an object');
        continue;
      }
      const taskId = typeof item.taskId === 'string' ? item.taskId : '';
      if (!known.has(taskId)) errors.push(`unknown guided UX task '${taskId || '(missing)'}'`);
      if (seen.has(taskId)) errors.push(`duplicate guided UX task '${taskId}'`);
      seen.add(taskId);
      if (!['pass', 'fail', 'not-run'].includes(String(item.outcome))) errors.push(`invalid outcome for '${taskId}'`);
      if (!['controller', 'hand'].includes(String(item.inputModality))) errors.push(`invalid input modality for '${taskId}'`);
      if (item.modalityBasis !== 'investigator-selected') errors.push(`invalid modality basis for '${taskId}'`);
      if (!isoString(item.recordedAt)) errors.push(`invalid recordedAt for '${taskId}'`);
      if (item.note !== null) errors.push(`guided UX notes must remain null in the bounded on-device runner`);
    }
    if (seen.size !== GUIDED_UX_TASKS.length) {
      errors.push(`results must contain exactly ${GUIDED_UX_TASKS.length} governed tasks`);
    }
  }
  if (!isRecord(value.comfortObservation)) {
    errors.push('comfortObservation must be an object');
  } else {
    if (!['comfortable', 'issue', 'not-run'].includes(String(value.comfortObservation.outcome))) {
      errors.push('comfortObservation.outcome is invalid');
    }
    if (!isoString(value.comfortObservation.recordedAt)) errors.push('comfortObservation.recordedAt is invalid');
    if (value.comfortObservation.note !== null) errors.push('comfortObservation.note must remain null in the bounded runner');
  }
  if (!isoString(value.completedAt)) errors.push('completedAt is invalid');
  return errors;
}
