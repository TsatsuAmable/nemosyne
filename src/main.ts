import { remoteDebugStreamer } from './utils/RemoteDebugStreamer.ts';
remoteDebugStreamer.init();

import { World } from './vr/World.ts';

const telemetry = document.getElementById('telemetry');

function logStartupError(err: unknown): void {
  console.error('[Nemosyne] startup error:', err);
  if (telemetry) {
    const message = err instanceof Error ? err.message : String(err);
    telemetry.textContent = `ERROR: ${message}`;
    telemetry.style.color = '#ff0055';
  }
}

window.addEventListener('error', (e: ErrorEvent) => {
  logStartupError(e.error ?? e.message);
});

window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  logStartupError(e.reason);
});

(async () => {
  try {
    const world = new World();
    await world.start();
    if (telemetry) {
      telemetry.textContent = 'ready — point and select to inspect';
    }
  } catch (err) {
    logStartupError(err);
  }
})();
