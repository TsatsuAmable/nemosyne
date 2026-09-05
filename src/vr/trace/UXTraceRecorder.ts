/**
 * UX trace recorder for on-device interaction debugging and validation evidence.
 *
 * Development may flush records to the dev-server endpoint. Production
 * composition replaces that transport and keeps records in a bounded local
 * buffer for explicit user export only.
 */

import * as THREE from 'three';
import { canonicalSha256Hex } from '../../security/CryptoHash.ts';
import type { HandLike, PanelLike } from '../coordinators/types.ts';
import type { SelectionDispatchInfo } from '../input/SelectionDispatcher.ts';
import type { SystemGestureTraceInfo } from '../input/SystemGestureDetector.ts';
import {
  WorldSpatialContext,
  type WorldLandmarkTarget,
  type WorldSpatialSnapshot,
} from './WorldSpatialContext.ts';

export const UX_TRACE_EXPORT_SCHEMA_VERSION = 1 as const;
export const UX_TRACE_INTEGRITY_ALGORITHM = 'NEMOSYNE_CANONICAL_JSON_SHA256_V1' as const;

export type UXTraceHandPinchGating =
  | 'select'
  | 'select-release'
  | 'passive-release'
  | 'wheel-toggle'
  | 'wheel-release'
  | 'system-suppressed';

export interface SessionManifestInfo {
  sid?: string;
  nemosyneSessionId?: string;
  /** Quest-validation session label/id (launcher-generated), when present. */
  validationSessionLabel?: string;
  validationSessionId?: string;
  datasetName?: string;
  datasetFingerprint?: string;
  datasetVersion?: string;
  topology?: string;
  buildHash?: string;
  wasmCapabilities?: number;
  ua?: string;
  startedAt?: string;
  sampleHz?: number;
}

export interface PerfTraceInfo {
  id?: string;
  severity: 'warning' | 'critical' | 'nominal';
  value?: number;
  budget?: number;
  frameMs: number;
  lodScaleFactor?: number;
  throttleCount?: number;
}

export interface FrictionTraceInfo {
  pattern: string;
  severity: 'mild' | 'moderate' | 'severe';
  score: number;
  compactTrail?: string[];
}

export interface HandsLifecycleTraceInfo {
  phase: 'connected' | 'joints-valid' | 'fallback' | 'lost';
  hand: string;
  source?: string;
  jointCount?: number;
  ttfrMs?: number;
}

export interface UXTraceExportEnvelopeV1 {
  schemaVersion: typeof UX_TRACE_EXPORT_SCHEMA_VERSION;
  createdAt: string;
  exportedAt: string;
  sid: string;
  recordCount: number;
  droppedCount: number;
  firstSeq: number | null;
  lastSeq: number | null;
  traceOpen: boolean;
  endpointDead: boolean;
  buildHash?: string;
  validationSession?: { label: string; id: string };
  integrity: {
    algorithm: typeof UX_TRACE_INTEGRITY_ALGORITHM;
    recordsSha256: string;
  };
  records: TraceRecord[];
}

type TraceLifecycleEvent =
  | 'trace-start'
  | 'consent-enabled'
  | 'consent-disabled'
  | 'dataset-boundary'
  | 'buffer-drop'
  | 'export-requested'
  | 'trace-end';

interface TraceEngineDeps {
  camera?: THREE.Camera;
  headWorldPos?: THREE.Vector3;
  addUpdatable(obj: unknown): void;
  removeUpdatable(obj: unknown): void;
  input: {
    hands: HandLike[];
    panels: PanelLike[];
    interactables: Array<{ mesh: THREE.Object3D; data?: unknown }>;
    pointers?: { getBestPointerRay(): THREE.Ray | null };
    raycastScene?(raycaster: THREE.Raycaster, options?: { ignoreSuppression?: boolean }): {
      entry: { mesh: THREE.Object3D; data?: unknown };
      distance: number;
    } | null;
  };
}

