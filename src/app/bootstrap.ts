/**
 * Application Bootstrap & Composition Root.
 *
 * Coordinates initialization of the presentation layer, input subsystem, and dev tools.
 */

import { World } from '../vr/World.ts';
import { setupDevTraceRecorder } from './devTrace.ts';

export interface AppInstance {
  world: World;
}

export async function bootstrapApp(): Promise<AppInstance> {
  const world = new World();
  await world.start();

  if (import.meta.env.DEV) {
    setupDevTraceRecorder(world);
  }

  const telemetry = document.getElementById('telemetry');
  if (telemetry) {
    telemetry.textContent = 'ready — point and select to inspect';
  }

  return { world };
}
