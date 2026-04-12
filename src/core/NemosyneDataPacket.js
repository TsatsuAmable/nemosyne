/**
 * NemosyneDataPacket: Schema for Data-Native Visualization
 * 
 * The fundamental unit of data in the Nemosyne system.
 * Encodes not just values, but semantics, relationships, and context
 * to enable automatic visualization derivation.
 */

class NemosyneDataPacket {
  constructor(options = {}) {
    // Identity
    this.id = options.id || this.generateId();
    this.createdAt = Date.now();
    this.version = 1;
    
    // Core value (the actual data)
    this.value = options.value;
    
    // Semantic typing for automatic visual mapping
    this.semantics = {
      // Type classification
      type: options.semantics?.type || 'quantitative', // temporal, spatial, categorical, relational, quantitative
      subtype: options.semantics?.subtype, // timestamp, latlong, category, currency, percentage, vector, matrix
      
      // Scale for color mapping
      scale: options.semantics?.scale || 'continuous', // continuous, ordinal, nominal, binary
      domain: options.semantics?.domain, // 'temperature', 'sales', 'risk_level'
      
      // Spatial characteristics
      coordinateSpace: options.semantics?.coordinateSpace || 'cartesian', // geo, embedding, cartesian, polar, spherical
      dimensions: options.semantics?.dimensions || 3, // 1D, 2D, 3D, nD
      embedding: options.semantics?.embedding, // High-dimensional embeddings for semantic similarity
      
      // Structural classification
      structure: options.semantics?.structure || 'point', // point, vector, matrix, graph, tree, grid, field
      
      // Temporal characteristics
      temporal: options.semantics?.temporal ?? false, // Is this data time-varying?
      velocity: options.semantics?.velocity, // For animating movement
      uncertainty: options.semantics?.uncertainty, // Precision/confidence
      
      // Additional semantic hints
      ...options.semantics
    };
    
    // Relationships to other data
    this.relations = {
      // Hierarchy
      parent: options.relations?.parent || null,
      children: options.relations?.children || [],
      
      // Graph connections
      links: options.relations?.links || [],
      // links format: [{ to: 'id', type: 'friend|colleague|depends', weight: 0.0-1.0 }, ...]
      
      // Temporal ordering
      temporal: {
        before: options.relations?.temporal?.before || [],
        after: options.relations?.temporal?.after || []
      },
      
      // Spatial relationships (computed)
      spatial: {
        near: options.relations?.spatial?.near || [],
        contains: options.relations?.spatial?.contains || [],
        within: options.relations?.spatial?.within || []
      },
      
      ...options.relations
    };
    
    // Context affects rendering priority and style
    this.context = {
      // When this data was created/updated
      timestamp: options.context?.timestamp || Date.now(),
      
      // Importance affects size/prominence (0.0 - 1.0)
      importance: options.context?.importance ?? 0.5,
      
      // Confidence affects opacity/clarity (0.0 - 1.0)
      confidence: options.context?.confidence ?? 1.0,
      
      // Data provenance
      source: options.context?.source || 'unknown',
      domain: options.context?.domain || 'general', // finance, weather, biology, social
      
      // User/creator
      author: options.context?.author,
      
      // Versioning for temporal data
      version: options.context?.version || 1,
      
      ...options.context
    };
    
    // User overrides (curator interventions)
    this.overrides = {
      color: options.overrides?.color,           // Force specific color
      geometry: options.overrides?.geometry,     // Force specific shape
      position: options.overrides?.position,       // Force specific position
      scale: options.overrides?.scale,             // Force specific size
      animation: options.overrides?.animation,    // Force specific motion
      material: options.overrides?.material,       // Force specific material
      
      ...options.overrides
    };
    
    // Internal state
    this.internal = {
      transformed: false,
      lastTransform: null,
      visualHash: null // Cache of visual representation
    };
  }
  
