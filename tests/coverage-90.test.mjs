/**
 * Coverage Push Tests - Target 90%
 * Tests for uncovered lines in core modules
 */

import { jest } from '@jest/globals';
import { DataNativeEngine } from '../src/core/DataNativeEngine.js';
import { NemosyneDataPacket } from '../src/core/NemosyneDataPacket.js';
import { LayoutEngine } from '../src/core/LayoutEngine.js';
import { ResearchTelemetry } from '../src/core/ResearchTelemetry.js';
import { TopologyDetector } from '../src/core/TopologyDetector.js';
import { PropertyMapper } from '../src/core/PropertyMapper.js';

describe('Coverage Push - Module exports', () => {
  test('should have access to all core classes', () => {
    expect(DataNativeEngine).toBeDefined();
    expect(typeof DataNativeEngine).toBe('function');
    expect(NemosyneDataPacket).toBeDefined();
    expect(typeof NemosyneDataPacket).toBe('function');
    expect(LayoutEngine).toBeDefined();
    expect(typeof LayoutEngine).toBe('function');
    expect(ResearchTelemetry).toBeDefined();
    expect(typeof ResearchTelemetry).toBe('function');
    expect(TopologyDetector).toBeDefined();
    expect(typeof TopologyDetector).toBe('function');
    expect(PropertyMapper).toBeDefined();
    expect(typeof PropertyMapper).toBe('function');
  });
});

