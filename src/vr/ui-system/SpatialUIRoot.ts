import * as THREE from 'three';
import { Fullscreen, Component, type FullscreenProperties } from '@pmndrs/uikit';
import {
  bubbleScrollAwareDown,
  bubbleToScrollableAncestors,
  dispatchScrollAwareDown,
  intersectUIKitComponents,
  isPanelRootVisible,
  isScrollableContainer,
  resolveActionableHit,
  syntheticNativeEvent,
  syntheticPointerEvent,
} from './raycastUIKit.ts';

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
    if (!isPanelRootVisible(this)) return null;
    const hits = intersectUIKitComponents(this, raycaster);
    if (hits.length === 0) return null;

    const hit = resolveActionableHit(this, raycaster, hits[0]);
    const component = hit.object as Component;

    // Dispatch pointerdown
    const event = syntheticPointerEvent('pointerdown', pointerId, hit);
    dispatchScrollAwareDown(component, event, pointerId);
    bubbleScrollAwareDown(component, event, pointerId);

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

    if (!isPanelRootVisible(this)) {
      if (this._lastHoveredComponent) {
        this._lastHoveredComponent.dispatchEvent({
          type: 'pointerout',
          pointerId,
          nativeEvent: syntheticNativeEvent(),
        } as unknown as Parameters<Component['dispatchEvent']>[0]);
        this._lastHoveredComponent.dispatchEvent({
          type: 'pointerleave',
          pointerId,
          nativeEvent: syntheticNativeEvent(),
        } as unknown as Parameters<Component['dispatchEvent']>[0]);
        this._lastHoveredComponent = null;
      }
      return null;
    }

    const hits = intersectUIKitComponents(this, raycaster);
    const hit = hits.length > 0 ? resolveActionableHit(this, raycaster, hits[0]) : null;
    const current = hit ? (hit.object as Component) : null;

    if (captured) {
      // Re-raycast the captured component alone so the dispatched `uv` is local
      // to the captured component. The panel-wide `hit` above may belong to a
      // foreign component the ray is now grazing (the pointer drifted off the
      // captured control during a drag); spreading that hit's `uv` would make a
      // Slider thumb jump to a foreign coordinate. Mirrors SpatialPanel's fix.
      // A miss on a scrollable container dispatches nothing: UIKit's scroll
      // move handler requires `event.point`, which a miss cannot provide.
      const capturedHits = raycaster.intersectObject(captured, false);
      const capturedHit = capturedHits.length > 0 ? capturedHits[0] : null;
      if (capturedHit || !isScrollableContainer(captured)) {
        const event = syntheticPointerEvent('pointermove', pointerId, capturedHit || {});
        captured.dispatchEvent(
          event as unknown as Parameters<Component['dispatchEvent']>[0]
        );
        if (capturedHit) bubbleToScrollableAncestors(captured, event);
      }
      if (!capturedHit && hit && current) {
        // The ray left the captured control but still hits live geometry:
        // scroll ancestors of the current hit keep a drag alive with the
        // real current point while the captured control holds.
        const currentEvent = syntheticPointerEvent('pointermove', pointerId, hit);
        bubbleToScrollableAncestors(current, currentEvent);
      }
    }

    // Handle hover enter/leave (pointerover/pointerout)
    if (current !== this._lastHoveredComponent) {
      if (this._lastHoveredComponent) {
        this._lastHoveredComponent.dispatchEvent({
          type: 'pointerout',
          pointerId,
          nativeEvent: syntheticNativeEvent(),
        } as unknown as Parameters<Component['dispatchEvent']>[0]);
        this._lastHoveredComponent.dispatchEvent({
          type: 'pointerleave',
          pointerId,
          nativeEvent: syntheticNativeEvent(),
        } as unknown as Parameters<Component['dispatchEvent']>[0]);
      }
      if (current) {
        current.dispatchEvent({
          type: 'pointerover',
          pointerId,
          nativeEvent: syntheticNativeEvent(),
          ...(hit || {}),
        } as unknown as Parameters<Component['dispatchEvent']>[0]);
        current.dispatchEvent({
          type: 'pointerenter',
          pointerId,
          nativeEvent: syntheticNativeEvent(),
          ...(hit || {}),
        } as unknown as Parameters<Component['dispatchEvent']>[0]);
      }
      this._lastHoveredComponent = current;
    } else if (current && !captured) {
      current.dispatchEvent({
        type: 'pointermove',
        pointerId,
        nativeEvent: syntheticNativeEvent(),
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

    const hits = isPanelRootVisible(this) ? intersectUIKitComponents(this, raycaster) : [];
    const hit = hits.length > 0 ? resolveActionableHit(this, raycaster, hits[0]) : null;
    const current = hit ? (hit.object as Component) : null;

    const target = captured || current;
    if (target) {
      const event = syntheticPointerEvent('pointerup', pointerId, hit || {});
      target.dispatchEvent(
        event as unknown as Parameters<Component['dispatchEvent']>[0]
      );
      bubbleToScrollableAncestors(target, event);

      // If released on the same target that was pressed, trigger click
      if (captured === current && current) {
        current.dispatchEvent({
          type: 'click',
          pointerId,
          nativeEvent: syntheticNativeEvent(),
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
      const event = syntheticPointerEvent('pointercancel', pointerId, {});
      captured.dispatchEvent(
        event as unknown as Parameters<Component['dispatchEvent']>[0]
      );
      bubbleToScrollableAncestors(captured, event);
    }
  }

  override dispose(): void {
    super.dispose();
    this._capturedPointers.clear();
    this._lastHoveredComponent = null;
  }
}
