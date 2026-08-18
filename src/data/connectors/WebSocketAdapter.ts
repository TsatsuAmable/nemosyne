import { DataConnector, type LiveUpdate } from './DataConnector.ts';
import { normalizeLiveMessage, type LiveMessage } from './normalize.ts';

export interface ParsedMessageEnvelope {
  rows: Record<string, unknown>[];
  topology?: string;
  name?: string;
}

export interface WebSocketAdapterOptions {
  url: string;
  topology?: string;
  mode?: string;
  windowSize?: number;
  authToken?: string | null;
  subscriptions?: unknown[];
  parseMessage?: ((payload: Record<string, unknown>) => ParsedMessageEnvelope | null) | null;
  binaryParser?: ((raw: ArrayBuffer | ArrayBufferView) => ParsedMessageEnvelope | null) | null;
  reconnect?: boolean;
  reconnectDelay?: number;
}

/**
 * WebSocket-backed live data connector.
 */
export class WebSocketAdapter extends DataConnector {
  url: string;
  topology: string;
  mode: string;
  windowSize: number;
  subscriptions: unknown[];
  parseMessage: WebSocketAdapterOptions['parseMessage'];
  binaryParser: WebSocketAdapterOptions['binaryParser'];
  reconnect: boolean;
  reconnectDelay: number;

  authToken: string | null;

  private _ws: WebSocket | null;
  private _shouldReconnect: boolean;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null;

  constructor({
    url,
    topology = 'TIME_SERIES',
    mode = 'window',
    windowSize = 50,
    authToken = null,
    subscriptions = [],
    parseMessage = null,
    binaryParser = null,
    reconnect = true,
    reconnectDelay = 3000,
  }: WebSocketAdapterOptions) {
    super();
    if (!url) throw new Error('WebSocketAdapter requires a url');
    this.url = url;
    this.authToken = authToken;
    this.topology = topology;
    this.mode = mode;
    this.windowSize = windowSize;
    this.subscriptions = subscriptions;
    this.parseMessage = parseMessage;
    this.binaryParser = binaryParser;

    this.reconnect = reconnect;
    this.reconnectDelay = reconnectDelay;

    this._ws = null;
    this._shouldReconnect = false;
    this._reconnectTimer = null;
  }

  connect(): void {
    if (this._ws) return;
    this._shouldReconnect = this.reconnect;
    this._setStatus('connecting');
    try {
      this._ws = new WebSocket(this.url);
    } catch (err) {
      const e = err as Error;
      this._setStatus('error', e?.message || String(err));
      this._scheduleReconnect();
      return;
    }

    this._ws.addEventListener('open', () => {
      this._setStatus('connected');
      if (this.authToken) {
        try {
          this._ws!.send(JSON.stringify({ type: 'auth', token: this.authToken }));
        } catch (err) {
          const e = err as Error;
          this._setStatus('error', `Auth send failed: ${e?.message || String(err)}`);
        }
      }
      for (const msg of this.subscriptions) {
        try {
          this._ws!.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
        } catch (err) {
          const e = err as Error;
          this._setStatus('error', `Subscription send failed: ${e?.message || String(err)}`);
        }
      }
    });

    this._ws.addEventListener('message', (event) => {
      this._handleMessage(event.data);
    });

    this._ws.addEventListener('error', (event) => {
      const detail = (event as ErrorEvent).message || 'WebSocket error';
      this._setStatus('error', detail);
    });

    this._ws.addEventListener('close', () => {
      this._ws = null;
      this._setStatus('disconnected');
      this._scheduleReconnect();
    });
  }

  disconnect(): void {
    this._shouldReconnect = false;
    this._clearReconnect();
    if (this._ws) {
      try {
        this._ws.close();
      } catch {
        // ignore
      }
      this._ws = null;
    }
    this._setStatus('disconnected');
  }

  isConnected(): boolean {
    return this._ws != null && this._ws.readyState === 1; // OPEN
  }

  private _clearReconnect(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  private _scheduleReconnect(): void {
    this._clearReconnect();
    if (!this._shouldReconnect || this.isConnected()) return;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      if (!this.isConnected()) this.connect();
    }, this.reconnectDelay);
  }

  private _handleMessage(raw: string | ArrayBuffer | ArrayBufferView | unknown): void {
    let payload: LiveMessage | unknown;

    if (typeof raw === 'string') {
      try {
        payload = JSON.parse(raw);
      } catch (err) {
        const e = err as Error;
        this._setStatus('error', `Invalid JSON: ${e?.message || String(err)}`);
        return;
      }
    } else if (raw instanceof ArrayBuffer || ArrayBuffer.isView(raw)) {
      if (this.binaryParser) {
        try {
          payload = this.binaryParser(raw);
          const parsed = payload as ParsedMessageEnvelope | null;
          if (!parsed || !parsed.rows || parsed.rows.length === 0) return;
        } catch (err) {
          const e = err as Error;
          this._setStatus('error', `Binary parse failed: ${e?.message || String(err)}`);
          return;
        }
      } else {
        this._setStatus('error', 'Binary frame received but no binaryParser configured');
        return;
      }
    } else {
      payload = raw;
    }

    if (this.parseMessage && typeof payload === 'object' && payload !== null) {
      try {
        const parsed = this.parseMessage(payload as Record<string, unknown>);
        if (!parsed || !parsed.rows || parsed.rows.length === 0) return;
        payload = parsed;
      } catch (err) {
        const e = err as Error;
        this._setStatus('error', `Parse failed: ${e?.message || String(err)}`);
        return;
      }
    }

    const normalized = normalizeLiveMessage(payload, this.topology);
    if (!normalized) {
      this._setStatus('error', 'Message missing rows or dataset');
      return;
    }

    this._emitUpdate({
      dataset: normalized.dataset,
      topology: normalized.topology,
      mode: this.mode,
    } as LiveUpdate);
  }
}
