import type { AppInstance } from '../bootstrap.ts';
import { NilExecutor } from '../../interaction/nil/index.ts';
import { WorldTopics } from '../../utils/EventBus.ts';
import { InvestigationJourneyPanel } from '../../vr/ui/InvestigationJourneyPanel.ts';
import { DiscoveryReasoningService } from './DiscoveryReasoningService.ts';
import { InvestigationJourneyController } from './InvestigationJourneyController.ts';
import { bindInvestigationJourneyNilRuntime } from './InvestigationJourneyNilRuntime.ts';
import { mountDesktopInvestigationJourney } from './DesktopInvestigationJourney.ts';
import { mountDesktopDirectLoopControls } from './DesktopDirectLoopControls.ts';
import { diagnoseDirectEvidenceReadiness, isSemanticEnvelopeV1 } from './DirectEvidenceReadiness.ts';

/**
 * Install the PT5C production investigation path after the base application has
 * started. This is deliberately a composition extension: it reuses the live
 * Atlas aggregate and workspace-surface authority and creates no second persistence authority.
 */
export function installInvestigationJourney(app: AppInstance): () => void {
  const { world } = app;
  const reasoning = new DiscoveryReasoningService(world.atlas, {
    investigationVersion: 'pt5c-investigation-journey/1',
  });
  const executor = new NilExecutor();
  const disposeNilRuntime = bindInvestigationJourneyNilRuntime(executor, world.atlas, reasoning);

  const journey = new InvestigationJourneyController({
    executor,
    reasoning,
    investigationId: () => world.atlas.aggregate.sessionId,
  });

  const subscribeContext = (handler: () => void): (() => void) => {
    const refresh = () => queueMicrotask(handler);
    const unsubscribeDataset = world.eventBus.on(WorldTopics.DATASET_LOADED, refresh);
    const unsubscribeOperation = world.eventBus.on(WorldTopics.OPERATION_APPLIED, refresh);
    // Session/checkpoint/.nemosyne restoration publishes HISTORY_SEEK only
    // after the persisted Atlas state has replaced the transient dataset-load
    // reset. Refresh reasoning surfaces from that authoritative post-restore
    // event so they cannot remain visually stuck on the intermediate state.
    const unsubscribeHistory = world.eventBus.on(WorldTopics.HISTORY_SEEK, refresh);
    return () => {
      unsubscribeDataset();
      unsubscribeOperation();
      unsubscribeHistory();
    };
  };

  const desktop = mountDesktopInvestigationJourney({ journey, subscribeContext });
  // FM2 uses the very same sequenced NIL executor and Atlas bindings as the
  // normal investigation journey. The rail is presentation, not authority.
  const directControls = mountDesktopDirectLoopControls(
    world.atlas, executor, world.eventBus, () => app.investigationShell.refreshContext(),
    async () => {
      // Inspect only the currently displayed production Rust semantic source.
      // Descriptive statistics receipts cannot authorize its representation.
      const dataInput = world.monetaNode?.dataInput as
        | { semanticEmbodiment?: unknown; semanticEmbodimentPromise?: Promise<unknown> }
        | undefined;
      const rawSource = dataInput?.semanticEmbodimentPromise
        ? await dataInput.semanticEmbodimentPromise : dataInput?.semanticEmbodiment;
      const source = isSemanticEnvelopeV1(rawSource) ? rawSource : null;
      const capture = source ? await world.atlas.captureGovernedEvidenceReceipt() : null;
      return diagnoseDirectEvidenceReadiness({
        source, capture,
        liveDatasetFingerprint: world.atlas.datasetFingerprint,
        liveKernelVersion: world.atlas.kernelVersion(),
      });
    },
    async () => {
      const measureField = world.atlas.dataset?.numericColumns[0]?.name;
      if (!measureField) {
        throw new Error('Direct compilation refused: current dataset has no numeric measure field.');
      }
      return world.atlas.compileDirectDistributionEmbodiment({
        schemaVersion: 1,
        candidateId: 'DISTRIBUTION_FIELD',
        measureField,
        histogramBinCount: 8,
        ecdfKnotCount: 8,
        quantileProbabilities: [0, 0.25, 0.5, 0.75, 1],
      });
    }
  );
  const panel = new InvestigationJourneyPanel(world.uiManager.analystAnchor, journey);
  world.uiManager.workspaceSurfaces.registerPanel('investigation-journey', panel);
  world.uiManager.workspaceSurfaces.hide('investigation-journey');

  const unsubscribePanelContext = subscribeContext(() => panel.refreshJourney());

  const dispose = (): void => {
    unsubscribePanelContext();
    directControls.dispose();
    desktop.dispose();
    world.uiManager.workspaceSurfaces.unregister('investigation-journey');
    panel.dispose();
    disposeNilRuntime();
  };
  world.registerExtensionDisposer(dispose);
  return dispose;
}
