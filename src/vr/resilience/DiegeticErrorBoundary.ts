/**
 * Diegetic Error Boundary for WebXR.
 *
 * Catches unhandled interaction or rendering errors within the spatial loop and
 * displays an ergonomic in-VR recovery card rather than crashing the session.
 */

import * as THREE from 'three';

export interface DiegeticErrorOptions {
  onReloadRequested?: () => void;
  onRollbackRequested?: () => void;
  onDiagnosticExport?: (error: Error) => void;
}

export class DiegeticErrorBoundary {
  private readonly _scene: THREE.Scene;
  private readonly _camera: THREE.Camera;
  private readonly _options: DiegeticErrorOptions;
  private _errorPanel: THREE.Group | null = null;
  private _activeError: Error | null = null;

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    options: DiegeticErrorOptions = {}
  ) {
    this._scene = scene;
    this._camera = camera;
    this._options = options;
  }

  get activeError(): Error | null {
    return this._activeError;
  }

  get isDisplayingError(): boolean {
    return this._errorPanel !== null;
  }

  /**
   * Catch and handle a spatial error gracefully inside the VR viewport.
   */
  catchError(error: Error): void {
    this._activeError = error;
    this._options.onDiagnosticExport?.(error);
    this._createOrUpdateErrorPanel(error.message);
  }

  /**
   * Clear active error and remove the diegetic recovery card.
   */
  dismiss(): void {
    if (this._errorPanel) {
      this._scene.remove(this._errorPanel);
      this._errorPanel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });
      this._errorPanel = null;
    }
    this._activeError = null;
  }

  private _createOrUpdateErrorPanel(errorMessage: string): void {
    if (!this._errorPanel) {
      this._errorPanel = new THREE.Group();
      this._errorPanel.name = 'diegetic-error-card';

      // Background plate
      const bgGeom = new THREE.PlaneGeometry(0.8, 0.45);
      const bgMat = new THREE.MeshBasicMaterial({
        color: 0x1a0505,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
      });
      const bgMesh = new THREE.Mesh(bgGeom, bgMat);
      this._errorPanel.add(bgMesh);

      // Border outline
      const borderGeom = new THREE.PlaneGeometry(0.82, 0.47);
      const borderMat = new THREE.MeshBasicMaterial({
        color: 0xff3b30,
        wireframe: true,
      });
      const borderMesh = new THREE.Mesh(borderGeom, borderMat);
      borderMesh.position.z = -0.001;
      this._errorPanel.add(borderMesh);

      this._scene.add(this._errorPanel);
    }

    // Position panel 1.1 meters directly in front of current camera world pose (Comfort Zone)
    this._camera.updateMatrixWorld(true);
    const camPos = new THREE.Vector3();
    const camQuat = new THREE.Quaternion();
    this._camera.getWorldPosition(camPos);
    this._camera.getWorldQuaternion(camQuat);

    const forward = new THREE.Vector3(0, 0, -1.1).applyQuaternion(camQuat);
    this._errorPanel.position.copy(camPos).add(forward);
    this._errorPanel.quaternion.copy(camQuat);
    this._errorPanel.userData = { message: errorMessage };
  }

  triggerReload(): void {
    this._options.onReloadRequested?.();
    this.dismiss();
  }

  triggerRollback(): void {
    this._options.onRollbackRequested?.();
    this.dismiss();
  }

  dispose(): void {
    this.dismiss();
  }
}
