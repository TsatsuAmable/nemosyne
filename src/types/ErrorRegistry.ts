/**
 * Centralized Error & Exception Register.
 *
 * Provides a typed catalog of all system error codes, domains, severity levels,
 * recovery actions, and user-facing explanations across Nemosyne.
 */

export type ErrorDomain =
  | 'WASM_KERNEL'
  | 'DATASET_PARSER'
  | 'DRACO_SOLVER'
  | 'SPATIAL_RUNTIME'
  | 'INTERACTION_FSM'
  | 'COLLABORATION_NET'
  | 'SESSION_STORE'
  | 'RESEARCH_HARNESS';

export type ErrorSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface ErrorDefinition {
  code: string;
  domain: ErrorDomain;
  severity: ErrorSeverity;
  title: string;
  description: string;
  recoveryGuidance: string;
}

export const SYSTEM_ERROR_REGISTER: Record<string, ErrorDefinition> = {
  // WASM / Kernel Errors (01xx)
  'ERR_0101_KERNEL_UNAVAILABLE': {
    code: 'ERR_0101_KERNEL_UNAVAILABLE',
    domain: 'WASM_KERNEL',
    severity: 'CRITICAL',
    title: 'Rust/WASM Analytical Kernel Unavailable',
    description: 'The WebAssembly analytical module failed to initialize or memory allocation failed.',
    recoveryGuidance: 'Check browser WebAssembly support or build status in wasm/pkg/.',
  },
  'ERR_0102_ABI_BUFFER_OVERFLOW': {
    code: 'ERR_0102_ABI_BUFFER_OVERFLOW',
    domain: 'WASM_KERNEL',
    severity: 'ERROR',
    title: 'WASM ABI Buffer Length Overflow',
    description: 'Shared memory buffer exceeded declared maximum size bounds.',
    recoveryGuidance: 'Reduce batch slice size or downsample input dataset.',
  },

  // Dataset & Parsing Errors (02xx)
  'ERR_0201_PARSER_MALFORMED_CSV': {
    code: 'ERR_0201_PARSER_MALFORMED_CSV',
    domain: 'DATASET_PARSER',
    severity: 'ERROR',
    title: 'Malformed CSV File Format',
    description: 'Unclosed quotes, inconsistent column counts, or unescaped delimiter encountered.',
    recoveryGuidance: 'Verify CSV delimiter and ensure text fields containing commas are enclosed in quotes.',
  },
  'ERR_0202_EMPTY_DATASET': {
    code: 'ERR_0202_EMPTY_DATASET',
    domain: 'DATASET_PARSER',
    severity: 'WARNING',
    title: 'Dataset Contains Zero Rows',
    description: 'Parsed data input contains a valid schema but zero rows of data.',
    recoveryGuidance: 'Load a non-empty dataset or verify stream ingestion status.',
  },

  // Draco Solver & Recommender Errors (03xx)
  'ERR_0301_NO_VALID_DRACO_SPEC': {
    code: 'ERR_0301_NO_VALID_DRACO_SPEC',
    domain: 'DRACO_SOLVER',
    severity: 'WARNING',
    title: 'No Valid Draco Representation Satisfies Constraints',
    description: 'Hard constraints excluded all 3,168 candidate specifications for the active dataset.',
    recoveryGuidance: 'Relax topology constraints or switch to fallback 3D grid layout.',
  },

  // Spatial Runtime & Three.js Errors (04xx)
  'ERR_0401_WEBGL_CONTEXT_LOST': {
    code: 'ERR_0401_WEBGL_CONTEXT_LOST',
    domain: 'SPATIAL_RUNTIME',
    severity: 'CRITICAL',
    title: 'WebGL GPU Context Lost',
    description: 'GPU hardware reset or out-of-memory error triggered context loss.',
    recoveryGuidance: 'Reload page or decrease dataset LOD rendering scale.',
  },
  'ERR_0402_FRAME_BUDGET_BREACH': {
    code: 'ERR_0402_FRAME_BUDGET_BREACH',
    domain: 'SPATIAL_RUNTIME',
    severity: 'WARNING',
    title: 'Spatial Frame-Time Budget Exceeded',
    description: 'Rendering frame time exceeded 13.88ms threshold on Quest standalone headset.',
    recoveryGuidance: 'Adaptive governor will automatically reduce instance density and point sizes.',
  },

  // Interaction & Input Errors (05xx)
  'ERR_0501_HAND_TRACKING_LOST': {
    code: 'ERR_0501_HAND_TRACKING_LOST',
    domain: 'INTERACTION_FSM',
    severity: 'WARNING',
    title: 'Hand Tracking Lost',
    description: 'Headset camera lost visibility of active hand joints.',
    recoveryGuidance: 'Return hands to headset field-of-view or switch to VR controllers.',
  },

  // Collaboration & Network Errors (06xx)
  'ERR_0601_SIGNALLING_AUTH_FAILED': {
    code: 'ERR_0601_SIGNALLING_AUTH_FAILED',
    domain: 'COLLABORATION_NET',
    severity: 'ERROR',
    title: 'Signalling Server Authentication Denied',
    description: 'Provided room access token is invalid, expired, or unauthorized.',
    recoveryGuidance: 'Verify NEMOSYNE_SIGNAL_TOKEN or obtain an updated participant token.',
  },

  // Session & Storage Errors (07xx)
  'ERR_0701_INDEXEDDB_UNAVAILABLE': {
    code: 'ERR_0701_INDEXEDDB_UNAVAILABLE',
    domain: 'SESSION_STORE',
    severity: 'WARNING',
    title: 'IndexedDB Storage Inaccessible',
    description: 'Browser in private/incognito mode or local storage quota exhausted.',
    recoveryGuidance: 'Session will run in in-memory mode; export manual JSON story files to save work.',
  },

  // Research Harness Errors (08xx)
  'ERR_0801_FROZEN_TREATMENT_MUTATION_BLOCKED': {
    code: 'ERR_0801_FROZEN_TREATMENT_MUTATION_BLOCKED',
    domain: 'RESEARCH_HARNESS',
    severity: 'ERROR',
    title: 'Attempted Mutation of Frozen Study Treatment Variable',
    description: 'Action blocked because active study protocol locks representations during trial.',
    recoveryGuidance: 'Complete active trial before modifying layout or assistant settings.',
  },
};

export class NemosyneError extends Error {
  readonly code: string;
  readonly domain: ErrorDomain;
  readonly severity: ErrorSeverity;
  readonly recoveryGuidance: string;

  constructor(code: string, customMessage?: string) {
    const def = SYSTEM_ERROR_REGISTER[code] ?? {
      code,
      domain: 'SPATIAL_RUNTIME',
      severity: 'ERROR',
      title: 'Unknown System Error',
      description: customMessage ?? 'An unregistered error occurred.',
      recoveryGuidance: 'Check console logs and report issue.',
    };

    super(customMessage ? `${def.title}: ${customMessage}` : `${def.title} — ${def.description}`);
    this.name = 'NemosyneError';
    this.code = def.code;
    this.domain = def.domain;
    this.severity = def.severity;
    this.recoveryGuidance = def.recoveryGuidance;
  }
}
