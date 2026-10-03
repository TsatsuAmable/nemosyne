/**
 * CMS-1 — collaboration contract extraction (exit-criterion falsifiers).
 *
 * Pins that the superseded legacy synchronizer does not exist in the
 * production tree (CMS-4 tombstone) and cannot be revived, that the neutral
 * avatar input contract exists as the extraction site, that no second
 * collaboration authority was introduced, and that the avatar behavioural
 * path is unchanged under the production caller's literal shape.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PeerAvatarManager, type PeerAvatarState } from '../src/network/PeerAvatarManager.ts';

const SRC_ROOT = fileURLToPath(new URL('../src', import.meta.url));

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSourceFiles(full, acc);
    } else if (entry.endsWith('.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

describe('CMS-1 collaboration contract extraction', () => {
  it('the superseded synchronizer surface is absent from the production tree', () => {
    // CMS-4 tombstone: the legacy synchronizer itself was deleted, so the
    // guard now means "no src file exists for it and no source names it" —
    // any revival (file or content) fails this falsifier.
    const offenders: string[] = [];
    for (const file of listSourceFiles(SRC_ROOT)) {
      const normalized = relative(SRC_ROOT, file).replace(/\\/g, '/');
      if (normalized === 'network/CollaborativeStateSync.ts' || readFileSync(file, 'utf8').includes('CollaborativeStateSync')) {
        offenders.push(normalized);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('PeerAvatarManager exports the neutral contract and no longer references the synchronizer', () => {
    const source = readFileSync(join(SRC_ROOT, 'network', 'PeerAvatarManager.ts'), 'utf8');
    expect(source).toContain('export interface PeerAvatarState');
    expect(source).not.toContain('CollaborativeStateSync');
    expect(source).not.toContain("from './CollaborativeStateSync");
  });

  it('the network production barrel does not re-export the superseded synchronizer', () => {
    const barrel = readFileSync(join(SRC_ROOT, 'network', 'index.ts'), 'utf8');
    expect(barrel).not.toContain('CollaborativeStateSync');
  });

  it('production-style call with the coordination literal shape drives avatar transforms', () => {
    const scene = new THREE.Scene();
    const manager = new PeerAvatarManager(scene);

    // The exact literal shape CollaborationCoordinator forwards on the
    // 'remoteCameraPose' event.
    manager.updatePeerTransforms({
      peerId: 'peer-remote-77',
      cameraPose: { position: [1.5, 2.5, -3.5], rotation: [0.1, 0.2, 0.3, 0.9] },
      lastUpdatedMs: Date.now(),
    });

    expect(manager.getAvatarCount()).toBe(1);
    const avatar = manager.getOrCreateAvatar('peer-remote-77');
    expect(avatar.headGroup.position.x).toBe(1.5);
    expect(avatar.headGroup.position.y).toBe(2.5);
    expect(avatar.headGroup.position.z).toBe(-3.5);
    expect(avatar.headGroup.quaternion.x).toBeCloseTo(0.1, 5);
    expect(avatar.headGroup.quaternion.w).toBeCloseTo(0.9, 5);
    expect(avatar.leftHandMesh.position.x).toBeCloseTo(1.3, 5);
    expect(avatar.rightHandMesh.position.x).toBeCloseTo(1.7, 5);

    manager.removePeer('peer-remote-77');
    expect(manager.getAvatarCount()).toBe(0);
  });

  it('a structurally richer peer-state shape still satisfies the neutral avatar contract', () => {
    type Expect<Cond extends true> = Cond;
    type IsAssignable<A, B> = A extends B ? true : false;

    // Structurally identical to the superseded synchronizer's peer state,
    // defined here without importing it.
    interface LegacyShapedPeerState {
      peerId: string;
      datasetName?: string;
      cameraPose?: { position: [number, number, number]; rotation: [number, number, number, number] };
      activeFilter?: string;
      lastUpdatedMs: number;
    }

    const legacyShaped: LegacyShapedPeerState = {
      peerId: 'peer-remote-88',
      datasetName: 'cluster-alpha',
      cameraPose: { position: [0, 1.6, 0], rotation: [0, 0, 0, 1] },
      activeFilter: 'top-4',
      lastUpdatedMs: 1_767_000_000_000,
    };

    // Compile-time structural-compatibility pin: the legacy shape (required
    // lastUpdatedMs + extra fields) is assignable to the avatar renderer's
    // neutral contract.
    const _assignability: Expect<IsAssignable<LegacyShapedPeerState, PeerAvatarState>> = true;
    expect(_assignability).toBe(true);

    // And it is accepted as a typed call.
    const scene = new THREE.Scene();
    const manager = new PeerAvatarManager(scene);
    const accepts = (peerState: PeerAvatarState): number => {
      manager.updatePeerTransforms(peerState);
      return manager.getAvatarCount();
    };
    expect(accepts(legacyShaped)).toBe(1);
  });
});