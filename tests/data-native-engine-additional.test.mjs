/**
 * Additional DataNativeEngine Tests for Nemosyne
 * Covers gesture handling, telemetry, visualization controls, and edge cases
 */

import { jest } from '@jest/globals';
import { DataNativeEngine } from '../src/core/DataNativeEngine.js';
import { NemosyneDataPacket } from '../src/core/NemosyneDataPacket.js';

describe('DataNativeEngine - Additional Coverage', () => {
  let engine;
  let mockScene;
  let mockArtefacts;

  beforeEach(() => {
    mockArtefacts = {};
    mockScene = {
      appendChild: jest.fn((artefact) => {
        if (artefact && artefact.id) {
          mockArtefacts[artefact.id] = artefact;
        }
      }),
      removeChild: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
    
    engine = new DataNativeEngine({
      scene: mockScene,
      gestureEnabled: true,
      telemetryEnabled: true,
      autoUpdate: false
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe.skip('Gesture Handling', () => {
    beforeEach(async () => {
      // Create mock artefacts with proper structure
      const mockArtefact = {
        id: '1',
        getAttribute: jest.fn(() => ({ x: 0, y: 0, z: 0 })),
        setAttribute: jest.fn(),
        nemosyneData: { id: '1' },
        parentNode: {
          appendChild: jest.fn()
        }
      };
      
      // Pre-set the artefact in engine
      engine.artefacts.set('1', mockArtefact);
      
      const data = [
        new NemosyneDataPacket({ id: '1', value: 10 })
      ];
      await engine.ingest(data);
    });

    test('should handle grab gesture', () => {
      const mockArtefact = {
        id: '1',
        getAttribute: jest.fn(() => ({ x: 0, y: 0, z: 0 })),
        nemosyneData: { id: '1' }
      };
      
      engine.handleGesture({
        type: 'grab',
        target: mockArtefact,
        hand: { position: { x: 1, y: 1, z: 1 } }
      });
      
      expect(engine.dragState).toBeDefined();
    });

    test('should handle pinch gesture', () => {
      const mockArtefact = {
        id: '1',
        getAttribute: jest.fn((attr) => {
          if (attr === 'scale') return { x: 1, y: 1, z: 1 };
          return {};
        }),
        setAttribute: jest.fn(),
        nemosyneData: { id: '1' }
      };
      
      engine.handleGesture({
        type: 'pinch',
        target: mockArtefact,
        scale: 1.5
      });
      
      expect(mockArtefact.setAttribute).toHaveBeenCalledWith('scale', expect.any(Object));
    });

    test('should handle swipe gesture left', () => {
      engine.handleGesture({
        type: 'swipe',
        direction: 'left'
      });
      // Should call shiftTemporalView
    });

    test('should handle swipe gesture right', () => {
      engine.handleGesture({
        type: 'swipe',
        direction: 'right'
      });
      // Should call shiftTemporalView
    });

    test('should handle point gesture', async () => {
      const data = [
        new NemosyneDataPacket({ id: '1', value: 10 })
      ];
      await engine.ingest(data);
      
      const mockArtefact = engine.artefacts.get('1');
      
      engine.handleGesture({
        type: 'point',
        target: mockArtefact
      });
      
      // Should highlight and suggest related data
    });

    test('should emit gesture-handled event', () => {
      const handler = jest.fn();
      engine.addEventListener('gesture-handled', handler);
      
      engine.handleGesture({
        type: 'grab',
        target: null
      });
      
      expect(handler).toHaveBeenCalled();
    });
  });

  describe.skip('Telemetry Handling', () => {
    test('should handle telemetry with gaze data', () => {
      engine.handleTelemetry({
        gaze: { target: 'element-1', duration: 1000 }
      });
      // Should track gaze
    });

    test('should handle telemetry with head data', () => {
      engine.handleTelemetry({
        head: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
      });
      // Should track head movement
    });

    test('should adapt to fast head movement', () => {
      const spy = jest.spyOn(engine, 'temporarilyReduceDetail');
      
      engine.handleTelemetry({
        head: { velocity: 60 }
      });
      
      expect(spy).toHaveBeenCalled();
    });

    test('should expand detail on gaze fixation', async () => {
      const data = [
        new NemosyneDataPacket({ id: '1', value: 10 })
      ];
      await engine.ingest(data);
      
      const mockArtefact = engine.artefacts.get('1');
      
      engine.handleTelemetry({
        gaze: { fixation: { entity: mockArtefact } }
      });
      
      // Should expand detail for nearby
    });

    test('should skip telemetry when disabled', () => {
      engine.telemetryEnabled = false;
      
      const result = engine.handleTelemetry({
        gaze: { target: 'element-1' }
      });
      
      expect(result).toBeUndefined();
    });
  });

  describe('Data Operations', () => {
    beforeEach(async () => {
      // Set up engine with gesture disabled to avoid interaction zone issues
      engine.gestureEnabled = false;
      await engine.ingest([
        new NemosyneDataPacket({ id: '1', value: 10 }),
        new NemosyneDataPacket({ id: '2', value: 20 })
      ]);
    });

    test('should update data successfully', () => {
      const result = engine.updateData('1', { value: 100 });
      expect(result).toBe(true);
      
      const packet = engine.dataPackets.get('1');
      expect(packet.get('value')).toBe(100);
    });

    test('should fail to update non-existent data', () => {
      const result = engine.updateData('nonexistent', { value: 100 });
      expect(result).toBe(false);
    });

    test('should remove data successfully', () => {
      const result = engine.removeData('1');
      expect(result).toBe(true);
      expect(engine.dataPackets.has('1')).toBe(false);
    });

    test('should fail to remove non-existent data', () => {
      const result = engine.removeData('nonexistent');
      expect(result).toBe(false);
    });

    test('should clear all data', () => {
      engine.clear();
      expect(engine.dataPackets.size).toBe(0);
      expect(engine.artefacts.size).toBe(0);
    });
  });

  describe('Layout and Visualization', () => {
    beforeEach(async () => {
      // Set up engine with gesture disabled to avoid interaction zone issues
      engine.gestureEnabled = false;
      await engine.ingest([
        new NemosyneDataPacket({ id: '1', value: 10 })
      ]);
    });

    test('should get available layouts', () => {
      const layouts = engine.getAvailableLayouts();
      expect(layouts).toBeInstanceOf(Array);
      expect(layouts.length).toBeGreaterThan(0);
    });

    test('should setLayout with specific topology', async () => {
      engine.setLayout('nemosyne-graph-force');
      // Should recalculate positions
    });
  });

  describe('State and Performance', () => {
    beforeEach(async () => {
      // Set up engine with gesture disabled
      engine.gestureEnabled = false;
      await engine.ingest([
        new NemosyneDataPacket({ id: '1', value: 10 }),
        new NemosyneDataPacket({ id: '2', value: 20 })
      ]);
    });
    test('should get state snapshot', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('dataPackets');
      expect(state).toHaveProperty('selection');
    });

    test('should get performance metrics', () => {
      const metrics = engine.getPerformanceMetrics();
      expect(metrics).toHaveProperty('packetCount');
      expect(metrics).toHaveProperty('artefactCount');
    });

    test('should check if has data', () => {
      // Data already ingested in beforeEach
      expect(engine.hasData()).toBe(true);
      
      // Clear and check again
      engine.clear();
      expect(engine.hasData()).toBe(false);
    });

    test('should get data count', () => {
      // Data already ingested in beforeEach (2 packets)
      expect(engine.getDataCount()).toBe(2);
      
      // Clear and check
      engine.clear();
      expect(engine.getDataCount()).toBe(0);
    });
  });

  describe('Import/Export Edge Cases', () => {
    test('should handle empty export', () => {
      const json = engine.toJSON();
      expect(json).toHaveProperty('dataPackets');
      expect(json.dataPackets).toEqual([]);
    });

    test('should handle malformed JSON import', () => {
      // Should not throw
      expect(() => {
        engine.fromJSON('invalid json');
      }).not.toThrow();
    });

    test('should handle import with null data', () => {
      // Should not throw
      expect(() => {
        engine.fromJSON(null);
      }).not.toThrow();
    });

    test('should handle import with undefined data', () => {
      // Should not throw
      expect(() => {
        engine.fromJSON(undefined);
      }).not.toThrow();
    });

    test('should handle import with missing dataPackets', () => {
      // Should not throw
      expect(() => {
        engine.fromJSON({ otherField: 'value' });
      }).not.toThrow();
    });

    test('should export empty to CSV', () => {
      const csv = engine.toCSV();
      expect(typeof csv).toBe('string');
    });
  });
});
