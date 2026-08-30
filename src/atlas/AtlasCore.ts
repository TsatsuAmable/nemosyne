/**
 * AtlasCore — Application Service coordinating the authoritative InvestigationAggregate
 * with the Rust/WASM analytical kernel and event bus.
 *
 * Responsibilities:
 * - Orchestrates the domain aggregate (`InvestigationAggregate`).
 * - Delegates external analytical kernel interactions to `RustAnalyticalEvidenceAdapter`.
 * - Enforces the invariant: Rust/WASM is the sole analytical authority (no JS analytical fallback).
 * - Routes TDA algorithms, structure discovery, and Moneta fact generation.
 */

import { Dataset } from '../data/Dataset.ts';
import { canonicalDatasetIdentityHex } from '../data/DatasetIdentity.ts';
import type { AnalysisHistory, HistoryEntry } from '../data/AnalysisHistory.ts';
import type { DatasetEvidence } from '../data/evidence/index.ts';
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
  RefusalProvenance,
  RemediationProvenance,
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
import {
  mapClusterStructures,
  mapMapperStructures,
  mapPersistenceStructures,
} from './structures.ts';
import type { StructureSet } from './structures.ts';
import { generateGuidance } from './GuidanceEngine.ts';
import { KernelAbiError, KernelUnavailableError, UnsupportedAtScaleError } from '../wasm/RuntimeBridge.ts';
import { InvestigationAggregate, EvidenceLedger } from './domain/index.ts';
import type { AnalyticalKernelPort } from './adapters/AnalyticalKernelPort.ts';
import { RustAnalyticalEvidenceAdapter } from './adapters/RustAnalyticalEvidenceAdapter.ts';

import type { AnalyticalExecutionPort, AnalyticalOperationOutput, AnalyticalRowView, DatasetPayload } from './ports/AnalyticalExecutionPort.ts';
import { InlineAnalyticalPort } from './ports/InlineAnalyticalPort.ts';

export { KernelUnavailableError };
export type WasmRuntimeBridgeFull = AnalyticalKernelPort;

export class AtlasCore {
  private readonly _aggregate: InvestigationAggregate;
  private readonly _analytics: RustAnalyticalEvidenceAdapter;
  private _capabilities = 0;
  private _eventBus: WorldEventBus | null;
  private _executionPort: AnalyticalExecutionPort | null = null;
  private _generation = 1;
  private _requestSeq = 0;
  /**
   * Exact payload capable of reconstructing the current analytical dataset in
   * another WASM instance. Typed inputs remain typed; row-backed datasets use
   * their canonical DatasetJSON. This is registration material, not a second
   * analytical implementation.
   */
  private _workerDatasetPayload: DatasetPayload | null = null;

  private _cloneTypedPayload(payload: ArrayBuffer | Uint8Array): ArrayBuffer | Uint8Array {
    return payload instanceof Uint8Array ? payload.slice() : payload.slice(0);
  }

  private _setWorkerPayloadFromDataset(dataset: Dataset | null): void {
    // Row-backed Atlas datasets must retain the operation-complete JSON
    // registration contract. NTC1 columnar handles intentionally do not
    // materialise row objects, while this shared Worker registration is used by
    // generic mutations/statistics as well as handle-native TDA. Converting an
    // arbitrary row-backed dataset to NTC1 here would therefore change which
    // kernel operations are valid. RF-035 owns an operation-aware resident/
    // transfer contract; until then correctness outranks the #478 shortcut.
    this._workerDatasetPayload = dataset
      ? { type: 'json', data: dataset.toJSON(), name: dataset.name }
      : null;
  }

  private _workerRegistrationPayload(): DatasetPayload | undefined {
    if (this._workerDatasetPayload) return this._workerDatasetPayload;
    const current = this._aggregate.analytical.currentNullable;
    if (!current) return undefined;
    this._setWorkerPayloadFromDataset(current);
    return this._workerDatasetPayload ?? undefined;
  }

  private _canUseWorkerRowView(dataset: Dataset | null, operation: OperationSpec): boolean {
    const rowIds = dataset?.rowIds;
    return Boolean(
      dataset &&
      dataset.edges === undefined &&
      rowIds &&
      rowIds.length === dataset.rowCount &&
      new Set(rowIds).size === rowIds.length &&
      ['filter', 'sort', 'slice'].includes(operation.op)
    );
  }

  private _materializeWorkerRowView(
    input: Dataset,
    view: AnalyticalRowView,
    outputFingerprint: string
  ): { dataset: Dataset; json: DatasetJSON } {
    if (input.edges !== undefined || view.edgesPresent) {
      throw new KernelUnavailableError('[AtlasCore] compact row-view cannot represent dataset edges.');
    }
    const sourceIds = input.rowIds;
    if (
      !sourceIds ||
      sourceIds.length !== input.rowCount ||
      new Set(sourceIds).size !== sourceIds.length ||
      view.rowCount !== view.rowIds.length ||
      view.columnCount !== input.columnCount ||
      new Set(view.rowIds).size !== view.rowIds.length
    ) {
      throw new KernelUnavailableError('[AtlasCore] invalid compact row-view identity metadata.');
    }

    const byId = new Map(sourceIds.map((id, index) => [id, input.rows[index]] as const));
    const rows = view.rowIds.map((id) => {
      const row = byId.get(id);
      if (!row) {
        throw new KernelUnavailableError(`[AtlasCore] compact row-view references unknown row id ${id}.`);
      }
      return row;
    });
    const dataset = new Dataset(view.name, input.columns.slice(), rows, undefined, [...view.rowIds]);
    const json = dataset.toJSON();
    if (canonicalDatasetIdentityHex(json) !== outputFingerprint) {
      throw new KernelUnavailableError(
        '[AtlasCore] compact row-view reconstruction does not match the authoritative output fingerprint.'
      );
    }
    return { dataset, json };
  }

