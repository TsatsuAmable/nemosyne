/**
 * TopologyDetector: Automatically determines visualization type from data structure
 * 
 * Analyzes NemosyneDataPacket collections to determine optimal visualization
 * strategy based on data characteristics:
 * - Majority structure type
 * - Temporal ordering
 * - Dimensionality
 * - Relationship density
 * - Domain hints
 */

class TopologyDetector {
  constructor(options = {}) {
    this.preferences = options.preferences || {};
    this.lastDetected = null;
    this.scorer = new TopologyScorer();
  }

  detect(packets) {
    if (!packets || packets.length === 0) {
      return 'nemosyne-crystal-default';
    }

    // Convert to array if Map
    const dataArray = Array.isArray(packets) ? packets : Array.from(packets.values());

    // Calculate feature vectors
    const features = this.extractFeatures(dataArray);

    // Score each topology type
    const scores = this.scorer.scoreAll(features, dataArray);

    // Select best topology
    const best = Object.entries(scores)
      .sort(([,a], [,b]) => b - a)[0];

    const topology = best[0];
    const confidence = best[1];

    this.lastDetected = { topology, confidence, features };

    console.log(`[TopologyDetector] Detected: ${topology} (${(confidence * 100).toFixed(1)}% confidence)`);
    console.log(`[TopologyDetector] Features:`, features);

    return topology;
  }

  extractFeatures(packets) {
    const n = packets.length;
    
    return {
      // Structure distribution
      structures: this.countBy(packets, p => p.semantics.structure),
      types: this.countBy(packets, p => p.semantics.type),
      coordinateSpaces: this.countBy(packets, p => p.semantics.coordinateSpace),
      scales: this.countBy(packets, p => p.semantics.scale),
      
      // Relationship metrics
      hasHierarchy: packets.some(p => p.relations.parent || p.relations.children?.length > 0),
      hasGraphLinks: packets.some(p => p.relations.links?.length > 0),
      averageLinksPerNode: this.averageLinks(packets),
      
      // Temporal metrics
      hasTimestamps: packets.some(p => p.context.timestamp),
      timestampRange: this.getTimestampSpan(packets),
      isSequential: this.isSequential(packets),
      
      // Spatial metrics
      hasEmbeddings: packets.some(p => p.semantics.embedding),
      averageDimensions: this.average(packets, p => p.semantics.dimensions || 3),
      
      // Domain distribution
      domains: this.countBy(packets, p => p.context.domain),
      hasGeoData: packets.some(p => p.semantics.subtype === 'latlong' || p.semantics.coordinateSpace === 'geo'),
      
      // Size
      packetCount: n
    };
  }

  // Helper methods
  countBy(array, fn) {
    const counts = {};
    for (const item of array) {
      const key = fn(item) || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }

  averageLinks(packets) {
    const total = packets.reduce((sum, p) => sum + (p.relations.links?.length || 0), 0);
    return total / packets.length;
  }

  getTimestampSpan(packets) {
    const timestamps = packets
      .filter(p => p.context.timestamp)
      .map(p => p.context.timestamp);
    
    if (timestamps.length < 2) return 0;
    return Math.max(...timestamps) - Math.min(...timestamps);
  }

  isSequential(packets) {
    // Check if temporal relationships form a sequence
    const withTemporal = packets.filter(p => p.relations.temporal);
    if (withTemporal.length === 0) return false;
    
    const hasBefore = withTemporal.some(p => p.relations.temporal.before?.length > 0);
    const hasAfter = withTemporal.some(p => p.relations.temporal.after?.length > 0);
    
    return hasBefore || hasAfter;
  }

  average(packets, fn) {
    const sum = packets.reduce((s, p) => s + (fn(p) || 0), 0);
    return sum / packets.length;
  }
}


class TopologyScorer {
  // Scoring functions for each topology type
  scoreAll(features, packets) {
    return {
      'nemosyne-graph-force': this.scoreGraph(features, packets),
      'nemosyne-tree-hierarchical': this.scoreTree(features, packets),
      'nemosyne-timeline-spiral': this.scoreTimeline(features, packets),
      'nemosyne-timeline-linear': this.scoreLinearTimeline(features, packets),
      'nemosyne-scatter-semantic': this.scoreScatter(features, packets),
      'nemosyne-geo-globe': this.scoreGeo(features, packets),
      'nemosyne-grid-categorical': this.scoreGrid(features, packets),
      'nemosyne-heatmap-matrix': this.scoreMatrix(features, packets),
      'nemosyne-crystal-field': this.scoreField(features, packets),
      'nemosyne-crystal-default': 0.1 // Baseline
    };
  }

