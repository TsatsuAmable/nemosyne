/**
 * Dev-only UX trace recorder for on-device input debugging.
 *
 * Records one unified timeline that correlates hand input with what the
 * analyst is looking at, so post-hoc analysis can answer questions like
 * "the user pinched while looking at the tour panel — did anything respond?".
 *
 * Data sources:
 *  - Head pose + head-gaze raycast (camera forward against panels, scene
 *    interactables, and extra targets such as the tour card). Quest 3S has no
 *    eye tracking, so head gaze is an approximation of "what am I looking at".
 *  - Best pointer ray + its raycast target, plus the angular drift between
 *    head gaze and pointer ray (a UX signal in its own right).
 *  - Per-hand pinch state (distance, pinched, tracking validity).
 *  - UI state snapshot supplied by the wiring layer (wheel menu, tour, etc).
 *  - Event taps: pinch edges with their actual routing decision (select /
 *    wheel toggle / system-suppressed), selection dispatch hit-or-miss,
 *    recognized gestures, system gesture fired/suppressed, wheel visibility.
 *
 * Records are buffered and flushed as JSON batches to the dev-server endpoint
 * `/__ux-trace`, which appends them to `logs/ux-trace.jsonl`. The recorder
 * disables itself when the endpoint is missing (production builds) and keeps
 * retrying (with a capped buffer) through transient network failures.
 */

import * as THREE from 'three';
import type { HandLike, PanelLike } from '../coordinators/types.ts';
import type { SelectionDispatchInfo } from '../input/SelectionDispatcher.ts';
import type { SystemGestureTraceInfo } from '../input/SystemGestureDetector.ts';
import {
  WorldSpatialContext,
  type WorldLandmarkTarget,
  type WorldSpatialSnapshot,
} from './WorldSpatialContext.ts';

export type UXTraceHandPinchGating =
  | 'select'
  | 'select-release'
  | 'passive-release'
  | 'wheel-toggle'
  | 'wheel-release'
  | 'system-suppressed';

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
  private _now: () => number;
  private _fetch: NonNullable<UXTraceRecorderOptions['fetchImpl']>;

  private _sessionId: string;
  private _seq = 0;
  private _time = 0;
  private _frame = 0;
  private _buffer: TraceRecord[] = [];
  private _droppedCount = 0;
  private _disabled = false;
  private _disposed = false;
  private _errorCount = 0;
  private _lastSampleAt = -Infinity;
  private _lastFlushAt = 0;
  private _flushing = false;
  private _unsubs: Array<() => void> = [];
  private _lastTourKey: string | null = null;
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
    this._now = options.now ?? (() => performance.now());
    this._fetch =
      options.fetchImpl ??
      ((url, init) =>
        fetch(url, init as RequestInit) as unknown as Promise<{ ok: boolean; status: number }>);

    this._sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    if (options.eventBus) {
      const bus = options.eventBus;
      this._unsubs.push(
        bus.on('gesture:recognized', (payload) => {
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

  get disabled(): boolean {
    return this._disabled;
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

  dispose(): void {
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

  private _push(fields: TraceRecordBase): void {
    const record: TraceRecord = {
      t: round(this._time, 3),
      sid: this._sessionId,
      seq: ++this._seq,
      type: '',
      ...fields,
    };
    this._buffer.push(record);
    if (this._buffer.length > MAX_BUFFER) {
      const overflow = this._buffer.length - MAX_BUFFER;
      this._buffer.splice(0, overflow);
      this._droppedCount += overflow;
    }
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
            : new THREE.Vector3((h.rayOrigin as { x?: number }).x ?? 0, y ?? 0, (h.rayOrigin as { z?: number }).z ?? 0);
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

    const interactables = (this._engine.input.interactables ?? []).filter(
      (i) => i?.mesh
    );
    if (interactables.length > 0) {
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
    return dataLabel ? `${dataLabel} (${meshName}#${shortId(mesh.uuid)})` : `${meshName}#${shortId(mesh.uuid)}`;
  }

  private async _flush(): Promise<void> {
    if (this._flushing || this._buffer.length === 0 || this._disabled) return;
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
          this._disable(`endpoint ${this._endpoint} not available (not a dev server)`);
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
    if (this._buffer.length > MAX_BUFFER) {
      const overflow = this._buffer.length - MAX_BUFFER;
      this._buffer.splice(0, overflow);
      this._droppedCount += overflow;
    }
  }

  private _disable(reason: string): void {
    if (this._disabled) return;
    this._disabled = true;
    console.warn(`[UXTraceRecorder] disabled: ${reason}`);
  }
}