  private async _registerCurrentDatasetInWorker(
    fingerprint: string,
    version: number
  ): Promise<boolean> {
    const port = this._executionPort;
    if (!port?.isAsync) return true;
    if (!port.registerDataset) {
      throw new KernelUnavailableError(
        '[AtlasCore] asynchronous analytical port cannot register worker-local datasets.'
      );
    }
    const generation = this._generation;
    // RF-035A: query worker residency before constructing registration material.
    // Dataset.toJSON() copies the complete row set, so constructing a payload
    // merely for registerDataset() to discard it defeats resident mutation state.
    if (port.hasRegisteredDataset?.(generation, fingerprint)) {
      return (
        generation === this._generation &&
        version === this.datasetVersion &&
        fingerprint === (this.datasetFingerprint ?? '')
      );
    }
    const payload = this._workerRegistrationPayload();
    if (!payload) {
      throw new KernelUnavailableError(
        `[AtlasCore] no worker registration payload is available for dataset ${fingerprint}.`
      );
    }
    await port.registerDataset({
      registrationId: `areg-${++this._requestSeq}`,
      dataset: { fingerprint, version },
      generation,
      payload,
    });
    return (
      generation === this._generation &&
      version === this.datasetVersion &&
      fingerprint === (this.datasetFingerprint ?? '')
    );
  }

  constructor({
    kernel = null,
    eventBus = null,
    sessionId,
    onKernelFailure = null,
  }: {
    kernel?: WasmRuntimeBridgeFull | null;
    eventBus?: WorldEventBus | null;
    sessionId?: string;
    onKernelFailure?: ((error: KernelAbiError | KernelUnavailableError) => void) | null;
  } = {}) {
    this._aggregate = new InvestigationAggregate({ sessionId });
    this._analytics = new RustAnalyticalEvidenceAdapter(
      kernel,
      onKernelFailure,
      // RF-030: durable refusal provenance. A kernel-inline resource refusal is
      // recorded in the ledger (non-mutating) and the typed error is rethrown so
      // VR/UI can react. `_aggregate` is initialised above, before the adapter,
      // and the closure only invokes it later, so `this` capture is safe.
      (error) => this.recordRefusalFromError(error)
    );
    this._eventBus = eventBus;
    if (kernel) {
      this._executionPort = new InlineAnalyticalPort(kernel);
    }
  }

  get executionPort(): AnalyticalExecutionPort | null {
    return this._executionPort;
  }

  setExecutionPort(port: AnalyticalExecutionPort | null): void {
    if (this._executionPort === port) return;
    this._executionPort?.dispose?.();
    this._executionPort = port;
    if (port) {
      const fingerprint = this.datasetFingerprint ?? undefined;
      port.supersede({
        generation: this._generation,
        datasetVersion: this.datasetVersion,
        datasetFingerprint: fingerprint,
      });
    }
  }

  get generation(): number {
    return this._generation;
  }

