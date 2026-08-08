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

    const headPos = new THREE.Vector3(1, 1.6, 2);
    expect(() => avatar.updateTelemetry(headPos, 1000)).not.toThrow();
    expect(avatar.position.x).toBe(1);
  });

  it('broadcasts user telemetry over NetworkManager RTCDataChannel bridge', () => {
    const net = new NetworkManager({ peerName: 'TestPeer' });
    expect(() => net.broadcastUserTelemetry({ activeColumn: 'sales', sentiment: 0.8 })).not.toThrow();
  });
});
