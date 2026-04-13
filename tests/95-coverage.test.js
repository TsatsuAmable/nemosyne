/**
 * Comprehensive Tests for Nemosyne Core Components
 * Target: 95%+ coverage
 */

const path = require('path');

// Mock EventTarget for Node.js environment
class MockEventTarget {
  constructor() {
    this.listeners = {};
  }
  addEventListener(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }
  removeEventListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }
  dispatchEvent(event) {
    if (this.listeners[event.type]) {
      this.listeners[event.type].forEach(cb => cb(event));
    }
  }
  emit(type, detail) {
    this.dispatchEvent({ type, detail });
  }
}

// Setup global mocks before requiring modules
global.EventTarget = MockEventTarget;
global.CustomEvent = class CustomEvent {
  constructor(type, init) {
    this.type = type;
    this.detail = init?.detail;
  }
};
global.document = {
  querySelector: jest.fn(() => ({
    appendChild: jest.fn(),
    removeChild: jest.fn()
  })),
  createElement: jest.fn((tag) => ({
    tagName: tag,
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    style: {},
    classList: { add: jest.fn(), remove: jest.fn() },
    appendChild: jest.fn(),
    removeChild: jest.fn()
  }))
};
global.window = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn()
};

// Mock navigator for ResearchTelemetry
global.navigator = {
  userAgent: 'node-test'
};

// Load modules with mocked dependencies
let TopologyDetector;

beforeAll(() => {
  // We need to mock the TopologyScorer class that's imported
  jest.mock('../src/core/TopologyDetector.js', () => {
    const original = jest.requireActual('../src/core/TopologyDetector.js');
    return {
      ...original,
      TopologyScorer: class MockTopologyScorer {
        scoreAll(features, packets) {
          return {
            'nemosyne-tree-hierarchical': features.hasHierarchy ? 0.8 : 0.2,
            'nemosyne-graph-force': features.hasGraphLinks ? 0.7 : 0.1,
            'nemosyne-timeline-spiral': features.hasTimestamps ? 0.6 : 0.1,
            'nemosyne-crystal-default': 0.5
          };
        }
      }
    };
  });

  const td = require('../src/core/TopologyDetector.js');
  TopologyDetector = td.TopologyDetector;
});

