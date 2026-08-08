/**
 * WebXR 3D Spatial Audio Synthesizer.
 *
 * Uses Web Audio API `PannerNode` and `AudioListener` spatialization to position
 * audio chimes, proximity hums, and cluster resonance chords in 3D VR space.
 */

import * as THREE from 'three';

export interface SpatialAudioOptions {
  enabled?: boolean;
  masterVolume?: number;
  panningModel?: PanningModelType;
}

export class SpatialAudioSynthesizer {
  enabled: boolean;
  masterVolume: number;
  panningModel: PanningModelType;

  ctx: AudioContext | null;
  listener: AudioListener | null;
  masterGain: GainNode | null;

  constructor({ enabled = true, masterVolume = 0.2, panningModel = 'HRTF' }: SpatialAudioOptions = {}) {
    this.enabled = enabled;
    this.masterVolume = masterVolume;
    this.panningModel = panningModel;

    this.ctx = null;
    this.listener = null;
    this.masterGain = null;
    this._initAudio();
  }

  private _initAudio(): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    } catch (err) {
      console.warn('[SpatialAudioSynthesizer] AudioContext init failed:', err);
    }
  }

  private _resume(): void {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Update 3D listener position and orientation matching VR camera.
   */
  updateListenerTransform(camera: THREE.Camera): void {
    if (!this.ctx || !this.enabled) return;

    const listener = this.ctx.listener;
    const pos = new THREE.Vector3();
    const forward = new THREE.Vector3();
    const up = new THREE.Vector3();

    camera.getWorldPosition(pos);
    camera.getWorldDirection(forward);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);

    if (listener.positionX) {
      listener.positionX.setValueAtTime(pos.x, this.ctx.currentTime);
      listener.positionY.setValueAtTime(pos.y, this.ctx.currentTime);
      listener.positionZ.setValueAtTime(pos.z, this.ctx.currentTime);
      listener.forwardX.setValueAtTime(forward.x, this.ctx.currentTime);
      listener.forwardY.setValueAtTime(forward.y, this.ctx.currentTime);
      listener.forwardZ.setValueAtTime(forward.z, this.ctx.currentTime);
      listener.upX.setValueAtTime(up.x, this.ctx.currentTime);
      listener.upY.setValueAtTime(up.y, this.ctx.currentTime);
      listener.upZ.setValueAtTime(up.z, this.ctx.currentTime);
    } else if ('setOrientation' in listener) {
      // Fallback for legacy Web Audio API
      (listener as unknown as { setPosition: (...args: number[]) => void }).setPosition(pos.x, pos.y, pos.z);
      (listener as unknown as { setOrientation: (...args: number[]) => void }).setOrientation(
        forward.x,
        forward.y,
        forward.z,
        up.x,
        up.y,
        up.z
      );
    }
  }

  /**
   * Play a 3D spatialized chime at a target world position.
   */
  playSpatialChime(position: THREE.Vector3, frequency = 880, duration = 0.12): PannerNode | null {
    if (!this.enabled || !this.ctx || !this.masterGain) return null;
    this._resume();

    const t = this.ctx.currentTime;
    const panner = this.ctx.createPanner();
    panner.panningModel = this.panningModel;
    panner.distanceModel = 'inverse';
    panner.refDistance = 1.0;
    panner.maxDistance = 20.0;
    panner.rolloffFactor = 1.0;

    if (panner.positionX) {
      panner.positionX.setValueAtTime(position.x, t);
      panner.positionY.setValueAtTime(position.y, t);
      panner.positionZ.setValueAtTime(position.z, t);
    } else {
      (panner as unknown as { setPosition: (...args: number[]) => void }).setPosition(position.x, position.y, position.z);
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + duration + 0.05);

    return panner;
  }

  /**
   * Play proximity pitch cue (frequency rises as distance decreases).
   */
  playProximityCue(distance: number, position: THREE.Vector3): void {
    const clampedDist = Math.max(0.1, Math.min(5.0, distance));
    // Pitch mapped from 300Hz (far) to 1200Hz (close)
    const freq = 1200 - (clampedDist / 5.0) * 900;
    this.playSpatialChime(position, freq, 0.06);
  }

  /**
   * Synthesize a harmonic multi-tone cluster resonance chord.
   */
  playClusterResonance(position: THREE.Vector3, clusterIndex = 0): void {
    const baseFrequencies = [440, 554.37, 659.25, 830.61]; // A major 7th chord
    const root = baseFrequencies[clusterIndex % baseFrequencies.length];
    const chord = [root, root * 1.25, root * 1.5];

    chord.forEach((freq, idx) => {
      setTimeout(() => {
        this.playSpatialChime(position, freq, 0.25);
      }, idx * 40);
    });
  }

  dispose(): void {
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
  }
}
