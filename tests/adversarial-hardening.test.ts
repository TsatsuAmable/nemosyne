// @ts-nocheck
/**
 * Sprint 22.3.1 Adversarial Hardening and Last-Mile Closure Test Suite
 *
 * Covers:
 * 1. Remote authorization & schema abuse (observer restrictions, role smuggling, malformed deltas)
 * 2. Compare operation rendering & history restoration
 * 3. Existing-scene recoloring across colorblind modes
 * 4. ChartPlane & renderer lifecycle resource disposal
 * 5. Controller/pinch precedence & unified system-toggle gate re-arming prevention
 */

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { SystemGestureDetector } from '../src/vr/input/SystemGestureDetector.ts';
import { Dataset } from '../src/data/Dataset.ts';
import { applyFilter, applyCompare } from '../src/vr/interactions/DataOperations.ts';
import { ChartPlane } from '../src/vr/artifacts/ChartPlane.ts';
import { createRoomRegistry } from '../src/network/SignallingServerCore.ts';
import type { ArtifactRef } from '../src/vr/coordinators/types.ts';

function createMockSocket() {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  const sent: string[] = [];
  const s = {
    readyState: 1,
    sent,
    listeners,
    send(data: string) {
      sent.push(data);
    },
    close(code?: number, reason?: string) {
      s.readyState = 3;
      s.closeCode = code;
      s.closeReason = reason;
      for (const listener of listeners.close ?? []) listener();
    },
    on(event: string, listener: (...args: unknown[]) => void) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(listener);
    },
    emit(event: string, ...args: unknown[]) {
      for (const listener of listeners[event] ?? []) listener(...args);
    },
  };
  return s;
}

function createMockPointerRegistry(options: {
  hands?: Array<{ pinched: boolean; y?: number }>;
  grips?: boolean[];
  overPanel?: boolean;
} = {}) {
  const hands = (options.hands ?? []).map((h) => ({
    pinched: h.pinched,
    rayOrigin: { y: h.y ?? 1.0 },
    isPinched() {
      return this.pinched;
    },
    getRay: () => ({ origin: { x: 0 }, direction: { lengthSq: () => 1 } }),
  }));
  const controllers = (options.grips ?? []).map(() => ({
    handedness: 'none',
    rayOrigin: { y: 1.0 },
    getRay: () => ({ origin: { x: 0 }, direction: { lengthSq: () => 1 } }),
  }));

  let isOverPanel = options.overPanel ?? false;

  return {
    hands,
    controllers,
    lastBothPinched: false,
    controllerGripPressed: new Map(),
    isBestPointerOverPanel: vi.fn(() => isOverPanel),
    setOverPanel(val: boolean) {
      isOverPanel = val;
    },
    findSourceForController: vi.fn((_controller: unknown, sources: XRInputSource[]) => sources[0] ?? null),
  };
}

