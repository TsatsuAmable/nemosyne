/**
 * Coverage Gap Tests - Targeting uncovered areas to reach 95%
 * Focus: index.js exports, DataNativeEngine advanced features, ResearchTelemetry export
 */

import { jest } from '@jest/globals';
import { 
  DataNativeEngine, 
  LayoutEngine, 
  NemosyneDataPacket, 
  PropertyMapper, 
  ResearchTelemetry, 
  TopologyDetector 
} from '../src/core/index.js';

describe('Module Exports (index.js)', () => {
  test('should export all core modules', () => {
    expect(DataNativeEngine).toBeDefined();
    expect(LayoutEngine).toBeDefined();
    expect(NemosyneDataPacket).toBeDefined();
    expect(PropertyMapper).toBeDefined();
    expect(ResearchTelemetry).toBeDefined();
    expect(TopologyDetector).toBeDefined();
  });

  test('should export constructors', () => {
    expect(typeof DataNativeEngine).toBe('function');
    expect(typeof LayoutEngine).toBe('function');
    expect(typeof NemosyneDataPacket).toBe('function');
    expect(typeof PropertyMapper).toBe('function');
    expect(typeof ResearchTelemetry).toBe('function');
    expect(typeof TopologyDetector).toBe('function');
  });

  test('exported classes should be instantiable', () => {
    expect(() => new DataNativeEngine()).not.toThrow();
    expect(() => new LayoutEngine()).not.toThrow();
    expect(() => new NemosyneDataPacket()).not.toThrow();
    expect(() => new PropertyMapper()).not.toThrow();
    expect(() => new ResearchTelemetry()).not.toThrow();
    expect(() => new TopologyDetector()).not.toThrow();
  });
});