export interface UXTraceRecorderOptions {
  engine: TraceEngineDeps;
  eventBus?: { on(topic: string, handler: (payload?: unknown) => void): () => void } | null;
  getUIState?: () => Record<string, unknown>;
  extraGazeTargets?: () => THREE.Object3D[];
  worldLandmarks?: WorldLandmarkTarget[];
  getWorldContext?: () => WorldSpatialContext;
  sampleHz?: number;
  flushMs?: number;
  endpoint?: string;
  /**
   * Explicit recording switch. Defaults to true for the historical dev path.
   * Production composition supplies false until explicit opt-in.
   */
  enabled?: boolean;
  now?: () => number;
  fetchImpl?: (
    url: string,
    init: { method: string; headers: Record<string, string>; body: string }
  ) => Promise<{ ok: boolean; status: number }>;
}

interface TraceRecord {
  t: number;
  sid: string;
  seq: number;
  type: string;
  [key: string]: unknown;
}

interface TraceRecordBase extends Partial<TraceRecord> {
  [key: string]: unknown;
}

interface TargetInfo {
  target: string | null;
  kind: 'panel' | 'scene' | 'hud' | null;
  dist: number | null;
}

interface TraceContext {
  head: { p: number[]; yaw: number; pitch: number };
  gaze: TargetInfo;
  ptr: TargetInfo & { hand: string | null; driftDeg: number | null };
  hands: Array<{ h: string; pinched: boolean; d: number | null; y: number | null; pose: boolean }>;
  ui: Record<string, unknown>;
  world: WorldSpatialSnapshot;
}

const MAX_BUFFER = 1000;

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 6);
}

export class UXTraceRecorder {
  private _engine: TraceEngineDeps;
  private _getUIState?: () => Record<string, unknown>;
  private _extraGazeTargets?: () => THREE.Object3D[];
  private _worldSpatialContext: WorldSpatialContext;
  private _sampleInterval: number;
  private _flushInterval: number;
  private _endpoint: string;
  private _fetch: NonNullable<UXTraceRecorderOptions['fetchImpl']>;

  private _sessionId: string;
  private _createdAt: string;
  private _seq = 0;
  private _time = 0;
  private _frame = 0;
  private _buffer: TraceRecord[] = [];
  private _droppedCount = 0;
  /** Explicit off-switch (setting / fatal errors). Stops all sampling work. */
  private _disabled = false;
  /**
   * Dev-server endpoint confirmed absent (HTTP 404, e.g. production build).
   * Flushing stops, but recording continues into the bounded in-memory
   * buffer so a user-initiated export still captures the session.
   */
  private _endpointDead = false;
  private _endpointDeadWarned = false;
  private _disposed = false;
  private _traceOpen = false;
  private _errorCount = 0;
  private _lastSampleAt = -Infinity;
  private _lastFlushAt = 0;
  private _flushing = false;
  private _unsubs: Array<() => void> = [];
  private _lastTourKey: string | null = null;
  private _lastDatasetBoundaryKey: string | null = null;
  private _metaEmitted = false;
  private _warnedSections = new Set<string>();

  private _raycaster = new THREE.Raycaster();
  private _gazeRay = new THREE.Ray();
  private _headPos = new THREE.Vector3();
  private _headDir = new THREE.Vector3();
  private _ctxCacheFrame = -1;
  private _ctxCache: TraceContext | null = null;
  private _uiCacheFrame = -1;
  private _uiCache: Record<string, unknown> = {};

  private _updatable = { update: (_delta: number, time: number) => this.update(time) };

