import * as THREE from 'three';

interface BodyFrameRuntimeState {
  activePanelDrags: number;
  viewerTargetLocal: [number, number, number];
}

const BODY_FRAME_STATE_KEY = 'nemosyneBodyFrameState';

type BodyFrameCarrier = THREE.Object3D & {
  userData?: Record<string, unknown>;
};

function ensureState(group: THREE.Object3D): BodyFrameRuntimeState {
  // Production callers are Three.js Object3D instances and always expose
  // `userData`. Several long-standing unit tests intentionally pass structural
  // Group-like doubles, though, so keep this coordination seam structural too
  // instead of making panel construction depend on a fully-instantiated Group.
  const carrier = group as BodyFrameCarrier;
  const userData = carrier.userData ?? (carrier.userData = {});
  const existing = userData[BODY_FRAME_STATE_KEY] as BodyFrameRuntimeState | undefined;
  if (existing) return existing;

  const state: BodyFrameRuntimeState = {
    activePanelDrags: 0,
    viewerTargetLocal: [0, 0, 0],
  };
  userData[BODY_FRAME_STATE_KEY] = state;
  return state;
}

export function beginBodyFramePanelDrag(group: THREE.Object3D | null): void {
  if (!group) return;
  const state = ensureState(group);
  state.activePanelDrags += 1;
}

export function endBodyFramePanelDrag(group: THREE.Object3D | null): void {
  if (!group) return;
  const state = ensureState(group);
  state.activePanelDrags = Math.max(0, state.activePanelDrags - 1);
}

export function hasActiveBodyFramePanelDrag(group: THREE.Object3D | null): boolean {
  if (!group) return false;
  const state = ensureState(group);
  return state.activePanelDrags > 0;
}

export function setBodyFrameViewerTargetLocal(
  group: THREE.Object3D,
  target: THREE.Vector3
): void {
  const state = ensureState(group);
  state.viewerTargetLocal = [target.x, target.y, target.z];
}

export function getBodyFrameViewerTargetLocal(
  group: THREE.Object3D | null,
  target = new THREE.Vector3()
): THREE.Vector3 {
  if (!group) return target.set(0, 0, 0);
  const state = ensureState(group);
  return target.set(...state.viewerTargetLocal);
}
