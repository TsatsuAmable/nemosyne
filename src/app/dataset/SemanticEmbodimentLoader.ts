import type { Dataset } from '../../data/Dataset.ts';
import type { AnalyticalExecutionPort } from '../../atlas/ports/AnalyticalExecutionPort.ts';
import type { RepresentationDecision } from '../../moneta/representation/RepresentationDecision.ts';
import type {
  ClusterEmbodimentEnvelopeV1,
  ClusterEmbodimentRequestV1,
} from '../../moneta/representation/ClusterEmbodimentPayload.ts';
import type {
  GraphEmbodimentEnvelopeV1,
  GraphEmbodimentRequestV1,
} from '../../moneta/representation/GraphEmbodimentPayload.ts';
import type { SourceRelationshipGraphAuthority } from '../../moneta/representation/RelationshipGraphAuthority.ts';
import { validateSourceRelationshipGraphAuthority } from '../../moneta/representation/RelationshipGraphAuthority.ts';
import {
  SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
  type AggregateEmbodimentRequestV1,
  type DensityEmbodimentRequestV1,
  type DistributionEmbodimentRequestV1,
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

/**
 * Start the A4 production aggregate payload request. The Worker receives dataset
 * rows only through its existing registration channel when it is not already
 * resident. The semantic execution request itself contains parameters and
 * provenance only, and runs against the Worker-local canonical Rust handle.
 */
export function loadAggregateSemanticEmbodiment(
  authority: SemanticEmbodimentAuthority,
  dataset: Dataset,
  decision: RepresentationDecision,
  encodings: AggregateEncodingSelection
): Promise<SemanticEmbodimentEnvelopeV1 | null> | undefined {
  if (decision.chosenCandidateId !== 'AGGREGATE_VOLUME') return undefined;

  const port = authority.executionPort;
  const fingerprint = authority.datasetFingerprint;
  const version = authority.datasetVersion;
  const generation = authority.generation;
  if (!port?.isAsync || !fingerprint) return Promise.resolve(null);

  const request: AggregateEmbodimentRequestV1 = {
    schemaVersion: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
    candidateId: 'AGGREGATE_VOLUME',
    groupingField: encodings.color ?? '',
    measure: { field: encodings.size, function: 'MEAN' },
    decisionId: decision.id,
    decisionModelVersion: decision.fitnessModelVersion ?? decision.provenance.fitnessModelVersion,
    decisionModelArtifactHash:
      decision.fitnessModelArtifactHash ??
      decision.provenance.fitnessModelArtifactHash ??
      undefined,
  };

  return (async () => {
    if (!port.hasRegisteredDataset?.(generation, fingerprint)) {
      if (!port.registerDataset) return null;
      await port.registerDataset({
        registrationId: `semantic-register-${generation}-${version}-${++requestSequence}`,
        dataset: { fingerprint, version },
        generation,
        payload: { type: 'json', data: dataset.toJSON(), name: dataset.name },
      });
    }

    if (!isCurrent(authority, generation, version, fingerprint)) return null;

    const result = await port.execute<SemanticEmbodimentEnvelopeV1>({
      requestId: `semantic-aggregate-${generation}-${version}-${++requestSequence}`,
      operation: 'semanticEmbodiment',
      dataset: { fingerprint, version },
      generation,
      params: request as unknown as Record<string, unknown>,
    });

    if (!isCurrent(authority, generation, version, fingerprint)) return null;
    const envelope = result.value;
    if (
      !envelope ||
      envelope.schemaVersion !== SEMANTIC_EMBODIMENT_SCHEMA_VERSION ||
      envelope.datasetFingerprint !== fingerprint ||
      envelope.candidateId !== 'AGGREGATE_VOLUME'
    ) {
      return null;
    }
    return envelope;
  })().catch(() => null);
}

/**
 * Start the M3 production empirical-distribution request. The measure is an
 * explicit analytical-intent input; an absent/invalid measure is transported
 * unchanged so Rust can refuse it rather than TypeScript selecting a column.
 */
export function loadDistributionSemanticEmbodiment(
  authority: SemanticEmbodimentAuthority,
  dataset: Dataset,
  decision: RepresentationDecision,
  measureField: string
): Promise<SemanticEmbodimentEnvelopeV1 | null> | undefined {
  if (decision.chosenCandidateId !== 'DISTRIBUTION_FIELD') return undefined;

  const port = authority.executionPort;
  const fingerprint = authority.datasetFingerprint;
  const version = authority.datasetVersion;
  const generation = authority.generation;
  if (!port?.isAsync || !fingerprint) return Promise.resolve(null);

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
      decision.fitnessModelArtifactHash ??
      decision.provenance.fitnessModelArtifactHash ??
      undefined,
  };

  return (async () => {
    if (!port.hasRegisteredDataset?.(generation, fingerprint)) {
      if (!port.registerDataset) return null;
      await port.registerDataset({
        registrationId: `semantic-register-${generation}-${version}-${++requestSequence}`,
        dataset: { fingerprint, version },
        generation,
        payload: { type: 'json', data: dataset.toJSON(), name: dataset.name },
      });
    }

    if (!isCurrent(authority, generation, version, fingerprint)) return null;

    const result = await port.execute<SemanticEmbodimentEnvelopeV1>({
      requestId: `semantic-distribution-${generation}-${version}-${++requestSequence}`,
      operation: 'semanticEmbodiment',
      dataset: { fingerprint, version },
      generation,
      params: request as unknown as Record<string, unknown>,
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
      envelope.candidateId !== 'DISTRIBUTION_FIELD' ||
      envelope.representationFamily !== 'DISTRIBUTION' ||
      envelope.provenance.decisionId !== decision.id ||
      (envelope.result.status === 'READY' &&
        envelope.result.payload.kind !== 'EMPIRICAL_DISTRIBUTION')
    ) {
      return null;
    }
    return envelope;
  })().catch(() => null);
}

/**
 * Start the R2C M3 production bivariate binned-density request. Both measures
 * come from explicit analytical requirements. Missing, duplicate, non-numeric,
 * or otherwise invalid fields are sent unchanged so the Rust authority can
 * refuse them rather than TypeScript substituting a convenient column.
 */
export function loadDensitySemanticEmbodiment(
  authority: SemanticEmbodimentAuthority,
  dataset: Dataset,
  decision: RepresentationDecision,
  measureFieldX: string,
  measureFieldY: string
): Promise<SemanticEmbodimentEnvelopeV1 | null> | undefined {
  if (decision.chosenCandidateId !== 'DENSITY_FIELD') return undefined;

  const port = authority.executionPort;
  const fingerprint = authority.datasetFingerprint;
  const version = authority.datasetVersion;
  const generation = authority.generation;
  if (!port?.isAsync || !fingerprint) return Promise.resolve(null);

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
      decision.fitnessModelArtifactHash ??
      decision.provenance.fitnessModelArtifactHash ??
      undefined,
  };

  return (async () => {
    if (!port.hasRegisteredDataset?.(generation, fingerprint)) {
      if (!port.registerDataset) return null;
      await port.registerDataset({
        registrationId: `semantic-register-${generation}-${version}-${++requestSequence}`,
        dataset: { fingerprint, version },
        generation,
        payload: { type: 'json', data: dataset.toJSON(), name: dataset.name },
      });
    }

    if (!isCurrent(authority, generation, version, fingerprint)) return null;

    const result = await port.execute<SemanticEmbodimentEnvelopeV1>({
      requestId: `semantic-density-${generation}-${version}-${++requestSequence}`,
      operation: 'semanticEmbodiment',
      dataset: { fingerprint, version },
      generation,
      params: request as unknown as Record<string, unknown>,
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
      envelope.candidateId !== 'DENSITY_FIELD' ||
      envelope.representationFamily !== 'DENSITY' ||
      envelope.provenance.decisionId !== decision.id ||
      (envelope.result.status === 'READY' && envelope.result.payload.kind !== 'BINNED_DENSITY')
    ) {
      return null;
    }
    return envelope;
  })().catch(() => null);
}

/**
 * Start the C3 source-partition cluster request. The partition field and 2/3
 * coordinate fields come directly from the explicit RepresentationRequirements
 * contract. TypeScript does not validate types, substitute fields, group rows or
 * compute spatial summaries; Rust refuses malformed declarations.
 */
export function loadClusterSemanticEmbodiment(
  authority: SemanticEmbodimentAuthority,
  dataset: Dataset,
  decision: RepresentationDecision,
  partitionField: string,
  coordinateFields: string[]
): Promise<ClusterEmbodimentEnvelopeV1 | null> | undefined {
  if (decision.chosenCandidateId !== 'CLUSTER_REGIONS') return undefined;

  const port = authority.executionPort;
  const fingerprint = authority.datasetFingerprint;
  const version = authority.datasetVersion;
  const generation = authority.generation;
  if (!port?.isAsync || !fingerprint) return Promise.resolve(null);

  const request: ClusterEmbodimentRequestV1 = {
    schemaVersion: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
    candidateId: 'CLUSTER_REGIONS',
    partitionField,
    coordinateFields: [...coordinateFields],
    decisionId: decision.id,
    decisionModelVersion: decision.fitnessModelVersion ?? decision.provenance.fitnessModelVersion,
    decisionModelArtifactHash:
      decision.fitnessModelArtifactHash ??
      decision.provenance.fitnessModelArtifactHash ??
      undefined,
  };

  return (async () => {
    if (!port.hasRegisteredDataset?.(generation, fingerprint)) {
      if (!port.registerDataset) return null;
      await port.registerDataset({
        registrationId: `semantic-register-${generation}-${version}-${++requestSequence}`,
        dataset: { fingerprint, version },
        generation,
        payload: { type: 'json', data: dataset.toJSON(), name: dataset.name },
      });
    }

    if (!isCurrent(authority, generation, version, fingerprint)) return null;

    const result = await port.execute<ClusterEmbodimentEnvelopeV1>({
      requestId: `semantic-cluster-${generation}-${version}-${++requestSequence}`,
      operation: 'semanticEmbodiment',
      dataset: { fingerprint, version },
      generation,
      params: request as unknown as Record<string, unknown>,
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
      envelope.candidateId !== 'CLUSTER_REGIONS' ||
      envelope.representationFamily !== 'CLUSTER' ||
      envelope.provenance.decisionId !== decision.id ||
      (envelope.result.status === 'READY' &&
        envelope.result.payload.kind !== 'CLUSTER_REGIONS')
    ) {
      return null;
    }
    return envelope;
  })().catch(() => null);
}

/**
 * Start the R2E B2 resident source-relationship-graph request. The graph
 * authority is the explicit B1 `SOURCE_EDGES` contract and is re-validated
 * through the shared strict validator on this production surface; no weaker
 * parallel parser may decide graph admissibility. TypeScript does not resolve
 * endpoints, retain topology, mint semantic identity or compute layout; the
 * resident Rust/WASM authority owns all of that and refuses fail-closed.
 */
export function loadGraphSemanticEmbodiment(
  authority: SemanticEmbodimentAuthority,
  dataset: Dataset,
  decision: RepresentationDecision,
  graphAuthority: SourceRelationshipGraphAuthority
): Promise<GraphEmbodimentEnvelopeV1 | null> | undefined {
  if (decision.chosenCandidateId !== 'RELATIONSHIP_GRAPH') return undefined;

  const port = authority.executionPort;
  const fingerprint = authority.datasetFingerprint;
  const version = authority.datasetVersion;
  const generation = authority.generation;
  if (!port?.isAsync || !fingerprint) return Promise.resolve(null);

  return (async () => {
    // Strict B1 validation on the live production surface: an unknown or
    // widened authority field fails closed here, not only in the schema layer.
    const validatedAuthority = validateSourceRelationshipGraphAuthority(graphAuthority);

    const request: GraphEmbodimentRequestV1 = {
      schemaVersion: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
      candidateId: 'RELATIONSHIP_GRAPH',
      graphAuthority: validatedAuthority,
      decisionId: decision.id,
      decisionModelVersion: decision.fitnessModelVersion ?? decision.provenance.fitnessModelVersion,
      decisionModelArtifactHash:
        decision.fitnessModelArtifactHash ??
        decision.provenance.fitnessModelArtifactHash ??
        undefined,
    };

    if (!port.hasRegisteredDataset?.(generation, fingerprint)) {
      if (!port.registerDataset) return null;
      await port.registerDataset({
        registrationId: `semantic-register-${generation}-${version}-${++requestSequence}`,
        dataset: { fingerprint, version },
        generation,
        payload: { type: 'json', data: dataset.toJSON(), name: dataset.name },
      });
    }

    if (!isCurrent(authority, generation, version, fingerprint)) return null;

    const result = await port.execute<GraphEmbodimentEnvelopeV1>({
      requestId: `semantic-graph-${generation}-${version}-${++requestSequence}`,
      operation: 'semanticEmbodiment',
      dataset: { fingerprint, version },
      generation,
      params: request as unknown as Record<string, unknown>,
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
      envelope.candidateId !== 'RELATIONSHIP_GRAPH' ||
      envelope.representationFamily !== 'GRAPH' ||
      envelope.provenance.decisionId !== decision.id ||
      (envelope.result.status === 'READY' &&
        envelope.result.payload.kind !== 'RELATIONSHIP_GRAPH')
    ) {
      return null;
    }
    return envelope;
  })().catch(() => null);
}
