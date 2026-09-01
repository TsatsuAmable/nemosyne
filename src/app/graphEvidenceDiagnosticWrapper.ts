import type { GraphEvidenceDiagnosticHook } from './graphEvidenceDiagnostics.ts';
import { installGraphEvidenceDiagnosticHook as installBaseGraphEvidenceDiagnosticHook } from './graphEvidenceDiagnostics.ts';
import type { GraphEmbodimentEnvelopeV1 } from '../moneta/representation/GraphEmbodimentPayload.ts';
import type { MonetaTopologyNode } from '../moneta/MonetaTopologyNode.ts';

interface GraphEvidenceDebugWorld {
  dracoNode: MonetaTopologyNode | null;
}

function boundedIdentitySnapshot(world: GraphEvidenceDebugWorld): Record<string, unknown> {
  const node = world.dracoNode;
  const semanticInput = node?.dataInput as
    | {
        semanticEmbodimentCandidateId?: unknown;
        semanticEmbodiment?: GraphEmbodimentEnvelopeV1 | null;
      }
    | undefined;
  const envelope = semanticInput?.semanticEmbodiment;
  const metadata = node?.group?.userData.semanticEmbodiment as
    | {
        artifactId?: unknown;
        datasetFingerprint?: unknown;
        candidateId?: unknown;
        payloadKind?: unknown;
        provenance?: { decisionId?: unknown };
      }
    | undefined;

  return {
    decisionId: node?.representationDecision?.id ?? null,
    chosenCandidateId: node?.representationDecision?.chosenCandidateId ?? null,
    semanticEmbodimentCandidateId: semanticInput?.semanticEmbodimentCandidateId ?? null,
    envelopeDatasetFingerprint: envelope?.datasetFingerprint ?? null,
    envelopeCandidateId: envelope?.candidateId ?? null,
    envelopeDecisionId: envelope?.provenance.decisionId ?? null,
    envelopeResultStatus: envelope?.result.status ?? null,
    metadataArtifactId: metadata?.artifactId ?? null,
    metadataDatasetFingerprint: metadata?.datasetFingerprint ?? null,
    metadataCandidateId: metadata?.candidateId ?? null,
    metadataPayloadKind: metadata?.payloadKind ?? null,
    metadataDecisionId: metadata?.provenance?.decisionId ?? null,
    presentationStatus: node?.group?.userData.semanticEmbodimentStatus ?? null,
  };
}

/**
 * B4-only wrapper around the evidence hook. It adds bounded identity diagnostics
 * to thrown errors without exposing source rows, edge payloads or user-authored
 * content. This remains diagnostics-gated by the same explicit build flag.
 */
export function installGraphEvidenceDiagnosticHook(world: GraphEvidenceDebugWorld): () => void {
  const dispose = installBaseGraphEvidenceDiagnosticHook(world as never);
  const hook = window.__NEMOSYNE_GRAPH_B4_EVIDENCE__ as GraphEvidenceDiagnosticHook | undefined;
  if (!hook) return dispose;

  const baseRunScenario = hook.runScenario.bind(hook);
  hook.runScenario = async (input) => {
    try {
      return await baseRunScenario(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${message}; identity=${JSON.stringify(boundedIdentitySnapshot(world))}`);
    }
  };
  return dispose;
}
