import * as THREE from 'three';
import type { TourStep } from '../../data/DefaultTour.ts';
import type {
  DataOperationControllerLike,
  DatumLike,
  DracoNodeFacadeLike,
  GuidedTourLike,
  WorldUIManagerLike,
} from './types.ts';

export interface GuidedTourHost {
  datum?: DatumLike;
  dracoNode?: DracoNodeFacadeLike | null;
  uiManager: Pick<
    WorldUIManagerLike,
    | 'handWheelMenu'
    | 'narrativeStrip'
    | 'operationLogPanel'
    | 'peerPresenceHUD'
    | 'settingsPanel'
  >;
  inspector?: { active?: boolean };
  dataOperationController?: DataOperationControllerLike;
  tdaGroup?: { visible: boolean } | null;
  guidedTour?: GuidedTourLike;
}

export class GuidedTourController {
  private _world: GuidedTourHost;

  constructor(world: GuidedTourHost) {
    this._world = world;
  }

  resolveTarget(target: string): { object?: THREE.Object3D; position?: THREE.Vector3 } | null {
    const w = this._world;
    switch (target) {
      case 'datum-plane':
        return { object: w.datum?.mesh, position: w.datum?.mesh?.position };
      case 'draco-palace':
        return { object: w.dracoNode?.group, position: w.dracoNode?.group?.position };
      case 'node-mesh':
        return w.dracoNode?.artifact?.nodeMeshes?.[0]
          ? { object: w.dracoNode.artifact.nodeMeshes[0] }
          : null;
      case 'wheel-menu':
        return w.uiManager?.handWheelMenu?.group
          ? { object: w.uiManager.handWheelMenu.group }
          : null;
      case 'wheel-analyse': {
        const analyse = (
          w.uiManager?.handWheelMenu as unknown as { _categories: { id: string }[] }
        )?._categories?.find((c) => c.id === 'ANALYSE');
        return analyse ? { position: new THREE.Vector3(0, 1.4, -0.6) } : null;
      }
      case 'gesture-hint':
        return { position: new THREE.Vector3(0, 1.5, -1.0) };
      case 'settings-panel':
        return w.uiManager?.settingsPanel?.mesh ? { object: w.uiManager.settingsPanel.mesh } : null;
      case 'dashboard':
        return { position: new THREE.Vector3(0, 1.45, -1.35) };
      case 'session-export':
        return w.uiManager?.operationLogPanel?.mesh
          ? { object: w.uiManager.operationLogPanel.mesh }
          : { position: new THREE.Vector3(0.5, 1.4, -0.9) };
      case 'peer-collaboration':
        return w.uiManager?.peerPresenceHUD?.mesh
          ? { object: w.uiManager.peerPresenceHUD.mesh }
          : { position: new THREE.Vector3(-0.9, 1.35, -0.7) };
      case 'tda-lens':
        // TDA group sits at (0, 1.6, -3.5); resolve to that position (the group
        // itself has no resolvable mesh on the facade).
        return { position: new THREE.Vector3(0, 1.6, -3.5) };
      case 'comfort-settings':
        return w.uiManager?.settingsPanel?.mesh
          ? { object: w.uiManager.settingsPanel.mesh }
          : { position: new THREE.Vector3(0.3, 1.4, -0.9) };
      case 'theme-preset':
        return { position: new THREE.Vector3(0, 1.5, -0.8) };
      case 'narrative-timeline':
        return w.uiManager?.narrativeStrip?.mesh
          ? { object: w.uiManager.narrativeStrip.mesh }
          : { position: new THREE.Vector3(0, 1.2, -0.7) };
      default:
        return null;
    }
  }

  checkCondition(step: TourStep): boolean {
    const w = this._world;
    switch (step.target) {
      case 'node-mesh':
        return w.inspector?.active === true;
      case 'wheel-menu':
        return w.uiManager?.handWheelMenu?.isVisible?.() === true;
      case 'wheel-analyse':
        return w.uiManager?.handWheelMenu?.isVisible?.() === true;
      case 'settings-panel':
      case 'comfort-settings':
        return w.uiManager?.settingsPanel?.mesh?.visible === true;
      case 'tda-lens':
        // Auto-advance once the analyst has revealed the TDA group.
        return w.tdaGroup?.visible === true;
      case 'narrative-timeline':
        return w.uiManager?.narrativeStrip?.mesh?.visible === true;
      default:
        return false;
    }
  }

  startTour(): boolean {
    return this._world.guidedTour?.start?.() ?? false;
  }

  stopTour(): void {
    this._world.guidedTour?.stop?.();
  }
}
