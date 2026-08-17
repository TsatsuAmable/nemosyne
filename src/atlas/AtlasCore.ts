/**
 * AtlasCore — the single analytical authority for the operation path.
 *
 * Wave 4: the data-operation controller issues typed {@link AnalysisSpec}
 * commands to AtlasCore. AtlasCore is the ONLY production caller of the Rust
 * kernel for analytical operations (parse/load/sample/TDA are deferred to
 * Wave 6). Every analytical result carries a kernel provenance envelope
 * (`bridge.kernelProvenance()` read after each kernel call); null is tolerated
 * for mock kernels and never fabricated.
 *
 * AnalysisHistory is RETAINED as the undo/redo cursor (legacy consumers:
 * narrative strip, session restore); the ledger + results chain are the
 * authoritative provenance record. A future wave may unify.
 */

import { AnalysisHistory } from '../data/AnalysisHistory.ts';
import type { HistoryEntry, HistorySnapshot } from '../data/AnalysisHistory.ts';
import { Dataset } from '../data/Dataset.ts';
import type {
  DatasetJSON,
  EncodingMapping,
  Facts,
  OperationSpec,
  Provenance,
} from '../data/types.ts';
import { WorldEventBus } from '../utils/EventBus.ts';
import { DatasetSpace, fnv1aHex } from './DatasetSpace.ts';
import type { DatasetSpaceJSON } from './DatasetSpace.ts';
import type {
  AnalysisResult,
  AnalysisSpec,
  AtlasCoreState,
  AtlasRecommendation,
  EvidenceStatus,
  RecommendationDecision,
  ResearchEvent,
} from './types.ts';
import type {
  DracoDataInput,
  DracoFacts,
  FactProvider,
  NumericStats,
  CategoricalDistribution,
} from '../draco/types.ts';
import { TopologyTypes } from '../types/topology.ts';

/**
 * Full kernel bridge surface. Extends the duck-typed coordinator subset with
 * the provenance/version/fingerprint/schema members AtlasCore reads. The real
 * `RuntimeBridge` satisfies this; the test mock must too.
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
  // Full-surface members (optional on the bridge via `?.` so duck-typed mocks
  // that omit them still work — null/undefined is tolerated).
  kernelVersion?(): string | null;
  kernelProvenance?(): Provenance | null;
  datasetFingerprint?(handle: number): string | null;
  inferSchema?(handle: number): unknown;
}

function now(): number {
  return (typeof performance !== 'undefined' && performance.now) ? performance.now()
    : (typeof Date !== 'undefined' && Date.now) ? Date.now()
    : 0;
}

function emptyDataset(): Dataset {
  return new Dataset('empty', [], []);
}

/**
 * Map a kernel {@link Facts} block (from `kernel.statistics`) into the
 * {@link DracoFacts} shape Draco's constraint rules read. This is a pure
 * shape-mapping helper — it performs NO statistical computation; every
 * numeric value comes from the kernel result. The only derived value is
 * `clusterCount`, a display heuristic (`sqrt(rowCount)` / color cardinality)
 * that is embodiment metadata, not an analytical result.
 */
