// @ts-nocheck
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SpatialPanel } from '../src/vr/ui-system/SpatialPanel.ts';

function fakeMesh(ctorName: string): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  mesh.position.set(0, 0, 50);
  Object.defineProperty(mesh, 'constructor', { value: { name: ctorName } });
  return mesh;
}

describe('SpatialPanel glyph ordering', () => {
  it('draws instanced glyphs above panel backgrounds on update', () => {
    const panel = new SpatialPanel({}, new THREE.Group(), new THREE.Scene());
    const glyph = fakeMesh('InstancedGlyphMesh');
    const background = fakeMesh('InstancedPanelMesh');
    // Push past the add() component guard: the guard is not under test,
    // the traverse-time renderOrder matching is.
    panel.children.push(glyph, background);
    panel.visible = true;
    panel.update(0.016);
    expect(glyph.renderOrder).toBe(1);
    expect(background.renderOrder).toBe(0);
  });

  it('never throws on panels without glyph groups', () => {
    const panel = new SpatialPanel({}, new THREE.Group(), new THREE.Scene());
    panel.visible = true;
    expect(() => panel.update(0.016)).not.toThrow();
  });
});
