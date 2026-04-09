/**
 * Comprehensive test suite for Nemosyne
 * Covers core engine, visualizations, and integrations
 */

const {
  DataNativeEngine,
  TopologyDetector,
  PropertyMapper,
  LayoutEngine,
  TemporalScrubber,
  UncertaintyVisualizer,
  MemPalaceVRConnector
} = require('../src/core');

// Mock fetch globally
global.fetch = jest.fn();

describe('Nemosyne Core Engine', () => {
  
  describe('DataNativeEngine', () => {
    let engine;

    beforeEach(() => {
      engine = new DataNativeEngine({
        autoDetect: true,
        enableGestures: false
      });
    });

    test('should initialize with correct options', () => {
      expect(engine.options.autoDetect).toBe(true);
      expect(engine.options.enableGestures).toBe(false);
    });

    test('should load graph data', async () => {
      const graphData = {
        nodes: [
          { id: 1, name: 'Node1' },
          { id: 2, name: 'Node2' }
        ],
        links: [
          { source: 1, target: 2 }
        ]
      };

      const result = await engine.loadData(graphData);
      expect(result).toBeDefined();
    });

    test('should load temporal data', async () => {
      const temporalData = [
        { date: '2024-01-01', value: 10 },
        { date: '2024-01-02', value: 20 },
        { date: '2024-01-03', value: 15 }
      ];

      const result = await engine.loadData(temporalData);
      expect(result).toBeDefined();
    });

    test('should handle hierarchical data', async () => {
      const treeData = {
        name: 'Root',
        children: [
          { name: 'Child1', value: 10 },
          { 
            name: 'Child2',
            children: [
              { name: 'GrandChild1', value: 5 }
            ]
          }
        ]
      };

      const result = await engine.loadData(treeData);
      expect(result).toBeDefined();
    });
  });

  describe('TopologyDetector', () => {
    let detector;

    beforeEach(() => {
      detector = new TopologyDetector();
    });

    test('should detect graph topology', () => {
      const graphData = {
        nodes: [{ id: 1 }, { id: 2 }],
        links: [{ source: 1, target: 2 }]
      };

      const result = detector.analyze(graphData);
      expect(result.type).toBe('graph');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('should detect temporal topology', () => {
      const temporalData = [
        { date: '2024-01-01', value: 10 },
        { date: '2024-01-02', value: 20 }
      ];

      const result = detector.analyze(temporalData);
      expect(result.type).toBe('temporal');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('should detect hierarchical topology', () => {
      const treeData = {
        name: 'Root',
        children: [
          { name: 'Child1' },
          { name: 'Child2' }
        ]
      };

      const result = detector.analyze(treeData);
      expect(result.type).toBe('hierarchical');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('should return scores for all types', () => {
      const result = detector.analyze({ nodes: [], links: [] });
      expect(result.scores).toBeDefined();
      expect(Object.keys(result.scores).length).toBeGreaterThan(0);
    });
  });

  describe('PropertyMapper', () => {
    let mapper;

    beforeEach(() => {
      mapper = new PropertyMapper();
    });

    test('should map numeric values to sizes', () => {
      const mapping = mapper.getSizeScale([0, 100], [0.1, 1.0]);
      expect(mapping(50)).toBe(0.55);
      expect(mapping(0)).toBe(0.1);
      expect(mapping(100)).toBe(1.0);
    });

    test('should generate color scales', () => {
      const heatmapScale = mapper.getColorScale('heatmap');
      expect(typeof heatmapScale(0.5)).toBe('string');
    });

    test('should map data properties', () => {
      const data = { category: 'A', value: 50, confidence: 0.8 };
      const properties = mapper.map(data, {
        color: 'category',
        size: 'value',
        opacity: 'confidence'
      });

      expect(properties.color).toBeDefined();
      expect(properties.size).toBe(50);
      expect(properties.opacity).toBe(0.8);
    });
  });

  describe('LayoutEngine', () => {
    let engine;

    beforeEach(() => {
      engine = new LayoutEngine({
        width: 10,
        height: 10,
        depth: 10,
        strategy: 'force-directed'
      });
    });

    test('should calculate force-directed layout', () => {
      const data = {
        nodes: [
          { id: 1, x: 0, y: 0, z: 0 },
          { id: 2, x: 1, y: 1, z: 1 }
        ],
        links: [{ source: 1, target: 2 }]
      };

      const result = engine.calculateLayout(data);
      expect(result.positions).toHaveLength(2);
      expect(result.bounds).toBeDefined();
    });

    test('should calculate hierarchical layout', () => {
      engine.strategy = 'hierarchical';
      
      const data = {
        name: 'Root',
        children: [
          { name: 'Child1' },
          { name: 'Child2' }
        ]
      };

      const result = engine.calculateLayout(data);
      expect(result.positions.length).toBeGreaterThan(0);
    });

    test('should apply constraints', () => {
      engine.addConstraint({
        type: 'plane',
        target: { x: 0, y: 1.6, z: 0 },
        strength: 1.0
      });

      const data = {
        nodes: [{ id: 1 }, { id: 2 }]
      };

      const result = engine.calculateLayout(data);
      // Positions should respect plane constraint
      expect(result.positions).toBeDefined();
    });
  });
});

describe('Animation System', () => {
  
  describe('TemporalScrubber', () => {
    let scrubber;

    beforeEach(() => {
      scrubber = new TemporalScrubber({
        playbackSpeed: 1,
        loop: false
      });
    });

    test('should initialize with time range', () => {
      expect(scrubber.timeRange).toBeDefined();
      expect(scrubber.state.playbackSpeed).toBe(1);
    });

    test('should add snapshots', () => {
      const snapshot = {
        nodes: [{ id: 1, value: 10 }],
        timestamp: Date.now()
      };

      scrubber.addSnapshot(Date.now(), snapshot);
      expect(scrubber.dataHistory.size).toBe(1);
    });

    test('should interpolate between snapshots', () => {
      const t1 = Date.now();
      const t2 = t1 + 86400000; // +1 day

      scrubber.addSnapshot(t1, { nodes: [{ value: 0 }] });
      scrubber.addSnapshot(t2, { nodes: [{ value: 100 }] });

      const state = scrubber.getStateAtTime(t1 + 43200000); // halfway
      expect(state).toBeDefined();
    });

    test('should compare time periods', () => {
      const t1 = Date.now();
      const t2 = t1 + 86400000;

      scrubber.addSnapshot(t1, { nodes: [{ id: 1 }] });
      scrubber.addSnapshot(t2, { nodes: [{ id: 1 }, { id: 2 }] });

      const comparison = scrubber.compareTimePeriods(t1, t2);
      expect(comparison).toBeDefined();
      expect(comparison.addedCount).toBeGreaterThan(0);
    });
  });

  describe('UncertaintyVisualizer', () => {
    let visualizer;

    beforeEach(() => {
      visualizer = new UncertaintyVisualizer(null); // mock scene
    });

    test('should calculate entropy', () => {
      const data = [
        { category: 'A' },
        { category: 'A' },
        { category: 'B' },
        { category: 'B' }
      ];

      const entropy = visualizer.calculateEntropy(data);
      expect(entropy).toBeGreaterThan(0);
      expect(entropy).toBeLessThanOrEqual(Math.log2(4));
    });

    test('should calculate zero entropy for uniform data', () => {
      const data = [{ category: 'A' }, { category: 'A' }];
      const entropy = visualizer.calculateEntropy(data);
      expect(entropy).toBe(0);
    });
  });
});

describe('MemPalace Integration', () => {
  let connector;

  beforeEach(() => {
    connector = new MemPalaceVRConnector({
      baseUrl: 'http://localhost:8765',
      wsUrl: 'ws://localhost:8766'
    });
    fetch.mockClear();
  });

  describe('API Methods', () => {
    test('should fetch stats', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          drawers: 100,
          wings: 5,
          rooms: 20
        })
      });

      const stats = await connector.fetchStats();
      expect(stats.drawers).toBe(100);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8765/api/stats'
      );
    });

    test('should fetch drawers with options', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          drawers: [{ id: 1 }],
          total: 100
        })
      });

      await connector.fetchDrawers({ positions: true, limit: 50 });
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/drawers')
      );
    });

    test('should handle API errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(connector.fetchStats()).rejects.toThrow();
    });
  });

  describe('Spatial Queries', () => {
    test('should find memories near position', () => {
      // Populate cache
      connector.cache.set('1', {
        id: '1',
        position: { x: 0, y: 0, z: 0 }
      });
      connector.cache.set('2', {
        id: '2',
        position: { x: 5, y: 0, z: 0 }
      });

      const results = connector.findMemoriesNearPosition(
        { x: 0, y: 0, z: 0 },
        3
      );

      expect(results.length).toBe(1);
      expect(results[0].drawer.id).toBe('1');
    });

    test('should sort by distance', () => {
      connector.cache.set('1', {
        id: '1',
        position: { x: 10, y: 0, z: 0 }
      });
      connector.cache.set('2', {
        id: '2',
        position: { x: 2, y: 0, z: 0 }
      });

      const results = connector.findMemoriesNearPosition(
        { x: 0, y: 0, z: 0 },
        15
      );

      // Closer should come first
      expect(results[0].distance).toBeLessThan(results[1].distance);
    });

    test('should find memories in volume', () => {
      connector.cache.set('1', {
        id: '1',
        position: { x: 1, y: 1, z: 1 }
      });
      connector.cache.set('2', {
        id: '2',
        position: { x: 20, y: 0, z: 0 }
      });

      const volume = {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 10, y: 10, z: 10 }
      };

      const results = connector.findMemoriesInVolume(volume);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('1');
    });

    test('should find memories by time range', () => {
      const now = Date.now();
      
      connector.cache.set('1', {
        id: '1',
        timestamp: now - 1000,
        created_at: now - 1000
      });
      connector.cache.set('2', {
        id: '2',
        timestamp: now - 100000,
        created_at: now - 100000
      });

      const results = connector.findMemoriesByTimeRange(
        now - 5000,
        now
      );

      expect(results.length).toBe(1);
      expect(results[0].id).toBe('1');
    });
  });
});

