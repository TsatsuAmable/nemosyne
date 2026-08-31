import type { Dataset } from '../../data/Dataset.ts';
import type { AnalyticalExecutionPort } from '../../atlas/ports/AnalyticalExecutionPort.ts';
import type { RepresentationDecision } from '../../moneta/representation/RepresentationDecision.ts';
import {
  SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
  type AggregateEmbodimentRequestV1,
  type ClusterEmbodimentRequestV1,
  type DensityEmbodimentRequestV1,
  type DistributionEmbodimentRequestV1,
  type RelationshipGraphEmbodimentRequestV1,
  type SemanticEmbodimentEnvelopeV1,
} from '../../moneta/representation/SemanticEmbodimentPayload.ts';

export interface SemanticEmbodimentAuthority {
  readonly executionPort: AnalyticalExecutionPort | null;
  readonly generation: number;
  readonly datasetVersion: number;
  readonly datasetFingerprint: string | null;
}

export interface AggregateEncodingSelection {
  readonly color?: string;
  readonly size?: string;
}

const DENSITY_PRODUCT_BINS_X_V1 = 10;
const DENSITY_PRODUCT_BINS_Y_V1 = 10;

let requestSequence = 0;

function isCurrent(
  authority: SemanticEmbodimentAuthority,
  generation: number,
  version: number,
  fingerprint: string
): boolean {
  return (
    authority.generation === generation &&
    authority.datasetVersion === version &&
    authority.datasetFingerprint === fingerprint
  );
}

async function ensureResidentDataset(
  authority: SemanticEmbodimentAuthority,
  dataset: Dataset,
  generation: number,
  version: number,
  fingerprint: string
): Promise<boolean> {
  const port = authority.executionPort;
  if (!port) return false;
  if (!port.hasRegisteredDataset?.(generation, fingerprint)) {
    if (!port.registerDataset) return false;
    await port.registerDataset({
      registrationId: `semantic-register-${generation}-${version}-${++requestSequence}`,
      dataset: { fingerprint, version },
      generation,
      payload: { type: 'json', data: dataset.toJSON(), name: dataset.name },
    });
  }
  return isCurrent(authority, generation, version, fingerprint);
}

async function executeSemanticRequest(
  authority: SemanticEmbodimentAuthority,
  dataset: Dataset,
  decision: RepresentationDecision,
  candidateId:
    | 'AGGREGATE_VOLUME'
    | 'DISTRIBUTION_FIELD'
    | 'DENSITY_FIELD'
    | 'CLUSTER_REGIONS'
    | 'RELATIONSHIP_GRAPH',
  request: Record<string, unknown>
): Promise<SemanticEmbodimentEnvelopeV1 | null> {
  const port = authority.executionPort;
  const fingerprint = authority.datasetFingerprint;
  const version = authority.datasetVersion;
  const generation = authority.generation;
  if (!port?.isAsync || !fingerprint) return null;
  if (!(await ensureResidentDataset(authority, dataset, generation, version, fingerprint))) return null;

  const result = await port.execute<SemanticEmbodimentEnvelopeV1>({
    requestId: `semantic-${candidateId.toLowerCase()}-${generation}-${version}-${++requestSequence}`,
    operation: 'semanticEmbodiment',
    dataset: { fingerprint, version },
    generation,
    params: request,
  });

  if (!isCurrent(authority, generation, version, fingerprint)) return null;
  if (
    result.generation !== generation ||
    result.datasetVersion !== version ||
    result.datasetFingerprint !== fingerprint
  ) {
    return null;
  }

  const envelope = result.value;
  if (
    !envelope ||
    envelope.schemaVersion !== SEMANTIC_EMBODIMENT_SCHEMA_VERSION ||
    envelope.datasetFingerprint !== fingerprint ||
    envelope.candidateId !== candidateId ||
    envelope.provenance.decisionId !== decision.id
  ) {
    return null;
  }
  return envelope;
}

/** Start the Rust-owned aggregate request against the resident dataset capability. */
export function loadAggregateSemanticEmbodiment(
  authority: SemanticEmbodimentAuthority,
  dataset: Dataset,
  decision: RepresentationDecision,
  encodings: AggregateEncodingSelection
): Promise<SemanticEmbodimentEnvelopeV1 | null> | undefined {
  if (decision.chosenCandidateId !== 'AGGREGATE_VOLUME') return undefined;
  const request: AggregateEmbodimentRequestV1 = {
    schemaVersion: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
    candidateId: 'AGGREGATE_VOLUME',
    groupingField: encodings.color ?? '',
    measure: { field: encodings.size, function: 'MEAN' },
    decisionId: decision.id,
    decisionModelVersion: decision.fitnessModelVersion ?? decision.provenance.fitnessModelVersion,
    decisionModelArtifactHash:
      decision.fitnessModelArtifactHash ?? decision.provenance.fitnessModelArtifactHash ?? undefined,
  };
  return executeSemanticRequest(
    authority,
    dataset,
    decision,
    'AGGREGATE_VOLUME',
    request as unknown as Record<string, unknown>
  ).catch(() => null);
}