  setGeneration(generation: number): void {
    if (!Number.isSafeInteger(generation) || generation <= 0) {
      throw new Error('[AtlasCore] runtime generation must be a positive safe integer.');
    }
    this._generation = generation;
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

  setKernel(kernel: WasmRuntimeBridgeFull | null, capabilities = 0, generation = 1): void {
    this._aggregate.analytical.invalidateHandle((handle) => this._analytics.destroyDataset(handle));
    this._analytics.setKernel(kernel);
    this._capabilities = capabilities;
    this.setGeneration(generation);
    if (kernel) {
      if (!this._executionPort || !this._executionPort.isAsync) {
        this.setExecutionPort(new InlineAnalyticalPort(kernel));
      }
    } else {
      this.setExecutionPort(null);
    }
    this._executionPort?.supersede({
      generation: this._generation,
      datasetVersion: this.datasetVersion,
      datasetFingerprint: this.datasetFingerprint ?? undefined,
    });
  }

  get capabilities(): number {
    return this._capabilities;
  }

  isReady(): boolean {
    return this._analytics.isReady();
  }

  kernelVersion(): string | null {
    return this._analytics.kernelVersion();
  }

  lastProvenance(): Provenance | null {
    return this._analytics.lastProvenance();
  }

  // --- Dataset Lifecycle --------------------------------------------------

  loadDataset(dataset: Dataset): void {
    this._aggregate.loadDataset(dataset, (handle) => this._analytics.destroyDataset(handle));
    const fingerprint = this.datasetFingerprint ?? undefined;
    this._setWorkerPayloadFromDataset(this._aggregate.analytical.currentNullable);
    this._executionPort?.supersede({
      generation: this._generation,
      datasetVersion: this.datasetVersion,
      datasetFingerprint: fingerprint,
    });
  }

  loadTypedDataset(payload: ArrayBuffer | Uint8Array, name?: string): number {
    if (!this.isReady()) {
      throw new KernelUnavailableError('Analytical kernel unavailable — cannot load typed columns.');
    }
    const workerCopy = this._cloneTypedPayload(payload);
    const handle = this._analytics.loadTypedColumns(payload, name);
    if (handle === 0) {
      throw new Error('Kernel rejected typed columns payload.');
    }
    const fp = this._analytics.fingerprint(handle);
    if (!fp) {
      this._analytics.destroyDataset(handle);
      throw new Error('Kernel accepted typed columns but produced no authoritative fingerprint.');
    }
    this._aggregate.loadTypedDataset(handle, fp, (h) => this._analytics.destroyDataset(h));
    this._workerDatasetPayload = { type: 'typed', data: workerCopy, name };
    this._executionPort?.supersede({
      generation: this._generation,
      datasetVersion: this.datasetVersion,
      datasetFingerprint: fp,
    });
    return handle;
  }

  setOriginalDataset(dataset: Dataset): void {
    this.loadDataset(dataset);
  }

  setCurrentDataset(dataset: Dataset): void {
    this._aggregate.analytical.setCurrentDataset(dataset, (handle) =>
      this._analytics.destroyDataset(handle)
    );
    const fingerprint = this.datasetFingerprint ?? undefined;
    this._setWorkerPayloadFromDataset(this._aggregate.analytical.currentNullable);
    this._executionPort?.supersede({
      generation: this._generation,
      datasetVersion: this.datasetVersion,
      datasetFingerprint: fingerprint,
    });
  }

  get originalDataset(): Dataset {
    return this._aggregate.analytical.original;
  }

  get dataset(): Dataset {
    return this._aggregate.analytical.current;
  }

  get hasDataset(): boolean {
    return this._aggregate.analytical.hasDataset;
  }

  get datasetSpace(): DatasetSpace | null {
    return this._aggregate.analytical.getDatasetSpace(
      () => this._kernelFingerprint(),
      () => this._kernelRanges()
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
      this._aggregate.context.now()
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
      this._aggregate.context.now()
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
      this._aggregate.context.now()
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
      this._aggregate.context.now()
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
      this._aggregate.context.now()
    );
  }

  /**
   * RF-030: durably record a kernel-inline TDA resource refusal in the ledger.
   * Non-mutating — a refusal produces no dataset change, so it does NOT create
   * an `AnalysisHistory` frame; it is appended only to the ledger so the
   * investigator can replay why an analytical attempt was withheld at the
   * resource boundary. Best-effort: ledger recording must never mask the typed
   * refusal, so callers (sync adapter / async worker port) wrap this in
   * try/catch and rethrow the original {@link UnsupportedAtScaleError}.
   */
  recordRefusalFromError(error: UnsupportedAtScaleError): void {
    const provenance = error.provenance;
    if (!provenance) return;
    const datasetFingerprint = this.datasetFingerprint ?? provenance.inputFingerprint;
    const refusal: RefusalProvenance = {
      operation: provenance.operation,
      parameters: provenance.parameters,
      inputFingerprint: provenance.inputFingerprint,
      provenance,
      preflight: error.preflight,
      timestamp: provenance.timestamp,
      datasetFingerprint,
      datasetVersion: this.datasetVersion,
    };
    const stateHash = this.datasetSpace?.fingerprint ?? datasetFingerprint;
    this._aggregate.ledger.recordRefusal(
      refusal,
      this._aggregate.sessionId,
      this.datasetVersion,
      stateHash
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
      this._aggregate.sessionId
    );
  }

  // --- Analytical Operations ----------------------------------------------

  applyAnalysis(spec: AnalysisSpec): AnalysisResult {
    if (!this.isReady()) {
      throw new KernelUnavailableError(
        '[AtlasCore] analytical kernel unavailable — Rust/WASM is the sole analytical authority.'
      );
    }
    // The exact-fingerprint fence is enforced on the asynchronous worker path
    // (see `applyAnalysisAsync`), where the Worker must register the dataset by
    // exact fingerprint before executing. The resident synchronous kernel always
    // operates on the current handle, so `spec.datasetFingerprint` here is an
    // advisory identity tag — rejecting it would break the pre-existing
    // investigation-replay contract, which records each operation's spec (with
    // the fingerprint that was current when it was issued) and replays it back
    // through this method against the evolving current dataset.
    const inputHandle = this._ensureHandle();
    if (inputHandle === 0) {
      throw new Error('[AtlasCore] kernel rejected input dataset');
    }

    const outHandle = this._analytics.runOperation(inputHandle, spec.operation, 'runOperation');
    if (outHandle === 0) {
      throw new Error(`[AtlasCore] kernel op "${spec.operation.op}" failed`);
    }

    let json: DatasetJSON | null;
    let provenance: Provenance | null;
    let outputHash: string;
    try {
      json = this._analytics.readDataset(outHandle);
      if (!json) {
        throw new Error(`[AtlasCore] kernel produced no output for "${spec.operation.op}"`);
      }
      provenance = this.lastProvenance();
      outputHash = this._analytics.outputFingerprint(outHandle, json);

      const nextDataset = Dataset.fromJSON(json);
      this._aggregate.analytical.commitKernelResult(
        {
          handle: outHandle,
          dataset: nextDataset,
          fingerprint: outputHash,
          versionBump: true,
        },
        (handle: number) => this._analytics.destroyDataset(handle)
      );
      this._setWorkerPayloadFromDataset(nextDataset);
    } catch (err) {
      this._analytics.destroyDataset(outHandle);
      throw err;
    }

    const resultId = this._aggregate.ledger.nextResultId(
      outputHash,
      this.datasetVersion,
      spec.operation.op
    );
    const result: AnalysisResult = {
      resultId,
      datasetFingerprint: outputHash,
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
        datasetFingerprint: outputHash,
        stateHash: outputHash,
      },
      this._aggregate.sessionId
    );

    const opNodeId = `${this._aggregate.sessionId}:${resultId}`;
    const prevVersionId = `${this._aggregate.sessionId}:v${this.datasetVersion - 1}`;
    const nextVersionId = `${this._aggregate.sessionId}:v${this.datasetVersion}`;

    this._aggregate.graph.addNode({
      id: opNodeId,
      kind: 'operation',
      parentId: prevVersionId,
      datasetVersion: this.datasetVersion,
      datasetFingerprint: outputHash,
      label: spec.label ?? spec.operation.op,
      operation: spec.operation.op,
      timestamp: this._aggregate.context.now(),
    });

    this._aggregate.graph.addNode({
      id: nextVersionId,
      kind: 'dataset_version',
      parentId: opNodeId,
      datasetVersion: this.datasetVersion,
      datasetFingerprint: outputHash,
      label: `Dataset v${this.datasetVersion}`,
      timestamp: this._aggregate.context.now(),
    });

    if (this._aggregate.graph.getNode(prevVersionId)) {
      try {
        this._aggregate.graph.connect(prevVersionId, opNodeId, 'motivates');
      } catch {
        // safe connect
      }
    }
    try {
      this._aggregate.graph.connect(opNodeId, nextVersionId, 'produces');
    } catch {
      // safe connect
    }

    return result;
  }

