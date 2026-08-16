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
});
