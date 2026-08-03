/**
 * Minimal WebSocket signalling channel for Nemosyne collaboration rooms.
 *
 * Used to exchange SDP offers/answers and ICE candidates between peers before
 * the WebRTC data channel is established. The server is intentionally simple:
 * it only forwards messages by room ID.
 */

export class SignallingChannel extends EventTarget {
  constructor(url, roomId, peerId) {
    super();
    this.url = url;
    this.roomId = roomId;
    this.peerId = peerId;
    this._ws = null;
    this._connected = false;
    this._queue = [];
  }

  get isOpen() {
    return this._ws?.readyState === WebSocket.OPEN && this._connected;
  }

  connect() {
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

      this._ws.addEventListener('message', (event) => {
        let payload;
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

  sendSignal(to, data) {
    const message = {
      roomId: this.roomId,
      from: this.peerId,
      to,
      data,
    };
    if (this.isOpen) {
      this._ws.send(JSON.stringify(message));
    } else {
      this._queue.push(message);
    }
  }

  broadcastSignal(data) {
    this.sendSignal('*', data);
  }

  _flushQueue() {
    while (this._queue.length > 0) {
      const msg = this._queue.shift();
      this._ws.send(JSON.stringify(msg));
    }
  }

  disconnect() {
    this._connected = false;
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._queue = [];
  }
}
