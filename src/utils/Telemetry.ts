/**
 * Lightweight, opt-in telemetry collector for Nemosyne.
 *
 * All metrics are kept in memory and only exposed to the user through the
 * in-VR Telemetry panel or the analysis-story export. Nothing is transmitted
 * externally. The user must opt in via the Settings panel; telemetry defaults to
 * disabled.
 */

import type { TelemetryReport } from '../vr/coordinators/types.ts';

const STORAGE_KEY = 'nemosyne-telemetry-consent';

interface Histogram {
  under16: number;
  under33: number;
  under50: number;
  under100: number;
  over100: number;
}

/**
 * Frame-timing histogram bucket: count frames whose duration falls in a given
 * millisecond range. This compresses per-frame data into a small summary.
 */
function makeHistogram(): Histogram {
  return {
    under16: 0, // 0–16 ms (≥60 fps)
    under33: 0, // 16–33 ms (30–60 fps)
    under50: 0, // 33–50 ms (20–30 fps)
    under100: 0, // 50–100 ms
    over100: 0, // >100 ms
  };
}

function bucketDuration(ms: number, hist: Histogram): void {
  if (ms <= 16) hist.under16++;
  else if (ms <= 33) hist.under33++;
  else if (ms <= 50) hist.under50++;
  else if (ms <= 100) hist.under100++;
  else hist.over100++;
}

interface TelemetryCollectorOptions {
  enabled?: boolean;
  storageKey?: string;
}

interface ErrorSnapshot {
  message: string;
  time: number;
  isWarning?: boolean;
}

export class TelemetryCollector {
  private storageKey: string;
  private _enabled: boolean;
  private _startTime: number;
  private _frameCount: number;
  private _frameTimeTotal: number;
  private _droppedFrameCount: number;
  private _histogram: Histogram;
  private _lastFrameTime: number;

  private _datasetName: string;
  private _datasetTopology: string;
  private _operationCounts: Record<string, number>;
  private _gestureCounts: Record<string, number>;
  private _errorCount: number;
  private _warningCount: number;
  private _lastError: ErrorSnapshot | null;
  private _unhandledRejections: number;

  private _handlers: Array<() => void>;

  constructor({ enabled = false, storageKey = STORAGE_KEY }: TelemetryCollectorOptions = {}) {
    this.storageKey = storageKey;
    this._enabled = enabled;
    this._startTime = performance.now?.() ?? Date.now();
    this._frameCount = 0;
    this._frameTimeTotal = 0;
    this._droppedFrameCount = 0;
    this._histogram = makeHistogram();
    this._lastFrameTime = 0;

    this._datasetName = '-';
    this._datasetTopology = '-';
    this._operationCounts = {};
    this._gestureCounts = {};
    this._errorCount = 0;
    this._warningCount = 0;
    this._lastError = null;
    this._unhandledRejections = 0;

    this._handlers = [];
  }

  /** True if telemetry collection is currently active. */
  get enabled(): boolean {
    return this._enabled;
  }

  setEnabled(value: boolean): void {
    this._enabled = !!value;
    if (this._enabled) {
      this._attachGlobalListeners();
    } else {
      this._detachGlobalListeners();
    }
  }

  /** Load consent from localStorage. */
  loadConsent(): boolean {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw === null) return false;
      const consent = JSON.parse(raw);
      this.setEnabled(!!consent.enabled);
      return this._enabled;
    } catch {
      return false;
    }
  }

  /** Persist consent choice to localStorage. */
  saveConsent(enabled: boolean): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({ enabled: !!enabled }));
    } catch {
      // Storage unavailable (private mode, test env).
    }
    this.setEnabled(!!enabled);
  }

  /** Record a single renderer tick duration in milliseconds. */
  recordFrame(deltaMs: number): void {
    if (!this._enabled) return;
    const ms = deltaMs;
    this._frameCount++;
    this._frameTimeTotal += ms;
    bucketDuration(ms, this._histogram);

    // A frame is considered dropped if it missed the 60 fps budget.
    if (ms > 16.67) {
      this._droppedFrameCount++;
    }
    this._lastFrameTime = ms;
  }

  /** Note which dataset is currently loaded. */
  recordDataset(name: string, topology: string): void {
    if (!this._enabled) return;
    this._datasetName = name ?? '-';
    this._datasetTopology = topology ?? '-';
  }

  /** Record an applied analysis operation. */
  recordOperation(operation: string): void {
    if (!this._enabled) return;
    this._operationCounts[operation] = (this._operationCounts[operation] ?? 0) + 1;
  }

  /** Record a recognized hand gesture. */
  recordGesture(name: string): void {
    if (!this._enabled) return;
    this._gestureCounts[name] = (this._gestureCounts[name] ?? 0) + 1;
  }

  /** Record an error or warning. */
  recordError(err: unknown, isWarning = false): void {
    if (!this._enabled) return;
    if (isWarning) this._warningCount++;
    else this._errorCount++;
    const msg = (err as Error | undefined)?.message ?? String(err);
    if (msg) this._lastError = { message: msg, time: Date.now(), isWarning };
  }

  /**
   * Build a JSON snapshot of current telemetry.
   */
  getReport(): TelemetryReport {
    const elapsed = ((performance.now?.() ?? Date.now()) - this._startTime) / 1000;
    return {
      version: 1,
      timestamp: Date.now(),
      enabled: this._enabled,
      session: {
        durationSeconds: elapsed,
        datasetName: this._datasetName,
        datasetTopology: this._datasetTopology,
      },
      frames: {
        count: this._frameCount,
        dropped: this._droppedFrameCount,
        averageMs: this._frameCount > 0 ? this._frameTimeTotal / this._frameCount : 0,
        lastMs: this._lastFrameTime,
        histogram: { ...this._histogram },
      },
      operations: { ...this._operationCounts },
      gestures: { ...this._gestureCounts },
      errors: {
        count: this._errorCount,
        warnings: this._warningCount,
        unhandledRejections: this._unhandledRejections,
        last: this._lastError,
      },
    };
  }

  /** Reset all in-memory counters. Does not affect stored consent. */
  reset(): void {
    this._startTime = performance.now?.() ?? Date.now();
    this._frameCount = 0;
    this._frameTimeTotal = 0;
    this._droppedFrameCount = 0;
    this._histogram = makeHistogram();
    this._lastFrameTime = 0;
    this._operationCounts = {};
    this._gestureCounts = {};
    this._errorCount = 0;
    this._warningCount = 0;
    this._lastError = null;
    this._unhandledRejections = 0;
  }

  _attachGlobalListeners(): void {
    if (this._handlers.length > 0) return;
    if (typeof window === 'undefined') return;

    const onError = (event: ErrorEvent) => {
      this.recordError(event.error ?? event.message, false);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      this._unhandledRejections++;
      this.recordError(event.reason, false);
    };
    const onWarn = (event: Event) => {
      // Some runtimes emit console warnings as events; avoid double-counting.
      const message = (event as ErrorEvent).message;
      if (message && !message.includes('[World]')) {
        this.recordError(message, true);
      }
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('warn', onWarn);

    this._handlers = [
      () => window.removeEventListener('error', onError),
      () => window.removeEventListener('unhandledrejection', onRejection),
      () => window.removeEventListener('warn', onWarn),
    ];
  }

  _detachGlobalListeners(): void {
    for (const unbind of this._handlers) unbind();
    this._handlers = [];
  }
}
