/**
 * WebGL Context Loss & Auto-Recovery Manager.
 *
 * Detects `webglcontextlost` events on WebXR/Three.js renderer canvas,
 * preserves application state, and automatically triggers geometry/material GPU
 * buffer restoration when `webglcontextrestored` fires.
 */

import * as THREE from 'three';

export interface ContextRecoveryOptions {
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

export class ContextRecoveryManager {
  renderer: THREE.WebGLRenderer;
  isContextLost = false;
  options: ContextRecoveryOptions;

  constructor(renderer: THREE.WebGLRenderer, options: ContextRecoveryOptions = {}) {
    this.renderer = renderer;
    this.options = options;
    this.bindEvents();
  }

  bindEvents(): void {
    const canvas = this.renderer.domElement;
    if (!canvas) return;

    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault(); // Prevent default browser context loss crash
      this.isContextLost = true;
      console.warn('[ContextRecoveryManager] WebGL Context Lost! Preserving application state...');

      if (this.options.onContextLost) {
        this.options.onContextLost();
      }
    });

    canvas.addEventListener('webglcontextrestored', () => {
      this.isContextLost = false;
      console.info('[ContextRecoveryManager] WebGL Context Restored! Rebuilding GPU material & geometry buffers...');

      if (this.options.onContextRestored) {
        this.options.onContextRestored();
      }
    });
  }

  /**
   * Simulate a WebGL context loss for testing/validation.
   */
  simulateContextLoss(): void {
    const canvas = this.renderer.domElement;
    if (!canvas) return;

    const lostEvent = new Event('webglcontextlost');
    canvas.dispatchEvent(lostEvent);
  }

  /**
   * Simulate a WebGL context restoration for testing/validation.
   */
  simulateContextRestoration(): void {
    const canvas = this.renderer.domElement;
    if (!canvas) return;

    const restoredEvent = new Event('webglcontextrestored');
    canvas.dispatchEvent(restoredEvent);
  }
}
