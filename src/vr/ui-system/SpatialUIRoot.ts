import * as THREE from 'three';
import { Fullscreen, Component, type FullscreenProperties } from '@pmndrs/uikit';

/**
 * SpatialUIRoot wraps pmndrs/uikit Fullscreen to serve as the root container
 * for 3D UI panels in Nemosyne. It manages layout updates and bridges
 * InputRouter raycasts into component pointer events.
 */
export class SpatialUIRoot extends Fullscreen {
  private _lastHoveredComponent: Component | null = null;
  private _capturedPointers: Map<number, Component> = new Map();

  constructor(renderer: THREE.WebGLRenderer, properties?: FullscreenProperties) {
    super(renderer, {
      flexDirection: 'column',
      pixelSize: 0.001, // 1mm per pixel scale
      ...properties,
    });
  }

  /**
   * Routes InputRouter pointer interaction down event.
   */
  handlePointerDown(raycaster: THREE.Raycaster, pointerId: number): Component | null {
    const hits = raycaster.intersectObject(this, true);
    if (hits.length === 0) return null;

    // Find the closest component that is not a helper mesh
    const hit = hits.find(h => h.object instanceof Component);
    if (!hit) return null;

    const component = hit.object as Component;
    
    // Dispatch pointerdown
    component.dispatchEvent({
      type: 'pointerdown',
      pointerId,
      ...hit,
    } as unknown as Parameters<Component['dispatchEvent']>[0]);

    // Click event is also dispatched on down/up sequences
    this._capturedPointers.set(pointerId, component);
    return component;
  }

  /**
   * Routes InputRouter pointer interaction move event.
   */
  handlePointerMove(raycaster: THREE.Raycaster, pointerId: number): Component | null {
    // If pointer is captured, route move directly to it
    const captured = this._capturedPointers.get(pointerId);
    
    const hits = raycaster.intersectObject(this, true);
    const hit = hits.find(h => h.object instanceof Component);
    const current = hit ? (hit.object as Component) : null;

    if (captured) {
      captured.dispatchEvent({
        type: 'pointermove',
        pointerId,
        ...(hit || {}),
      } as unknown as Parameters<Component['dispatchEvent']>[0]);
    }

    // Handle hover enter/leave (pointerover/pointerout)
    if (current !== this._lastHoveredComponent) {
      if (this._lastHoveredComponent) {
        this._lastHoveredComponent.dispatchEvent({
          type: 'pointerout',
          pointerId,
        } as unknown as Parameters<Component['dispatchEvent']>[0]);
        this._lastHoveredComponent.dispatchEvent({
          type: 'pointerleave',
          pointerId,
        } as unknown as Parameters<Component['dispatchEvent']>[0]);
      }
      if (current) {
        current.dispatchEvent({
          type: 'pointerover',
          pointerId,
          ...(hit || {}),
        } as unknown as Parameters<Component['dispatchEvent']>[0]);
        current.dispatchEvent({
          type: 'pointerenter',
          pointerId,
          ...(hit || {}),
        } as unknown as Parameters<Component['dispatchEvent']>[0]);
      }
      this._lastHoveredComponent = current;
    } else if (current && !captured) {
      current.dispatchEvent({
        type: 'pointermove',
        pointerId,
        ...hit,
      } as unknown as Parameters<Component['dispatchEvent']>[0]);
    }

    return current;
  }

  /**
   * Routes InputRouter pointer interaction up event.
   */
  handlePointerUp(raycaster: THREE.Raycaster, pointerId: number): Component | null {
    const captured = this._capturedPointers.get(pointerId);
    this._capturedPointers.delete(pointerId);

    const hits = raycaster.intersectObject(this, true);
    const hit = hits.find(h => h.object instanceof Component);
    const current = hit ? (hit.object as Component) : null;

    const target = captured || current;
    if (target) {
      target.dispatchEvent({
        type: 'pointerup',
        pointerId,
        ...(hit || {}),
      } as unknown as Parameters<Component['dispatchEvent']>[0]);

      // If released on the same target that was pressed, trigger click
      if (captured === current && current) {
        current.dispatchEvent({
          type: 'click',
          pointerId,
          ...(hit || {}),
        } as unknown as Parameters<Component['dispatchEvent']>[0]);
      }
    }

    return current;
  }

  /**
   * Cancel pointer capture (e.g. if the pointer leaves the UI region completely).
   */
  handlePointerCancel(pointerId: number): void {
    const captured = this._capturedPointers.get(pointerId);
    if (captured) {
      this._capturedPointers.delete(pointerId);
      captured.dispatchEvent({
        type: 'pointercancel',
        pointerId,
      } as unknown as Parameters<Component['dispatchEvent']>[0]);
    }
  }

  override dispose(): void {
    super.dispose();
    this._capturedPointers.clear();
    this._lastHoveredComponent = null;
  }
}
