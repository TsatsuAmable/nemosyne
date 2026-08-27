import * as THREE from 'three';
import type { PointerLike, PanelLike } from '../../coordinators/types.ts';

export type TouchPhase = 'FAR' | 'NEAR_HOVER' | 'CONTACT' | 'PRESS' | 'COMMIT' | 'RELEASE' | 'RECOVER';

export interface PointerTouchState {
  pointer: PointerLike;
  phase: TouchPhase;
  targetPanel: PanelLike | null;
  distance: number;
}

export class NearFieldInteractor {
  private _states: Map<PointerLike, PointerTouchState> = new Map();
  private _raycaster = new THREE.Raycaster();

  // Threshold constants
  readonly PROXIMITY_ENTER = 0.55; // 55cm near envelope
  readonly PROXIMITY_EXIT = 0.60;  // Hysteresis exit bound
  readonly CONTACT_ENTER = 0.02;   // 2cm contact range
  readonly CONTACT_EXIT = 0.03;
  readonly PRESS_ENTER = 0.008;    // 8mm press trigger
  readonly PRESS_EXIT = 0.015;     // 1.5cm release trigger

  // Controller stylus tip offset (Option 1: 0.05m = 5cm)
  readonly CONTROLLER_TIP_OFFSET = 0.05;

  constructor() {
    this._raycaster.far = 1.0; // Restrict direct touch ray casting distance
  }

  update(pointers: PointerLike[], panels: PanelLike[]): void {
    const ray = new THREE.Ray();

    for (const pointer of pointers) {
      let state = this._states.get(pointer);
      if (!state) {
        state = {
          pointer,
          phase: 'FAR',
          targetPanel: null,
          distance: Infinity,
        };
        this._states.set(pointer, state);
      }

      // 1. Get pointer tip offset
      const isHand = pointer.jointsValid;
      const tipOffset = isHand ? 0 : this.CONTROLLER_TIP_OFFSET;

      // 2. Perform intersection against panels (using capture if in PRESS phase)
      pointer.getRay(ray);
      this._raycaster.ray.copy(ray);

      let closestPanel: PanelLike | null = null;
      let closestDistance = Infinity;
      let closestHit: THREE.Intersection | null = null;

      if (state.targetPanel && state.targetPanel.mesh && state.targetPanel.mesh.visible && state.phase === 'PRESS') {
        const hits = this._raycaster.intersectObject(state.targetPanel.mesh, true);
        if (hits.length > 0) {
          const hit = hits[0];
          closestDistance = hit.distance - tipOffset;
          closestPanel = state.targetPanel;
          closestHit = hit;
        }
      } else {
        for (const panel of panels) {
          if (!panel.mesh || !panel.mesh.visible) continue;
          const hits = this._raycaster.intersectObject(panel.mesh, true);
          if (hits.length > 0) {
            const hit = hits[0];
            const tipDist = hit.distance - tipOffset;
            if (tipDist < closestDistance) {
              closestDistance = tipDist;
              closestPanel = panel;
              closestHit = hit;
            }
          }
        }
      }

      state.distance = closestDistance;

      // 3. Evaluate transitions using hysteresis thresholds
      const currentPhase = state.phase;
      let nextPhase: TouchPhase = currentPhase;

      if (currentPhase === 'COMMIT') {
        nextPhase = 'RELEASE';
      } else if (currentPhase === 'RELEASE' || currentPhase === 'RECOVER') {
        if (closestDistance <= this.PRESS_ENTER) {
          nextPhase = 'PRESS';
        } else if (closestDistance <= this.CONTACT_ENTER) {
          nextPhase = 'CONTACT';
        } else if (closestDistance <= this.PROXIMITY_ENTER) {
          nextPhase = 'NEAR_HOVER';
        } else {
          nextPhase = 'FAR';
        }
      } else {
        if (nextPhase === 'FAR') {
          if (closestDistance <= this.PROXIMITY_ENTER) {
            nextPhase = 'NEAR_HOVER';
          }
        }

        if (nextPhase === 'NEAR_HOVER') {
          if (closestDistance > this.PROXIMITY_EXIT) {
            nextPhase = 'FAR';
          } else if (closestDistance <= this.CONTACT_ENTER) {
            nextPhase = 'CONTACT';
          }
        }

        if (nextPhase === 'CONTACT') {
          if (closestDistance > this.CONTACT_EXIT) {
            nextPhase = 'NEAR_HOVER';
          } else if (closestDistance <= this.PRESS_ENTER) {
            nextPhase = 'PRESS';
          }
        }

        if (nextPhase === 'PRESS') {
          if (closestDistance > this.PRESS_EXIT) {
            let stillHit = false;
            if (state.targetPanel && state.targetPanel.mesh) {
              const hits = this._raycaster.intersectObject(state.targetPanel.mesh, true);
              stillHit = hits.length > 0;
            }
            nextPhase = stillHit ? 'COMMIT' : 'RECOVER';
          }
        }
      }

      // 4. Act on phase transitions
      if (nextPhase !== currentPhase) {
        this._onPhaseTransition(state, nextPhase, closestPanel, closestHit);
      } else if (nextPhase === 'PRESS' && closestPanel && closestHit) {
        // Continuous move/drag during press
        this._handlePressMove(state, closestPanel, closestHit);
      }
    }
  }

  private _onPhaseTransition(
    state: PointerTouchState,
    next: TouchPhase,
    panel: PanelLike | null,
    hit: THREE.Intersection | null
  ): void {
    state.phase = next;

    // Dispatch events on press/release transitions
    if (next === 'PRESS' && panel && hit) {
      state.targetPanel = panel;
      if (typeof panel.handlePointerDown === 'function') {
        panel.handlePointerDown(this._raycaster, state.pointer);
      }
    } else if (next === 'COMMIT' && state.targetPanel) {
      if (typeof state.targetPanel.handlePointerUp === 'function') {
        state.targetPanel.handlePointerUp(this._raycaster, state.pointer);
      }
      state.targetPanel = null;
    } else if (next === 'RECOVER' && state.targetPanel) {
      if (typeof state.targetPanel.handlePointerUp === 'function') {
        state.targetPanel.handlePointerUp(this._raycaster, state.pointer);
      }
      state.targetPanel = null;
    }
  }

  private _handlePressMove(
    state: PointerTouchState,
    panel: PanelLike,
    _hit: THREE.Intersection
  ): void {
    if (typeof panel.handlePointerMove === 'function') {
      panel.handlePointerMove(this._raycaster, state.pointer);
    }
  }

  getTouchState(pointer: PointerLike): PointerTouchState | undefined {
    return this._states.get(pointer);
  }

  dispose(): void {
    this._states.clear();
  }
}
