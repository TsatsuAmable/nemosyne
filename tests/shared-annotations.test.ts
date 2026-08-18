// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { SharedAnnotationManager } from '../src/vr/interactions/SharedAnnotationManager.ts';
import { NetworkManager } from '../src/network/NetworkManager.ts';

describe('Sprint 10B.5: Shared Annotations, Bookmarks & Synchronized Tours', () => {
  let annotationManager: SharedAnnotationManager;

  beforeEach(() => {
    annotationManager = new SharedAnnotationManager();
  });

  it('adds and renders a 3D spatial pin annotation', () => {
    const annot = annotationManager.addAnnotation([1, 1.6, -2], 'Outlier Cluster', 'user-1', 'Bob');
    if (!annot) throw new Error('expected participant annotation');
    expect(annot.id).toBeTruthy();
    expect(annotationManager.annotations.size).toBe(1);
    expect(annotationManager.annotationMeshes.has(annot.id)).toBe(true);

    const mesh = annotationManager.annotationMeshes.get(annot.id);
    expect(mesh).toBeInstanceOf(THREE.Group);
    expect(mesh?.position.x).toBe(1);
  });

  it('removes an annotation and disposes its 3D mesh cleanly', () => {
    const annot = annotationManager.addAnnotation([0, 1, 0], 'Test Note');
    if (!annot) throw new Error('expected participant annotation');
    expect(annotationManager.annotations.size).toBe(1);

    const removed = annotationManager.removeAnnotation(annot.id);
    expect(removed).toBe(true);
    expect(annotationManager.annotations.size).toBe(0);
    expect(annotationManager.annotationMeshes.has(annot.id)).toBe(false);
  });

  it('adds and manages saved camera bookmarks', () => {
    const bm = annotationManager.addBookmark('Overview Anchor', [0, 1.6, 0], [0, 0, 0, 1], 'user-1');
    if (!bm) throw new Error('expected participant bookmark');
    expect(bm.id).toBeTruthy();
    expect(annotationManager.bookmarks.size).toBe(1);
    expect(annotationManager.bookmarks.get(bm.id)?.title).toBe('Overview Anchor');

    const removed = annotationManager.removeBookmark(bm.id);
    expect(removed).toBe(true);
    expect(annotationManager.bookmarks.size).toBe(0);
  });

  it('handles remote network state deltas for annotations and bookmarks', () => {
    const net = new NetworkManager();
    const broadcastSpy = vi.spyOn(net, 'broadcastStateDelta');
    annotationManager.setNetworkManager(net);

    // Add local annotation -> triggers broadcast
    const annot = annotationManager.addAnnotation([0, 2, -1], 'Remote Sync Test');
    if (!annot) throw new Error('expected participant annotation');
    expect(broadcastSpy).toHaveBeenCalledWith('annotations_add', expect.any(Object));

    // Handle incoming remote annotation
    annotationManager.handleRemoteDelta('annotations_add', {
      id: 'remote-1',
      position: [2, 2, -2],
      text: 'Peer Note',
      authorId: 'peer-2',
      authorName: 'Charlie',
      timestamp: Date.now(),
    });

    expect(annotationManager.annotations.size).toBe(2);
    expect(annotationManager.annotations.has('remote-1')).toBe(true);

    // Handle remote remove
    annotationManager.handleRemoteDelta('annotations_remove', { id: 'remote-1' });
    expect(annotationManager.annotations.has('remote-1')).toBe(false);
  });

  it('rejects malformed remote annotations and bookmarks without rendering them', () => {
    annotationManager.handleRemoteDelta('annotations_add', {
      id: 'bad',
      position: [Infinity, 0, 0],
      text: 'invalid',
      authorId: 'peer',
      authorName: 'Peer',
      timestamp: Date.now(),
    });
    annotationManager.handleRemoteDelta('bookmarks_add', {
      id: 'bad-bookmark',
      title: 'invalid',
      cameraPosition: [0, 1, 0],
      cameraRotation: [0, 0, 0],
      authorId: 'peer',
      timestamp: Date.now(),
    });

    expect(annotationManager.annotations.size).toBe(0);
    expect(annotationManager.bookmarks.size).toBe(0);
  });

  it('rejects malformed removal and tour deltas', () => {
    annotationManager.handleRemoteDelta('annotations_remove', { id: '' });
    annotationManager.handleRemoteDelta('bookmarks_remove', { id: 'x'.repeat(129) });
    annotationManager.handleRemoteDelta('tour_step', { stepIndex: -1, tourId: 'tour' });
    annotationManager.handleRemoteDelta('tour_step', { stepIndex: 1.5, tourId: 'tour' });
    annotationManager.handleRemoteDelta('tour_step', { stepIndex: 2, tourId: '' });

    expect(annotationManager.currentTourStep).toBe(0);
  });

  it('ignores cyclic, non-object, and out-of-range remote payloads', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    expect(() => annotationManager.handleRemoteDelta('annotations_add', cyclic)).not.toThrow();
    expect(() => annotationManager.handleRemoteDelta('annotations_add', null as never)).not.toThrow();
    annotationManager.handleRemoteDelta('annotations_add', {
      id: 'bad-color',
      position: [0, 0, 0],
      text: 'invalid color',
      authorId: 'peer',
      authorName: 'Peer',
      timestamp: Date.now(),
      colorHex: 0x1000000,
    });

    expect(annotationManager.annotations.size).toBe(0);
  });

  it('drops oversized and rate-limited remote deltas before rendering', () => {
    const oversizedText = 'x'.repeat(20_000);
    annotationManager.handleRemoteDelta('annotations_add', {
      id: 'oversized',
      position: [0, 0, 0],
      text: oversizedText,
      authorId: 'peer',
      authorName: 'Peer',
      timestamp: Date.now(),
    });
    expect(annotationManager.annotations.size).toBe(0);

    for (let index = 0; index < 101; index += 1) {
      annotationManager.handleRemoteDelta('tour_step', { stepIndex: index, tourId: 'tour' });
    }

    expect(annotationManager.currentTourStep).toBe(99);
  });

  it('blocks observer annotation and bookmark mutations', () => {
    const observer = new NetworkManager({ role: 'observer' });
    const manager = new SharedAnnotationManager(observer);

    expect(manager.addAnnotation([0, 1, -1], 'Blocked')).toBeNull();
    expect(manager.addBookmark('Blocked', [0, 1, 0], [0, 0, 0, 1])).toBeNull();
    expect(manager.removeAnnotation('missing')).toBe(false);
    expect(manager.removeBookmark('missing')).toBe(false);
    manager.broadcastTourStep(3);
    expect(manager.annotations.size).toBe(0);
    expect(manager.bookmarks.size).toBe(0);
    expect(manager.currentTourStep).toBe(0);
  });

  it('synchronizes guided tour steps across WebRTC peers', () => {
    const net = new NetworkManager();
    annotationManager.setNetworkManager(net);

    const onRemoteStep = vi.fn();
    annotationManager.addEventListener('remoteTourStep', onRemoteStep);

    annotationManager.broadcastTourStep(2, 'dataset-tour');
    expect(annotationManager.currentTourStep).toBe(2);

    annotationManager.handleRemoteDelta('tour_step', { stepIndex: 3, tourId: 'dataset-tour' });
    expect(annotationManager.currentTourStep).toBe(3);
    expect(onRemoteStep).toHaveBeenCalled();
  });

  it('accepts legacy remote payloads and coerces them to the canonical shape', () => {
    // Legacy annotation: colorHex as a CSS string and authorName omitted —
    // both accepted by the old unchecked cast. Coerce to a numeric colorHex
    // and default the authorName, without dropping the other security bounds.
    annotationManager.handleRemoteDelta('annotations_add', {
      id: 'legacy-annot',
      position: [1, 2, 3],
      text: 'Legacy note',
      authorId: 'peer',
      timestamp: Date.now(),
      colorHex: '#ff0000',
    });
    expect(annotationManager.annotations.size).toBe(1);
    const annot = annotationManager.annotations.get('legacy-annot');
    expect(annot?.colorHex).toBe(0xff0000);
    expect(annot?.authorName).toBe('');

    // Legacy bookmark: cameraRotation omitted — default to the identity
    // quaternion so a cross-build bookmark still restores a valid pose.
    annotationManager.handleRemoteDelta('bookmarks_add', {
      id: 'legacy-bm',
      title: 'Legacy bookmark',
      cameraPosition: [0, 1, 0],
      authorId: 'peer',
      timestamp: Date.now(),
    });
    expect(annotationManager.bookmarks.size).toBe(1);
    expect(annotationManager.bookmarks.get('legacy-bm')?.cameraRotation).toEqual([0, 0, 0, 1]);
  });
});
