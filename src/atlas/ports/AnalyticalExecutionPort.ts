import type { Provenance } from '../../data/types.ts';

export type AnalyticalOperationKind =
  | 'tda.persistence'
  | 'tda.mapper'
  | 'tda.betti0'
  | 'operation'
  | 'statistics'
  | 'spectralFacts'
  | 'cluster';

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
  readonly datasetPayload?: {
    readonly type: 'typed' | 'json';
    readonly data: ArrayBuffer | Uint8Array | unknown;
    readonly name?: string;
  };
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

export interface AnalyticalExecutionPort {
  execute<T>(req: AnalyticalExecutionRequest): Promise<AnalyticalExecutionResult<T>>;
  supersede(fence: { generation?: number; datasetVersion?: number }): void;
  readonly isAsync: boolean;
}