function mapKernelFactsToDraco(
  input: DracoDataInput,
  kf: Facts,
  largeRowThreshold: number,
  highCardinalityThreshold: number,
): DracoFacts {
  const ds = input.dataset;
  const rowCount = ds?.rowCount ?? input.rows?.length ?? input.nodes?.length ?? kf.rowCount;
  const edgeCount = input.edges?.length ?? ds?.edges?.length ?? 0;
  const numericCols = ds?.numericColumns ?? [];
  const categoricalCols = ds?.categoricalColumns ?? [];
  const temporalCols = ds?.temporalColumns ?? [];
  const colorColumn = input.encodings?.color ?? categoricalCols[0]?.name ?? null;

  const columnStats: Record<string, NumericStats> = {};
  for (const c of kf.numeric) {
    columnStats[c.name] = {
      mean: c.mean,
      median: c.median,
      stdDev: c.std,
      skew: c.skew,
      kurtosis: c.kurtosis,
      min: c.min,
      max: c.max,
    };
  }

  // Build a symmetric correlation matrix from kernel correlation pairs.
  const correlationMatrix: Record<string, Record<string, number>> = {};
  const numericNames = kf.numeric.map((c) => c.name);
  for (const a of numericNames) {
    correlationMatrix[a] = {};
    for (const b of numericNames) {
      correlationMatrix[a][b] = a === b ? 1 : 0;
    }
  }
  for (const p of kf.correlation) {
    if (!correlationMatrix[p.a]) correlationMatrix[p.a] = {};
    if (!correlationMatrix[p.b]) correlationMatrix[p.b] = {};
    correlationMatrix[p.a][p.b] = p.value;
    correlationMatrix[p.b][p.a] = p.value;
  }

  const categoryDistribution: Record<string, CategoricalDistribution> = {};
  for (const c of kf.categorical) {
    const total = c.top.reduce((s, t) => s + t.count, 0) || kf.rowCount || 1;
    categoryDistribution[c.name] = {
      topCategories: c.top.map((t) => ({ value: t.value, count: t.count, fraction: t.count / total })),
      entropy: c.entropy,
    };
  }

  const colorCat = colorColumn ? categoryDistribution[colorColumn] : undefined;
  const colorCardinality = colorCat
    ? kf.categorical.find((c) => c.name === colorColumn)?.cardinality ?? 0
    : 0;

  const primaryNumeric = kf.numeric[0];
  const primaryTemporal = kf.temporalStats[0];
  const outlierCount = primaryNumeric?.outlierCount ?? 0;

  const clusterCount = estimateClusterCount(rowCount, colorCardinality, numericCols.length);

  return {
    topology: input.topology || TopologyTypes.TABULAR,
    rowCount,
    nodeCount: input.nodes?.length ?? rowCount,
    edgeCount,
    depth: input.maxDepth ?? temporalCols.length ?? 1,
    numericColumns: numericCols.length,
    categoricalColumns: categoricalCols.length,
    temporalColumns: temporalCols.length,
    hasTimeSeries: input.isTimeSeries || temporalCols.length > 0,
    hasContinuousValues: numericCols.length > 0,
    density: edgeCount / Math.max(1, rowCount),
    estimatedDensity: rowCount / 64,
    outlierCount,
    cardinalityOfColor: colorCardinality,
    hasHighCardinality: colorCardinality > highCardinalityThreshold,
    isLargeDataset: rowCount > largeRowThreshold,
    clusterCount,
    columnStats,
    correlationMatrix,
    categoryDistribution,
    trendDirection: primaryTemporal?.trendDirection ?? 'flat',
    seasonalityHint: primaryTemporal?.seasonalityHint ?? false,
    hasOutliers: outlierCount > 0,
    hasHighVariance: (primaryNumeric?.std ?? 0) > 0,
    numericSkew: primaryNumeric?.skew ?? 0,
    topCategory: colorCat?.topCategories?.[0]?.value ?? null,
  };
}

/** Display-only cluster-count heuristic (embodiment metadata, not analytical). */
function estimateClusterCount(rowCount: number, cardinalityOfColor: number, numericColumnCount: number): number {
  if (cardinalityOfColor > 1 && cardinalityOfColor <= 20) return cardinalityOfColor;
  if (numericColumnCount === 0) return 1;
  return Math.min(20, Math.max(1, Math.round(Math.sqrt(rowCount))));
}

/**
 * Minimal schema-metadata `DracoFacts` for the no-kernel state (renderer
 * shell). Reads ONLY column-type counts + row/edge counts + topology — NO
 * statistics. Statistical fields are zero/empty so the constraint rules pick
 * a valid topology-based spec; the palace is rebuilt with kernel facts once
 * the kernel is ready.
 */
