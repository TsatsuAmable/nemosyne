/**
 * AtlasCore — Application Service coordinating the authoritative InvestigationAggregate
 * with the Rust/WASM analytical kernel and event bus.
 *
 * Responsibilities:
 * - Orchestrates the domain aggregate (`InvestigationAggregate`).
 * - Manages external analytical kernel interactions (`WasmRuntimeBridgeFull`).
 * - Enforces the invariant: Rust/WASM is the sole analytical authority (no JS analytical fallback).
 * - Routes TDA algorithms, structure discovery, and Draco fact generation.
 */

import { Dataset } from '../data/Dataset.ts';
import type { AnalysisHistory, HistoryEntry } from '../data/AnalysisHistory.ts';
import type {
  BettiPoint,
  DatasetJSON,
  EncodingMapping,
  Facts,
  OperationSpec,
  PersistenceInterval,
  Provenance,
  TdaMapperGraph,
  TopologyType,
} from '../data/types.ts';
import { WorldEventBus } from '../utils/EventBus.ts';
import { DatasetSpace, fnv1aHex } from './DatasetSpace.ts';
import type { DatasetSpaceNormalization } from './DatasetSpace.ts';
import type {
  AnalysisResult,
  AnalysisSpec,
  Annotation,
  AtlasCoreState,
  AtlasRecommendation,
  EvidenceStatus,
  Finding,
  Observation,
  RecommendationDecision,
  ResearchEvent,
  VRCommand,
} from './types.ts';
import type {
  MonetaDataInput,
  MonetaFacts,
  DracoDataInput,
  DracoFacts,
  FactProvider,
  RepresentationRequirements,
  SpatialStrategy,
  DatasetSignature,
  RepresentationDecision,
  SpectralFacts,
} from '../moneta/index.ts';
import { mapClusterStructures, mapMapperStructures, mapPersistenceStructures } from './structures.ts';
import type { StructureSet } from './structures.ts';
import { generateGuidance } from './GuidanceEngine.ts';
import { KernelUnavailableError } from '../wasm/RuntimeBridge.ts';
import { InvestigationAggregate, EvidenceLedger } from './domain/index.ts';

export { KernelUnavailableError };

/**
 * Full kernel bridge surface required by AtlasCore.
 */
export interface WasmRuntimeBridgeFull {
  isReady(): boolean;
  capabilities(): number;
  loadDatasetJson(obj: DatasetJSON): number;
  loadCsv(bytes: Uint8Array): number;
  loadJson(bytes: Uint8Array): number;
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
  inferSchema?(handle: number): unknown;
  computeMapperGraph?(handle: number, params: Record<string, unknown>): TdaMapperGraph | null;
  computePersistenceIntervals?(handle: number, params: Record<string, unknown>): PersistenceInterval[] | null;
  computeBetti0Curve?(handle: number, params: Record<string, unknown>): BettiPoint[] | null;
  computeSpectralFacts?(handle: number, timeColumn?: string, valueColumn?: string): SpectralFacts | null;
}

export class AtlasCore {
  private readonly _aggregate: InvestigationAggregate;
  private _kernel: WasmRuntimeBridgeFull | null;
  private _capabilities = 0;
  private _eventBus: WorldEventBus | null;

  constructor({
    kernel = null,
    eventBus = null,
    sessionId,
  }: { kernel?: WasmRuntimeBridgeFull | null; eventBus?: WorldEventBus | null; sessionId?: string } = {}) {
    this._aggregate = new InvestigationAggregate({ sessionId });
    this._kernel = kernel;
    this._eventBus = eventBus;
  }

  get eventBus(): WorldEventBus | null {
    return this._eventBus;
  }

  get sessionId(): string {
    return this._aggregate.sessionId;
  }

  /**
   * Direct accessor to the underlying authoritative Investigation domain aggregate.
   */
  get aggregate(): InvestigationAggregate {
    return this._aggregate;
  }

  // --- Kernel binding & status -------------------------------------------

  setKernel(kernel: WasmRuntimeBridgeFull | null, capabilities = 0): void {
    this._kernel = kernel;
    this._capabilities = capabilities;
    this._aggregate.analytical.invalidateHandle((h) => this._kernel?.destroyDataset(h));
  }

  get capabilities(): number {
    return this._capabilities;
  }

