import { canonicalSha256Hex } from '../../security/CryptoHash.ts';

export const INVESTIGATION_INTENT_SCHEMA_V1 = 1;

export interface InvestigationIntentV1 {
  readonly schemaVersion: 1;
  readonly researchQuestion?: string;
  readonly hypothesis?: string;
  readonly variablesOfInterest?: readonly string[];
  readonly currentTask?: string;
}

function normalizeScalar(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new TypeError(`InvestigationIntent ${fieldName} must be a string if present`);
  }
  const normalized = value.normalize('NFC').trim();
  return normalized === '' ? undefined : normalized;
}

export function canonicalizeInvestigationIntent(intent: unknown): InvestigationIntentV1 {
  if (typeof intent !== 'object' || intent === null) {
    throw new TypeError('InvestigationIntent must be an object');
  }

  const candidate = intent as Record<string, unknown>;
  const allowedKeys = new Set([
    'schemaVersion',
    'researchQuestion',
    'hypothesis',
    'variablesOfInterest',
    'currentTask',
  ]);
  for (const key of Object.keys(candidate)) {
    if (!allowedKeys.has(key)) {
      throw new TypeError(`Unsupported InvestigationIntent field: ${key}`);
    }
  }

  if (candidate.schemaVersion !== INVESTIGATION_INTENT_SCHEMA_V1) {
    throw new TypeError(
      `Unsupported InvestigationIntent schema version: ${String(candidate.schemaVersion)}`
    );
  }

  const canonical: {
    schemaVersion: 1;
    researchQuestion?: string;
    hypothesis?: string;
    variablesOfInterest?: string[];
    currentTask?: string;
  } = {
    schemaVersion: INVESTIGATION_INTENT_SCHEMA_V1,
  };

  const q = normalizeScalar(candidate.researchQuestion, 'researchQuestion');
  if (q !== undefined) canonical.researchQuestion = q;

  const h = normalizeScalar(candidate.hypothesis, 'hypothesis');
  if (h !== undefined) canonical.hypothesis = h;

  const t = normalizeScalar(candidate.currentTask, 'currentTask');
  if (t !== undefined) canonical.currentTask = t;

  if (candidate.variablesOfInterest !== undefined) {
    if (!Array.isArray(candidate.variablesOfInterest)) {
      throw new TypeError('InvestigationIntent variablesOfInterest must be an array');
    }
    const vars: string[] = [];
    for (let i = 0; i < candidate.variablesOfInterest.length; i++) {
      const raw = candidate.variablesOfInterest[i];
      if (typeof raw !== 'string') {
        throw new TypeError(
          `InvestigationIntent variablesOfInterest item at index ${i} must be a string`
        );
      }
      const norm = raw.normalize('NFC').trim();
      if (norm === '') {
        throw new TypeError(
          `InvestigationIntent variablesOfInterest cannot contain empty items (index ${i})`
        );
      }
      vars.push(norm);
    }
    canonical.variablesOfInterest = vars;
  }

  return canonical;
}

export function computeIntentIdentity(intent: unknown): string {
  const canonical = canonicalizeInvestigationIntent(intent);
  return `sha256-intent-v1-${canonicalSha256Hex(canonical)}`;
}
