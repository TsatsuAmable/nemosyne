/**
 * UncertaintyVisualizer: Probability Clouds for Ambiguous Data
 *
 * Visualizes confidence, certainty, and probability in data:
 * - Flicker/pulse for low confidence
 * - Blur/ghost effects for uncertainty
 * - Multiple concurrent states (superposition)
 * - Probability-weighted opacity
 * - Entropy visualization
 */

class UncertaintyVisualizer {
  constructor(scene) {
    this.scene = scene;
    this.uncertaintyEntities = new Map();
    this.probabilityClouds = new Map();

    // Animation tickers
    this.ticker = 0;
    this.noiseSeed = Math.random() * 1000;
  }

  /**
   * Apply uncertainty visualization to an entity
   */
  visualizeUncertainty(entity, options = {}) {
    const {
      confidence = 0.5,      // 0-1 certainty
      uncertainty = 0.2,   // Variance amount
      type = 'pulse',        // 'pulse', 'flicker', 'ghost', 'blur'
      decay = false          // Fade over time
    } = options;

    const key = entity.dataset?.entityId || entity.id;

    // Create uncertainty visualization based on type
    switch (type) {
      case 'pulse':
        return this.applyPulseEffect(entity, confidence, uncertainty);
      case 'flicker':
        return this.applyFlickerEffect(entity, confidence, uncertainty);
      case 'ghost':
        return this.applyGhostEffect(entity, confidence, uncertainty);
      case 'blur':
        return this.applyBlurEffect(entity, uncertainty);
      case 'cloud':
        return this.applyProbabilityCloud(entity, uncertainty);
      default:
        return this.applyPulseEffect(entity, confidence, uncertainty);
    }
  }

  /**
   * Pulse effect: subtle opacity oscillation
   */
  applyPulseEffect(entity, confidence, intensity) {
    const baseOpacity = confidence;
    const pulseRange = (1 - confidence) * intensity;
    const period = 1000 + (1 - confidence) * 2000; // Lower confidence = slower pulse

    // Store animation params
    this.uncertaintyEntities.set(entity, {
      type: 'pulse',
      baseOpacity,
      pulseRange,
      period,
      startTime: performance.now()
    });

    // Apply via A-Frame animation
    entity.setAttribute('animation__uncertainty', {
      property: 'material.opacity',
      from: baseOpacity - pulseRange,
      to: baseOpacity + pulseRange,
      dur: period,
      dir: 'alternate',
      loop: true,
      easing: 'easeInOutSine'
    });

    // Scale pulse for very uncertain data
    if (confidence < 0.3) {
      entity.setAttribute('animation__uncertainty-scale', {
        property: 'scale',
        from: '1 1 1',
        to: '1.1 1.1 1.1',
        dur: period / 2,
        dir: 'alternate',
        loop: true,
        easing: 'easeInOutSine'
      });
    }
  }

  /**
   * Flicker effect: rapid random opacity changes
   */
  applyFlickerEffect(entity, confidence, intensity) {
    // Flicker is applied dynamically each frame
    this.uncertaintyEntities.set(entity, {
      type: 'flicker',
      baseOpacity: confidence,
      intensity,
      flickerRate: (1 - confidence) * 10, // flickers per second
      lastFlicker: 0
    });

    // Start flicker loop
    this.startFlickerLoop(entity);
  }

  startFlickerLoop(entity) {
    const params = this.uncertaintyEntities.get(entity);
    if (!params || params.type !== 'flicker') return;

    const now = performance.now();

    if (now - params.lastFlicker > (1000 / params.flickerRate)) {
      // Random flicker
      const noise = Math.random();
      const newOpacity = params.baseOpacity +
        (noise - 0.5) * params.intensity * 2;

      entity.setAttribute('material', 'opacity',
        Math.max(0.1, Math.min(1, newOpacity)));

      params.lastFlicker = now;
    }

    requestAnimationFrame(() => this.startFlickerLoop(entity));
  }

  /**
   * Ghost effect: multiple overlapping entities
   */
  applyGhostEffect(entity, confidence, intensity) {
    const ghostCount = Math.floor((1 - confidence) * 5) + 1; // 1-6 ghosts

    // Create ghost copies
    const ghosts = [];
    const originalPos = entity.getAttribute('position');

    for (let i = 0; i < ghostCount; i++) {
      const ghost = entity.cloneNode(true);

      // Offset position
      const offset = (i - ghostCount/2) * intensity;
      ghost.setAttribute('position', {
        x: originalPos.x + offset,
        y: originalPos.y + offset * 0.5,
        z: originalPos.z + offset
      });

      // Ghost appearance
      ghost.setAttribute('material', 'opacity', 0.2 / ghostCount);
      ghost.setAttribute('material', 'transparent', true);
      ghost.setAttribute('material', 'depthWrite', false);
      ghost.setAttribute('material', 'emissiveIntensity', 0.1);

      // Remove interaction
      ghost.classList.remove('clickable');

      // Store reference
      ghost.dataset.isGhost = true;
      ghost.dataset.parentId = entity.dataset?.entityId || entity.id;

      entity.parentNode.appendChild(ghost);
      ghosts.push(ghost);
    }

    this.uncertaintyEntities.set(entity, {
      type: 'ghost',
      ghosts,
      intensity
    });
  }