  isReady(): boolean {
    return this._kernel != null && (typeof this._kernel.isReady !== 'function' || this._kernel.isReady());
  }

  kernelVersion(): string | null {
    try {
      return this._kernel?.kernelVersion?.() ?? null;
    } catch {
      return null;
    }
  }

  lastProvenance(): Provenance | null {
    try {
      return this._kernel?.kernelProvenance?.() ?? null;
    } catch {
      return null;
    }
  }

  // --- Dataset Lifecycle --------------------------------------------------

  loadDataset(dataset: Dataset): void {
    this._aggregate.loadDataset(dataset, (h) => this._kernel?.destroyDataset(h));
  }

  setOriginalDataset(dataset: Dataset): void {
    this.loadDataset(dataset);
  }

  setCurrentDataset(dataset: Dataset): void {
    this._aggregate.analytical.setCurrentDataset(dataset, (h) => this._kernel?.destroyDataset(h));
  }

  get originalDataset(): Dataset {
    return this._aggregate.analytical.original;
  }

  get dataset(): Dataset {
    return this._aggregate.analytical.current;
  }

  get datasetSpace(): DatasetSpace | null {
    return this._aggregate.analytical.getDatasetSpace(
      () => this._kernelFingerprint(),
      () => this._kernelRanges(),
    );
  }

  get datasetFingerprint(): string | null {
    return this._aggregate.analytical.getFingerprint(() => this._kernelFingerprintDirect());
  }

  get datasetVersion(): number {
    return this._aggregate.analytical.datasetVersion;
  }

  // --- Evidence, History & Ledger -----------------------------------------

  get analysisHistory(): AnalysisHistory {
    return this._aggregate.ledger.getAnalysisHistory(this._aggregate.analytical.originalNullable);
  }

  get results(): readonly AnalysisResult[] {
    return this._aggregate.ledger.results;
  }

  get ledger(): readonly ResearchEvent[] {
    return this._aggregate.ledger.ledger;
  }

  get evidenceLedger(): EvidenceLedger {
    return this._aggregate.ledger;
  }

  get observations(): readonly Observation[] {
    return this._aggregate.ledger.observations;
  }

  get findings(): readonly Finding[] {
    return this._aggregate.ledger.findings;
  }

  get annotations(): readonly Annotation[] {
    return this._aggregate.ledger.annotations;
  }

  get structures(): readonly StructureSet[] {
    return this._aggregate.ledger.structures;
  }

  get activeRecommendation(): AtlasRecommendation | null {
    return this._aggregate.decisions.activeRecommendation;
  }

  get decisionHistory(): AtlasRecommendation[] {
    return this._aggregate.decisions.history;
  }

  recordObservation(
    observation:
      | string
      | (Omit<Observation, 'id' | 'timestamp' | 'datasetFingerprint' | 'datasetVersion'> & {
          datasetFingerprint?: string;
          datasetVersion?: number;
        })
  ): Observation {
    const fp = this.datasetFingerprint ?? '';
    const stateHash = this.datasetSpace?.fingerprint ?? '';
    const obsObj: Omit<Observation, 'id' | 'timestamp'> =
      typeof observation === 'string'
        ? {
            notes: observation,
            datasetFingerprint: fp,
            datasetVersion: this.datasetVersion,
          }
        : {
            ...observation,
            datasetFingerprint: observation.datasetFingerprint ?? fp,
            datasetVersion: observation.datasetVersion ?? this.datasetVersion,
          };
    return this._aggregate.ledger.recordObservation(
      obsObj,
      this._aggregate.sessionId,
      stateHash,
      this._aggregate.context.now(),
    );
  }

  recordFinding(
    finding: Omit<Finding, 'id' | 'timestamp' | 'datasetFingerprint' | 'datasetVersion'> & {
      datasetFingerprint?: string;
      datasetVersion?: number;
    }
  ): Finding {
    const fp = this.datasetFingerprint ?? '';
    const stateHash = this.datasetSpace?.fingerprint ?? '';
    return this._aggregate.ledger.recordFinding(
      {
        ...finding,
        datasetFingerprint: finding.datasetFingerprint ?? fp,
        datasetVersion: finding.datasetVersion ?? this.datasetVersion,
      },
      this._aggregate.sessionId,
      stateHash,
      this._aggregate.context.now(),
    );
  }

