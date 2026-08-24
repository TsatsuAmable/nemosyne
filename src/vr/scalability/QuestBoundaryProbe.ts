import { WorldTopics } from '../../utils/EventBus.ts';
import {
  call as runtimeCall,
  isReady as runtimeIsReady,
  memory as runtimeMemory,
} from '../../wasm/RuntimeBridge.ts';
import { computeFrameStats, type StepFrameStats } from './LoadTestThresholds.ts';
import {
  QuestVisibilityTracker,
  captureQuestRuntimeEnvironment,
  type QuestRuntimeEnvironment,
  type QuestVisibilityTelemetry,
} from './QuestTelemetry.ts';

export type QuestBoundaryPhase =
  | 'IDLE'
  | 'ALLOCATING'
  | 'BUILDING'
  | 'COPYING'
  | 'INGESTING'
  | 'FINGERPRINTING'
  | 'PROFILING'
  | 'SCANNING_COLD'
  | 'SCANNING_WARM'
  | 'CLEANUP'
  | 'FINALIZING'
  | 'COMPLETE';

export interface QuestBoundaryScenario {
  rows: number;
  primitiveColumns: number;
  categoricalCardinality: number;
  buildChunkRows: number;
}

export const QUEST_3S_10M_BOUNDARY_SCENARIO: QuestBoundaryScenario = {
  rows: 10_000_000,
  primitiveColumns: 3,
  categoricalCardinality: 32,
  buildChunkRows: 65_536,
};

export interface QuestBoundaryRuntime {
  isReady(): boolean;
  memory(): WebAssembly.Memory;
  call(name: string, ...args: unknown[]): unknown;
}

export interface QuestBoundaryEngineLike {
  renderer: {
    xr: { getSession(): unknown };
    getContext?: () => unknown;
  };
}

export interface QuestBoundaryEventBusLike {
  emit(topic: string, payload?: unknown): void;
}

export interface QuestBoundaryProgress {
  phase: QuestBoundaryPhase;
  progressPercent: number;
  completedRows: number;
  totalRows: number;
}

export interface QuestBoundarySummary {
  version: '1';
  profileName: 'quest-3s-rust-boundary-10m';
  runId: string;
  recordedAt: number;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  xrActive: boolean;
  device: QuestRuntimeEnvironment;
  visibility: QuestVisibilityTelemetry;
  scenario: QuestBoundaryScenario & { payloadBytes: number };
  outcome: {
    status: 'completed' | 'failed' | 'aborted';
    failurePhase: QuestBoundaryPhase | null;
    errorName: string | null;
    errorMessage: string | null;
  };
  timings: {
    payloadBuildMs: number | null;
    hostAllocationAndCopyMs: number | null;
    rustLoadMs: number | null;
    fingerprintMs: number | null;
    structureProfileMs: number | null;
    structureProfileWriteDecodeMs: number | null;
    coldBorrowedScanMs: number | null;
    warmBorrowedScanMs: number | null;
  };
  memory: {
    jsHeapStartBytes: number | null;
    jsHeapPeakBytes: number | null;
    jsHeapEndBytes: number | null;
    wasmBaselineBytes: number;
    wasmAfterInputAllocationBytes: number | null;
    wasmAfterLoadBytes: number | null;
    wasmAfterDestroyBytes: number | null;
    retainedWasmGrowthBytes: number | null;
  };
  evidence: {
    fingerprint: string | null;
    fingerprintTransferBytes: number | null;
    structureProfileTransferBytes: number | null;
    structureProfileRowCount: number | null;
    rowMaterialisations: number | null;
    coldChecksum: number | null;
    warmChecksum: number | null;
    checksumParity: boolean | null;
  };
  frameCadence: StepFrameStats;
  maximumFrameGapMs: number | null;
  qualification: {
    evidencePathAvailableAt10m: boolean;
    deviceQualifiedAt10m: false;
    promotionBlockedByAudits: true;
    status: 'MEASURED_AWAITING_AUDITS' | 'MEASUREMENT_INCOMPLETE';
  };
  collection: {
    mode: 'bounded-on-device-aggregates';
    rawFrameTraceIncluded: false;
    datasetRowsIncluded: false;
    cameraPosesIncluded: false;
    temperatureSensorAvailable: false;
    syntheticFixtureOnly: true;
  };
}

