// @ts-nocheck
// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { InputTelemetry } from '../src/vr/InputTelemetry.ts';
import { VRConsole } from '../src/vr/ui/VRConsole.ts';
import { OperationLogPanel } from '../src/vr/ui/OperationLogPanel.ts';

describe('Panel Constructor Null-Safety Regression Suite', () => {
  it('instantiates InputTelemetry without throwing uninitialized derived field errors', () => {
    const mockCameraGroup = new THREE.Group();
    const mockEngine = {
      cameraGroup: mockCameraGroup,
      camera: new THREE.PerspectiveCamera(),
      scene: new THREE.Scene(),
      pointers: { controllers: [], hands: [] },
    } as any;

    expect(() => new InputTelemetry(mockEngine)).not.toThrow();
  });

  it('instantiates VRConsole without throwing uninitialized derived field errors', () => {
    const mockCameraGroup = new THREE.Group();
    expect(() => new VRConsole(mockCameraGroup)).not.toThrow();
  });

  it('instantiates OperationLogPanel without throwing uninitialized derived field errors', () => {
    const mockCameraGroup = new THREE.Group();
    expect(() => new OperationLogPanel(mockCameraGroup)).not.toThrow();
  });
});