  recordAnnotation(annotation: Omit<Annotation, 'id' | 'timestamp'>): Annotation {
    const fp = this.datasetFingerprint ?? '';
    const stateHash = this.datasetSpace?.fingerprint ?? '';
    return this._aggregate.ledger.recordAnnotation(
      annotation,
      this._aggregate.sessionId,
      this.datasetVersion,
      fp,
      stateHash,
      this._aggregate.context.now(),
    );
  }

  recordIntervention(intervention: string): void {
    const fp = this.datasetFingerprint ?? '';
    const stateHash = this.datasetSpace?.fingerprint ?? '';
    this._aggregate.ledger.recordIntervention(
      intervention,
      this._aggregate.sessionId,
      this.datasetVersion,
      fp,
      stateHash,
      this._aggregate.context.now(),
    );
  }

  recordEmbodimentCommand(command: VRCommand): void {
    const fp = this.datasetFingerprint ?? '';
    const stateHash = this.datasetSpace?.fingerprint ?? '';
    this._aggregate.ledger.recordEmbodimentCommand(
      command,
      this._aggregate.sessionId,
      this.datasetVersion,
      fp,
      stateHash,
      this._aggregate.context.now(),
    );
  }

  // --- Guidance & Decisions ----------------------------------------------

  setRecommendation(rec: AtlasRecommendation | null): void {
    this._aggregate.decisions.setRecommendation(rec);
  }

  generateRecommendation(): AtlasRecommendation | null {
    const rec = generateGuidance(this.structures, this.kernelVersion() ?? 'unknown');
    if (rec) {
      this._aggregate.decisions.setRecommendation(rec);
      this._appendRecommendationEvent('pending');
    }
    return rec;
  }

  recordDecision(decision: RecommendationDecision): void {
    const recorded = this._aggregate.decisions.recordDecision(decision);
    if (recorded) {
      this._appendRecommendationEvent(decision);
    }
  }

  acceptRecommendation(): void {
    this.recordDecision('accepted');
  }

  rejectRecommendation(): void {
    this.recordDecision('rejected');
  }

  overrideRecommendation(): void {
    this.recordDecision('overridden');
  }

  private _appendRecommendationEvent(decision: RecommendationDecision): void {
    const fp = this.datasetFingerprint ?? '';
    const stateHash = this.datasetSpace?.fingerprint ?? '';
    this._aggregate.ledger.appendEvent(
      {
        timestamp: this._aggregate.context.now(),
        kind: 'recommendation',
        command: { op: 'recommendation' },
        datasetVersion: this.datasetVersion,
        datasetFingerprint: fp,
        recommendationDecision: decision,
        stateHash,
      },
      this._aggregate.sessionId,
    );
  }

  // --- Analytical Operations ----------------------------------------------

  applyAnalysis(spec: AnalysisSpec): AnalysisResult {
    if (!this.isReady()) {
      throw new KernelUnavailableError('[AtlasCore] analytical kernel unavailable — Rust/WASM is the sole analytical authority.');
    }
    const kernel = this._kernel!;
    const inputHandle = this._ensureHandle();
    if (inputHandle === 0) {
      throw new Error('[AtlasCore] kernel rejected input dataset');
    }

    const outHandle = kernel.runOperation(inputHandle, spec.operation);
    if (outHandle === 0) {
      throw new Error(`[AtlasCore] kernel op "${spec.operation.op}" failed`);
    }

    let json: DatasetJSON | null;
    let provenance: Provenance | null;
    let outputHash: string;
    try {
      json = kernel.getDatasetJson(outHandle);
      if (!json) {
        throw new Error(`[AtlasCore] kernel produced no output for "${spec.operation.op}"`);
      }
      provenance = this.lastProvenance();
      outputHash = kernel.datasetFingerprint?.(outHandle) ?? fnv1aHex(json);
    } finally {
      // outHandle will be adopted below
    }

    this._aggregate.analytical.adoptHandle(outHandle, (h) => this._kernel?.destroyDataset(h));
    const nextDataset = Dataset.fromJSON(json);
    this._aggregate.analytical.setCurrentDataset(nextDataset);

    const fp = this.datasetFingerprint ?? spec.datasetFingerprint;
    const resultId = this._aggregate.ledger.nextResultId(fp, this.datasetVersion, spec.operation.op);
    const result: AnalysisResult = {
      resultId,
      datasetFingerprint: fp,
      datasetVersion: this.datasetVersion,
      spec,
      dataset: json,
      metrics: null,
      provenance,
      implementationVersion: this.kernelVersion() ?? spec.algorithmVersion,
      outputHash,
      evidenceStatus: 'exploratory' as EvidenceStatus,
    };

    this._aggregate.ledger.addResult(result);
    this._aggregate.ledger.appendEvent(
      {
        timestamp: this._aggregate.context.now(),
        kind: 'analysis',
        command: spec,
        result,
        datasetVersion: this.datasetVersion,
        datasetFingerprint: fp,
        stateHash: this.datasetSpace?.fingerprint ?? '',
      },
      this._aggregate.sessionId,
    );

    this._aggregate.graph.addNode({
      id: `${this._aggregate.sessionId}:${resultId}`,
      parentId: `${this._aggregate.sessionId}:v${this.datasetVersion}`,
      datasetVersion: this.datasetVersion,
      datasetFingerprint: fp,
      label: spec.label ?? spec.operation.op,
      operation: spec.operation.op,
      timestamp: this._aggregate.context.now(),
    });

    return result;
  }

