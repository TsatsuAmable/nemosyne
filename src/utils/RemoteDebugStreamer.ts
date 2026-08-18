/**
 * Live VR Remote Debug Console Streamer.
 *
 * Captures browser console logs, warnings, errors, and unhandled rejections
 * on Meta Quest and remote devices, and streams them in real-time back to
 * the Vite dev server endpoint (`/__remote-logs`).
 */

/* eslint-disable no-console -- this utility's entire purpose is to intercept
   and restore console.log/info, so referencing them is intentional. */

export interface LogEntry {
  timestamp: string;
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  stack?: string;
  userAgent?: string;
}

class RemoteDebugStreamer {
  /** Hard cap on queued entries so an offline / unreachable device can't grow the queue without limit. */
  private static readonly MAX_QUEUE_ENTRIES = 1000;
  /** Upper bound for exponential backoff between retry flushes. */
  private static readonly MAX_BACKOFF_MS = 30_000;

  private queue: LogEntry[] = [];
  private isFlushing = false;
  private bannerElement: HTMLDivElement | null = null;
  private origLog = console.log;
  private origWarn = console.warn;
  private origError = console.error;
  private origInfo = console.info;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;
  private errorHandler: ((event: ErrorEvent) => void) | null = null;
  private rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;
  /** Consecutive failed flushes — drives exponential backoff. Reset on success. */
  private consecutiveFailures = 0;
  /** Timestamp of the last flush attempt, for backoff spacing. */
  private lastFlushAt = 0;
  /** Set when the endpoint is confirmed absent (HTTP 404). Stops all future flushes. */
  private endpointUnavailable = false;

  init(): void {
    if (typeof window === 'undefined') return;
    // Idempotent: a second init (hot reload, repeated test cycle) would
    // otherwise stack a second pair of window listeners and a second HUD
    // banner while leaving the console patched.
    if (this.initialized) return;
    this.initialized = true;

    this.createHudBanner();

    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';

    // Intercept console.log
    console.log = (...args: unknown[]) => {
      this.origLog.apply(console, args);
      this.enqueue('log', this.formatArgs(args), userAgent);
    };

    // Intercept console.info
    console.info = (...args: unknown[]) => {
      this.origInfo.apply(console, args);
      this.enqueue('info', this.formatArgs(args), userAgent);
    };

    // Intercept console.warn
    console.warn = (...args: unknown[]) => {
      this.origWarn.apply(console, args);
      this.enqueue('warn', this.formatArgs(args), userAgent);
    };

    // Intercept console.error
    console.error = (...args: unknown[]) => {
      this.origError.apply(console, args);
      const formatted = this.formatArgs(args);
      this.enqueue('error', formatted, userAgent);
      this.showOnHud('ERROR: ' + formatted, '#ff3366');
    };

    // Intercept window onerror (store the handler so dispose() can remove it)
    this.errorHandler = (event) => {
      const msg = `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
      this.enqueue('error', msg, userAgent, event.error?.stack);
      this.showOnHud('WINDOW ERROR: ' + msg, '#ff3366');
    };
    window.addEventListener('error', this.errorHandler);

    // Intercept window onunhandledrejection
    this.rejectionHandler = (event) => {
      const reason = event.reason?.message || String(event.reason);
      const stack = event.reason?.stack;
      this.enqueue('error', `Unhandled Rejection: ${reason}`, userAgent, stack);
      this.showOnHud('REJECTION: ' + reason, '#ff9900');
    };
    window.addEventListener('unhandledrejection', this.rejectionHandler);

    // Start background batch flusher
    if (this.flushTimer === null) {
      const timer = setInterval(() => this.flush(), 500);
      (timer as unknown as { unref?: () => void }).unref?.();
      this.flushTimer = timer;
    }

    this.origLog.call(console, '[RemoteDebugStreamer] Live VR console telemetry initialized');
  }

  dispose(): void {
    if (!this.initialized) return;
    this.initialized = false;

    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Remove the window listeners we registered (prevents duplicate error
    // reporting across init() -> dispose() -> init() cycles).
    if (this.errorHandler) {
      window.removeEventListener('error', this.errorHandler);
      this.errorHandler = null;
    }
    if (this.rejectionHandler) {
      window.removeEventListener('unhandledrejection', this.rejectionHandler);
      this.rejectionHandler = null;
    }

    // Restore the original console methods so patched calls stop enqueuing
    // into a queue that no longer flushes periodically.
    console.log = this.origLog;
    console.info = this.origInfo;
    console.warn = this.origWarn;
    console.error = this.origError;

    // Remove the HUD banner element.
    if (this.bannerElement) {
      this.bannerElement.remove();
      this.bannerElement = null;
    }

    // Drop any queued logs that will never flush.
    this.queue = [];
    this.consecutiveFailures = 0;
    this.lastFlushAt = 0;
    this.endpointUnavailable = false;
  }

  private formatArgs(args: unknown[]): string {
    return args
      .map((a) => {
        if (typeof a === 'string') return a;
        if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack ?? ''}`;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(' ');
  }

  private enqueue(level: 'log' | 'info' | 'warn' | 'error', message: string, userAgent: string, stack?: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      stack,
      userAgent,
    };
    // Bound the queue: drop the oldest entry when at capacity so a flood of
    // logs on an unreachable device can't grow memory without limit.
    if (this.queue.length >= RemoteDebugStreamer.MAX_QUEUE_ENTRIES) {
      this.queue.shift();
    }
    this.queue.push(entry);

    if (this.queue.length >= 20) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.endpointUnavailable || this.queue.length === 0 || this.isFlushing) return;

