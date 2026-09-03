import { remoteDebugStreamer } from './utils/RemoteDebugStreamer.ts';
import { bootstrapApp } from './app/index.ts';
import { installConfiguredProductAnalyticsClient } from './app/governance/installProductAnalyticsClient.ts';
import { installInvestigationJourney } from './app/investigation/installInvestigationJourney.ts';
import { installInvestigationContinuity } from './app/investigation/installInvestigationContinuity.ts';
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

/**
 * Local persistence is optional for boot but not invisible. A durable DOM
 * status survives World telemetry refreshes and tells the investigator that
 * autosave/recovery is unavailable instead of letting a session appear safe.
 */
export function showPersistenceUnavailableNotice(error: unknown): HTMLElement {
  const existing = document.getElementById('nemosyne-persistence-warning');
  if (existing) return existing;

  const notice = document.createElement('div');
  notice.id = 'nemosyne-persistence-warning';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  notice.textContent = 'Local persistence unavailable. Autosave and local recovery are disabled.';
  notice.title = error instanceof Error ? error.message : String(error);
  Object.assign(notice.style, {
    position: 'fixed',
    left: '50%',
    bottom: '1rem',
    transform: 'translateX(-50%)',
    zIndex: '10000',
    maxWidth: 'min(42rem, calc(100vw - 2rem))',
    padding: '0.65rem 0.9rem',
    borderRadius: '0.5rem',
    background: 'var(--nms-color-surface-elevated, rgba(20, 20, 24, 0.94))',
    color: 'var(--nms-color-danger-destructive, #ff6b6b)',
    font: '600 0.875rem/1.35 system-ui, sans-serif',
    textAlign: 'center',
    pointerEvents: 'none',
  });
  document.body.appendChild(notice);
  return notice;
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
    showPersistenceUnavailableNotice(error);
  });
  installClientPersistenceStorageBridge();

  const app = await bootstrapApp();
  installInvestigationJourney(app);
  installInvestigationContinuity(app);

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