  previewAnalysis(spec: AnalysisSpec): AnalysisResult {
    if (!this.isReady()) {
      throw new KernelUnavailableError('[AtlasCore] analytical kernel unavailable — Rust/WASM is the sole analytical authority.');
    }
    const kernel = this._kernel!;
    const inputHandle = this._ensureHandle();
    if (inputHandle === 0) {
      throw new Error('[AtlasCore] kernel rejected input dataset');
    }

    const outHandle = kernel.runOperation(inputHandle, spec.operation);
    if (outHandle === 0) {
      throw new Error(`[AtlasCore] kernel preview "${spec.operation.op}" failed`);
    }
    try {
      const json = kernel.getDatasetJson(outHandle);
      if (!json) {
        throw new Error(`[AtlasCore] kernel produced no preview for "${spec.operation.op}"`);
      }
      const provenance = this.lastProvenance();
      const outputHash = kernel.datasetFingerprint?.(outHandle) ?? fnv1aHex(json);
      const fp = this.datasetFingerprint ?? spec.datasetFingerprint;
      const resultId = this._aggregate.ledger.nextResultId(fp, this.datasetVersion, spec.operation.op);
      const result: AnalysisResult = {
        resultId,
        datasetFingerprint: fp,
        datasetVersion: this.datasetVersion,
        spec,
        dataset: json,
        metrics: null,
        provenance,
        implementationVersion: this.kernelVersion() ?? spec.algorithmVersion,
        outputHash,
        evidenceStatus: 'exploratory' as EvidenceStatus,
      };
      return result;
    } finally {
      kernel.destroyDataset(outHandle);
    }
  }

  resetAnalysis(): AnalysisResult | null {
    if (!this._aggregate.analytical.originalNullable) return null;
    this._aggregate.analytical.setCurrentDataset(
      this._aggregate.analytical.original.clone(),
      (h) => this._kernel?.destroyDataset(h),
    );

    const fp = this.datasetFingerprint ?? '';
    this._aggregate.ledger.appendEvent(
      {
        timestamp: this._aggregate.context.now(),
        kind: 'reset',
        command: { op: 'reset' },
        datasetVersion: this.datasetVersion,
        datasetFingerprint: fp,
        stateHash: this.datasetSpace?.fingerprint ?? '',
      },
      this._aggregate.sessionId,
    );
    return null;
  }

  undo(): HistoryEntry | null {
    const entry = this.analysisHistory.undo();
    if (!entry) return null;
    this.setCurrentDataset(entry.dataset);
    this._aggregate.ledger.appendEvent(
      {
        timestamp: this._aggregate.context.now(),
        kind: 'undo',
        command: { op: 'undo' },
        datasetVersion: this.datasetVersion,
        datasetFingerprint: this.datasetFingerprint ?? '',
        stateHash: this.datasetSpace?.fingerprint ?? '',
      },
      this._aggregate.sessionId,
    );
    return entry;
  }

  redo(): HistoryEntry | null {
    const entry = this.analysisHistory.redo();
    if (!entry) return null;
    this.setCurrentDataset(entry.dataset);
    this._aggregate.ledger.appendEvent(
      {
        timestamp: this._aggregate.context.now(),
        kind: 'redo',
        command: { op: 'redo' },
        datasetVersion: this.datasetVersion,
        datasetFingerprint: this.datasetFingerprint ?? '',
        stateHash: this.datasetSpace?.fingerprint ?? '',
      },
      this._aggregate.sessionId,
    );
    return entry;
  }

