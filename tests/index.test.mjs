/**
 * Index.js Tests for Nemosyne
 * Tests that all core modules are properly exported
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

describe('Index Exports', () => {
  test('should export DataNativeEngine', () => {
    expect(DataNativeEngine).toBeDefined();
    expect(typeof DataNativeEngine).toBe('function');
    // Verify it's a class constructor
    const instance = new DataNativeEngine({
      scene: {
        appendChild: jest.fn(),
        querySelectorAll: jest.fn(() => [])
      },
      gestureEnabled: false,
      telemetryEnabled: false,
      autoUpdate: false
    });
    expect(instance).toBeInstanceOf(DataNativeEngine);
  });

  test('should export LayoutEngine', () => {
    expect(LayoutEngine).toBeDefined();
    expect(typeof LayoutEngine).toBe('function');
    const instance = new LayoutEngine();
    expect(instance).toBeInstanceOf(LayoutEngine);
  });

  test('should export NemosyneDataPacket', () => {
    expect(NemosyneDataPacket).toBeDefined();
    expect(typeof NemosyneDataPacket).toBe('function');
    const instance = new NemosyneDataPacket({ id: 'test', value: 10 });
    expect(instance).toBeInstanceOf(NemosyneDataPacket);
    expect(instance.id).toBe('test');
    expect(instance.value).toBe(10);
  });

  test('should export PropertyMapper', () => {
    expect(PropertyMapper).toBeDefined();
    expect(typeof PropertyMapper).toBe('function');
    const instance = new PropertyMapper();
    expect(instance).toBeInstanceOf(PropertyMapper);
  });

  test('should export ResearchTelemetry', () => {
    expect(ResearchTelemetry).toBeDefined();
    expect(typeof ResearchTelemetry).toBe('function');
    const instance = new ResearchTelemetry();
    expect(instance).toBeInstanceOf(ResearchTelemetry);
  });

  test('should export TopologyDetector', () => {
    expect(TopologyDetector).toBeDefined();
    expect(typeof TopologyDetector).toBe('function');
    const instance = new TopologyDetector();
    expect(instance).toBeInstanceOf(TopologyDetector);
  });

  test('DataNativeEngine should have expected methods', () => {
    const instance = new DataNativeEngine({
      scene: {
        appendChild: jest.fn(),
        querySelectorAll: jest.fn(() => [])
      },
      gestureEnabled: false,
      telemetryEnabled: false,
      autoUpdate: false
    });
    
    // Core methods
    expect(typeof instance.ingest).toBe('function');
    expect(typeof instance.normalizeData).toBe('function');
    expect(typeof instance.getDataPacket).toBe('function');
    expect(typeof instance.getAllDataPackets).toBe('function');
    expect(typeof instance.updateData).toBe('function');
    expect(typeof instance.removeData).toBe('function');
    expect(typeof instance.clear).toBe('function');
    
    // Selection methods
    expect(typeof instance.select).toBe('function');
    expect(typeof instance.addToSelection).toBe('function');
    expect(typeof instance.removeFromSelection).toBe('function');
    expect(typeof instance.toggleSelection).toBe('function');
    expect(typeof instance.clearSelection).toBe('function');
    expect(typeof instance.getSelectedPackets).toBe('function');
    
    // Query methods
    expect(typeof instance.filter).toBe('function');
    expect(typeof instance.query).toBe('function');
    expect(typeof instance.sortBy).toBe('function');
    expect(typeof instance.groupBy).toBe('function');
    
    // Export methods
    expect(typeof instance.toJSON).toBe('function');
    expect(typeof instance.fromJSON).toBe('function');
    expect(typeof instance.toCSV).toBe('function');
  });

  test('LayoutEngine should have expected methods', () => {
    const instance = new LayoutEngine();
    
    expect(typeof instance.calculatePositions).toBe('function');
    expect(typeof instance.forceDirectedLayout).toBe('function');
    expect(typeof instance.treeLayout).toBe('function');
    expect(typeof instance.spiralTimelineLayout).toBe('function');
    expect(typeof instance.linearTimelineLayout).toBe('function');
    expect(typeof instance.scatterLayout).toBe('function');
    expect(typeof instance.globeLayout).toBe('function');
    expect(typeof instance.categoricalGridLayout).toBe('function');
    expect(typeof instance.matrixLayout).toBe('function');
    expect(typeof instance.sphericalLayout).toBe('function');
  });

  test('TopologyDetector should have expected methods', () => {
    const instance = new TopologyDetector();
    
    expect(typeof instance.detect).toBe('function');
    expect(typeof instance.extractFeatures).toBe('function');
    expect(typeof instance.getConfidenceScores).toBe('function');
    expect(typeof instance.getDescription).toBe('function');
  });

  test('PropertyMapper should have expected methods', () => {
    const instance = new PropertyMapper();
    
    expect(typeof instance.map).toBe('function');
    expect(typeof instance.autoMap).toBe('function');
    expect(typeof instance.mapGeometry).toBe('function');
    expect(typeof instance.mapColor).toBe('function');
    expect(typeof instance.mapEmissive).toBe('function');
    expect(typeof instance.mapScale).toBe('function');
    expect(typeof instance.mapOpacity).toBe('function');
  });

  test('NemosyneDataPacket should have expected methods', () => {
    const instance = new NemosyneDataPacket({ id: 'test', value: 10 });
    
    expect(typeof instance.updateValue).toBe('function');
    expect(typeof instance.transform).toBe('function');
    expect(typeof instance.toJSON).toBe('function');
    expect(typeof instance.addLink).toBe('function');
    expect(typeof instance.computeVisualHash).toBe('function');
  });

  test('ResearchTelemetry should have expected methods', () => {
    const instance = new ResearchTelemetry();
    
    expect(typeof instance.trackNavigation).toBe('function');
    expect(typeof instance.trackGaze).toBe('function');
    expect(typeof instance.logInteraction).toBe('function');
    expect(typeof instance.logLayoutEvent).toBe('function');
    expect(typeof instance.logTaskCompletion).toBe('function');
    expect(typeof instance.exportData).toBe('function');
    expect(typeof instance.generateSummary).toBe('function');
  });

  test('should handle module interdependencies', () => {
    // Create instances and verify they can work together
    const detector = new TopologyDetector();
    const mapper = new PropertyMapper();
    const layout = new LayoutEngine();
    
    // Create test packets
    const packets = [
      new NemosyneDataPacket({ id: '1', value: 10 }),
      new NemosyneDataPacket({ id: '2', value: 20 })
    ];
    
    // Verify detector works with packets
    const topology = detector.detect(packets);
    expect(typeof topology).toBe('string');
    
    // Verify mapper works with packets
    packets.forEach(packet => {
      const props = mapper.map(packet);
      expect(props).toBeDefined();
    });
    
    // Verify layout engine works with packets
    const positions = layout.calculatePositions(packets, topology);
    expect(positions).toBeInstanceOf(Map);
  });

  test('all exports should be distinct classes', () => {
    // Verify each export is a different constructor
    const constructors = [
      DataNativeEngine,
      LayoutEngine,
      NemosyneDataPacket,
      PropertyMapper,
      ResearchTelemetry,
      TopologyDetector
    ];
    
    // Check they're all functions
    constructors.forEach(ctor => {
      expect(typeof ctor).toBe('function');
    });
    
    // Check they're all different
    const uniqueCtors = new Set(constructors);
    expect(uniqueCtors.size).toBe(constructors.length);
  });
});