  previewAnalysis(spec: AnalysisSpec): AnalysisResult {
    if (!this.isReady()) {
      throw new KernelUnavailableError(
        '[AtlasCore] analytical kernel unavailable — Rust/WASM is the sole analytical authority.'
      );
    }
    const inputHandle = this._ensureHandle();
    if (inputHandle === 0) {
      throw new Error('[AtlasCore] kernel rejected input dataset');
    }

    const outHandle = this._analytics.runOperation(inputHandle, spec.operation, 'previewOperation');
    if (outHandle === 0) {
      throw new Error(`[AtlasCore] kernel preview "${spec.operation.op}" failed`);
    }
    try {
      const json = this._analytics.readDataset(outHandle);
      if (!json) {
        throw new Error(`[AtlasCore] kernel produced no preview for "${spec.operation.op}"`);
      }
      const provenance = this.lastProvenance();
      const outputHash = this._analytics.outputFingerprint(outHandle, json);
      const fp = this.datasetFingerprint ?? spec.datasetFingerprint;
      const resultId = this._aggregate.ledger.nextResultId(
        fp,
        this.datasetVersion,
        spec.operation.op
      );
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
      this._analytics.destroyDataset(outHandle);
    }
  }

  async applyAnalysisAsync(spec: AnalysisSpec): Promise<AnalysisResult> {
    if (!this._executionPort?.isAsync) {
      return this.applyAnalysis(spec);
    }
    const inputFingerprint = this.datasetFingerprint ?? '';
    if (!inputFingerprint) {
      throw new KernelUnavailableError('[AtlasCore] current dataset has no authoritative fingerprint.');
    }
    if (spec.datasetFingerprint && spec.datasetFingerprint !== inputFingerprint) {
      throw new Error('[AtlasCore] async analysis spec targets a non-current dataset fingerprint.');
    }
    const version = this.datasetVersion;
    const generation = this._generation;
    const inputDataset = this._aggregate.analytical.currentNullable;
    if (!(await this._registerCurrentDatasetInWorker(inputFingerprint, version))) {
      throw new Error(`[AtlasCore] async op "${spec.operation.op}" superseded before dispatch`);
    }
    const reqId = `areq-${++this._requestSeq}`;

    const compactRowView = this._canUseWorkerRowView(inputDataset, spec.operation);
    if (compactRowView && inputDataset) {
      // The initial baseline may have been indexed before Rust hydrated durable
      // row IDs. Refresh metadata only when that exact source is still a borrowed
      // baseline; compact/snapshot historical entries are never overwritten.
      this._aggregate.ledger.refreshBorrowedDatasetVersion(
        { datasetVersion: version, datasetFingerprint: inputFingerprint },
        inputDataset
      );
    }
    const res = await this._executionPort.execute<AnalyticalOperationOutput | {
      dataset: DatasetJSON;
      outputFingerprint: string;
    }>({
      requestId: reqId,
      operation: 'operation',
      dataset: { fingerprint: inputFingerprint, version },
      generation,
      params: {
        operation: spec.operation,
        ...(compactRowView ? { resultMode: 'row-view-if-lossless' } : {}),
      },
    });

    if (
      generation !== this._generation ||
      res.datasetVersion !== this.datasetVersion ||
      res.datasetFingerprint !== inputFingerprint ||
      inputFingerprint !== (this.datasetFingerprint ?? '') ||
      !res.value
    ) {
      throw new Error(`[AtlasCore] async op "${spec.operation.op}" superseded or failed`);
    }

    if (
      typeof res.value !== 'object' ||
      !('outputFingerprint' in res.value) ||
      typeof res.value.outputFingerprint !== 'string' ||
      !res.value.outputFingerprint
    ) {
      throw new KernelUnavailableError(
        `[AtlasCore] async op "${spec.operation.op}" produced no authoritative output fingerprint.`
      );
    }

    const outputHash = res.value.outputFingerprint;
    let json: DatasetJSON;
    let nextDataset: Dataset;
    let verifiedRowViewSourceRef: { datasetVersion: number; datasetFingerprint: string } | null = null;

    if ('kind' in res.value && res.value.kind === 'row-view') {
      if (!compactRowView || !inputDataset) {
        throw new KernelUnavailableError('[AtlasCore] unexpected compact row-view Worker result.');
      }
      const materialized = this._materializeWorkerRowView(inputDataset, res.value.view, outputHash);
      nextDataset = materialized.dataset;
      json = materialized.json;
      verifiedRowViewSourceRef = {
        datasetVersion: version,
        datasetFingerprint: inputFingerprint,
      };
    } else {
      // `kind: dataset` is the current production full path. The untagged shape
      // is retained temporarily for third-party/test execution-port compatibility.
      const datasetJson = 'dataset' in res.value ? res.value.dataset : null;
      if (!datasetJson) {
        throw new KernelUnavailableError(
          `[AtlasCore] async op "${spec.operation.op}" produced no dataset payload.`
        );
      }
      json = datasetJson;
      nextDataset = Dataset.fromJSON(json);
    }

    this._aggregate.analytical.commitKernelResult(
      {
        handle: 0,
        dataset: nextDataset,
        fingerprint: outputHash,
        versionBump: true,
      },
      (handle: number) => this._analytics.destroyDataset(handle)
    );
    this._executionPort.supersede({
      generation: this._generation,
      datasetVersion: this.datasetVersion,
      datasetFingerprint: outputHash,
    });
    // The Worker adopts the Rust mutation output handle before RESULT resolves.
    // Retire the cached registration snapshot only when the active port can
    // attest that exact fingerprint in this generation. Other async ports keep
    // the conservative materialized reconstruction path.
    if (this._executionPort.hasRegisteredDataset?.(this._generation, outputHash)) {
      this._workerDatasetPayload = null;
    } else {
      this._setWorkerPayloadFromDataset(this._aggregate.analytical.currentNullable);
    }

    const resultId = this._aggregate.ledger.nextResultId(
      outputHash,
      this.datasetVersion,
      spec.operation.op
    );

    const result: AnalysisResult = {
      resultId,
      datasetFingerprint: outputHash,
      datasetVersion: this.datasetVersion,
      spec,
      dataset: json,
      metrics: null,
      provenance: res.provenance ?? null,
      implementationVersion: this.kernelVersion() ?? spec.algorithmVersion,
      outputHash,
      evidenceStatus: 'exploratory' as EvidenceStatus,
    };

    this._aggregate.ledger.addResult(
      result,
      verifiedRowViewSourceRef
        ? { kind: 'verified-row-view', sourceRef: verifiedRowViewSourceRef }
        : undefined
    );
    this._aggregate.ledger.appendEvent(
      {
        timestamp: this._aggregate.context.now(),
        kind: 'analysis',
        command: spec,
        result,
        datasetVersion: this.datasetVersion,
        datasetFingerprint: outputHash,
        stateHash: outputHash,
      },
      this._aggregate.sessionId
    );

    const opNodeId = `${this._aggregate.sessionId}:${resultId}`;
    const prevVersionId = `${this._aggregate.sessionId}:v${this.datasetVersion - 1}`;
    const nextVersionId = `${this._aggregate.sessionId}:v${this.datasetVersion}`;

    this._aggregate.graph.addNode({
      id: opNodeId,
      kind: 'operation',
      parentId: prevVersionId,
      datasetVersion: this.datasetVersion,
      datasetFingerprint: outputHash,
      label: spec.label ?? spec.operation.op,
      operation: spec.operation.op,
      timestamp: this._aggregate.context.now(),
    });

    this._aggregate.graph.addNode({
      id: nextVersionId,
      kind: 'dataset_version',
      parentId: opNodeId,
      datasetVersion: this.datasetVersion,
      datasetFingerprint: outputHash,
      label: `Dataset v${this.datasetVersion}`,
      timestamp: this._aggregate.context.now(),
    });

    if (this._aggregate.graph.getNode(prevVersionId)) {
      try {
        this._aggregate.graph.connect(prevVersionId, opNodeId, 'motivates');
      } catch {
        // safe connect
      }
    }
    try {
      this._aggregate.graph.connect(opNodeId, nextVersionId, 'produces');
    } catch {
      // safe connect
    }

    return result;
  }