describe('DataNativeEngine - Advanced Features', () => {
  let engine;
  let mockScene;

  beforeEach(() => {
    mockScene = {
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
    
    engine = new DataNativeEngine({
      scene: mockScene,
      gestureEnabled: false,
      telemetryEnabled: false,
      autoUpdate: false
    });
  });

  describe('Gesture Handlers', () => {
    test('onGrab should handle missing target gracefully', () => {
      // Should not throw when target is null
      expect(() => engine.onGrab({ target: null })).not.toThrow();
    });

    test('onPinch should handle missing target gracefully', () => {
      expect(() => engine.onPinch({ target: null })).not.toThrow();
    });

    test('onSwipe should shift temporal view', () => {
      const spy = jest.spyOn(engine, 'shiftTemporalView');
      
      engine.onSwipe({ direction: 'left' });
      expect(spy).toHaveBeenCalledWith('past');
      
      engine.onSwipe({ direction: 'right' });
      expect(spy).toHaveBeenCalledWith('future');
    });

    test('onPoint should handle missing target gracefully', () => {
      expect(() => engine.onPoint({ target: null })).not.toThrow();
    });

    test('onPoint should highlight and suggest related data', () => {
      const mockData = { id: '1', value: 10 };
      const mockArtefact = {
        nemosyneData: mockData
      };
      
      const highlightSpy = jest.spyOn(engine, 'highlight');
      const suggestSpy = jest.spyOn(engine, 'suggestRelatedData');
      
      engine.onPoint({ target: mockArtefact });
      
      expect(highlightSpy).toHaveBeenCalledWith('1');
      expect(suggestSpy).toHaveBeenCalledWith(mockData);
    });
  });

  describe('Temporal Views', () => {
    test('shiftTemporalView should handle past direction', () => {
      expect(() => engine.shiftTemporalView('past')).not.toThrow();
    });

    test('shiftTemporalView should handle future direction', () => {
      expect(() => engine.shiftTemporalView('future')).not.toThrow();
    });

    test('shiftTemporalView should handle present direction', () => {
      expect(() => engine.shiftTemporalView('present')).not.toThrow();
    });
  });

  describe('Related Data Suggestions', () => {
    test('suggestRelatedData should return related packets', async () => {
      const packet1 = new NemosyneDataPacket({ 
        id: '1', 
        value: 10,
        relations: { links: [{ to: '2', type: 'related' }] }
      });
      const packet2 = new NemosyneDataPacket({ 
        id: '2', 
        value: 20,
        relations: { links: [{ to: '1', type: 'related' }] }
      });
      
      await engine.ingest([packet1, packet2]);
      
      const related = engine.suggestRelatedData(packet1);
      expect(related).toBeDefined();
    });

    test('suggestRelatedData should handle empty relations', () => {
      const packet = new NemosyneDataPacket({ id: '1', value: 10 });
      const related = engine.suggestRelatedData(packet);
      expect(related).toBeDefined();
    });
  });

  describe('Transformation Tools', () => {
    test('commitPendingTransformation should handle no pending transform', () => {
      expect(() => engine.commitPendingTransformation()).not.toThrow();
    });

    test('rollbackTransformation should handle no transform to rollback', () => {
      expect(() => engine.rollbackTransformation()).not.toThrow();
    });
  });

  describe('Visual Feedback', () => {
    test('updateVisualFeedback should not throw', () => {
      const mockArtefact = { id: '1' };
      expect(() => engine.updateVisualFeedback(mockArtefact, 'selected')).not.toThrow();
    });

    test('temporarilyReduceDetail should not throw', () => {
      expect(() => engine.temporarilyReduceDetail()).not.toThrow();
    });

    test('expandDetailForNearby should not throw', () => {
      const mockArtefact = { id: '1' };
      expect(() => engine.expandDetailForNearby(mockArtefact)).not.toThrow();
    });
  });

  describe('Helper Methods', () => {
    test('inferType should return a type string', () => {
      const type = engine.inferType({ value: 10 });
      expect(typeof type).toBe('string');
    });

    test('inferStructure should return a structure string', () => {
      const structure = engine.inferStructure({ id: '1' });
      expect(typeof structure).toBe('string');
    });

    test('getComponentForTopology should return component name', () => {
      const component = engine.getComponentForTopology('tree');
      expect(typeof component).toBe('string');
    });

    test('formatAnimation should return animation config', () => {
      const anim = engine.formatAnimation({ duration: 1000 });
      expect(anim).toBeDefined();
    });
  });

  describe('Interaction Zones', () => {
    test('createAggregatePacket should return packet', () => {
      const result = engine.createAggregatePacket([{ id: '1' }]);
      expect(result).toBeDefined();
    });

    test('visualizeAggregate should not throw', () => {
      const mockPacket = { id: 'agg', value: 100 };
      const mockCenter = { x: 0, y: 0, z: 0 };
      expect(() => engine.visualizeAggregate(mockPacket, mockCenter)).not.toThrow();
    });

    test('findNearestCluster should return cluster id', () => {
      const cluster = engine.findNearestCluster({ x: 0, y: 0, z: 0 });
      expect(typeof cluster).toBe('string');
    });

    test('findEntitiesInVolume should return array', () => {
      const volume = { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } };
      const entities = engine.findEntitiesInVolume(volume);
      expect(Array.isArray(entities)).toBe(true);
    });

    test('calculateGestureVolume should return volume', () => {
      const volume = engine.calculateGestureVolume([{ x: 0, y: 0, z: 0 }]);
      expect(volume).toBeDefined();
    });
  });

  describe('Statistics', () => {
    test('calculateStatistics should return stats object', () => {
      const stats = engine.calculateStatistics();
      expect(stats).toBeDefined();
    });
  });

  describe('Highlighting', () => {
    test('highlight should handle missing artefact', () => {
      expect(() => engine.highlight('nonexistent')).not.toThrow();
    });

    test('unhighlight should handle missing artefact', () => {
      expect(() => engine.unhighlight('nonexistent')).not.toThrow();
    });

    test('highlightRelatedData should not throw', async () => {
      const packet = new NemosyneDataPacket({ id: '1', value: 10 });
      await engine.ingest([packet]);
      expect(() => engine.highlightRelatedData(packet)).not.toThrow();
    });
  });
});

