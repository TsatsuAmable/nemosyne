/**
 * QV0 validation manifest contract (shared, pure, dependency-free).
 *
 * This module is the single authority for the validation-manifest schema, the
 * validation-mode → gate/profile/evidence-class/runtime-class mapping, and the
 * truthful derivation of a manifest from raw inputs. It imports nothing from
 * Node or the runtime so it can be reused by the Node launcher (via type
 * stripping), browser-side validation surfaces, and unit tests alike.
 *
 * Guardrails encoded here:
 * - evidence class and gate disposition are separate fields;
 * - a dirty/unknown worktree and a non-governed evidence class are
 *   promotion-ineligible by construction;
 * - the 10M boundary probe mode is explicitly non-qualification;
 * - validation modes never accept the fallback build identity.
 */

export const MANIFEST_SCHEMA_VERSION = '1';

export type WorktreeState = 'clean' | 'dirty' | 'unknown';

export type EvidenceClass =
  | 'ordinary-development'
  | 'physical-device-trial'
  | 'governed-physical-validation'
  | 'clean-production-qualification';

export type RuntimeClass =
  'vite-dev' | 'clean-production-dist' | 'desktop-browser' | 'desktop-simulator' | 'physical-webxr';

export type ValidationMode = 'quest' | 'quest-perf' | 'quest-ux' | 'quest-10m' | 'quest-validate';

export type GateDispositionStatus = 'PASS' | 'FAIL' | 'PARTIAL' | 'INVALID_RUN' | 'BLOCKED';

export interface LinkedArtifact {
  kind: string;
  path: string;
  status: 'written' | 'expected';
}

export interface ValidationManifest {
  schemaVersion: typeof MANIFEST_SCHEMA_VERSION;
  /** Generated per-session run ID (UUID v4). */
  sessionId: string;
  /** Human-readable per-session label; also names the evidence directory. */
  sessionLabel: string;
  /** Exact resolved source commit/build identity. Never the fallback. */
  buildId: string;
  worktree: WorktreeState;
  validationMode: ValidationMode;
  /** Owning gate(s) this mode feeds, e.g. PERF-04. */
  gates: string[];
  /** Owned load-test/boundary profile name, when applicable. */
  profile: string | null;
  runtimeClass: RuntimeClass;
  evidenceClass: EvidenceClass;
  /** Investigator-declared facts; never inferred by the runtime. */
  declaredQuestModel: string | null;
  declaredFirmwareVersion: string | null;
  /** Captured by the runtime later; null at launch. */
  userAgent: string | null;
  nominalXrRateHz: number | null;
  timestamps: {
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
  };
  /** Local per-session evidence directory, relative to the repo root. */
  evidenceDir: string;
  linkedArtifacts: LinkedArtifact[];
  gateDisposition: {
    status: GateDispositionStatus | null;
    reasons: string[];
  };
  /** Reasons this run cannot be used for promotion. Empty only when eligible. */
  invalidations: string[];
  promotionEligible: boolean;
}

export interface ValidationModeSpec {
  mode: ValidationMode;
  label: string;
  evidenceClass: EvidenceClass;
  gates: string[];
  profile: string | null;
  runtimeClass: RuntimeClass;
  wasmRequired: boolean;
  invalidationReasons: string[];
}

/**
 * Single centralized mapping table: validation mode → gate/profile + evidence
 * class + runtime class. This is the QV1 "mode/gate/profile mappings are
 * centralized and testable" requirement.
 */
export const VALIDATION_MODE_TABLE: Record<ValidationMode, ValidationModeSpec> = {
  quest: {
    mode: 'quest',
    label: 'Informal physical-headset development with attribution',
    evidenceClass: 'physical-device-trial',
    gates: [],
    profile: null,
    runtimeClass: 'vite-dev',
    wasmRequired: true,
    invalidationReasons: [],
  },
  'quest-perf': {
    mode: 'quest-perf',
    label: 'Governed Quest 3S performance staircase',
    evidenceClass: 'governed-physical-validation',
    gates: ['PERF-04', 'PERF-05'],
    profile: 'quest-3s-qualification',
    runtimeClass: 'vite-dev',
    wasmRequired: true,
    invalidationReasons: [],
  },
  'quest-ux': {
    mode: 'quest-ux',
    label: 'Guided controller/hand/task validation',
    evidenceClass: 'governed-physical-validation',
    gates: ['UX-03', 'RF-049', 'RF-050', 'P1-U9'],
    profile: 'ux-03-guided-tasks',
    runtimeClass: 'vite-dev',
    wasmRequired: true,
    invalidationReasons: [],
  },
  'quest-10m': {
    mode: 'quest-10m',
    label: 'Governed 10M Rust/WASM boundary exercise (not final qualification)',
    evidenceClass: 'governed-physical-validation',
    gates: ['RF-029', 'RF-051'],
    profile: 'quest-3s-rust-boundary-10m',
    runtimeClass: 'vite-dev',
    wasmRequired: true,
    invalidationReasons: ['quest-10m boundary probe is not final 10M device qualification'],
  },
  'quest-validate': {
    mode: 'quest-validate',
    label: 'Validation launcher/dashboard selecting eligible lanes',
    evidenceClass: 'physical-device-trial',
    gates: [],
    profile: null,
    runtimeClass: 'vite-dev',
    wasmRequired: false,
    invalidationReasons: [
      'quest-validate is an orchestration entry; a governed evidence class requires an explicit lane selection',
    ],
  },
};

