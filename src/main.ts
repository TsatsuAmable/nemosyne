import { remoteDebugStreamer } from './utils/RemoteDebugStreamer.ts';
import { bootstrapApp } from './app/index.ts';

if (import.meta.env.DEV) {
  remoteDebugStreamer.init();
}

function handleFatalError(err: unknown): void {
  console.error('[Nemosyne] Fatal startup error:', err);
  const telemetry = document.getElementById('telemetry');
  if (telemetry) {
    const message = err instanceof Error ? err.message : String(err);
    telemetry.textContent = `ERROR: ${message}`;
    telemetry.style.color = '#ff0055';
  }
}

window.addEventListener('error', (e: ErrorEvent) => {
  handleFatalError(e.error ?? e.message);
});

window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  handleFatalError(e.reason);
});

bootstrapApp().catch(handleFatalError);