  resetAnalysis(): AnalysisResult | null {
    if (!this._aggregate.analytical.originalNullable) return null;
    const prevVersionId = `${this._aggregate.sessionId}:v${this.datasetVersion}`;
    this._aggregate.analytical.advanceDataset(this._aggregate.analytical.original.clone(), (h) =>
      this._analytics.destroyDataset(h)
    );

    const fp = this.datasetFingerprint ?? '';
    this._setWorkerPayloadFromDataset(this._aggregate.analytical.currentNullable);
    this._executionPort?.supersede({
      generation: this._generation,
      datasetVersion: this.datasetVersion,
      datasetFingerprint: fp || undefined,
    });
    const resetOpId = `reset-${Date.now()}`;
    const nextVersionId = `${this._aggregate.sessionId}:v${this.datasetVersion}`;

    this._aggregate.ledger.appendEvent(
      {
        timestamp: this._aggregate.context.now(),
        kind: 'reset',
        command: { op: 'reset' },
        datasetVersion: this.datasetVersion,
        datasetFingerprint: fp,
        stateHash: this.datasetSpace?.fingerprint ?? '',
      },
      this._aggregate.sessionId
    );

    this._aggregate.graph.addNode({
      id: `${this._aggregate.sessionId}:${resetOpId}`,
      kind: 'operation',
      parentId: prevVersionId,
      datasetVersion: this.datasetVersion,
      datasetFingerprint: fp,
      label: 'Reset to Original',
      operation: 'reset',
      timestamp: this._aggregate.context.now(),
    });

    this._aggregate.graph.addNode({
      id: nextVersionId,
      kind: 'dataset_version',
      parentId: `${this._aggregate.sessionId}:${resetOpId}`,
      datasetVersion: this.datasetVersion,
      datasetFingerprint: fp,
      label: `Dataset v${this.datasetVersion} (Reset)`,
      timestamp: this._aggregate.context.now(),
    });

    if (this._aggregate.graph.getNode(prevVersionId)) {
      this._aggregate.graph.connect(
        prevVersionId,
        `${this._aggregate.sessionId}:${resetOpId}`,
        'motivates'
      );
    }
    this._aggregate.graph.connect(
      `${this._aggregate.sessionId}:${resetOpId}`,
      nextVersionId,
      'produces'
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
      this._aggregate.sessionId
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
      this._aggregate.sessionId
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
      this._aggregate.sessionId
    );
    return entry;
  }

