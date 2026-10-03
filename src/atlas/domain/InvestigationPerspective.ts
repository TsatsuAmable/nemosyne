/**
 * InvestigationPerspective — view-only foregrounding over an already-analysed snapshot.
 *
 * Authority: A27-0 F01 (perspective invariance) and §5, plus ERA-ASTRA1 §4.2, which requires
 * that a perspective "say whether it merely foregrounds existing meaning or requests a new
 * operation". `mode` therefore is mandatory, not inferred: a consumer must never have to guess
 * whether a perspective is a pure view or a request for analysis it cannot satisfy itself.
 *
 * A perspective never changes which observations were analysed, in either mode. `foreground`
 * reorders/emphasizes what a snapshot already contains. `request_derivation` declares that a
 * governed subset or analytical derivation is needed; per ERA-ASTRA1 §4.2 the derivation is
 * scheduled by Atlas and returns a NEW immutable snapshot, so the request itself still leaves
 * snapshot identity untouched. Only that new snapshot changes the analysed meaning.
 *
 * Because the distinction is declared rather than implied, the contract can stay closed and
 * enumeration-only: it has no filter, threshold, limit, predicate, subset or numeric field, so
 * neither mode can narrow the analysed population or invent a relation (an A27-0 stop condition).
 * Requesting derivation is not filtering, and the vocabulary for a derivation request belongs to
 * the integration slice rather than being invented here.
 *
 * Identity is content-addressed over the canonical form. Because a perspective never enters the
 * snapshot, two perspectives over equal analytical coverage leave snapshot identity equal while
 * yielding distinct committed-context and decision identities.
 */

import { canonicalSha256Hex } from '../../security/CryptoHash.ts';

export const INVESTIGATION_PERSPECTIVE_SCHEMA_V1 = 1;

export const PERSPECTIVE_MODES = ['foreground', 'request_derivation'] as const;
export const TEMPORAL_FOREGROUNDINGS = ['recency', 'historical'] as const;
export const UNCERTAINTY_FOREGROUNDINGS = ['interval', 'distribution', 'point'] as const;

export type PerspectiveMode = (typeof PERSPECTIVE_MODES)[number];
export type TemporalForegrounding = (typeof TEMPORAL_FOREGROUNDINGS)[number];
export type UncertaintyForegrounding = (typeof UNCERTAINTY_FOREGROUNDINGS)[number];

export interface InvestigationPerspectiveV1 {
  readonly schemaVersion: 1;
  readonly mode: PerspectiveMode;
  readonly temporalForegrounding?: TemporalForegrounding;
  readonly uncertaintyForegrounding?: UncertaintyForegrounding;
}

/**
 * Field names that would silently narrow the analysed population. The closed key set already
 * rejects them; this list exists so the refusal names the scientific reason instead of merely
 * reporting an unexpected key.
 */
const POPULATION_NARROWING_FIELDS = new Set([
  'filter',
  'filters',
  'predicate',
  'where',
  'subset',
  'sample',
  'selection',
  'rows',
  'rowLimit',
  'limit',
  'topN',
  'threshold',
  'cutoff',
  'quantile',
  'binCount',
  'score',
  'weight',
  'window',
  'timeRange',
  'dateRange',
]);

function normalizeEnum<T extends string>(
  value: unknown,
  fieldName: string,
  allowed: readonly T[]
): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new TypeError(
      `InvestigationPerspective ${fieldName} must be one of: ${allowed.join(', ')}`
    );
  }
  return value as T;
}

export function canonicalizeInvestigationPerspective(
  perspective: unknown
): InvestigationPerspectiveV1 {
  if (typeof perspective !== 'object' || perspective === null || Array.isArray(perspective)) {
    throw new TypeError('InvestigationPerspective must be a non-null object');
  }

  const candidate = perspective as Record<string, unknown>;
  for (const key of Object.keys(candidate)) {
    if (POPULATION_NARROWING_FIELDS.has(key)) {
      throw new TypeError(
        `InvestigationPerspective field "${key}" would narrow the analysed population; ` +
          'filtering requires analytical derivation, not a view field'
      );
    }
  }

  const allowedKeys = new Set([
    'schemaVersion',
    'mode',
    'temporalForegrounding',
    'uncertaintyForegrounding',
  ]);
  for (const key of Object.keys(candidate)) {
    if (!allowedKeys.has(key)) {
      throw new TypeError(`Unsupported InvestigationPerspective field: ${key}`);
    }
  }

  if (candidate.schemaVersion !== INVESTIGATION_PERSPECTIVE_SCHEMA_V1) {
    throw new TypeError(
      `Unsupported InvestigationPerspective schema version: ${String(candidate.schemaVersion)}`
    );
  }

  // ERA-ASTRA1 §4.2: the perspective must declare which it is. Absent mode is refused rather
  // than defaulted, because defaulting would make "requests a new operation" indistinguishable
  // from "merely foregrounds existing meaning".
  if (candidate.mode === undefined) {
    throw new TypeError(
      `InvestigationPerspective must declare mode (${PERSPECTIVE_MODES.join(' or ')})`
    );
  }

  const canonical: {
    schemaVersion: 1;
    mode: PerspectiveMode;
    temporalForegrounding?: TemporalForegrounding;
    uncertaintyForegrounding?: UncertaintyForegrounding;
  } = {
    schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
    mode: normalizeEnum(candidate.mode, 'mode', PERSPECTIVE_MODES)!,
  };

  const temporal = normalizeEnum(
    candidate.temporalForegrounding,
    'temporalForegrounding',
    TEMPORAL_FOREGROUNDINGS
  );
  if (temporal !== undefined) canonical.temporalForegrounding = temporal;

  const uncertainty = normalizeEnum(
    candidate.uncertaintyForegrounding,
    'uncertaintyForegrounding',
    UNCERTAINTY_FOREGROUNDINGS
  );
  if (uncertainty !== undefined) canonical.uncertaintyForegrounding = uncertainty;

  return canonical;
}

export function computePerspectiveIdentity(perspective: unknown): string {
  const canonical = canonicalizeInvestigationPerspective(perspective);
  return `sha256-perspective-v1-${canonicalSha256Hex(canonical)}`;
}

/**
 * The declared no-op view: foregrounds existing meaning and requests nothing. Absence of a
 * perspective remains absence; this constant is only for callers that must supply one.
 */
export const ABSENT_PERSPECTIVE: InvestigationPerspectiveV1 = {
  schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
  mode: 'foreground',
};