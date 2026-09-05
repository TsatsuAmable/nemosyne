/**
 * UX trace recorder composition.
 *
 * Owns recorder construction while the application composition root supplies
 * the exact runtime capabilities and callback wiring it needs. Development may
 * flush traces to the dev endpoint; production must remain local-only.
 */

import {
  UXTraceRecorder,
  type UXTraceRecorderOptions,
} from '../vr/trace/UXTraceRecorder.ts';

export interface DevTraceBindings {
  recorderOptions: UXTraceRecorderOptions;
  bind(recorder: UXTraceRecorder): void;
}

export interface DevTraceSetupOptions {
  /**
   * Whether the recorder may use its network transport. Defaults to the Vite
   * development flag so production composition is fail-closed even if the
   * same-origin trace route exists or is accidentally proxied.
   */
  allowNetworkFlush?: boolean;
}

export function setupDevTraceRecorder(
  bindings: DevTraceBindings,
  options: DevTraceSetupOptions = {}
): UXTraceRecorder {
  const allowNetworkFlush = options.allowNetworkFlush ?? import.meta.env.DEV;
  const recorderOptions: UXTraceRecorderOptions = allowNetworkFlush
    ? bindings.recorderOptions
    : {
        ...bindings.recorderOptions,
        // Production UX trace is an on-device export feature. Replace the
        // transport at composition time rather than relying on a 404 from a
        // deployment route: no production trace bytes can reach fetch().
        fetchImpl: async () => ({ ok: false, status: 404 }),
      };
  const recorder = new UXTraceRecorder(recorderOptions);
  bindings.bind(recorder);
  return recorder;
}
