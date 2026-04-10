/**
 * nemosyne-distance-field: Distance Metric Visualization
 * 
 * Renders animated lines from a source crystal to its neighbors,
 * with line thickness and opacity based on similarity/distance.
 * 
 * Features:
 * - Animated line pulses for visibility
 * - Thickness based on similarity strength
 * - Opacity based on distance threshold
 * - Smooth fade in/out on hover
 * - Configurable distance metric (cosine, euclidean, etc)
 * 
 * Usage:
 * <a-entity nemosyne-distance-field=
 *   "sourcePoint: 2 1.6 -3;
 *    threshold: 0.5;
 *    maxConnections: 10;
 *    animate: true"></a-entity>
 */

AFRAME.registerComponent('nemosyne-distance-field', {
  schema: {
    // Source position (center of distance field)
    sourcePoint: { type: 'vec3', default: { x: 0, y: 0, z: 0 } },
    
    // Distance threshold (max distance to show connections)
    threshold: { type: 'number', default: 5.0 },
    
    // Maximum number of connections to render
    maxConnections: { type: 'number', default: 20 },
    
    // Animation settings
    animate: { type: 'boolean', default: true },
    pulseSpeed: { type: 'number', default: 1.0 },
    
    // Visual settings
    baseColor: { type: 'color', default: '#00d4aa' },
    highSimilarityColor: { type: 'color', default: '#00ffff' },
    lowSimilarityColor: { type: 'color', default: '#ff4444' },
    baseOpacity: { type: 'number', default: 0.6 },
    lineThickness: { type: 'number', default: 2 }, // pixels
    
    // Distance metric type
    metric: { type: 'string', default: 'cosine', oneOf: ['cosine', 'euclidean', 'manhattan'] },
    
    // Data source (array of neighbor objects)
    neighbors: { type: 'array', default: [] }
    // neighbors format: [{position: {x,y,z}, similarity: 0.0-1.0, distance: meters, id: string}, ...]
  },

  init: function() {
    this.lines = [];
    this.lineMeshes = [];
    this.isVisible = true;
    this.animationTime = 0;
    
    // Create line container
    this.container = new THREE.Group();
    this.el.setObject3D('distance-field', this.container);
    
    // Build initial lines
    this.createDistanceLines();
    
    console.log(`[DistanceField] Initialized with threshold ${this.data.threshold}`);
  },

  update: function(oldData) {
    // Rebuild if neighbors changed
    if (JSON.stringify(this.data.neighbors) !== JSON.stringify(oldData.neighbors)) {
      this.clearLines();
      this.createDistanceLines();
    }
    
    // Update source point if changed
    if (this.hasSourceChanged(oldData)) {
      this.updateSourcePosition();
    }
    
    // Update threshold
    if (this.data.threshold !== oldData.threshold) {
      this.updateThreshold();
    }
  },

  createDistanceLines: function() {
    if (!this.data.neighbors || this.data.neighbors.length === 0) {
      return;
    }

    // Filter and sort neighbors by similarity
    const validNeighbors = this.data.neighbors
      .filter(n => {
        // Filter by distance threshold
        const dist = this.calculateDistance(this.data.sourcePoint, n.position);
        return dist <= this.data.threshold;
      })
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0)) // Higher similarity first
      .slice(0, this.data.maxConnections); // Limit to max connections

    // Create lines for each neighbor
    validNeighbors.forEach((neighbor, i) => {
      this.createLine(neighbor, i);
    });

    console.log(`[DistanceField] Created ${this.lineMeshes.length} lines`);
  },

  createLine: function(neighbor, index) {
    const source = new THREE.Vector3(
      this.data.sourcePoint.x,
      this.data.sourcePoint.y,
      this.data.sourcePoint.z
    );
    const target = new THREE.Vector3(
      neighbor.position.x,
      neighbor.position.y,
      neighbor.position.z
    );

    // Calculate distance and similarity
    const distance = source.distanceTo(target);
    const similarity = neighbor.similarity || this.distanceToSimilarity(distance);

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      source.x, source.y, source.z,
      target.x, target.y, target.z
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Calculate color based on similarity
    const color = this.getColorForSimilarity(similarity);

    // Calculate opacity based on distance
    const normalizedDist = distance / this.data.threshold;
    const opacity = this.data.baseOpacity * (1 - normalizedDist * 0.5);

    // Create material
    const material = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      blending: THREE.AdditiveBlending,
      linewidth: Math.max(1, this.data.lineThickness * similarity)
    });

    // Create line
    const line = new THREE.Line(geometry, material);
    
    // Store metadata
    line.userData = {
      neighborId: neighbor.id,
      similarity: similarity,
      distance: distance,
      baseOpacity: opacity,
      index: index
    };

    this.container.add(line);
    this.lineMeshes.push(line);
  },

  tick: function(time, timeDelta) {
    if (!this.data.animate || this.lineMeshes.length === 0) return;

    this.animationTime += timeDelta * 0.001 * this.data.pulseSpeed;

    // Animate each line
    this.lineMeshes.forEach((line, i) => {
      // Phase offset based on index for wave effect
      const phase = this.animationTime + i * 0.3;
      
      // Oscillate opacity
      const pulse = 0.5 + 0.3 * Math.sin(phase);
      line.material.opacity = line.userData.baseOpacity * pulse;

      // Slight color shift for high similarity lines
      if (line.userData.similarity > 0.7) {
        const intensity = 0.5 + 0.5 * Math.sin(phase * 2);
        line.material.color.setHSL(0.5, 1, 0.5 + intensity * 0.2);
      }
    });
  },

  clearLines: function() {
    this.lineMeshes.forEach(line => {
      this.container.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    });
    this.lineMeshes = [];
  },

  updateSourcePosition: function() {
    // Update all line geometries to new source point
    this.lineMeshes.forEach(line => {
      const positions = line.geometry.attributes.position.array;
      positions[0] = this.data.sourcePoint.x;
      positions[1] = this.data.sourcePoint.y;
      positions[2] = this.data.sourcePoint.z;
      line.geometry.attributes.position.needsUpdate = true;
    });
  },

  updateThreshold: function() {
    // Hide/show lines based on new threshold
    this.lineMeshes.forEach(line => {
      const dist = line.userData.distance;
      if (dist > this.data.threshold) {
        line.visible = false;
      } else {
        line.visible = true;
        // Recalculate opacity
        const normalizedDist = dist / this.data.threshold;
        line.userData.baseOpacity = this.data.baseOpacity * (1 - normalizedDist * 0.5);
      }
    });
  },

  // Calculate distance between two points
  calculateDistance: function(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
  },

  // Convert distance to similarity (0-1)
  distanceToSimilarity: function(distance) {
    return Math.max(0, 1 - distance / this.data.threshold);
  },

  // Get color based on similarity
  getColorForSimilarity: function(similarity) {
    const color = new THREE.Color();
    
    if (similarity > 0.7) {
      // High similarity: bright cyan
      color.set(this.data.highSimilarityColor);
    } else if (similarity > 0.4) {
      // Medium: interpolate between base and high
      const t = (similarity - 0.4) / 0.3;
      color.set(this.data.baseColor);
      const highColor = new THREE.Color(this.data.highSimilarityColor);
      color.lerp(highColor, t);
    } else {
      // Low similarity: shift toward red
      const t = similarity / 0.4;
      color.set(this.data.lowSimilarityColor);
      const base = new THREE.Color(this.data.baseColor);
      color.lerp(base, t);
    }
    
    return color;
  },

  hasSourceChanged: function(oldData) {
    if (!oldData.sourcePoint) return true;
    return (
      this.data.sourcePoint.x !== oldData.sourcePoint.x ||
      this.data.sourcePoint.y !== oldData.sourcePoint.y ||
      this.data.sourcePoint.z !== oldData.sourcePoint.z
    );
  },

  /**
   * Public API: Update neighbors dynamically
   */
  updateNeighbors: function(newNeighbors) {
    this.el.setAttribute('nemosyne-distance-field', 'neighbors', newNeighbors);
  },

  /**
   * Public API: Show/hide field
   */
  setVisible: function(visible) {
    this.isVisible = visible;
    this.container.visible = visible;
  },

  /**
   * Public API: Highlight specific connection
   */
  highlightConnection: function(neighborId) {
    this.lineMeshes.forEach(line => {
      if (line.userData.neighborId === neighborId) {
        line.material.opacity = 1.0;
        line.material.color.set('#ffffff');
      } else {
        line.material.opacity = line.userData.baseOpacity * 0.3;
      }
    });
  },

  /**
   * Public API: Reset highlighting
   */
  resetHighlight: function() {
    this.lineMeshes.forEach(line => {
      line.material.opacity = line.userData.baseOpacity;
      line.material.color = this.getColorForSimilarity(line.userData.similarity);
    });
  },

  remove: function() {
    this.clearLines();
    this.el.removeObject3D('distance-field');
    console.log('[DistanceField] Removed');
  }
});