  constructor(options: UXTraceRecorderOptions) {
    this._engine = options.engine;
    this._getUIState = options.getUIState;
    this._extraGazeTargets = options.extraGazeTargets;
    this._worldSpatialContext =
      options.getWorldContext?.() ?? new WorldSpatialContext(options.worldLandmarks);
    this._sampleInterval = 1 / Math.max(0.5, options.sampleHz ?? 5);
    this._flushInterval = Math.max(0.25, (options.flushMs ?? 1500) / 1000);
    this._endpoint = options.endpoint ?? '/__ux-trace';
    this._fetch =
      options.fetchImpl ??
      ((url, init) =>
        fetch(url, init as RequestInit) as unknown as Promise<{ ok: boolean; status: number }>);

    this._sessionId = crypto.randomUUID();
    this._createdAt = new Date().toISOString();
    this._disabled = !(options.enabled ?? true);

    if (!this._disabled) this._openTrace('initial-enabled');

    if (options.eventBus) {
      const bus = options.eventBus;
      this._unsubs.push(
        bus.on('gesture:recognized', (payload) => {
          if (this._disabled || this._disposed) return;
          const p = payload as { name?: string; ctx?: Record<string, unknown> } | undefined;
          this._push({
            type: 'gesture',
            name: p?.name ?? 'unknown',
            confidence: typeof p?.ctx?.confidence === 'number' ? round(p.ctx.confidence, 3) : null,
            isMisfire: !!p?.ctx?.isMisfire,
            source: p?.ctx?.source === 'controller' ? 'controller' : 'hand',
            ctx: this._context(),
          });
        })
      );
      this._unsubs.push(
        bus.on('interaction', (payload) => {
          if (this._disabled || this._disposed) return;
          const p = payload as Record<string, unknown> | undefined;
          this._push({ type: 'interaction', payload: p ?? {}, ctx: this._context() });
        })
      );
    }

    this._engine.addUpdatable(this._updatable);
  }

  get sessionId(): string {
    return this._sessionId;
  }

  /**
   * Observable off-state: explicitly disabled OR endpoint confirmed absent.
   * Sampling work is gated on the explicit flag only, so an endpoint-dead
   * recorder keeps buffering in memory for user-initiated export.
   */
  get disabled(): boolean {
    return this._disabled || this._endpointDead;
  }

  /** True once the dev-server endpoint 404s (production builds). */
  get endpointDead(): boolean {
    return this._endpointDead;
  }

  /** Explicit recording switch state (ignores endpoint health). */
  get enabled(): boolean {
    return !this._disabled;
  }

  /** True once at least one record is buffered (lifecycle records count). */
  get hasRecords(): boolean {
    return this._buffer.length > 0;
  }

  /**
   * Runtime switch for the production-trace feature flag. Consent transitions
   * are bounded lifecycle evidence with no spatial/UI context. Once disabled,
   * no subsequent user/runtime observation is admitted.
   */
  setEnabled(value: boolean): void {
    if (this._disposed) return;
    const nextEnabled = !!value;
    if (nextEnabled === !this._disabled) return;

    if (nextEnabled) {
      this._disabled = false;
      this._emitLifecycle('consent-enabled');
      this._openTrace('consent-enabled');
      return;
    }

    this._emitLifecycle('consent-disabled');
    this._closeTrace('consent-withdrawn');
    this._disabled = true;
  }

