import type {
  BettiPoint,
  DatasetJSON,
  EncodingMapping,
  Facts,
  OperationSpec,
  PersistenceInterval,
  Provenance,
  SpectralFacts,
  TdaMapperGraph,
} from '../../data/types.ts';
import type { RustDatasetStructureProfile } from '../../data/evidence/index.ts';

/**
 * Analytical facts and data-derived reductions exposed by the Rust/WASM
 * authority to Atlas orchestration. This port contains no presentation or
 * investigation state.
 */
export interface AnalyticalKernelPort {
  isReady(): boolean;
  capabilities(): number;
  loadDatasetJson(obj: DatasetJSON): number;
  loadCsv(bytes: Uint8Array): number;
  loadJson(bytes: Uint8Array): number;
  loadTypedColumns?(payload: ArrayBuffer | Uint8Array, name?: string): number;
  supportsTypedColumnIngest?(): boolean;
  loadSample(key: string): number;
  sampleKeys(): string[];
  getDatasetJson(handle: number): DatasetJSON | null;
  destroyDataset(handle: number): void;
  runOperation(handle: number, op: OperationSpec): number;
  executeOperation(datasetJSON: unknown, spec: OperationSpec): DatasetJSON | null;
  statistics(handle: number): Facts | null;
  inferTopology(handle: number): string | null;
  inferEncodings(handle: number, topology?: string): EncodingMapping | null;
  parseDatasetBytes(bytes: Uint8Array, ext: 'csv' | 'json'): DatasetJSON | null;
  kernelVersion?(): string | null;
  kernelProvenance?(): Provenance | null;
  datasetFingerprint?(handle: number): string | null;
  /**
   * Issue #834: the Rust producer for RFC 0009 statistics evidence receipts.
   * Exposed on the injected kernel contract so governed capture reads the
   * producer from whichever runtime instance fronts this port — the
   * main-thread kernel for inline execution, the Worker-owned runtime behind a
   * transport port — instead of a module-global singleton.
   */
  statisticsEvidenceReceiptBundle?(handle: number): unknown | null;
  /**
   * RFC 0009 tranche 3 slice 2: the kernel-issued governed-consumer
   * attestation for this dataset (which governed consumers consume its
   * receipts). Companion capability of `statisticsEvidenceReceiptBundle`; a
   * runtime build that has the bundle producer but not this export is older
   * than the slice, and governed capture refuses it rather than minting
   * consumer uses without the kernel attestation.
   */
  statisticsGovernedConsumers?(handle: number): unknown | null;
  inferSchema?(handle: number): unknown;
  computeMapperGraph?(handle: number, params: Record<string, unknown>): TdaMapperGraph | null;
  computePersistenceIntervals?(
    handle: number,
    params: Record<string, unknown>,
  ): PersistenceInterval[] | null;
  computeBetti0Curve?(handle: number, params: Record<string, unknown>): BettiPoint[] | null;
  computeSpectralFacts?(
    handle: number,
    timeColumn?: string,
    valueColumn?: string,
  ): SpectralFacts | null;
  computeDatasetStructureProfile?(
    handle: number,
  ): RustDatasetStructureProfile | Record<string, unknown> | null;
}
