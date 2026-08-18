// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { StreamlineLayout } from '../src/draco/layouts/StreamlineLayout.ts';
import { GeoSurfaceLayout } from '../src/draco/layouts/GeoSurfaceLayout.ts';
import { MovablePanel } from '../src/vr/ui/MovablePanel.ts';

describe('Layout Data Binding & Typed Panel Content Handling', () => {
  describe('StreamlineLayout Data Binding', () => {
    it('computes streamlines from explicit u/v/w vector columns', () => {
      const vectorRows = [
        { u: 1.0, v: 0.5, w: -0.2, val: 42 },
        { u: 0.8, v: 0.1, w: 0.4, val: 99 },
      ];

      const entries = StreamlineLayout.compute(vectorRows, { count: 2, steps: 3, stepSize: 1 });
      expect(entries.length).toBe(2);
      expect(entries[0].points.length).toBe(4);
      expect(entries[0].row).toBe(vectorRows[0]);
    });
  });

  describe('GeoSurfaceLayout Data Binding', () => {
    it('computes geospatial positions and normalizes elevations', () => {
      const geoRows = [
        { lat: 37.7749, lon: -122.4194, elevation: 100 },
        { lat: 34.0522, lon: -118.2437, elevation: 500 },
      ];

      const entries = GeoSurfaceLayout.compute(geoRows, {
        latKey: 'lat',
        lonKey: 'lon',
        valueKey: 'elevation',
        heightScale: 0.01,
      });

      expect(entries.length).toBe(2);
      expect(entries[0].position.y).toBeLessThan(entries[1].position.y);
    });
  });

  describe('MovablePanel Content Handling', () => {
    it('delegates clicks via typed IPanelContentHandler without duck-typing errors', () => {
      class TestPanel extends MovablePanel {
        clicked = false;
        override handleContentClick(_raycaster: THREE.Raycaster) {
          this.clicked = true;
        }
      }

      const cameraGroup = new THREE.Group();
      const panel = new TestPanel({
        cameraGroup,
        title: 'Test Panel',
        width: 300,
        height: 200,
      });

      const raycaster = new THREE.Raycaster();
      // Ray from front of panel towards mesh
      raycaster.set(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1));

      panel.handlePointerDown(raycaster, {
        getRay: (r: THREE.Ray) => r.set(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)),
      } as any);

      expect(panel.clicked).toBe(true);
    });
  });
});
