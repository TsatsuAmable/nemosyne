import * as THREE from 'three';
import { Container, Fullscreen, Text } from '@pmndrs/uikit';
import { MovablePanel } from '../src/vr/ui/MovablePanel.ts';

export interface BenchmarkMetrics {
  canvasInitTimeMs: number;
  canvasMemoryAllocatedBytes: number;
  canvasMeshesCount: number;
  canvasSceneNodes: number;
  canvasFrameTimeMs: number;
  canvasDisposalLeftovers: { textures: number; geometries: number; materials: number };

  uikitInitTimeMs: number;
  uikitMemoryAllocatedBytes: number;
  uikitMeshesCount: number;
  uikitSceneNodes: number;
  uikitFrameTimeMs: number;
  uikitDisposalLeftovers: { textures: number; geometries: number; materials: number };
}

function countThreeObjects(obj: THREE.Object3D): { total: number; meshes: number } {
  let total = 0;
  let meshes = 0;
  obj.traverse((child) => {
    total++;
    if (child instanceof THREE.Mesh) {
      meshes++;
    }
  });
  return { total, meshes };
}

export function runUIKitBenchmark(): BenchmarkMetrics {
  // Setup mock renderer and scene
  const width = 1024;
  const height = 768;
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setSize(width, height);
  const scene = new THREE.Scene();

  const cameraGroup = new THREE.Group();
  scene.add(cameraGroup);

  // Helper for GC
  const gc = () => {
    const g = globalThis as unknown as { gc?: () => void };
    if (typeof g.gc === 'function') {
      try {
        g.gc();
      } catch {
        // ignore
      }
    }
  };

  // =========================================================================
  // Canvas / MovablePanel Benchmark
  // =========================================================================
  gc();
  const canvasStartMem = process.memoryUsage().heapUsed;
  const canvasStartTIme = performance.now();

  const canvasPanels: MovablePanel[] = [];
  for (let i = 0; i < 10; i++) {
    const panel = new MovablePanel(cameraGroup, {
      title: `Canvas Panel ${i}`,
      width: 800,
      height: 480,
      position: [0, 0, -1.5],
      worldSize: [1.1, 0.66],
    });
    panel.renderContent = (ctx, _w, _h) => {
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px sans-serif';
      ctx.fillText('This is benchmark dummy text inside the canvas context', 20, 40);
      ctx.fillText('We write multiple lines to simulate standard content drawing.', 20, 70);
      ctx.fillText(`Active index: ${i}`, 20, 100);
    };
    panel.render();
    canvasPanels.push(panel);
  }

  const canvasInitTimeMs = performance.now() - canvasStartTIme;
  gc();
  const canvasMemoryAllocatedBytes = process.memoryUsage().heapUsed - canvasStartMem;

  // Count structure
  let canvasSceneNodes = 0;
  let canvasMeshesCount = 0;
  for (const panel of canvasPanels) {
    const count = countThreeObjects(panel.mesh);
    canvasSceneNodes += count.total;
    canvasMeshesCount += count.meshes;
  }

  // Simulate scroll/update cycles (100 updates)
  const canvasFrameStart = performance.now();
  for (let step = 0; step < 100; step++) {
    for (const panel of canvasPanels) {
      panel.scroll(step % 2 === 0 ? 10 : -10);
    }
  }
  const canvasFrameTimeMs = (performance.now() - canvasFrameStart) / 100;

  // Cleanup & Disposal leftovers
  const initialCanvasTextures = renderer.info.memory.textures;
  const initialCanvasGeometries = renderer.info.memory.geometries;

  for (const panel of canvasPanels) {
    panel.dispose();
  }
  // Flush WebGLRenderer memory cache by rendering a dummy frame
  const dummyCam = new THREE.PerspectiveCamera();
  renderer.render(scene, dummyCam);
  gc();

  const canvasDisposalLeftovers = {
    textures: Math.max(0, renderer.info.memory.textures - (initialCanvasTextures - canvasPanels.length)),
    geometries: Math.max(0, renderer.info.memory.geometries - (initialCanvasGeometries - canvasPanels.length)),
    materials: 0,
  };

  // Remove panel mesh references from scene
  for (const panel of canvasPanels) {
    cameraGroup.remove(panel.mesh);
  }

  // =========================================================================
  // UIKit / pmndrs-uikit Benchmark
  // =========================================================================
  gc();
  const uikitStartMem = process.memoryUsage().heapUsed;
  const uikitStartTime = performance.now();

  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  scene.add(camera);

  const uikitRoot = new Fullscreen(renderer, {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  });
  camera.add(uikitRoot);

  const uikitPanels: Container[] = [];
  for (let i = 0; i < 10; i++) {
    const panel = new Container({
      width: 800,
      height: 480,
      flexDirection: 'column',
      backgroundColor: 0x0b1119,
      padding: 18,
    });
    const text1 = new Text({
      text: 'This is benchmark dummy text inside the canvas context',
      fontSize: 20,
      color: 0xffffff,
    });
    const text2 = new Text({
      text: 'We write multiple lines to simulate standard content drawing.',
      fontSize: 20,
      color: 0xffffff,
    });
    const text3 = new Text({
      text: `Active index: ${i}`,
      fontSize: 20,
      color: 0xffffff,
    });
    panel.add(text1);
    panel.add(text2);
    panel.add(text3);

    uikitRoot.add(panel);
    uikitPanels.push(panel);
  }

  uikitRoot.update(0);

  const uikitInitTimeMs = performance.now() - uikitStartTime;
  gc();
  const uikitMemoryAllocatedBytes = process.memoryUsage().heapUsed - uikitStartMem;

  // Count structure
  const uikitCount = countThreeObjects(uikitRoot);
  const uikitSceneNodes = uikitCount.total;
  const uikitMeshesCount = uikitCount.meshes;

  // Simulate scroll/update cycles (100 updates)
  const uikitFrameStart = performance.now();
  for (let step = 0; step < 100; step++) {
    uikitRoot.update(16);
  }
  const uikitFrameTimeMs = (performance.now() - uikitFrameStart) / 100;

  // Cleanup & Disposal leftovers
  const initialUikitTextures = renderer.info.memory.textures;
  const initialUikitGeometries = renderer.info.memory.geometries;

  uikitRoot.dispose();
  camera.remove(uikitRoot);
  scene.remove(camera);
  renderer.render(scene, dummyCam);
  gc();

  const uikitDisposalLeftovers = {
    textures: Math.max(0, renderer.info.memory.textures - initialUikitTextures),
    geometries: Math.max(0, renderer.info.memory.geometries - initialUikitGeometries),
    materials: 0,
  };

  return {
    canvasInitTimeMs,
    canvasMemoryAllocatedBytes,
    canvasMeshesCount,
    canvasSceneNodes,
    canvasFrameTimeMs,
    canvasDisposalLeftovers,

    uikitInitTimeMs,
    uikitMemoryAllocatedBytes,
    uikitMeshesCount,
    uikitSceneNodes,
    uikitFrameTimeMs,
    uikitDisposalLeftovers,
  };
}