interface FixtureLayout {
  totalBytes: number;
  primitive: Array<{ valuesOffset: number; validityOffset: number }>;
  categorical: { codesOffset: number; validityOffset: number };
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const defaultRuntime: QuestBoundaryRuntime = {
  isReady: runtimeIsReady,
  memory: runtimeMemory,
  call: runtimeCall,
};

function heapUsed(): number | null {
  const value = (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory
    ?.usedJSHeapSize;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function writeString(bytes: Uint8Array, view: DataView, offset: number, value: string): number {
  const encoded = encoder.encode(value);
  view.setUint16(offset, encoded.length, true);
  bytes.set(encoded, offset + 2);
  return offset + 2 + encoded.length;
}

function fixtureLayout(scenario: QuestBoundaryScenario): FixtureLayout {
  let offset = 12;
  const primitive: FixtureLayout['primitive'] = [];
  for (let column = 0; column < scenario.primitiveColumns; column += 1) {
    offset += 1 + 2 + encoder.encode(`p${column}`).length;
    const valuesOffset = offset;
    offset += scenario.rows * 8;
    const validityOffset = offset;
    offset += scenario.rows;
    primitive.push({ valuesOffset, validityOffset });
  }
  offset += 1 + 2 + encoder.encode('cohort').length + 4;
  for (let category = 0; category < scenario.categoricalCardinality; category += 1) {
    offset += 2 + encoder.encode(`c${category}`).length;
  }
  const codesOffset = offset;
  offset += scenario.rows * 4;
  const validityOffset = offset;
  offset += scenario.rows;
  return { totalBytes: offset, primitive, categorical: { codesOffset, validityOffset } };
}

function initializeFixture(
  bytes: Uint8Array,
  scenario: QuestBoundaryScenario,
  layout: FixtureLayout
): void {
  const view = new DataView(bytes.buffer);
  bytes.set(encoder.encode('NTC1'), 0);
  view.setUint32(4, scenario.rows, true);
  view.setUint32(8, scenario.primitiveColumns + 1, true);
  let offset = 12;
  for (let column = 0; column < scenario.primitiveColumns; column += 1) {
    bytes[offset] = column === scenario.primitiveColumns - 1 ? 2 : 1;
    offset = writeString(bytes, view, offset + 1, `p${column}`);
    offset = layout.primitive[column].validityOffset + scenario.rows;
  }
  bytes[offset] = 3;
  offset = writeString(bytes, view, offset + 1, 'cohort');
  view.setUint32(offset, scenario.categoricalCardinality, true);
  offset += 4;
  for (let category = 0; category < scenario.categoricalCardinality; category += 1) {
    offset = writeString(bytes, view, offset, `c${category}`);
  }
}

function finiteMaximum(values: Array<number | null>): number | null {
  const finite = values.filter(
    (value): value is number => value !== null && Number.isFinite(value)
  );
  return finite.length > 0 ? Math.max(...finite) : null;
}

export function hasCompleteQuest10mBoundaryEvidence(
  scenarioRows: number,
  outcomeStatus: QuestBoundarySummary['outcome']['status'],
  profileRowCount: number | null,
  rowMaterialisations: number | null,
  checksumParity: boolean | null
): boolean {
  return (
    scenarioRows === 10_000_000 &&
    outcomeStatus === 'completed' &&
    profileRowCount === 10_000_000 &&
    rowMaterialisations === 0 &&
    checksumParity === true
  );
}

export class QuestBoundaryProbe {
  phase: QuestBoundaryPhase = 'IDLE';

  private readonly _runtime: QuestBoundaryRuntime;
  private readonly _scenario: QuestBoundaryScenario;
  private _layout: FixtureLayout | null = null;
  private _payload: Uint8Array | null = null;
  private _payloadView: DataView | null = null;
  private _buildColumn = 0;
  private _buildRow = 0;
  private _inputPtr = 0;
  private _handle = 0;
  private _startedAt = 0;
  private _finishedAt = 0;
  private _lastFrameAt = 0;
  private _buildStartedAt = 0;
  private _frameIntervalsMs: number[] = [];
  private _heapSamples: number[] = [];
  private _jsHeapStart: number | null = null;
  private _wasmBaselineBytes = 0;
  private _wasmAfterInputAllocationBytes: number | null = null;
  private _wasmAfterLoadBytes: number | null = null;
  private _wasmAfterDestroyBytes: number | null = null;
  private _rowMaterialisationsBefore: number | null = null;
  private _device: QuestRuntimeEnvironment | null = null;
  private _visibility: QuestVisibilityTracker | null = null;
  private _abortRequested = false;
  private _outcomeStatus: QuestBoundarySummary['outcome']['status'] = 'completed';
  private _failurePhase: QuestBoundaryPhase | null = null;
  private _errorName: string | null = null;
  private _errorMessage: string | null = null;
  private _timings: QuestBoundarySummary['timings'] = this._emptyTimings();
  private _evidence: QuestBoundarySummary['evidence'] = this._emptyEvidence();
  private _lastSummary: QuestBoundarySummary | null = null;
  private _runId = '';
  private _lastProgressPhase: QuestBoundaryPhase | null = null;
  private _lastProgressPercent = -1;

  constructor(
    private readonly _engine: QuestBoundaryEngineLike,
    private readonly _eventBus: QuestBoundaryEventBusLike,
    options: { runtime?: QuestBoundaryRuntime; scenario?: QuestBoundaryScenario } = {}
  ) {
    this._runtime = options.runtime ?? defaultRuntime;
    this._scenario = options.scenario ?? QUEST_3S_10M_BOUNDARY_SCENARIO;
  }

  get running(): boolean {
    return this.phase !== 'IDLE' && this.phase !== 'COMPLETE';
  }

  get lastSummary(): QuestBoundarySummary | null {
    return this._lastSummary;
  }

  run(): boolean {
    if (this.running) return false;
    this._reset();
    this._startedAt = performance.now();
    this._lastFrameAt = this._startedAt;
    this._runId =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `quest-boundary-${Date.now()}-${Math.round(this._startedAt)}`;
    this._device = captureQuestRuntimeEnvironment(this._engine, 'META_QUEST_3S');
    this._visibility = new QuestVisibilityTracker(this._engine.renderer.xr.getSession());
    this._jsHeapStart = heapUsed();
    if (this._jsHeapStart !== null) this._heapSamples.push(this._jsHeapStart);
    const runtimeReady = this._runtime.isReady();
    if (runtimeReady) {
      this._wasmBaselineBytes = this._runtime.memory().buffer.byteLength;
      this._rowMaterialisationsBefore = Number(
        this._runtime.call('compatibility_row_materialisation_count') ?? 0
      );
    }
    if (!this._device.xr.active) {
      this._fail(
        new Error('Quest 10M boundary qualification requires an active immersive XR session')
      );
      return false;
    }
    if (!runtimeReady) {
      this._fail(new Error('Rust/WASM analytical kernel is not ready'));
      return false;
    }
    this.phase = 'ALLOCATING';
    this._eventBus.emit(WorldTopics.QUEST_BOUNDARY_START, {
      profileName: 'quest-3s-rust-boundary-10m',
      runId: this._runId,
      rows: this._scenario.rows,
    });
    this._emitProgress(0);
    return true;
  }

  stop(): void {
    if (this.running) this._abortRequested = true;
  }

  update(): void {
    if (!this.running) return;
    const now = performance.now();
    const interval = now - this._lastFrameAt;
    if (interval > 0 && Number.isFinite(interval)) this._frameIntervalsMs.push(interval);
    this._lastFrameAt = now;
    const heap = heapUsed();
    if (heap !== null) this._heapSamples.push(heap);
    if (this._abortRequested) {
      this._outcomeStatus = 'aborted';
      this._failurePhase = this.phase;
      this._cleanupResources();
      this._finish();
      return;
    }
    try {
      switch (this.phase) {
        case 'ALLOCATING':
          this._allocate();
          break;
        case 'BUILDING':
          this._buildNextChunk();
          break;
        case 'COPYING':
          this._copyToWasm();
          break;
        case 'INGESTING':
          this._ingest();
          break;
        case 'FINGERPRINTING':
          this._fingerprint();
          break;
        case 'PROFILING':
          this._profile();
          break;
        case 'SCANNING_COLD':
          this._scan(false);
          break;
        case 'SCANNING_WARM':
          this._scan(true);
          break;
        case 'CLEANUP':
          this._cleanupResources();
          this.phase = 'FINALIZING';
          this._emitProgress(100);
          break;
        case 'FINALIZING':
          this._finish();
          break;
        default:
          break;
      }
    } catch (error) {
      this._fail(error);
    }
  }

  private _allocate(): void {
    this._layout = fixtureLayout(this._scenario);
    this._payload = new Uint8Array(this._layout.totalBytes);
    this._payloadView = new DataView(this._payload.buffer);
    initializeFixture(this._payload, this._scenario, this._layout);
    this._buildStartedAt = performance.now();
    this.phase = 'BUILDING';
    this._emitProgress(0);
  }

  private _buildNextChunk(): void {
    const payload = this._payload;
    const layout = this._layout;
    if (!payload || !layout) throw new Error('Typed fixture allocation is unavailable');
    const start = this._buildRow;
    const end = Math.min(this._scenario.rows, start + this._scenario.buildChunkRows);
    const view = this._payloadView;
    if (!view) throw new Error('Typed fixture view is unavailable');
    if (this._buildColumn < this._scenario.primitiveColumns) {
      const column = this._buildColumn;
      const offsets = layout.primitive[column];
      for (let row = start; row < end; row += 1) {
        const value =
          column === this._scenario.primitiveColumns - 1
            ? 1_700_000_000_000 + row * 1000
            : (row + 1) * (column + 1);
        view.setFloat64(offsets.valuesOffset + row * 8, value, true);
      }
      payload.fill(1, offsets.validityOffset + start, offsets.validityOffset + end);
    } else {
      for (let row = start; row < end; row += 1) {
        view.setUint32(
          layout.categorical.codesOffset + row * 4,
          row % this._scenario.categoricalCardinality,
          true
        );
      }
      payload.fill(
        1,
        layout.categorical.validityOffset + start,
        layout.categorical.validityOffset + end
      );
    }
    this._buildRow = end;
    if (end >= this._scenario.rows) {
      this._buildColumn += 1;
      this._buildRow = 0;
    }
    const totalColumns = this._scenario.primitiveColumns + 1;
    const completedRows = Math.min(
      this._scenario.rows * totalColumns,
      this._buildColumn * this._scenario.rows + this._buildRow
    );
    this._emitProgress((completedRows / (this._scenario.rows * totalColumns)) * 100);
    if (this._buildColumn >= totalColumns) {
      this._timings.payloadBuildMs = performance.now() - this._buildStartedAt;
      this.phase = 'COPYING';
      this._emitProgress(100);
    }
  }

  private _copyToWasm(): void {
    const payload = this._payload;
    if (!payload) throw new Error('Typed fixture payload is unavailable');
    const started = performance.now();
    this._inputPtr = Number(this._runtime.call('host_buffer_alloc', payload.byteLength) ?? 0);
    if (this._inputPtr === 0) throw new Error('WASM host buffer allocation failed');
    new Uint8Array(this._runtime.memory().buffer, this._inputPtr, payload.byteLength).set(payload);
    this._timings.hostAllocationAndCopyMs = performance.now() - started;
    this._wasmAfterInputAllocationBytes = this._runtime.memory().buffer.byteLength;
    this.phase = 'INGESTING';
    this._emitProgress(100);
  }

  private _ingest(): void {
    const payloadLength = this._payload?.byteLength ?? 0;
    const started = performance.now();
    try {
      this._handle = Number(
        this._runtime.call('data_load_typed_columns', this._inputPtr, payloadLength) ?? 0
      );
      this._timings.rustLoadMs = performance.now() - started;
      this._wasmAfterLoadBytes = this._runtime.memory().buffer.byteLength;
    } finally {
      if (this._inputPtr !== 0) {
        this._runtime.call('host_buffer_dealloc', this._inputPtr, payloadLength);
        this._inputPtr = 0;
      }
      this._payload = null;
      this._payloadView = null;
    }
    if (this._handle === 0) throw new Error('Rust rejected the typed 10M fixture');
    this.phase = 'FINGERPRINTING';
    this._emitProgress(100);
  }

  private _fingerprint(): void {
    const started = performance.now();
    const required = Number(
      this._runtime.call('data_typed_dataset_fingerprint', this._handle, 0, 0) ?? 0
    );
    if (required === 0) throw new Error('Canonical typed fingerprint is unavailable');
    const pointer = Number(this._runtime.call('host_buffer_alloc', required) ?? 0);
    if (pointer === 0) throw new Error('WASM fingerprint output allocation failed');
    try {
      const written = Number(
        this._runtime.call('data_typed_dataset_fingerprint', this._handle, pointer, required) ?? 0
      );
      if (written === 0 || written > required)
        throw new Error('Canonical typed fingerprint write failed');
      this._evidence.fingerprint = decoder.decode(
        new Uint8Array(this._runtime.memory().buffer, pointer, written).slice()
      );
      this._evidence.fingerprintTransferBytes = written;
    } finally {
      this._runtime.call('host_buffer_dealloc', pointer, required);
    }
    this._timings.fingerprintMs = performance.now() - started;
    this.phase = 'PROFILING';
    this._emitProgress(100);
  }

  private _profile(): void {
    const started = performance.now();
    const required = Number(
      this._runtime.call('data_compute_structure_profile', this._handle, 0, 0) ?? 0
    );
    this._timings.structureProfileMs = performance.now() - started;
    if (required === 0) throw new Error('Columnar DatasetStructureProfile is unavailable');
    const pointer = Number(this._runtime.call('host_buffer_alloc', required) ?? 0);
    if (pointer === 0) throw new Error('WASM structure-profile output allocation failed');
    const writeStarted = performance.now();
    try {
      const written = Number(
        this._runtime.call('data_compute_structure_profile', this._handle, pointer, required) ?? 0
      );
      if (written === 0 || written > required)
        throw new Error('DatasetStructureProfile write failed');
      const profile = JSON.parse(
        decoder.decode(new Uint8Array(this._runtime.memory().buffer, pointer, written).slice())
      ) as { rowCount?: unknown };
      if (profile.rowCount !== this._scenario.rows) {
        throw new Error(
          `DatasetStructureProfile row count ${String(profile.rowCount)} is not ${this._scenario.rows}`
        );
      }
      this._evidence.structureProfileTransferBytes = written;
      this._evidence.structureProfileRowCount = profile.rowCount;
    } finally {
      this._runtime.call('host_buffer_dealloc', pointer, required);
    }
    this._timings.structureProfileWriteDecodeMs = performance.now() - writeStarted;
    if (this._rowMaterialisationsBefore !== null) {
      this._evidence.rowMaterialisations =
        Number(this._runtime.call('compatibility_row_materialisation_count') ?? 0) -
        this._rowMaterialisationsBefore;
    }
    this.phase = 'SCANNING_COLD';
    this._emitProgress(100);
  }

  private _scan(warm: boolean): void {
    const started = performance.now();
    let checksum = 0;
    for (let column = 0; column < this._scenario.primitiveColumns; column += 1) {
      const length = Number(
        this._runtime.call('typed_primitive_column_len', this._handle, column) ?? 0
      );
      if (length !== this._scenario.rows) {
        throw new Error(
          `Primitive column ${column} length ${length} is not ${this._scenario.rows}`
        );
      }
      const valuesPointer = Number(
        this._runtime.call('typed_primitive_values_ptr', this._handle, column) ?? 0
      );
      const validityPointer = Number(
        this._runtime.call('typed_primitive_validity_ptr', this._handle, column) ?? 0
      );
      if (valuesPointer === 0 || validityPointer === 0) {
        throw new Error(`Primitive column ${column} returned an invalid borrowed view`);
      }
      const values = new Float64Array(this._runtime.memory().buffer, valuesPointer, length);
      const validity = new Uint8Array(this._runtime.memory().buffer, validityPointer, length);
      for (let row = 0; row < length; row += 1) {
        if (validity[row]) checksum += values[row];
      }
    }
    const elapsed = performance.now() - started;
    if (warm) {
      this._timings.warmBorrowedScanMs = elapsed;
      this._evidence.warmChecksum = checksum;
      this._evidence.checksumParity = checksum === this._evidence.coldChecksum;
      this.phase = 'CLEANUP';
      this._emitProgress(100);
    } else {
      this._timings.coldBorrowedScanMs = elapsed;
      this._evidence.coldChecksum = checksum;
      this.phase = 'SCANNING_WARM';
      this._emitProgress(100);
    }
  }

  private _cleanupResources(): void {
    if (this._inputPtr !== 0) {
      const length = this._payload?.byteLength ?? 0;
      this._runtime.call('host_buffer_dealloc', this._inputPtr, length);
      this._inputPtr = 0;
    }
    if (this._handle !== 0) {
      this._runtime.call('typed_dataset_destroy', this._handle);
      this._handle = 0;
    }
    this._payload = null;
    this._payloadView = null;
    if (this._runtime.isReady() && this._rowMaterialisationsBefore !== null) {
      this._evidence.rowMaterialisations =
        Number(this._runtime.call('compatibility_row_materialisation_count') ?? 0) -
        this._rowMaterialisationsBefore;
    }
    this._wasmAfterDestroyBytes = this._runtime.isReady()
      ? this._runtime.memory().buffer.byteLength
      : null;
  }

  private _fail(error: unknown): void {
    this._outcomeStatus = 'failed';
    this._failurePhase = this.phase;
    this._errorName = error instanceof Error ? error.name : 'Error';
    this._errorMessage = error instanceof Error ? error.message : String(error);
    try {
      this._cleanupResources();
    } catch {
      this._payload = null;
      this._inputPtr = 0;
      this._handle = 0;
    }
    this._finish();
  }

  private _finish(): void {
    this._finishedAt = performance.now();
    const jsHeapEnd = heapUsed();
    if (jsHeapEnd !== null) this._heapSamples.push(jsHeapEnd);
    const visibility = this._visibility?.finish() ?? {
      interruptionCount: 0,
      interruptedDurationMs: 0,
      finalVisibilityState: null,
    };
    this._visibility = null;
    const layout = this._layout ?? fixtureLayout(this._scenario);
    const completed = hasCompleteQuest10mBoundaryEvidence(
      this._scenario.rows,
      this._outcomeStatus,
      this._evidence.structureProfileRowCount,
      this._evidence.rowMaterialisations,
      this._evidence.checksumParity
    );
    const summary: QuestBoundarySummary = {
      version: '1',
      profileName: 'quest-3s-rust-boundary-10m',
      runId: this._runId,
      recordedAt: Date.now(),
      startedAt: this._startedAt,
      finishedAt: this._finishedAt,
      durationMs: this._finishedAt - this._startedAt,
      xrActive: this._device?.xr.active ?? false,
      device: this._device ?? captureQuestRuntimeEnvironment(this._engine, 'META_QUEST_3S'),
      visibility,
      scenario: { ...this._scenario, payloadBytes: layout.totalBytes },
      outcome: {
        status: this._outcomeStatus,
        failurePhase: this._failurePhase,
        errorName: this._errorName,
        errorMessage: this._errorMessage,
      },
      timings: { ...this._timings },
      memory: {
        jsHeapStartBytes: this._jsHeapStart,
        jsHeapPeakBytes: finiteMaximum(this._heapSamples),
        jsHeapEndBytes: jsHeapEnd,
        wasmBaselineBytes: this._wasmBaselineBytes,
        wasmAfterInputAllocationBytes: this._wasmAfterInputAllocationBytes,
        wasmAfterLoadBytes: this._wasmAfterLoadBytes,
        wasmAfterDestroyBytes: this._wasmAfterDestroyBytes,
        retainedWasmGrowthBytes:
          this._wasmAfterDestroyBytes === null
            ? null
            : this._wasmAfterDestroyBytes - this._wasmBaselineBytes,
      },
      evidence: { ...this._evidence },
      frameCadence: computeFrameStats(this._frameIntervalsMs),
      maximumFrameGapMs: finiteMaximum(this._frameIntervalsMs),
      qualification: {
        evidencePathAvailableAt10m: completed,
        deviceQualifiedAt10m: false,
        promotionBlockedByAudits: true,
        status: completed ? 'MEASURED_AWAITING_AUDITS' : 'MEASUREMENT_INCOMPLETE',
      },
      collection: {
        mode: 'bounded-on-device-aggregates',
        rawFrameTraceIncluded: false,
        datasetRowsIncluded: false,
        cameraPosesIncluded: false,
        temperatureSensorAvailable: false,
        syntheticFixtureOnly: true,
      },
    };
    this._lastSummary = summary;
    this.phase = 'COMPLETE';
    this._eventBus.emit(WorldTopics.QUEST_BOUNDARY_COMPLETE, summary);
  }

  private _emitProgress(progressPercent: number): void {
    const completedRows = Math.min(
      this._scenario.rows * (this._scenario.primitiveColumns + 1),
      this._buildColumn * this._scenario.rows + this._buildRow
    );
    const boundedPercent = Math.max(0, Math.min(100, progressPercent));
    if (
      this.phase === this._lastProgressPhase &&
      boundedPercent < 100 &&
      boundedPercent - this._lastProgressPercent < 1
    ) {
      return;
    }
    this._lastProgressPhase = this.phase;
    this._lastProgressPercent = boundedPercent;
    const progress: QuestBoundaryProgress = {
      phase: this.phase,
      progressPercent: boundedPercent,
      completedRows,
      totalRows: this._scenario.rows * (this._scenario.primitiveColumns + 1),
    };
    this._eventBus.emit(WorldTopics.QUEST_BOUNDARY_PROGRESS, progress);
  }

  private _reset(): void {
    this.phase = 'IDLE';
    this._layout = null;
    this._payload = null;
    this._payloadView = null;
    this._buildColumn = 0;
    this._buildRow = 0;
    this._inputPtr = 0;
    this._handle = 0;
    this._startedAt = 0;
    this._finishedAt = 0;
    this._lastFrameAt = 0;
    this._buildStartedAt = 0;
    this._frameIntervalsMs = [];
    this._heapSamples = [];
    this._jsHeapStart = null;
    this._wasmBaselineBytes = 0;
    this._wasmAfterInputAllocationBytes = null;
    this._wasmAfterLoadBytes = null;
    this._wasmAfterDestroyBytes = null;
    this._rowMaterialisationsBefore = null;
    this._device = null;
    this._visibility = null;
    this._abortRequested = false;
    this._outcomeStatus = 'completed';
    this._failurePhase = null;
    this._errorName = null;
    this._errorMessage = null;
    this._timings = this._emptyTimings();
    this._evidence = this._emptyEvidence();
    this._lastSummary = null;
    this._runId = '';
    this._lastProgressPhase = null;
    this._lastProgressPercent = -1;
  }

  private _emptyTimings(): QuestBoundarySummary['timings'] {
    return {
      payloadBuildMs: null,
      hostAllocationAndCopyMs: null,
      rustLoadMs: null,
      fingerprintMs: null,
      structureProfileMs: null,
      structureProfileWriteDecodeMs: null,
      coldBorrowedScanMs: null,
      warmBorrowedScanMs: null,
    };
  }

  private _emptyEvidence(): QuestBoundarySummary['evidence'] {
    return {
      fingerprint: null,
      fingerprintTransferBytes: null,
      structureProfileTransferBytes: null,
      structureProfileRowCount: null,
      rowMaterialisations: null,
      coldChecksum: null,
      warmChecksum: null,
      checksumParity: null,
    };
  }
}
