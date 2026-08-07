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

export class SignallingChannel extends EventTarget {
  url: string;
  roomId: string;
  peerId: string;
  _ws: WebSocket | null = null;
  _connected: boolean = false;
  _queue: SignallingMessage[] = [];

  constructor(url: string, roomId: string, peerId: string) {
    super();
    this.url = url;
    this.roomId = roomId;
    this.peerId = peerId;
  }

  get isOpen(): boolean {
    return this._ws?.readyState === WebSocket.OPEN && this._connected;
  }

  connect(): Promise<void> {
    if (this._ws) return Promise.resolve();
    return new Promise((resolve, reject) => {
      try {
        this._ws = new WebSocket(
          `${this.url}?room=${encodeURIComponent(this.roomId)}&peer=${encodeURIComponent(this.peerId)}`
        );
      } catch (err) {
        reject(err);
        return;
      }

      this._ws.addEventListener('open', () => {
        this._connected = true;
        this._flushQueue();
        this.dispatchEvent(new Event('open'));
        resolve();
      });

      this._ws.addEventListener('message', (event: MessageEvent) => {
        let payload: unknown;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
        this.dispatchEvent(new CustomEvent('signal', { detail: payload }));
      });

      this._ws.addEventListener('close', () => {
        this._connected = false;
        this.dispatchEvent(new Event('close'));
      });

      this._ws.addEventListener('error', (err) => {
        this.dispatchEvent(new Event('error'));
        reject(err);
      });
    });
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
    this._connected = false;
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._queue = [];
  }
}
