/**
 * Dev-Only Instrumentation & UX Trace Recorder.
 *
 * Owns recorder construction while the application composition root supplies
 * the exact runtime capabilities and callback wiring it needs. This keeps
 * development instrumentation from depending on World as a service locator.
 */

import {
  UXTraceRecorder,
  type UXTraceRecorderOptions,
} from '../vr/trace/UXTraceRecorder.ts';

export interface DevTraceBindings {
  recorderOptions: UXTraceRecorderOptions;
  bind(recorder: UXTraceRecorder): void;
}

export function setupDevTraceRecorder(bindings: DevTraceBindings): UXTraceRecorder {
  const recorder = new UXTraceRecorder(bindings.recorderOptions);
  bindings.bind(recorder);
  return recorder;
}