  seekHistory(index: number): HistoryEntry | null {
    const entry = this.analysisHistory.seek(index);
    if (!entry) return null;
    this.setCurrentDataset(entry.dataset);
    this._aggregate.ledger.appendEvent(
      {
        timestamp: this._aggregate.context.now(),
        kind: 'seek',
        command: { op: 'seek', index },
        datasetVersion: this.datasetVersion,
        datasetFingerprint: this.datasetFingerprint ?? '',
        stateHash: this.datasetSpace?.fingerprint ?? '',
      },
      this._aggregate.sessionId,
    );
    return entry;
  }

  // --- Parse, Sample & TDA -----------------------------------------------

  parseBytes(
    bytes: Uint8Array,
    ext: 'csv' | 'json',
    explicitTopology?: string | null,
  ): { dataset: Dataset; topology: TopologyType; encodings: Record<string, string> } {
    if (!this.isReady()) {
      throw new KernelUnavailableError('Analytical kernel unavailable — cannot parse file.');
    }
    if (ext !== 'csv' && ext !== 'json') {
      throw new Error('Unsupported file type; use .csv or .json');
    }
    const kernel = this._kernel!;
    const handle = ext === 'csv' ? kernel.loadCsv(bytes) : kernel.loadJson(bytes);
    if (handle === 0) {
      throw new Error('Kernel parser rejected the file');
    }
    try {
      const json = kernel.getDatasetJson(handle);
      if (!json) {
        throw new Error('Kernel parser produced no dataset');
      }
      const topology =
        (explicitTopology as TopologyType | null) ??
        (kernel.inferTopology(handle) as TopologyType | null) ??
        ('TABULAR' as TopologyType);
      const enc = kernel.inferEncodings(handle, topology as string);
      const encodings = (enc ?? {}) as unknown as Record<string, string>;
      return { dataset: Dataset.fromJSON(json), topology, encodings };
    } finally {
      kernel.destroyDataset(handle);
    }
  }

  loadSample(key: string): Dataset | null {
    if (!this.isReady() || !key) return null;
    const kernel = this._kernel!;
    const handle = kernel.loadSample(key);
    if (handle === 0) return null;
    try {
      const json = kernel.getDatasetJson(handle);
      return json ? Dataset.fromJSON(json) : null;
    } finally {
      kernel.destroyDataset(handle);
    }
  }

  computePersistenceIntervals(
    dataset: Dataset,
    params: Record<string, unknown>,
  ): PersistenceInterval[] | null {
    return this._tdaCall(dataset, params, (handle) =>
      this._kernel?.computePersistenceIntervals?.(handle, params) ?? null
    );
  }

  computeMapperGraph(dataset: Dataset, params: Record<string, unknown>): TdaMapperGraph | null {
    return this._tdaCall(dataset, params, (handle) =>
      this._kernel?.computeMapperGraph?.(handle, params) ?? null
    );
  }

  computeBetti0Curve(dataset: Dataset, params: Record<string, unknown>): BettiPoint[] | null {
    return this._tdaCall(dataset, params, (handle) =>
      this._kernel?.computeBetti0Curve?.(handle, params) ?? null
    );
  }

  computeSpectralFacts(timeColumn?: string, valueColumn?: string): SpectralFacts | null {
    if (!this._kernel?.isReady?.()) return null;
    const handle = this._ensureHandle();
    if (handle === 0) return null;
    return this._kernel.computeSpectralFacts?.(handle, timeColumn, valueColumn) ?? null;
  }

  discoverMapperStructures(dataset: Dataset, params: Record<string, unknown>): StructureSet | null {
    const graph = this.computeMapperGraph(dataset, params);
    if (!graph) return null;
    const space = this._spaceForDataset(dataset);
    const structures = mapMapperStructures(
      graph,
      space.datumIds,
      space.fingerprint,
      this.datasetFingerprint === space.fingerprint ? this.datasetVersion : 0,
      this.kernelVersion() ?? 'unknown',
      params,
      this.lastProvenance(),
    );
    this._aggregate.ledger.recordStructure(structures, this._aggregate.sessionId, this._aggregate.context.now());
    return structures;
  }

