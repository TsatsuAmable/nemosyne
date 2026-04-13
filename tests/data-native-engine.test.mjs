/**
 * DataNativeEngine Tests for Nemosyne
 * Run with: NODE_OPTIONS='--experimental-vm-modules' npx jest --config jest.config.mjs
 */

import { jest } from '@jest/globals';
import { DataNativeEngine } from '../src/core/DataNativeEngine.js';
import { NemosyneDataPacket } from '../src/core/NemosyneDataPacket.js';

describe('DataNativeEngine', () => {
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should create engine with default options', () => {
      const defaultEngine = new DataNativeEngine();
      expect(defaultEngine.dataPackets).toBeInstanceOf(Map);
      expect(defaultEngine.artefacts).toBeInstanceOf(Map);
      expect(defaultEngine.autoUpdate).toBe(true);
      expect(defaultEngine.gestureEnabled).toBe(true);
    });

    test('should create engine with custom options', () => {
      expect(engine.dataPackets).toBeInstanceOf(Map);
      expect(engine.artefacts).toBeInstanceOf(Map);
      expect(engine.autoUpdate).toBe(false);
      expect(engine.gestureEnabled).toBe(false);
    });

    test('should initialize core components', () => {
      expect(engine.topologyDetector).toBeDefined();
      expect(engine.propertyMapper).toBeDefined();
      expect(engine.layoutEngine).toBeDefined();
    });
  });

  describe('Data Ingestion', () => {
    test('should ingest array data', async () => {
      const data = [
        { id: '1', value: 10 },
        { id: '2', value: 20 }
      ];
      
      const artefacts = await engine.ingest(data);
      expect(artefacts).toBeInstanceOf(Array);
      expect(artefacts.length).toBe(2);
      expect(engine.dataPackets.size).toBe(2);
    });

    test('should ingest single object', async () => {
      const data = { id: '1', value: 10 };
      
      const artefacts = await engine.ingest(data);
      expect(artefacts).toBeInstanceOf(Array);
      expect(artefacts.length).toBe(1);
    });

    test('should ingest NemosyneDataPacket array', async () => {
      const packets = [
        new NemosyneDataPacket({ id: '1', value: 10 }),
        new NemosyneDataPacket({ id: '2', value: 20 })
      ];
      
      const artefacts = await engine.ingest(packets);
      expect(artefacts.length).toBe(2);
    });

    test('should handle empty data', async () => {
      const artefacts = await engine.ingest([]);
      expect(artefacts).toBeInstanceOf(Array);
      expect(artefacts.length).toBe(0);
    });

    test('should normalize data with schema', async () => {
      const data = [{ x: 1, y: 2 }];
      const schema = { 
        idField: 'x',
        valueField: 'y'
      };
      
      const packets = engine.normalizeData(data, schema);
      expect(packets.length).toBe(1);
      expect(packets[0].id).toBe('1');
    });

    test('should auto-generate IDs when missing', async () => {
      const data = [{ value: 10 }, { value: 20 }];
      
      const packets = engine.normalizeData(data, {});
      expect(packets[0].id).toBeDefined();
      expect(packets[1].id).toBeDefined();
      expect(packets[0].id).not.toBe(packets[1].id);
    });
  });

  describe('Data Management', () => {
    beforeEach(async () => {
      const data = [
        new NemosyneDataPacket({ id: '1', value: 10 }),
        new NemosyneDataPacket({ id: '2', value: 20 })
      ];
      await engine.ingest(data);
    });

    test('should get data packet by ID', () => {
      const packet = engine.getDataPacket('1');
      expect(packet).toBeDefined();
      expect(packet.id).toBe('1');
    });

    test('should return undefined for unknown ID', () => {
      const packet = engine.getDataPacket('unknown');
      expect(packet).toBeUndefined();
    });

    test('should get all data packets', () => {
      const packets = engine.getAllDataPackets();
      expect(packets).toBeInstanceOf(Array);
      expect(packets.length).toBe(2);
    });

    test('should get artefact by ID', () => {
      const artefact = engine.getArtefact('1');
      expect(artefact).toBeDefined();
    });

    test('should update data packet', () => {
      const updates = { value: { '$set': 100 } };
      const result = engine.updateData('1', updates);
      expect(result).toBe(true);
    });

    test('should return false for updating unknown packet', () => {
      const result = engine.updateData('unknown', {});
      expect(result).toBe(false);
    });

    test('should remove data packet', () => {
      const result = engine.removeData('1');
      expect(result).toBe(true);
      expect(engine.dataPackets.has('1')).toBe(false);
    });

    test('should return false for removing unknown packet', () => {
      const result = engine.removeData('unknown');
      expect(result).toBe(false);
    });

    test('should clear all data', () => {
      engine.clear();
      expect(engine.dataPackets.size).toBe(0);
      expect(engine.artefacts.size).toBe(0);
    });
  });

  describe('Selection', () => {
    let mockArtefacts;
    
    beforeEach(() => {
      // Clear any existing state
      engine.dataPackets.clear();
      engine.artefacts.clear();
      
      // Directly add packets and mock artefacts since ingest requires document.createElement
      engine.dataPackets.set('1', new NemosyneDataPacket({ id: '1' }));
      engine.dataPackets.set('2', new NemosyneDataPacket({ id: '2' }));
      engine.dataPackets.set('3', new NemosyneDataPacket({ id: '3' }));
      
      // Create mock artefacts with trackable function calls
      mockArtefacts = {
        '1': { classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn().mockReturnValue(false) }, id: '1' },
        '2': { classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn().mockReturnValue(false) }, id: '2' },
        '3': { classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn().mockReturnValue(false) }, id: '3' }
      };
      
      engine.artefacts.set('1', mockArtefacts['1']);
      engine.artefacts.set('2', mockArtefacts['2']);
      engine.artefacts.set('3', mockArtefacts['3']);
    });

    test('should select single packet', () => {
      engine.select('1');
      // Verify classList.add was called
      expect(mockArtefacts['1'].classList.add).toHaveBeenCalledWith('selected');
    });

    test('should deselect all when selecting with clear option', () => {
      engine.select('1');
      engine.select('2', { clear: true });
      // First should be removed, second should be selected
      expect(mockArtefacts['1'].classList.remove).toHaveBeenCalledWith('selected');
      expect(mockArtefacts['2'].classList.add).toHaveBeenCalledWith('selected');
    });

    test('should add to selection', () => {
      engine.select('1');
      engine.addToSelection('2');
      expect(mockArtefacts['1'].classList.add).toHaveBeenCalledWith('selected');
      expect(mockArtefacts['2'].classList.add).toHaveBeenCalledWith('selected');
    });

    test('should remove from selection', () => {
      engine.select('1');
      engine.addToSelection('2');
      engine.removeFromSelection('1');
      expect(mockArtefacts['1'].classList.remove).toHaveBeenCalledWith('selected');
    });

    test('should toggle selection', () => {
      // First toggle - should add
      engine.toggleSelection('1');
      expect(mockArtefacts['1'].classList.add).toHaveBeenCalledWith('selected');
      // Contains returns false initially, then we need to mock it returning true for second toggle
      mockArtefacts['1'].classList.contains.mockReturnValue(true);
      // Second toggle - should remove
      engine.toggleSelection('1');
      expect(mockArtefacts['1'].classList.remove).toHaveBeenCalledWith('selected');
    });

    test('should clear selection', () => {
      engine.select('1');
      engine.addToSelection('2');
      engine.clearSelection();
      // All should have remove called
      expect(mockArtefacts['1'].classList.remove).toHaveBeenCalledWith('selected');
      expect(mockArtefacts['2'].classList.remove).toHaveBeenCalledWith('selected');
    });

    test('should get selected packets', () => {
      engine.select('1');
      const selected = engine.getSelectedPackets();
      // Returns packets based on classList.contains, not actual selection tracking
      expect(selected).toBeInstanceOf(Array);
    });

    test('should select all', () => {
      engine.selectAll();
      // Should add selected to all
      expect(mockArtefacts['1'].classList.add).toHaveBeenCalledWith('selected');
      expect(mockArtefacts['2'].classList.add).toHaveBeenCalledWith('selected');
      expect(mockArtefacts['3'].classList.add).toHaveBeenCalledWith('selected');
    });

    test('should invert selection', () => {
      // Start with '1' selected
      engine.select('1');
      // Contains returns false for '2' and '3' by default
      mockArtefacts['1'].classList.contains.mockReturnValue(true);
      engine.invertSelection();
      // '1' should be removed, '2' and '3' should be added
      expect(mockArtefacts['1'].classList.remove).toHaveBeenCalledWith('selected');
      expect(mockArtefacts['2'].classList.add).toHaveBeenCalledWith('selected');
      expect(mockArtefacts['3'].classList.add).toHaveBeenCalledWith('selected');
    });

    test('should select range', () => {
      engine.selectRange('1', '3');
      // Should add all in range
      expect(mockArtefacts['1'].classList.add).toHaveBeenCalledWith('selected');
      expect(mockArtefacts['2'].classList.add).toHaveBeenCalledWith('selected');
      expect(mockArtefacts['3'].classList.add).toHaveBeenCalledWith('selected');
    });
  });

  describe('Filtering and Queries', () => {
    beforeEach(async () => {
      const data = [
        new NemosyneDataPacket({ id: '1', value: 10, category: 'A' }),
        new NemosyneDataPacket({ id: '2', value: 20, category: 'B' }),
        new NemosyneDataPacket({ id: '3', value: 30, category: 'A' })
      ];
      await engine.ingest(data);
    });

    test('should filter packets', () => {
      const filtered = engine.filter(p => p.get('value') > 15);
      expect(filtered.length).toBe(2);
    });

    test('should query with simple conditions', () => {
      const results = engine.query({ id: '1' });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('1');
    });

    test('should query with comparison operators', () => {
      const results = engine.query({ value: { $gt: 15 } });
      expect(results.length).toBe(2);
    });

    test('should query with $in operator', () => {
      const results = engine.query({ id: { $in: ['1', '2'] } });
      expect(results.length).toBe(2);
    });

    test('should query with $exists operator', () => {
      const results = engine.query({ value: { $exists: true } });
      expect(results.length).toBe(3);
    });

    test('should sort packets', () => {
      const sorted = engine.sortBy('value', 'desc');
      expect(sorted[0].id).toBe('3');
      expect(sorted[2].id).toBe('1');
    });

    test('should group packets', () => {
      const groups = engine.groupBy('semantics.type');
      expect(groups.size).toBeGreaterThanOrEqual(1);
    });

    test('should get unique values', () => {
      const values = engine.getUniqueValues('id');
      expect(values).toContain('1');
      expect(values).toContain('2');
      expect(values).toContain('3');
    });

    test('should calculate statistics', () => {
      const stats = engine.calculateStats('value');
      expect(stats).toHaveProperty('min');
      expect(stats).toHaveProperty('max');
      expect(stats).toHaveProperty('avg');
      expect(stats).toHaveProperty('sum');
    });
  });

  describe('Visualization', () => {
    test('should set color scheme', () => {
      engine.setColorScheme('viridis');
      expect(engine.propertyMapper).toBeDefined();
    });

    test('should set scale range', () => {
      engine.setScaleRange(0.5, 2.0);
      // Should not throw
    });

    test('should highlight packet', () => {
      const mockArtefact = { classList: { add: jest.fn() } };
      engine.artefacts.set('1', mockArtefact);
      engine.highlight('1');
      expect(mockArtefact.classList.add).toHaveBeenCalledWith('highlighted');
    });

    test('should unhighlight packet', () => {
      const mockArtefact = { classList: { remove: jest.fn() } };
      engine.artefacts.set('1', mockArtefact);
      engine.unhighlight('1');
      expect(mockArtefact.classList.remove).toHaveBeenCalledWith('highlighted');
    });

    test('should focus on packet', () => {
      const mockArtefact = { 
        getAttribute: jest.fn(() => '0 0 0'),
        setAttribute: jest.fn() 
      };
      engine.artefacts.set('1', mockArtefact);
      engine.focus('1');
      expect(mockArtefact.getAttribute).toHaveBeenCalled();
    });

    test('should zoom to fit', () => {
      engine.zoomToFit();
      // Should not throw
    });

    test('should reset view', () => {
      engine.resetView();
      // Should not throw
    });

    test('should set layout type', () => {
      engine.setLayout('nemosyne-graph-force');
      expect(engine.currentLayout).toBe('nemosyne-graph-force');
    });

    test('should get available layout types', () => {
      const layouts = engine.getAvailableLayouts();
      expect(layouts).toBeInstanceOf(Array);
      expect(layouts.length).toBeGreaterThan(0);
    });
  });

  describe('Events', () => {
    test('should emit events', () => {
      let emitted = false;
      engine.addEventListener('test', () => { emitted = true; });
      engine.emit('test', {});
      expect(emitted).toBe(true);
    });

    test('should remove event listeners', () => {
      const handler = jest.fn();
      engine.addEventListener('test', handler);
      engine.removeEventListener('test', handler);
      engine.emit('test', {});
      expect(handler).not.toHaveBeenCalled();
    });

    test('should emit data change events', async () => {
      let eventFired = false;
      engine.addEventListener('data-ingested', () => { eventFired = true; });
      await engine.ingest([{ id: '1', value: 10 }]);
      expect(eventFired).toBe(true);
    });
  });

  describe('Export and Serialization', () => {
    beforeEach(async () => {
      await engine.ingest([
        new NemosyneDataPacket({ id: '1', value: 10 })
      ]);
    });

    test('should export to JSON', () => {
      const result = engine.toJSON();
      // toJSON returns an object, not a string
      expect(result).toHaveProperty('dataPackets');
      
      // Can be stringified
      const json = JSON.stringify(result);
      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('dataPackets');
    });

    test('should export selected to JSON', () => {
      engine.select('1');
      // Get selected packets and convert to JSON
      const selected = engine.getSelectedPackets();
      const json = JSON.stringify(selected);
      expect(typeof json).toBe('string');
    });

    test('should import from JSON', () => {
      const data = {
        dataPackets: [
          { id: '2', value: { raw: 20 } }
        ]
      };
      engine.fromJSON(JSON.stringify(data));
      expect(engine.dataPackets.has('2')).toBe(true);
    });

    test('should export to CSV', () => {
      const csv = engine.toCSV();
      expect(typeof csv).toBe('string');
      expect(csv).toContain('id');
    });
  });

  describe('Performance and State', () => {
    test('should get performance metrics', () => {
      const metrics = engine.getPerformanceMetrics();
      expect(metrics).toHaveProperty('packetCount');
      expect(metrics).toHaveProperty('artefactCount');
    });

    test('should get state snapshot', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('dataPackets');
      expect(state).toHaveProperty('selection');
      expect(state).toHaveProperty('layout');
    });

    test('should check if has data', async () => {
      expect(engine.hasData()).toBe(false);
      await engine.ingest([{ id: '1' }]);
      expect(engine.hasData()).toBe(true);
    });

    test('should get data count', async () => {
      expect(engine.getDataCount()).toBe(0);
      await engine.ingest([{ id: '1' }, { id: '2' }]);
      expect(engine.getDataCount()).toBe(2);
    });
  });
});
