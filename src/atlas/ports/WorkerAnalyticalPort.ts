import type {
  AnalyticalDatasetRegistration,
  AnalyticalExecutionFence,
  AnalyticalExecutionPort,
  AnalyticalExecutionRequest,
  AnalyticalExecutionResult,
} from './AnalyticalExecutionPort.ts';
import { KernelUnavailableError } from '../../wasm/RuntimeBridge.ts';

export interface WorkerTransport {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((ev: MessageEvent) => void) | null;
  onerror: ((ev: ErrorEvent | unknown) => void) | null;
  terminate?(): void;
}

interface PendingExecution {
  resolve: (res: AnalyticalExecutionResult<unknown>) => void;
  reject: (err: Error) => void;
  req: AnalyticalExecutionRequest;
}

interface PendingRegistration {
  resolve: () => void;
  reject: (err: Error) => void;
  registration: AnalyticalDatasetRegistration;
  key: string;
}

export class WorkerAnalyticalPort implements AnalyticalExecutionPort {
  private readonly _worker: WorkerTransport;
  private readonly _pending = new Map<string, PendingExecution>();
  private readonly _pendingRegistrations = new Map<string, PendingRegistration>();
  private readonly _registrationPromises = new Map<string, Promise<void>>();
  private readonly _registered = new Set<string>();
  private _fence: AnalyticalExecutionFence = {};
  private _onKernelFailure?: ((err: Error) => void) | null;
  private _disposed = false;

  constructor(worker: WorkerTransport, onKernelFailure?: ((err: Error) => void) | null) {
    this._worker = worker;
    this._onKernelFailure = onKernelFailure;
    this._worker.onmessage = this._handleMessage.bind(this);
    this._worker.onerror = this._handleError.bind(this);
  }

  get isAsync(): boolean {
    return true;
  }

  private _registrationKey(generation: number, fingerprint: string): string {
    return `${generation}\u0000${fingerprint}`;
  }

  supersede(fence: AnalyticalExecutionFence): void {
    const generationAdvanced =
      fence.generation !== undefined &&
      (this._fence.generation === undefined || fence.generation > this._fence.generation);
    const datasetAdvanced =
      fence.datasetVersion !== undefined &&
      (this._fence.datasetVersion === undefined || fence.datasetVersion > this._fence.datasetVersion);

    if (fence.generation !== undefined) this._fence.generation = fence.generation;
    if (fence.datasetVersion !== undefined) this._fence.datasetVersion = fence.datasetVersion;
    if (fence.datasetFingerprint !== undefined) {
      this._fence.datasetFingerprint = fence.datasetFingerprint;
    }

    if (generationAdvanced) {
      this._registered.clear();
    } else if (datasetAdvanced && fence.datasetFingerprint) {
      const currentKey = this._registrationKey(
        this._fence.generation ?? 1,
        fence.datasetFingerprint
      );
      for (const key of [...this._registered]) {
        if (key !== currentKey) this._registered.delete(key);
      }
    }

    try {
      this._worker.postMessage({ type: 'SUPERSEDE', fence: this._fence });
    } catch {
      // Supersession is best-effort transport signalling. The local fence below
      // remains authoritative even if the worker cannot receive the message.
    }

    for (const [id, pending] of this._pending.entries()) {
      if (
        (this._fence.generation !== undefined && pending.req.generation < this._fence.generation) ||
        (this._fence.datasetVersion !== undefined &&
          pending.req.dataset.version < this._fence.datasetVersion)
      ) {
        this._pending.delete(id);
        pending.resolve({
          requestId: pending.req.requestId,
          generation: pending.req.generation,
          datasetVersion: pending.req.dataset.version,
          datasetFingerprint: pending.req.dataset.fingerprint,
          value: null,
        });
      }
    }
  }

  registerDataset(registration: AnalyticalDatasetRegistration): Promise<void> {
    if (this._disposed) {
      return Promise.reject(new KernelUnavailableError('Analytical worker port is disposed'));
    }

    const key = this._registrationKey(
      registration.generation,
      registration.dataset.fingerprint
    );
    if (this._registered.has(key)) return Promise.resolve();

    const existing = this._registrationPromises.get(key);
    if (existing) return existing;

    const promise = new Promise<void>((resolve, reject) => {
      this._pendingRegistrations.set(registration.registrationId, {
        resolve,
        reject,
        registration,
        key,
      });
      try {
        this._worker.postMessage({ type: 'REGISTER', registration });
      } catch (err: unknown) {
        this._pendingRegistrations.delete(registration.registrationId);
        const error = new KernelUnavailableError(
          `Worker dataset registration failed: ${err instanceof Error ? err.message : String(err)}`
        );
        this._onKernelFailure?.(error);
        reject(error);
      }
    }).finally(() => {
      this._registrationPromises.delete(key);
    });

    this._registrationPromises.set(key, promise);
    return promise;
  }