function minimalDracoFacts(
  input: DracoDataInput,
  largeRowThreshold: number,
  highCardinalityThreshold: number,
): DracoFacts {
  const ds = input.dataset;
  const rowCount = ds?.rowCount ?? input.rows?.length ?? input.nodes?.length ?? 0;
  const edgeCount = input.edges?.length ?? ds?.edges?.length ?? 0;
  const numericCols = ds?.numericColumns ?? [];
  const categoricalCols = ds?.categoricalColumns ?? [];
  const temporalCols = ds?.temporalColumns ?? [];
  return {
    topology: input.topology || TopologyTypes.TABULAR,
    rowCount,
    nodeCount: input.nodes?.length ?? rowCount,
    edgeCount,
    depth: input.maxDepth ?? temporalCols.length ?? 1,
    numericColumns: numericCols.length,
    categoricalColumns: categoricalCols.length,
    temporalColumns: temporalCols.length,
    hasTimeSeries: input.isTimeSeries || temporalCols.length > 0,
    hasContinuousValues: numericCols.length > 0,
    density: edgeCount / Math.max(1, rowCount),
    estimatedDensity: rowCount / 64,
    outlierCount: 0,
    cardinalityOfColor: 0,
    hasHighCardinality: 0 > highCardinalityThreshold,
    isLargeDataset: rowCount > largeRowThreshold,
    clusterCount: estimateClusterCount(rowCount, 0, numericCols.length),
    columnStats: {},
    correlationMatrix: {},
    categoryDistribution: {},
    trendDirection: 'flat',
    seasonalityHint: false,
    hasOutliers: false,
    hasHighVariance: false,
    numericSkew: 0,
    topCategory: null,
  };
}

export class AtlasCore {
  private _kernel: WasmRuntimeBridgeFull | null;
  private _capabilities = 0;
  private _eventBus: WorldEventBus | null;
  private _sessionId: string;

  private _original: Dataset | null = null;
  private _current: Dataset | null = null;
  private _datasetVersion = 0;
  private _history: AnalysisHistory;
  private _results: AnalysisResult[] = [];
  private _ledger: ResearchEvent[] = [];
  private _activeRecommendation: AtlasRecommendation | null = null;
  private _decisionHistory: AtlasRecommendation[] = [];

  private _currentHandle = 0;
  private _datasetSpace: DatasetSpace | null = null;
  private _datasetSpaceSource: Dataset | null = null;

  private _resultCounter = 0;
  private _eventCounter = 0;

  constructor({
    kernel = null,
    eventBus,
    sessionId,
  }: { kernel?: WasmRuntimeBridgeFull | null; eventBus?: WorldEventBus; sessionId?: string } = {}) {
    this._kernel = kernel;
    this._eventBus ??= null;
    this._history = new AnalysisHistory();
    this._sessionId = sessionId ?? `session-${now()}`;
  }

  // --- Kernel binding -----------------------------------------------------