  // --- Parse, Sample & TDA -----------------------------------------------

  parseBytes(
    bytes: Uint8Array,
    ext: 'csv' | 'json',
    explicitTopology?: string | null
  ): { dataset: Dataset; topology: TopologyType; encodings: Record<string, string> } {
    if (!this.isReady()) {
      throw new KernelUnavailableError('Analytical kernel unavailable — cannot parse file.');
    }
    if (ext !== 'csv' && ext !== 'json') {
      throw new Error('Unsupported file type; use .csv or .json');
    }
    const parsed = this._analytics.parseDataset(bytes, ext, explicitTopology);
    return {
      dataset: Dataset.fromJSON(parsed.dataset),
      topology: parsed.topology,
      encodings: parsed.encodings,
    };
  }

  loadSample(key: string): Dataset | null {
    const dataset = this._analytics.loadSample(key);
    return dataset ? Dataset.fromJSON(dataset) : null;
  }

  computePersistenceIntervalsForCurrent(
    params: Record<string, unknown>
  ): PersistenceInterval[] | null {
    if (!this.isReady()) return null;
    const handle = this._ensureHandle();
    if (handle === 0) return null;
    return this._analytics.computePersistenceIntervalsForHandle(handle, params);
  }

  computeMapperGraphForCurrent(params: Record<string, unknown>): TdaMapperGraph | null {
    if (!this.isReady()) return null;
    const handle = this._ensureHandle();
    if (handle === 0) return null;
    return this._analytics.computeMapperGraphForHandle(handle, params);
  }

  computeBetti0CurveForCurrent(params: Record<string, unknown>): BettiPoint[] | null {
    if (!this.isReady()) return null;
    const handle = this._ensureHandle();
    if (handle === 0) return null;
    return this._analytics.computeBetti0CurveForHandle(handle, params);
  }

  computePersistenceIntervals(
    dataset: Dataset,
    params: Record<string, unknown>
  ): PersistenceInterval[] | null {
    this._requireCurrentTdaHandle(dataset);
    return this.computePersistenceIntervalsForCurrent(params);
  }

  computeMapperGraph(dataset: Dataset, params: Record<string, unknown>): TdaMapperGraph | null {
    this._requireCurrentTdaHandle(dataset);
    return this.computeMapperGraphForCurrent(params);
  }

  computeBetti0Curve(dataset: Dataset, params: Record<string, unknown>): BettiPoint[] | null {
    this._requireCurrentTdaHandle(dataset);
    return this.computeBetti0CurveForCurrent(params);
  }

  private async _computeTdaEvidenceAsync<T>(
    operation: 'tda.persistence' | 'tda.mapper' | 'tda.betti0',
    params: Record<string, unknown>,
  ): Promise<{ value: T; provenance: Provenance | null; datasetVersion: number; datasetFingerprint: string } | null> {
    const fp = this.datasetFingerprint ?? '';
    if (!fp) return null;
    const version = this.datasetVersion;
    const generation = this._generation;
    if (!(await this._registerCurrentDatasetInWorker(fp, version))) return null;
    const reqId = `areq-${++this._requestSeq}`;

    const res = await this._executionPort!.execute<T>({
      requestId: reqId,
      operation,
      dataset: { fingerprint: fp, version },
      generation,
      params,
    });

    if (
      generation !== this._generation ||
      res.datasetVersion !== this.datasetVersion ||
      res.datasetFingerprint !== fp ||
      fp !== (this.datasetFingerprint ?? '') ||
      res.value == null
    ) {
      return null;
    }
    return {
      value: res.value,
      provenance: res.provenance ?? null,
      datasetVersion: version,
      datasetFingerprint: fp,
    };
  }

