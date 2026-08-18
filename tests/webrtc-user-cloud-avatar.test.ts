// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { UserMetadataDataset } from '../src/data/UserMetadataDataset.ts';
import { TelemetryInterpreter } from '../src/data/TelemetryInterpreter.ts';
import { UserCloudAvatar } from '../src/vr/artifacts/UserCloudAvatar.ts';
import { NetworkManager } from '../src/network/NetworkManager.ts';

describe('Sprint 11.1: WebRTC Multi-User & User Cloud Avatar Engine', () => {
  let dataset: UserMetadataDataset;
  let interpreter: TelemetryInterpreter;

  beforeEach(() => {
    dataset = new UserMetadataDataset({
      userId: 'peer-1',
      userName: 'Alice',
      role: 'Analyst',
      colorHex: 0x00ffcc,
    });
    interpreter = new TelemetryInterpreter(dataset);
  });

  it('instantiates UserMetadataDataset and records telemetry', () => {
    expect(dataset.profile.userName).toBe('Alice');
    interpreter.processEvent({
      eventType: 'hover',
      column: 'revenue',
      dwellMs: 250,
      confidence: 0.98,
      headPos: [0, 1.6, -1],
    });
    expect(dataset.records.length).toBe(1);
    expect(dataset.getPrimaryFocusColumn()).toBe('revenue');
  });

  it('calculates average sentiment from interaction events', () => {
    interpreter.processEvent({ eventType: 'select', column: 'price' });
    interpreter.processEvent({ eventType: 'undo' });
    expect(dataset.records.length).toBe(2);
    expect(typeof dataset.getAverageSentiment()).toBe('number');
  });

  it('instantiates 3D UserCloudAvatar mesh and updates pose telemetry', () => {
    const avatar = new UserCloudAvatar(dataset);
    expect(avatar).toBeDefined();
    expect(avatar.children.length).toBeGreaterThan(0);
    expect(avatar.nameTagMesh).toBeDefined();
    expect(avatar.leftHandMesh).toBeDefined();
    expect(avatar.rightHandMesh).toBeDefined();

    const headPos = new THREE.Vector3(1, 1.6, 2);
    expect(() => avatar.updateTelemetry(headPos, 1000)).not.toThrow();
    expect(avatar.position.x).toBe(1);
  });

  it('updates full 6DoF head and hand poses via updatePose', () => {
    const avatar = new UserCloudAvatar(dataset);
    const headPos = new THREE.Vector3(2, 1.6, -3);
    const headRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
    const leftHand = new THREE.Vector3(1.8, 1.4, -2.8);
    const rightHand = new THREE.Vector3(2.2, 1.4, -2.8);

    avatar.updatePose(headPos, headRot, leftHand, rightHand);

    expect(avatar.position.x).toBe(2);
    expect(avatar.quaternion.y).toBeCloseTo(headRot.y);
    expect(avatar.leftHandMesh.position.x).toBeCloseTo(-0.2);
    expect(avatar.rightHandMesh.position.x).toBeCloseTo(0.2);
  });

  it('disposes avatar geometries and materials cleanly', () => {
    const avatar = new UserCloudAvatar(dataset);
    expect(() => avatar.dispose()).not.toThrow();
  });

  it('broadcasts user telemetry over NetworkManager RTCDataChannel bridge', () => {
    const net = new NetworkManager({ peerName: 'TestPeer' });
    expect(() => net.broadcastUserTelemetry({ activeColumn: 'sales', sentiment: 0.8 })).not.toThrow();
  });
});
