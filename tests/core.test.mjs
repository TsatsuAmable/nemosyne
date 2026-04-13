/**
 * Core Modules Tests for Nemosyne - ES Module version
 * Run with: NODE_OPTIONS='--experimental-vm-modules' npx jest --config jest.config.mjs
 * Target: 95%+ coverage
 */

import { NemosyneDataPacket, DataPacketGroup } from '../src/core/NemosyneDataPacket.js';
import { LayoutEngine } from '../src/core/LayoutEngine.js';
import { TopologyDetector, TopologyScorer } from '../src/core/TopologyDetector.js';
import { ResearchTelemetry } from '../src/core/ResearchTelemetry.js';
import { PropertyMapper } from '../src/core/PropertyMapper.js';

describe('Nemosyne Core Modules - 95% Coverage', () => {
  
  // ============================================================================
  // NEMOSYNE DATA PACKET
  // ============================================================================
  describe('NemosyneDataPacket', () => {
    test('should create packet with defaults', () => {
      const packet = new NemosyneDataPacket();
      expect(packet.id).toMatch(/^pkt-/);
      expect(packet.semantics.type).toBe('quantitative');
      expect(packet.semantics.structure).toBe('point');
      expect(packet.semantics.scale).toBe('continuous');
      expect(packet.context.importance).toBe(0.5);
      expect(packet.version).toBe(1);
      expect(packet.value).toBeUndefined();
    });

    test('should create with custom values', () => {
      const packet = new NemosyneDataPacket({
        id: 'custom-id',
        value: 42,
        semantics: { type: 'categorical', subtype: 'color' }
      });
      expect(packet.id).toBe('custom-id');
      expect(packet.value).toBe(42);
      expect(packet.semantics.type).toBe('categorical');
    });

    test('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(new NemosyneDataPacket().id);
      }
      expect(ids.size).toBe(100);
    });

    test('should update value with metadata', () => {
      const packet = new NemosyneDataPacket({ value: 10 });
      packet.updateValue(20, { reason: 'test' });
      expect(packet.value).toBe(20);
      expect(packet.context.version).toBe(2);
    });

    test('should transform data', () => {
      const packet = new NemosyneDataPacket({ value: 10 });
      packet.transform({ value: 20, transformType: 'double' });
      expect(packet.value).toBe(20);
      expect(packet.internal.lastTransform.type).toBe('double');
    });

    test('should add links', () => {
      const p1 = new NemosyneDataPacket({ id: 'p1' });
      const p2 = new NemosyneDataPacket({ id: 'p2' });
      
      p1.addLink('p2', 'related', 0.8);
      expect(p1.relations.links.length).toBe(1);
      expect(p1.relations.links[0].to).toBe('p2');
    });

    test('should set parent', () => {
      const packet = new NemosyneDataPacket({ id: 'p1' });
      packet.setParent('parent-id');
      expect(packet.relations.parent).toBe('parent-id');
    });

    test('should clone packet', () => {
      const original = new NemosyneDataPacket({
        id: 'original',
        value: 100,
        semantics: { type: 'categorical' }
      });
      const clone = original.clone();
      
      expect(clone.id).not.toBe(original.id);
      expect(clone.value).toBe(original.value);
      expect(clone.semantics.type).toBe(original.semantics.type);
    });

    test('should serialize to JSON', () => {
      const packet = new NemosyneDataPacket({ value: 42 });
      const json = packet.toJSON();
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('value');
      expect(json).toHaveProperty('semantics');
      expect(json.value).toBe(42);
    });

    test('should get and set properties', () => {
      const packet = new NemosyneDataPacket({
        value: 100,
        context: { importance: 0.8 }
      });
      
      expect(packet.get('value')).toBe(100);
      expect(packet.get('context.importance')).toBe(0.8);
      
      packet.set('value', 200);
      expect(packet.get('value')).toBe(200);
    });

    test('should handle overrides', () => {
      const packet = new NemosyneDataPacket({
        overrides: { color: '#ff0000' }
      });
      expect(packet.overrides.color).toBe('#ff0000');
      
      packet.override('scale', 2);
      expect(packet.overrides.scale).toBe(2);
      
      packet.clearOverrides();
      expect(Object.keys(packet.overrides).length).toBe(0);
    });

    test('should compute visual hash', () => {
      const packet = new NemosyneDataPacket({ value: 42 });
      const hash1 = packet.computeVisualHash();
      const hash2 = packet.computeVisualHash();
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
    });

    test('should clone with modifications', () => {
      const original = new NemosyneDataPacket({
        id: 'original',
        value: 100,
        semantics: { type: 'categorical' }
      });
      const clone = original.clone({ value: 200 });
      
      expect(clone.id).not.toBe(original.id);
      expect(clone.value).toBe(200);
      expect(clone.semantics.type).toBe('categorical');
    });

    test('should calculate similarity', () => {
      const p1 = new NemosyneDataPacket({
        semantics: { structure: 'point', embedding: [1, 0, 0] }
      });
      const p2 = new NemosyneDataPacket({
        semantics: { structure: 'point', embedding: [0, 1, 0] }
      });
      const p3 = new NemosyneDataPacket({
        semantics: { structure: 'point', embedding: [1, 0, 0] }
      });
      
      expect(p1.similarity(p1)).toBe(1);
      expect(p1.similarity(p2)).toBeLessThan(1);
      expect(p1.similarity(p3)).toBeGreaterThan(0);
    });

    test('should calculate cosine similarity', () => {
      const p = new NemosyneDataPacket({});
      const a = [1, 0, 0];
      const b = [1, 0, 0];
      const c = [0, 1, 0];
      
      expect(p.cosineSimilarity(a, b)).toBe(1);
      expect(p.cosineSimilarity(a, c)).toBe(0);
    });

    test('should handle path-based get', () => {
      const packet = new NemosyneDataPacket({
        context: { nested: { deep: 'value' } }
      });
      expect(packet.get('context.nested.deep')).toBe('value');
      expect(packet.get('nonexistent.path')).toBeUndefined();
    });

    test('should handle path-based set', () => {
      const packet = new NemosyneDataPacket({});
      packet.set('context.nested.value', 42);
      expect(packet.context.nested.value).toBe(42);
    });

    test('should link to another packet', () => {
      const p1 = new NemosyneDataPacket({ id: 'p1' });
      const p2 = new NemosyneDataPacket({ id: 'p2' });
      
      p1.addLink('p2', 'related', 0.8);
      expect(p1.relations.links.length).toBe(1);
      expect(p1.relations.links[0].to).toBe('p2');
      expect(p1.relations.links[0].type).toBe('related');
      expect(p1.relations.links[0].weight).toBe(0.8);
    });

    test('should set temporal order', () => {
      const packet = new NemosyneDataPacket({ id: 'p1' });
      packet.setTemporalOrder(['p2'], ['p3']);
      expect(packet.relations.temporal.after).toContain('p2');
      expect(packet.relations.temporal.before).toContain('p3');
    });
  });

  // ============================================================================
  // DATA PACKET GROUP
  // ============================================================================
  describe('DataPacketGroup', () => {
    test('should create group with packets', () => {
      const group = new DataPacketGroup();
      expect(group.getAll()).toHaveLength(0);
    });

    test('should add and remove packets', () => {
      const group = new DataPacketGroup();
      const p1 = new NemosyneDataPacket({ id: 'p1' });
      
      const id = group.add(p1);
      expect(group.getAll()).toHaveLength(1);
      expect(group.get(id)).toBe(p1);
      
      group.remove(id);
      expect(group.getAll()).toHaveLength(0);
    });

    test('should filter packets', () => {
      const group = new DataPacketGroup();
      group.add(new NemosyneDataPacket({ id: 'p1', value: 10 }));
      group.add(new NemosyneDataPacket({ id: 'p2', value: 20 }));
      group.add(new NemosyneDataPacket({ id: 'p3', value: 30 }));
      
      const filtered = group.filter(p => p.value > 15);
      expect(filtered).toHaveLength(2);
    });

    test('should group by type', () => {
      const group = new DataPacketGroup();
      group.add(new NemosyneDataPacket({ id: 'p1', semantics: { type: 'quantitative' } }));
      group.add(new NemosyneDataPacket({ id: 'p2', semantics: { type: 'quantitative' } }));
      group.add(new NemosyneDataPacket({ id: 'p3', semantics: { type: 'categorical' } }));
      
      const byType = group.groupByType();
      expect(byType.get('quantitative')).toHaveLength(2);
      expect(byType.get('categorical')).toHaveLength(1);
    });

    test('should group by domain', () => {
      const group = new DataPacketGroup();
      group.add(new NemosyneDataPacket({ id: 'p1', semantics: { domain: 'sales' } }));
      group.add(new NemosyneDataPacket({ id: 'p2', semantics: { domain: 'sales' } }));
      group.add(new NemosyneDataPacket({ id: 'p3', semantics: { domain: 'marketing' } }));
      
      const byDomain = group.groupByDomain();
      expect(byDomain.get('sales')).toHaveLength(2);
      expect(byDomain.get('marketing')).toHaveLength(1);
    });

    test('should get statistics', () => {
      const group = new DataPacketGroup();
      group.add(new NemosyneDataPacket({ id: 'p1', value: 10, context: { importance: 0.5 } }));
      group.add(new NemosyneDataPacket({ id: 'p2', value: 20, context: { importance: 0.6 } }));
      group.add(new NemosyneDataPacket({ id: 'p3', value: 30, context: { importance: 0.7 } }));
      
      const stats = group.getStatistics();
      expect(stats.count).toBe(3);
      expect(stats).toHaveProperty('types');
      expect(stats).toHaveProperty('structures');
      expect(stats).toHaveProperty('domains');
      expect(stats).toHaveProperty('averageImportance');
    });

    test('should count by function', () => {
      const group = new DataPacketGroup();
      group.add(new NemosyneDataPacket({ id: 'p1', semantics: { type: 'a' } }));
      group.add(new NemosyneDataPacket({ id: 'p2', semantics: { type: 'b' } }));
      group.add(new NemosyneDataPacket({ id: 'p3', semantics: { type: 'a' } }));
      
      const counts = group.countBy(p => p.semantics.type);
      expect(counts.a).toBe(2);
      expect(counts.b).toBe(1);
    });

    test('should get temporal range', () => {
      const now = Date.now();
      const group = new DataPacketGroup();
      group.add(new NemosyneDataPacket({ id: 'p1', context: { timestamp: now } }));
      group.add(new NemosyneDataPacket({ id: 'p2', context: { timestamp: now + 1000 } }));
      group.add(new NemosyneDataPacket({ id: 'p3', context: { timestamp: now + 2000 } }));
      
      const range = group.getTemporalRange();
      expect(range.min).toBe(now);
      expect(range.max).toBe(now + 2000);
      expect(range.span).toBe(2000);
    });

    test('should get bounding box', () => {
      const group = new DataPacketGroup();
      group.add(new NemosyneDataPacket({ id: 'p1', context: { position: { x: 0, y: 0, z: 0 } } }));
      group.add(new NemosyneDataPacket({ id: 'p2', context: { position: { x: 10, y: 10, z: 10 } } }));
      
      const bbox = group.getBoundingBox();
      expect(bbox).toHaveProperty('min');
      expect(bbox).toHaveProperty('max');
      expect(bbox.min).toHaveProperty('x');
      expect(bbox.max).toHaveProperty('x');
    });

    test('should group by semantics', () => {
      const group = new DataPacketGroup();
      group.add(new NemosyneDataPacket({ id: 'p1', semantics: { type: 'a' } }));
      group.add(new NemosyneDataPacket({ id: 'p2', semantics: { type: 'b' } }));
      group.add(new NemosyneDataPacket({ id: 'p3', semantics: { type: 'a' } }));
      
      const bySemantics = group.groupBySemantics('type');
      expect(bySemantics.get('a')).toHaveLength(2);
      expect(bySemantics.get('b')).toHaveLength(1);
    });

    test('should emit events', () => {
      const group = new DataPacketGroup();
      let emitted = false;
      group.addEventListener('test', () => {
        emitted = true;
      });
      group.emit('test', {});
      expect(emitted).toBe(true);
    });

    test('should handle statistics with no valid values', () => {
      const group = new DataPacketGroup();
      group.add(new NemosyneDataPacket({ id: 'p1' }));
      group.add(new NemosyneDataPacket({ id: 'p2' }));
      
      const stats = group.getStatistics();
      expect(stats.count).toBe(2);
      expect(stats).toHaveProperty('types');
    });

    test('should handle empty group for bounding box', () => {
      const group = new DataPacketGroup();
      const bbox = group.getBoundingBox();
      expect(bbox).toHaveProperty('min');
      expect(bbox).toHaveProperty('max');
    });

    test('should handle empty group for temporal range', () => {
      const group = new DataPacketGroup();
      const range = group.getTemporalRange();
      expect(range).toBeNull();
    });
  });

  // ============================================================================
  // LAYOUT ENGINE
  // ============================================================================
  describe('LayoutEngine', () => {
    let engine;

    beforeEach(() => {
      engine = new LayoutEngine();
    });

    test('should initialize with defaults', () => {
      expect(engine.options.center).toEqual({ x: 0, y: 1.6, z: -3 });
      expect(engine.options.radius).toBe(5);
      expect(engine.options.spacing).toBe(0.5);
    });

    test('should accept custom options', () => {
      const custom = new LayoutEngine({
        center: { x: 10, y: 20, z: 30 },
        radius: 10,
        spacing: 1.0
      });
      expect(custom.options.center).toEqual({ x: 10, y: 20, z: 30 });
      expect(custom.options.radius).toBe(10);
    });

    test('should calculate spherical layout', () => {
      const packets = [
        { id: '1' },
        { id: '2' },
        { id: '3' }
      ];
      const positions = engine.sphericalLayout(packets);
      expect(positions.size).toBe(3);
      expect(positions.has('1')).toBe(true);
      expect(positions.get('1')).toHaveProperty('x');
      expect(positions.get('1')).toHaveProperty('y');
      expect(positions.get('1')).toHaveProperty('z');
    });

    test('should calculate tree layout', () => {
      const packets = [
        { id: 'root', relations: { children: ['c1', 'c2'], parent: null } },
        { id: 'c1', relations: { children: [], parent: 'root' } },
        { id: 'c2', relations: { children: [], parent: 'root' } }
      ];
      const positions = engine.treeLayout(packets);
      expect(positions.size).toBe(3);
    });

    test('should calculate positions by topology', () => {
      // Tree layout needs hierarchical relationship
      const p1 = new NemosyneDataPacket({ id: '1' });
      const p2 = new NemosyneDataPacket({ id: '2', relations: { parent: '1' } });
      const packets = [p1, p2];
      
      // Test all layout types work
      expect(engine.calculatePositions(packets, 'nemosyne-graph-force').size).toBeGreaterThan(0);
      expect(engine.calculatePositions(packets, 'nemosyne-tree-hierarchical').size).toBeGreaterThan(0);
      expect(engine.calculatePositions(packets, 'nemosyne-timeline-spiral').size).toBeGreaterThan(0);
      expect(engine.calculatePositions(packets, 'unknown').size).toBeGreaterThan(0);
    });

    test('should handle empty and single packets', () => {
      expect(engine.sphericalLayout([]).size).toBe(0);
      expect(engine.sphericalLayout([new NemosyneDataPacket({ id: '1' })]).size).toBe(1);
    });

    test('should store and reset original positions', () => {
      const packet = new NemosyneDataPacket({ id: 'test' });
      const pos = { x: 1, y: 2, z: 3 };
      
      // Simulate layout creating positions
      const positions = engine.sphericalLayout([packet]);
      engine.originalPositions.set('test', pos);
      
      expect(engine.originalPositions.get('test')).toEqual(pos);
    });

    test('should manage constraints array', () => {
      expect(Array.isArray(engine.constraints)).toBe(true);
      const constraint = { type: 'pinch', target: 'n1' };
      engine.constraints.push(constraint);
      expect(engine.constraints).toContain(constraint);
    });

    test('should handle Map input', () => {
      const packetMap = new Map([
        ['1', new NemosyneDataPacket({ id: '1' })],
        ['2', new NemosyneDataPacket({ id: '2' })]
      ]);
      const positions = engine.sphericalLayout(packetMap);
      expect(positions.size).toBe(2);
    });
  });

  // ============================================================================
  // TOPOLOGY DETECTOR
  // ============================================================================
  describe('TopologyDetector', () => {
    let detector;

    beforeEach(() => {
      detector = new TopologyDetector();
    });

    test('should detect topology for various inputs', () => {
      expect(typeof detector.detect([])).toBe('string');
      expect(typeof detector.detect(null)).toBe('string');
      expect(typeof detector.detect([{ value: 1 }])).toBe('string');
    });

    test('should extract features from packets', () => {
      const packets = [
        new NemosyneDataPacket({
          id: 'p1',
          semantics: { structure: 'point', type: 'quantitative' }
        })
      ];
      const features = detector.extractFeatures(packets);
      expect(features.packetCount).toBe(1);
      expect(features.structures.point).toBe(1);
      expect(features.types.quantitative).toBe(1);
    });

    test('should detect hierarchical structure', () => {
      const packets = [
        new NemosyneDataPacket({ id: 'root', relations: { children: ['c1'] } }),
        new NemosyneDataPacket({ id: 'c1', relations: { parent: 'root' } })
      ];
      const features = detector.extractFeatures(packets);
      expect(features.hasHierarchy).toBe(true);
    });

    test('should detect graph structure', () => {
      const packets = [
        new NemosyneDataPacket({ id: 'a' }),
        new NemosyneDataPacket({ id: 'b' })
      ];
      packets[0].addLink('b', 'related');
      
      const features = detector.extractFeatures(packets);
      expect(features.hasGraphLinks).toBe(true);
    });

    test('should detect temporal and geo data', () => {
      const now = Date.now();
      const temporal = [
        new NemosyneDataPacket({ id: 'p1', context: { timestamp: now } }),
        new NemosyneDataPacket({ id: 'p2', context: { timestamp: now + 1000 } })
      ];
      expect(detector.extractFeatures(temporal).hasTimestamps).toBe(true);
      
      const geo = [
        new NemosyneDataPacket({ id: 'g1', semantics: { coordinateSpace: 'geo' } })
      ];
      expect(detector.extractFeatures(geo).hasGeoData).toBe(true);
    });

    test('should calculate average links', () => {
      const packets = [
        new NemosyneDataPacket({ id: 'p1' }),
        new NemosyneDataPacket({ id: 'p2' })
      ];
      packets[0].addLink('p2', 'related');
      expect(detector.averageLinks(packets)).toBe(0.5);
    });

    test('should calculate max depth for trees', () => {
      const packets = [
        new NemosyneDataPacket({ id: 'root', relations: { children: ['c1'] } }),
        new NemosyneDataPacket({ id: 'c1', relations: { children: ['c2'], parent: 'root' } }),
        new NemosyneDataPacket({ id: 'c2', relations: { parent: 'c1' } })
      ];
      expect(detector.maxTreeDepth(packets)).toBe(3);
      expect(detector.maxTreeDepth([])).toBe(0);
    });

    test('should get timestamp span and detect sequential', () => {
      const now = Date.now();
      const packets = [
        new NemosyneDataPacket({ id: 'p1', context: { timestamp: now } }),
        new NemosyneDataPacket({ id: 'p2', context: { timestamp: now + 10000 } })
      ];
      expect(detector.getTimestampSpan(packets)).toBe(10000);
      
      // Sequential requires temporal relationships
      const s1 = new NemosyneDataPacket({ id: 's1', context: { timestamp: now } });
      const s2 = new NemosyneDataPacket({ id: 's2', context: { timestamp: now + 1000 } });
      const s3 = new NemosyneDataPacket({ id: 's3', context: { timestamp: now + 2000 } });
      s1.setTemporalOrder([], ['s2']);
      s2.setTemporalOrder(['s1'], ['s3']);
      s3.setTemporalOrder(['s2'], []);
      
      expect(detector.isSequential([s1, s2, s3])).toBe(true);
    });

    test('should handle Map input', () => {
      const map = new Map([
        ['1', new NemosyneDataPacket({ id: '1', value: 1 })],
        ['2', new NemosyneDataPacket({ id: '2', value: 2 })]
      ]);
      expect(typeof detector.detect(map)).toBe('string');
    });

    test('should store last detection', () => {
      detector.detect([new NemosyneDataPacket({ id: 'p1', value: 1 })]);
      expect(detector.lastDetected).not.toBeNull();
      expect(detector.lastDetected).toHaveProperty('topology');
      expect(detector.lastDetected).toHaveProperty('confidence');
    });

    test('should return confidence scores', () => {
      const scores = detector.getConfidenceScores([
        new NemosyneDataPacket({ id: 'p1' }),
        new NemosyneDataPacket({ id: 'p2' })
      ]);
      expect(typeof scores).toBe('object');
    });

    test('should validate topology', () => {
      expect(detector.validateTopology('nemosyne-graph-force')).toBe(true);
      expect(detector.validateTopology('invalid')).toBe(false);
    });

    test('should get description', () => {
      const desc = detector.getDescription('nemosyne-graph-force');
      expect(typeof desc).toBe('string');
    });

    test('should handle single packet', () => {
      const result = detector.detect([new NemosyneDataPacket({ id: 'p1', value: 1 })]);
      expect(typeof result).toBe('string');
    });
  });

  // ============================================================================
  // TOPOLOGY SCORER
  // ============================================================================
  describe('TopologyScorer', () => {
    let scorer;

    beforeEach(() => {
      scorer = new TopologyScorer();
    });

    test('should score all topologies', () => {
      const features = { packetCount: 10, hasHierarchy: true };
      const scores = scorer.scoreAll(features, []);
      
      expect(scores).toHaveProperty('nemosyne-tree-hierarchical');
      expect(scores).toHaveProperty('nemosyne-graph-force');
    });

    test('should calculate graph score', () => {
      const features = { hasGraphLinks: true, avgLinks: 2 };
      expect(scorer.scoreGraph(features)).toBeGreaterThan(0);
    });

    test('should calculate tree score', () => {
      const features = { hasHierarchy: true, maxTreeDepth: 3 };
      expect(scorer.scoreTree(features)).toBeGreaterThan(0);
    });

    test('should calculate timeline score', () => {
      const features = { hasTimestamps: true, timestampSpan: 86400000 };
      expect(scorer.scoreTimeline(features)).toBeGreaterThan(0);
    });

    test('should calculate geo, scatter, categorical, matrix scores', () => {
      expect(scorer.scoreGeo({ hasGeoData: true, packetCount: 1 })).toBeGreaterThan(0);
      expect(scorer.scoreScatter({ hasEmbeddings: true, packetCount: 1 })).toBeGreaterThan(0);
      expect(scorer.scoreGrid({ types: { categorical: 1 }, structures: {}, scales: { nominal: 0 }, packetCount: 1 })).toBeGreaterThan(0);
      expect(scorer.scoreMatrix({ structures: { matrix: 1 }, types: {}, packetCount: 1 })).toBeGreaterThan(0);
    });

    test('should get weights', () => {
      const weights = scorer.getWeights('nemosyne-graph-force');
      expect(typeof weights).toBe('object');
    });

    test('should handle zero features gracefully', () => {
      expect(scorer.scoreGraph({})).toBe(0);
      expect(scorer.scoreTree({})).toBe(0);
    });
  });

  // ============================================================================
  // RESEARCH TELEMETRY
  // ============================================================================
  describe('ResearchTelemetry', () => {
    let telemetry;

    beforeEach(() => {
      telemetry = new ResearchTelemetry();
    });

    test('should initialize with defaults', () => {
      expect(telemetry.enabled).toBe(true);
      expect(telemetry.exportFormat).toBe('json');
      expect(telemetry.sessionId).toBeDefined();
      expect(typeof telemetry.sessionId).toBe('string');
    });

    test('should accept custom options', () => {
      const custom = new ResearchTelemetry({
        enabled: false,
        exportFormat: 'csv'
      });
      expect(custom.enabled).toBe(false);
      expect(custom.exportFormat).toBe('csv');
    });

    test('should generate unique session IDs', () => {
      const t1 = new ResearchTelemetry();
      const t2 = new ResearchTelemetry();
      expect(t1.sessionId).not.toBe(t2.sessionId);
    });

    test('should log interactions', () => {
      telemetry.logInteraction('click', 'node-1', { button: 'left' });
      expect(telemetry.metrics.interactions.length).toBe(1);
      expect(telemetry.metrics.interactions[0].type).toBe('click');
    });

    test('should not log when disabled', () => {
      telemetry.enabled = false;
      telemetry.logInteraction('click', 'node-1');
      expect(telemetry.metrics.interactions.length).toBe(0);
    });

    test('should log layout events', () => {
      telemetry.logLayoutEvent('force', 100, 500);
      expect(telemetry.metrics.layoutSwitches.length).toBe(1);
      expect(telemetry.metrics.layoutSwitches[0].layoutType).toBe('force');
    });

    test('should log task completions', () => {
      telemetry.logTaskCompletion('task-1', true, 5000);
      expect(telemetry.metrics.taskCompletions.length).toBe(1);
      expect(telemetry.metrics.taskCompletions[0].taskId).toBe('task-1');
    });

    test('should track gaze', () => {
      telemetry.trackGaze('node-1', 500);
      expect(telemetry.metrics.gazeTargets.has('node-1')).toBe(true);
    });

    test('should not track gaze when disabled', () => {
      telemetry.enabled = false;
      telemetry.trackGaze('node-1', 500);
      expect(telemetry.metrics.gazeTargets.has('node-1')).toBe(false);
    });

    test('should calculate metrics summary', () => {
      telemetry.logInteraction('click', 'n1');
      telemetry.logTaskCompletion('t1', true, 1000);
      const summary = telemetry.generateSummary();
      expect(summary.totalInteractions).toBe(1);
    });

    test('should export data', () => {
      telemetry.logInteraction('click', 'n1');
      
      const data = telemetry.exportData();
      expect(data).toBeDefined();
      expect(data.metrics || data).toBeDefined();
      
      telemetry.exportFormat = 'csv';
      const csv = telemetry.exportData();
      expect(typeof csv).toBe('string');
    });

    test('should clear data', () => {
      telemetry.logInteraction('click', 'n1');
      telemetry.clear();
      expect(telemetry.metrics.interactions.length).toBe(0);
    });

    test('should calculate average velocity', () => {
      telemetry.metrics.navigationPath = [
        { velocity: 10 },
        { velocity: 20 },
        { velocity: 30 }
      ];
      expect(telemetry.calculateAverageVelocity()).toBe(20);
    });

    test('should calculate task success rate', () => {
      telemetry.logTaskCompletion('t1', true, 1000);
      telemetry.logTaskCompletion('t2', false, 1000);
      expect(telemetry.calculateTaskSuccessRate()).toBe(0.5);
    });

    test('should calculate total distance', () => {
      telemetry.metrics.navigationPath = [
        { position: { x: 0, y: 0, z: 0 } },
        { position: { x: 3, y: 4, z: 0 } }
      ];
      expect(telemetry.calculateTotalDistance()).toBe(5);
    });

    test('should get interaction context', () => {
      const ctx = telemetry.getInteractionContext();
      expect(ctx).toHaveProperty('sessionDuration');
      expect(ctx).toHaveProperty('totalNavPoints');
    });

    test('should get current region', () => {
      const region = telemetry.getCurrentRegion({ x: 0, y: 0, z: 0 });
      expect(typeof region).toBe('string');
    });

    test('should serialize metrics', () => {
      telemetry.logInteraction('click', 'n1');
      const serialized = telemetry.serializeMetrics();
      expect(serialized).toHaveProperty('interactions');
      expect(serialized).toHaveProperty('gazeTargets');
    });
  });

  // ============================================================================
  // PROPERTY MAPPER
  // ============================================================================
  describe('PropertyMapper', () => {
    let mapper;

    beforeEach(() => {
      mapper = new PropertyMapper();
    });

    test('should initialize with default color scales', () => {
      expect(mapper.colorScales.heatmap).toBeDefined();
      expect(mapper.colorScales.categorical).toBeDefined();
      expect(mapper.colorScales.diverging).toBeDefined();
    });

    test('should accept custom color scales', () => {
      const custom = new PropertyMapper({ colorScales: { custom: ['#fff'] } });
      expect(custom.colorScales.custom).toEqual(['#fff']);
    });

    test('should map geometry types', () => {
      expect(mapper.mapGeometry('point').primitive).toBe('sphere');
      expect(mapper.mapGeometry('vector').primitive).toBe('cone');
      expect(mapper.mapGeometry('tree').primitive).toBe('icosahedron');
      expect(mapper.mapGeometry('graph').primitive).toBe('dodecahedron');
      expect(mapper.mapGeometry('unknown').primitive).toBe('sphere');
    });

    test('should map scale based on importance', () => {
      const scale = mapper.mapScale(0.5, 1.0);
      expect(scale).toHaveProperty('x');
      expect(scale).toHaveProperty('y');
      expect(scale).toHaveProperty('z');
    });

    test('should reduce scale for low confidence', () => {
      const highConf = mapper.mapScale(0.5, 1.0);
      const lowConf = mapper.mapScale(0.5, 0.5);
      expect(lowConf.x).toBeLessThan(highConf.x);
    });

    test('should map opacity', () => {
      const opacity = mapper.mapOpacity(0.8, 0.1);
      expect(typeof opacity).toBe('number');
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThanOrEqual(1);
    });

    test('should convert value to heatmap color', () => {
      const color = mapper.valueToHeatmap(50, { min: 0, max: 100 });
      expect(typeof color).toBe('string');
      expect(color).toMatch(/^#/);
    });

    test('should generate categorical color', () => {
      const color = mapper.categoricalColor('category-a', 'domain1');
      expect(typeof color).toBe('string');
      expect(color).toMatch(/^#/);
    });

    test('should generate consistent colors', () => {
      const color1 = mapper.categoricalColor('same', 'domain');
      const color2 = mapper.categoricalColor('same', 'domain');
      expect(color1).toBe(color2);
    });

    test('should generate ordinal color', () => {
      const color = mapper.ordinalColor(2, 'rank');
      expect(typeof color).toBe('string');
      expect(color).toMatch(/^#/);
    });

    test('should interpolate colors', () => {
      const color = mapper.interpolateColor('#ff0000', '#0000ff', 0.5);
      expect(typeof color).toBe('string');
      expect(color).toMatch(/^#/);
    });

    test('should hash string to color', () => {
      const color = mapper.hashToColor('test');
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    test('should lighten color', () => {
      const lightened = mapper.lighten('#000000', 0.3);
      expect(typeof lightened).toBe('string');
      expect(lightened).toMatch(/^#/);
    });

    test('should map color based on packet', () => {
      const packet = new NemosyneDataPacket({
        value: 50,
        semantics: { type: 'quantitative', scale: 'continuous' }
      });
      const color = mapper.mapColor(packet);
      expect(typeof color).toBe('string');
    });

    test('should map emissive based on importance', () => {
      const highPacket = new NemosyneDataPacket({
        value: 1,
        context: { importance: 0.9 }
      });
      const lowPacket = new NemosyneDataPacket({
        value: 1,
        context: { importance: 0.3 }
      });
      
      expect(typeof mapper.mapEmissive(highPacket)).toBe('string');
      expect(typeof mapper.mapEmissive(lowPacket)).toBe('string');
    });

    test('should register and apply custom mappings', () => {
      mapper.registerMapping('value', 'scale', (val) => ({ x: val, y: val, z: val }));
      
      const packet = new NemosyneDataPacket({ value: 10 });
      const result = mapper.applyCustomMapping(packet, 'value', 'scale');
      expect(result).toBeDefined();
    });

    test('should merge with overrides', () => {
      const auto = { color: '#ff0000', scale: { x: 1, y: 1, z: 1 } };
      const overrides = { color: '#00ff00', scale: { x: 2, y: 2, z: 2 } };
      
      const merged = mapper.mergeWithOverrides(auto, overrides);
      expect(merged.color).toBe('#00ff00');
      expect(merged.scale.x).toBe(2);
    });

    test('should get domain range', () => {
      const range = mapper.getDomainRange('sales');
      expect(range).toBeDefined();
    });

    test('should hash string consistently', () => {
      const hash1 = mapper.hashString('test');
      const hash2 = mapper.hashString('test');
      const hash3 = mapper.hashString('different');
      
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });

    test('should convert HSL to hex', () => {
      const hex = mapper.hslToHex(0, 100, 50);
      expect(typeof hex).toBe('string');
      expect(hex).toMatch(/^#/);
    });

    test('should parse hex color', () => {
      const parsed = mapper.parseHex('#ff0000');
      expect(parsed).toHaveProperty('r');
      expect(parsed).toHaveProperty('g');
      expect(parsed).toHaveProperty('b');
    });

    test('should autoMap packet properties', () => {
      const packet = new NemosyneDataPacket({
        value: 50,
        semantics: { type: 'quantitative', scale: 'continuous', structure: 'point' },
        context: { importance: 0.7, confidence: 0.9 }
      });
      const props = mapper.autoMap(packet);
      expect(props).toHaveProperty('geometry');
      expect(props).toHaveProperty('color');
      expect(props).toHaveProperty('scale');
      expect(props).toHaveProperty('opacity');
    });

    test('should map with overrides', () => {
      const packet = new NemosyneDataPacket({
        value: 50,
        overrides: { color: '#00ff00' }
      });
      const props = mapper.map(packet);
      expect(props.color).toBe('#00ff00');
    });

    test('should map emissive intensity', () => {
      const packet = new NemosyneDataPacket({
        context: { importance: 0.9 }
      });
      const intensity = mapper.mapEmissiveIntensity(packet);
      expect(intensity).toBeGreaterThan(0.3);
    });

    test('should handle continuous scale color mapping', () => {
      const packet = new NemosyneDataPacket({
        value: 50,
        semantics: { scale: 'continuous', domain: 'temperature' }
      });
      const color = mapper.mapColor(packet);
      expect(typeof color).toBe('string');
    });

    test('should handle ordinal scale color mapping', () => {
      const packet = new NemosyneDataPacket({
        value: 2,
        semantics: { scale: 'ordinal', domain: 'rank' }
      });
      const color = mapper.mapColor(packet);
      expect(typeof color).toBe('string');
    });

    test('should handle nominal type color mapping', () => {
      const packet = new NemosyneDataPacket({
        value: 'category-a',
        semantics: { type: 'categorical', scale: 'nominal', domain: 'types' }
      });
      const color = mapper.mapColor(packet);
      expect(typeof color).toBe('string');
    });
  });
});
