/**
 * Live VR Remote Debug Console Streamer.
 *
 * Captures browser console logs, warnings, errors, and unhandled rejections
 * on Meta Quest and remote devices, and streams them in real-time back to
 * the Vite dev server endpoint (`/__remote-logs`).
 */

export interface LogEntry {
  timestamp: string;
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  stack?: string;
  userAgent?: string;
}

class RemoteDebugStreamer {
  private queue: LogEntry[] = [];
  private isFlushing = false;
  private bannerElement: HTMLDivElement | null = null;
  private origLog = console.log;
  private origWarn = console.warn;
  private origError = console.error;
  private origInfo = console.info;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  init(): void {
    if (typeof window === 'undefined') return;

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

    // Intercept window onerror
    window.addEventListener('error', (event) => {
      const msg = `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
      this.enqueue('error', msg, userAgent, event.error?.stack);
      this.showOnHud('WINDOW ERROR: ' + msg, '#ff3366');
    });

    // Intercept window onunhandledrejection
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason?.message || String(event.reason);
      const stack = event.reason?.stack;
      this.enqueue('error', `Unhandled Rejection: ${reason}`, userAgent, stack);
      this.showOnHud('REJECTION: ' + reason, '#ff9900');
    });

    // Start background batch flusher
    if (this.flushTimer === null) {
      const timer = setInterval(() => this.flush(), 500);
      (timer as unknown as { unref?: () => void }).unref?.();
      this.flushTimer = timer;
    }

    this.origLog.call(console, '[RemoteDebugStreamer] Live VR console telemetry initialized');
  }

  dispose(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
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
    this.queue.push(entry);

    if (this.queue.length >= 20) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.queue.length === 0 || this.isFlushing) return;

    this.isFlushing = true;
    const batch = [...this.queue];
    this.queue = [];

    try {
      await fetch('/__remote-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
    } catch {
      // Re-queue failed logs if offline
      this.queue.unshift(...batch);
    } finally {
      this.isFlushing = false;
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
