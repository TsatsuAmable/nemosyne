import * as THREE from 'three';
import { Component, Text } from '@pmndrs/uikit';

/**
 * True when the object and every ancestor up to the scene root is visible.
 *
 * `THREE.Raycaster` ignores `visible`, so hit-testing must gate on
 * visibility explicitly. This plain-chain check is correct for ordinary
 * three.js objects (scene anchors, grab-rail meshes, legacy non-UIKit
 * panels) and for the ancestry ABOVE a UIKit root — but it must NOT be
 * applied to UIKit descendants: `Container`/`Text` are `isRenderless`, so
 * UIKit drives their `Object3D.visible` from render-traversal membership
 * and a perfectly live child control is routinely `visible === false`
 * while its instanced content renders and hit-tests normally. Use
 * {@link isUIKitComponentVisible} (the `isVisible` signal) for descendants.
 */
export function isWorldVisible(object: THREE.Object3D | null | undefined): boolean {
  let current: THREE.Object3D | null = object ?? null;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

type VisibleSignalAware = { isVisible?: { value?: unknown; peek?: () => unknown } };

/**
 * UIKit's own per-component visibility: displayed, unclipped, and
 * `visibility: 'visible'`. This is the correct gate for UIKit descendants,
 * independent of the render-traversal `Object3D.visible` flag.
 */
export function isUIKitComponentVisible(component: THREE.Object3D): boolean {
  const signal = (component as unknown as VisibleSignalAware).isVisible;
  const value =
    typeof signal?.peek === 'function' ? signal.peek() : signal?.value;
  return value !== false;
}

/**
 * True when a UIKit panel root may interact: the root's own `visible`
 * flag (the user hide/show switch), the plain-object ancestry above it,
 * and the root's UIKit `isVisible` signal.
 */
export function isPanelRootVisible(root: THREE.Object3D): boolean {
  if (!root.visible) return false;
  let current = root.parent;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  if (root instanceof Component && !isUIKitComponentVisible(root)) return false;
  return true;
}

type PointerEventsAware = { pointerEvents?: unknown };
type PropertiesAware = { properties?: { value?: { pointerEvents?: unknown } } };

function isPointerEventsNone(component: THREE.Object3D): boolean {
  const declared = (component as unknown as PropertiesAware).properties?.value?.pointerEvents;
  if (declared === 'none') return true;
  return (component as unknown as PointerEventsAware).pointerEvents === 'none';
}

type ScrollableAware = { scrollable?: { value?: readonly unknown[] } };

/** True when the component is a scrollable UIKit container (either axis). */
export function isScrollableContainer(component: THREE.Object3D): boolean {
  const scrollable = (component as unknown as ScrollableAware).scrollable?.value;
  return Array.isArray(scrollable) && scrollable.some((axis) => axis === true);
}

/**
 * Intersect real UIKit panel geometry with a raycaster.
 *
 * `Component.raycast` always returns `false`, and Three's `Raycaster`
 * treats that as "do not recurse into children" — so
 * `raycaster.intersectObject(panel, true)` tests the panel background only
 * and every control inside is unreachable ( Quest browser proof: a 200x200
 * parent with a 100x100 child reports only the parent hit recursively,
 * while the child hit-tests directly). Instead, collect the live
 * descendant components and intersect them non-recursively
 * (`recursive: false`), which exercises each component's real
 * bounding-sphere + panel-matrix + clipping test.
 *
 * Targets are gated on the UIKit `isVisible` signal (never on
 * `Object3D.visible`, which renderless containers clear during normal
 * rendering) and `pointerEvents: 'none'` components are excluded so the
 * ray passes through them to whatever is behind, matching library
 * pointer-events semantics. `Text` stays a target — it owns real panel
 * geometry — and {@link resolveActionableHit} maps such hits to the
 * nearest actionable ancestor, emulating the library's bubbling that
 * `THREE.EventDispatcher` does not provide.
 *
 * Results are sorted nearest-first with UIKit's order bias (controls
 * before their background) applied inside each component's raycast.
 */
export function intersectUIKitComponents(
  root: THREE.Object3D,
  raycaster: THREE.Raycaster
): THREE.Intersection[] {
  if (!isPanelRootVisible(root)) return [];
  root.updateMatrixWorld(true);
  const targets: THREE.Object3D[] = [];
  root.traverse((node) => {
    if (
      node instanceof Component &&
      isUIKitComponentVisible(node) &&
      !isPointerEventsNone(node)
    ) {
      targets.push(node);
    }
  });
  if (targets.length === 0) return [];
  return raycaster.intersectObjects(targets, false);
}

/**
 * Map a raw UIKit hit to the nearest actionable dispatch target, walking
 * up past `Text` leaves (real geometry, but listeners live on their
 * parents) toward the root. When the walk moves, the ancestor is
 * re-raycast alone so the dispatched `uv`/`point` are local to the actual
 * target rather than the leaf that was hit.
 */
export function resolveActionableHit(
  root: THREE.Object3D,
  raycaster: THREE.Raycaster,
  hit: THREE.Intersection
): THREE.Intersection {
  let current: THREE.Object3D | null = hit.object;
  while (current instanceof Text && current !== root && current.parent) {
    current = current.parent;
  }
  if (!current || current === hit.object) return hit;
  const fresh = raycaster.intersectObject(current, false);
  if (fresh.length > 0) return fresh[0];
  return { ...hit, object: current };
}

/**
 * Hit-test one registered panel mesh of either substrate: UIKit roots go
 * through the shared component traversal; legacy non-UIKit panel meshes
 * keep their direct background hit-test. Used by panel-vs-scene ordering
 * so hover, desktop cursor, and trace gaze agree with the press path.
 */
export function intersectPanelMesh(
  mesh: THREE.Object3D,
  raycaster: THREE.Raycaster
): THREE.Intersection[] {
  if (mesh instanceof Component) return intersectUIKitComponents(mesh, raycaster);
  if (!isWorldVisible(mesh)) return [];
  mesh.updateMatrixWorld(true);
  return raycaster.intersectObject(mesh, false);
}

/**
 * Fresh `nativeEvent` stub for synthetically dispatched pointer events.
 *
 * UIKit's scroll bookkeeping (`scroll.js`) reads and writes a symbol key on
 * `event.nativeEvent` for every drag/wheel scroll. Synthetic events without
 * `nativeEvent` crash inside the scroll handler on the first drag over a
 * scrollable container. Each dispatch needs its own object so nested scroll
 * containers cannot observe a stale was-scrolled flag.
 *
 * The stub deliberately carries no `pointerType`: XR pointers are not mice,
 * so UIKit takes the touch-style panel-drag path rather than the
 * mouse-only scrollbar-thumb path.
 */
export function syntheticNativeEvent(): Record<string, unknown> {
  return {};
}

export type SyntheticPointerEvent = Record<string, unknown> & {
  stopImmediatePropagation: () => void;
};

/**
 * Build a synthetic pointer event compatible with UIKit's internal
 * handlers: a fresh `nativeEvent` for scroll bookkeeping plus a working
 * `stopImmediatePropagation` for the ancestor bubble walk.
 */
export function syntheticPointerEvent(
  type: string,
  pointerId: number,
  payload: object
): SyntheticPointerEvent {
  const event = {
    type,
    pointerId,
    nativeEvent: syntheticNativeEvent(),
    ...payload,
  } as Record<string, unknown> & { stopImmediatePropagation?: () => void };
  event.stopImmediatePropagation = () => {
    (event as unknown as { __stopped?: boolean }).__stopped = true;
  };
  return event as SyntheticPointerEvent;
}

function isEventStopped(event: object): boolean {
  return (event as unknown as { __stopped?: boolean }).__stopped === true;
}

function clearEventStopped(event: object): void {
  delete (event as unknown as { __stopped?: boolean }).__stopped;
}

type DownPointerMapAware = { downPointerMap?: Map<unknown, unknown> };

/**
 * Deliver an already-dispatched pointer event to scrollable UIKit ancestors
 * (inner to outer), emulating the library's bubbling phase that
 * `THREE.EventDispatcher` does not provide. Without this, pressing a
 * control inside a scroll container never starts a scroll drag: the
 * container's own `onPointerDown` (which records `downPointerMap`) only
 * fires for the bubble. A `stopImmediatePropagation` call from any
 * ancestor ends the walk, matching library semantics.
 *
 * Only scrollable ancestors are visited: controls keep their existing
 * no-bubble dispatch so a press cannot double-trigger ancestor listeners.
 * Callers must only bubble events carrying a valid `point` for move/drag;
 * down/up/finish handlers are point-independent for the finish path.
 */
export function bubbleToScrollableAncestors(target: THREE.Object3D, event: object): void {
  let ancestor = target.parent;
  while (ancestor && !isEventStopped(event)) {
    const next = ancestor.parent;
    if (ancestor instanceof Component && isScrollableContainer(ancestor)) {
      ancestor.dispatchEvent(
        event as unknown as Parameters<Component['dispatchEvent']>[0]
      );
    }
    ancestor = next;
  }
}

/**
 * Dispatch a pointerdown to a target with scrollbar-thumb awareness.
 *
 * UIKit's scroll handler takes the scrollbar-thumb path only when
 * `nativeEvent.pointerType === 'mouse'` AND the pressed point intersects
 * the thumb; a ray is as precise as a mouse, so the down is first offered
 * with mouse semantics. When the library declines (ray not on the thumb —
 * no drag recorded), the same down is re-offered with touch semantics so
 * the press still starts a content drag. Either path consumes the event
 * (the library stops propagation on record), so at most one drag starts.
 * Non-scrollable targets get a single plain dispatch.
 */
export function dispatchScrollAwareDown(
  target: THREE.Object3D,
  event: SyntheticPointerEvent,
  pointerId: number
): void {
  const asComponentEvent = event as unknown as Parameters<Component['dispatchEvent']>[0];
  if (!(target instanceof Component) || !isScrollableContainer(target)) {
    target.dispatchEvent(asComponentEvent);
    return;
  }
  event.nativeEvent = { pointerType: 'mouse' };
  target.dispatchEvent(asComponentEvent);
  const recorded =
    (target as unknown as DownPointerMapAware).downPointerMap?.has(pointerId) ?? false;
  if (!recorded) {
    clearEventStopped(event);
    event.nativeEvent = syntheticNativeEvent();
    target.dispatchEvent(asComponentEvent);
  }
}

/**
 * Scroll-aware variant of {@link bubbleToScrollableAncestors} for the
 * down phase: each scrollable ancestor is offered mouse (thumb) semantics
 * first with touch (content) fallback, inner to outer.
 */
export function bubbleScrollAwareDown(
  target: THREE.Object3D,
  event: SyntheticPointerEvent,
  pointerId: number
): void {
  let ancestor = target.parent;
  while (ancestor && !isEventStopped(event)) {
    const next = ancestor.parent;
    if (ancestor instanceof Component && isScrollableContainer(ancestor)) {
      dispatchScrollAwareDown(ancestor, event, pointerId);
    }
    ancestor = next;
  }
}
