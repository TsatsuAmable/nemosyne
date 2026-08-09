/**
 * Canvas Texture Cache Manager for WebXR UI Panels.
 *
 * Prevents unnecessary GPU texture re-uploads (`texture.needsUpdate = true`)
 * by hashing canvas content state and skipping uploads on unchanged frames.
 */

import * as THREE from 'three';

export interface CanvasCacheEntry {
  hash: string;
  lastUpdatedMs: number;
}

export class CanvasTextureCacheManager {
  private _cache: Map<string, CanvasCacheEntry> = new Map();
  private _skipCount = 0;
  private _uploadCount = 0;

  /**
   * Fast string hash helper for UI state signatures.
   */
  static computeHash(inputStr: string): string {
    let hash = 5381;
    for (let i = 0; i < inputStr.length; i++) {
      hash = (hash * 33) ^ inputStr.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
  }

  /**
   * Evaluates UI state signature and updates texture only if content state changed.
   */
  shouldUpdateTexture(panelId: string, stateSignature: string, texture: THREE.CanvasTexture, now = Date.now()): boolean {
    const newHash = CanvasTextureCacheManager.computeHash(stateSignature);
    const existing = this._cache.get(panelId);

    if (existing && existing.hash === newHash) {
      this._skipCount++;
      return false; // Skip GPU texture upload
    }

    this._cache.set(panelId, { hash: newHash, lastUpdatedMs: now });
    texture.needsUpdate = true;
    this._uploadCount++;
    return true;
  }

  getMetrics(): { skipCount: number; uploadCount: number; skipRate: number } {
    const total = this._skipCount + this._uploadCount;
    const skipRate = total > 0 ? this._skipCount / total : 0;
    return {
      skipCount: this._skipCount,
      uploadCount: this._uploadCount,
      skipRate: Number(skipRate.toFixed(2)),
    };
  }

  resetMetrics(): void {
    this._skipCount = 0;
    this._uploadCount = 0;
  }
}