  /**
   * Local-only snapshot of buffered records for user-initiated download.
   * Non-destructive; never transmits. Versioned metadata makes truncation,
   * misassociation and accidental record corruption detectable.
   */
  exportJson(): string {
    if (!this._disabled && !this._disposed) this._emitLifecycle('export-requested');

    // Normalize through JSON once before hashing so the digest covers exactly
    // the JSON-compatible records that are emitted in the envelope.
    const records = JSON.parse(JSON.stringify(this._buffer)) as TraceRecord[];
    const firstSeq = records.length > 0 ? records[0].seq : null;
    const lastSeq = records.length > 0 ? records[records.length - 1].seq : null;
    let latestManifest: TraceRecord | null = null;
    for (let i = records.length - 1; i >= 0; i -= 1) {
      if (records[i].type === 'session-manifest') {
        latestManifest = records[i];
        break;
      }
    }

    const validationSession =
      typeof latestManifest?.validationSessionLabel === 'string' &&
      typeof latestManifest?.validationSessionId === 'string'
        ? {
            label: latestManifest.validationSessionLabel,
            id: latestManifest.validationSessionId,
          }
        : undefined;
    const buildHash =
      typeof latestManifest?.buildHash === 'string' ? latestManifest.buildHash : undefined;

    const envelope: UXTraceExportEnvelopeV1 = {
      schemaVersion: UX_TRACE_EXPORT_SCHEMA_VERSION,
      createdAt: this._createdAt,
      exportedAt: new Date().toISOString(),
      sid: this._sessionId,
      recordCount: records.length,
      droppedCount: this._droppedCount,
      firstSeq,
      lastSeq,
      traceOpen: this._traceOpen,
      endpointDead: this._endpointDead,
      ...(buildHash ? { buildHash } : {}),
      ...(validationSession ? { validationSession } : {}),
      integrity: {
        algorithm: UX_TRACE_INTEGRITY_ALGORITHM,
        recordsSha256: canonicalSha256Hex(records),
      },
      records,
    };

    return JSON.stringify(envelope, null, 2);
  }

  get droppedCount(): number {
    return this._droppedCount;
  }

  update(time: number): void {
    if (this._disabled || this._disposed) return;
    try {
      this._update(time);
    } catch (err) {
      this._errorCount++;
      console.error('[UXTraceRecorder] update error:', err);
      if (this._errorCount > 10) this._disable('repeated update errors');
    }
  }

  private _update(time: number): void {
    this._time = time;
    this._frame++;
    this._ctxCache = null;
    this._ctxCacheFrame = -1;
    this._uiCacheFrame = -1;

    this._maybeEmitMeta();

    // Tour step changes are event-worthy even between context samples.
    const ui = this._uiState();
    const tour = ui.tour as { active?: boolean; step?: number; total?: number } | null | undefined;
    if (tour) {
      const key = `${tour.active ? 1 : 0}:${tour.step ?? 0}/${tour.total ?? 0}`;
      if (key !== this._lastTourKey) {
        if (this._lastTourKey !== null) {
          this._push({ type: 'tour', ...tour, ctx: this._context() });
        }
        this._lastTourKey = key;
      }
    }

    if (time - this._lastSampleAt >= this._sampleInterval) {
      this._lastSampleAt = time;
      this._push({ type: 'context', ctx: this._context() });
    }

    if (time - this._lastFlushAt >= this._flushInterval) {
      this._lastFlushAt = time;
      void this._flush();
    }
  }

  /** Pinch edge from the input router, stamped with the routing decision. */
  recordPinch(hand: HandLike, phase: 'start' | 'end', gating: UXTraceHandPinchGating): void {
    if (this._disabled) return;
    this._push({
      type: 'pinch',
      phase,
      gating,
      hand: hand.handedness ?? `#${hand.index ?? '?'}`,
      d: typeof hand.pinchDistance === 'number' ? round(hand.pinchDistance, 4) : null,
      ctx: this._context(),
    });
  }

  /** Selection dispatch outcome (hud / scene / callback-only / miss). */
  recordSelection(info: SelectionDispatchInfo): void {
    if (this._disabled) return;
    const pointer = info.pointer as HandLike | null;
    this._push({
      type: 'selection',
      hit: info.hudConsumed
        ? 'hud'
        : info.sceneMesh
          ? 'scene'
          : info.hadCallback
            ? 'callback-only'
            : 'none',
      target: this._describeMesh(info.sceneMesh, info.sceneData),
      pointer: pointer?.handedness ?? (pointer?.index != null ? `#${pointer.index}` : null),
      rayValid: typeof info.rayValid === 'boolean' ? info.rayValid : null,
      ctx: this._context(),
    });
  }

  /** System gesture (two-hand pinch / controller grips) fired or suppressed. */
  recordSystemGesture(info: SystemGestureTraceInfo): void {
    if (this._disabled) return;
    this._push({
      type: 'system',
      kind: info.kind,
      y0: typeof info.y0 === 'number' ? round(info.y0) : null,
      y1: typeof info.y1 === 'number' ? round(info.y1) : null,
      ctx: this._context(),
    });
  }

