/**
 * Minimal WebSocket signalling channel for Nemosyne collaboration rooms.
 *
 * Used to exchange SDP offers/answers and ICE candidates between peers before
 * the WebRTC data channel is established. The server is intentionally simple:
 * it only forwards messages by room ID.
 */

export interface SignallingMessage {
  roomId: string;
  from: string;
  to: string;
  data: unknown;
}

const RECONNECT_BASE_DELAY_MS = 250;
const RECONNECT_MAX_DELAY_MS = 5000;

export class SignallingChannel extends EventTarget {
  url: string;
  roomId: string;
  peerId: string;
  role: 'participant' | 'observer';
  token: string | undefined;
  _ws: WebSocket | null = null;
  _connected: boolean = false;
  _queue: SignallingMessage[] = [];
  private _connectPromise: Promise<void> | null = null;
  private _manualDisconnect = false;
  private _reconnectAttempt = 0;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    url: string,
    roomId: string,
    peerId: string,
    token?: string,
    role: 'participant' | 'observer' = 'participant'
  ) {
    super();
    this.url = url;
    this.roomId = roomId;
    this.peerId = peerId;
    this.token = token;
    this.role = role;
  }

  get isOpen(): boolean {
    return this._ws?.readyState === WebSocket.OPEN && this._connected;
  }

  connect(): Promise<void> {
    this._manualDisconnect = false;
    if (this.isOpen) return Promise.resolve();
    if (this._connectPromise) return this._connectPromise;

    const promise = this._openSocket();
    this._connectPromise = promise;
    void promise.finally(() => {
      if (this._connectPromise === promise) this._connectPromise = null;
    }).catch(() => {
      // The caller (or automatic reconnect loop) owns the original rejection.
    });
    return promise;
  }

  private _openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      let opened = false;
      let settled = false;
      let ws: WebSocket;
      try {
        const params = `room=${encodeURIComponent(this.roomId)}&peer=${encodeURIComponent(this.peerId)}&role=${this.role}`;
        // Credentials are never placed in the URL query string to prevent access-log exposure.
        ws = new WebSocket(`${this.url}?${params}`);
        this._ws = ws;
      } catch (err) {
        reject(err);
        return;
      }

      const resolveOnce = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const rejectOnce = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error instanceof Error ? error : new Error('signalling connection failed'));
      };

      ws.addEventListener('open', () => {
        if (this._ws !== ws || this._manualDisconnect) return;
        opened = true;
        this._connected = true;
        this._reconnectAttempt = 0;
        // In-band authentication message sent immediately over every socket generation.
        // The server remains authoritative for the role associated with the token.
        if (this.token) {
          const authMsg: SignallingMessage = {
            roomId: this.roomId,
            from: this.peerId,
            to: '*',
            data: { type: 'auth', token: this.token, role: this.role },
          };
          ws.send(JSON.stringify(authMsg));
        }
        this._flushQueue();
        this.dispatchEvent(new Event('open'));
        resolveOnce();
      });

      ws.addEventListener('message', (event: MessageEvent) => {
        if (this._ws !== ws) return;
        let payload: unknown;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
        this.dispatchEvent(new CustomEvent('signal', { detail: payload }));
      });

      ws.addEventListener('close', () => {
        if (this._ws !== ws) return;
        this._connected = false;
        this._ws = null;
        this.dispatchEvent(new Event('close'));
        if (!opened) rejectOnce(new Error('signalling connection closed before opening'));
        if (!this._manualDisconnect) this._scheduleReconnect();
      });

      ws.addEventListener('error', () => {
        if (this._ws !== ws) return;
        this.dispatchEvent(new Event('error'));
        if (!opened) rejectOnce(new Error('signalling connection failed'));
      });
    });
  }

  private _scheduleReconnect(): void {
    if (this._manualDisconnect || this._reconnectTimer || this.isOpen) return;
    const attempt = this._reconnectAttempt + 1;
    const delayMs = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** Math.min(this._reconnectAttempt, 5),
      RECONNECT_MAX_DELAY_MS
    );
    this._reconnectAttempt = attempt;
    this.dispatchEvent(new CustomEvent('reconnecting', { detail: { attempt, delayMs } }));
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      if (this._manualDisconnect || this.isOpen) return;
      void this.connect().catch(() => this._scheduleReconnect());
    }, delayMs);
  }

  sendSignal(to: string, data: unknown): void {
    const message: SignallingMessage = {
      roomId: this.roomId,
      from: this.peerId,
      to,
      data,
    };
    if (this.isOpen && this._ws) {
      this._ws.send(JSON.stringify(message));
    } else {
      if (this._queue.length >= 100) {
        this._queue.shift(); // Drop oldest message if queue grows too large during disconnect
      }
      this._queue.push(message);
    }
  }

  broadcastSignal(data: unknown): void {
    this.sendSignal('*', data);
  }

  _flushQueue(): void {
    while (this._queue.length > 0) {
      const msg = this._queue.shift();
      if (msg && this._ws) {
        this._ws.send(JSON.stringify(msg));
      }
    }
  }

  disconnect(): void {
    this._manualDisconnect = true;
    this._connected = false;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    const ws = this._ws;
    this._ws = null;
    if (ws) ws.close();
    this._queue = [];
  }
}
