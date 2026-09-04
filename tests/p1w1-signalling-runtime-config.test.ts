import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { readSignallingBrowserConfig } from '../src/network/SignallingRuntimeConfig.ts';
import { CollaborationCoordinator } from '../src/vr/coordinators/CollaborationCoordinator.ts';

describe('P1-W1 production signalling browser configuration', () => {
  it('does not invent a signalling endpoint for an unconfigured production build', () => {
    expect(readSignallingBrowserConfig({ PROD: true, DEV: false }, 'https://nemosyne.world/')).toBeNull();
  });

  it('keeps the same-origin Vite endpoint only for development', () => {
    expect(
      readSignallingBrowserConfig({ PROD: false, DEV: true }, 'http://localhost:5173/workspace')
    ).toEqual({
      url: 'ws://localhost:5173/__signal',
      source: 'development-default',
    });
  });

  it('accepts an explicit secure production signalling endpoint', () => {
    expect(
      readSignallingBrowserConfig(
        {
          PROD: true,
          DEV: false,
          VITE_NEMOSYNE_SIGNALLING_URL: 'wss://signal.example.test/__signal',
        },
        'https://nemosyne.world/'
      )
    ).toEqual({
      url: 'wss://signal.example.test/__signal',
      source: 'configured',
    });
  });

  it('rejects insecure or credential-bearing production endpoints', () => {
    expect(() =>
      readSignallingBrowserConfig({
        PROD: true,
        DEV: false,
        VITE_NEMOSYNE_SIGNALLING_URL: 'ws://signal.example.test/__signal',
      })
    ).toThrow(/requires wss/u);

    expect(() =>
      readSignallingBrowserConfig({
        PROD: true,
        DEV: false,
        VITE_NEMOSYNE_SIGNALLING_URL: 'wss://user:secret@signal.example.test/__signal',
      })
    ).toThrow(/must not contain credentials/u);

    expect(() =>
      readSignallingBrowserConfig({
        PROD: true,
        DEV: false,
        VITE_NEMOSYNE_SIGNALLING_URL: 'wss://signal.example.test/__signal?token=secret',
      })
    ).toThrow(/must not contain query parameters/u);
  });

  it('makes collaboration explicitly unavailable instead of constructing a dead production client', async () => {
    const setStatus = vi.fn();
    const log = vi.fn();
    const recordInteraction = vi.fn();
    const coordinator = new CollaborationCoordinator({
      presence: {
        scene: new THREE.Scene(),
        camera: new THREE.PerspectiveCamera(),
        cameraGroup: new THREE.Group(),
        annotationManager: null,
        getDatasetLabel: () => '-',
      },
      presentation: {
        getSettings: () => ({}),
        setStatus,
        log,
        recordInteraction,
        recordTelemetry: vi.fn(),
      },
      signallingConfig: null,
    });

    expect(coordinator.isAvailable()).toBe(false);
    await coordinator.joinCollaborationRoom('preview-room');
    expect(coordinator.networkManager).toBeNull();
    expect(setStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        connected: false,
        available: false,
        lastEvent: expect.stringMatching(/Collaboration unavailable/u),
      })
    );
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/Collaboration unavailable/u));
    expect(recordInteraction).toHaveBeenCalledWith(
      'Join room',
      expect.objectContaining({ result: 'unavailable', reason: 'signalling-unconfigured' })
    );
  });
});
