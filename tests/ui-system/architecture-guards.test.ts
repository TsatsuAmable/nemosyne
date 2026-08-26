import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { Text } from '@pmndrs/uikit';
import { SpatialUIRoot } from '../../src/vr/ui-system/SpatialUIRoot.ts';
import { SpatialPanel } from '../../src/vr/ui-system/SpatialPanel.ts';

// Helper to recursively collect files
function collectTsFiles(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);
  for (const file of files) {
    const filePath = join(dir, file);
    if (statSync(filePath).isDirectory()) {
      collectTsFiles(filePath, fileList);
    } else if (file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

describe('UI System Architecture Guards', () => {
  it('enforces that UI system files never directly import WASM kernel or Moneta/Atlas analytical modules', () => {
    const uiSystemDir = join(process.cwd(), 'src/vr/ui-system');
    const tsFiles = collectTsFiles(uiSystemDir);

    expect(tsFiles.length).toBeGreaterThan(0);

    for (const file of tsFiles) {
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');

      for (const line of lines) {
        if (line.trim().startsWith('import')) {
          // Banned imports: direct wasm package or direct Moneta/Atlas analytical modules
          const isDirectWasm = line.includes('wasm/pkg') || line.includes('/wasm/');
          const isDirectAnalytics = line.includes('/moneta/') || line.includes('/atlas/');

          expect(isDirectWasm).toBe(false);
          expect(isDirectAnalytics).toBe(false);
        }
      }
    }
  });
});

describe('UI System Lifecycle & Disposal tests', () => {
  it('proves proper disposal of SpatialUIRoot and SpatialPanel', () => {
    const width = 800;
    const height = 600;
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas });
    renderer.setSize(width, height);

    const scene = new THREE.Scene();
    const torsoAnchor = new THREE.Group();
    const worldScene = new THREE.Group();
    scene.add(torsoAnchor);
    scene.add(worldScene);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    scene.add(camera);

    const root = new SpatialUIRoot(renderer);
    camera.add(root);

    const panel = new SpatialPanel(
      {
        width: 400,
        height: 300,
      },
      torsoAnchor,
      worldScene
    );

    const text = new Text({
      text: 'Lifecycle Test',
      fontSize: 16,
    });
    panel.add(text);
    root.add(panel);

    // Initial render / update
    root.update(0);

    // Verify they are added to scene/anchor
    expect(panel.parent).toBe(root);
    expect(root.parent).toBe(camera);

    // Transition references
    panel.setReferenceFrame('WORLD_LOCKED', false);
    expect(panel.parent).toBe(worldScene);

    panel.setReferenceFrame('BODY_LOCKED', false);
    expect(panel.parent).toBe(torsoAnchor);

    // Dispose
    panel.dispose();
    root.dispose();

    // Verify detachment
    expect(panel.parent).toBeNull();
    expect(root.parent).toBeNull();

    // Cleanup WebGL properties
    renderer.dispose();
  });
});
