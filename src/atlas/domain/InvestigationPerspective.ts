/**
 * InvestigationPerspective — view-only foregrounding over an already-analysed snapshot.
 *
 * Authority: A27-0 F01 (perspective invariance) and §5. A perspective selects what the
 * investigator sees *first*; it never changes which observations were analysed. It therefore
 * carries closed enumerations only: it has no filter, threshold, limit, predicate, subset or
 * numeric field, so it cannot implicitly filter rows, compute statistics or invent a relation
 * (an A27-0 stop condition for this lane). Anything that narrows the analysed population is an
 * analytical operation and must cross the governed derivation path instead.
 *
 * Identity is content-addressed over the canonical form. Because a perspective never enters the
 * snapshot, two perspectives over equal analytical coverage leave snapshot identity equal while
 * yielding distinct committed-context and decision identities.
 */

import { canonicalSha256Hex } from '../../security/CryptoHash.ts';

export const INVESTIGATION_PERSPECTIVE_SCHEMA_V1 = 1;

export const TEMPORAL_FOREGROUNDINGS = ['recency', 'historical'] as const;
export const UNCERTAINTY_FOREGROUNDINGS = ['interval', 'distribution', 'point'] as const;

export type TemporalForegrounding = (typeof TEMPORAL_FOREGROUNDINGS)[number];
export type UncertaintyForegrounding = (typeof UNCERTAINTY_FOREGROUNDINGS)[number];

export interface InvestigationPerspectiveV1 {
  readonly schemaVersion: 1;
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

  const canonical: {
    schemaVersion: 1;
    temporalForegrounding?: TemporalForegrounding;
    uncertaintyForegrounding?: UncertaintyForegrounding;
  } = {
    schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
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

/** A perspective that changes nothing: absence stays absence rather than becoming a default. */
export const ABSENT_PERSPECTIVE: InvestigationPerspectiveV1 = {
  schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
};