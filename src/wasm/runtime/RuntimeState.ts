import type {
  DatasetHandleExports,
  KernelContractExports,
  LayoutAbiExports,
  MemoryAbiExports,
  RuntimeLifecycleExports,
  WasmInitInput,
  WasmModule,
  WasmRuntimeExports,
} from './RuntimeExports.ts';

export type KernelState = 'UNINITIALIZED' | 'INITIALIZING' | 'READY' | 'UNAVAILABLE';

export class KernelUnavailableError extends Error {
  readonly code = 'KERNEL_UNAVAILABLE';
  readonly state: KernelState;
  readonly reason: string;

  constructor(
    reason = 'Analytical kernel unavailable. Rust/WASM is the sole analytical authority.',
    state: KernelState = 'UNAVAILABLE'
  ) {
    super(`[KernelUnavailable] ${reason}`);
    this.name = 'KernelUnavailableError';
    this.state = state;
    this.reason = reason;
    Object.setPrototypeOf(this, KernelUnavailableError.prototype);
  }
}

export class KernelAbiError extends Error {
  readonly code = 'KERNEL_ABI_FAILURE';
  readonly fatal = true;

  constructor(
    readonly operation: string,
    readonly cause: unknown
  ) {
    super(
      `[KernelAbiFailure] ${operation}: ${cause instanceof Error ? cause.message : String(cause)}`
    );
    this.name = 'KernelAbiError';
    Object.setPrototypeOf(this, KernelAbiError.prototype);
  }
}

let wasmInstance: WasmRuntimeExports | null = null;
let wasmModule: WasmModule | null = null;
let memoryView: DataView | null = null;
let kernelState: KernelState = 'UNINITIALIZED';
let kernelUnavailableReason: string | null = null;
let initializationPromise: Promise<WasmModule> | null = null;
let runtimeGeneration = 0;

export function isKernelFatalError(error: unknown): error is KernelAbiError {
  return error instanceof KernelAbiError;
}

export function getKernelState(): KernelState {
  return kernelState;
}
export function getKernelUnavailableReason(): string | null {
  return kernelUnavailableReason;
}
export function getCachedMemoryView(): DataView | null {
  return memoryView;
}
export function setCachedMemoryView(view: DataView | null): void {
  memoryView = view;
}

export function invalidateRuntime(reason: unknown): void {
  runtimeGeneration += 1;
  kernelState = 'UNAVAILABLE';
  kernelUnavailableReason = reason instanceof Error ? reason.message : String(reason);
  wasmInstance = null;
  wasmModule = null;
  memoryView = null;
  initializationPromise = null;
}

export function requireRuntime(): WasmRuntimeExports {
  if (!wasmInstance || kernelState !== 'READY') {
    throw new KernelUnavailableError(
      kernelUnavailableReason ||
        'Analytical kernel has not been initialized (run npm run dev:wasm or build:wasm).',
      kernelState
    );
  }
  return wasmInstance;
}

export function getMemoryAbiExports(): RuntimeLifecycleExports & MemoryAbiExports {
  return requireRuntime();
}

export function getRawRuntimeExports(): WasmRuntimeExports {
  return requireRuntime();
}

export function getDatasetHandleExports(): MemoryAbiExports & DatasetHandleExports {
  return requireRuntime();
}

export function getLayoutAbiExports(): RuntimeLifecycleExports &
  MemoryAbiExports &
  LayoutAbiExports {
  return requireRuntime();
}

export function getKernelContractExports(): MemoryAbiExports & KernelContractExports {
  return requireRuntime();
}

function ready(instance: WasmRuntimeExports, mod: WasmModule, generation: number): WasmModule {
  const handle = instance.init(0x1234_5678_9abc_def0n);
  if (handle !== 1) throw new Error(`Unexpected runtime handle: ${handle}`);
  const reset = instance.data_reset_runtime_generation();
  if (reset !== 1) throw new Error(`Unexpected runtime generation reset result: ${reset}`);
  if (instance.ping() !== 42) throw new Error('WASM ping health check failed');
  if (generation !== runtimeGeneration) {
    throw new KernelUnavailableError('Kernel initialization superseded by runtime invalidation.');
  }
  wasmInstance = instance;
  wasmModule = mod;
  memoryView = new DataView(instance.memory.buffer);
  kernelState = 'READY';
  kernelUnavailableReason = null;
  return mod;
}