  /**
   * Blur effect: diffuse edges (via scale + opacity)
   */
  applyBlurEffect(entity, intensity) {
    // Create outer glow ring
    const glow = document.createElement('a-sphere');
    const pos = entity.getAttribute('position');
    const size = entity.getAttribute('radius') || 0.5;

    glow.setAttribute('position', pos);
    glow.setAttribute('radius', size * (1 + intensity * 2));
    glow.setAttribute('material', {
      color: entity.getAttribute('material')?.color || '#00d4aa',
      transparent: true,
      opacity: intensity * 0.3,
      depthWrite: false
    });

    entity.parentNode.appendChild(glow);

    this.uncertaintyEntities.set(entity, {
      type: 'blur',
      glow,
      intensity
    });
  }

  /**
   * Probability cloud: multiple possible positions
   */
  applyProbabilityCloud(entity, uncertainty) {
    const states = 5; // Number of possible positions
    const cloudParticles = [];

    for (let i = 0; i < states; i++) {
      const particle = entity.cloneNode(true);
      const basePos = entity.getAttribute('position');

      // Random position within uncertainty radius
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = Math.random() * uncertainty;

      particle.setAttribute('position', {
        x: basePos.x + radius * Math.sin(phi) * Math.cos(theta),
        y: basePos.y + radius * Math.sin(phi) * Math.sin(theta),
        z: basePos.z + radius * Math.cos(phi)
      });

      // Probability = likelihood of being at this position
      const probability = 1 - (radius / uncertainty);

      particle.setAttribute('material', 'opacity', probability * 0.3);
      particle.setAttribute('scale', {
        x: probability,
        y: probability,
        z: probability
      });

      particle.classList.remove('clickable');
      particle.dataset.isProbabilityState = true;

      entity.parentNode.appendChild(particle);
      cloudParticles.push({ particle, probability });
    }

    this.probabilityClouds.set(entity, cloudParticles);

    // Animate cloud convergence
    this.animateCloudConvergence(entity, cloudParticles);
  }

  animateCloudConvergence(entity, particles) {
    const duration = 2000;
    const start = performance.now();

    const animate = () => {
      const now = performance.now();
      const t = Math.min(1, (now - start) / duration);

      const basePos = entity.getAttribute('position');

      particles.forEach(({ particle, probability }) => {
        const pos = particle.getAttribute('position');

        // Lerp toward actual position based on probability
        const shouldConverge = probability > 0.5;
        const target = shouldConverge ? basePos : pos;

        const newPos = {
          x: pos.x + (target.x - pos.x) * t * 0.1,
          y: pos.y + (target.y - pos.y) * t * 0.1,
          z: pos.z + (target.z - pos.z) * t * 0.1
        };

        particle.setAttribute('position', newPos);
      });

      if (t < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  /**
   * Remove uncertainty visualization
   */
  clearUncertainty(entity) {
    const params = this.uncertaintyEntities.get(entity);
    if (!params) return;

    // Remove effect-specific cleanup
    switch (params.type) {
      case 'ghost':
        params.ghosts.forEach(g => g.remove());
        break;
      case 'blur':
        params.glow.remove();
        break;
    }

    // Stop animations
    entity.removeAttribute('animation__uncertainty');
    entity.removeAttribute('animation__uncertainty-scale');

    // Clear cloud
    const cloud = this.probabilityClouds.get(entity);
    if (cloud) {
      cloud.forEach(({ particle }) => particle.remove());
      this.probabilityClouds.delete(entity);
    }

    // Reset opacity
    entity.setAttribute('material', 'opacity', 1);
    entity.setAttribute('scale', '1 1 1');

    this.uncertaintyEntities.delete(entity);
  }

  /**
   * Update all uncertainty effects
   */
  updateAll() {
    this.ticker++;

    this.uncertaintyEntities.forEach((params, entity) => {
      if (params.type === 'pulse') {
        // Pulse is handled by A-Frame animation
      }
    });
  }

  /**
   * Calculate entropy of a dataset
   */
  calculateEntropy(data) {
    // Shannon entropy
    const counts = {};
    data.forEach(d => {
      const key = d.category || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
    });

    const total = data.length;
    let entropy = 0;

    Object.values(counts).forEach(count => {
      const p = count / total;
      entropy -= p * Math.log2(p);
    });

    return entropy;
  }

  /**
   * Visualize entropy as heat
   */
  visualizeEntropy(entity, data) {
    const entropy = this.calculateEntropy(data);
    const maxEntropy = Math.log2(Object.keys(data).length || 2);
    const normalized = entropy / maxEntropy; // 0-1

    // Color from cool (ordered) to hot (chaotic)
    const color = this.interpolateColor('#00d4aa', '#ff4400', normalized);

    entity.setAttribute('material', 'color', color);
    entity.setAttribute('material', 'emissive', color);

    return { entropy, color };
  }

  interpolateColor(c1, c2, t) {
    const r1 = parseInt(c1.substr(1, 2), 16);
    const g1 = parseInt(c1.substr(3, 2), 16);
    const b1 = parseInt(c1.substr(5, 2), 16);
    const r2 = parseInt(c2.substr(1, 2), 16);
    const g2 = parseInt(c2.substr(3, 2), 16);
    const b2 = parseInt(c2.substr(5, 2), 16);

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  }
}


console.log('[UncertaintyVisualizer] Module loaded');
