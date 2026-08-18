// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { CollaborativeStateSync } from '../src/network/CollaborativeStateSync.ts';

describe('Sprint 15.1: WebRTC Multi-User Collaborative State Sync Suite', () => {
  it('initializes local peer ID and broadcasts state payloads', () => {
    const sync = new CollaborativeStateSync('peer-local');
    expect(sync.localPeerId).toBe('peer-local');

    const mockChannel = {
      readyState: 'open',
      send: vi.fn(),
      onmessage: null,
    } as unknown as RTCDataChannel;

    sync.setDataChannel(mockChannel);
    sync.broadcastLocalState({ datasetName: 'SalesData', activeFilter: 'revenue > 100' });

    expect(mockChannel.send).toHaveBeenCalledTimes(1);
    const sentJson = (mockChannel.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sentJson).toContain('SalesData');
    expect(sentJson).toContain('peer-local');
  });

  it('receives and merges peer state updates', () => {
    const sync = new CollaborativeStateSync('peer-local');
    sync.applyPeerState({
      peerId: 'peer-remote-1',
      datasetName: 'SensorStream',
      lastUpdatedMs: Date.now(),
    });

    const peers = sync.getConnectedPeers();
    expect(peers.length).toBe(1);
    expect(peers[0].peerId).toBe('peer-remote-1');
    expect(peers[0].datasetName).toBe('SensorStream');
  });
});