export const VALIDATION_MODES = Object.keys(VALIDATION_MODE_TABLE) as ValidationMode[];

export interface ValidationManifestInput {
  sessionId: string;
  sessionLabel: string;
  buildId: string;
  worktree: WorktreeState;
  mode: ValidationMode;
  createdAt?: string;
  declaredQuestModel?: string | null;
  declaredFirmwareVersion?: string | null;
  userAgent?: string | null;
  nominalXrRateHz?: number | null;
}

function isoNow(): string {
  return new Date().toISOString();
}

/**
 * Derive the QV0 manifest from raw launcher inputs. Pure: no I/O, no git, no
 * randomness — all inputs are supplied. Promotion eligibility is a pure
 * consequence of worktree state + evidence class + mode-specific
 * invalidations, so no launcher path can upgrade it.
 */
export function deriveValidationManifest(input: ValidationManifestInput): ValidationManifest {
  const spec = VALIDATION_MODE_TABLE[input.mode];
  const promotionGradeEvidence =
    spec.evidenceClass === 'governed-physical-validation' ||
    spec.evidenceClass === 'clean-production-qualification';
  const invalidations: string[] = [];
  if (input.worktree !== 'clean') {
    invalidations.push(
      `worktree state is '${input.worktree}'; exact-source reproducibility cannot be claimed`
    );
  }
  if (!promotionGradeEvidence) {
    invalidations.push(`evidence class '${spec.evidenceClass}' is not promotion-grade`);
  }
  invalidations.push(...spec.invalidationReasons);
  const evidenceDir = `logs/validation/${input.sessionLabel}`;
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    sessionId: input.sessionId,
    sessionLabel: input.sessionLabel,
    buildId: input.buildId,
    worktree: input.worktree,
    validationMode: spec.mode,
    gates: [...spec.gates],
    profile: spec.profile,
    runtimeClass: spec.runtimeClass,
    evidenceClass: spec.evidenceClass,
    declaredQuestModel: input.declaredQuestModel ?? null,
    declaredFirmwareVersion: input.declaredFirmwareVersion ?? null,
    userAgent: input.userAgent ?? null,
    nominalXrRateHz: input.nominalXrRateHz ?? null,
    timestamps: {
      createdAt: input.createdAt ?? isoNow(),
      startedAt: null,
      completedAt: null,
    },
    evidenceDir,
    linkedArtifacts: [
      { kind: 'manifest', path: `${evidenceDir}/manifest.json`, status: 'written' },
      { kind: 'evidence-directory', path: evidenceDir, status: 'expected' },
    ],
    gateDisposition: { status: null, reasons: [] },
    invalidations,
    promotionEligible: invalidations.length === 0,
  };
}

export type ManifestValidationResult =
  { ok: true; manifest: ValidationManifest } | { ok: false; errors: string[] };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WORKTREE_STATES: WorktreeState[] = ['clean', 'dirty', 'unknown'];