  /** Wheel menu visibility change. */
  recordWheel(visible: boolean, via: 'toggle' | 'show' | 'hide'): void {
    if (this._disabled) return;
    this._push({
      type: 'wheel',
      state: visible ? 'open' : 'closed',
      via,
      ctx: this._context(),
    });
  }

  /** Emit session manifest linking UX trace sid with dataset and engine identity. */
  recordSessionManifest(manifest: Partial<SessionManifestInfo> = {}): void {
    if (this._disabled) return;
    this._recordDatasetBoundaryIfChanged(manifest);
    this._push({
      type: 'session-manifest',
      sid: this._sessionId,
      startedAt: new Date().toISOString(),
      sampleHz: round(1 / this._sampleInterval, 2),
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      ...manifest,
    });
  }

  /** Performance metric or budget violation event. */
  recordPerf(info: PerfTraceInfo): void {
    if (this._disabled) return;
    this._push({
      type: 'perf',
      ...info,
      ctx: this._context(),
    });
  }

  /** Frustration and friction pattern event. */
  recordFriction(info: FrictionTraceInfo): void {
    if (this._disabled) return;
    this._push({
      type: 'friction',
      ...info,
      ctx: this._context(),
    });
  }

  /** Hand-tracking optical joint lifecycle and cold-start tracking event. */
  recordHands(info: HandsLifecycleTraceInfo): void {
    if (this._disabled) return;
    this._push({
      type: 'hands',
      ...info,
      ctx: this._context(),
    });
  }

  dispose(): void {
    if (!this._disabled && !this._disposed) this._closeTrace('disposed');
    this._disposed = true;
    for (const unsub of this._unsubs) {
      try {
        unsub();
      } catch {
        // Ignore unsubscribe failures.
      }
    }
    this._unsubs = [];
    try {
      this._engine.removeUpdatable(this._updatable);
    } catch {
      // Engine may already be gone during teardown.
    }
  }

  private _openTrace(reason: string): void {
    if (this._traceOpen || this._disabled || this._disposed) return;
    this._traceOpen = true;
    this._emitLifecycle('trace-start', { reason });
  }

  private _closeTrace(reason: string): void {
    if (!this._traceOpen || this._disabled || this._disposed) return;
    this._emitLifecycle('trace-end', { reason });
    this._traceOpen = false;
  }

  private _emitLifecycle(event: TraceLifecycleEvent, fields: Record<string, unknown> = {}): void {
    this._push({
      type: 'trace-lifecycle',
      event,
      droppedCount: this._droppedCount,
      ...fields,
    });
  }

  private _recordDatasetBoundaryIfChanged(manifest: Partial<SessionManifestInfo>): void {
    const parts = [
      manifest.datasetFingerprint,
      manifest.datasetVersion,
      manifest.datasetName,
      manifest.topology,
    ].filter((value): value is string => typeof value === 'string' && value.length > 0);
    if (parts.length === 0) return;
    const key = parts.join('|');
    if (key === this._lastDatasetBoundaryKey) return;
    this._lastDatasetBoundaryKey = key;
    this._emitLifecycle('dataset-boundary', {
      datasetFingerprint: manifest.datasetFingerprint,
      datasetVersion: manifest.datasetVersion,
      datasetName: manifest.datasetName,
      topology: manifest.topology,
    });
  }

  private _maybeEmitMeta(): void {
    if (this._metaEmitted) return;
    const hands = this._engine.input.hands ?? [];
    if (hands.length === 0) return;
    this._metaEmitted = true;
    const pinchThresholds = hands.map(
      (h) =>
        (h as unknown as { pinchThreshold?: number; releaseThreshold?: number })
          .pinchThreshold ?? null
    );
    this._push({
      type: 'meta',
      startedAt: new Date().toISOString(),
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      sampleHz: round(1 / this._sampleInterval, 2),
      pinchThresholds,
    });
  }

