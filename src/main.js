import { World } from './vr/World.js';

const telemetry = document.getElementById('telemetry');

function logStartupError(err) {
  console.error('[Nemosyne] startup error:', err);
  if (telemetry) {
    telemetry.textContent = `ERROR: ${err?.message ?? err}`;
    telemetry.style.color = '#ff0055';
  }
}

window.addEventListener('error', (e) => {
  logStartupError(e.error ?? e.message);
});

window.addEventListener('unhandledrejection', (e) => {
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
