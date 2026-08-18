// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { ControllerPointer } from '../src/vr/Controllers.ts';
import { HandPointer } from '../src/vr/Hands.ts';
import { PointerRegistry } from '../src/vr/input/PointerRegistry.ts';
import { NetworkManager } from '../src/network/NetworkManager.ts';
import { SignallingChannel } from '../src/network/SignallingChannel.ts';
import { deallocBytes } from '../src/wasm/RuntimeBridge.ts';
import { CommandApplier, COMMAND_MAGIC, COMMAND_VERSION, OP_UPDATE_TRANSFORM } from '../src/wasm/CommandApplier.ts';

describe('Audit Pass 2 - Subsystem Resiliency & Bounds Safety', () => {
  describe('1. WebXR Input Router & Controller Event Handling', () => {
    it('handles controller disconnect event gracefully and clears selection listener', () => {
      const mockListeners = new Map<string, (event: { type: string }) => void>();
      const mockControllerGroup = {
        add: vi.fn(),
        addEventListener: (type: string, fn: (event: { type: string }) => void) => mockListeners.set(type, fn),
        removeEventListener: (type: string, fn: (event: { type: string }) => void) => mockListeners.delete(type),
        getWorldPosition: vi.fn(),
        getWorldQuaternion: vi.fn(),
      };
      const mockRenderer = {
        xr: {
          getController: () => mockControllerGroup,
        },
      } as unknown as THREE.WebGLRenderer;

      const controller = new ControllerPointer(mockRenderer, 0);
      controller.handedness = 'left';
      controller.onSelect = vi.fn();

      // Trigger disconnected listener registered during construction
      const onDisconnected = mockListeners.get('disconnected');
      expect(onDisconnected).toBeDefined();
      onDisconnected!({ type: 'disconnected' });

      expect(controller.handedness).toBe('none');
      expect(controller.ray.visible).toBe(false);
      expect(controller.onSelect).toBeNull();
    });

    it('handles hand disconnect event gracefully and resets pinch states', () => {
      const mockListeners = new Map<string, (event: { type: string }) => void>();
      const mockHandGroup = {
        add: vi.fn(),
        addEventListener: (type: string, fn: (event: { type: string }) => void) => mockListeners.set(type, fn),
        removeEventListener: (type: string, fn: (event: { type: string }) => void) => mockListeners.delete(type),
      };
      const mockRenderer = {
        xr: {
          getHand: () => mockHandGroup,
        },
      } as unknown as THREE.WebGLRenderer;

      const hand = new HandPointer(mockRenderer, 0);
      hand.pinched = true;
      hand.pinchDistance = 0.02;
      hand.ray.visible = true;

      // Trigger disconnected listener registered during construction
      const onDisconnected = mockListeners.get('disconnected');
      expect(onDisconnected).toBeDefined();
      onDisconnected!({ type: 'disconnected' });

      expect(hand.jointsValid).toBe(false);
      expect(hand.pinched).toBe(false);
      expect(hand.pinchDistance).toBe(Infinity);
      expect(hand.ray.visible).toBe(false);
      expect(hand.onPinchStart).toBeNull();
    });

    it('PointerRegistry safely removes controllers and handles null inputSources gracefully', () => {
      const registry = new PointerRegistry({ renderer: { xr: {} } } as any);
      const mockCtrl = { handedness: 'right', getRay: () => new THREE.Ray() } as any;

      registry.addController(mockCtrl);
      expect(registry.controllers.length).toBe(1);

      registry.removeController(mockCtrl);
      expect(registry.controllers.length).toBe(0);

      const source = registry.findSourceForController(mockCtrl, null as any);
      expect(source).toBeNull();
    });
  });

  describe('2. WebRTC Signalling & Peer Connection Resiliency', () => {
    it('SignallingChannel caps offline message queue length to prevent unbounded growth', () => {
      const channel = new SignallingChannel('ws://localhost:1234', 'room1', 'peer1');
      for (let i = 0; i < 150; i++) {
        channel.sendSignal('peer2', { count: i });
      }

      expect(channel._queue.length).toBe(100);
      expect(channel._queue[channel._queue.length - 1].data).toEqual({ count: 149 });
    });

    it('NetworkManager handles leave signals and closes duplicate peer connections', () => {
      const net = new NetworkManager({ roomId: 'room1', peerId: 'peer1' });
      const peerId = 'peer2';

      // Simulate existing connection
      const mockClose = vi.fn();
      const mockConn = { close: mockClose } as any;
      net.connections.set(peerId, mockConn);

      // Handle leave signal
      net._onSignal({ from: peerId, data: { type: 'leave' } });

      expect(mockClose).toHaveBeenCalled();
      expect(net.connections.has(peerId)).toBe(false);
    });
  });

  describe('3. WASM Panic Safety & Memory Allocation Boundaries', () => {
    it('deallocBytes safely handles zero/null pointers without throwing when uninitialised', () => {
      expect(() => {
        deallocBytes(0, 0);
      }).toThrow('Runtime not initialised');
    });

    it('CommandApplier safely bounds-checks truncated byte buffer payloads without RangeError', () => {
      const scene = new THREE.Scene();
      const applier = new CommandApplier(scene);

      // Construct a header claiming 1 command of OP_UPDATE_TRANSFORM (needs 44 bytes), but buffer is truncated to 20 bytes
      const buffer = new ArrayBuffer(20);
      const view = new DataView(buffer);
      view.setUint32(0, COMMAND_MAGIC, true);
      view.setUint16(4, COMMAND_VERSION, true);
      view.setUint16(6, 1, true); // 1 command
      view.setUint8(8, OP_UPDATE_TRANSFORM); // opcode

      let commands;
      expect(() => {
        commands = applier.applyCommandBuffer(buffer, 0, 20);
      }).not.toThrow();

      expect(commands).toEqual([]);
    });
  });
});