  async computePersistenceEvidenceAsync(
    params: Record<string, unknown>
  ): Promise<{ value: PersistenceInterval[]; provenance: Provenance | null; datasetVersion: number; datasetFingerprint: string } | null> {
    if (!this._executionPort?.isAsync) {
      const value = this.computePersistenceIntervalsForCurrent(params);
      return value ? {
        value,
        provenance: this.lastProvenance(),
        datasetVersion: this.datasetVersion,
        datasetFingerprint: this.datasetFingerprint ?? '',
      } : null;
    }
    return this._computeTdaEvidenceAsync<PersistenceInterval[]>('tda.persistence', params);
  }

  async computeMapperEvidenceAsync(
    params: Record<string, unknown>
  ): Promise<{ value: TdaMapperGraph; provenance: Provenance | null; datasetVersion: number; datasetFingerprint: string } | null> {
    if (!this._executionPort?.isAsync) {
      const value = this.computeMapperGraphForCurrent(params);
      return value ? {
        value,
        provenance: this.lastProvenance(),
        datasetVersion: this.datasetVersion,
        datasetFingerprint: this.datasetFingerprint ?? '',
      } : null;
    }
    return this._computeTdaEvidenceAsync<TdaMapperGraph>('tda.mapper', params);
  }

  async computeBetti0EvidenceAsync(
    params: Record<string, unknown>
  ): Promise<{ value: BettiPoint[]; provenance: Provenance | null; datasetVersion: number; datasetFingerprint: string } | null> {
    if (!this._executionPort?.isAsync) {
      const value = this.computeBetti0CurveForCurrent(params);
      return value ? {
        value,
        provenance: this.lastProvenance(),
        datasetVersion: this.datasetVersion,
        datasetFingerprint: this.datasetFingerprint ?? '',
      } : null;
    }
    return this._computeTdaEvidenceAsync<BettiPoint[]>('tda.betti0', params);
  }

  async computePersistenceIntervalsAsync(
    params: Record<string, unknown>
  ): Promise<PersistenceInterval[] | null> {
    if (this._executionPort?.isAsync) {
      const fingerprint = this.datasetFingerprint ?? '';
      if (!fingerprint) return null;
      if (!(await this._registerCurrentDatasetInWorker(fingerprint, this.datasetVersion))) return null;
    }
    return (await this.computePersistenceEvidenceAsync(params))?.value ?? null;
  }

  async computeMapperGraphAsync(
    params: Record<string, unknown>
  ): Promise<TdaMapperGraph | null> {
    if (this._executionPort?.isAsync) {
      const fingerprint = this.datasetFingerprint ?? '';
      if (!fingerprint) return null;
      if (!(await this._registerCurrentDatasetInWorker(fingerprint, this.datasetVersion))) return null;
    }
    return (await this.computeMapperEvidenceAsync(params))?.value ?? null;
  }

  async computeBetti0CurveAsync(
    params: Record<string, unknown>
  ): Promise<BettiPoint[] | null> {
    if (this._executionPort?.isAsync) {
      const fingerprint = this.datasetFingerprint ?? '';
      if (!fingerprint) return null;
      if (!(await this._registerCurrentDatasetInWorker(fingerprint, this.datasetVersion))) return null;
    }
    return (await this.computeBetti0EvidenceAsync(params))?.value ?? null;
  }

