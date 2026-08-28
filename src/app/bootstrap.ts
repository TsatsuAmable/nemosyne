/**
 * Application Bootstrap & Composition Root.
 *
 * Coordinates initialization of the presentation layer, input subsystem, and dev tools.
 */

import { World } from '../vr/World.ts';
import { setupDevTraceRecorder } from './devTrace.ts';
import { mountAnalystJourneyControls, type AnalystJourneyControlsHandle } from './AnalystJourneyControls.ts';

export interface AppInstance {
  world: World;
  analystJourneyControls: AnalystJourneyControlsHandle;
}

export async function bootstrapApp(): Promise<AppInstance> {
  const world = new World();
  await world.start();

  if (import.meta.env.DEV) {
    setupDevTraceRecorder(world);
  }

  if (import.meta.env.VITE_NEMOSYNE_DIAGNOSTICS === '1') {
    const { installRuntimeDiagnosticHook } = await import('./diagnostics.ts');
    installRuntimeDiagnosticHook(world);
  }

  if (import.meta.env.VITE_NEMOSYNE_Q3B_RESOURCE_PROBE === '1') {
    const { installResourceEnvelopeDiagnosticHook } = await import(
      './resourceEnvelopeDiagnostics.ts'
    );
    installResourceEnvelopeDiagnosticHook(world);
  }

  const telemetry = document.getElementById('telemetry');
  if (telemetry) {
    if (world.bootState === 'KERNEL_UNAVAILABLE') {
      telemetry.textContent = 'analytical kernel unavailable — run npm run wasm:dev';
    } else {
      telemetry.textContent = 'ready — point and select to inspect';
    }
  }

  return { world, analystJourneyControls: mountAnalystJourneyControls(world) };
}