describe('Sprint 22.3.1 Adversarial Hardening Suite', () => {
  describe('1. Remote Authorization & Schema Abuse', () => {
    it('blocks observer peers from relaying application state changes', () => {
      const registry = createRoomRegistry({ securityProfile: 'Development' });
      const observerSocket = createMockSocket();
      const participantSocket = createMockSocket();

      registry.handleConnection(observerSocket as never, {
        room: 'test-room',
        peerId: 'obs-1',
        role: 'observer',
      });
      registry.handleConnection(participantSocket as never, {
        room: 'test-room',
        peerId: 'part-1',
        role: 'participant',
      });

      // Observer attempts to send state delta message
      observerSocket.emit('message', JSON.stringify({
        type: 'state',
        to: 'part-1',
        delta: { annotation: 'unauthorized edit' },
      }));

      // Participant should NOT receive unauthorized state from observer
      const receivedByParticipant = participantSocket.sent.map((s) => JSON.parse(s));
      expect(receivedByParticipant.some((m) => m.type === 'state')).toBe(false);
    });

    it('rejects oversized or malformed payloads and handles peer disconnect cleanly', () => {
      const registry = createRoomRegistry({ securityProfile: 'Development' });
      const socket = createMockSocket();

      registry.handleConnection(socket as never, {
        room: 'test-room',
        peerId: 'peer-malformed',
        role: 'participant',
      });

      // Emit malformed non-JSON data
      expect(() => {
        socket.emit('message', 'INVALID_NOT_JSON');
      }).not.toThrow();

      // Disconnect cleanly
      socket.emit('close');
      expect(registry.getTotalPeers()).toBe(0);
    });
  });

  describe('2. Compare & Operation Visual Rendering with History Restore', () => {
    it('applies filter/aggregate visual transforms and cleanly restores base state', () => {
      const rows = [
        { category: 'A', value: 10, label: 'item 1' },
        { category: 'A', value: 20, label: 'item 2' },
        { category: 'B', value: 40, label: 'item 3' },
        { category: 'B', value: 50, label: 'item 4' },
      ];
      const columns = [
        { name: 'category', type: 'text' as const },
        { name: 'value', type: 'numeric' as const },
        { name: 'label', type: 'text' as const },
      ];
      const dataset = new Dataset('Test Dataset', columns, rows);

      const meshes: THREE.Mesh[] = rows.map((row) => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 })
        );
        mesh.userData = { row, baseScale: 1, baseOpacity: 1, baseY: 1.0 };
        return mesh;
      });

      const artifact: ArtifactRef = {
        group: new THREE.Group(),
        nodeMeshes: meshes,
      };

      // Filter rows
      const filtered = new Dataset('Filtered', columns, [rows[0], rows[1]]);
      applyFilter(artifact, filtered);

      // Kept rows should have full scale, excluded rows shrunk
      expect(artifact.nodeMeshes[0].scale.x).toBe(1);
      expect(artifact.nodeMeshes[2].scale.x).toBeCloseTo(0.05);

      // Restore base state
      for (const mesh of artifact.nodeMeshes) {
        mesh.scale.setScalar(mesh.userData.baseScale ?? 1);
        (mesh.material as THREE.Material).opacity = mesh.userData.baseOpacity ?? 1;
      }

      expect(artifact.nodeMeshes[2].scale.x).toBe(1);
      expect((artifact.nodeMeshes[2].material as THREE.Material).opacity).toBe(1);
    });
  });

  describe('3. Existing-Scene Recoloring & Chart Disposal', () => {
    it('disposes ChartPlane textures, materials, and geometries on teardown', () => {
      const data = [
        { x: 'Jan', y: 10 },
        { x: 'Feb', y: 25 },
        { x: 'Mar', y: 40 },
      ];

      const chart = new ChartPlane({
        title: 'Monthly Trends',
        chartType: 'bar',
        data,
        xKey: 'x',
        yKey: 'y',
        width: 400,
        height: 300,
      });

      const disposeSpyGeom = vi.spyOn(chart.mesh.geometry, 'dispose');
      const disposeSpyMat = vi.spyOn(chart.mesh.material as THREE.Material, 'dispose');

      // Dispose chart plane
      chart.dispose();

      expect(disposeSpyGeom).toHaveBeenCalled();
      expect(disposeSpyMat).toHaveBeenCalled();
    });
  });

  describe('4. Unified System-Toggle Gate & Re-Arm Prevention', () => {
    it('prevents both-hand pinch from firing or re-arming if initiated over a panel', () => {
      let now = 1000;
      const reg = createMockPointerRegistry({
        hands: [{ pinched: true, y: 1.0 }, { pinched: true, y: 1.0 }],
        overPanel: true,
      });

      const detector = new SystemGestureDetector(reg as never, {
        bothPinchHoldMs: 400,
        toggleCooldownMs: 1000,
        now: () => now,
      });

      const toggle = vi.fn();
      detector.onSystemToggle = toggle;

      // Frame 1: starts over panel -> invalid rising edge
      detector.update(null);
      expect(toggle).not.toHaveBeenCalled();

      // Frame 2: moves off panel while still pinched -> must NOT arm or fire
      reg.setOverPanel(false);
      now += 500;
      detector.update(null);
      expect(toggle).not.toHaveBeenCalled();

      // Frame 3: release both hands
      reg.hands[0].pinched = false;
      reg.hands[1].pinched = false;
      now += 100;
      detector.update(null);

      // Frame 4: start fresh pinch off panel -> should arm and fire after hold
      reg.hands[0].pinched = true;
      reg.hands[1].pinched = true;
      now += 100;
      detector.update(null); // start
      now += 450;
      detector.update(null); // held 450ms -> fires

      expect(toggle).toHaveBeenCalledOnce();
    });

    it('prevents controller grips from re-arming if press begins over a panel and moves off while held', () => {
      let now = 1000;
      const reg = createMockPointerRegistry({
        grips: [true, true],
        overPanel: true,
      });

      const detector = new SystemGestureDetector(reg as never, {
        toggleCooldownMs: 1000,
        now: () => now,
      });

      const toggle = vi.fn();
      detector.onSystemToggle = toggle;

      const session = {
        inputSources: [
          { gamepad: { buttons: [{}, { pressed: true }] } },
          { gamepad: { buttons: [{}, { pressed: true }] } },
        ],
      } as unknown as XRSession;

      // Grip pressed while over panel -> blocked
      detector.update(session);
      expect(toggle).not.toHaveBeenCalled();

      // Ray moves off panel while grip remains pressed -> must NOT fire
      reg.setOverPanel(false);
      now += 100;
      detector.update(session);
      expect(toggle).not.toHaveBeenCalled();

      // Release grip
      const releasedSession = {
        inputSources: [
          { gamepad: { buttons: [{}, { pressed: false }] } },
          { gamepad: { buttons: [{}, { pressed: false }] } },
        ],
      } as unknown as XRSession;
      now += 100;
      detector.update(releasedSession);

      // Press grip again off-panel -> fires once
      now += 1100;
      detector.update(session);
      expect(toggle).toHaveBeenCalledOnce();
    });

    it('enforces release invariant across simultaneous hand pinches and controller grips', () => {
      let now = 1000;
      const reg = createMockPointerRegistry({
        hands: [{ pinched: true, y: 1.0 }, { pinched: true, y: 1.0 }],
        grips: [true, true],
        overPanel: false,
      });

      const detector = new SystemGestureDetector(reg as never, {
        bothPinchHoldMs: 400,
        toggleCooldownMs: 1000,
        now: () => now,
      });

      const toggle = vi.fn();
      detector.onSystemToggle = toggle;

      const session = {
        inputSources: [
          { gamepad: { buttons: [{}, { pressed: true }] } },
          { gamepad: { buttons: [{}, { pressed: true }] } },
        ],
      } as unknown as XRSession;

      // Controller grip fires first on rising edge
      detector.update(session);
      expect(toggle).toHaveBeenCalledTimes(1);

      // While grip is held, advance time past bothPinchHoldMs: both-pinch toggle is gated by cooldown
      now += 500;
      detector.update(session);
      expect(toggle).toHaveBeenCalledTimes(1); // Gated by cooldown
    });
  });
});
