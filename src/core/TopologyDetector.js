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
    
    // Defensive: ensure packets have expected structure
    const safePackets = packets.map(p => ({
      semantics: { structure: 'point', type: 'unknown', ...p.semantics },
      relations: { children: [], links: [], parent: null, ...p.relations },
      context: { timestamp: null, domain: null, ...p.context },
      ...p
    }));
    
    return {
      // Structure distribution
      structures: this.countBy(safePackets, p => p.semantics.structure),
      types: this.countBy(safePackets, p => p.semantics.type),
      coordinateSpaces: this.countBy(safePackets, p => p.semantics.coordinateSpace),
      scales: this.countBy(safePackets, p => p.semantics.scale),
      
      // Relationship metrics
      hasHierarchy: safePackets.some(p => p.relations.parent || p.relations.children?.length > 0),
      hasGraphLinks: safePackets.some(p => p.relations.links?.length > 0),
      averageLinksPerNode: this.averageLinks(safePackets),
      
      // Temporal metrics
      hasTimestamps: safePackets.some(p => p.context.timestamp),
      timestampRange: this.getTimestampSpan(safePackets),
      isSequential: this.isSequential(safePackets),
      
      // Spatial metrics
      hasEmbeddings: safePackets.some(p => p.semantics.embedding),
      averageDimensions: this.average(safePackets, p => p.semantics.dimensions || 3),
      
      // Domain distribution
      domains: this.countBy(safePackets, p => p.context.domain),
      hasGeoData: safePackets.some(p => p.semantics.subtype === 'latlong' || p.semantics.coordinateSpace === 'geo'),
      
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

  /**
   * Get confidence scores for all topologies
   */
  getConfidenceScores(packets) {
    if (!packets || packets.length === 0) {
      return { 'nemosyne-crystal-default': 1.0 };
    }
    const dataArray = Array.isArray(packets) ? packets : Array.from(packets.values());
    const features = this.extractFeatures(dataArray);
    return this.scorer.scoreAll(features, dataArray);
  }

  /**
   * Validate topology name
   */
  validateTopology(topology) {
    const valid = [
      'nemosyne-graph-force',
      'nemosyne-tree-hierarchical',
      'nemosyne-timeline-spiral',
      'nemosyne-timeline-linear',
      'nemosyne-scatter-semantic',
      'nemosyne-geo-globe',
      'nemosyne-grid-categorical',
      'nemosyne-heatmap-matrix',
      'nemosyne-crystal-default'
    ];
    return valid.includes(topology);
  }

  /**
   * Get description for topology
   */
  getDescription(topology) {
    const descriptions = {
      'nemosyne-graph-force': 'Force-directed graph layout for networked data',
      'nemosyne-tree-hierarchical': 'Hierarchical tree layout for parent-child data',
      'nemosyne-timeline-spiral': 'Spiral timeline for temporal sequences',
      'nemosyne-timeline-linear': 'Linear timeline for short time ranges',
      'nemosyne-scatter-semantic': 'Scatter plot for high-dimensional embeddings',
      'nemosyne-geo-globe': 'Globe projection for geographic data',
      'nemosyne-grid-categorical': 'Grid layout for categorical data',
      'nemosyne-heatmap-matrix': 'Matrix layout for correlation data',
      'nemosyne-crystal-default': 'Default crystal layout for general data'
    };
    return descriptions[topology] || 'Unknown topology';
  }

  /**
   * Calculate maximum tree depth
   */
  maxTreeDepth(packets) {
    if (!packets || packets.length === 0) return 0;
    
    const idToPacket = new Map();
    packets.forEach(p => idToPacket.set(p.id, p));
    
    const getDepth = (packet, visited = new Set()) => {
      if (visited.has(packet.id)) return 0; // Cycle detection
      visited.add(packet.id);
      
      const children = packet.relations?.children || [];
      if (children.length === 0) return 1;
      
      const childDepths = children.map(childId => {
        const child = idToPacket.get(childId);
        return child ? getDepth(child, new Set(visited)) : 0;
      });
      
      return 1 + Math.max(...childDepths, 0);
    };
    
    const depths = packets.map(p => getDepth(p));
    return Math.max(...depths, 0);
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
    const avgLinks = features.averageLinksPerNode || 0;
    if (avgLinks > 2) score += 0.4;
    else if (avgLinks > 0.5) score += 0.2;

    // Presence of explicit graph links
    if (features.hasGraphLinks) score += 0.3;

    // Relational type
    const typeCount = features.types?.relational || 0;
    if (features.packetCount > 0 && typeCount / features.packetCount > 0.5) score += 0.2;

    // Structure hints
    const structCount = features.structures?.graph || 0;
    if (features.packetCount > 0 && structCount / features.packetCount > 0.5) score += 0.3;

    return Math.min(1, score);
  }

  scoreTree(features, packets) {
    let score = 0;

    // Hierarchical structure
    if (features.hasHierarchy) score += 0.4;

    // Tree structure hint
    const structCount = features.structures?.tree || 0;
    if (features.packetCount > 0 && structCount / features.packetCount > 0.5) score += 0.4;

    // Categorical with parent-child
    if (features.types?.categorical && features.hasHierarchy) score += 0.2;

    return Math.min(1, score);
  }

  scoreTimeline(features, packets) {
    let score = 0;

    // Temporal data
    const typeCount = features.types?.temporal || 0;
    if (features.packetCount > 0 && typeCount / features.packetCount > 0.5) score += 0.3;

    // Has timestamps
    if (features.hasTimestamps) score += 0.2;

    // Wide time range suggests need for spiral (saves space)
    if (features.timestampRange > 86400000) score += 0.2; // > 1 day

    // Sequential ordering
    if (features.isSequential) score += 0.3;

    // Continuous scale (good for spiral progression)
    const continuousCount = features.scales?.continuous || 0;
    if (features.packetCount > 0 && continuousCount / features.packetCount > 0.5) score += 0.1;

    return Math.min(1, score);
  }

  scoreLinearTimeline(features, packets) {
    let score = 0;

    // Similar to spiral but for shorter time ranges
    const temporalCount = features.types?.temporal || 0;
    if (features.packetCount > 0 && temporalCount / features.packetCount > 0.5) score += 0.3;
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
    const coordCount = features.coordinateSpaces?.embedding || 0;
    if (features.packetCount > 0 && coordCount / features.packetCount > 0.5) score += 0.3;

    // High dimensionality
    if (features.averageDimensions > 2) score += 0.2;

    // Many points (scatter good for density)
    if (features.packetCount > 100) score += 0.1;

    return Math.min(1, score);
  }

  scoreGeo(features, packets) {
    let score = 0;

    // Geo coordinate space
    const coordCount = features.coordinateSpaces?.geo || 0;
    if (features.packetCount > 0 && coordCount / features.packetCount > 0.5) score += 0.5;

    // Explicit latlong subtype
    if (features.hasGeoData) score += 0.4;

    // Spatial type
    const spatialCount = features.types?.spatial || 0;
    if (features.packetCount > 0 && spatialCount / features.packetCount > 0.5) score += 0.2;

    return Math.min(1, score);
  }

  scoreGrid(features, packets) {
    let score = 0;

    // Categorical data
    const catCount = features.types?.categorical || 0;
    if (features.packetCount > 0 && catCount / features.packetCount > 0.7) score += 0.4;

    // Grid structure hint
    const gridCount = features.structures?.grid || 0;
    if (features.packetCount > 0 && gridCount / features.packetCount > 0.5) score += 0.4;

    // Nominal scale (discrete categories)
    const nominalCount = features.scales?.nominal || 0;
    if (features.packetCount > 0 && nominalCount / features.packetCount > 0.5) score += 0.2;

    return Math.min(1, score);
  }

  scoreMatrix(features, packets) {
    let score = 0;

    // Matrix structure
    const matrixCount = features.structures?.matrix || 0;
    if (features.packetCount > 0 && matrixCount / features.packetCount > 0.5) score += 0.5;

    // Quantitative values
    const quantCount = features.types?.quantitative || 0;
    if (features.packetCount > 0 && quantCount / features.packetCount > 0.5) score += 0.3;

    return Math.min(1, score);
  }

  scoreField(features, packets) {
    let score = 0;

    // Field structure
    const fieldCount = features.structures?.field || 0;
    if (features.packetCount > 0 && fieldCount / features.packetCount > 0.5) score += 0.5;

    // Continuous data
    const continuousCount = features.scales?.continuous || 0;
    if (features.packetCount > 0 && continuousCount / features.packetCount > 0.5) score += 0.3;

    return Math.min(1, score);
  }

  /**
   * Get scoring weights for a topology type
   * Returns the weight configuration used for scoring
   */
  getWeights(topologyType) {
    const weights = {
      'nemosyne-graph-force': {
        linkDensity: 0.4,
        hasGraphLinks: 0.3,
        relational: 0.2,
        structure: 0.3
      },
      'nemosyne-tree-hierarchical': {
        hierarchy: 0.4,
        structure: 0.4,
        categorical: 0.2
      },
      'nemosyne-timeline-spiral': {
        temporal: 0.3,
        timestamps: 0.2,
        timeRange: 0.2,
        sequential: 0.3,
        continuous: 0.1
      },
      'nemosyne-timeline-linear': {
        temporal: 0.3,
        timestamps: 0.2,
        sequential: 0.3,
        shortRange: 0.2
      },
      'nemosyne-scatter-semantic': {
        embeddings: 0.4,
        coordinateSpace: 0.3,
        dimensions: 0.2,
        count: 0.1
      },
      'nemosyne-geo-globe': {
        geo: 0.5,
        latlong: 0.4,
        spatial: 0.2
      },
      'nemosyne-grid-categorical': {
        categorical: 0.4,
        grid: 0.4,
        nominal: 0.2
      },
      'nemosyne-heatmap-matrix': {
        matrix: 0.5,
        quantitative: 0.3
      },
      'nemosyne-crystal-default': {
        default: 1.0
      }
    };
    
    return weights[topologyType] || weights['nemosyne-crystal-default'];
  }
}


// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TopologyDetector, TopologyScorer };
}

export { TopologyDetector, TopologyScorer };
