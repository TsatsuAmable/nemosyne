import type { AtlasCore } from '../../atlas/AtlasCore.ts';
import {
  WorkerAnalyticalPort,
  type WorkerTransport,
} from '../../atlas/ports/WorkerAnalyticalPort.ts';

export type AnalyticalRuntimeBridge = typeof import('../../wasm/RuntimeBridge.ts');

export type AnalyticalRuntimeAuthority = Pick<
  AtlasCore,
  'recordRefusalFromError' | 'setExecutionPort' | 'setKernel'
>;

export interface AnalyticalRuntimeReady {
  runtime: AnalyticalRuntimeBridge;
  capabilities: number;
  generation: number;
  wasAlreadyReady: boolean;
}

export interface AnalyticalRuntimeOwnerOptions {
  authority: AnalyticalRuntimeAuthority;
  isAttemptCurrent(generation: number): boolean;
  onKernelFailure(error: Error): void;
  importRuntime?(): Promise<AnalyticalRuntimeBridge>;
  createWorker?(): WorkerTransport | null;
}

function createBrowserWorker(): WorkerTransport | null {
  if (typeof Worker === 'undefined' || typeof window === 'undefined') return null;
  return new Worker(new URL('../../atlas/ports/analytical.worker.ts', import.meta.url), {
    type: 'module',
  }) as unknown as WorkerTransport;
}

/**
 * Owns analytical runtime import/init, Worker execution-port installation,
 * Atlas kernel binding, capability state, invalidation, and teardown. The
 * World lifecycle remains the boot/recovery state-machine authority.
 */
export class AnalyticalRuntimeOwner {
  private readonly authority: AnalyticalRuntimeAuthority;
  private readonly isAttemptCurrent: (generation: number) => boolean;
  private readonly onKernelFailure: (error: Error) => void;
  private readonly importRuntime: () => Promise<AnalyticalRuntimeBridge>;
  private readonly createWorker: () => WorkerTransport | null;

  private activeRuntime: AnalyticalRuntimeBridge | null = null;
  private activeCapabilities = 0;
  private workerPort: WorkerAnalyticalPort | null = null;
  private unavailable = false;
  private disposed = false;
  private lastGeneration = 1;

  constructor({
    authority,
    isAttemptCurrent,
    onKernelFailure,
    importRuntime = () => import('../../wasm/RuntimeBridge.ts'),
    createWorker = createBrowserWorker,
  }: AnalyticalRuntimeOwnerOptions) {
    this.authority = authority;
    this.isAttemptCurrent = isAttemptCurrent;
    this.onKernelFailure = onKernelFailure;
    this.importRuntime = importRuntime;
    this.createWorker = createWorker;
  }

  get runtime(): AnalyticalRuntimeBridge | null {
    return this.activeRuntime;
  }

  get capabilities(): number {
    return this.activeCapabilities;
  }

  get isUnavailable(): boolean {
    return this.unavailable;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  async initialize(generation: number): Promise<AnalyticalRuntimeReady | null> {
    if (this.disposed) throw new Error('Cannot initialize a disposed analytical runtime owner');
    this.lastGeneration = generation;

    const runtime = await this.importRuntime();
    if (!this.isCurrent(generation)) return null;

    const attemptWorkerPort = this.installWorkerPort(generation);
    try {
      const wasAlreadyReady = runtime.isReady();
      if (!wasAlreadyReady) {
        try {
          await runtime.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
        } catch {
          if (!this.isCurrent(generation)) {
            this.releaseAttemptWorker(attemptWorkerPort);
            return null;
          }
          await runtime.initRuntime('/wasm/nemosyne_wasm_bg.wasm');
        }
      }

      if (!this.isCurrent(generation)) {
        this.releaseAttemptWorker(attemptWorkerPort);
        return null;
      }
      const capabilities = runtime.capabilities();
      if (!this.isCurrent(generation)) {
        this.releaseAttemptWorker(attemptWorkerPort);
        return null;
      }

      this.authority.setKernel(runtime, capabilities, generation);
      this.activeRuntime = runtime;
      this.activeCapabilities = capabilities;
      this.unavailable = false;
      return { runtime, capabilities, generation, wasAlreadyReady };
    } catch (error) {
      this.releaseAttemptWorker(attemptWorkerPort);
      throw error;
    }
  }

  markUnavailable(error: unknown): void {
    const runtime = this.activeRuntime;
    this.authority.setKernel(null, 0, this.lastGeneration);
    this.workerPort?.dispose();
    this.workerPort = null;
    runtime?.invalidateRuntime?.(error);
    this.activeRuntime = null;
    this.activeCapabilities = 0;
    this.unavailable = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.authority.setKernel(null, 0, this.lastGeneration);
    this.workerPort?.dispose();
    this.workerPort = null;
    this.activeRuntime = null;
    this.activeCapabilities = 0;
  }

  /** RF-062I compatibility seam for tests that still install a canned bridge directly. */
  setCompatibilityRuntime(runtime: AnalyticalRuntimeBridge | null): void {
    this.activeRuntime = runtime;
  }

  /** RF-062I compatibility seam for tests that still patch availability directly. */
  setCompatibilityUnavailable(unavailable: boolean): void {
    this.unavailable = unavailable;
  }

  private isCurrent(generation: number): boolean {
    return !this.disposed && this.isAttemptCurrent(generation);
  }

  private installWorkerPort(generation: number): WorkerAnalyticalPort | null {
    let port: WorkerAnalyticalPort | null = null;
    try {
      const worker = this.createWorker();
      if (!worker) return null;
      port = new WorkerAnalyticalPort(
        worker,
        (error) => {
          if (this.isCurrent(generation)) this.onKernelFailure(error);
        },
        (error) => {
          if (this.isCurrent(generation)) this.authority.recordRefusalFromError(error);
        }
      );
      this.workerPort = port;
      this.authority.setExecutionPort(port);
      return port;
    } catch (error) {
      port?.dispose();
      if (this.workerPort === port) this.workerPort = null;
      console.warn(
        '[AnalyticalRuntimeOwner] WorkerAnalyticalPort unavailable, using inline port:',
        error
      );
      return null;
    }
  }

  private releaseAttemptWorker(port: WorkerAnalyticalPort | null): void {
    if (!port) return;
    if (this.workerPort === port) {
      this.workerPort = null;
      try {
        this.authority.setExecutionPort(null);
      } finally {
        port.dispose();
      }
      return;
    }
    port.dispose();
  }
}
