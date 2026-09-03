import type { AppInstance } from '../bootstrap.ts';
import {
  bindAtlasNilHandlers,
  NilExecutor,
  type NilCommand,
} from '../../interaction/nil/index.ts';
import type { Finding } from '../../atlas/types.ts';
import { WorldTopics } from '../../utils/EventBus.ts';
import { InvestigationJourneyPanel } from '../../vr/ui/InvestigationJourneyPanel.ts';
import { bindDiscoveryNilHandlers } from './DiscoveryNilBindings.ts';
import { DiscoveryReasoningService } from './DiscoveryReasoningService.ts';
import { InvestigationJourneyController } from './InvestigationJourneyController.ts';
import { mountDesktopInvestigationJourney } from './DesktopInvestigationJourney.ts';

function stringParameter(command: NilCommand, key: string): string | null {
  const value = command.parameters[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Install the PT5C production investigation path after the base application has
 * started. This is deliberately a composition extension: it reuses the live
 * Atlas aggregate and panel manager and creates no second persistence authority.
 */
export function installInvestigationJourney(app: AppInstance): () => void {
  const { world } = app;
  const reasoning = new DiscoveryReasoningService(world.atlas, {
    investigationVersion: 'pt5c-investigation-journey/1',
  });
  const executor = new NilExecutor();

  const disposeAtlasBindings = bindAtlasNilHandlers(executor, world.atlas, {
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
      if (world.atlas.datasetFingerprint !== episode.provenance.datasetFingerprint) {
        throw new Error('The investigation belongs to a different dataset.');
      }
      if (episode.validationStatus !== 'UNDER_INVESTIGATION' || !episode.hypothesis?.trim()) {
        throw new Error('Record a hypothesis before recording understanding.');
      }
      if (episode.conclusion?.trim()) {
        throw new Error('This investigation already has a recorded understanding.');
      }
      const hasHypothesisLineage = world.atlas.aggregate.graph.nodes.some(
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
        const result = world.atlas.results.find((entry) => entry.resultId === resultId);
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

  const journey = new InvestigationJourneyController({
    executor,
    reasoning,
    investigationId: () => world.atlas.aggregate.sessionId,
  });

  const subscribeContext = (handler: () => void): (() => void) => {
    const refresh = () => queueMicrotask(handler);
    const unsubscribeDataset = world.eventBus.on(WorldTopics.DATASET_LOADED, refresh);
    const unsubscribeOperation = world.eventBus.on(WorldTopics.OPERATION_APPLIED, refresh);
    return () => {
      unsubscribeDataset();
      unsubscribeOperation();
    };
  };

  const desktop = mountDesktopInvestigationJourney({ journey, subscribeContext });
  const panel = new InvestigationJourneyPanel(world.uiManager.analystAnchor, journey);
  world.uiManager.panelManager.register(panel);
  world.uiManager.panelManager.hidePanel(panel);

  const unsubscribePanelContext = subscribeContext(() => panel.refreshJourney());

  const dispose = (): void => {
    unsubscribePanelContext();
    desktop.dispose();
    world.uiManager.panelManager.unregister(panel);
    panel.dispose();
    disposeDiscoveryBindings();
    disposeAtlasBindings();
  };
  world.registerExtensionDisposer(dispose);
  return dispose;
}