  computeSpectralFacts(timeColumn?: string, valueColumn?: string): SpectralFacts | null {
    if (!this.isReady()) return null;
    const handle = this._ensureHandle();
    return this._analytics.computeSpectralFacts(handle, timeColumn, valueColumn);
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
      this.lastProvenance()
    );
    this._aggregate.ledger.recordStructure(
      structures,
      this._aggregate.sessionId,
      this._aggregate.context.now()
    );
    return structures;
  }

  discoverPersistenceStructures(
    dataset: Dataset,
    params: Record<string, unknown>
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
      this.lastProvenance()
    );
    this._aggregate.ledger.recordStructure(
      structures,
      this._aggregate.sessionId,
      this._aggregate.context.now()
    );
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
      result.provenance
    );
    this._aggregate.ledger.recordStructure(
      structures,
      this._aggregate.sessionId,
      this._aggregate.context.now()
    );
    return structures;
  }

  // --- Facts & compatibility FactProvider --------------------------------

  facts(): Facts | null {
    if (!this.isReady()) return null;
    const handle = this._ensureHandle();
    if (handle === 0) return null;
    return this._analytics.statistics(handle);
  }

  /**
   * Canonical V3 analytical evidence for representation reasoning. Fails closed
   * unless the live Rust dataset handle can produce a structure profile whose
   * identity agrees with the handle fingerprint.
   */
  datasetEvidence(): DatasetEvidence {
    if (!this.isReady()) {
      throw new KernelUnavailableError(
        '[AtlasCore] analytical kernel unavailable — Moneta representation reasoning requires Rust DatasetEvidence.'
      );
    }
    const handle = this._ensureHandle();
    if (handle === 0) {
      throw new Error('[AtlasCore] kernel rejected input dataset');
    }
    return this._analytics.datasetEvidence(handle);
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
    return this._analytics.inferTopology(handle);
  }

  inferEncodings(topology?: string): EncodingMapping | null {
    if (!this.isReady()) return null;
    const handle = this._ensureHandle();
    if (handle === 0) return null;
    return this._analytics.inferEncodings(handle, topology);
  }

  monetaFacts(input: MonetaDataInput): MonetaFacts | null {
    return this._aggregate.representation.toMonetaFacts(input, this.facts());
  }

  dracoFacts(input: DracoDataInput): DracoFacts | null {
    return this.monetaFacts(input);
  }

  /**
   * Compatibility/presentation FactProvider. Canonical representation ranking
   * does not use this surface; it consumes DatasetEvidence via datasetEvidence().
   */
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
    _input?: DracoDataInput,
    _spectralFacts?: SpectralFacts | null
  ): DatasetSignature {
    return this._aggregate.representation.computeDatasetSignatureFromEvidence(
      this.datasetEvidence()
    );
  }

  /** Evaluate Moneta ranking without changing the active representation state. */
  previewRepresentation(
    requirements?: RepresentationRequirements,
  ): RepresentationDecision {
    return this._aggregate.representation.previewRepresentationFromEvidence(
      this.datasetEvidence(),
      requirements
    );
  }

  arbitrateRepresentation(
    requirements?: RepresentationRequirements,
    _input?: DracoDataInput,
    _spectralFacts?: SpectralFacts | null
  ): RepresentationDecision {
    return this._aggregate.representation.arbitrateRepresentationFromEvidence(
      this.datasetEvidence(),
      requirements
    );
  }

  arbitrateSpatialStrategy(
    requirements?: RepresentationRequirements,
    _input?: DracoDataInput
  ): SpatialStrategy {
    return this._aggregate.representation.arbitrateStrategyFromEvidence(
      this.datasetEvidence(),
      requirements
    );
  }

  recordRemediation(provenance: RemediationProvenance): void {
    this._aggregate.recordRemediation(provenance);
  }

  remediationEvents(): RemediationProvenance[] {
    return this._aggregate.ledger.remediationEvents();
  }

  toState(): AtlasCoreState {
    return this._aggregate.toState();
  }

  restoreState(state: AtlasCoreState): void {
    this._aggregate.restoreState(state, (handle) => this._analytics.destroyDataset(handle));
    this._setWorkerPayloadFromDataset(this._aggregate.analytical.currentNullable);
    this._executionPort?.supersede({
      generation: this._generation,
      datasetVersion: this.datasetVersion,
      datasetFingerprint: this.datasetFingerprint ?? undefined,
    });
  }

  async computeDigest(): Promise<string> {
    return this._aggregate.computeDigest(this.kernelVersion() ?? 'unknown');
  }

  dispose(): void {
    this._executionPort?.dispose?.();
    this._executionPort = null;
    this._workerDatasetPayload = null;
    this._aggregate.dispose((handle) => this._analytics.destroyDataset(handle));
  }

  // --- Internal Helpers --------------------------------------------------

  private _requireCurrentTdaHandle(dataset: Dataset): number {
    const analytical = this._aggregate.analytical;
    // loadDataset/setCurrentDataset defensively clone and ensureHandle()
    // adopts lineage rowIds onto the working instance, so the caller's
    // reference is never the working copy. Accept the exact instance the
    // caller handed over (WeakRef-tracked) or the live working copy —
    // without serializing or rematerialising either.
    if (dataset === analytical.currentNullable || analytical.matchesLoadedSource(dataset)) {
      return this._ensureHandle();
    }
    throw new Error(
      '[AtlasCore] TDA requires the current Atlas dataset; load or set the dataset explicitly before analysis.'
    );
  }

  private _ensureHandle(): number {
    return this._aggregate.analytical.ensureHandle((json) => {
      if (!this.isReady()) return 0;
      return this._analytics.loadDataset(json);
    });
  }

  private _kernelFingerprint(): string | null {
    if (!this.isReady()) return null;
    const handle = this._ensureHandle();
    if (handle === 0) return null;
    return this._analytics.fingerprint(handle);
  }

  private _kernelFingerprintDirect(): string | null {
    if (!this.isReady()) return null;
    const handle = this._ensureHandle();
    if (handle === 0) return null;
    return this._analytics.fingerprint(handle);
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

  private _clusterCall(
    dataset: Dataset,
    operation: OperationSpec
  ): { rows: Record<string, unknown>[]; provenance: Provenance | null } | null {
    return this._analytics.computeCluster(dataset.toJSON(), operation);
  }

  private _spaceForDataset(dataset: Dataset): DatasetSpace {
    if (this.dataset && this.datasetFingerprint === fnv1aHex(dataset.toJSON())) {
      return this.datasetSpace ?? new DatasetSpace(dataset);
    }
    const fingerprint = this._analytics.fingerprintDataset(dataset.toJSON());
    return new DatasetSpace(dataset, { fingerprint });
  }
}
