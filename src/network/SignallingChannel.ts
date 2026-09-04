import { clearStoredCollaborationInviteCredential } from './CollaborationInvite.ts';

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
export const SIGNALLING_CONNECT_TIMEOUT_MS = 8000;

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
  private _hasConnectedOnce = false;
  /** Optional callback to obtain a fresh admission credential for reconnect.
   *  When supplied, the channel calls it before each connection after the
   *  first successful one and sends the returned credential instead of the
   *  original. Canonical signed room tickets are one-use credentials: if one
   *  was used for the initial connection and no callback is available, the
   *  reconnect fails closed rather than replaying the consumed ticket.
   */
  onNeedReconnectTicket: (() => Promise<string | undefined>) | undefined;

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
      let transportOpened = false;
      let settled = false;
      let awaitingSignedAdmission = false;
      let activeAuthToken = this.token;
      let ws: WebSocket;
      let connectTimeout: ReturnType<typeof setTimeout> | null = null;
      try {
        const params = `room=${encodeURIComponent(this.roomId)}&peer=${encodeURIComponent(this.peerId)}&role=${this.role}`;
        // Credentials are never placed in the URL query string to prevent access-log exposure.
        ws = new WebSocket(`${this.url}?${params}`);
        this._ws = ws;
      } catch (err) {
        reject(err);
        return;
      }

      const clearConnectTimeout = () => {
        if (!connectTimeout) return;
        clearTimeout(connectTimeout);
        connectTimeout = null;
      };
      const resolveOnce = () => {
        if (settled) return;
        settled = true;
        clearConnectTimeout();
        resolve();
      };
      const rejectOnce = (error: unknown) => {
        if (settled) return;
        settled = true;
        clearConnectTimeout();
        reject(error instanceof Error ? error : new Error('signalling connection failed'));
      };
      const markConnected = () => {
        if (settled || this._ws !== ws || this._manualDisconnect) return;
        awaitingSignedAdmission = false;
        this._connected = true;
        this._flushQueue();
        this.dispatchEvent(new Event('open'));
        this._hasConnectedOnce = true;
        this._reconnectAttempt = 0;
        if (activeAuthToken?.includes('.')) {
          clearStoredCollaborationInviteCredential(activeAuthToken);
        }
        resolveOnce();
      };

      connectTimeout = setTimeout(() => {
        if (settled || this._ws !== ws) return;
        if (transportOpened && awaitingSignedAdmission) {
          this._manualDisconnect = true;
          rejectOnce(new Error('signalling admission timed out'));
        } else {
          rejectOnce(new Error('signalling connection timed out'));
        }
        try {
          ws.close();
        } catch {
          // The timeout rejection is authoritative even if transport teardown fails.
        }
      }, SIGNALLING_CONNECT_TIMEOUT_MS);

      ws.addEventListener('open', async () => {
        if (this._ws !== ws || this._manualDisconnect) return;
        transportOpened = true;
        // In-band authentication message sent immediately over every socket generation.
        // The server remains authoritative for the role associated with the token.
        activeAuthToken = this.token;
        if (this._hasConnectedOnce && this.onNeedReconnectTicket) {
          try {
            const freshTicket = await this.onNeedReconnectTicket();
            if (!freshTicket) {
              this.dispatchEvent(
                new CustomEvent('reconnect-failed', { detail: { reason: 'no-fresh-ticket' } })
              );
              ws.close();
              rejectOnce(new Error('reconnect failed: no fresh ticket'));
              return;
            }
            activeAuthToken = freshTicket;
          } catch {
            this.dispatchEvent(
              new CustomEvent('reconnect-failed', { detail: { reason: 'ticket-callback-error' } })
            );
            ws.close();
            rejectOnce(new Error('reconnect failed: ticket callback error'));
            return;
          }
        } else if (this._hasConnectedOnce && this.token?.includes('.')) {
          // Canonical signed room tickets contain a payload/signature separator
          // and their nonce is consumed on the first successful admission. A
          // second socket generation must not replay that credential merely
          // because no renewal authority was wired by the caller. Stop the
          // automatic loop after this deterministic failure; an explicit later
          // connect() call resets the flag so a newly-installed renewal provider
          // can retry deliberately.
          this.dispatchEvent(
            new CustomEvent('reconnect-failed', { detail: { reason: 'fresh-ticket-required' } })
          );
          this._manualDisconnect = true;
          ws.close();
          rejectOnce(new Error('reconnect failed: fresh signed ticket required'));
          return;
        }
        if (activeAuthToken) {
          const authMsg: SignallingMessage = {
            roomId: this.roomId,
            from: this.peerId,
            to: '*',
            data: { type: 'auth', token: activeAuthToken, role: this.role },
          };
          ws.send(JSON.stringify(authMsg));
        }

        // The standalone production service acknowledges canonical signed
        // tickets only after the synchronous admission authority accepts them.
        // Shared-secret and open development modes retain their legacy raw-open
        // semantics so the development signalling plugin is not turned into a
        // second production protocol implementation.
        awaitingSignedAdmission = Boolean(activeAuthToken?.includes('.'));
        if (!awaitingSignedAdmission) markConnected();
      });

      ws.addEventListener('message', (event: MessageEvent) => {
        if (this._ws !== ws) return;
        let payload: unknown;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
        if (
          awaitingSignedAdmission &&
          payload !== null &&
          typeof payload === 'object' &&
          !Array.isArray(payload) &&
          (payload as { type?: unknown }).type === 'admitted' &&
          (payload as { roomId?: unknown }).roomId === this.roomId
        ) {
          markConnected();
          return;
        }
        this.dispatchEvent(new CustomEvent('signal', { detail: payload }));
      });

      ws.addEventListener('close', (event: CloseEvent) => {
        if (this._ws !== ws) return;
        clearConnectTimeout();
        const signedAdmissionRejected = awaitingSignedAdmission && !settled && transportOpened;
        this._connected = false;
        this._ws = null;
        if (signedAdmissionRejected) {
          // A canonical signed credential that reached the service but was not
          // admitted is terminal for this automatic connection generation. Do
          // not hammer a replay/invalid ticket until the auth-failure throttle
          // fires; an explicit user retry can still reuse an unconsumed ticket.
          this._manualDisconnect = true;
          this.dispatchEvent(
            new CustomEvent('admission-failed', { detail: { code: event.code || undefined } })
          );
          rejectOnce(new Error('signalling admission rejected'));
        } else if (!settled) {
          rejectOnce(
            new Error(
              transportOpened
                ? 'signalling connection closed before admission'
                : 'signalling connection closed before opening'
            )
          );
        }
        this.dispatchEvent(new Event('close'));
        if (!this._manualDisconnect) this._scheduleReconnect();
      });

      ws.addEventListener('error', () => {
        if (this._ws !== ws) return;
        this.dispatchEvent(new Event('error'));
        if (!transportOpened) rejectOnce(new Error('signalling connection failed'));
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