  private _makeRecord(fields: TraceRecordBase): TraceRecord {
    return {
      t: round(this._time, 3),
      sid: this._sessionId,
      seq: ++this._seq,
      type: '',
      ...fields,
    };
  }

  private _push(fields: TraceRecordBase): void {
    if (this._disabled || this._disposed) return;
    this._buffer.push(this._makeRecord(fields));
    this._capBuffer();
  }

  /**
   * Keep bounded memory while preserving an explicit truncation signal. One
   * retained buffer-drop marker is updated rather than emitting a marker for
   * every subsequent dropped record (which would otherwise amplify loss).
   */
  private _capBuffer(): void {
    if (this._buffer.length <= MAX_BUFFER) return;

    let droppedNow = this._buffer.length - MAX_BUFFER;
    this._buffer.splice(0, droppedNow);
    this._droppedCount += droppedNow;

    let dropMarker: TraceRecord | null = null;
    for (let i = this._buffer.length - 1; i >= 0; i -= 1) {
      const record = this._buffer[i];
      if (record.type === 'trace-lifecycle' && record.event === 'buffer-drop') {
        dropMarker = record;
        break;
      }
    }

    if (dropMarker) {
      dropMarker.droppedNow = (typeof dropMarker.droppedNow === 'number' ? dropMarker.droppedNow : 0) + droppedNow;
      dropMarker.droppedCount = this._droppedCount;
      dropMarker.lastDroppedAt = round(this._time, 3);
      return;
    }

    // Reserve one bounded slot for the first explicit drop marker.
    if (this._buffer.length >= MAX_BUFFER) {
      this._buffer.shift();
      this._droppedCount++;
      droppedNow++;
    }
    this._buffer.push(
      this._makeRecord({
        type: 'trace-lifecycle',
        event: 'buffer-drop',
        droppedNow,
        droppedCount: this._droppedCount,
        lastDroppedAt: round(this._time, 3),
      })
    );
  }

  /** Build (and cache per frame) the current world-view + input context. */
  private _context(): TraceContext {
    if (this._ctxCache && this._ctxCacheFrame === this._frame) return this._ctxCache;
    const ctx = this._buildContext();
    this._ctxCache = ctx;
    this._ctxCacheFrame = this._frame;
    return ctx;
  }

