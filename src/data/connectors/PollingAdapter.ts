import { DataConnector, type LiveUpdate } from './DataConnector.ts';

export interface PollingAdapterOptions {
  url: string;
  topology?: string;
  mode?: string;
  windowSize?: number;
  intervalMs?: number;
  fetchOptions?: RequestInit;
  parseResponse: (json: unknown) => { rows: Record<string, unknown>[]; topology?: string; name?: string } | null;
}

/**
 * HTTP polling-backed live data connector.
 */
export class PollingAdapter extends DataConnector {
  url: string;
  topology: string;
  mode: string;
  windowSize: number;
  intervalMs: number;
  fetchOptions: RequestInit;
  parseResponse: PollingAdapterOptions['parseResponse'];

  private _timer: ReturnType<typeof setTimeout> | boolean | null;
  private _abortController: AbortController | null;
  // Lifecycle generation. Every connect/disconnect retires the previous
  // generation so a still-settling tick can never clear the live
  // generation's AbortController or arm a duplicate timer (RFL-0005).
  private _generation = 0;

  constructor({
    url,
    topology = 'TIME_SERIES',
    mode = 'window',
    windowSize = 50,
    intervalMs = 5000,
    fetchOptions = {},
    parseResponse,
  }: PollingAdapterOptions) {
    super();
    if (!url) throw new Error('PollingAdapter requires a url');
    if (typeof parseResponse !== 'function')
      throw new Error('PollingAdapter requires parseResponse');

    this.url = url;
    this.topology = topology;
    this.mode = mode;
    this.windowSize = windowSize;
    this.intervalMs = intervalMs;
    this.fetchOptions = fetchOptions;
    this.parseResponse = parseResponse;

    this._timer = null;
    this._abortController = null;
  }

  connect(): void {
    if (this._timer) return;
    this._generation += 1;
    this._setStatus('connecting');
    this._timer = true; // loop active; _tick will replace with real timeout
    this._tick();
  }

  disconnect(): void {
    this._generation += 1;
    this._clearTimer();
    this._abortController?.abort();
    this._abortController = null;
    this._setStatus('disconnected');
  }

  isConnected(): boolean {
    return this._timer != null;
  }

  private _clearTimer(): void {
    if (this._timer && typeof this._timer !== 'boolean') {
      clearTimeout(this._timer);
    }
    this._timer = null;
  }

  private async _tick(): Promise<void> {
    const generation = this._generation;
    this._abortController = new AbortController();
    try {
      const res = await fetch(this.url, {
        ...this.fetchOptions,
        signal: this._abortController.signal,
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const json: unknown = await res.json();
      const parsed = this.parseResponse(json);
      if (parsed && parsed.rows && parsed.rows.length > 0) {
        this._emitUpdate({
          rows: parsed.rows,
          name: parsed.name || 'Live Polling',
          topology: parsed.topology || this.topology,
          mode: this.mode,
        } as LiveUpdate);
      }
      this._setStatus('connected');
    } catch (err) {
      const e = err as Error;
      if (e?.name === 'AbortError') return;
      this._setStatus('error', e?.message || String(err));
    } finally {
      // A tick from a retired generation must not touch the live
      // generation's controller or arm a second timer.
      if (generation === this._generation) {
        this._abortController = null;
        if (this._timer != null || this.status === 'connecting') {
          this._timer = setTimeout(() => this._tick(), this.intervalMs);
        }
      }
    }
  }
}
