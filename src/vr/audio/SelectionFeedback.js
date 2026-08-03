import * as THREE from 'three';

/**
 * Audio + visual feedback for VR pointer selections.
 *
 * Uses short synthesized tones so no external assets are required. Visual
 * feedback flashes the active pointer ray and can spawn a transient hit
 * marker at the selection point.
 */
export class SelectionFeedback {
  constructor({
    enabled = true,
    volume = 0.15,
    audioEnabled = true,
    hapticEnabled = true,
    visualEnabled = true,
  } = {}) {
    this.enabled = enabled;
    this.volume = volume;
    this.audioEnabled = audioEnabled;
    this.hapticEnabled = hapticEnabled;
    this.visualEnabled = visualEnabled;
    this.audioContext = null;
    this._initAudio();

    this._activeFlashes = new Map();
    this._hitMarker = null;
  }

  setToggles({ audio, haptic, visual } = {}) {
    if (audio !== undefined) this.audioEnabled = !!audio;
    if (haptic !== undefined) this.hapticEnabled = !!haptic;
    if (visual !== undefined) this.visualEnabled = !!visual;
  }

  _initAudio() {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
      }
    } catch (err) {
      console.warn('[SelectionFeedback] AudioContext not available:', err);
    }
  }

  /**
   * Ensure the audio context is running. Browsers suspend contexts until a
   * user gesture; selection is a valid gesture, so resume here.
   */
  _resume() {
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
  }

  /**
   * Play a short tone. `shape` can be 'sine', 'square', 'triangle', 'sawtooth'.
   */
  playTone({
    frequency = 440,
    duration = 0.08,
    shape = 'sine',
    attack = 0.005,
    release = 0.03,
  } = {}) {
    if (!this.enabled || !this.audioEnabled || !this.audioContext) return;
    this._resume();

    const t = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = shape;
    osc.frequency.setValueAtTime(frequency, t);

    const vol = Math.max(0, Math.min(1, this.volume));
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, t + attack + duration + release);

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start(t);
    osc.stop(t + attack + duration + release + 0.02);
  }

  playHover() {
    this.playTone({ frequency: 660, duration: 0.03, shape: 'sine', volume: this.volume * 0.4 });
  }

  playSelect() {
    // Pleasant confirm chirp: two-tone "done" sound.
    this.playTone({ frequency: 880, duration: 0.06, shape: 'sine', volume: this.volume });
    setTimeout(() => {
      this.playTone({ frequency: 1320, duration: 0.08, shape: 'sine', volume: this.volume });
    }, 60);
  }

  playError() {
    this.playTone({ frequency: 220, duration: 0.12, shape: 'sawtooth', volume: this.volume });
  }

  /**
   * Tone for the TechnoCore lens hub. Each mode has a distinct pitch so the
   * user hears which lens is active.
   */
  playCoreTone(mode) {
    const map = {
      off: { frequency: 330, duration: 0.08, shape: 'sine' },
      statistical: { frequency: 880, duration: 0.1, shape: 'sine' },
      anomaly: { frequency: 220, duration: 0.14, shape: 'sawtooth' },
    };
    const tone = map[mode];
    if (!tone) return;
    this.playTone({ ...tone, volume: this.volume });
  }

  /**
   * Tone for Farcaster warps. Deep-net warps drop in pitch; reset warps are a
   * clean rising chirp.
   */
  playPortalTone(zone, operation) {
    if (operation === 'reset') {
      this.playTone({ frequency: 660, duration: 0.08, shape: 'sine', volume: this.volume });
      setTimeout(() => {
        this.playTone({ frequency: 990, duration: 0.1, shape: 'sine', volume: this.volume });
      }, 80);
      return;
    }
    const map = {
      DEEP_NET: { frequency: 196, duration: 0.14, shape: 'triangle' },
      LOCAL_MATRIX: { frequency: 523, duration: 0.1, shape: 'sine' },
    };
    const tone = map[zone] || map.LOCAL_MATRIX;
    this.playTone({ ...tone, volume: this.volume });
  }

  /**
   * Short feedback tone unique to each gesture so the user learns the audio
   * signature of common commands.
   */
  playGestureTone(gesture) {
    const map = {
      bothPinched: { frequency: 440, duration: 0.06, shape: 'sine' },
      pinchTogether: { frequency: 520, duration: 0.07, shape: 'sine' },
      pinchApart: { frequency: 620, duration: 0.07, shape: 'sine' },
      swipeRight: { frequency: 700, duration: 0.05, shape: 'triangle' },
      swipeLeft: { frequency: 700, duration: 0.05, shape: 'triangle' },
      sliceUp: { frequency: 800, duration: 0.06, shape: 'triangle' },
      sliceDown: { frequency: 800, duration: 0.06, shape: 'triangle' },
      scoopUp: { frequency: 900, duration: 0.08, shape: 'sine' },
      pushForward: { frequency: 480, duration: 0.07, shape: 'sine' },
      rotateCW: { frequency: 560, duration: 0.06, shape: 'sine' },
      rotateCCW: { frequency: 560, duration: 0.06, shape: 'sine' },
      okSign: { frequency: 1000, duration: 0.08, shape: 'sine' },
    };
    const tone = map[gesture];
    if (!tone) return;
    this.playTone({ ...tone, volume: this.volume });
  }

  /**
   * Trigger a short haptic pulse when available. If an XR input source with a
   * haptic actuator is provided, it is used directly; otherwise fall back to
   * the generic vibration API.
   */
  playHaptic(value = 0.6, durationMs = 40, source = null) {
    if (!this.enabled || !this.hapticEnabled) return;

    const actuator = source?.gamepad?.hapticActuators?.[0];
    if (actuator && typeof actuator.pulse === 'function') {
      actuator.pulse(value, durationMs).catch(() => {});
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(durationMs);
    }
  }

  /**
   * Flash the pointer ray to a bright color for a short duration.
   * `pointer` is a ControllerPointer or HandPointer with a `ray` Line mesh.
   */
  flashPointer(pointer, color = 0xffffff, durationMs = 120) {
    if (!this.enabled || !this.visualEnabled) return;
    const ray = pointer?.ray;
    if (!ray?.material) return;

    const mat = ray.material;
    const originalHex = mat.color.getHex();
    const originalOpacity = mat.opacity;

    // Cancel any previous flash on this pointer.
    const existing = this._activeFlashes.get(pointer);
    if (existing) {
      clearTimeout(existing.timeout);
      mat.color.setHex(existing.originalHex);
      mat.opacity = existing.originalOpacity;
    }

    mat.color.setHex(color);
    mat.opacity = Math.min(1, originalOpacity + 0.35);

    const timeout = setTimeout(() => {
      mat.color.setHex(originalHex);
      mat.opacity = originalOpacity;
      this._activeFlashes.delete(pointer);
    }, durationMs);

    this._activeFlashes.set(pointer, { timeout, originalHex, originalOpacity });
  }

  /**
   * Spawn a short-lived glowing marker at a world-space hit point.
   */
  showHitMarker(scene, position, color = 0x00ffcc, durationMs = 180) {
    if (!scene || !position) return;

    const geometry = new THREE.RingGeometry(0.02, 0.03, 16);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.lookAt(position.clone().add(new THREE.Vector3(0, 1, 0)));
    scene.add(mesh);

    const start = performance.now();
    const animate = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / durationMs);
      const scale = 1 + t * 2;
      mesh.scale.setScalar(scale);
      material.opacity = 0.9 * (1 - t);
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        scene.remove(mesh);
        geometry.dispose();
        material.dispose();
      }
    };
    requestAnimationFrame(animate);
  }

  dispose() {
    for (const { timeout } of this._activeFlashes.values()) {
      clearTimeout(timeout);
    }
    this._activeFlashes.clear();
    if (this.audioContext?.state !== 'closed') {
      this.audioContext?.close().catch(() => {});
    }
  }
}
