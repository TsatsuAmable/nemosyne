/**
 * DatasetEvidence — canonical V3 analytical evidence contract.
 *
 * Rust/WASM is the authority for analytical facts. TypeScript may validate,
 * transport, persist, and orchestrate these facts, but must not silently
 * manufacture replacement analytical results.
 */

export const DATASET_EVIDENCE_SCHEMA_VERSION = '1.0.0' as const;

export type DatasetEvidenceSchemaVersion = typeof DATASET_EVIDENCE_SCHEMA_VERSION;

export type EvidenceCategory =
  | 'schema'
  | 'cardinality'
  | 'distribution'
  | 'density'
  | 'cluster'
  | 'anomaly'
  | 'dependency'
  | 'temporal'
  | 'spectral'
  | 'manifold'
  | 'topology'
  | 'scale';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface AnalyticalMethodProvenance {
  /** Stable method identifier, e.g. `fft`, `kmeans`, `iqr-outliers`. */
  method: string;
  /** Version of the analytical method/implementation. */
  methodVersion: string;
  /** Exact Rust/WASM kernel version that produced the result. */
  kernelVersion: string;
  /** Parameters that materially affect the result. */
  parameters: Readonly<Record<string, JsonValue>>;
  /** Random seed when the method is stochastic. */
  seed?: number;
  /** Whether identical inputs and provenance are expected to replay exactly. */
  deterministic: boolean;
  /** Explicit normalisation policy, including `none`. */
  normalization: string;
  /** Explicit missing-data policy, including `none`. */
  missingDataPolicy: string;
  /** Explicit sampling policy, including `full-dataset`. */
  samplingPolicy: string;
  /** Known analytical limitations relevant to interpretation. */
  limitations: readonly string[];
}

export interface EvidenceUncertainty {
  kind: 'none' | 'interval' | 'standard-error' | 'qualitative';
  lower?: number;
  upper?: number;
  standardError?: number;
  confidenceLevel?: number;
  note?: string;
}

export interface AnalyticalEvidence<TValue = JsonValue> {
  /** Unique within one DatasetEvidence envelope. */
  id: string;
  category: EvidenceCategory;
  /** Stable semantic name, e.g. `spectral-entropy` or `cluster-separation`. */
  name: string;
  value: TValue;
  provenance: AnalyticalMethodProvenance;
  uncertainty?: EvidenceUncertainty;
}

export interface DatasetEvidence {
  schemaVersion: DatasetEvidenceSchemaVersion;
  datasetFingerprint: string;
  kernelVersion: string;
  /** Evidence is intentionally flat at the transport boundary and category typed. */
  evidence: readonly AnalyticalEvidence[];
}

