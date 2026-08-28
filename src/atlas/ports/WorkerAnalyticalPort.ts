import type {
  AnalyticalDatasetRegistration,
  AnalyticalExecutionFence,
  AnalyticalExecutionPort,
  AnalyticalExecutionRequest,
  AnalyticalExecutionResult,
  AnalyticalWorkerDiagnostic,
} from './AnalyticalExecutionPort.ts';
import { KernelUnavailableError, UnsupportedAtScaleError } from '../../wasm/RuntimeBridge.ts';

export interface WorkerTransport {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((ev: MessageEvent) => void) | null;
  onerror: ((ev: ErrorEvent | unknown) => void) | null;
  onmessageerror?: ((ev: MessageEvent | unknown) => void) | null;
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

const MAX_DIAGNOSTIC_SAMPLES = 32;

export class WorkerAnalyticalPort implements AnalyticalExecutionPort {
  private readonly _worker: WorkerTransport;
  private readonly _pending = new Map<string, PendingExecution>();
  private readonly _pendingRegistrations = new Map<string, PendingRegistration>();
  private readonly _registrationPromises = new Map<string, Promise<void>>();
  private readonly _registered = new Set<string>();
  private readonly _diagnostics: AnalyticalWorkerDiagnostic[] = [];
  private _fence: AnalyticalExecutionFence = {};
  private _onKernelFailure?: ((err: Error) => void) | null;
  /**
   * RF-030: invoked when a kernel-inline TDA resource refusal surfaces from the
   * worker (a `result.refusal` message). A refusal is NOT a kernel failure, so
   * it must never reach `_onKernelFailure` / `KernelUnavailableError`. The
   * callback durably records the refusal provenance; the typed error then
   * rejects the pending request so VR/UI can react.
   */
  private _onKernelRefusal?: ((error: UnsupportedAtScaleError) => void) | null;
  private _disposed = false;

  constructor(
    worker: WorkerTransport,
    onKernelFailure?: ((err: Error) => void) | null,
    onKernelRefusal?: ((error: UnsupportedAtScaleError) => void) | null
  ) {
    this._worker = worker;
    this._onKernelFailure = onKernelFailure;
    this._onKernelRefusal = onKernelRefusal ?? null;
    this._worker.onmessage = this._handleMessage.bind(this);
    this._worker.onerror = this._handleError.bind(this);
    if ('onmessageerror' in this._worker) {
      this._worker.onmessageerror = this._handleMessageError.bind(this);
    }
  }

  get isAsync(): boolean {
    return true;
  }

  drainDiagnostics(): readonly AnalyticalWorkerDiagnostic[] {
    if (this._diagnostics.length === 0) return [];
    return this._diagnostics.splice(0, this._diagnostics.length);
  }

  private _recordDiagnostic(sample: AnalyticalWorkerDiagnostic | undefined): void {
    if (!sample) return;
    this._diagnostics.push(sample);
    if (this._diagnostics.length > MAX_DIAGNOSTIC_SAMPLES) {
      this._diagnostics.splice(0, this._diagnostics.length - MAX_DIAGNOSTIC_SAMPLES);
    }
  }

  private _registrationKey(generation: number, fingerprint: string): string {
    return `${generation}\u0000${fingerprint}`;
  }

  private _isStale(
    generation: number,
    datasetVersion: number,
    datasetFingerprint: string
  ): boolean {
    return (
      (this._fence.generation !== undefined && generation < this._fence.generation) ||
      (this._fence.datasetVersion !== undefined && datasetVersion < this._fence.datasetVersion) ||
      (this._fence.datasetFingerprint !== undefined &&
        datasetFingerprint !== this._fence.datasetFingerprint)
    );
  }

