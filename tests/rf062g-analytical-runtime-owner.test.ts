import { describe, expect, it, vi } from 'vitest';
import type { AnalyticalExecutionPort } from '../src/atlas/ports/AnalyticalExecutionPort.ts';
import type { WorkerTransport } from '../src/atlas/ports/WorkerAnalyticalPort.ts';
import {
  AnalyticalRuntimeOwner,
  type AnalyticalRuntimeAuthority,
  type AnalyticalRuntimeBridge,
} from '../src/vr/runtime/AnalyticalRuntimeOwner.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createAuthority() {
  let executionPort: AnalyticalExecutionPort | null = null;
  const setExecutionPort = vi.fn((port: AnalyticalExecutionPort | null) => {
    if (executionPort !== port) executionPort?.dispose?.();
    executionPort = port;
  });
  const authority = {
    recordRefusalFromError: vi.fn(),
    setExecutionPort,
    setKernel: vi.fn(
      (kernel: unknown, _capabilities?: number, _generation?: number) => {
        if (!kernel) setExecutionPort(null);
      }
    ),
  } as unknown as AnalyticalRuntimeAuthority;
  return { authority, getExecutionPort: () => executionPort };
}

function createWorker() {
  const worker: WorkerTransport = {
    postMessage: vi.fn(),
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    terminate: vi.fn(),
  };
  return worker;
}

function createRuntime({ ready = false }: { ready?: boolean } = {}) {
  let isReady = ready;
  const initRuntime = vi.fn(async () => {
    isReady = true;
    return {};
  });
  const runtime = {
    isReady: vi.fn(() => isReady),
    initRuntime,
    capabilities: vi.fn(() => 0x3c07),
    invalidateRuntime: vi.fn(),
  } as unknown as AnalyticalRuntimeBridge;
  return { runtime, initRuntime };
}

describe('RF-062G AnalyticalRuntimeOwner', () => {
  it('owns runtime init, Worker port installation, Atlas binding, and idempotent teardown', async () => {
    const { authority, getExecutionPort } = createAuthority();
    const { runtime, initRuntime } = createRuntime();
    const worker = createWorker();
    const owner = new AnalyticalRuntimeOwner({
      authority,
      isAttemptCurrent: (generation) => generation === 7,
      onKernelFailure: vi.fn(),
      importRuntime: vi.fn(async () => runtime),
      createWorker: vi.fn(() => worker),
    });

    await expect(owner.initialize(7)).resolves.toMatchObject({
      runtime,
      capabilities: 0x3c07,
      generation: 7,
      wasAlreadyReady: false,
    });

    expect(initRuntime).toHaveBeenCalledWith('/wasm/pkg/nemosyne_wasm_bg.wasm');
    expect(authority.setExecutionPort).toHaveBeenCalledOnce();
    expect(getExecutionPort()?.isAsync).toBe(true);
    expect(authority.setKernel).toHaveBeenCalledWith(runtime, 0x3c07, 7);
    expect(owner.runtime).toBe(runtime);
    expect(owner.capabilities).toBe(0x3c07);
    expect(owner.isUnavailable).toBe(false);

    owner.dispose();
    owner.dispose();

    expect(authority.setKernel).toHaveBeenLastCalledWith(null, 0, 7);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(owner.runtime).toBeNull();
    expect(owner.capabilities).toBe(0);
    expect(owner.isDisposed).toBe(true);
    await expect(owner.initialize(8)).rejects.toThrow('disposed analytical runtime owner');
  });

  it('uses the governed legacy asset location only after the primary init path fails', async () => {
    const { authority } = createAuthority();
    const { runtime } = createRuntime();
    const initRuntime = vi
      .spyOn(runtime, 'initRuntime')
      .mockRejectedValueOnce(new Error('primary asset unavailable'))
      .mockResolvedValueOnce({} as never);
    const owner = new AnalyticalRuntimeOwner({
      authority,
      isAttemptCurrent: () => true,
      onKernelFailure: vi.fn(),
      importRuntime: vi.fn(async () => runtime),
      createWorker: () => null,
    });

    await owner.initialize(2);

    expect(initRuntime).toHaveBeenNthCalledWith(1, '/wasm/pkg/nemosyne_wasm_bg.wasm');
    expect(initRuntime).toHaveBeenNthCalledWith(2, '/wasm/nemosyne_wasm_bg.wasm');
  });

  it('does not create a Worker or bind Atlas when an imported attempt becomes stale', async () => {
    const { authority } = createAuthority();
    const { runtime } = createRuntime({ ready: true });
    const imported = deferred<AnalyticalRuntimeBridge>();
    let currentGeneration = 3;
    const workerFactory = vi.fn(() => createWorker());
    const owner = new AnalyticalRuntimeOwner({
      authority,
      isAttemptCurrent: (generation) => generation === currentGeneration,
      onKernelFailure: vi.fn(),
      importRuntime: () => imported.promise,
      createWorker: workerFactory,
    });

    const pending = owner.initialize(3);
    currentGeneration = 4;
    imported.resolve(runtime);

    await expect(pending).resolves.toBeNull();
    expect(workerFactory).not.toHaveBeenCalled();
    expect(authority.setExecutionPort).not.toHaveBeenCalled();
    expect(authority.setKernel).not.toHaveBeenCalled();
  });

  it('fails closed through Atlas and invalidates the active runtime', async () => {
    const { authority } = createAuthority();
    const { runtime } = createRuntime({ ready: true });
    const worker = createWorker();
    const owner = new AnalyticalRuntimeOwner({
      authority,
      isAttemptCurrent: () => true,
      onKernelFailure: vi.fn(),
      importRuntime: vi.fn(async () => runtime),
      createWorker: () => worker,
    });
    await owner.initialize(5);
    const error = new Error('ABI handle invalidated');

    owner.markUnavailable(error);

    expect(authority.setKernel).toHaveBeenLastCalledWith(null, 0, 5);
    expect(runtime.invalidateRuntime).toHaveBeenCalledWith(error);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(owner.runtime).toBeNull();
    expect(owner.capabilities).toBe(0);
    expect(owner.isUnavailable).toBe(true);
  });
});