/**
 * Convenience wrapper component for crystal-to-crystal distance field
 */
AFRAME.registerComponent('nemosyne-crystal-connections', {
  schema: {
    sourceCrystal: { type: 'selector' }, // Reference to source crystal entity
    maxConnections: { type: 'number', default: 10 },
    threshold: { type: 'number', default: 5.0 },
    animate: { type: 'boolean', default: true }
  },

  init: function() {
    this.sourceCrystal = this.data.sourceCrystal;
    this.otherCrystals = [];
    
    if (!this.sourceCrystal) {
      console.error('[CrystalConnections] No source crystal specified');
      return;
    }

    // Find all other crystals in scene
    this.findOtherCrystals();
    
    // Calculate connections
    this.calculateConnections();
    
    // Listen for crystal movements
    this.setupEventListeners();
  },

  findOtherCrystals: function() {
    const allCrystals = document.querySelectorAll('[nemosyne-memory-crystal]');
    
    allCrystals.forEach(crystal => {
      if (crystal !== this.sourceCrystal) {
        // Get crystal data
        const comp = crystal.components['nemosyne-memory-crystal'];
        if (comp) {
          this.otherCrystals.push({
            id: comp.data.drawerId,
            entity: crystal,
            position: comp.data.position,
            embedding: comp.data.embedding || []
          });
        }
      }
    });
  },

  calculateConnections: function() {
    const sourcePos = this.sourceCrystal.getAttribute('position');
    const sourceComp = this.sourceCrystal.components['nemosyne-memory-crystal'];
    const sourceEmbedding = sourceComp?.data.embedding || [];

    // Calculate similarity for each crystal
    const connections = this.otherCrystals.map(crystal => {
      const distance = this.calculateDistance(sourcePos, crystal.position);
      
      // Calculate cosine similarity if embeddings available
      let similarity = 0;
      if (sourceEmbedding.length > 0 && crystal.embedding.length > 0) {
        similarity = this.cosineSimilarity(sourceEmbedding, crystal.embedding);
      } else {
        // Fall back to distance-based similarity
        similarity = Math.max(0, 1 - distance / this.data.threshold);
      }

      return {
        id: crystal.id,
        position: crystal.position,
        similarity: similarity,
        distance: distance
      };
    });

    // Sort by similarity and filter
    const validConnections = connections
      .filter(c => c.distance <= this.data.threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, this.data.maxConnections);

    // Create distance field
    this.el.setAttribute('nemosyne-distance-field', {
      sourcePoint: sourcePos,
      neighbors: validConnections,
      threshold: this.data.threshold,
      maxConnections: this.data.maxConnections,
      animate: this.data.animate
    });
  },

  setupEventListeners: function() {
    // Update when source crystal moves
    this.sourceCrystal.addEventListener('crystal-moved', () => {
      this.calculateConnections();
    });

    // Update on hover
    this.sourceCrystal.addEventListener('crystal-hover', () => {
      this.el.setAttribute('nemosyne-distance-field', 'animate', true);
    });

    this.sourceCrystal.addEventListener('crystal-hover-end', () => {
      // Optionally stop animation or reduce intensity
    });
  },

  calculateDistance: function(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
  },

  cosineSimilarity: function(a, b) {
    let dot = 0, magA = 0, magB = 0;
    const len = Math.min(a.length, b.length);
    
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    
    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }
});


/**
 * System component for managing all distance fields in scene
 */
AFRAME.registerSystem('distance-field-system', {
  init: function() {
    this.fields = new Map();
  },

  registerField: function(entity) {
    this.fields.set(entity.id, entity);
  },

  unregisterField: function(entity) {
    this.fields.delete(entity.id);
  },

  getFieldsNearPoint: function(point, radius) {
    const nearby = [];
    this.fields.forEach(entity => {
      const pos = entity.getAttribute('position');
      const dist = this.calculateDistance(point, pos);
      if (dist <= radius) {
        nearby.push({ entity, distance: dist });
      }
    });
    return nearby.sort((a, b) => a.distance - b.distance);
  },

  calculateDistance: function(a, b) {
    const dx = (a.x || 0) - (b.x || 0);
    const dy = (a.y || 0) - (b.y || 0);
    const dz = (a.z || 0) - (b.z || 0);
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
  }
});


console.log('[DistanceField] Component registered');