  setKernel(kernel: WasmRuntimeBridgeFull | null, capabilities = 0): void {
    this._kernel = kernel;
    this._capabilities = capabilities;
    // The cached handle may no longer match the new kernel; invalidate so it
    // rebuilds lazily from `_current` on the next kernel call.
    this._invalidateHandle();
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

  /** Provenance envelope from the most recent kernel call (side-channel). */
  lastProvenance(): Provenance | null {
    try {
      return this._kernel?.kernelProvenance?.() ?? null;
    } catch {
      return null;
    }
  }

  // --- Dataset lifecycle --------------------------------------------------

  /**
   * Load a new dataset as the original + current. Resets the results/ledger/
   * history, bumps the dataset version, and appends a 'load' ResearchEvent.
   */
  loadDataset(dataset: Dataset): void {
    this._original = dataset?.clone?.() ?? emptyDataset();
    this._current = this._original.clone();
    this._datasetVersion += 1;
    this._resetState();
    this._invalidateHandle();
    this._datasetSpace = null;
    this._datasetSpaceSource = null;
    this._appendEvent('load', { op: 'load' }, undefined);
  }

  /** Alias for {@link loadDataset} used by the World facade setter path. */
  setOriginalDataset(dataset: Dataset): void {
    this.loadDataset(dataset);
  }

  /**
   * Set the current dataset only (used by session restore / _restoreDataset).
   * Does NOT bump the version. Rebuilds the DatasetSpace cache if the source
   * identity changed.
   */
  setCurrentDataset(dataset: Dataset): void {
    const next = dataset?.clone?.() ?? emptyDataset();
    const changed = this._datasetSpaceSource !== next;
    this._current = next;
    this._invalidateHandle();
    if (changed) {
      this._datasetSpace = null;
      this._datasetSpaceSource = null;
    }
  }

  get originalDataset(): Dataset {
    return this._original ?? emptyDataset();
  }

  get dataset(): Dataset {
    return this._current ?? emptyDataset();
  }

  get datasetSpace(): DatasetSpace | null {
    if (!this._current) return null;
    if (this._datasetSpace && this._datasetSpaceSource === this._current) {
      return this._datasetSpace;
    }
    this._datasetSpace = new DatasetSpace(this._current);
    this._datasetSpaceSource = this._current;
    return this._datasetSpace;
  }

  /** Kernel-derived fingerprint when ready, else DatasetSpace.fingerprint. */
  get datasetFingerprint(): string | null {
    if (this.isReady()) {
      const handle = this._ensureHandle();
      if (handle !== 0) {
        try {
          const fp = this._kernel?.datasetFingerprint?.(handle);
          if (fp) return fp;
        } catch {
          // fall back to DatasetSpace fingerprint
        }
      }
    }
    return this.datasetSpace?.fingerprint ?? null;
  }

  get datasetVersion(): number {
    return this._datasetVersion;
  }

  get analysisHistory(): AnalysisHistory {
    return this._history;
  }

  get results(): readonly AnalysisResult[] {
    return this._results;
  }

  get ledger(): readonly ResearchEvent[] {
    return this._ledger;
  }

  get activeRecommendation(): AtlasRecommendation | null {
    return this._activeRecommendation;
  }

  get decisionHistory(): AtlasRecommendation[] {
    return this._decisionHistory;
  }

  setRecommendation(rec: AtlasRecommendation | null): void {
    this._activeRecommendation = rec;
  }

  recordDecision(decision: RecommendationDecision): void {
    if (!this._activeRecommendation) return;
    this._activeRecommendation = { ...this._activeRecommendation, decision };
    this._decisionHistory.push(this._activeRecommendation);
  }

  // --- Analytical ops (SOLE kernel callers for the operation path) --------

  /**
   * Apply an analytical spec through the kernel. Mutates `_current`, pushes an
   * AnalysisResult + AnalysisHistory frame + a 'analysis' ResearchEvent.
   * Returns the result. Throws if the kernel is unavailable/rejects the op.
   */
  applyAnalysis(spec: AnalysisSpec): AnalysisResult {
    if (!this.isReady()) {
      throw new Error('[AtlasCore] analytical kernel unavailable');
    }
    const kernel = this._kernel!;
    const inputHandle = this._ensureHandle();
    if (inputHandle === 0) {
      throw new Error('[AtlasCore] kernel rejected input dataset');
    }

    const before = this._current ?? emptyDataset();
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
      // The outHandle becomes the new current handle ONLY after we've read it.
      // Destroy the previous input handle and adopt outHandle.
    }

    // Adopt the output handle as the new current handle (destroys the old one).
    this._adoptHandle(outHandle);

    const nextDataset = Dataset.fromJSON(json);
    this._current = nextDataset;
    this._datasetSpace = null;
    this._datasetSpaceSource = null;

    const fp = this.datasetFingerprint ?? spec.datasetFingerprint;
    const resultId = this._buildResultId(fp, spec);
    const result: AnalysisResult = {
      resultId,
      datasetFingerprint: fp,
      datasetVersion: this._datasetVersion,
      spec,
      dataset: json,
      metrics: null,
      provenance,
      implementationVersion: this.kernelVersion() ?? spec.algorithmVersion,
      outputHash,
      evidenceStatus: 'exploratory' as EvidenceStatus,
    };

    this._results.push(result);
    const label = spec.label ?? spec.operation.op;
    this._history.push(label, before, nextDataset, spec.operation as Record<string, unknown>);
    this._appendEvent('analysis', spec, result);
    return result;
  }