function failInitialization(error: unknown, generation: number): never {
  if (generation !== runtimeGeneration) {
    throw new KernelUnavailableError('Kernel initialization superseded by runtime invalidation.');
  }
  kernelState = 'UNAVAILABLE';
  kernelUnavailableReason = error instanceof Error ? error.message : String(error);
  wasmInstance = null;
  wasmModule = null;
  memoryView = null;
  if (error instanceof KernelUnavailableError) throw error;
  throw new KernelUnavailableError(kernelUnavailableReason, 'UNAVAILABLE');
}

async function initializeRuntime(
  wasmUrl: string | URL | undefined,
  generation: number
): Promise<WasmModule> {
  const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);
  if (isNode) {
    try {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const { pathToFileURL } = await import('node:url');
      const pkgJsPath = path.resolve(process.cwd(), 'wasm/pkg/nemosyne_wasm.js');
      const wasmFilePath = path.resolve(process.cwd(), 'wasm/pkg/nemosyne_wasm_bg.wasm');
      if (!fs.existsSync(pkgJsPath) || !fs.existsSync(wasmFilePath)) {
        throw new KernelUnavailableError(
          'WASM package not built at wasm/pkg (run npm run wasm:dev)',
          'UNAVAILABLE'
        );
      }
      const mod = (await import(/* @vite-ignore */ pathToFileURL(pkgJsPath).href)) as WasmModule;
      (globalThis as unknown as Record<string, unknown>).nemosyneNowMs = () => Date.now();
      const bytes = fs.readFileSync(wasmFilePath);
      return ready(
        await (mod.default as unknown as (i: Uint8Array) => Promise<WasmRuntimeExports>)(bytes),
        mod,
        generation
      );
    } catch (err) {
      failInitialization(err, generation);
    }
  }
  try {
    const check = await fetch('/wasm/pkg/nemosyne_wasm.js', { method: 'HEAD' });
    if (!check.ok) {
      throw new KernelUnavailableError(
        'WASM module package not found (run npm run dev:wasm or npm run wasm to enable analytical kernel)',
        'UNAVAILABLE'
      );
    }
  } catch (err) {
    failInitialization(
      new Error(`WASM package unavailable: ${(err as Error).message}`),
      generation
    );
  }
  try {
    const wasmModuleUrl = '/wasm/pkg/nemosyne_wasm.js';
    const mod = (await import(/* @vite-ignore */ wasmModuleUrl)) as WasmModule;
    (globalThis as unknown as Record<string, unknown>).nemosyneNowMs = () => Date.now();
    const targetWasmUrl = typeof wasmUrl === 'string' ? wasmUrl : '/wasm/pkg/nemosyne_wasm_bg.wasm';
    return ready(
      await (mod.default as unknown as (i: WasmInitInput) => Promise<WasmRuntimeExports>)({
        module_or_path: targetWasmUrl,
      }),
      mod,
      generation
    );
  } catch (err) {
    failInitialization(err, generation);
  }
}

export async function initRuntime(wasmUrl?: string | URL): Promise<WasmModule> {
  if (wasmModule && kernelState === 'READY') return wasmModule;
  if (initializationPromise) return initializationPromise;
  kernelState = 'INITIALIZING';
  kernelUnavailableReason = null;
  const generation = runtimeGeneration;
  const attempt = initializeRuntime(wasmUrl, generation);
  initializationPromise = attempt;
  try {
    return await attempt;
  } finally {
    if (initializationPromise === attempt) initializationPromise = null;
  }
}

export function isReady(): boolean {
  return wasmInstance !== null && kernelState === 'READY';
}
export function capabilities(): number {
  return requireRuntime().capabilities();
}
