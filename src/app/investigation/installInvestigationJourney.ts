import type { AppInstance } from '../bootstrap.ts';
import { NilExecutor } from '../../interaction/nil/index.ts';
import { WorldTopics } from '../../utils/EventBus.ts';
import { InvestigationJourneyPanel } from '../../vr/ui/InvestigationJourneyPanel.ts';
import { DiscoveryReasoningService } from './DiscoveryReasoningService.ts';
import { InvestigationJourneyController } from './InvestigationJourneyController.ts';
import { bindInvestigationJourneyNilRuntime } from './InvestigationJourneyNilRuntime.ts';
import { mountDesktopInvestigationJourney } from './DesktopInvestigationJourney.ts';

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
  const panel = new InvestigationJourneyPanel(world.uiManager.analystAnchor, journey);
  world.uiManager.panelManager.register(panel);
  world.uiManager.panelManager.hidePanel(panel);

  const unsubscribePanelContext = subscribeContext(() => panel.refreshJourney());

  const dispose = (): void => {
    unsubscribePanelContext();
    desktop.dispose();
    world.uiManager.panelManager.unregister(panel);
    panel.dispose();
    disposeNilRuntime();
  };
  world.registerExtensionDisposer(dispose);
  return dispose;
}
