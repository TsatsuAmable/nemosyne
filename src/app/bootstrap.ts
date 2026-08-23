/**
 * Application Bootstrap & Composition Root.
 *
 * Coordinates initialization of the presentation layer, input subsystem, and dev tools.
 */

import { World } from '../vr/World.ts';
import { initRuntime } from '../wasm/RuntimeBridge.ts';
import { setupDevTraceRecorder } from './devTrace.ts';

export interface AppInstance {
  world: World;
}

export async function bootstrapApp(): Promise<AppInstance> {
  await initRuntime();
  const world = new World();
  await world.start();

  if (import.meta.env.DEV) {
    setupDevTraceRecorder(world);
  }

  const telemetry = document.getElementById('telemetry');
  if (telemetry) {
    if (world.bootState === 'KERNEL_UNAVAILABLE') {
      telemetry.textContent = 'analytical kernel unavailable — run npm run wasm:dev';
    } else {
      telemetry.textContent = 'ready — point and select to inspect';
    }
  }

  return { world };
}