  private _buildContext(): TraceContext {
    const camera = this._engine.camera;
    let head = { p: [0, 0, 0] as number[], yaw: 0, pitch: 0 };
    let gazeDir: THREE.Vector3 | null = null;
    let gaze: TargetInfo = { target: null, kind: null, dist: null };

    try {
      if (camera) {
        camera.getWorldPosition(this._headPos);
        camera.getWorldDirection(this._headDir);
        gazeDir = this._headDir.clone();
        const yaw = round((Math.atan2(-this._headDir.x, -this._headDir.z) * 180) / Math.PI, 1);
        const pitch = round(
          (Math.asin(THREE.MathUtils.clamp(this._headDir.y, -1, 1)) * 180) / Math.PI,
          1
        );
        const posSource = this._engine.headWorldPos ?? this._headPos;
        head = {
          p: [round(posSource.x), round(posSource.y), round(posSource.z)],
          yaw,
          pitch,
        };
        this._gazeRay.origin.copy(this._headPos);
        this._gazeRay.direction.copy(this._headDir);
        gaze = this._raycastTargets(this._gazeRay);
      }
    } catch (err) {
      this._warnSectionOnce('head/gaze', err);
    }

    let ptr: TraceContext['ptr'] = { target: null, kind: null, dist: null, hand: null, driftDeg: null };
    try {
      const pointerRay = this._engine.input.pointers?.getBestPointerRay?.() ?? null;
      if (pointerRay) {
        const ptrInfo = this._raycastTargets(pointerRay);
        const driftDeg =
          gazeDir && pointerRay.direction.lengthSq() > 0
            ? round(
                (Math.acos(
                  THREE.MathUtils.clamp(gazeDir.dot(pointerRay.direction.clone().normalize()), -1, 1)
                ) *
                  180) /
                  Math.PI,
                1
              )
            : null;
        ptr = { ...ptrInfo, hand: this._bestPointerHandedness(), driftDeg };
      }
    } catch (err) {
      this._warnSectionOnce('pointer', err);
    }

    let hands: TraceContext['hands'] = [];
    const handPositions: Array<{ pos: THREE.Vector3; handedness: string }> = [];
    try {
      hands = (this._engine.input.hands ?? []).map((h) => {
        const y = (h.rayOrigin as unknown as { y?: number } | undefined)?.y;
        if (h.rayOrigin && typeof h.rayOrigin === 'object') {
          const originVec = (h.rayOrigin as THREE.Vector3).clone
            ? (h.rayOrigin as THREE.Vector3).clone()
            : new THREE.Vector3(
                (h.rayOrigin as { x?: number }).x ?? 0,
                y ?? 0,
                (h.rayOrigin as { z?: number }).z ?? 0
              );
          handPositions.push({ pos: originVec, handedness: h.handedness ?? `#${h.index ?? '?'}` });
        }
        return {
          h: h.handedness ?? `#${h.index ?? '?'}`,
          pinched: h.isPinched?.() ?? !!h.pinched,
          d: typeof h.pinchDistance === 'number' ? round(h.pinchDistance, 3) : null,
          y: typeof y === 'number' ? round(y) : null,
          pose: h.jointsValid !== false,
        };
      });
    } catch (err) {
      this._warnSectionOnce('hands', err);
    }

    let world: WorldSpatialSnapshot = {
      zone: 'CENTRAL_PLAZA',
      nearestLandmark: null,
      landmarks: [],
      ergonomics: {},
    };
    try {
      world = this._worldSpatialContext.buildSnapshot(
        camera,
        this._engine.headWorldPos ?? this._headPos,
        handPositions,
        ptr.driftDeg
      );
    } catch (err) {
      this._warnSectionOnce('world', err);
    }

    return { head, gaze, ptr, hands, ui: this._uiState(), world };
  }

  private _warnSectionOnce(section: string, err: unknown): void {
    const key = `ctx:${section}`;
    if (this._warnedSections.has(key)) return;
    this._warnedSections.add(key);
    console.warn(`[UXTraceRecorder] context section "${section}" degraded:`, err);
  }

  /** Per-frame cached UI state from the wiring layer. */
  private _uiState(): Record<string, unknown> {
    if (this._uiCacheFrame !== this._frame) {
      this._uiCache = this._getUIState?.() ?? {};
      this._uiCacheFrame = this._frame;
    }
    return this._uiCache;
  }

