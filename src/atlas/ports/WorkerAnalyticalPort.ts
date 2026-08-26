import type {
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

export class WorkerAnalyticalPort implements AnalyticalExecutionPort {
  private readonly _worker: WorkerTransport;
  private readonly _pending = new Map<
    string,
    {
      resolve: (res: AnalyticalExecutionResult<unknown>) => void;
      reject: (err: Error) => void;
      req: AnalyticalExecutionRequest;
    }
  >();
  private _fence: { generation?: number; datasetVersion?: number } = {};
  private _onKernelFailure?: ((err: Error) => void) | null;

  constructor(worker: WorkerTransport, onKernelFailure?: ((err: Error) => void) | null) {
    this._worker = worker;
    this._onKernelFailure = onKernelFailure;
    this._worker.onmessage = this._handleMessage.bind(this);
    this._worker.onerror = this._handleError.bind(this);
  }

  get isAsync(): boolean {
    return true;
  }

  supersede(fence: { generation?: number; datasetVersion?: number }): void {
    if (fence.generation !== undefined) this._fence.generation = fence.generation;
    if (fence.datasetVersion !== undefined) this._fence.datasetVersion = fence.datasetVersion;

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

  execute<T>(req: AnalyticalExecutionRequest): Promise<AnalyticalExecutionResult<T>> {
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

  private _handleMessage(ev: MessageEvent): void {
    const data = ev.data as { type: string; result?: AnalyticalExecutionResult };
    if (!data || data.type !== 'RESULT' || !data.result) return;

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

    pending.resolve(result);
  }

  private _handleError(ev: ErrorEvent | unknown): void {
    const message = (ev as ErrorEvent)?.message ?? 'Worker analytical execution failed';
    const kernelErr = new KernelUnavailableError(message);
    this._onKernelFailure?.(kernelErr);

    for (const [, pending] of this._pending.entries()) {
      pending.reject(kernelErr);
    }
    this._pending.clear();
  }
}