  supersede(fence: AnalyticalExecutionFence): void {
    if (this._disposed) return;

    const generationAdvanced =
      fence.generation !== undefined &&
      (this._fence.generation === undefined || fence.generation > this._fence.generation);
    const datasetAdvanced =
      fence.datasetVersion !== undefined &&
      (this._fence.datasetVersion === undefined || fence.datasetVersion > this._fence.datasetVersion);
    const fingerprintChanged =
      fence.datasetFingerprint !== undefined &&
      fence.datasetFingerprint !== this._fence.datasetFingerprint;

    this._fence = {
      generation: fence.generation !== undefined ? fence.generation : this._fence.generation,
      datasetVersion:
        fence.datasetVersion !== undefined ? fence.datasetVersion : this._fence.datasetVersion,
      datasetFingerprint:
        fence.datasetFingerprint !== undefined
          ? fence.datasetFingerprint
          : this._fence.datasetFingerprint,
    };

    if (generationAdvanced) {
      this._registered.clear();
    } else if ((datasetAdvanced || fingerprintChanged) && fence.datasetFingerprint) {
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
        this._isStale(
          pending.req.generation,
          pending.req.dataset.version,
          pending.req.dataset.fingerprint
        )
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

    // Registration is fenced too. A stale registration is superseded rather
    // than reported as a kernel failure; callers re-check identity after await.
    for (const [id, pending] of this._pendingRegistrations.entries()) {
      if (
        this._isStale(
          pending.registration.generation,
          pending.registration.dataset.version,
          pending.registration.dataset.fingerprint
        )
      ) {
        this._pendingRegistrations.delete(id);
        pending.resolve();
      }
    }
  }

  hasRegisteredDataset(generation: number, fingerprint: string): boolean {
    if (this._disposed || !fingerprint) return false;
    return this._registered.has(this._registrationKey(generation, fingerprint));
  }

  registerDataset(registration: AnalyticalDatasetRegistration): Promise<void> {
    if (this._disposed) {
      return Promise.reject(new KernelUnavailableError('Analytical worker port is disposed'));
    }

    if (
      this._isStale(
        registration.generation,
        registration.dataset.version,
        registration.dataset.fingerprint
      )
    ) {
      return Promise.resolve();
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
    });
    promise.finally(() => {
      this._registrationPromises.delete(key);
    });

    this._registrationPromises.set(key, promise);
    return promise;
  }

  execute<T>(req: AnalyticalExecutionRequest): Promise<AnalyticalExecutionResult<T>> {
    if (this._disposed) {
      return Promise.reject(new KernelUnavailableError('Analytical worker port is disposed'));
    }
    if (this._isStale(req.generation, req.dataset.version, req.dataset.fingerprint)) {
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
    this._disposeWithError(new KernelUnavailableError('Analytical worker port disposed'), false);
  }

  private _disposeWithError(error: KernelUnavailableError, notifyFailure: boolean): void {
    if (this._disposed) return;
    this._disposed = true;
    if (notifyFailure) this._onKernelFailure?.(error);

    for (const pending of this._pending.values()) pending.reject(error);
    for (const pending of this._pendingRegistrations.values()) pending.reject(error);
    this._pending.clear();
    this._pendingRegistrations.clear();
    this._registrationPromises.clear();
    this._registered.clear();
    this._diagnostics.length = 0;

    this._worker.onmessage = null;
    this._worker.onerror = null;
    if ('onmessageerror' in this._worker) this._worker.onmessageerror = null;
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
      diagnostic?: AnalyticalWorkerDiagnostic;
    };
    if (!data || this._disposed) return;

    this._recordDiagnostic(data.diagnostic);

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

      const expected = pending.registration;
      if (
        data.generation !== expected.generation ||
        data.datasetVersion !== expected.dataset.version ||
        data.datasetFingerprint !== expected.dataset.fingerprint
      ) {
        const error = new KernelUnavailableError(
          `Worker registration acknowledgement mismatch for ${expected.dataset.fingerprint}`
        );
        this._onKernelFailure?.(error);
        pending.reject(error);
        return;
      }

      const stale = this._isStale(
        expected.generation,
        expected.dataset.version,
        expected.dataset.fingerprint
      );
      if (!stale) this._registered.add(pending.key);
      pending.resolve();
      return;
    }

    if (data.type !== 'RESULT' || !data.result) return;

    const result = data.result;
    const pending = this._pending.get(result.requestId);
    if (!pending) return;

    this._pending.delete(result.requestId);

    if (result.refusal) {
      const refusalError = new UnsupportedAtScaleError(
        result.refusal.preflight,
        result.refusal.provenance ?? null
      );
      try {
        this._onKernelRefusal?.(refusalError);
      } catch {
        // Ledger recording must never mask the typed refusal.
      }
      pending.reject(refusalError);
      return;
    }

    if (result.error) {
      const kernelErr = new KernelUnavailableError(result.error);
      this._onKernelFailure?.(kernelErr);
      pending.reject(kernelErr);
      return;
    }

    if (
      result.generation !== pending.req.generation ||
      result.datasetVersion !== pending.req.dataset.version ||
      result.datasetFingerprint !== pending.req.dataset.fingerprint
    ) {
      const kernelErr = new KernelUnavailableError(
        `Worker analytical result identity mismatch for ${pending.req.requestId}`
      );
      this._onKernelFailure?.(kernelErr);
      pending.reject(kernelErr);
      return;
    }

    if (this._isStale(result.generation, result.datasetVersion, result.datasetFingerprint)) {
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
    this._disposeWithError(new KernelUnavailableError(message), true);
  }

  private _handleMessageError(_ev: MessageEvent | unknown): void {
    this._disposeWithError(
      new KernelUnavailableError('Worker analytical message deserialization failed'),
      true
    );
  }
}