  /** Nearest hit against panels, scene interactables, and extra gaze targets. */
  private _raycastTargets(ray: THREE.Ray): TargetInfo {
    this._raycaster.ray.copy(ray);
    if (this._engine.camera) this._raycaster.camera = this._engine.camera;
    let best: TargetInfo = { target: null, kind: null, dist: null };

    for (const panel of this._engine.input.panels ?? []) {
      if (!panel.mesh?.visible) continue;
      const hits = this._raycaster.intersectObject(panel.mesh, false);
      if (hits.length > 0 && (best.dist === null || hits[0].distance < best.dist)) {
        best = {
          target: panel.title ?? this._describeMesh(panel.mesh, undefined) ?? 'panel',
          kind: 'panel',
          dist: round(hits[0].distance),
        };
      }
    }

    const indexedHit = this._engine.input.raycastScene?.(this._raycaster, {
      ignoreSuppression: true,
    });
    if (indexedHit && (best.dist === null || indexedHit.distance < best.dist)) {
      best = {
        target: this._describeMesh(indexedHit.entry.mesh, indexedHit.entry.data),
        kind: 'scene',
        dist: round(indexedHit.distance),
      };
    } else if (!this._engine.input.raycastScene) {
      const interactables = (this._engine.input.interactables ?? []).filter((i) => i?.mesh);
      const hits = this._raycaster.intersectObjects(
        interactables.map((i) => i.mesh),
        false
      );
      if (hits.length > 0 && (best.dist === null || hits[0].distance < best.dist)) {
        const entry = interactables.find((i) => i.mesh === hits[0].object);
        best = {
          target: this._describeMesh(hits[0].object, entry?.data),
          kind: 'scene',
          dist: round(hits[0].distance),
        };
      }
    }

    for (const extra of this._extraGazeTargets?.() ?? []) {
      if (!extra?.visible) continue;
      const hits = this._raycaster.intersectObject(extra, false);
      if (hits.length > 0 && (best.dist === null || hits[0].distance < best.dist)) {
        best = {
          target: this._describeMesh(extra, undefined) ?? 'hud',
          kind: 'hud',
          dist: round(hits[0].distance),
        };
      }
    }

    return best;
  }

  private _bestPointerHandedness(): string | null {
    const hands = this._engine.input.hands ?? [];
    for (const hand of hands) {
      if ((hand as unknown as { isPoseValid?: () => boolean }).isPoseValid?.()) {
        return hand.handedness ?? `#${hand.index ?? '?'}`;
      }
    }
    return hands[0]?.handedness ?? null;
  }

  /** Human-readable identity for a mesh: data label/name/id first, then mesh name. */
  private _describeMesh(mesh: THREE.Object3D | null | undefined, data?: unknown): string | null {
    if (!mesh) return null;
    const d = data as { label?: unknown; name?: unknown; id?: unknown } | null | undefined;
    const dataLabel =
      typeof d?.label === 'string' || typeof d?.label === 'number'
        ? String(d.label)
        : typeof d?.name === 'string' || typeof d?.name === 'number'
          ? String(d.name)
          : typeof d?.id === 'string' || typeof d?.id === 'number'
            ? String(d.id)
            : null;
    const meshName = mesh.name && mesh.name.length > 0 ? mesh.name : mesh.type;
    return dataLabel
      ? `${dataLabel} (${meshName}#${shortId(mesh.uuid)})`
      : `${meshName}#${shortId(mesh.uuid)}`;
  }

  /** Manually flush buffered records immediately. */
  async flush(): Promise<void> {
    return this._flush();
  }

  private async _flush(): Promise<void> {
    if (this._flushing || this._buffer.length === 0 || this._disabled) return;
    if (this._endpointDead) return;
    this._flushing = true;
    const batch = this._buffer;
    this._buffer = [];
    try {
      const res = await this._fetch(this._endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sid: this._sessionId, records: batch }),
      });
      if (!res.ok) {
        if (res.status === 404) {
          this._requeue(batch);
          this._markEndpointDead();
        } else {
          this._requeue(batch);
        }
      }
    } catch {
      this._requeue(batch);
    } finally {
      this._flushing = false;
    }
  }

  private _requeue(batch: TraceRecord[]): void {
    this._buffer = [...batch, ...this._buffer];
    this._capBuffer();
  }

  private _disable(reason: string): void {
    if (this._disabled) return;
    this._closeTrace(`disabled:${reason}`);
    this._disabled = true;
    console.warn(`[UXTraceRecorder] disabled: ${reason}`);
  }

  /**
   * Endpoint confirmed absent: stop flushing permanently (no retry loop, no
   * fallback endpoint) but keep recording into the bounded buffer for
   * user-initiated export. Warns once.
   */
  private _markEndpointDead(): void {
    this._endpointDead = true;
    if (this._endpointDeadWarned) return;
    this._endpointDeadWarned = true;
    console.warn(
      `[UXTraceRecorder] endpoint ${this._endpoint} not available (not a dev server); buffering in memory for local export`
    );
  }
}
