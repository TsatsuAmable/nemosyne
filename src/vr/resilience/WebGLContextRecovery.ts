/**
 * WebGL Context Loss & Auto-Recovery Manager.
 *
 * Intercepts `webglcontextlost` and `webglcontextrestored` events on the Three.js
 * canvas, prevents default browser termination, and restores the spatial scene
 * and material shaders from the authoritative Investigation aggregate.
 */

export interface ContextRecoveryDelegate {
  onContextLost(): void;
  onContextRestored(): Promise<void> | void;
}

export type ContextState = 'active' | 'lost' | 'restoring';

export class WebGLContextRecovery {
  private readonly _canvas: HTMLCanvasElement;
  private readonly _delegate: ContextRecoveryDelegate;
  private _state: ContextState = 'active';
  private _lossTimestamp = 0;
  private _recoveryCount = 0;

  private readonly _lostHandler: (e: Event) => void;
  private readonly _restoredHandler: (e: Event) => void;

  constructor(canvas: HTMLCanvasElement, delegate: ContextRecoveryDelegate) {
    this._canvas = canvas;
    this._delegate = delegate;

    this._lostHandler = (e: Event) => this._handleContextLost(e);
    this._restoredHandler = (e: Event) => this._handleContextRestored(e);

    this._canvas.addEventListener('webglcontextlost', this._lostHandler, false);
    this._canvas.addEventListener('webglcontextrestored', this._restoredHandler, false);
  }

  get state(): ContextState {
    return this._state;
  }

  get recoveryCount(): number {
    return this._recoveryCount;
  }

  get lossDurationMs(): number {
    return this._state === 'lost' || this._state === 'restoring'
      ? Date.now() - this._lossTimestamp
      : 0;
  }

  private _handleContextLost(event: Event): void {
    event.preventDefault();
    this._state = 'lost';
    this._lossTimestamp = Date.now();
    this._delegate.onContextLost();
  }

  private async _handleContextRestored(_event: Event): Promise<void> {
    this._state = 'restoring';
    try {
      await this._delegate.onContextRestored();
      this._state = 'active';
      this._recoveryCount += 1;
    } catch {
      this._state = 'lost';
    }
  }

  /**
   * Diagnostic simulation hook for test environments and E2E resilience assertions.
   */
  async simulateContextLossAndRecovery(restorationDelayMs = 10): Promise<boolean> {
    const lostEvent = new Event('webglcontextlost', { cancelable: true });
    this._canvas.dispatchEvent(lostEvent);

    if (restorationDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, restorationDelayMs));
    }

    const restoredEvent = new Event('webglcontextrestored');
    await this._handleContextRestored(restoredEvent);
    return this._state === 'active';
  }

  dispose(): void {
    this._canvas.removeEventListener('webglcontextlost', this._lostHandler);
    this._canvas.removeEventListener('webglcontextrestored', this._restoredHandler);
  }
}
