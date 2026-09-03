import type { AppInstance } from '../bootstrap.ts';
import { WorldTopics } from '../../utils/EventBus.ts';
import { InvestigationContinuityPanel } from '../../vr/ui/InvestigationContinuityPanel.ts';
import { mountDesktopInvestigationContinuity } from './DesktopInvestigationContinuity.ts';
import { InvestigationContinuityController } from './InvestigationContinuityController.ts';

/**
 * Install PT5D as a product composition extension. Desktop and XR receive the
 * same application controller; existing session/package/Vault authorities stay
 * underneath it and no modality-specific persistence path is created.
 */
export function installInvestigationContinuity(app: AppInstance): () => void {
  const { world } = app;
  const continuity = new InvestigationContinuityController({
    sessionController: world.sessionController,
    verifyPortableInvestigation: (bytes) => world.replayPortableInvestigation(bytes),
    environment: () => ({
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      platform: typeof navigator !== 'undefined' ? navigator.platform : null,
      webxrSupported: typeof navigator !== 'undefined' ? 'xr' in navigator : null,
    }),
  });

  const desktop = mountDesktopInvestigationContinuity(continuity);
  const panel = new InvestigationContinuityPanel(world.uiManager.analystAnchor, continuity);
  world.uiManager.panelManager.register(panel);
  world.uiManager.panelManager.hidePanel(panel);

  const refresh = (): void => {
    void desktop.refresh();
    void panel.refreshContinuity();
  };
  const unsubscribeDataset = world.eventBus.on(WorldTopics.DATASET_LOADED, () => queueMicrotask(refresh));
  const unsubscribeOperation = world.eventBus.on(WorldTopics.OPERATION_APPLIED, () => queueMicrotask(refresh));

  const dispose = (): void => {
    unsubscribeDataset();
    unsubscribeOperation();
    desktop.dispose();
    world.uiManager.panelManager.unregister(panel);
    panel.dispose();
  };
  world.registerExtensionDisposer(dispose);
  return dispose;
}
