import * as THREE from 'three';
import type { WorldLike } from './types.ts';

export interface TourStep {
  target: string;
  [key: string]: unknown;
}

export class GuidedTourController {
  private _world: WorldLike;

  constructor(world: WorldLike) {
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
        return w.handWheelMenu?.group ? { object: w.handWheelMenu.group } : null;
      case 'wheel-ops': {
        const ops = (
          w.handWheelMenu as unknown as { _categories: { id: string }[] }
        )._categories?.find((c) => c.id === 'ops');
        return ops ? { position: new THREE.Vector3(0, 1.4, -0.6) } : null;
      }
      case 'gesture-hint':
        return { position: new THREE.Vector3(0, 1.5, -1.0) };
      case 'settings-panel':
        return w.settingsPanel?.mesh ? { object: w.settingsPanel.mesh } : null;
      case 'dashboard':
        return { position: new THREE.Vector3(0, 1.45, -1.35) };
      case 'data-loader':
        return w.vrMenu?.mesh ? { object: w.vrMenu.mesh } : { position: new THREE.Vector3(-0.9, 1.5, -1.1) };
      case 'session-export':
        return w.operationLogPanel?.mesh ? { object: w.operationLogPanel.mesh } : { position: new THREE.Vector3(0.5, 1.4, -0.9) };
      case 'peer-collaboration':
        return w.peerPresenceHUD?.mesh ? { object: w.peerPresenceHUD.mesh } : { position: new THREE.Vector3(-0.9, 1.35, -0.7) };
      case 'draco-transform':
        return w.vrMenu?.mesh ? { object: w.vrMenu.mesh } : { position: new THREE.Vector3(-0.9, 1.5, -1.1) };
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
        return w.handWheelMenu?.isVisible?.() === true;
      case 'settings-panel':
        return w.settingsPanel?.mesh?.visible === true;
      case 'draco-transform':
        return (w.dataOperationController?.analysisHistory?.length ?? 0) > 0;
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