  discoverPersistenceStructures(
    dataset: Dataset,
    params: Record<string, unknown>,
  ): StructureSet | null {
    const intervals = this.computePersistenceIntervals(dataset, params);
    if (!intervals) return null;
    const space = this._spaceForDataset(dataset);
    const structures = mapPersistenceStructures(
      intervals,
      space.fingerprint,
      this.datasetFingerprint === space.fingerprint ? this.datasetVersion : 0,
      this.kernelVersion() ?? 'unknown',
      params,
      this.lastProvenance(),
    );
    this._aggregate.ledger.recordStructure(structures, this._aggregate.sessionId, this._aggregate.context.now());
    return structures;
  }

  discoverClusterStructures(dataset: Dataset, operation: OperationSpec): StructureSet | null {
    const result = this._clusterCall(dataset, operation);
    if (!result) return null;
    const assignments = result.rows.map((row) => {
      const value = row._cluster;
      return typeof value === 'number' ? value : Number(value);
    });
    if (assignments.some((label) => !Number.isFinite(label))) return null;
    const space = this._spaceForDataset(dataset);
    const structures = mapClusterStructures(
      assignments,
      space.datumIds,
      space.fingerprint,
      this.datasetFingerprint === space.fingerprint ? this.datasetVersion : 0,
      this.kernelVersion() ?? 'unknown',
      operation,
      result.provenance,
    );
    this._aggregate.ledger.recordStructure(structures, this._aggregate.sessionId, this._aggregate.context.now());
    return structures;
  }

  // --- Facts & Draco FactProvider ----------------------------------------

  facts(): Facts | null {
    if (!this.isReady()) return null;
    const handle = this._ensureHandle();
    if (handle === 0) return null;
    try {
      return this._kernel!.statistics(handle);
    } catch {
      return null;
    }
  }

  medianFor(column: string): number {
    const facts = this.facts();
    const col = facts?.numeric.find((c) => c.name === column);
    return col?.median ?? 0;
  }

  inferTopology(): string | null {
    if (!this.isReady()) return null;
    const handle = this._ensureHandle();
    if (handle === 0) return null;
    try {
      return this._kernel!.inferTopology(handle);
    } catch {
      return null;
    }
  }

  inferEncodings(topology?: string): EncodingMapping | null {
    if (!this.isReady()) return null;
    const handle = this._ensureHandle();
    if (handle === 0) return null;
    try {
      return this._kernel!.inferEncodings(handle, topology);
    } catch {
      return null;
    }
  }

  monetaFacts(input: MonetaDataInput): MonetaFacts | null {
    return this._aggregate.representation.toMonetaFacts(input, this.facts());
  }

  dracoFacts(input: DracoDataInput): DracoFacts | null {
    return this.monetaFacts(input);
  }

  asFactProvider(): FactProvider {
    return this._aggregate.representation.asFactProvider(() => this.facts());
  }

  get activeSpatialStrategy(): SpatialStrategy | null {
    return this._aggregate.representation.activeStrategy;
  }

  get activeDatasetSignature(): DatasetSignature | null {
    return this._aggregate.representation.activeSignature;
  }

  get activeRepresentationDecision(): RepresentationDecision | null {
    return this._aggregate.representation.activeDecision;
  }

  computeDatasetSignature(
    input?: DracoDataInput,
    spectralFacts?: SpectralFacts | null,
  ): DatasetSignature {
    const dataInput: DracoDataInput = input ?? {
      dataset: this.dataset ?? undefined,
      topology: (this.inferTopology() as TopologyType) ?? undefined,
      encodings: this.inferEncodings() ?? undefined,
    };
    return this._aggregate.representation.computeDatasetSignature(
      dataInput,
      this.facts(),
      spectralFacts,
      this.datasetFingerprint ?? undefined,
    );
  }

  arbitrateRepresentation(
    requirements?: RepresentationRequirements,
    input?: DracoDataInput,
    spectralFacts?: SpectralFacts | null,
  ): RepresentationDecision {
    const dataInput: DracoDataInput = input ?? {
      dataset: this.dataset ?? undefined,
      topology: (this.inferTopology() as TopologyType) ?? undefined,
      encodings: this.inferEncodings() ?? undefined,
    };
    return this._aggregate.representation.arbitrateRepresentation(
      dataInput,
      this.facts(),
      spectralFacts,
      requirements,
      this.datasetFingerprint ?? undefined,
    );
  }