    // Backoff after consecutive failures so a persistently-unreachable
    // endpoint doesn't spin a tight retry loop on top of the 500ms timer.
    const now = Date.now();
    const backoff = Math.min(500 * 2 ** this.consecutiveFailures, RemoteDebugStreamer.MAX_BACKOFF_MS);
    if (now - this.lastFlushAt < backoff) return;
    this.lastFlushAt = now;

    this.isFlushing = true;
    const batch = [...this.queue];
    this.queue = [];

    try {
      const res = await fetch('/__remote-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (res.status === 404) {
        // Endpoint is absent (e.g. a production build, or dev server without
        // the plugin). Stop flushing permanently and drop the batch rather
        // than re-queue it forever.
        this.endpointUnavailable = true;
        this.queue = [];
      } else if (!res.ok) {
        // Other non-OK responses are treated as transient: re-queue + back off.
        this.recordFailure(batch);
      } else {
        this.consecutiveFailures = 0;
      }
    } catch {
      // Network error (offline / DNS): re-queue the batch, bounded + backed off.
      this.recordFailure(batch);
    } finally {
      this.isFlushing = false;
    }
  }

  private recordFailure(batch: LogEntry[]): void {
    this.consecutiveFailures += 1;
    this.queue.unshift(...batch);
    if (this.queue.length > RemoteDebugStreamer.MAX_QUEUE_ENTRIES) {
      // Drop oldest (front) entries to stay within the cap.
      this.queue = this.queue.slice(0, RemoteDebugStreamer.MAX_QUEUE_ENTRIES);
    }
  }

  private createHudBanner(): void {
    if (typeof document === 'undefined') return;
    const banner = document.createElement('div');
    banner.id = 'nemosyne-vr-debug-hud';
    banner.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      color: #00ffcc;
      background: rgba(4, 10, 20, 0.95);
      border: 1px solid #00ffcc;
      border-radius: 4px;
      z-index: 99999;
      pointer-events: none;
      display: none;
      max-width: 90vw;
      word-break: break-all;
      box-shadow: 0 0 10px rgba(0,255,204,0.4);
    `;
    document.body.appendChild(banner);
    this.bannerElement = banner;
  }

  private showOnHud(msg: string, color = '#00ffcc'): void {
    if (!this.bannerElement) return;
    this.bannerElement.textContent = msg.slice(0, 200);
    this.bannerElement.style.borderColor = color;
    this.bannerElement.style.color = color;
    this.bannerElement.style.display = 'block';

    setTimeout(() => {
      if (this.bannerElement) {
        this.bannerElement.style.display = 'none';
      }
    }, 4000);
  }
}

export const remoteDebugStreamer = new RemoteDebugStreamer();
