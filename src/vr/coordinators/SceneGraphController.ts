/**
 * Scene Graph & WebXR Render Controller.
 *
 * Encapsulates Three.js scene initialization, lighting, analyst torso anchoring,
 * and WebXR render loop animation setup out of the World monolith.
 */

import * as THREE from 'three';

export interface SceneGraphControllerOptions {
  container?: HTMLElement;
  enableShadows?: boolean;
  renderer?: THREE.WebGLRenderer;
  scene?: THREE.Scene;
  camera?: THREE.PerspectiveCamera;
  cameraGroup?: THREE.Group;
}

export class SceneGraphController {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  cameraGroup: THREE.Group;
  analystAnchor: THREE.Group;
  ambientLight: THREE.AmbientLight;
  directionalLight: THREE.DirectionalLight;
  private _ownsRenderer: boolean;

  constructor(options: SceneGraphControllerOptions = {}) {
    this.scene = options.scene ?? new THREE.Scene();

    if (options.cameraGroup) {
      this.cameraGroup = options.cameraGroup;
    } else {
      this.cameraGroup = new THREE.Group();
      this.cameraGroup.name = 'CameraGroup';
      this.scene.add(this.cameraGroup);
    }

    if (options.camera) {
      this.camera = options.camera;
    } else {
      this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
      this.camera.position.set(0, 1.6, 0);
      this.cameraGroup.add(this.camera);
    }

    this.analystAnchor = new THREE.Group();
    this.analystAnchor.name = 'AnalystAnchor';
    this.analystAnchor.position.set(0, 1.35, 0);
    this.scene.add(this.analystAnchor);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.directionalLight.position.set(5, 10, 7);
    this.scene.add(this.directionalLight);

    if (options.renderer) {
      this.renderer = options.renderer;
      this._ownsRenderer = false;
    } else {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2));
      this.renderer.setSize(800, 600);
      this._ownsRenderer = true;
    }

    if (options.container && this._ownsRenderer) {
      options.container.appendChild(this.renderer.domElement);
    }
  }

  updateAnalystTorsoAnchor(headsetPos: THREE.Vector3, headsetYaw: number): void {
    this.analystAnchor.position.set(headsetPos.x, 1.35, headsetPos.z);
    this.analystAnchor.rotation.y = headsetYaw;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    if (this._ownsRenderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
      }
    }
    this.scene.remove(this.analystAnchor);
    this.scene.remove(this.ambientLight);
    this.scene.remove(this.directionalLight);
    this.ambientLight.dispose?.();
    this.directionalLight.dispose?.();
  }
}
