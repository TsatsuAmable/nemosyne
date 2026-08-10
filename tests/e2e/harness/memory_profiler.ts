/**
 * WebGL and Memory Profiler Harness for E2E Tests.
 * Captures GPU resource counters and JS heap statistics to assert zero memory leaks.
 */

import { getWebGLMockStats, resetWebGLMockStats, WebGLMockStats } from './webgl_mock.js';

export interface MemorySnapshot {
  timestamp: number;
  webgl: WebGLMockStats;
  heapUsed: number;
  heapTotal: number;
  external: number;
}

export class MemoryProfiler {
  private initialSnapshot: MemorySnapshot | null = null;

  startRecording(): MemorySnapshot {
    resetWebGLMockStats();
    this.initialSnapshot = this.takeSnapshot();
    return this.initialSnapshot;
  }

  takeSnapshot(): MemorySnapshot {
    const mem = typeof process !== 'undefined' && process.memoryUsage ? process.memoryUsage() : { heapUsed: 0, heapTotal: 0, external: 0 };
    const stats = getWebGLMockStats();
    return {
      timestamp: performance.now(),
      webgl: { ...stats },
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external || 0,
    };
  }

  assertNoWebGLBufferLeaks(baseline: MemorySnapshot, current: MemorySnapshot, maxAllowedDelta = 0): void {
    const bufferDelta = current.webgl.activeBuffers - baseline.webgl.activeBuffers;
    if (bufferDelta > maxAllowedDelta) {
      throw new Error(
        `WebGL Buffer Memory Leak Detected! Baseline active buffers: ${baseline.webgl.activeBuffers}, Current active buffers: ${current.webgl.activeBuffers} (Delta: ${bufferDelta}, Max Allowed: ${maxAllowedDelta})`
      );
    }
  }

  assertNoTextureLeaks(baseline: MemorySnapshot, current: MemorySnapshot, maxAllowedDelta = 0): void {
    const textureDelta = current.webgl.activeTextures - baseline.webgl.activeTextures;
    if (textureDelta > maxAllowedDelta) {
      throw new Error(
        `WebGL Texture Memory Leak Detected! Baseline active textures: ${baseline.webgl.activeTextures}, Current active textures: ${current.webgl.activeTextures} (Delta: ${textureDelta}, Max Allowed: ${maxAllowedDelta})`
      );
    }
  }
}

export const memoryProfiler = new MemoryProfiler();
