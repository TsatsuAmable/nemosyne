import { DataConnector } from './DataConnector.js';
import { normalizeLiveMessage } from './normalize.js';

/**
 * WebSocket-backed live data connector.
 *
 * Configuration:
 *  - url: WebSocket URL (e.g. `wss://localhost:5173/__demo-stream`).
 *  - topology: dataset topology hint (default: 'TIME_SERIES').
 *  - mode: 'replace' | 'append' | 'window'. World-side buffer management is
 *          used for append/window; each message is treated as a delta.
 *  - windowSize: rows to retain in window mode (default: 50).
 *  - authToken: optional token sent as a sub-protocol or query param.
 *  - subscriptions: array of messages to send once the socket opens.
 *  - parseMessage: optional (payload) => { rows, topology?, name? } | null.
 *                    Lets adapters consume real-world APIs whose messages do
 *                    not already follow the Nemosyne `{ rows }` envelope.
 *  - binaryParser: optional (ArrayBuffer) => { rows, topology?, name? } | null.
 *                    Decodes binary frames (Arrow IPC, FlatBuffers, etc.).
 *  - reconnect: auto-reconnect on close (default: true).
 *  - reconnectDelay: ms between attempts (default: 3000).
 */
export class WebSocketAdapter extends DataConnector {
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
  } = {}) {
    super();
    if (!url) throw new Error('WebSocketAdapter requires a url');
    this.url = authToken ? `${url}?token=${encodeURIComponent(authToken)}` : url;
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

  connect() {
    if (this._ws) return;
    this._shouldReconnect = this.reconnect;
    this._setStatus('connecting');
    try {
      this._ws = new WebSocket(this.url);
    } catch (err) {
      this._setStatus('error', err?.message || String(err));
      this._scheduleReconnect();
      return;
    }

    this._ws.addEventListener('open', () => {
      this._setStatus('connected');
      for (const msg of this.subscriptions) {
        try {
          this._ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
        } catch (err) {
          this._setStatus('error', `Subscription send failed: ${err?.message || String(err)}`);
        }
      }
    });

    this._ws.addEventListener('message', (event) => {
      this._handleMessage(event.data);
    });

    this._ws.addEventListener('error', (event) => {
      const detail = event.message || 'WebSocket error';
      this._setStatus('error', detail);
    });

    this._ws.addEventListener('close', () => {
      this._ws = null;
      this._setStatus('disconnected');
      this._scheduleReconnect();
    });
  }

  disconnect() {
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

  isConnected() {
    return this._ws != null && this._ws.readyState === 1; // OPEN
  }

  _clearReconnect() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  _scheduleReconnect() {
    this._clearReconnect();
    if (!this._shouldReconnect || this.isConnected()) return;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      if (!this.isConnected()) this.connect();
    }, this.reconnectDelay);
  }

  _handleMessage(raw) {
    let payload;

    if (typeof raw === 'string') {
      try {
        payload = JSON.parse(raw);
      } catch (err) {
        this._setStatus('error', `Invalid JSON: ${err?.message || String(err)}`);
        return;
      }
    } else if (raw instanceof ArrayBuffer || ArrayBuffer.isView(raw)) {
      if (this.binaryParser) {
        try {
          payload = this.binaryParser(raw);
          if (!payload || !payload.rows || payload.rows.length === 0) return;
        } catch (err) {
          this._setStatus('error', `Binary parse failed: ${err?.message || String(err)}`);
          return;
        }
      } else {
        this._setStatus('error', 'Binary frame received but no binaryParser configured');
        return;
      }
    } else {
      payload = raw;
    }

    if (this.parseMessage && typeof payload === 'object') {
      try {
        const parsed = this.parseMessage(payload);
        if (!parsed || !parsed.rows || parsed.rows.length === 0) return;
        payload = parsed;
      } catch (err) {
        this._setStatus('error', `Parse failed: ${err?.message || String(err)}`);
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
    });
  }
}
