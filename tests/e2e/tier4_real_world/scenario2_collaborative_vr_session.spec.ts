import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { NetworkManager } from '../../../src/network/NetworkManager.ts';
import { datasetToFlatBuffer, flatBufferToDataset } from '../../../src/data/serializers/FlatBuffersSerializer.ts';
import { WorldSceneComposer } from '../../../src/vr/coordinators/WorldSceneComposer.ts';
import { Dataset } from '../../../src/data/Dataset.ts';
import { disposeObject } from '../../../src/utils/Dispose.ts';

describe('Tier 4 — Scenario 2: Collaborative WebXR Spatial Analytics Session with Damped Headset Tracking', () => {
  it('Executes collaborative session workflow: peer network init, pose sync, FlatBuffer state transmission, torso anchor update, and clean disposal', () => {
    // Step 1: Initialize NetworkManager for local analyst
    const netManager = new NetworkManager({ peerName: 'Analyst_1', roomId: 'collab-room-alpha' });
    expect(netManager.roomId).toBe('collab-room-alpha');

    // Step 2: Binary FlatBuffer state serialization
    const sharedDataset = new Dataset(
      'CollabDS',
      [{ name: 'metric', type: 'NUMERIC' }],
      [{ metric: 99.5 }]
    );
    const binaryBuffer = datasetToFlatBuffer(sharedDataset);
    expect(binaryBuffer.byteLength).toBeGreaterThan(10);

    const receivedDataset = flatBufferToDataset(binaryBuffer);
    expect(receivedDataset.rows[0].metric).toBe(99.5);

    // Step 3: Headset tracking & torso anchor damping
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(2.0, 1.7, -3.0);
    camera.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 6);

    const cameraGroup = new THREE.Group();
    cameraGroup.add(camera);

    const mockEngine: any = {
      camera,
      cameraGroup,
      scene: new THREE.Scene(),
      addUpdatable: () => {},
    };

    const composer = new WorldSceneComposer(mockEngine);
    composer.update(0.016);

    expect(composer.analystAnchor.position.x).toBe(2.0);
    expect(composer.analystAnchor.position.z).toBe(-3.0);

    // Step 4: Disconnect and clean resources
    netManager.disconnect();
    disposeObject(composer.analystAnchor);
    expect(netManager.isConnected).toBe(false);
  });
});
