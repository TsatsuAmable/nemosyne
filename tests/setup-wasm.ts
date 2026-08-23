/**
 * Shared Vitest Rust/WASM bootstrap.
 *
 * Moneta layout computation is Rust-authoritative. The ordinary jsdom test
 * suite therefore boots the same wasm-pack runtime that CI builds before
 * `npm test`, rather than relying on the deleted JavaScript layout fallbacks.
 * Tests that exercise unavailable-kernel behaviour should inject that state
 * explicitly at their own boundary.
 */
import * as bridge from '../src/wasm/RuntimeBridge.ts';

if (!bridge.isReady()) {
  await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
}

if (!bridge.isReady()) {
  throw new Error(
    'Vitest requires the Rust/WASM kernel for Moneta layout tests. Run `npm run wasm:dev` before `npm test`.',
  );
}
