// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { SpatialAudioSynthesizer } from '../src/vr/audio/SpatialAudioSynthesizer.ts';

describe('SpatialAudioSynthesizer', () => {
  let synth: SpatialAudioSynthesizer;

  beforeEach(() => {
    synth = new SpatialAudioSynthesizer({ masterVolume: 0.1 });
  });

  it('instantiates correctly with volume and panning options', () => {
    expect(synth).toBeDefined();
    expect(synth.masterVolume).toBe(0.1);
    expect(synth.panningModel).toBe('HRTF');
  });

  it('updates listener transform from camera object', () => {
    const camera = new THREE.PerspectiveCamera(75, 1.0, 0.1, 100);
    camera.position.set(0, 1.6, 2);
    expect(() => synth.updateListenerTransform(camera)).not.toThrow();
  });

  it('handles spatial chime playback gracefully when AudioContext is simulated', () => {
    const pos = new THREE.Vector3(1, 2, -3);
    expect(() => synth.playSpatialChime(pos, 520, 0.1)).not.toThrow();
  });

  it('calculates proximity pitch cues based on distance', () => {
    const pos = new THREE.Vector3(0, 1, 0);
    expect(() => synth.playProximityCue(1.5, pos)).not.toThrow();
  });

  it('triggers cluster harmonic resonance chords', () => {
    const pos = new THREE.Vector3(2, 0, -1);
    expect(() => synth.playClusterResonance(pos, 1)).not.toThrow();
  });
});