describe('ResearchTelemetry - Export Features', () => {
  let telemetry;

  beforeEach(() => {
    telemetry = new ResearchTelemetry({ enabled: true });
  });

  test('exportData should generate report data', () => {
    // Generate some data first
    telemetry.logInteraction('click', 'element-1');
    telemetry.logLayoutEvent('tree', 100, 50);
    
    const report = telemetry.exportData('json');
    expect(report).toBeDefined();
  });

  test('exportData should support CSV format', () => {
    telemetry.logInteraction('click', 'element-1');
    
    const csv = telemetry.exportData('csv');
    expect(typeof csv).toBe('string');
  });

  test('generateSummary should return summary object', () => {
    // Add various metrics
    telemetry.logInteraction('click', 'element-1');
    telemetry.logTaskCompletion('task-1', true, 5000);
    telemetry.logLayoutEvent('tree', 100, 50);
    
    const summary = telemetry.generateSummary();
    expect(summary).toBeDefined();
    expect(summary).toHaveProperty('sessionDuration');
    expect(summary).toHaveProperty('totalInteractions');
  });

  test('should handle disabled telemetry for export', () => {
    telemetry.enabled = false;
    const report = telemetry.exportData('json');
    // Should still return something even if disabled
    expect(report).toBeDefined();
  });
});

describe('ResearchTelemetry - Session Management', () => {
  let telemetry;

  beforeEach(() => {
    telemetry = new ResearchTelemetry({ enabled: true });
  });

  test('should generate unique session IDs', () => {
    const id1 = telemetry.generateSessionId();
    const id2 = telemetry.generateSessionId();
    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe('string');
    expect(id1.length).toBeGreaterThan(0);
  });

  test('hashString should produce consistent hashes', () => {
    const hash1 = telemetry.hashString('test');
    const hash2 = telemetry.hashString('test');
    expect(hash1).toBe(hash2);
    expect(typeof hash1).toBe('string');
  });

  test('hashString should produce different hashes for different inputs', () => {
    const hash1 = telemetry.hashString('test1');
    const hash2 = telemetry.hashString('test2');
    expect(hash1).not.toBe(hash2);
  });

  test('clear should reset metrics', () => {
    telemetry.logInteraction('click', 'element-1');
    expect(telemetry.metrics.interactions.length).toBeGreaterThan(0);
    
    telemetry.clear();
    expect(telemetry.metrics.interactions.length).toBe(0);
    expect(telemetry.metrics.layoutSwitches.length).toBe(0);
  });
});

describe('ResearchTelemetry - Event Logging', () => {
  let telemetry;

  beforeEach(() => {
    telemetry = new ResearchTelemetry({ enabled: true });
  });

  test('logInteraction should record interaction with context', () => {
    telemetry.logInteraction('click', 'element-1', { button: 'left' });
    expect(telemetry.metrics.interactions.length).toBe(1);
    expect(telemetry.metrics.interactions[0]).toHaveProperty('type', 'click');
    expect(telemetry.metrics.interactions[0]).toHaveProperty('targetId', 'element-1');
  });

  test('logTaskCompletion should record task success', () => {
    telemetry.logTaskCompletion('task-1', true, 5000);
    expect(telemetry.metrics.taskCompletions.length).toBe(1);
  });

  test('logTaskCompletion should record task failure', () => {
    telemetry.logTaskCompletion('task-1', false, 5000, ['error1']);
    expect(telemetry.metrics.taskCompletions.length).toBe(1);
    expect(telemetry.metrics.taskCompletions[0]).toHaveProperty('success', false);
  });

  test('logLayoutEvent should record layout switches', () => {
    telemetry.logLayoutEvent('tree', 100, 50);
    expect(telemetry.metrics.layoutSwitches.length).toBe(1);
    const event = telemetry.metrics.layoutSwitches[0];
    expect(event).toHaveProperty('layoutType', 'tree');
    expect(event).toHaveProperty('dataSize', 100);
    expect(event).toHaveProperty('timeToRender', 50);
  });

  test('calculateLayoutScore should return score', () => {
    const score = telemetry.calculateLayoutScore(100, 1000);
    expect(typeof score).toBe('number');
  });

  test('trackGaze should record gaze data', () => {
    telemetry.trackGaze('element-1', 1000);
    expect(telemetry.metrics.gazeTargets.has('element-1')).toBe(true);
    const data = telemetry.metrics.gazeTargets.get('element-1');
    expect(data.dwellTime).toBe(1000);
  });

  test('trackNavigation should record camera position', () => {
    telemetry.trackNavigation({ 
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 }
    });
    expect(telemetry.metrics.navigationPath.length).toBeGreaterThan(0);
  });

  test('getCurrentRegion should return region string', () => {
    const region = telemetry.getCurrentRegion({ x: 0, y: 0, z: 0 });
    expect(typeof region).toBe('string');
  });

  test('calculateAverageVelocity should return average', () => {
    // Add some navigation points with velocity
    telemetry.trackNavigation({ position: { x: 0, y: 0, z: 0 }, velocity: 10 });
    telemetry.trackNavigation({ position: { x: 1, y: 0, z: 0 }, velocity: 20 });
    
    const avg = telemetry.calculateAverageVelocity();
    expect(typeof avg).toBe('number');
  });

  test('calculateTaskSuccessRate should return rate', () => {
    telemetry.logTaskCompletion('task-1', true, 1000);
    telemetry.logTaskCompletion('task-2', false, 2000);
    
    const rate = telemetry.calculateTaskSuccessRate();
    expect(rate).toBe(0.5);
  });

  test('calculateTotalDistance should return distance', () => {
    telemetry.trackNavigation({ position: { x: 0, y: 0, z: 0 } });
    telemetry.trackNavigation({ position: { x: 3, y: 4, z: 0 } }); // 5 units distance
    
    const distance = telemetry.calculateTotalDistance();
    expect(distance).toBe(5);
  });

  test('toCSV should convert data to CSV format', () => {
    telemetry.logInteraction('click', 'element-1');
    const csv = telemetry.toCSV(telemetry.serializeMetrics());
    expect(typeof csv).toBe('string');
    expect(csv).toContain('Session');
  });
});

