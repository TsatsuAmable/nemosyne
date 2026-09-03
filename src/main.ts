import { remoteDebugStreamer } from './utils/RemoteDebugStreamer.ts';
import { bootstrapApp } from './app/index.ts';
import { installConfiguredProductAnalyticsClient } from './app/governance/installProductAnalyticsClient.ts';
import { installInvestigationJourney } from './app/investigation/installInvestigationJourney.ts';
import {
  initializeClientPersistence,
  installClientPersistenceStorageBridge,
} from './persistence/ClientPersistence.ts';
import { injectCssVariables } from './vr/ui-system/tokens.ts';

if (import.meta.env.DEV) {
  remoteDebugStreamer.init();
}

injectCssVariables();

function handleFatalError(err: unknown): void {
  console.error('[Nemosyne] Fatal startup error:', err);
  const telemetry = document.getElementById('telemetry');
  if (telemetry) {
    const message = err instanceof Error ? err.message : String(err);
    telemetry.textContent = `ERROR: ${message}`;
    telemetry.style.color = 'var(--nms-color-danger-destructive)';
  }
}

window.addEventListener('error', (e: ErrorEvent) => {
  handleFatalError(e.error ?? e.message);
});

window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  handleFatalError(e.reason);
});

async function start(): Promise<void> {
  await initializeClientPersistence().catch((error) => {
    console.warn('[Nemosyne] client persistence unavailable; continuing without durable local state', error);
  });
  installClientPersistenceStorageBridge();

  const app = await bootstrapApp();
  installInvestigationJourney(app);

  const productAnalytics = await installConfiguredProductAnalyticsClient(app.world.eventBus);
  if (!productAnalytics) return;

  const authorize = (): void => { void productAnalytics.beginAuthorization().catch(handleFatalError); };
  const revokeObserved = (): void => productAnalytics.discardQueuedOnRevocation();
  const clearCredentials = (): void => productAnalytics.clearCredentials();
  window.addEventListener('nemosyne:product-analytics-authorize', authorize);
  window.addEventListener('nemosyne:product-analytics-revoked', revokeObserved);
  window.addEventListener('nemosyne:product-analytics-signout', clearCredentials);
  app.world.registerExtensionDisposer(() => {
    window.removeEventListener('nemosyne:product-analytics-authorize', authorize);
    window.removeEventListener('nemosyne:product-analytics-revoked', revokeObserved);
    window.removeEventListener('nemosyne:product-analytics-signout', clearCredentials);
    productAnalytics.dispose();
  });
}

void start().catch(handleFatalError);
