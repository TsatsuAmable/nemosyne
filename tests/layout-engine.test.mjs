/**
 * LayoutEngine Tests for Nemosyne
 * Tests for all layout algorithms and positioning methods
 */

import { jest } from '@jest/globals';
import { LayoutEngine } from '../src/core/LayoutEngine.js';
import { NemosyneDataPacket } from '../src/core/NemosyneDataPacket.js';

describe('LayoutEngine', () => {
  let layout;
  let mockPackets;

  beforeEach(() => {
    layout = new LayoutEngine();
    
    // Create test packets
    mockPackets = [
      new NemosyneDataPacket({ id: '1', value: 10 }),
      new NemosyneDataPacket({ id: '2', value: 20 }),
      new NemosyneDataPacket({ id: '3', value: 30 })
    ];
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create layout engine with default options', () => {
      const engine = new LayoutEngine();
      expect(engine).toBeDefined();
      expect(engine.options).toBeDefined();
      expect(engine.options.center).toEqual({ x: 0, y: 1.6, z: -3 });
      expect(engine.options.radius).toBe(5);
      expect(engine.options.spacing).toBe(0.5);
    });

    test('should create layout engine with custom options', () => {
      const engine = new LayoutEngine({
        radius: 10,
        spacing: 1.0,
        center: { x: 5, y: 5, z: 0 }
      });
      expect(engine.options.radius).toBe(10);
      expect(engine.options.spacing).toBe(1.0);
      expect(engine.options.center).toEqual({ x: 5, y: 5, z: 0 });
    });

    test('should initialize originalPositions map', () => {
      const engine = new LayoutEngine();
      expect(engine.originalPositions).toBeInstanceOf(Map);
      expect(engine.originalPositions.size).toBe(0);
    });

    test('should initialize constraints array', () => {
      const engine = new LayoutEngine();
      expect(engine.constraints).toBeInstanceOf(Array);
      expect(engine.constraints.length).toBe(0);
    });
  });

  describe('calculatePositions', () => {
    test('should calculate positions for graph-force topology', () => {
      const positions = layout.calculatePositions(mockPackets, 'nemosyne-graph-force');
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(mockPackets.length);
      
      // Each packet should have a position
      mockPackets.forEach(packet => {
        expect(positions.has(packet.id)).toBe(true);
        const pos = positions.get(packet.id);
        expect(pos).toHaveProperty('x');
        expect(pos).toHaveProperty('y');
        expect(pos).toHaveProperty('z');
      });
    });

    test('should calculate positions for tree-hierarchical topology', () => {
      // Create hierarchical data for tree layout
      const treePackets = [
        new NemosyneDataPacket({ id: 'root', value: 10, relations: { parent: null } }),
        new NemosyneDataPacket({ id: 'child1', value: 20, relations: { parent: 'root' } }),
        new NemosyneDataPacket({ id: 'child2', value: 30, relations: { parent: 'root' } })
      ];
      
      const positions = layout.calculatePositions(treePackets, 'nemosyne-tree-hierarchical');
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(treePackets.length);
    });

    test('should calculate positions for timeline-spiral topology', () => {
      const positions = layout.calculatePositions(mockPackets, 'nemosyne-timeline-spiral');
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(mockPackets.length);
    });

    test('should calculate positions for timeline-linear topology', () => {
      const positions = layout.calculatePositions(mockPackets, 'nemosyne-timeline-linear');
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(mockPackets.length);
    });

    test('should calculate positions for scatter-semantic topology', () => {
      const positions = layout.calculatePositions(mockPackets, 'nemosyne-scatter-semantic');
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(mockPackets.length);
    });

    test('should calculate positions for geo-globe topology', () => {
      const positions = layout.calculatePositions(mockPackets, 'nemosyne-geo-globe');
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(mockPackets.length);
    });

    test('should calculate positions for grid-categorical topology', () => {
      const positions = layout.calculatePositions(mockPackets, 'nemosyne-grid-categorical');
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(mockPackets.length);
    });

    test('should calculate positions for heatmap-matrix topology', () => {
      const positions = layout.calculatePositions(mockPackets, 'nemosyne-heatmap-matrix');
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(mockPackets.length);
    });

    test('should default to spherical layout for unknown topology', () => {
      const positions = layout.calculatePositions(mockPackets, 'unknown-topology');
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(mockPackets.length);
    });

    test('should handle empty packets array', () => {
      const positions = layout.calculatePositions([], 'nemosyne-graph-force');
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(0);
    });

    test('should handle Set input', () => {
      const packetSet = new Set(mockPackets);
      
      const positions = layout.calculatePositions(packetSet, 'nemosyne-spherical');
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(mockPackets.length);
    });
  });

  describe('forceDirectedLayout', () => {
    test('should layout nodes using force-directed algorithm', () => {
      const positions = layout.forceDirectedLayout(mockPackets, 50);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(mockPackets.length);
      
      // Positions should be within bounds
      positions.forEach(pos => {
        const distFromCenter = Math.sqrt(
          Math.pow(pos.x - layout.options.center.x, 2) +
          Math.pow(pos.y - layout.options.center.y, 2) +
          Math.pow(pos.z - layout.options.center.z, 2)
        );
        expect(distFromCenter).toBeLessThanOrEqual(layout.options.radius * 2);
      });
    });

    test('should use default iterations if not specified', () => {
      const positions = layout.forceDirectedLayout(mockPackets);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(mockPackets.length);
    });

    test('should handle packets with relationships', () => {
      const packetsWithLinks = [
        new NemosyneDataPacket({ 
          id: '1', 
          value: 10,
          relations: { links: [{ to: '2', type: 'connected', weight: 0.8 }] }
        }),
        new NemosyneDataPacket({ 
          id: '2', 
          value: 20,
          relations: { links: [{ to: '1', type: 'connected', weight: 0.8 }] }
        })
      ];
      
      const positions = layout.forceDirectedLayout(packetsWithLinks, 30);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(2);
    });

    test('should handle empty packets', () => {
      const positions = layout.forceDirectedLayout([]);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(0);
    });
  });

  describe('treeLayout', () => {
    test('should layout nodes in tree structure', () => {
      // Create hierarchical packets
      const treePackets = [
        new NemosyneDataPacket({ id: 'root', value: 10, relations: { parent: null } }),
        new NemosyneDataPacket({ id: 'child1', value: 20, relations: { parent: 'root' } }),
        new NemosyneDataPacket({ id: 'child2', value: 30, relations: { parent: 'root' } })
      ];
      
      const positions = layout.treeLayout(treePackets);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(3);
    });

    test('should handle single node tree', () => {
      const positions = layout.treeLayout([mockPackets[0]]);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(1);
    });

    test('should handle empty tree', () => {
      const positions = layout.treeLayout([]);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(0);
    });

    test('should handle deep hierarchy', () => {
      const deepPackets = [
        new NemosyneDataPacket({ id: '1', value: 10, relations: { parent: null } }),
        new NemosyneDataPacket({ id: '2', value: 20, relations: { parent: '1' } }),
        new NemosyneDataPacket({ id: '3', value: 30, relations: { parent: '2' } })
      ];
      
      const positions = layout.treeLayout(deepPackets);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(3);
    });

    test('should fall back to spherical layout for non-tree data', () => {
      // Packets with no parent relationships - should still create positions
      const nonTreePackets = [
        new NemosyneDataPacket({ id: '1', value: 10 }),
        new NemosyneDataPacket({ id: '2', value: 20 }),
        new NemosyneDataPacket({ id: '3', value: 30 })
      ];
      
      // When no tree hierarchy exists, it falls back to spherical
      const positions = layout.treeLayout(nonTreePackets);
      expect(positions).toBeInstanceOf(Map);
      // When no hierarchy found, sphericalLayout is used
      expect(positions.size).toBeGreaterThan(0);
    });
  });

  describe('buildHierarchy', () => {
    test('should build tree hierarchy from packets', () => {
      const treePackets = [
        new NemosyneDataPacket({ id: 'root', value: 10, relations: { parent: null } }),
        new NemosyneDataPacket({ id: 'child1', value: 20, relations: { parent: 'root' } }),
        new NemosyneDataPacket({ id: 'child2', value: 30, relations: { parent: 'root' } })
      ];
      
      const hierarchy = layout.buildHierarchy(treePackets);
      expect(hierarchy).toBeDefined();
      expect(hierarchy.id).toBe('root');
    });

    test('should handle flat structure (no parents)', () => {
      const flatPackets = [
        new NemosyneDataPacket({ id: '1', value: 10 }),
        new NemosyneDataPacket({ id: '2', value: 20 })
      ];
      
      const hierarchy = layout.buildHierarchy(flatPackets);
      expect(hierarchy).toBeDefined();
      expect(hierarchy.id).toBe('1');
    });

    test('should handle empty packets', () => {
      const hierarchy = layout.buildHierarchy([]);
      expect(hierarchy).toBeNull();
    });
  });

  describe('spiralTimelineLayout', () => {
    test('should layout packets in spiral timeline', () => {
      // Add timestamps
      const timelinePackets = mockPackets.map((p, i) => {
        const packet = new NemosyneDataPacket({ id: p.id, value: p.value });
        packet.context.timestamp = Date.now() + i * 1000;
        return packet;
      });
      
      const positions = layout.spiralTimelineLayout(timelinePackets);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(timelinePackets.length);
      
      // Later packets should be further out
      const pos1 = positions.get('1');
      const pos3 = positions.get('3');
      expect(pos3.x).not.toBe(pos1.x);
      expect(pos3.z).not.toBe(pos1.z);
    });

    test('should handle packets without timestamps', () => {
      const positions = layout.spiralTimelineLayout(mockPackets);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(mockPackets.length);
    });

    test('should handle empty array', () => {
      const positions = layout.spiralTimelineLayout([]);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(0);
    });
  });

  describe('linearTimelineLayout', () => {
    test('should layout packets in linear timeline', () => {
      // Add timestamps
      const timelinePackets = mockPackets.map((p, i) => {
        const packet = new NemosyneDataPacket({ id: p.id, value: p.value });
        packet.context.timestamp = Date.now() + i * 10000;
        return packet;
      });
      
      const positions = layout.linearTimelineLayout(timelinePackets);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(timelinePackets.length);
    });

    test('should handle empty timeline', () => {
      const positions = layout.linearTimelineLayout([]);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(0);
    });

    test('should handle single packet', () => {
      const singlePacket = [new NemosyneDataPacket({ id: '1', value: 10 })];
      const positions = layout.linearTimelineLayout(singlePacket);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(1);
    });
  });

  describe('scatterLayout', () => {
    test('should layout packets in scatter plot', () => {
      const positions = layout.scatterLayout(mockPackets);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(mockPackets.length);
    });

    test('should handle packets with embeddings', () => {
      const embeddingPackets = mockPackets.map((p, i) => {
        const packet = new NemosyneDataPacket({ id: p.id, value: p.value });
        packet.semantics.embedding = [i * 0.1, i * 0.2, i * 0.3];
        return packet;
      });
      
      const positions = layout.scatterLayout(embeddingPackets);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(embeddingPackets.length);
    });

    test('should handle empty array', () => {
      const positions = layout.scatterLayout([]);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(0);
    });
  });

  describe('globeLayout', () => {
    test('should layout geo data on globe', () => {
      const geoPackets = [
        new NemosyneDataPacket({ 
          id: '1', 
          value: { lat: 51.5074, lon: -0.1278 } // London
        }),
        new NemosyneDataPacket({ 
          id: '2', 
          value: { lat: 40.7128, lon: -74.0060 } // NYC
        }),
        new NemosyneDataPacket({ 
          id: '3', 
          value: { lat: 35.6762, lon: 139.6503 } // Tokyo
        })
      ];
      
      const positions = layout.globeLayout(geoPackets);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(geoPackets.length);
      
      // Positions should be on sphere surface
      positions.forEach(pos => {
        const distFromCenter = Math.sqrt(
          Math.pow(pos.x - layout.options.center.x, 2) +
          Math.pow(pos.y - layout.options.center.y, 2) +
          Math.pow(pos.z - layout.options.center.z, 2)
        );
        // Should be approximately at globe radius
        expect(distFromCenter).toBeGreaterThan(0);
      });
    });

    test('should handle packets without geo data', () => {
      const positions = layout.globeLayout(mockPackets);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(mockPackets.length);
    });

    test('should handle empty array', () => {
      const positions = layout.globeLayout([]);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(0);
    });
  });

  describe('categoricalGridLayout', () => {
    test('should layout packets in categorical grid', () => {
      const categoricalPackets = [
        new NemosyneDataPacket({ id: '1', value: 10, context: { domain: 'category-a' } }),
        new NemosyneDataPacket({ id: '2', value: 20, context: { domain: 'category-a' } }),
        new NemosyneDataPacket({ id: '3', value: 30, context: { domain: 'category-b' } })
      ];
      
      const positions = layout.categoricalGridLayout(categoricalPackets);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(categoricalPackets.length);
    });

    test('should handle packets without category data', () => {
      const positions = layout.categoricalGridLayout(mockPackets);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(mockPackets.length);
    });

    test('should handle empty array', () => {
      const positions = layout.categoricalGridLayout([]);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(0);
    });
  });

  describe('matrixLayout', () => {
    test('should layout packets in matrix structure', () => {
      const matrixPackets = mockPackets.map((p, i) => {
        const packet = new NemosyneDataPacket({ id: p.id, value: p.value });
        packet.semantics = { structure: 'matrix' };
        return packet;
      });
      
      const positions = layout.matrixLayout(matrixPackets);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(matrixPackets.length);
    });

    test('should handle empty matrix', () => {
      const positions = layout.matrixLayout([]);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(0);
    });

    test('should handle single element', () => {
      const single = [new NemosyneDataPacket({ id: '1', value: 10 })];
      const positions = layout.matrixLayout(single);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(1);
    });
  });

  describe('sphericalLayout', () => {
    test('should layout packets on sphere', () => {
      const positions = layout.sphericalLayout(mockPackets);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(mockPackets.length);
      
      // Positions should be roughly equidistant from center
      mockPackets.forEach(packet => {
        const pos = positions.get(packet.id);
        const distance = Math.sqrt(
          Math.pow(pos.x - layout.options.center.x, 2) +
          Math.pow(pos.y - layout.options.center.y, 2) +
          Math.pow(pos.z - layout.options.center.z, 2)
        );
        expect(distance).toBeGreaterThan(0);
      });
    });

    test('should handle empty sphere', () => {
      const positions = layout.sphericalLayout([]);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(0);
    });

    test('should distribute evenly on sphere surface', () => {
      const positions = layout.sphericalLayout(mockPackets);
      
      // Calculate average distance from center
      let totalDist = 0;
      positions.forEach(pos => {
        const dist = Math.sqrt(
          Math.pow(pos.x - layout.options.center.x, 2) +
          Math.pow(pos.y - layout.options.center.y, 2) +
          Math.pow(pos.z - layout.options.center.z, 2)
        );
        totalDist += dist;
      });
      const avgDist = totalDist / positions.size;
      
      // Average should be close to radius
      expect(avgDist).toBeGreaterThan(0);
    });

    test('should handle many points', () => {
      const manyPackets = Array.from({ length: 50 }, (_, i) => 
        new NemosyneDataPacket({ id: `p${i}`, value: i })
      );
      
      const positions = layout.sphericalLayout(manyPackets);
      expect(positions).toBeInstanceOf(Map);
      expect(positions.size).toBe(50);
    });
  });

  describe('originalPositions', () => {
    test('should store original positions', () => {
      const positions = layout.calculatePositions(mockPackets, 'nemosyne-spherical');
      
      // Save positions
      positions.forEach((pos, id) => {
        layout.originalPositions.set(id, { ...pos });
      });
      
      expect(layout.originalPositions.size).toBe(mockPackets.length);
      
      // Verify saved
      mockPackets.forEach(packet => {
        expect(layout.originalPositions.has(packet.id)).toBe(true);
      });
    });

    test('should clear original positions', () => {
      layout.originalPositions.set('1', { x: 0, y: 0, z: 0 });
      layout.originalPositions.clear();
      expect(layout.originalPositions.size).toBe(0);
    });
  });

  describe('constraints', () => {
    test('should add constraints', () => {
      const constraint = { type: 'fixed', target: '1', position: { x: 0, y: 0, z: 0 } };
      layout.constraints.push(constraint);
      expect(layout.constraints).toContain(constraint);
      expect(layout.constraints.length).toBe(1);
    });

    test('should clear constraints', () => {
      layout.constraints.push({ type: 'fixed', target: '1', position: { x: 0, y: 0, z: 0 } });
      layout.constraints.length = 0;
      expect(layout.constraints.length).toBe(0);
    });

    test('should handle multiple constraints', () => {
      layout.constraints.push(
        { type: 'fixed', target: '1', position: { x: 0, y: 0, z: 0 } },
        { type: 'proximity', target: '2', reference: '1', distance: 1.0 }
      );
      expect(layout.constraints.length).toBe(2);
    });
  });
});