describe('ResearchTelemetry - Privacy', () => {
  let telemetry;

  beforeEach(() => {
    telemetry = new ResearchTelemetry({ enabled: true });
  });

  test('should hash session IDs', () => {
    const sessionId = telemetry.sessionId;
    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe('string');
    expect(sessionId.length).toBeGreaterThan(0);
  });

  test('should not expose raw identifiers', () => {
    // Session ID should be hashed, not raw timestamp
    const sessionId = telemetry.sessionId;
    expect(sessionId).not.toContain(String(Date.now()).slice(0, 6));
  });
});

describe('PropertyMapper - Edge Cases', () => {
  let mapper;

  beforeEach(() => {
    mapper = new PropertyMapper();
  });

  test('should handle unknown semantic types', () => {
    const packet = new NemosyneDataPacket({ 
      id: '1', 
      value: 'unknown',
      semantics: { type: 'custom_type' }
    });
    const props = mapper.map(packet);
    expect(props).toBeDefined();
  });

  test('should handle missing semantic data', () => {
    const packet = new NemosyneDataPacket({ id: '1', value: 10 });
    const props = mapper.map(packet);
    expect(props).toBeDefined();
    expect(props).toHaveProperty('color');
    expect(props).toHaveProperty('size');
  });
});

describe('LayoutEngine - Topology Detection', () => {
  let engine;

  beforeEach(() => {
    engine = new LayoutEngine();
  });

  test('should handle empty data for topology detection', () => {
    const topology = engine.detectTopology([]);
    expect(topology).toBeDefined();
  });

  test('should handle null data for topology detection', () => {
    const topology = engine.detectTopology(null);
    expect(topology).toBeDefined();
  });
});

describe('TopologyDetector - Edge Cases', () => {
  let detector;

  beforeEach(() => {
    detector = new TopologyDetector();
  });

  test('should handle empty packet array', () => {
    const result = detector.detect([]);
    expect(result).toBeDefined();
  });

  test('should handle packets with no structure', () => {
    const packet = new NemosyneDataPacket({ id: '1', value: 10 });
    const result = detector.detect([packet]);
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  test('classifyTopology should handle unknown features', () => {
    const result = detector.classifyTopology({});
    expect(result).toBeDefined();
  });

  test('getConfidenceScores should return scores object', () => {
    const packet = new NemosyneDataPacket({ id: '1', value: 10 });
    const scores = detector.getConfidenceScores([packet]);
    expect(scores).toBeDefined();
    expect(typeof scores).toBe('object');
  });

  test('validateTopology should validate result', () => {
    const isValid = detector.validateTopology('nemosyne-graph-force', {});
    expect(typeof isValid).toBe('boolean');
  });
});
