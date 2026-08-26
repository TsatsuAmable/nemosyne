import type { Provenance } from '../../data/types.ts';

export type AnalyticalOperationKind =
  | 'tda.persistence'
  | 'tda.mapper'
  | 'tda.betti0'
  | 'operation'
  | 'statistics'
  | 'spectralFacts'
  | 'cluster';

export interface AnalyticalDatasetPayload {
  readonly type: 'typed' | 'json';
  readonly data: ArrayBuffer | Uint8Array | unknown;
  readonly name?: string;
}

export type DatasetPayload = AnalyticalDatasetPayload;

export interface AnalyticalDatasetIdentity {
  readonly fingerprint: string;
  readonly version: number;
}

export interface AnalyticalDatasetRegistration {
  readonly registrationId: string;
  readonly dataset: AnalyticalDatasetIdentity;
  readonly generation: number;
  readonly payload: AnalyticalDatasetPayload;
}

export interface AnalyticalExecutionRequest {
  readonly requestId: string;
  readonly operation: AnalyticalOperationKind;
  readonly dataset: AnalyticalDatasetIdentity;
  readonly generation: number;
  readonly handle?: number;
  readonly params: Record<string, unknown>;
  /**
   * Compatibility-only first-use payload. Production Worker callers should
   * register explicitly through registerDataset() so concurrent operations do
   * not clone the same large dataset multiple times.
   */
  readonly datasetPayload?: AnalyticalDatasetPayload;
}

export interface AnalyticalExecutionResult<T = unknown> {
  readonly requestId: string;
  readonly generation: number;
  readonly datasetVersion: number;
  readonly datasetFingerprint: string;
  readonly value: T | null;
  readonly provenance?: Provenance | null;
  readonly error?: string;
}

export interface AnalyticalExecutionFence {
  readonly generation?: number;
  readonly datasetVersion?: number;
  /** Current dataset identity after a version transition, when known. */
  readonly datasetFingerprint?: string;
}

export interface AnalyticalExecutionPort {
  execute<T>(req: AnalyticalExecutionRequest): Promise<AnalyticalExecutionResult<T>>;
  supersede(fence: AnalyticalExecutionFence): void;
  /**
   * Worker-local registration keyed by canonical fingerprint and runtime
   * generation. Async production ports must implement this; inline ports may
   * omit it because they share the caller's kernel instance/handle space.
   */
  registerDataset?(registration: AnalyticalDatasetRegistration): Promise<void>;
  /**
   * Cheap capability query used before constructing a potentially O(N)
   * recovery payload. A true result means this execution port already owns the
   * authoritative dataset for the supplied generation and identity. It must
   * never be used as an analytical fact or as a substitute for fingerprint
   * verification inside the Worker.
   */
  hasRegisteredDataset?(dataset: AnalyticalDatasetIdentity, generation: number): boolean;
  /** Release worker/listener resources owned by this port. */
  dispose?(): void;
  readonly isAsync: boolean;
}
