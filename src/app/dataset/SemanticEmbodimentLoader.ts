import type { Dataset } from '../../data/Dataset.ts';
import type { AnalyticalExecutionPort } from '../../atlas/ports/AnalyticalExecutionPort.ts';
import type { RepresentationDecision } from '../../moneta/representation/RepresentationDecision.ts';
import {
  SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
  type AggregateEmbodimentRequestV1,
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

let requestSequence = 0;

function isCurrent(
  authority: SemanticEmbodimentAuthority,
  generation: number,
  version: number,
  fingerprint: string,
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
  encodings: AggregateEncodingSelection,
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
      decision.fitnessModelArtifactHash ?? decision.provenance.fitnessModelArtifactHash ?? undefined,
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
