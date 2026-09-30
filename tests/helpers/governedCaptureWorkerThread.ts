/**
 * Hosts the *production* analytical Worker module (`src/atlas/ports/analytical.worker.ts`)
 * in a genuinely separate runtime: a Node worker thread with its own module
 * graph, and therefore its own Rust/WASM instance and its own handle index
 * space.
 *
 * Issue #834's fourth required falsifier is that governed capture returns the
 * Worker-owned Rust bundle rather than main-thread global state. Stubbing
 * `globalThis.self` and importing the worker module into the test realm cannot
 * show that — the module then resolves to the *same* WASM instance as the test,
 * so a cross-runtime aliasing bug is indistinguishable from a correct read.
 * This host runs the module in its own realm instead.
 *
 * Two things keep the production module loadable here without editing it:
 *  - `import.meta.env` is a Vite build-time constant that Node cannot evaluate,
 *    so a module load hook (see runtimeBridgeEnvHook.mjs) substitutes exactly
 *    the value the bundler would have inlined;
 *  - the module is loaded by dynamic import so the environment global is in
 *    place before its top-level `import.meta.env` read evaluates (a static
 *    import would hoist above it).
 *
 * The `probe` message is host-only support: it measures a payload in *this*
 * thread's kernel so the test can declare an identity that comes from this
 * runtime rather than from the caller's.
 */
import { parentPort } from 'node:worker_threads';
import * as bridge from '../../src/wasm/RuntimeBridge.ts';
import type { DatasetJSON } from '../../src/data/types.ts';

const host = globalThis as unknown as Record<string, unknown>;
host.__NEMOSYNE_WORKER_ENV__ = { VITE_NEMOSYNE_Q3B_RESOURCE_PROBE: '0' };

let productionHandler: ((ev: { data: unknown }) => void) | null = null;
host.self = {
  set onmessage(fn: (ev: { data: unknown }) => void) {
    productionHandler = fn;
  },
  postMessage(message: unknown) {
    parentPort!.postMessage(message);
  },
};

await import('../../src/atlas/ports/analytical.worker.ts');
parentPort!.postMessage({ hostReady: true });

parentPort!.on('message', async (message: { probe?: { payload: DatasetJSON } }) => {
  if (message && typeof message === 'object' && 'probe' in message && message.probe) {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    // `loadDatasetJson` takes the DatasetJSON object and encodes it itself;
    // handing it a pre-encoded string would load a JSON *string scalar*, whose
    // fingerprint is a constant independent of the payload.
    const handle = bridge.loadDatasetJson(message.probe.payload);
    parentPort!.postMessage({
      probed: {
        fingerprint: bridge.datasetFingerprint(handle),
        kernelVersion: bridge.kernelVersion(),
      },
    });
    bridge.destroyDataset(handle);
    return;
  }
  productionHandler?.({ data: message });
});