  /**
   * Compute a preview result WITHOUT mutating `_current`/results/ledger/history.
   * Uses a transient handle that is destroyed. Returns the preview result.
   */
  previewAnalysis(spec: AnalysisSpec): AnalysisResult {
    if (!this.isReady()) {
      throw new Error('[AtlasCore] analytical kernel unavailable');
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
      const resultId = this._buildResultId(fp, spec);
      const result: AnalysisResult = {
        resultId,
        datasetFingerprint: fp,
        datasetVersion: this._datasetVersion,
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

  /**
   * Reset to the original dataset. Pushes a 'reset' history frame + a 'reset'
   * ResearchEvent. Returns null (controller ignores the return).
   */
  resetAnalysis(): AnalysisResult | null {
    if (!this._original) return null;
    const before = this._current ?? emptyDataset();
    this._current = this._original.clone();
    this._invalidateHandle();
    this._datasetSpace = null;
    this._datasetSpaceSource = null;
    this._history.push('reset', before, this._current);
    this._appendEvent('reset', { op: 'reset' }, undefined);
    return null;
  }

  undo(): HistoryEntry | null {
    const entry = this._history.undo();
    if (!entry) return null;
    this.setCurrentDataset(entry.dataset);
    this._appendEvent('undo', { op: 'undo' }, undefined);
    return entry;
  }

  redo(): HistoryEntry | null {
    const entry = this._history.redo();
    if (!entry) return null;
    this.setCurrentDataset(entry.dataset);
    this._appendEvent('redo', { op: 'redo' }, undefined);
    return entry;
  }

  seekHistory(index: number): HistoryEntry | null {
    const entry = this._history.seek(index);
    if (!entry) return null;
    this.setCurrentDataset(entry.dataset);
    this._appendEvent('seek', { op: 'seek', index }, undefined);
    return entry;
  }

  // --- Facts / inference (Wave 5 consumers; controller medianOf) --------

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

  // --- Draco facts (Wave 5: AtlasCore is the Draco FactProvider) -----------

  /**
   * Map kernel `Facts` (`kernel.statistics`) into the `DracoFacts` shape
   * Draco's constraint rules expect. AtlasCore is the sole supplier of Draco
   * facts; Draco performs NO dataset-derived statistical computation. The
   * kernel call records provenance via the side-channel (`lastProvenance()`).
   *
   * When the kernel is unavailable (e.g. World construction before `start()`
   * loads the wasm runtime), returns a MINIMAL schema-metadata facts object
   * (column counts + topology + scale, NO statistics) so the renderer shell
   * can mount. Statistical fields are zero/empty — this is schema metadata,
   * not analytical computation. The palace is rebuilt with kernel facts once
   * the kernel becomes ready (see `_initWasmRuntime`).
   */
  dracoFacts(input: DracoDataInput): DracoFacts | null {
    const kernelFacts = this.facts();
    if (kernelFacts) {
      return mapKernelFactsToDraco(input, kernelFacts, this.largeRowThreshold, this.highCardinalityThreshold);
    }
    return minimalDracoFacts(input, this.largeRowThreshold, this.highCardinalityThreshold);
  }

  /** {@link FactProvider} view of this AtlasCore for Draco wiring. */
  asFactProvider(): FactProvider {
    return { facts: (input) => this.dracoFacts(input) };
  }

  private get largeRowThreshold(): number {
    return 500;
  }

  private get highCardinalityThreshold(): number {
    return 12;
  }

  // --- Serialization ------------------------------------------------------

  toState(): AtlasCoreState {
    return {
      datasetVersion: this._datasetVersion,
      datasetFingerprint: this.datasetFingerprint,
      originalDataset: this._original?.toJSON?.() ?? null,
      currentDataset: this._current?.toJSON?.() ?? null,
      datasetSpace: this.datasetSpace?.toJSON() ?? null,
      analysisResults: this._results.slice(),
      eventLedger: this._ledger.slice(),
      analysisHistory: this._history.toJSON(),
      activeRecommendation: this._activeRecommendation,
      decisionHistory: this._decisionHistory.slice(),
    };
  }

  restoreState(state: AtlasCoreState): void {
    this._original = state.originalDataset ? Dataset.fromJSON(state.originalDataset) : null;
    this._current = state.currentDataset ? Dataset.fromJSON(state.currentDataset) : this._original?.clone?.() ?? null;
    this._datasetVersion = state.datasetVersion ?? this._datasetVersion;
    this._history = AnalysisHistory.fromJSON(state.analysisHistory ?? { index: -1, maxFrames: 50, frames: [] });
    this._results = (state.analysisResults ?? []).slice();
    this._ledger = (state.eventLedger ?? []).slice();
    this._activeRecommendation = state.activeRecommendation ?? null;
    this._decisionHistory = (state.decisionHistory ?? []).slice();
    this._resultCounter = this._results.length;
    this._eventCounter = this._ledger.length;
    this._datasetSpace = null;
    this._datasetSpaceSource = null;
    // The persisted datasetSpace is kept for audit; the live space is derived
    // lazily from _current (see `datasetSpace` getter). Eagerly rebuilding from
    // the persisted snapshot would throw on tamper — see NemosyneSession tests.
    this._invalidateHandle();
  }

  dispose(): void {
    this._invalidateHandle();
  }

  // --- Internal helpers ---------------------------------------------------

  private _ensureHandle(): number {
    if (this._currentHandle !== 0) return this._currentHandle;
    if (!this.isReady() || !this._current) return 0;
    try {
      this._currentHandle = this._kernel!.loadDatasetJson(this._current.toJSON());
    } catch {
      this._currentHandle = 0;
    }
    return this._currentHandle;
  }

  /** Destroy the current handle and reset to 0 (rebuilds lazily). */
  private _invalidateHandle(): void {
    if (this._currentHandle !== 0 && this._kernel) {
      try {
        this._kernel.destroyDataset(this._currentHandle);
      } catch {
        // ignore — best-effort cleanup
      }
    }
    this._currentHandle = 0;
  }

  /** Adopt `outHandle` as the new current handle, destroying the previous. */
  private _adoptHandle(outHandle: number): void {
    if (this._currentHandle !== 0 && this._currentHandle !== outHandle && this._kernel) {
      try {
        this._kernel.destroyDataset(this._currentHandle);
      } catch {
        // ignore
      }
    }
    this._currentHandle = outHandle;
  }

  private _resetState(): void {
    this._results = [];
    this._ledger = [];
    this._history.clear();
    this._activeRecommendation = null;
    this._decisionHistory = [];
    this._resultCounter = 0;
    this._eventCounter = 0;
  }

  private _buildResultId(fp: string, spec: AnalysisSpec): string {
    this._resultCounter += 1;
    return `${fp}:${this._datasetVersion}:${spec.operation.op}:${this._resultCounter}`;
  }

  private _appendEvent(
    kind: ResearchEvent['kind'],
    command: ResearchEvent['command'],
    result: AnalysisResult | undefined,
  ): void {
    this._eventCounter += 1;
    const stateHash = this.datasetSpace?.fingerprint ?? '';
    const event: ResearchEvent = {
      eventId: `${this._sessionId}:${this._eventCounter}`,
      sessionId: this._sessionId,
      timestamp: now(),
      kind,
      command,
      result,
      datasetVersion: this._datasetVersion,
      datasetFingerprint: this.datasetFingerprint ?? '',
      stateHash,
    };
    this._ledger.push(event);
  }
}