import type { AppInstance } from '../bootstrap.ts';
import { WorldTopics } from '../../utils/EventBus.ts';
import { InvestigationContinuityPanel } from '../../vr/ui/InvestigationContinuityPanel.ts';
import { mountDesktopInvestigationContinuity } from './DesktopInvestigationContinuity.ts';
import { InvestigationContinuityController } from './InvestigationContinuityController.ts';

function downloadPortable(bytes: Uint8Array): void {
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], {
    type: 'application/vnd.nemosyne+zip',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `nemosyne-investigation-${new Date().toISOString().slice(0, 10)}.nemosyne`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Install PT5D as a product composition extension. Desktop, the existing
 * Evidence Vault, and XR receive the same application controller; existing
 * session/package/Vault authorities stay underneath it and no modality-specific
 * persistence path is created.
 */
export function installInvestigationContinuity(app: AppInstance): () => void {
  const { world } = app;
  const continuity = new InvestigationContinuityController({
    sessionController: world.sessionController,
    verifyPortableInvestigation: (bytes) => world.replayPortableInvestigation(bytes),
    currentKernelVersion: () => world.atlas.kernelVersion(),
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

  const vault = world.uiManager.vaultPanel;
  const originalVaultCallbacks = {
    onFreeze: vault.onFreeze,
    onRestore: vault.onRestore,
    onExport: vault.onExport,
    onDelete: vault.onDelete,
  };

  const logFailure = (action: string, error: unknown): void => {
    world.uiManager.vrConsole?.log?.('warn', [
      `${action} failed: ${error instanceof Error ? error.message : String(error)}`,
    ]);
  };

  const refreshVault = async (): Promise<void> => {
    const archives = await world.sessionController.archiveStore.listArchives();
    vault.setArchives(archives);
  };

  const refresh = (): void => {
    void desktop.refresh();
    void panel.refreshContinuity();
    void refreshVault().catch((error) => logFailure('Evidence Vault refresh', error));
  };

  // Rebind the already-visible Evidence Vault instrument. Leaving its legacy
  // callbacks active would allow weaker digest-null checkpoints and portable
  // exports without PT5D's resumable workspace entry.
  vault.onFreeze = () => {
    void continuity.createCheckpoint('Evidence Vault checkpoint')
      .then(() => refresh())
      .catch((error) => logFailure('Checkpoint', error));
  };
  vault.onRestore = (archiveId) => {
    void continuity.restoreCheckpoint(archiveId)
      .then(() => refresh())
      .catch((error) => logFailure('Checkpoint restore', error));
  };
  vault.onExport = (archiveId) => {
    void continuity.exportCheckpoint(archiveId)
      .then((bytes) => {
        downloadPortable(bytes);
        refresh();
      })
      .catch((error) => logFailure('Checkpoint export', error));
  };
  vault.onDelete = (archiveId) => {
    void continuity.deleteCheckpoint(archiveId)
      .then(() => refresh())
      .catch((error) => logFailure('Checkpoint delete', error));
  };

  const unsubscribeDataset = world.eventBus.on(WorldTopics.DATASET_LOADED, () => queueMicrotask(refresh));
  const unsubscribeOperation = world.eventBus.on(WorldTopics.OPERATION_APPLIED, () => queueMicrotask(refresh));
  const unsubscribeHistory = world.eventBus.on(WorldTopics.HISTORY_SEEK, () => queueMicrotask(refresh));

  refresh();

  const dispose = (): void => {
    unsubscribeDataset();
    unsubscribeOperation();
    unsubscribeHistory();
    vault.onFreeze = originalVaultCallbacks.onFreeze;
    vault.onRestore = originalVaultCallbacks.onRestore;
    vault.onExport = originalVaultCallbacks.onExport;
    vault.onDelete = originalVaultCallbacks.onDelete;
    desktop.dispose();
    world.uiManager.panelManager.unregister(panel);
    panel.dispose();
  };
  world.registerExtensionDisposer(dispose);
  return dispose;
}