  arbitrateSpatialStrategy(
    requirements?: RepresentationRequirements,
    input?: DracoDataInput,
  ): SpatialStrategy {
    const dataInput: DracoDataInput = input ?? {
      dataset: this.dataset ?? undefined,
      topology: (this.inferTopology() as TopologyType) ?? undefined,
      encodings: this.inferEncodings() ?? undefined,
    };
    return this._aggregate.representation.arbitrateStrategy(
      dataInput,
      this.facts(),
      requirements,
      this.datasetFingerprint ?? undefined,
    );
  }

  // --- Serialization & Lifecycle -----------------------------------------

  toState(): AtlasCoreState {
    return this._aggregate.toState();
  }

  restoreState(state: AtlasCoreState): void {
    this._aggregate.restoreState(state, (h) => this._kernel?.destroyDataset(h));
  }

  async computeDigest(): Promise<string> {
    return this._aggregate.computeDigest(this.kernelVersion() ?? 'unknown');
  }

  dispose(): void {
    this._aggregate.dispose((h) => this._kernel?.destroyDataset(h));
  }

  // --- Internal Helpers --------------------------------------------------

  private _ensureHandle(): number {
    return this._aggregate.analytical.ensureHandle((json) => {
      if (!this.isReady()) return 0;
      return this._kernel!.loadDatasetJson(json);
    });
  }

  private _kernelFingerprint(): string | null {
    if (!this.isReady()) return null;
    const handle = this._ensureHandle();
    if (handle === 0) return null;
    try {
      return this._kernel?.datasetFingerprint?.(handle) ?? null;
    } catch {
      return null;
    }
  }

  private _kernelFingerprintDirect(): string | null {
    if (!this.isReady()) return null;
    const handle = this._ensureHandle();
    if (handle === 0) return null;
    try {
      return this._kernel?.datasetFingerprint?.(handle) ?? null;
    } catch {
      return null;
    }
  }

  private _kernelRanges(): Record<string, DatasetSpaceNormalization> | null {
    const facts = this.facts();
    if (!facts || facts.numeric.length === 0) return null;
    const ranges: Record<string, DatasetSpaceNormalization> = {};
    for (const c of facts.numeric) {
      ranges[c.name] = { min: c.min, max: c.max };
    }
    return ranges;
  }

  private _tdaCall<T>(
    dataset: Dataset,
    _params: Record<string, unknown>,
    compute: (handle: number) => T | null,
  ): T | null {
    if (!this.isReady()) return null;
    const kernel = this._kernel!;
    let handle = 0;
    try {
      handle = kernel.loadDatasetJson(dataset.toJSON());
      if (handle === 0) return null;
      const result = compute(handle);
      this.lastProvenance();
      return result;
    } finally {
      if (handle !== 0) kernel.destroyDataset(handle);
    }
  }

  private _clusterCall(
    dataset: Dataset,
    operation: OperationSpec,
  ): { rows: Record<string, unknown>[]; provenance: Provenance | null } | null {
    if (!this.isReady()) return null;
    const kernel = this._kernel!;
    const inputHandle = kernel.loadDatasetJson(dataset.toJSON());
    if (inputHandle === 0) return null;
    let outputHandle = 0;
    try {
      outputHandle = kernel.runOperation(inputHandle, operation);
      if (outputHandle === 0) return null;
      const result = kernel.getDatasetJson(outputHandle);
      if (!result) return null;
      return { rows: result.rows, provenance: this.lastProvenance() };
    } finally {
      if (outputHandle !== 0) kernel.destroyDataset(outputHandle);
      kernel.destroyDataset(inputHandle);
    }
  }

  private _spaceForDataset(dataset: Dataset): DatasetSpace {
    if (this.dataset && this.datasetFingerprint === fnv1aHex(dataset.toJSON())) {
      return this.datasetSpace ?? new DatasetSpace(dataset);
    }
    let fingerprint: string | null = null;
    if (this.isReady()) {
      const kernel = this._kernel!;
      const handle = kernel.loadDatasetJson(dataset.toJSON());
      if (handle !== 0) {
        try {
          fingerprint = kernel.datasetFingerprint?.(handle) ?? null;
        } finally {
          kernel.destroyDataset(handle);
        }
      }
    }
    return new DatasetSpace(dataset, { fingerprint });
  }
}