describe('Coverage Push - DataNativeEngine edge cases', () => {
  let engine;
  
  beforeEach(() => {
    engine = new DataNativeEngine({ debug: false });
  });

  test('should handle query with $exists operator', () => {
    engine.ingest(new NemosyneDataPacket({ 
      id: '1', 
      value: 100,
      metadata: { name: 'test' }
    }));
    engine.ingest(new NemosyneDataPacket({ 
      id: '2', 
      value: 200
    }));
    
    const withMetadata = engine.query({ metadata: { $exists: true } });
    expect(withMetadata).toHaveLength(1);
    expect(withMetadata[0].id).toBe('1');
    
    const withoutMetadata = engine.query({ metadata: { $exists: false } });
    expect(withoutMetadata).toHaveLength(1);
    expect(withoutMetadata[0].id).toBe('2');
  });

  test('should handle query with $in operator', () => {
    engine.ingest(new NemosyneDataPacket({ id: '1', category: 'A' }));
    engine.ingest(new NemosyneDataPacket({ id: '2', category: 'B' }));
    engine.ingest(new NemosyneDataPacket({ id: '3', category: 'C' }));
    
    const result = engine.query({ category: { $in: ['A', 'C'] } });
    expect(result).toHaveLength(2);
    expect(result.map(p => p.id)).toContain('1');
    expect(result.map(p => p.id)).toContain('3');
  });

  test('should handle query with $nin operator', () => {
    engine.ingest(new NemosyneDataPacket({ id: '1', category: 'A' }));
    engine.ingest(new NemosyneDataPacket({ id: '2', category: 'B' }));
    engine.ingest(new NemosyneDataPacket({ id: '3', category: 'C' }));
    
    const result = engine.query({ category: { $nin: ['A', 'C'] } });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  test('should handle query with $ne operator', () => {
    engine.ingest(new NemosyneDataPacket({ id: '1', value: 100 }));
    engine.ingest(new NemosyneDataPacket({ id: '2', value: 200 }));
    
    const result = engine.query({ value: { $ne: 100 } });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  test('should handle query with $gte and $lte operators', () => {
    engine.ingest(new NemosyneDataPacket({ id: '1', value: 50 }));
    engine.ingest(new NemosyneDataPacket({ id: '2', value: 100 }));
    engine.ingest(new NemosyneDataPacket({ id: '3', value: 150 }));
    
    const result = engine.query({ value: { $gte: 75, $lte: 125 } });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  test('should handle query with nested properties', () => {
    engine.ingest(new NemosyneDataPacket({ 
      id: '1', 
      metadata: { nested: { deep: 'value' } }
    }));
    
    const result = engine.query({ 'metadata.nested.deep': 'value' });
    expect(result).toHaveLength(1);
  });

  test('should handle empty query results', () => {
    engine.ingest(new NemosyneDataPacket({ id: '1', value: 100 }));
    
    const result = engine.query({ value: { $gt: 999 } });
    expect(result).toHaveLength(0);
  });

  test('should handle query with null values', () => {
    engine.ingest(new NemosyneDataPacket({ id: '1', value: null }));
    engine.ingest(new NemosyneDataPacket({ id: '2', value: 100 }));
    
    const result = engine.query({ value: null });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });
});

describe('Coverage Push - LayoutEngine edge cases', () => {
  test('should handle tree layout with single node', () => {
    const engine = new DataNativeEngine();
    engine.ingest(new NemosyneDataPacket({ id: 'root', value: 100 }));
    
    const positions = engine.layout('nemosyne-tree');
    expect(positions['root']).toBeDefined();
  });

  test('should handle force layout with disconnected nodes', () => {
    const engine = new DataNativeEngine();
    engine.ingest(new NemosyneDataPacket({ id: '1', value: 100 }));
    engine.ingest(new NemosyneDataPacket({ id: '2', value: 200 }));
    
    const positions = engine.layout('nemosyne-graph-force');
    expect(Object.keys(positions)).toHaveLength(2);
  });

  test('should handle scatter layout', () => {
    const engine = new DataNativeEngine();
    for (let i = 0; i < 5; i++) {
      engine.ingest(new NemosyneDataPacket({ id: `${i}`, x: i * 10, y: i * 20 }));
    }
    
    const positions = engine.layout('nemosyne-scatter');
    expect(Object.keys(positions)).toHaveLength(5);
  });

  test('should handle globe layout with geo data', () => {
    const engine = new DataNativeEngine();
    engine.ingest(new NemosyneDataPacket({ 
      id: '1', 
      lat: 51.5074, 
      lon: -0.1278 
    }));
    
    const positions = engine.layout('nemosyne-globe');
    expect(positions['1']).toBeDefined();
  });

  test('should handle matrix layout', () => {
    const engine = new DataNativeEngine();
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        engine.ingest(new NemosyneDataPacket({ id: `${i}-${j}`, row: i, col: j }));
      }
    }
    
    const positions = engine.layout('nemosyne-matrix');
    expect(Object.keys(positions)).toHaveLength(9);
  });
});

describe('Coverage Push - ResearchTelemetry edge cases', () => {
  test('should handle navigation tracking without camera', () => {
    const telemetry = new ResearchTelemetry();
    
    expect(() => {
      telemetry.trackNavigation(null);
    }).not.toThrow();
  });

  test('should handle task completion with edge times', () => {
    const telemetry = new ResearchTelemetry();
    
    telemetry.logTaskCompletion('quick-task', true, 1);
    telemetry.logTaskCompletion('long-task', true, 999999);
    
    const summary = telemetry.generateSummary();
    expect(summary.tasksCompleted).toBe(2);
  });

  test('should handle export with no data', () => {
    const telemetry = new ResearchTelemetry();
    const csv = telemetry.exportData('csv');
    expect(csv).toBeDefined();
    expect(typeof csv).toBe('string');
  });

  test('should clear all data', () => {
    const telemetry = new ResearchTelemetry();
    telemetry.logInteraction('click', 'test-id');
    telemetry.clear();
    
    const summary = telemetry.generateSummary();
    expect(summary.interactions).toBe(0);
  });
});

describe('Coverage Push - TopologyDetector edge cases', () => {
  test('should handle empty data', () => {
    const detector = new TopologyDetector();
    const topology = detector.detect([]);
    expect(topology).toBeDefined();
  });

  test('should handle hierarchical data', () => {
    const packets = [
      new NemosyneDataPacket({ id: 'root', value: 100 }),
      new NemosyneDataPacket({ id: 'child1', value: 50, parent: 'root' }),
      new NemosyneDataPacket({ id: 'child2', value: 50, parent: 'root' })
    ];
    
    const detector = new TopologyDetector();
    const topology = detector.detect(packets);
    expect(topology).toContain('tree');
  });

  test('should handle graph data with cycles', () => {
    const packets = [
      new NemosyneDataPacket({ 
        id: 'A', 
        relations: { links: [{ to: 'B' }] }
      }),
      new NemosyneDataPacket({ 
        id: 'B', 
        relations: { links: [{ to: 'A' }] }
      })
    ];
    
    const detector = new TopologyDetector();
    const topology = detector.detect(packets);
    expect(topology).toContain('graph');
  });

  test('should handle categorical data', () => {
    const packets = [
      new NemosyneDataPacket({ id: '1', category: 'A' }),
      new NemosyneDataPacket({ id: '2', category: 'B' }),
      new NemosyneDataPacket({ id: '3', category: 'A' })
    ];
    
    const detector = new TopologyDetector();
    const topology = detector.detect(packets);
    expect(topology).toContain('categorical');
  });
});

describe('Coverage Push - PropertyMapper edge cases', () => {
  test('should map color based on value', () => {
    const mapper = new PropertyMapper();
    const packet = new NemosyneDataPacket({ id: '1', value: 50 });
    
    const mapped = mapper.map(packet);
    expect(mapped.color).toBeDefined();
  });

  test('should map size based on value', () => {
    const mapper = new PropertyMapper();
    const packet = new NemosyneDataPacket({ id: '1', value: 100 });
    
    const mapped = mapper.map(packet);
    expect(mapped.size).toBeDefined();
  });

  test('should handle negative values', () => {
    const mapper = new PropertyMapper();
    const packet = new NemosyneDataPacket({ id: '1', value: -50 });
    
    const mapped = mapper.map(packet);
    expect(mapped).toBeDefined();
  });

  test('should handle zero values', () => {
    const mapper = new PropertyMapper();
    const packet = new NemosyneDataPacket({ id: '1', value: 0 });
    
    const mapped = mapper.map(packet);
    expect(mapped).toBeDefined();
  });

  test('should batch map multiple packets', () => {
    const mapper = new PropertyMapper();
    const packets = [
      new NemosyneDataPacket({ id: '1', value: 10 }),
      new NemosyneDataPacket({ id: '2', value: 20 }),
      new NemosyneDataPacket({ id: '3', value: 30 })
    ];
    
    const mapped = mapper.mapBatch(packets);
    expect(mapped).toHaveLength(3);
  });
});

describe('Coverage Push - Error handling', () => {
  test('should handle invalid layout type gracefully', () => {
    const engine = new DataNativeEngine();
    engine.ingest(new NemosyneDataPacket({ id: '1', value: 100 }));
    
    expect(() => {
      engine.layout('invalid-layout');
    }).not.toThrow();
  });

  test('should handle duplicate packet IDs', () => {
    const engine = new DataNativeEngine();
    engine.ingest(new NemosyneDataPacket({ id: 'same', value: 100 }));
    engine.ingest(new NemosyneDataPacket({ id: 'same', value: 200 }));
    
    const packets = engine.query({ id: 'same' });
    expect(packets.length).toBeGreaterThanOrEqual(1);
  });

  test('should handle circular references in data', () => {
    const packet = new NemosyneDataPacket({ id: '1', value: 100 });
    packet.metadata = { self: packet };
    
    expect(() => {
      const engine = new DataNativeEngine();
      engine.ingest(packet);
    }).not.toThrow();
  });
});

describe('Coverage Push - WebSocket edge cases', () => {
  test('should handle WebSocket connection without URL', () => {
    const engine = new DataNativeEngine({});
    
    expect(() => {
      engine.connectWebSocket();
    }).not.toThrow();
  });

  test('should handle WebSocket disconnect without connection', () => {
    const engine = new DataNativeEngine({});
    
    expect(() => {
      engine.disconnectWebSocket();
    }).not.toThrow();
  });
});