describe('Nemosyne Comprehensive Tests', () => {
  describe('TopologyDetector', () => {
    let detector;

    beforeEach(() => {
      detector = new TopologyDetector();
    });

    test('should return default for empty data', () => {
      const result = detector.detect([]);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    test('should handle null data', () => {
      const result = detector.detect(null);
      expect(typeof result).toBe('string');
    });

    test('should extract features from packets', () => {
      const packets = [
        {
          semantics: { structure: 'point', type: 'quantitative', coordinateSpace: 'cartesian', scale: 'continuous' },
          relations: { children: [], links: [], parent: null, temporal: { before: [], after: [] } },
          context: { timestamp: Date.now() }
        }
      ];
      const features = detector.extractFeatures(packets);
      expect(features).toBeDefined();
      expect(features.packetCount).toBe(1);
    });

    test('should count structures', () => {
      const packets = [
        { semantics: { structure: 'point' } },
        { semantics: { structure: 'point' } },
        { semantics: { structure: 'tree' } }
      ];
      const counts = detector.countBy(packets, p => p.semantics.structure);
      expect(counts.point).toBe(2);
      expect(counts.tree).toBe(1);
    });

    test('should detect hierarchy', () => {
      const packets = [
        { relations: { children: ['child1'], parent: null } },
        { relations: { children: [], parent: 'parent1' } }
      ];
      const features = detector.extractFeatures(packets);
      expect(features.hasHierarchy).toBe(true);
    });

    test('should calculate average links', () => {
      const packets = [
        { relations: { links: [{ to: 'a' }, { to: 'b' }] } },
        { relations: { links: [] } }
      ];
      const avg = detector.averageLinks(packets);
      expect(avg).toBe(1);
    });

    test('should detect timestamps', () => {
      const packets = [
        { context: { timestamp: Date.now() } },
        { context: { timestamp: Date.now() + 1000 } }
      ];
      const features = detector.extractFeatures(packets);
      expect(features.hasTimestamps).toBe(true);
    });

    test('should detect geo data', () => {
      const packets = [
        { semantics: { subtype: 'latlong', coordinateSpace: 'geo' } }
      ];
      const features = detector.extractFeatures(packets);
      expect(features.hasGeoData).toBe(true);
    });

    test('should handle Map input', () => {
      const map = new Map([
        ['1', { value: 1 }],
        ['2', { value: 2 }]
      ]);
      const result = detector.detect(map);
      expect(typeof result).toBe('string');
    });

    test('should store last detected', () => {
      detector.detect([{ value: 1 }]);
      expect(detector.lastDetected).not.toBeNull();
      expect(detector.lastDetected).toHaveProperty('topology');
      expect(detector.lastDetected).toHaveProperty('confidence');
    });

    test('should calculate timestamp span', () => {
      const now = Date.now();
      const packets = [
        { context: { timestamp: now } },
        { context: { timestamp: now + 10000 } }
      ];
      const span = detector.getTimestampSpan(packets);
      expect(span).toBe(10000);
    });

    test('should detect sequential timestamps', () => {
      const now = Date.now();
      const packets = [
        { context: { timestamp: now } },
        { context: { timestamp: now + 1000 } },
        { context: { timestamp: now + 2000 } }
      ];
      expect(detector.isSequential(packets)).toBe(true);
    });

    test('should handle single packet', () => {
      const result = detector.detect([{ value: 1 }]);
      expect(typeof result).toBe('string');
    });

    test('should handle large datasets', () => {
      const packets = Array.from({ length: 1000 }, (_, i) => ({ value: i }));
      const features = detector.extractFeatures(packets);
      expect(features.packetCount).toBe(1000);
    });
  });

  describe('ResearchTelemetry', () => {
    let ResearchTelemetry;
    let telemetry;

    beforeAll(() => {
      ResearchTelemetry = require('../src/core/ResearchTelemetry.js').ResearchTelemetry;
    });

    beforeEach(() => {
      telemetry = new ResearchTelemetry();
    });

    afterEach(() => {
      if (telemetry) {
        telemetry.destroy();
      }
    });

    test('should initialize with defaults', () => {
      expect(telemetry.enabled).toBe(true);
      expect(telemetry.exportFormat).toBe('json');
      expect(telemetry.sessionId).toBeDefined();
      expect(telemetry.sessionId.length).toBe(16);
    });

    test('should accept custom options', () => {
      const custom = new ResearchTelemetry({ enabled: false, exportFormat: 'csv' });
      expect(custom.enabled).toBe(false);
      expect(custom.exportFormat).toBe('csv');
      custom.destroy();
    });

    test('should generate unique session IDs', () => {
      const t1 = new ResearchTelemetry();
      const t2 = new ResearchTelemetry();
      expect(t1.sessionId).not.toBe(t2.sessionId);
      t1.destroy();
      t2.destroy();
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

    test('should log layout changes', () => {
      telemetry.logLayoutChange('force', 'tree');
      expect(telemetry.metrics.layoutSwitches.length).toBe(1);
      expect(telemetry.metrics.layoutSwitches[0].from).toBe('force');
      expect(telemetry.metrics.layoutSwitches[0].to).toBe('tree');
    });

    test('should log task completions', () => {
      telemetry.logTaskCompletion('task-1', { success: true, time: 5000 });
      expect(telemetry.metrics.taskCompletions.length).toBe(1);
      expect(telemetry.metrics.taskCompletions[0].taskId).toBe('task-1');
    });

    test('should track gaze', () => {
      telemetry.trackGaze('node-1', { x: 0, y: 0 });
      expect(telemetry.metrics.gazeTargets.has('node-1')).toBe(true);
    });

    test('should not track gaze when disabled', () => {
      telemetry.enabled = false;
      telemetry.trackGaze('node-1', { x: 0, y: 0 });
      expect(telemetry.metrics.gazeTargets.has('node-1')).toBe(false);
    });

    test('should calculate metrics summary', () => {
      telemetry.logInteraction('click', 'n1');
      telemetry.logTaskCompletion('t1', { success: true });
      const summary = telemetry.getMetricsSummary();
      expect(summary.totalInteractions).toBe(1);
      expect(summary.taskCompletionRate).toBe(1);
    });

    test('should export data as JSON', () => {
      telemetry.logInteraction('click', 'n1');
      const data = telemetry.exportData();
      expect(typeof data).toBe('object');
      expect(data.sessionId).toBe(telemetry.sessionId);
    });

    test('should clear data', () => {
      telemetry.logInteraction('click', 'n1');
      telemetry.clear();
      expect(telemetry.metrics.interactions.length).toBe(0);
    });

    test('should destroy cleanly', () => {
      telemetry.logInteraction('click', 'n1');
      telemetry.destroy();
      expect(telemetry.events.length).toBe(0);
    });
  });

  describe('LayoutEngine', () => {
    let LayoutEngine;
    let engine;

    beforeAll(() => {
      LayoutEngine = require('../src/core/LayoutEngine.js').LayoutEngine;
    });

    beforeEach(() => {
      engine = new LayoutEngine();
    });

    test('should initialize with defaults', () => {
      expect(engine.options.center).toEqual({ x: 0, y: 1.6, z: -3 });
      expect(engine.options.radius).toBe(5);
      expect(engine.options.spacing).toBe(0.5);
    });

    test('should accept custom options', () => {
      const custom = new LayoutEngine({ center: { x: 10, y: 20, z: 30 }, radius: 10 });
      expect(custom.options.center).toEqual({ x: 10, y: 20, z: 30 });
      expect(custom.options.radius).toBe(10);
    });

    test('should calculate spherical layout', () => {
      const packets = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const positions = engine.sphericalLayout(packets);
      expect(positions.size).toBe(3);
      expect(positions.has('1')).toBe(true);
      expect(positions.has('2')).toBe(true);
      expect(positions.has('3')).toBe(true);
    });

    test('should calculate force directed layout', () => {
      const packets = [{ id: '1' }, { id: '2' }];
      const positions = engine.forceDirectedLayout(packets, 10);
      expect(positions.size).toBe(2);
    });

    test('should handle empty packets', () => {
      const positions = engine.sphericalLayout([]);
      expect(positions.size).toBe(0);
    });

    test('should handle single packet', () => {
      const positions = engine.sphericalLayout([{ id: '1' }]);
      expect(positions.size).toBe(1);
    });

    test('should add constraints', () => {
      const constraint = { type: 'pinch', target: 'n1' };
      engine.addConstraint(constraint);
      expect(engine.constraints).toContain(constraint);
    });

    test('should clear constraints', () => {
      engine.addConstraint({ type: 'pinch' });
      engine.clearConstraints();
      expect(engine.constraints).toHaveLength(0);
    });

    test('should save and reset positions', () => {
      engine.originalPositions.set('test', { x: 1, y: 2, z: 3 });
      const reset = engine.resetPosition('test');
      expect(reset).toEqual({ x: 1, y: 2, z: 3 });
    });

    test('should return null for unknown reset', () => {
      const reset = engine.resetPosition('nonexistent');
      expect(reset).toBeNull();
    });

    test('should calculate tree layout', () => {
      const packets = [
        { id: 'root', relations: { children: ['c1'] } },
        { id: 'c1', relations: { parent: 'root' } }
      ];
      const positions = engine.treeLayout(packets);
      expect(positions.size).toBe(2);
    });

    test('should calculate timeline layouts', () => {
      const now = Date.now();
      const packets = [
        { id: '1', context: { timestamp: now } },
        { id: '2', context: { timestamp: now + 1000 } }
      ];
      const spiral = engine.spiralTimelineLayout(packets);
      const linear = engine.linearTimelineLayout(packets);
      expect(spiral.size).toBe(2);
      expect(linear.size).toBe(2);
    });

    test('should calculate scatter layout', () => {
      const packets = [
        { id: '1', semantics: { embedding: [1, 2] } },
        { id: '2', semantics: { embedding: [3, 4] } }
      ];
      const positions = engine.scatterLayout(packets);
      expect(positions.size).toBe(2);
    });

    test('should calculate globe layout', () => {
      const packets = [
        { id: '1', semantics: { coordinateSpace: 'geo' } },
        { id: '2', semantics: { coordinateSpace: 'geo' } }
      ];
      const positions = engine.globeLayout(packets);
      expect(positions.size).toBe(2);
    });
  });

  describe('PropertyMapper', () => {
    let PropertyMapper;
    let mapper;

    beforeAll(() => {
      PropertyMapper = require('../src/core/PropertyMapper.js').PropertyMapper;
    });

    beforeEach(() => {
      mapper = new PropertyMapper();
    });

    test('should initialize with default color scales', () => {
      expect(mapper.colorScales.heatmap).toBeDefined();
      expect(mapper.colorScales.categorical).toBeDefined();
    });

    test('should accept custom color scales', () => {
      const custom = new PropertyMapper({ colorScales: { custom: ['#fff'] } });
      expect(custom.colorScales.custom).toEqual(['#fff']);
    });

    test('should initialize geometry map', () => {
      expect(mapper.geometryMap.point).toBeDefined();
      expect(mapper.geometryMap.vector).toBeDefined();
    });

    test('should map geometry types', () => {
      expect(mapper.mapGeometry('point').primitive).toBe('sphere');
      expect(mapper.mapGeometry('vector').primitive).toBe('cone');
      expect(mapper.mapGeometry('tree').primitive).toBe('icosahedron');
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
      const color = mapper.valueToHeatmap(50, { min: 0, max: 100 }, 'temperature');
      expect(typeof color).toBe('string');
    });

    test('should generate categorical color', () => {
      const color = mapper.categoricalColor('category-a', 'domain1');
      expect(typeof color).toBe('string');
    });

    test('should generate consistent colors for same value', () => {
      const color1 = mapper.categoricalColor('same', 'domain');
      const color2 = mapper.categoricalColor('same', 'domain');
      expect(color1).toBe(color2);
    });

    test('should generate ordinal color', () => {
      const color = mapper.ordinalColor(2, 'rank');
      expect(typeof color).toBe('string');
    });

    test('should hash string to color', () => {
      const color = mapper.hashToColor('test');
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    test('should lighten color', () => {
      const lightened = mapper.lighten('#000000', 0.3);
      expect(typeof lightened).toBe('string');
    });
  });

  describe('NemosyneDataPacket', () => {
    let NemosyneDataPacket;

    beforeAll(() => {
      NemosyneDataPacket = require('../src/core/NemosyneDataPacket.js').NemosyneDataPacket;
    });

    test('should create with defaults', () => {
      const packet = new NemosyneDataPacket();
      expect(packet.id).toMatch(/^pkt-/);
      expect(packet.semantics.type).toBe('quantitative');
      expect(packet.context.importance).toBe(0.5);
    });

    test('should accept custom values', () => {
      const packet = new NemosyneDataPacket({
        id: 'custom',
        value: 100,
        semantics: { type: 'categorical' }
      });
      expect(packet.id).toBe('custom');
      expect(packet.value).toBe(100);
      expect(packet.semantics.type).toBe('categorical');
    });

    test('should update value', () => {
      const packet = new NemosyneDataPacket({ value: 10 });
      packet.updateValue(20);
      expect(packet.value).toBe(20);
      expect(packet.context.version).toBe(2);
    });

    test('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(new NemosyneDataPacket().id);
      }
      expect(ids.size).toBe(100);
    });

    test('should validate importance range', () => {
      const valid = new NemosyneDataPacket({ context: { importance: 0.5 } });
      const invalid = new NemosyneDataPacket({ context: { importance: 1.5 } });
      expect(valid.validate()).toBe(true);
      expect(invalid.validate()).toBe(false);
    });

    test('should clone packet', () => {
      const original = new NemosyneDataPacket({ value: 100 });
      const clone = original.clone();
      expect(clone.value).toBe(original.value);
      expect(clone.id).not.toBe(original.id);
    });

    test('should serialize to JSON', () => {
      const packet = new NemosyneDataPacket({ value: 100 });
      const json = packet.toJSON();
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('value');
    });

    test('should deserialize from JSON', () => {
      const json = { id: 'test', value: 100, context: { importance: 0.8 } };
      const packet = NemosyneDataPacket.fromJSON(json);
      expect(packet.id).toBe('test');
      expect(packet.value).toBe(100);
    });
  });
});