  scoreGraph(features, packets) {
    let score = 0;

    // High link density suggests graph
    const avgLinks = features.averageLinksPerNode;
    if (avgLinks > 2) score += 0.4;
    else if (avgLinks > 0.5) score += 0.2;

    // Presence of explicit graph links
    if (features.hasGraphLinks) score += 0.3;

    // Relational type
    if (features.types.relational / features.packetCount > 0.5) score += 0.2;

    // Structure hints
    if (features.structures.graph / features.packetCount > 0.5) score += 0.3;

    return Math.min(1, score);
  }

  scoreTree(features, packets) {
    let score = 0;

    // Hierarchical structure
    if (features.hasHierarchy) score += 0.4;

    // Tree structure hint
    if (features.structures.tree / features.packetCount > 0.5) score += 0.4;

    // Categorical with parent-child
    if (features.types.categorical && features.hasHierarchy) score += 0.2;

    return Math.min(1, score);
  }

  scoreTimeline(features, packets) {
    let score = 0;

    // Temporal data
    if (features.types.temporal / features.packetCount > 0.5) score += 0.3;

    // Has timestamps
    if (features.hasTimestamps) score += 0.2;

    // Wide time range suggests need for spiral (saves space)
    if (features.timestampRange > 86400000) score += 0.2; // > 1 day

    // Sequential ordering
    if (features.isSequential) score += 0.3;

    // Continuous scale (good for spiral progression)
    if (features.scales.continuous / features.packetCount > 0.5) score += 0.1;

    return Math.min(1, score);
  }

  scoreLinearTimeline(features, packets) {
    let score = 0;

    // Similar to spiral but for shorter time ranges
    if (features.types.temporal / features.packetCount > 0.5) score += 0.3;
    if (features.hasTimestamps) score += 0.2;
    if (features.isSequential) score += 0.3;

    // Short time range better for linear
    if (features.timestampRange < 3600000) score += 0.2; // < 1 hour

    return Math.min(1, score);
  }

  scoreScatter(features, packets) {
    let score = 0;

    // High dimensional embeddings
    if (features.hasEmbeddings) score += 0.4;

    // Embedding space
    if (features.coordinateSpaces.embedding / features.packetCount > 0.5) score += 0.3;

    // High dimensionality
    if (features.averageDimensions > 2) score += 0.2;

    // Many points (scatter good for density)
    if (features.packetCount > 100) score += 0.1;

    return Math.min(1, score);
  }

  scoreGeo(features, packets) {
    let score = 0;

    // Geo coordinate space
    if (features.coordinateSpaces.geo / features.packetCount > 0.5) score += 0.5;

    // Explicit latlong subtype
    if (features.hasGeoData) score += 0.4;

    // Spatial type
    if (features.types.spatial / features.packetCount > 0.5) score += 0.2;

    return Math.min(1, score);
  }

  scoreGrid(features, packets) {
    let score = 0;

    // Categorical data
    if (features.types.categorical / features.packetCount > 0.7) score += 0.4;

    // Grid structure hint
    if (features.structures.grid / features.packetCount > 0.5) score += 0.4;

    // Nominal scale (discrete categories)
    if (features.scales.nominal / features.packetCount > 0.5) score += 0.2;

    return Math.min(1, score);
  }

  scoreMatrix(features, packets) {
    let score = 0;

    // Matrix structure
    if (features.structures.matrix / features.packetCount > 0.5) score += 0.5;

    // Quantitative values
    if (features.types.quantitative / features.packetCount > 0.5) score += 0.3;

    return Math.min(1, score);
  }

  scoreField(features, packets) {
    let score = 0;

    // Field structure
    if (features.structures.field / features.packetCount > 0.5) score += 0.5;

    // Continuous data
    if (features.scales.continuous / features.packetCount > 0.5) score += 0.3;

    return Math.min(1, score);
  }
}


// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TopologyDetector, TopologyScorer };
}

export { TopologyDetector, TopologyScorer };