export interface DatasetEvidenceValidationIssue {
  path: string;
  message: string;
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function finiteOptional(value: number | undefined): boolean {
  return value === undefined || Number.isFinite(value);
}

function validateUncertainty(
  uncertainty: EvidenceUncertainty | undefined,
  path: string,
  issues: DatasetEvidenceValidationIssue[]
): void {
  if (!uncertainty) return;

  if (!finiteOptional(uncertainty.lower)) {
    issues.push({ path: `${path}.lower`, message: 'must be finite when provided' });
  }
  if (!finiteOptional(uncertainty.upper)) {
    issues.push({ path: `${path}.upper`, message: 'must be finite when provided' });
  }
  if (!finiteOptional(uncertainty.standardError) || (uncertainty.standardError ?? 0) < 0) {
    issues.push({ path: `${path}.standardError`, message: 'must be finite and non-negative' });
  }
  if (
    !finiteOptional(uncertainty.confidenceLevel) ||
    (uncertainty.confidenceLevel !== undefined &&
      (uncertainty.confidenceLevel <= 0 || uncertainty.confidenceLevel >= 1))
  ) {
    issues.push({ path: `${path}.confidenceLevel`, message: 'must be strictly between 0 and 1' });
  }
  if (
    uncertainty.lower !== undefined &&
    uncertainty.upper !== undefined &&
    uncertainty.lower > uncertainty.upper
  ) {
    issues.push({ path, message: 'lower uncertainty bound must not exceed upper bound' });
  }
}

/**
 * Validate research-grade DatasetEvidence without mutating it.
 *
 * The validator is deliberately fail-closed about provenance because Moneta
 * must never receive analytical-looking values whose origin cannot be audited.
 */
export function validateDatasetEvidence(input: DatasetEvidence): DatasetEvidenceValidationIssue[] {
  const issues: DatasetEvidenceValidationIssue[] = [];

  if (input.schemaVersion !== DATASET_EVIDENCE_SCHEMA_VERSION) {
    issues.push({ path: 'schemaVersion', message: `unsupported schema version: ${input.schemaVersion}` });
  }
  if (!nonEmpty(input.datasetFingerprint)) {
    issues.push({ path: 'datasetFingerprint', message: 'must be non-empty' });
  }
  if (!nonEmpty(input.kernelVersion)) {
    issues.push({ path: 'kernelVersion', message: 'must be non-empty' });
  }

  const ids = new Set<string>();

  input.evidence.forEach((item, index) => {
    const path = `evidence[${index}]`;
    if (!nonEmpty(item.id)) {
      issues.push({ path: `${path}.id`, message: 'must be non-empty' });
    } else if (ids.has(item.id)) {
      issues.push({ path: `${path}.id`, message: `duplicate evidence id: ${item.id}` });
    } else {
      ids.add(item.id);
    }

    if (!nonEmpty(item.name)) {
      issues.push({ path: `${path}.name`, message: 'must be non-empty' });
    }

    const provenance = item.provenance;
    if (!nonEmpty(provenance.method)) {
      issues.push({ path: `${path}.provenance.method`, message: 'must be non-empty' });
    }
    if (!nonEmpty(provenance.methodVersion)) {
      issues.push({ path: `${path}.provenance.methodVersion`, message: 'must be non-empty' });
    }
    if (!nonEmpty(provenance.kernelVersion)) {
      issues.push({ path: `${path}.provenance.kernelVersion`, message: 'must be non-empty' });
    } else if (provenance.kernelVersion !== input.kernelVersion) {
      issues.push({
        path: `${path}.provenance.kernelVersion`,
        message: `must match DatasetEvidence kernelVersion ${input.kernelVersion}`,
      });
    }
    if (!nonEmpty(provenance.normalization)) {
      issues.push({ path: `${path}.provenance.normalization`, message: 'must be explicit' });
    }
    if (!nonEmpty(provenance.missingDataPolicy)) {
      issues.push({ path: `${path}.provenance.missingDataPolicy`, message: 'must be explicit' });
    }
    if (!nonEmpty(provenance.samplingPolicy)) {
      issues.push({ path: `${path}.provenance.samplingPolicy`, message: 'must be explicit' });
    }
    if (!provenance.deterministic && !Number.isFinite(provenance.seed)) {
      issues.push({
        path: `${path}.provenance.seed`,
        message: 'stochastic analytical methods must record a finite seed',
      });
    }

    validateUncertainty(item.uncertainty, `${path}.uncertainty`, issues);
  });

  return issues;
}

export class InvalidDatasetEvidenceError extends Error {
  readonly issues: readonly DatasetEvidenceValidationIssue[];

  constructor(issues: readonly DatasetEvidenceValidationIssue[]) {
    super(`Invalid DatasetEvidence: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`);
    this.name = 'InvalidDatasetEvidenceError';
    this.issues = issues;
  }
}

export function assertDatasetEvidence(input: DatasetEvidence): void {
  const issues = validateDatasetEvidence(input);
  if (issues.length > 0) throw new InvalidDatasetEvidenceError(issues);
}

/** Build a validated envelope at the TypeScript boundary. */
export function createDatasetEvidence(input: DatasetEvidence): DatasetEvidence {
  assertDatasetEvidence(input);
  return input;
}