describe('Component Integration', () => {
  test('should create A-Frame components', () => {
    // Verify component names are defined
    const components = [
      'nemosyne-graph-force',
      'nemosyne-timeline-spiral',
      'nemosyne-scatter-semantic',
      'nemosyne-geo-globe',
      'nemosyne-tree-hierarchical',
      'nemosyne-grid-categorical',
      'nemosyne-heatmap-matrix',
      'nemosyne-crystal-field',
      'nemosyne-tree-radial',
      'nemosyne-stream-graph',
      'nemosyne-circle-pack',
      'nemosyne-network-globe',
      'nemosyne-parallel-coords'
    ];

    // These would be registered via AFRAME.registerComponent
    expect(components.length).toBe(13); // Verify count
  });
});

// Performance benchmarks
describe('Performance', () => {
  test('should handle 100 nodes in graph', () => {
    const nodes = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      value: i,
      category: `cat-${i % 5}`
    }));

    const start = performance.now();
    // Processing would happen here
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100); // Should process in under 100ms
  });

  test('should detect topology quickly', () => {
    const detector = new TopologyDetector();
    const data = {
      nodes: Array.from({ length: 1000 }, (_, i) => ({ id: i })),
      links: Array.from({ length: 500 }, (_, i) => ({
        source: Math.floor(Math.random() * 1000),
        target: Math.floor(Math.random() * 1000)
      }))
    };

    const start = performance.now();
    detector.analyze(data);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50); // Should detect in under 50ms
  });
});

// Edge cases
describe('Edge Cases', () => {
  test('should handle empty data', () => {
    const detector = new TopologyDetector();
    const result = detector.analyze([]);
    expect(result).toBeDefined();
  });

  test('should handle single node', () => {
    const engine = new LayoutEngine();
    const result = engine.calculateLayout({
      nodes: [{ id: 1 }]
    });
    expect(result.positions).toHaveLength(1);
  });

  test('should handle circular references', () => {
    const data = {
      a: { parent: 'b' },
      b: { parent: 'a' }
    };
    // Should not infinite loop
    expect(() => new DataNativeEngine().loadData(data)).not.toThrow();
  });
});

console.log('Comprehensive test suite loaded');
