/**
 * Core Modules Tests for Nemosyne
 * Target: 95%+ coverage on src/core/
 * 
 * These tests use dynamic imports to support ES modules
 */

describe('Nemosyne Core Modules - 95% Coverage', () => {
  let NemosyneDataPacket;
  let LayoutEngine;
  let TopologyDetector;
  let TopologyScorer;
  let ResearchTelemetry;
  let PropertyMapper;

  beforeAll(async () => {
    // Dynamic imports for ES modules
    const packetModule = await import('../src/core/NemosyneDataPacket.js');
    NemosyneDataPacket = packetModule.NemosyneDataPacket;
    
    const layoutModule = await import('../src/core/LayoutEngine.js');
    LayoutEngine = layoutModule.LayoutEngine;
    
    const topologyModule = await import('../src/core/TopologyDetector.js');
    TopologyDetector = topologyModule.TopologyDetector;
    TopologyScorer = topologyModule.TopologyScorer;
    
    const telemetryModule = await import('../src/core/ResearchTelemetry.js');
    ResearchTelemetry = telemetryModule.ResearchTelemetry;
    
    const mapperModule = await import('../src/core/PropertyMapper.js');
    PropertyMapper = mapperModule.PropertyMapper;
  });

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
      expect(packet.relations.parent).toBeNull();
      expect(packet.relations.children).toEqual([]);
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
      expect(packet.semantics.subtype).toBe('color');
    });

    test('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(new NemosyneDataPacket().id);
      }
      expect(ids.size).toBe(100);
    });

    test('should validate importance within range', () => {
      const valid = new NemosyneDataPacket({ context: { importance: 0.5 } });
      const tooHigh = new NemosyneDataPacket({ context: { importance: 1.5 } });
      const negative = new NemosyneDataPacket({ context: { importance: -0.1 } });
      
      expect(valid.validate()).toBe(true);
      expect(tooHigh.validate()).toBe(false);
      expect(negative.validate()).toBe(false);
    });

    test('should validate semantics type', () => {
      const valid = new NemosyneDataPacket({ semantics: { type: 'temporal' } });
      const invalid = new NemosyneDataPacket({ semantics: { type: 'invalid-type' } });
      
      expect(valid.validate()).toBe(true);
      expect(invalid.validate()).toBe(false);
    });

    test('should validate scale value', () => {
      const valid = new NemosyneDataPacket({ semantics: { scale: 'ordinal' } });
      const invalid = new NemosyneDataPacket({ semantics: { scale: 'unknown' } });
      
      expect(valid.validate()).toBe(true);
      expect(invalid.validate()).toBe(false);
    });

    test('should update value', () => {
      const packet = new NemosyneDataPacket({ value: 10 });
      packet.updateValue(20, { timestamp: Date.now() });
      expect(packet.value).toBe(20);
      expect(packet.version).toBe(2);
    });

    test('should add children', () => {
      const parent = new NemosyneDataPacket({ id: 'parent' });
      const child = new NemosyneDataPacket({ id: 'child' });
      
      parent.addChild(child);
      expect(parent.relations.children).toContain('child');
      expect(child.relations.parent).toBe('parent');
    });

    test('should remove children', () => {
      const parent = new NemosyneDataPacket({ id: 'parent' });
      const child = new NemosyneDataPacket({ id: 'child' });
      
      parent.addChild(child);
      parent.removeChild(child);
      expect(parent.relations.children).not.toContain('child');
      expect(child.relations.parent).toBeNull();
    });

    test('should link to other packets', () => {
      const p1 = new NemosyneDataPacket({ id: 'p1' });
      const p2 = new NemosyneDataPacket({ id: 'p2' });
      
      p1.linkTo(p2, { strength: 0.8, type: 'correlation' });
      expect(p1.relations.links).toHaveLength(1);
      expect(p1.relations.links[0].to).toBe('p2');
    });

    test('should unlink from packets', () => {
      const p1 = new NemosyneDataPacket({ id: 'p1' });
      const p2 = new NemosyneDataPacket({ id: 'p2' });
      
      p1.linkTo(p2);
      p1.unlinkFrom(p2);
      expect(p1.relations.links).toHaveLength(0);
    });

    test('should set importance', () => {
      const packet = new NemosyneDataPacket();
      packet.setImportance(0.8);
      expect(packet.context.importance).toBe(0.8);
    });

    test('should clamp importance', () => {
      const packet = new NemosyneDataPacket();
      packet.setImportance(1.5);
      expect(packet.context.importance).toBe(1.0);
      packet.setImportance(-0.5);
      expect(packet.context.importance).toBe(0);
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

    test('should deserialize from JSON', () => {
      const json = {
        id: 'test-id',
        value: 100,
        semantics: { type: 'quantitative' },
        createdAt: Date.now(),
        version: 1,
        relations: {},
        context: { importance: 0.5 }
      };
      const packet = NemosyneDataPacket.fromJSON(json);
      
      expect(packet.id).toBe('test-id');
      expect(packet.value).toBe(100);
    });

    test('should create from plain object', () => {
      const data = {
        id: 'plain',
        value: 'test-value',
        semantics: { type: 'categorical' }
      };
      const packet = NemosyneDataPacket.fromObject(data);
      expect(packet.id).toBe('plain');
      expect(packet.value).toBe('test-value');
    });

    test('should create batch from objects', () => {
      const objects = [
        { value: 1 },
        { value: 2 },
        { value: 3 }
      ];
      const packets = NemosyneDataPacket.batchFromObjects(objects);
      expect(packets).toHaveLength(3);
      expect(packets[0].value).toBe(1);
      expect(packets[2].value).toBe(3);
    });

    test('should check if temporal', () => {
      const temporal = new NemosyneDataPacket({
        semantics: { temporal: true }
      });
      const nonTemporal = new NemosyneDataPacket();
      
      expect(temporal.isTemporal()).toBe(true);
      expect(nonTemporal.isTemporal()).toBe(false);
    });

    test('should check if spatial', () => {
      const spatial = new NemosyneDataPacket({
        semantics: { coordinateSpace: 'geo' }
      });
      const nonSpatial = new NemosyneDataPacket();
      
      expect(spatial.isSpatial()).toBe(true);
      expect(nonSpatial.isSpatial()).toBe(false);
    });

    test('should check if hierarchical', () => {
      const parent = new NemosyneDataPacket({ id: 'p' });
      const child = new NemosyneDataPacket({ id: 'c' });
      
      expect(parent.isHierarchical()).toBe(false);
      parent.addChild(child);
      expect(parent.isHierarchical()).toBe(true);
    });

    test('should check if networked', () => {
      const p1 = new NemosyneDataPacket({ id: 'p1' });
      const p2 = new NemosyneDataPacket({ id: 'p2' });
      
      expect(p1.isNetworked()).toBe(false);
      p1.linkTo(p2);
      expect(p1.isNetworked()).toBe(true);
    });

    test('should update semantic metadata', () => {
      const packet = new NemosyneDataPacket();
      packet.updateSemantics({ scale: 'log', uncertainty: 0.1 });
      expect(packet.semantics.scale).toBe('log');
      expect(packet.semantics.uncertainty).toBe(0.1);
    });

    test('should get confidence score', () => {
      const uncertain = new NemosyneDataPacket({
        semantics: { uncertainty: 0.5 }
      });
      const certain = new NemosyneDataPacket();
      
      expect(uncertain.getConfidence()).toBe(0.5);
      expect(certain.getConfidence()).toBe(1);
    });

    test('should set coordinate space', () => {
      const packet = new NemosyneDataPacket();
      packet.setCoordinateSpace('polar');
      expect(packet.semantics.coordinateSpace).toBe('polar');
    });

    test('should set dimensions', () => {
      const packet = new NemosyneDataPacket();
      packet.setDimensions(2);
      expect(packet.semantics.dimensions).toBe(2);
    });

    test('should set temporal metadata', () => {
      const packet = new NemosyneDataPacket();
      const timestamp = Date.now();
      packet.setTemporal(timestamp);
      expect(packet.semantics.temporal).toBe(true);
      expect(packet.context.timestamp).toBe(timestamp);
    });

    test('should get children IDs', () => {
      const parent = new NemosyneDataPacket({ id: 'p' });
      const c1 = new NemosyneDataPacket({ id: 'c1' });
      const c2 = new NemosyneDataPacket({ id: 'c2' });
      
      parent.addChild(c1);
      parent.addChild(c2);
      
      const children = parent.getChildrenIds();
      expect(children).toContain('c1');
      expect(children).toContain('c2');
    });

    test('should check if has children', () => {
      const parent = new NemosyneDataPacket({ id: 'p' });
      expect(parent.hasChildren()).toBe(false);
      
      const child = new NemosyneDataPacket({ id: 'c' });
      parent.addChild(child);
      expect(parent.hasChildren()).toBe(true);
    });

    test('should get link count', () => {
      const p1 = new NemosyneDataPacket({ id: 'p1' });
      const p2 = new NemosyneDataPacket({ id: 'p2' });
      const p3 = new NemosyneDataPacket({ id: 'p3' });
      
      p1.linkTo(p2);
      p1.linkTo(p3);
      
      expect(p1.getLinkCount()).toBe(2);
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
      expect(custom.options.spacing).toBe(1.0);
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

    test('should calculate force-directed layout', () => {
      const packets = [
        { id: '1' },
        { id: '2' },
        { id: '3' }
      ];
      const positions = engine.forceDirectedLayout(packets, 10);
      expect(positions.size).toBe(3);
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

    test('should calculate spiral timeline layout', () => {
      const now = Date.now();
      const packets = [
        { id: '1', context: { timestamp: now } },
        { id: '2', context: { timestamp: now + 1000 } },
        { id: '3', context: { timestamp: now + 2000 } }
      ];
      const positions = engine.spiralTimelineLayout(packets);
      expect(positions.size).toBe(3);
    });

    test('should calculate linear timeline layout', () => {
      const now = Date.now();
      const packets = [
        { id: '1', context: { timestamp: now } },
        { id: '2', context: { timestamp: now + 1000 } }
      ];
      const positions = engine.linearTimelineLayout(packets);
      expect(positions.size).toBe(2);
    });

    test('should calculate scatter layout with embeddings', () => {
      const packets = [
        { id: '1', semantics: { embedding: [1, 2, 3] } },
        { id: '2', semantics: { embedding: [4, 5, 6] } }
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

    test('should calculate categorical grid layout', () => {
      const packets = [
        { id: '1', semantics: { domain: 'category1' } },
        { id: '2', semantics: { domain: 'category1' } },
        { id: '3', semantics: { domain: 'category2' } }
      ];
      const positions = engine.categoricalGridLayout(packets);
      expect(positions.size).toBe(3);
    });

    test('should calculate matrix layout', () => {
      const packets = [
        { id: '1' },
        { id: '2' }
      ];
      const positions = engine.matrixLayout(packets);
      expect(positions.size).toBe(2);
    });

    test('should calculate positions by topology', () => {
      const packets = [{ id: '1' }, { id: '2' }];
      
      const force = engine.calculatePositions(packets, 'nemosyne-graph-force');
      expect(force.size).toBe(2);
      
      const tree = engine.calculatePositions(packets, 'nemosyne-tree-hierarchical');
      expect(tree.size).toBe(2);
      
      // Default fallback
      const def = engine.calculatePositions(packets, 'unknown');
      expect(def.size).toBe(2);
    });

    test('should handle empty packet array', () => {
      const positions = engine.sphericalLayout([]);
      expect(positions.size).toBe(0);
    });

    test('should handle single packet', () => {
      const positions = engine.sphericalLayout([{ id: '1' }]);
      expect(positions.size).toBe(1);
    });

    test('should add constraint', () => {
      const constraint = { type: 'pinch', target: 'n1' };
      engine.addConstraint(constraint);
      expect(engine.constraints).toContain(constraint);
    });

    test('should clear constraints', () => {
      engine.addConstraint({ type: 'pinch' });
      engine.clearConstraints();
      expect(engine.constraints).toHaveLength(0);
    });

    test('should save and reset position', () => {
      const pos = { x: 1, y: 2, z: 3 };
      engine.savePosition('test', pos);
      const reset = engine.resetPosition('test');
      expect(reset).toEqual(pos);
    });

    test('should return null for unknown position reset', () => {
      const reset = engine.resetPosition('nonexistent');
      expect(reset).toBeNull();
    });

    test('should clear saved positions', () => {
      engine.savePosition('1', { x: 0, y: 0, z: 0 });
      engine.clearSavedPositions();
      expect(engine.originalPositions.size).toBe(0);
    });

    test('should get all positions', () => {
      engine.savePosition('1', { x: 1, y: 1, z: 1 });
      engine.savePosition('2', { x: 2, y: 2, z: 2 });
      const all = engine.getAllPositions();
      expect(Object.keys(all)).toHaveLength(2);
    });

    test('should update options', () => {
      engine.setOptions({ radius: 10 });
      expect(engine.options.radius).toBe(10);
    });

    test('should get and set center position', () => {
      engine.setCenter({ x: 5, y: 5, z: 5 });
      expect(engine.getCenter()).toEqual({ x: 5, y: 5, z: 5 });
    });

    test('should calculate distance between packets', () => {
      const p1 = { id: '1' };
      const p2 = { id: '2' };
      engine.savePosition('1', { x: 0, y: 0, z: 0 });
      engine.savePosition('2', { x: 3, y: 4, z: 0 });
      
      const dist = engine.getDistance(p1, p2);
      expect(dist).toBe(5);
    });

    test('should handle Map input', () => {
      const packetMap = new Map([
        ['1', { id: '1' }],
        ['2', { id: '2' }]
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

    test('should detect topology for empty data', () => {
      const result = detector.detect([]);
      expect(typeof result).toBe('string');
    });

    test('should detect topology for null data', () => {
      const result = detector.detect(null);
      expect(typeof result).toBe('string');
    });

    test('should extract features from packets', () => {
      const packets = [
        {
          semantics: { structure: 'point', type: 'quantitative' },
          relations: { children: [], links: [], parent: null }
        }
      ];
      const features = detector.extractFeatures(packets);
      expect(features.packetCount).toBe(1);
      expect(features.byStructure.point).toBe(1);
    });

    test('should detect hierarchical structure', () => {
      const packets = [
        { relations: { children: ['child'], parent: null } },
        { relations: { children: [], parent: 'parent' } }
      ];
      const features = detector.extractFeatures(packets);
      expect(features.hasHierarchy).toBe(true);
    });

    test('should detect graph structure', () => {
      const packets = [
        { relations: { links: [{ to: 'b' }], children: [], parent: null } },
        { relations: { links: [{ to: 'a' }], children: [], parent: null } }
      ];
      const features = detector.extractFeatures(packets);
      expect(features.hasGraphLinks).toBe(true);
    });

    test('should detect temporal data', () => {
      const now = Date.now();
      const packets = [
        { context: { timestamp: now }, relations: {} },
        { context: { timestamp: now + 1000 }, relations: {} }
      ];
      const features = detector.extractFeatures(packets);
      expect(features.hasTimestamps).toBe(true);
    });

    test('should detect geo data', () => {
      const packets = [
        { semantics: { coordinateSpace: 'geo' }, relations: {} }
      ];
      const features = detector.extractFeatures(packets);
      expect(features.hasGeoData).toBe(true);
    });

    test('should calculate average links', () => {
      const packets = [
        { relations: { links: [{ to: 'a' }, { to: 'b' }] } },
        { relations: { links: [] } }
      ];
      const avg = detector.averageLinks(packets);
      expect(avg).toBe(1);
    });

    test('should calculate max depth for trees', () => {
      const packets = [
        { id: 'root', relations: { children: ['c1'] } },
        { id: 'c1', relations: { children: ['c2'], parent: 'root' } },
        { id: 'c2', relations: { children: [], parent: 'c1' } }
      ];
      const depth = detector.maxTreeDepth(packets);
      expect(depth).toBe(3);
    });

    test('should get timestamp span', () => {
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

    test('should handle Map input', () => {
      const map = new Map([
        ['1', { value: 1 }],
        ['2', { value: 2 }]
      ]);
      const result = detector.detect(map);
      expect(typeof result).toBe('string');
    });

    test('should store last detection', () => {
      detector.detect([{ value: 1 }]);
      expect(detector.lastDetected).not.toBeNull();
      expect(detector.lastDetected).toHaveProperty('topology');
      expect(detector.lastDetected).toHaveProperty('confidence');
    });

    test('should return confidence scores', () => {
      const packets = [
        { relations: { children: [], links: [] } }
      ];
      const scores = detector.getConfidenceScores(packets);
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
      const packets = [];
      const scores = scorer.scoreAll(features, packets);
      
      expect(scores).toHaveProperty('nemosyne-tree-hierarchical');
      expect(scores).toHaveProperty('nemosyne-graph-force');
    });

    test('should calculate graph score', () => {
      const features = { hasGraphLinks: true, avgLinks: 2 };
      const score = scorer.scoreGraph(features);
      expect(score).toBeGreaterThan(0);
    });

    test('should calculate tree score', () => {
      const features = { hasHierarchy: true, maxTreeDepth: 3 };
      const score = scorer.scoreTree(features);
      expect(score).toBeGreaterThan(0);
    });

    test('should calculate timeline score', () => {
      const features = { hasTimestamps: true, timestampSpan: 86400000 };
      const score = scorer.scoreTimeline(features);
      expect(score).toBeGreaterThan(0);
    });

    test('should calculate geo score', () => {
      const features = { hasGeoData: true };
      const score = scorer.scoreGeo(features);
      expect(score).toBeGreaterThan(0);
    });

    test('should calculate scatter score', () => {
      const features = { hasEmbeddings: true };
      const score = scorer.scoreScatter(features);
      expect(score).toBeGreaterThan(0);
    });

    test('should calculate categorical score', () => {
      const features = { distinctCategories: 5 };
      const score = scorer.scoreCategorical(features);
      expect(score).toBeGreaterThan(0);
    });

    test('should calculate matrix score', () => {
      const features = { isMatrix: true };
      const score = scorer.scoreMatrix(features);
      expect(score).toBeGreaterThan(0);
    });

    test('should get weights', () => {
      const weights = scorer.getWeights('nemosyne-graph-force');
      expect(typeof weights).toBe('object');
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
      const custom = new ResearchTelemetry({
        enabled: false,
        exportFormat: 'csv'
      });
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

    test('should export data as CSV', () => {
      telemetry.exportFormat = 'csv';
      telemetry.logInteraction('click', 'n1');
      const data = telemetry.exportData();
      expect(typeof data).toBe('string');
      expect(data).toContain('click');
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

    test('should start and stop session', () => {
      telemetry.startSession();
      expect(telemetry.sessionStartTime).toBeGreaterThan(0);
      
      telemetry.stopSession();
      expect(telemetry.sessionEndTime).toBeGreaterThan(0);
    });

    test('should log error', () => {
      telemetry.logError('test-error', { message: 'oops' });
      expect(telemetry.metrics.errors.length).toBe(1);
    });

    test('should log performance', () => {
      telemetry.logPerformance('render', 100);
      expect(telemetry.metrics.performance.length).toBe(1);
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
      expect(mapper.colorScales.sequential).toBeDefined();
    });

    test('should accept custom color scales', () => {
      const custom = new PropertyMapper({
        colorScales: { custom: ['#fff'] }
      });
      expect(custom.colorScales.custom).toEqual(['#fff']);
    });

    test('should map geometry types', () => {
      expect(mapper.mapGeometry('point').primitive).toBe('sphere');
      expect(mapper.mapGeometry('vector').primitive).toBe('cone');
      expect(mapper.mapGeometry('tree').primitive).toBe('icosahedron');
      expect(mapper.mapGeometry('graph').primitive).toBe('sphere');
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

    test('should generate consistent colors for same value', () => {
      const color1 = mapper.categoricalColor('same', 'domain');
      const color2 = mapper.categoricalColor('same', 'domain');
      expect(color1).toBe(color2);
    });

    test('should generate ordinal color', () => {
      const color = mapper.ordinalColor(2, 'rank');
      expect(typeof color).toBe('string');
      expect(color).toMatch(/^#/);
    });

    test('should generate sequential color', () => {
      const color = mapper.sequentialColor(0.5);
      expect(typeof color).toBe('string');
      expect(color).toMatch(/^#/);
    });

    test('should interpolate colors', () => {
      const color = mapper.interpolateColor('#ff0000', '#0000ff', 0.5);
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

    test('should darken color', () => {
      const darkened = mapper.darken('#ffffff', 0.3);
      expect(typeof darkened).toBe('string');
    });

    test('should blend colors', () => {
      const blended = mapper.blendColors('#ff0000', '#0000ff', 0.5);
      expect(typeof blended).toBe('string');
    });

    test('should get color for value', () => {
      const color = mapper.getColorForValue(50, { min: 0, max: 100 }, 'continuous');
      expect(typeof color).toBe('string');
    });

    test('should add custom color scale', () => {
      mapper.addColorScale('custom', ['#fff', '#000']);
      expect(mapper.colorScales.custom).toEqual(['#fff', '#000']);
    });

    test('should remove color scale', () => {
      mapper.addColorScale('temp', ['#fff']);
      mapper.removeColorScale('temp');
      expect(mapper.colorScales.temp).toBeUndefined();
    });

    test('should get available color scales', () => {
      const scales = mapper.getAvailableColorScales();
      expect(Array.isArray(scales)).toBe(true);
      expect(scales).toContain('heatmap');
    });

    test('should validate color', () => {
      expect(mapper.isValidColor('#ff0000')).toBe(true);
      expect(mapper.isValidColor('invalid')).toBe(false);
    });

    test('should convert to RGB', () => {
      const rgb = mapper.toRGB('#ff0000');
      expect(rgb).toHaveProperty('r');
      expect(rgb).toHaveProperty('g');
      expect(rgb).toHaveProperty('b');
    });

    test('should convert to HSL', () => {
      const hsl = mapper.toHSL('#ff0000');
      expect(hsl).toHaveProperty('h');
      expect(hsl).toHaveProperty('s');
      expect(hsl).toHaveProperty('l');
    });
  });
});