  /**
   * Generate unique ID
   */
  generateId() {
    return `pkt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Update the data value
   * Records transformation for provenance
   */
  updateValue(newValue, metadata = {}) {
    const oldValue = this.value;
    this.value = newValue;
    this.context.timestamp = Date.now();
    this.context.version = (this.context.version || 1) + 1;
    
    this.internal.transformed = true;
    this.internal.lastTransform = {
      from: oldValue,
      to: newValue,
      timestamp: Date.now(),
      ...metadata
    };
    
    // Invalidate visual cache
    this.internal.visualHash = null;
    
    return this;
  }
  
  /**
   * Transform with full metadata tracking
   * Used for spatial manipulation, reclassification, etc.
   */
  transform({ value, semantics, relations, context, transformType, ...custom }) {
    const transformRecord = {
      timestamp: Date.now(),
      type: transformType || 'unknown',
      changes: {}
    };
    
    if (value !== undefined) {
      transformRecord.changes.value = { from: this.value, to: value };
      this.value = value;
    }
    
    if (semantics) {
      transformRecord.changes.semantics = { from: { ...this.semantics }, to: semantics };
      Object.assign(this.semantics, semantics);
    }
    
    if (relations) {
      Object.assign(this.relations, relations);
      transformRecord.changes.relations = relations;
    }
    
    if (context) {
      Object.assign(this.context, context);
      transformRecord.changes.context = context;
    }
    
    // Store custom transform data
    Object.assign(transformRecord, custom);
    
    this.internal.lastTransform = transformRecord;
    this.internal.transformed = true;
    this.internal.visualHash = null;
    
    return this;
  }
  
  /**
   * Add a relationship
   */
  addLink(targetId, type = 'related', weight = 0.5) {
    this.relations.links.push({ to: targetId, type, weight });
    return this;
  }
  
  /**
   * Set parent (hierarchical relationship)
   */
  setParent(parentId) {
    this.relations.parent = parentId;
    return this;
  }
  
  /**
   * Add temporal relationship
   */
  setTemporalOrder(after = [], before = []) {
    this.relations.temporal.after = [...this.relations.temporal.after, ...after];
    this.relations.temporal.before = [...this.relations.temporal.before, ...before];
    return this;
  }
  
  /**
   * Set curator override
   */
  override(property, value) {
    this.overrides[property] = value;
    this.internal.visualHash = null;
    return this;
  }
  
  /**
   * Clear all overrides
   */
  clearOverrides() {
    this.overrides = {};
    this.internal.visualHash = null;
    return this;
  }
  
  /**
   * Compute visual hash for caching
   */
  computeVisualHash() {
    const hashObj = {
      value: this.value,
      semantics: this.semantics,
      context: this.context,
      overrides: this.overrides
    };
    
    // Simple hash (in production use proper hash)
    this.internal.visualHash = JSON.stringify(hashObj);
    return this.internal.visualHash;
  }
  
  /**
   * Check if visual representation needs update
   */
  needsVisualUpdate() {
    const currentHash = this.computeVisualHash();
    return currentHash !== this.internal.lastVisualHash;
  }
  
  /**
   * Mark visual state as current
   */
  markVisualCurrent() {
    this.internal.lastVisualHash = this.internal.visualHash;
    return this;
  }
  
  /**
   * Get value for specific domain
   * Supports path-like accessors: "context.importance"
   */
  get(path) {
    const parts = path.split('.');
    let current = this;
    
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    
    return current;
  }
  
  /**
   * Set value at path
   */
  set(path, value) {
    const parts = path.split('.');
    let current = this;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = value;
    this.internal.visualHash = null;
    
    return this;
  }
  
  /**
   * Get similarity to another packet
   * Uses embeddings and semantic type
   */
  similarity(other) {
    let sim = 0;
    let weight = 0;
    
    // Same structure type
    if (this.semantics.structure === other.semantics.structure) {
      sim += 0.2;
      weight += 0.2;
    }
    
    // Same domain
    if (this.semantics.domain === other.semantics.domain) {
      sim += 0.3;
      weight += 0.3;
    }
    
    // Embedding cosine similarity
    if (this.semantics.embedding && other.semantics.embedding) {
      const embeddingSim = this.cosineSimilarity(
        this.semantics.embedding,
        other.semantics.embedding
      );
      sim += embeddingSim * 0.5;
      weight += 0.5;
    }
    
    return weight > 0 ? sim / weight : 0;
  }
  
  cosineSimilarity(a, b) {
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
  
  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      id: this.id,
      value: this.value,
      semantics: this.semantics,
      relations: this.relations,
      context: this.context,
      overrides: this.overrides
    };
  }
  
  /**
   * Load from JSON
   */
  static fromJSON(json) {
    return new NemosyneDataPacket(json);
  }
  
  /**
   * Create from raw data with auto-detection
   */
  static fromRaw(data, hints = {}) {
    const packet = new NemosyneDataPacket({
      value: data,
      semantics: {
        ...hints,
        ...autoDetectSemantics(data)
      }
    });
    
    return packet;
  }
  
  /**
   * Clone with optional modifications
   */
  clone(modifications = {}) {
    const cloned = NemosyneDataPacket.fromJSON(this.toJSON());
    cloned.id = this.generateId(); // New ID
    
    if (modifications.value !== undefined) {
      cloned.value = modifications.value;
    }
    
    if (modifications.semantics) {
      Object.assign(cloned.semantics, modifications.semantics);
    }
    
    if (modifications.context) {
      Object.assign(cloned.context, modifications.context);
    }
    
    return cloned;
  }
}


/**
 * Auto-detect semantic type from raw data
 */
function autoDetectSemantics(data) {
  const semantics = {};
  
  // Detect type
  if (typeof data === 'number') {
    semantics.type = 'quantitative';
    semantics.scale = 'continuous';
  } else if (typeof data === 'string') {
    semantics.type = 'categorical';
    semantics.scale = 'nominal';
  } else if (data instanceof Date) {
    semantics.type = 'temporal';
    semantics.subtype = 'timestamp';
    semantics.temporal = true;
  } else if (Array.isArray(data)) {
    if (data.length === 2) {
      semantics.structure = 'vector';
      semantics.coordinateSpace = 'cartesian';
      semantics.dimensions = 2;
    } else if (data.length === 3) {
      semantics.structure = 'vector';
      semantics.coordinateSpace = 'cartesian';
      semantics.dimensions = 3;
    } else {
      semantics.structure = 'matrix';
      semantics.dimensions = data.length;
    }
  } else if (typeof data === 'object' && data !== null) {
    if (data.lat && data.lng) {
      semantics.type = 'spatial';
      semantics.subtype = 'latlong';
      semantics.coordinateSpace = 'geo';
      semantics.dimensions = 3;
    } else {
      semantics.structure = 'tree';
    }
  }
  
  return semantics;
}


/**
 * DataPacketGroup: Manage collections of packets
 */
class DataPacketGroup extends EventTarget {
  constructor(packets = []) {
    super();
    this.packets = new Map();
    packets.forEach(p => this.add(p));
  }
  
  add(packet) {
    if (!(packet instanceof NemosyneDataPacket)) {
      packet = NemosyneDataPacket.fromRaw(packet);
    }
    
    this.packets.set(packet.id, packet);
    this.emit('packet-added', { packet });
    return packet.id;
  }
  
  remove(id) {
    const packet = this.packets.get(id);
    if (packet) {
      this.packets.delete(id);
      this.emit('packet-removed', { id, packet });
      return true;
    }
    return false;
  }
  
  get(id) {
    return this.packets.get(id);
  }
  
  getAll() {
    return Array.from(this.packets.values());
  }
  
  filter(predicate) {
    return this.getAll().filter(predicate);
  }
  
  groupBySemantics(key) {
    return this.groupBy(p => p.get(`semantics.${key}`));
  }
  
  groupByType() {
    return this.groupBy(p => p.semantics.type);
  }
  
  groupByDomain() {
    return this.groupBy(p => p.semantics.domain);
  }
  
  groupBy(fn) {
    const groups = new Map();
    
    for (const packet of this.getAll()) {
      const key = fn(packet) || 'unknown';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(packet);
    }
    
    return groups;
  }
  
  getStatistics() {
    const packets = this.getAll();
    
    return {
      count: packets.length,
      types: this.countBy(p => p.semantics.type),
      structures: this.countBy(p => p.semantics.structure),
      domains: this.countBy(p => p.context.domain),
      temporalRange: this.getTemporalRange(),
      averageImportance: packets.reduce((s, p) => s + p.context.importance, 0) / packets.length
    };
  }
  
  countBy(fn) {
    const counts = new Map();
    for (const packet of this.getAll()) {
      const key = fn(packet) || 'unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Object.fromEntries(counts);
  }
  
  getTemporalRange() {
    const temporal = this.filter(p => p.context.timestamp);
    if (temporal.length === 0) return null;
    
    const times = temporal.map(p => p.context.timestamp);
    return {
      min: Math.min(...times),
      max: Math.max(...times),
      span: Math.max(...times) - Math.min(...times)
    };
  }
  
  // Spatial
  getBoundingBox() {
    const spatial = this.filter(p => p.semantics.coordinateSpace !== 'embedding');
    
    // Get positions from layout engine
    // Placeholder
    return { min: {x: -10, y: -10, z: -10}, max: {x: 10, y: 10, z: 10} };
  }
  
  emit(eventName, detail) {
    const event = new CustomEvent(eventName, { detail });
    this.dispatchEvent(event);
  }
}


// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NemosyneDataPacket, DataPacketGroup };
}

export { NemosyneDataPacket, DataPacketGroup };