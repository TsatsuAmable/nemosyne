import { DataConnector } from './DataConnector.js';
import { rowsToDataset } from './normalize.js';

/**
 * HTTP polling-backed live data connector.
 *
 * Configuration:
 *  - url: REST endpoint URL.
 *  - topology: dataset topology hint (default: 'TIME_SERIES').
 *  - mode: 'replace' | 'append' | 'window'.
 *  - windowSize: rows to retain in window mode (default: 50).
 *  - intervalMs: poll cadence (default: 5000).
 *  - fetchOptions: options passed to fetch (headers, etc.).
 *  - parseResponse: (json) => { rows, topology?, name? } | null.
 *                     Required because most public REST APIs are not shaped as
 *                     a flat row array.
 */
export class PollingAdapter extends DataConnector {
  constructor({
    url,
    topology = 'TIME_SERIES',
    mode = 'window',
    windowSize = 50,
    intervalMs = 5000,
    fetchOptions = {},
    parseResponse,
  } = {}) {
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

  connect() {
    if (this._timer) return;
    this._setStatus('connecting');
    this._timer = true; // loop active; _tick will replace with real timeout
    this._tick();
  }

  disconnect() {
    this._clearTimer();
    this._abortController?.abort();
    this._abortController = null;
    this._setStatus('disconnected');
  }

  isConnected() {
    return this._timer != null;
  }

  _clearTimer() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  async _tick() {
    this._abortController = new AbortController();
    try {
      const res = await fetch(this.url, {
        ...this.fetchOptions,
        signal: this._abortController.signal,
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const json = await res.json();
      const parsed = this.parseResponse(json);
      if (parsed && parsed.rows && parsed.rows.length > 0) {
        const dataset = rowsToDataset(parsed.rows, parsed.name || 'Live Polling');
        this._emitUpdate({
          dataset,
          topology: parsed.topology || this.topology,
          mode: this.mode,
        });
      }
      this._setStatus('connected');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      this._setStatus('error', err?.message || String(err));
    } finally {
      this._abortController = null;
      if (this._timer != null || this.status === 'connecting') {
        this._timer = setTimeout(() => this._tick(), this.intervalMs);
      }
    }
  }
}
