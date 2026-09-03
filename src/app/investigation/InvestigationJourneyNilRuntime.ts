import type { AtlasCore } from '../../atlas/AtlasCore.ts';
import type { Finding } from '../../atlas/types.ts';
import {
  bindAtlasNilHandlers,
  type NilCommand,
  type NilExecutor,
} from '../../interaction/nil/index.ts';
import { bindDiscoveryNilHandlers } from './DiscoveryNilBindings.ts';
import type { DiscoveryReasoningService } from './DiscoveryReasoningService.ts';

function stringParameter(command: NilCommand, key: string): string | null {
  const value = command.parameters[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Bind the production investigation NIL verbs and their cross-domain fences. */
export function bindInvestigationJourneyNilRuntime(
  executor: NilExecutor,
  atlas: AtlasCore,
  reasoning: DiscoveryReasoningService,
): () => void {
  const disposeAtlasBindings = bindAtlasNilHandlers(executor, atlas, {
    beforeRecordFinding: (command, finding) => {
      const discoveryId = stringParameter(command, 'discoveryId');
      if (!discoveryId) return;
      if (command.targetIds[0] !== discoveryId) {
        throw new Error('NIL CONCLUDE discovery identity does not match its target.');
      }
      const episode = reasoning.snapshot().discoveries.find(
        (entry) => entry.discoveryId === discoveryId,
      );
      if (!episode) throw new Error(`Discovery not found: ${discoveryId}`);
      if (atlas.datasetFingerprint !== episode.provenance.datasetFingerprint) {
        throw new Error('The investigation belongs to a different dataset.');
      }
      if (episode.validationStatus !== 'UNDER_INVESTIGATION' || !episode.hypothesis?.trim()) {
        throw new Error('Record a hypothesis before recording understanding.');
      }
      if (episode.conclusion?.trim()) {
        throw new Error('This investigation already has a recorded understanding.');
      }
      const hasHypothesisLineage = atlas.aggregate.graph.nodes.some(
        (node) =>
          node.metadata?.discoveryId === discoveryId &&
          node.metadata?.discoveryRole === 'hypothesis',
      );
      if (!hasHypothesisLineage) {
        throw new Error('The hypothesis has no authoritative lineage node.');
      }
      if (finding.resultIds.length === 0) {
        throw new Error('Understanding must cite at least one analytical result.');
      }
      const noticeId = episode.evidenceIds[0];
      if (!noticeId || !finding.observationIds.includes(noticeId)) {
        throw new Error('Understanding must cite the notice that started this investigation.');
      }
      for (const resultId of finding.resultIds) {
        const result = atlas.results.find((entry) => entry.resultId === resultId);
        if (!result) throw new Error(`Analytical evidence not found: ${resultId}`);
        if (result.datasetFingerprint !== episode.provenance.datasetFingerprint) {
          throw new Error(`Analytical evidence belongs to a different dataset: ${resultId}`);
        }
      }
    },
    onFindingRecorded: (command, finding: Finding) => {
      const discoveryId = stringParameter(command, 'discoveryId');
      if (discoveryId) reasoning.recordUnderstandingFromFinding(discoveryId, finding.id);
    },
  });
  const disposeDiscoveryBindings = bindDiscoveryNilHandlers(executor, reasoning);

  return () => {
    disposeDiscoveryBindings();
    disposeAtlasBindings();
  };
}