  execute<T>(req: AnalyticalExecutionRequest): Promise<AnalyticalExecutionResult<T>> {
    if (this._disposed) {
      return Promise.reject(new KernelUnavailableError('Analytical worker port is disposed'));
    }
    if (
      (this._fence.generation !== undefined && req.generation < this._fence.generation) ||
      (this._fence.datasetVersion !== undefined && req.dataset.version < this._fence.datasetVersion)
    ) {
      return Promise.resolve({
        requestId: req.requestId,
        generation: req.generation,
        datasetVersion: req.dataset.version,
        datasetFingerprint: req.dataset.fingerprint,
        value: null,
      });
    }

    return new Promise<AnalyticalExecutionResult<T>>((resolve, reject) => {
      this._pending.set(req.requestId, {
        resolve: resolve as (res: AnalyticalExecutionResult) => void,
        reject,
        req,
      });
      try {
        this._worker.postMessage({ type: 'EXECUTE', request: req });
      } catch (err: unknown) {
        this._pending.delete(req.requestId);
        const error = new KernelUnavailableError(
          `Worker transport postMessage failed: ${err instanceof Error ? err.message : String(err)}`
        );
        this._onKernelFailure?.(error);
        reject(error);
      }
    });
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    const error = new KernelUnavailableError('Analytical worker port disposed');

    for (const pending of this._pending.values()) pending.reject(error);
    for (const pending of this._pendingRegistrations.values()) pending.reject(error);
    this._pending.clear();
    this._pendingRegistrations.clear();
    this._registrationPromises.clear();
    this._registered.clear();

    this._worker.onmessage = null;
    this._worker.onerror = null;
    try {
      this._worker.terminate?.();
    } catch {
      // best-effort worker teardown
    }
  }

  private _handleMessage(ev: MessageEvent): void {
    const data = ev.data as {
      type: string;
      result?: AnalyticalExecutionResult;
      registrationId?: string;
      generation?: number;
      datasetVersion?: number;
      datasetFingerprint?: string;
      error?: string;
    };
    if (!data) return;

    if (data.type === 'REGISTERED' && data.registrationId) {
      const pending = this._pendingRegistrations.get(data.registrationId);
      if (!pending) return;
      this._pendingRegistrations.delete(data.registrationId);

      if (data.error) {
        const error = new KernelUnavailableError(data.error);
        this._onKernelFailure?.(error);
        pending.reject(error);
        return;
      }

      const stale =
        (this._fence.generation !== undefined &&
          pending.registration.generation < this._fence.generation) ||
        (this._fence.datasetVersion !== undefined &&
          pending.registration.dataset.version < this._fence.datasetVersion);
      if (!stale) this._registered.add(pending.key);
      pending.resolve();
      return;
    }

    if (data.type !== 'RESULT' || !data.result) return;

    const result = data.result;
    const pending = this._pending.get(result.requestId);
    if (!pending) return;

    this._pending.delete(result.requestId);

    if (result.error) {
      const kernelErr = new KernelUnavailableError(result.error);
      this._onKernelFailure?.(kernelErr);
      pending.reject(kernelErr);
      return;
    }

    if (
      (this._fence.generation !== undefined && result.generation < this._fence.generation) ||
      (this._fence.datasetVersion !== undefined &&
        result.datasetVersion < this._fence.datasetVersion)
    ) {
      pending.resolve({
        requestId: result.requestId,
        generation: result.generation,
        datasetVersion: result.datasetVersion,
        datasetFingerprint: result.datasetFingerprint,
        value: null,
      });
      return;
    }

    const value = result.value;
    if (value && typeof value === 'object' && 'outputFingerprint' in value) {
      const outputFingerprint = (value as { outputFingerprint?: unknown }).outputFingerprint;
      if (typeof outputFingerprint === 'string' && outputFingerprint) {
        this._registered.add(this._registrationKey(result.generation, outputFingerprint));
      }
    }

    pending.resolve(result);
  }

  private _handleError(ev: ErrorEvent | unknown): void {
    const message = (ev as ErrorEvent)?.message ?? 'Worker analytical execution failed';
    const kernelErr = new KernelUnavailableError(message);
    this._onKernelFailure?.(kernelErr);

    for (const pending of this._pending.values()) pending.reject(kernelErr);
    for (const pending of this._pendingRegistrations.values()) pending.reject(kernelErr);
    this._pending.clear();
    this._pendingRegistrations.clear();
    this._registrationPromises.clear();
    this._registered.clear();
  }
}