/** Start the Rust-owned empirical-distribution request with one explicit measure. */
export function loadDistributionSemanticEmbodiment(
  authority: SemanticEmbodimentAuthority,
  dataset: Dataset,
  decision: RepresentationDecision,
  measureField: string
): Promise<SemanticEmbodimentEnvelopeV1 | null> | undefined {
  if (decision.chosenCandidateId !== 'DISTRIBUTION_FIELD') return undefined;
  const request: DistributionEmbodimentRequestV1 = {
    schemaVersion: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
    candidateId: 'DISTRIBUTION_FIELD',
    measureField,
    histogramBinCount: 32,
    ecdfKnotCount: 64,
    quantileProbabilities: [0, 0.25, 0.5, 0.75, 1],
    decisionId: decision.id,
    decisionModelVersion: decision.fitnessModelVersion ?? decision.provenance.fitnessModelVersion,
    decisionModelArtifactHash:
      decision.fitnessModelArtifactHash ?? decision.provenance.fitnessModelArtifactHash ?? undefined,
  };
  return executeSemanticRequest(
    authority,
    dataset,
    decision,
    'DISTRIBUTION_FIELD',
    request as unknown as Record<string, unknown>
  )
    .then((envelope) => {
      if (
        envelope?.representationFamily !== 'DISTRIBUTION' ||
        (envelope.result.status === 'READY' &&
          envelope.result.payload.kind !== 'EMPIRICAL_DISTRIBUTION')
      ) return null;
      return envelope;
    })
    .catch(() => null);
}

/** Start the Rust-owned bivariate binned-density request with explicit measures. */
export function loadDensitySemanticEmbodiment(
  authority: SemanticEmbodimentAuthority,
  dataset: Dataset,
  decision: RepresentationDecision,
  measureFieldX: string,
  measureFieldY: string
): Promise<SemanticEmbodimentEnvelopeV1 | null> | undefined {
  if (decision.chosenCandidateId !== 'DENSITY_FIELD') return undefined;
  const request: DensityEmbodimentRequestV1 = {
    schemaVersion: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
    candidateId: 'DENSITY_FIELD',
    measureFieldX,
    measureFieldY,
    binsX: DENSITY_PRODUCT_BINS_X_V1,
    binsY: DENSITY_PRODUCT_BINS_Y_V1,
    decisionId: decision.id,
    decisionModelVersion: decision.fitnessModelVersion ?? decision.provenance.fitnessModelVersion,
    decisionModelArtifactHash:
      decision.fitnessModelArtifactHash ?? decision.provenance.fitnessModelArtifactHash ?? undefined,
  };
  return executeSemanticRequest(
    authority,
    dataset,
    decision,
    'DENSITY_FIELD',
    request as unknown as Record<string, unknown>
  )
    .then((envelope) => {
      if (
        envelope?.representationFamily !== 'DENSITY' ||
        (envelope.result.status === 'READY' && envelope.result.payload.kind !== 'BINNED_DENSITY')
      ) return null;
      return envelope;
    })
    .catch(() => null);
}

/**
 * R2D source-partition request. `clusterField` is explicit analytical input;
 * TypeScript never promotes a visual colour/category encoding into cluster truth.
 */
export function loadClusterSemanticEmbodiment(
  authority: SemanticEmbodimentAuthority,
  dataset: Dataset,
  decision: RepresentationDecision,
  clusterField: string,
  measureFields: string[]
): Promise<SemanticEmbodimentEnvelopeV1 | null> | undefined {
  if (decision.chosenCandidateId !== 'CLUSTER_REGIONS') return undefined;
  const request: ClusterEmbodimentRequestV1 = {
    schemaVersion: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
    candidateId: 'CLUSTER_REGIONS',
    clusterField,
    measureFields,
    decisionId: decision.id,
    decisionModelVersion: decision.fitnessModelVersion ?? decision.provenance.fitnessModelVersion,
    decisionModelArtifactHash:
      decision.fitnessModelArtifactHash ?? decision.provenance.fitnessModelArtifactHash ?? undefined,
  };
  return executeSemanticRequest(
    authority,
    dataset,
    decision,
    'CLUSTER_REGIONS',
    request as unknown as Record<string, unknown>
  )
    .then((envelope) => {
      if (
        envelope?.representationFamily !== 'CLUSTER' ||
        (envelope.result.status === 'READY' && envelope.result.payload.kind !== 'CLUSTER_REGIONS')
      ) return null;
      return envelope;
    })
    .catch(() => null);
}

/**
 * R2E source-graph request. No graph-construction parameters exist here: Rust
 * transports a source edge list or refuses instead of inventing topology.
 */
export function loadRelationshipGraphSemanticEmbodiment(
  authority: SemanticEmbodimentAuthority,
  dataset: Dataset,
  decision: RepresentationDecision
): Promise<SemanticEmbodimentEnvelopeV1 | null> | undefined {
  if (decision.chosenCandidateId !== 'RELATIONSHIP_GRAPH') return undefined;
  const request: RelationshipGraphEmbodimentRequestV1 = {
    schemaVersion: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
    candidateId: 'RELATIONSHIP_GRAPH',
    decisionId: decision.id,
    decisionModelVersion: decision.fitnessModelVersion ?? decision.provenance.fitnessModelVersion,
    decisionModelArtifactHash:
      decision.fitnessModelArtifactHash ?? decision.provenance.fitnessModelArtifactHash ?? undefined,
  };
  return executeSemanticRequest(
    authority,
    dataset,
    decision,
    'RELATIONSHIP_GRAPH',
    request as unknown as Record<string, unknown>
  )
    .then((envelope) => {
      if (
        envelope?.representationFamily !== 'GRAPH' ||
        (envelope.result.status === 'READY' && envelope.result.payload.kind !== 'RELATIONSHIP_GRAPH')
      ) return null;
      return envelope;
    })
    .catch(() => null);
}