const EVIDENCE_CLASSES: EvidenceClass[] = [
  'ordinary-development',
  'physical-device-trial',
  'governed-physical-validation',
  'clean-production-qualification',
];
const RUNTIME_CLASSES: RuntimeClass[] = [
  'vite-dev',
  'clean-production-dist',
  'desktop-browser',
  'desktop-simulator',
  'physical-webxr',
];
const DISPOSITION_STATUSES: GateDispositionStatus[] = [
  'PASS',
  'FAIL',
  'PARTIAL',
  'INVALID_RUN',
  'BLOCKED',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Fail-closed schema validation for the QV0 manifest. Unknown schema versions
 * and missing/malformed required fields are rejected; a valid manifest is
 * returned only when the object is structurally sound. This is the "one
 * manifest schema is versioned and tested" QV0 acceptance.
 */
export function validateValidationManifest(value: unknown): ManifestValidationResult {
  if (!isRecord(value)) {
    return { ok: false, errors: ['manifest must be an object'] };
  }
  const errors: string[] = [];
  const v = value as Record<string, unknown>;

  if (v.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    errors.push(
      `unsupported schemaVersion ${JSON.stringify(v.schemaVersion)}; supported version is '${MANIFEST_SCHEMA_VERSION}'`
    );
  }
  if (typeof v.sessionId !== 'string' || !UUID_RE.test(v.sessionId)) {
    errors.push('sessionId must be a UUID v4 string');
  }
  if (typeof v.sessionLabel !== 'string' || v.sessionLabel.length === 0) {
    errors.push('sessionLabel must be a non-empty string');
  }
  if (typeof v.buildId !== 'string' || v.buildId.length === 0) {
    errors.push('buildId must be a non-empty source commit/build identity');
  } else if (v.buildId === 'unversioned-local-build') {
    errors.push('buildId must not be the fallback unversioned build identity');
  }
  if (typeof v.worktree !== 'string' || !WORKTREE_STATES.includes(v.worktree as WorktreeState)) {
    errors.push('worktree must be one of clean|dirty|unknown');
  }
  if (typeof v.validationMode !== 'string' || !(v.validationMode in VALIDATION_MODE_TABLE)) {
    errors.push(`validationMode must be one of ${VALIDATION_MODES.map((m) => `'${m}'`).join('|')}`);
  }
  if (!Array.isArray(v.gates) || v.gates.some((gate) => typeof gate !== 'string')) {
    errors.push('gates must be an array of strings');
  }
  if (v.profile !== null && typeof v.profile !== 'string') {
    errors.push('profile must be a string or null');
  }
  if (
    typeof v.runtimeClass !== 'string' ||
    !RUNTIME_CLASSES.includes(v.runtimeClass as RuntimeClass)
  ) {
    errors.push('runtimeClass must be one of the supported runtime classes');
  }
  if (
    typeof v.evidenceClass !== 'string' ||
    !EVIDENCE_CLASSES.includes(v.evidenceClass as EvidenceClass)
  ) {
    errors.push('evidenceClass must be one of the supported evidence classes');
  }
  if (optionalString(v.declaredQuestModel) === null && v.declaredQuestModel !== null) {
    errors.push('declaredQuestModel must be a string or null');
  }
  if (optionalString(v.declaredFirmwareVersion) === null && v.declaredFirmwareVersion !== null) {
    errors.push('declaredFirmwareVersion must be a string or null');
  }
  if (optionalString(v.userAgent) === null && v.userAgent !== null) {
    errors.push('userAgent must be a string or null');
  }
  if (optionalNumber(v.nominalXrRateHz) === null && v.nominalXrRateHz !== null) {
    errors.push('nominalXrRateHz must be a finite number or null');
  }
  if (!isRecord(v.timestamps)) {
    errors.push('timestamps must be an object');
  } else {
    const ts = v.timestamps as Record<string, unknown>;
    if (typeof ts.createdAt !== 'string' || ts.createdAt.length === 0) {
      errors.push('timestamps.createdAt must be a non-empty ISO timestamp');
    }
    for (const key of ['startedAt', 'completedAt'] as const) {
      if (ts[key] !== null && typeof ts[key] !== 'string') {
        errors.push(`timestamps.${key} must be a string or null`);
      }
    }
  }
  if (typeof v.evidenceDir !== 'string' || v.evidenceDir.length === 0) {
    errors.push('evidenceDir must be a non-empty path');
  }
  if (!Array.isArray(v.linkedArtifacts)) {
    errors.push('linkedArtifacts must be an array');
  } else {
    for (const artifact of v.linkedArtifacts) {
      if (!isRecord(artifact)) {
        errors.push('linkedArtifacts entries must be objects');
        break;
      }
      const a = artifact as Record<string, unknown>;
      if (typeof a.kind !== 'string' || typeof a.path !== 'string') {
        errors.push('linkedArtifacts entries require kind and path strings');
        break;
      }
    }
  }
  if (!isRecord(v.gateDisposition)) {
    errors.push('gateDisposition must be an object');
  } else {
    const gd = v.gateDisposition as Record<string, unknown>;
    if (gd.status !== null && !DISPOSITION_STATUSES.includes(gd.status as GateDispositionStatus)) {
      errors.push('gateDisposition.status must be null or a known disposition');
    }
    if (!Array.isArray(gd.reasons) || gd.reasons.some((reason) => typeof reason !== 'string')) {
      errors.push('gateDisposition.reasons must be an array of strings');
    }
  }
  if (!Array.isArray(v.invalidations) || v.invalidations.some((item) => typeof item !== 'string')) {
    errors.push('invalidations must be an array of strings');
  }
  if (typeof v.promotionEligible !== 'boolean') {
    errors.push('promotionEligible must be a boolean');
  } else if (
    Array.isArray(v.invalidations) &&
    v.invalidations.length === 0 &&
    v.promotionEligible === false
  ) {
    errors.push('promotionEligible must be true when there are no invalidations');
  } else if (
    Array.isArray(v.invalidations) &&
    v.invalidations.length > 0 &&
    v.promotionEligible === true
  ) {
    errors.push('promotionEligible cannot be true while invalidations are present');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, manifest: v as unknown as ValidationManifest };
}
