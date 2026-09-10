/**
 * UXR0 replacement A/B evidence contract.
 *
 * The comparator establishes whether two observations are legitimately
 * comparable and exposes raw candidate-minus-baseline deltas. It deliberately
 * does not contain adoption thresholds or an automatic promotion decision.
 */

export type Uxr0QualificationProfileKind =
  | 'functional-5m'
  | 'resource-trend-30m'
  | 'sustained-60m';

export interface Uxr0ReplacementScenarioIdentity {
  deviceTarget: string;
  deviceRuntimeId: string;
  datasetFingerprint: string;
  sourceRowCount: number;
  taskScriptId: string;
  representationId: string;
  representationStateHash: string;
  profileKind: Uxr0QualificationProfileKind;
}

export interface Uxr0ReplacementMetrics {
  frameP95Ms: number | null;
  frameP99Ms: number | null;
  drawCallsMax: number | null;
  sceneObjectCountEnd: number | null;
  jsHeapPeakBytes: number | null;
  wasmPeakBytes: number | null;
  workerOutboundPayloadBytesEstimate: number | null;
  workerInboundPayloadBytesEstimate: number | null;
  bundleBytes: number | null;
  dependencyCount: number | null;
}

export interface Uxr0ReplacementObservation {
  schemaVersion: 1;
  variant: 'baseline' | 'candidate';
  implementationId: string;
  buildHash: string;
  scenario: Uxr0ReplacementScenarioIdentity;
  semanticDigest: string;
  interactionDigest: string;
  metrics: Uxr0ReplacementMetrics;
}

export interface Uxr0ReplacementComparison {
  schemaVersion: 1;
  disposition: 'not-comparable' | 'evidence-comparable';
  identityMismatches: string[];
  parityIssues: string[];
  deltas: Uxr0ReplacementMetrics;
}

const SCENARIO_FIELDS = [
  'deviceTarget',
  'deviceRuntimeId',
  'datasetFingerprint',
  'sourceRowCount',
  'taskScriptId',
  'representationId',
  'representationStateHash',
  'profileKind',
] as const satisfies readonly (keyof Uxr0ReplacementScenarioIdentity)[];

const METRIC_FIELDS = [
  'frameP95Ms',
  'frameP99Ms',
  'drawCallsMax',
  'sceneObjectCountEnd',
  'jsHeapPeakBytes',
  'wasmPeakBytes',
  'workerOutboundPayloadBytesEstimate',
  'workerInboundPayloadBytesEstimate',
  'bundleBytes',
  'dependencyCount',
] as const satisfies readonly (keyof Uxr0ReplacementMetrics)[];

function delta(baseline: number | null, candidate: number | null): number | null {
  return baseline === null || candidate === null ? null : candidate - baseline;
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export function compareUxr0ReplacementEvidence(
  baseline: Uxr0ReplacementObservation,
  candidate: Uxr0ReplacementObservation
): Uxr0ReplacementComparison {
  const identityMismatches: string[] = [];
  const parityIssues: string[] = [];

  if (baseline.schemaVersion !== 1 || candidate.schemaVersion !== 1) {
    identityMismatches.push('schemaVersion');
  }
  if (baseline.variant !== 'baseline') identityMismatches.push('baseline.variant');
  if (candidate.variant !== 'candidate') identityMismatches.push('candidate.variant');
  if (!nonEmpty(baseline.implementationId) || !nonEmpty(candidate.implementationId)) {
    identityMismatches.push('implementationId');
  }
  if (!nonEmpty(baseline.buildHash) || !nonEmpty(candidate.buildHash)) {
    identityMismatches.push('buildHash');
  }
  if (!Number.isSafeInteger(baseline.scenario.sourceRowCount) || baseline.scenario.sourceRowCount <= 0) {
    identityMismatches.push('baseline.sourceRowCount');
  }
  if (!Number.isSafeInteger(candidate.scenario.sourceRowCount) || candidate.scenario.sourceRowCount <= 0) {
    identityMismatches.push('candidate.sourceRowCount');
  }

  for (const field of SCENARIO_FIELDS) {
    if (baseline.scenario[field] !== candidate.scenario[field]) {
      identityMismatches.push(`scenario.${field}`);
    }
  }

  if (!nonEmpty(baseline.semanticDigest) || baseline.semanticDigest !== candidate.semanticDigest) {
    parityIssues.push('semanticDigest');
  }
  if (!nonEmpty(baseline.interactionDigest) || baseline.interactionDigest !== candidate.interactionDigest) {
    parityIssues.push('interactionDigest');
  }

  const deltas = Object.fromEntries(
    METRIC_FIELDS.map((field) => [field, delta(baseline.metrics[field], candidate.metrics[field])])
  ) as unknown as Uxr0ReplacementMetrics;

  return {
    schemaVersion: 1,
    disposition:
      identityMismatches.length === 0 && parityIssues.length === 0
        ? 'evidence-comparable'
        : 'not-comparable',
    identityMismatches,
    parityIssues,
    deltas,
  };
}
