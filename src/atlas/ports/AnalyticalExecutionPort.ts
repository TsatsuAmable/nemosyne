import type { DatasetJSON, Provenance } from '../../data/types.ts';
import type { TdaResourcePreflight } from '../../wasm/runtime/DatasetHandleBridge.ts';

export type AnalyticalOperationKind =
  | 'tda.persistence'
  | 'tda.mapper'
  | 'tda.betti0'
  | 'operation'
  | 'statistics'
  | 'spectralFacts'
  | 'cluster'
  | 'semanticEmbodiment';

export interface AnalyticalDatasetPayload {
  readonly type: 'typed' | 'json';
  readonly data: ArrayBuffer | Uint8Array | unknown;
  readonly name?: string;
}

export type DatasetPayload = AnalyticalDatasetPayload;

export interface AnalyticalRowView {
  readonly name: string;
  readonly rowIds: readonly string[];
  readonly rowCount: number;
  readonly columnCount: number;
  readonly edgesPresent: boolean;
}

export type AnalyticalOperationOutput =
  | {
      readonly kind: 'dataset';
      readonly dataset: DatasetJSON;
      readonly outputFingerprint: string;
    }
  | {
      readonly kind: 'row-view';
      readonly view: AnalyticalRowView;
      readonly outputFingerprint: string;
    };

/**
 * Bounded transport/runtime timings emitted only by explicitly instrumented
 * browser builds. These values describe transport and allocation behaviour;
 * they are diagnostic evidence, never analytical or scientific authority.
 */
export interface AnalyticalWorkerDiagnostic {
  readonly schemaVersion: 1;
  readonly phase: 'registration' | 'execution';
  readonly id: string;
  readonly operation?: AnalyticalOperationKind;
  readonly operationName?: string;
  readonly resultKind?: 'dataset' | 'row-view' | 'scalar' | 'none';
  readonly rowCount?: number;
  readonly columnCount?: number;
  readonly timingMs: {
    readonly total: number;
    readonly bridgeReady?: number;
    readonly kernel?: number;
    readonly materialize?: number;
  };
  readonly wasmBytes: {
    readonly before: number | null;
    readonly afterKernel: number | null;
    readonly afterMaterialize: number | null;
  };
  readonly hostBufferAllocations: {
    readonly before: number | null;
    readonly after: number | null;
  };
}

export interface AnalyticalDatasetRegistration {
  readonly registrationId: string;
  readonly dataset: {
    readonly fingerprint: string;
    readonly version: number;
  };
  readonly generation: number;
  readonly payload: AnalyticalDatasetPayload;
}

export interface AnalyticalExecutionRequest {
  readonly requestId: string;
  readonly operation: AnalyticalOperationKind;
  readonly dataset: {
    readonly fingerprint: string;
    readonly version: number;
  };
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
  /**
   * RF-030: kernel-inline TDA resource refusal surfaced from the worker. When
   * present, the typed {@link UnsupportedAtScaleError} is reconstructed at the
   * port boundary and durably recorded before the request rejects. Mutually
   * exclusive with `value`/`error`.
   */
  readonly refusal?: { preflight: TdaResourcePreflight; provenance: Provenance | null };
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
   * True only when this exact canonical fingerprint is already resident in the
   * supplied runtime generation. This is a transport-local capability query,
   * not an analytical authority claim. Ports that cannot attest residency omit
   * it, forcing Atlas to retain/materialize ordinary registration data.
   */
  hasRegisteredDataset?(generation: number, fingerprint: string): boolean;
  /**
   * Drain bounded diagnostic samples captured by an instrumented Worker build.
   * Ordinary builds return an empty array because the Worker emits no samples.
   */
  drainDiagnostics?(): readonly AnalyticalWorkerDiagnostic[];
  /** Release worker/listener resources owned by this port. */
  dispose?(): void;
  readonly isAsync: boolean;
}
