/**
 * Lightweight, opt-in telemetry collector for Nemosyne.
 *
 * All metrics are kept in memory and only exposed to the user through the
 * in-VR Telemetry panel or the analysis-story export. Nothing is transmitted
 * externally. The user must opt in via the Settings panel; telemetry defaults to
 * disabled.
 */

const STORAGE_KEY = 'nemosyne-telemetry-consent';

/**
 * Frame-timing histogram bucket: count frames whose duration falls in a given
 * millisecond range. This compresses per-frame data into a small summary.
 */
function makeHistogram() {
  return {
    under16: 0, // 0–16 ms (≥60 fps)
    under33: 0, // 16–33 ms (30–60 fps)
    under50: 0, // 33–50 ms (20–30 fps)
    under100: 0, // 50–100 ms
    over100: 0, // >100 ms
  };
}

function bucketDuration(ms, hist) {
  if (ms <= 16) hist.under16++;
  else if (ms <= 33) hist.under33++;
  else if (ms <= 50) hist.under50++;
  else if (ms <= 100) hist.under100++;
  else hist.over100++;
}

export class TelemetryCollector {
  constructor({ enabled = false, storageKey = STORAGE_KEY } = {}) {
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
  get enabled() {
    return this._enabled;
  }

  setEnabled(value) {
    this._enabled = !!value;
    if (this._enabled) {
      this._attachGlobalListeners();
    } else {
      this._detachGlobalListeners();
    }
  }

  /** Load consent from localStorage. */
  loadConsent() {
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
  saveConsent(enabled) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({ enabled: !!enabled }));
    } catch {
      // Storage unavailable (private mode, test env).
    }
    this.setEnabled(!!enabled);
  }

  /** Record a single renderer tick duration in milliseconds. */
  recordFrame(deltaMs) {
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
  recordDataset(name, topology) {
    if (!this._enabled) return;
    this._datasetName = name ?? '-';
    this._datasetTopology = topology ?? '-';
  }

  /** Record an applied analysis operation. */
  recordOperation(operation) {
    if (!this._enabled) return;
    this._operationCounts[operation] = (this._operationCounts[operation] ?? 0) + 1;
  }

  /** Record a recognized hand gesture. */
  recordGesture(name) {
    if (!this._enabled) return;
    this._gestureCounts[name] = (this._gestureCounts[name] ?? 0) + 1;
  }

  /** Record an error or warning. */
  recordError(err, isWarning = false) {
    if (!this._enabled) return;
    if (isWarning) this._warningCount++;
    else this._errorCount++;
    const msg = err?.message ?? String(err);
    if (msg) this._lastError = { message: msg, time: Date.now(), isWarning };
  }

  /**
   * Build a JSON snapshot of current telemetry.
   */
  getReport() {
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
  reset() {
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

  _attachGlobalListeners() {
    if (this._handlers.length > 0) return;
    if (typeof window === 'undefined') return;

    const onError = (event) => {
      this.recordError(event.error ?? event.message, false);
    };
    const onRejection = (event) => {
      this._unhandledRejections++;
      this.recordError(event.reason, false);
    };
    const onWarn = (event) => {
      // Some runtimes emit console warnings as events; avoid double-counting.
      if (event.message && !event.message.includes('[World]')) {
        this.recordError(event.message, true);
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

  _detachGlobalListeners() {
    for (const unbind of this._handlers) unbind();
    this._handlers = [];
  }
}
