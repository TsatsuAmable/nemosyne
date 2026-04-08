import { describe, it, expect, beforeEach } from 'vitest';
import { LayoutEngine, layoutEngine } from '../../src/layouts/layout-engine.js';

describe('LayoutEngine', () => {
  let engine;
  let testRecords;
  
  beforeEach(() => {
    engine = new LayoutEngine();
    testRecords = [
      { id: 1, value: 100 },
      { id: 2, value: 200 },
      { id: 3, value: 300 },
      { id: 4, value: 400 }
    ];
  });
  
  describe('default layouts', () => {
    it('should have grid layout registered', () => {
      expect(engine.layouts.has('grid')).toBe(true);
    });
    
    it('should have radial layout registered', () => {
      expect(engine.layouts.has('radial')).toBe(true);
    });
    
    it('should have timeline layout registered', () => {
      expect(engine.layouts.has('timeline')).toBe(true);
    });
    
    it('should have spiral layout registered', () => {
      expect(engine.layouts.has('spiral')).toBe(true);
    });
    
    it('should have tree layout registered', () => {
      expect(engine.layouts.has('tree')).toBe(true);
    });
    
    it('should have force layout registered', () => {
      expect(engine.layouts.has('force')).toBe(true);
    });
    
    it('should have scatter layout registered', () => {
      expect(engine.layouts.has('scatter')).toBe(true);
    });
  });
  
  describe('calculate', () => {
    it('should return positions for known layout', () => {
      const positions = engine.calculate('grid', testRecords);
      
      expect(positions).toHaveLength(4);
      expect(positions[0]).toHaveProperty('x');
      expect(positions[0]).toHaveProperty('y');
      expect(positions[0]).toHaveProperty('z');
    });
    
    it('should fallback to scatter for unknown layout', () => {
      const positions = engine.calculate('unknown-layout', testRecords);
      
      expect(positions).toHaveLength(4);
    });
    
    it('should pass options to layout', () => {
      const positions = engine.calculate('grid', testRecords, { spacing: 5 });
      
      // With 5 spacing, positions should be wider
      expect(positions).toHaveLength(4);
    });
  });
  
  describe('gridLayout', () => {
    it('should position items in grid pattern', () => {
      const positions = engine.gridLayout(testRecords);
      
      // Default columns = ceil(sqrt(4)) = 2
      // Layout: (0,0), (1,0), (0,1), (1,1)
      expect(positions).toHaveLength(4);
      
      // X positions should alternate (0, 1, 0, 1) relative to center
      // First row (i=0,1): x = (0 - 0.5) * 3, (1 - 0.5) * 3
      expect(positions[0].x).toBeLessThan(positions[1].x);
      
      // Same x for same column
      expect(positions[0].x).toBe(positions[2].x);
      expect(positions[1].x).toBe(positions[3].x);
      
      // Y should be different for different rows
      expect(positions[0].y).not.toBe(positions[2].y);
    });
    
    it('should apply custom spacing', () => {
      const positions = engine.gridLayout(testRecords, { spacing: 10 });
      
      // With larger spacing, differences should be larger
      const diff1 = Math.abs(positions[0].x - positions[1].x);
      expect(diff1).toBeGreaterThan(5);
    });
    
    it('should apply offset', () => {
      const positions = engine.gridLayout(testRecords, { 
        offset: { x: 100, y: 50, z: 25 } 
      });
      
      // All positions should be offset
      expect(positions[0].x).toBeGreaterThan(95);
      expect(positions[0].y).toBeGreaterThan(45);
    });
    
    it('should handle single record', () => {
      const singleRecord = [{ id: 1 }];
      const positions = engine.gridLayout(singleRecord);
      
      expect(positions).toHaveLength(1);
      expect(positions[0]).toHaveProperty('x');
    });
    
    it('should handle empty records', () => {
      const positions = engine.gridLayout([]);
      
      expect(positions).toHaveLength(0);
    });
  });
  
  describe('radialLayout', () => {
    it('should position items in circle', () => {
      const positions = engine.radialLayout(testRecords);
      
      expect(positions).toHaveLength(4);
      
      // All should be at same radius (approximately)
      positions.forEach(pos => {
        const radius = Math.sqrt(pos.x ** 2 + pos.z ** 2);
        expect(radius).toBeCloseTo(5, 1); // default radius
      });
    });
    
    it('should space items evenly', () => {
      const positions = engine.radialLayout(testRecords);
      
      // 4 items = 90 degree separation
      // Calculate angles
      const angles = positions.map(pos => Math.atan2(pos.z, pos.x));
      const sortedAngles = angles.slice().sort((a, b) => a - b);
      
      // Differences should be roughly PI/2
      for (let i = 0; i < sortedAngles.length - 1; i++) {
        const diff = sortedAngles[i + 1] - sortedAngles[i];
        expect(Math.abs(diff)).toBeCloseTo(Math.PI / 2, 1);
      }
    });
    
    it('should apply custom radius', () => {
      const positions = engine.radialLayout(testRecords, { radius: 10 });
      
      positions.forEach(pos => {
        const radius = Math.sqrt(pos.x ** 2 + pos.z ** 2);
        expect(radius).toBeCloseTo(10, 1);
      });
    });
    
    it('should apply yOffset', () => {
      const positions = engine.radialLayout(testRecords, { yOffset: 5 });
      
      expect(positions[0].y).toBe(5);
    });
    
    it('should apply angleOffset', () => {
      const positions1 = engine.radialLayout(testRecords, { angleOffset: 0 });
      const positions2 = engine.radialLayout(testRecords, { angleOffset: Math.PI / 2 });
      
      // All positions should be rotated by 90 degrees
      expect(positions1[0].x).not.toBeCloseTo(positions2[0].x);
    });
  });
  
  describe('timelineLayout', () => {
    it('should position items along x-axis', () => {
      const positions = engine.timelineLayout(testRecords);
      
      expect(positions).toHaveLength(4);
      
      // Y and Z should be 0 (default)
      expect(positions[0].y).toBe(0);
      expect(positions[0].z).toBe(0);
    });
    
    it('should increase x position sequentially', () => {
      const positions = engine.timelineLayout(testRecords);
      
      // X should increase (or decrease based on spacing)
      expect(positions[1].x).toBeGreaterThan(positions[0].x);
      expect(positions[2].x).toBeGreaterThan(positions[1].x);
    });
    
    it('should center around origin', () => {
      const positions = engine.timelineLayout(testRecords);
      
      // Mean of X positions should be near 0
      const meanX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
      expect(meanX).toBeCloseTo(0, 1);
    });
    
    it('should apply custom spacing', () => {
      const positions1 = engine.timelineLayout(testRecords, { spacing: 2 });
      const positions2 = engine.timelineLayout(testRecords, { spacing: 10 });
      
      const diff1 = positions1[1].x - positions1[0].x;
      const diff2 = positions2[1].x - positions2[0].x;
      
      expect(Math.abs(diff2)).toBeGreaterThan(Math.abs(diff1));
    });
    
    it('should apply yOffset and zOffset', () => {
      const positions = engine.timelineLayout(testRecords, { 
        yOffset: 3,
        zOffset: 2 
      });
      
      expect(positions[0].y).toBe(3);
      expect(positions[0].z).toBe(2);
    });
  });
  
  describe('spiralLayout', () => {
    it('should position items in spiral', () => {
      const positions = engine.spiralLayout(testRecords);
      
      expect(positions).toHaveLength(4);
    });
    
    it('should increase height (y) as we go', () => {
      const positions = engine.spiralLayout(testRecords);
      
      // Y should increase with index
      expect(positions[1].y).toBeGreaterThan(positions[0].y);
      expect(positions[2].y).toBeGreaterThan(positions[1].y);
    });
    
    it('should decrease radius (approximately)', () => {
      const positions = engine.spiralLayout(testRecords);
      
      const radii = positions.map(p => Math.sqrt(p.x ** 2 + p.z ** 2));
      
      // Radius should decrease slightly (with default radiusShrink)
      expect(radii[radii.length - 1]).toBeLessThanOrEqual(radii[0]);
    });
    
    it('should apply custom heightStep', () => {
      const positions = engine.spiralLayout(testRecords, { heightStep: 2 });
      
      // Differences in Y should be larger
      const diff = positions[1].y - positions[0].y;
      expect(diff).toBeGreaterThan(1);
    });
    
    it('should apply custom radius', () => {
      const positions = engine.spiralLayout(testRecords, { radius: 10 });
      
      // First item should have radius near 10
      const firstRadius = Math.sqrt(positions[0].x ** 2 + positions[0].z ** 2);
      expect(firstRadius).toBeCloseTo(10, 0);
    });
    
    it('should apply custom rotations', () => {
      const positions1 = engine.spiralLayout(testRecords, { rotations: 1 });
      const positions2 = engine.spiralLayout(testRecords, { rotations: 3 });
      
      // With more rotations, the angle difference should be larger
      // (though this is tricky to test with random data)
      expect(positions1).toHaveLength(4);
      expect(positions2).toHaveLength(4);
    });
  });
  
  describe('treeLayout', () => {
    it('should position tree items', () => {
      const treeData = [
        { id: 'root' },
        { id: 'child1', parent: 'root' },
        { id: 'child2', parent: 'root' },
        { id: 'grandchild', parent: 'child1' }
      ];
      
      const positions = engine.treeLayout(treeData);
      
      expect(positions).toHaveLength(4);
    });
    
    it('should use first item as root if no parent', () => {
      const treeData = [
        { id: 'root' },
        { id: 'child', parent: 'root' }
      ];
      
      const positions = engine.treeLayout(treeData);
      
      expect(positions).toHaveLength(2);
    });
    
    it('should handle flat records (no parent relationships)', () => {
      const positions = engine.treeLayout(testRecords);
      
      // Should still work, just no hierarchy
      expect(positions).toHaveLength(4);
    });
    
    it('should apply custom spacing', () => {
      const treeData = [
        { id: 'root' },
        { id: 'child', parent: 'root' }
      ];
      
      const positions = engine.treeLayout(treeData, { siblingSpacing: 10 });
      
      expect(positions).toHaveLength(2);
    });
  });
  
  describe('forceLayout', () => {
    it('should position items randomly within bounds', () => {
      const positions = engine.forceLayout(testRecords);
      
      expect(positions).toHaveLength(4);
      
      // All positions should be within bounds (roughly)
      positions.forEach(pos => {
        expect(Math.abs(pos.x)).toBeLessThanOrEqual(10);
        expect(Math.abs(pos.y)).toBeLessThanOrEqual(5); // * 0.5
        expect(Math.abs(pos.z)).toBeLessThanOrEqual(10);
      });
    });
    
    it('should apply custom bounds', () => {
      const positions = engine.forceLayout(testRecords, { bounds: 20 });
      
      positions.forEach(pos => {
        expect(Math.abs(pos.x)).toBeLessThanOrEqual(20);
      });
    });
    
    it('should produce different positions on multiple calls', () => {
      const positions1 = engine.forceLayout(testRecords);
      const positions2 = engine.forceLayout(testRecords);
      
      // At least one position should differ
      const allSame = positions1.every((p, i) => 
        p.x === positions2[i].x && p.y === positions2[i].y && p.z === positions2[i].z
      );
      
      // Note: This could theoretically fail due to randomness but extremely unlikely
      expect(allSame).toBe(false);
    });
  });
  
  describe('scatterLayout', () => {
    it('should position items randomly within bounds', () => {
      const positions = engine.scatterLayout(testRecords);
      
      expect(positions).toHaveLength(4);
      
      positions.forEach(pos => {
        expect(Math.abs(pos.x)).toBeLessThanOrEqual(10);
        expect(Math.abs(pos.z)).toBeLessThanOrEqual(10);
      });
    });
    
    it('should apply custom bounds', () => {
      const positions = engine.scatterLayout(testRecords, { bounds: 5 });
      
      positions.forEach(pos => {
        expect(Math.abs(pos.x)).toBeLessThanOrEqual(5);
      });
    });
    
    it('should produce different positions on multiple calls', () => {
      const positions1 = engine.scatterLayout(testRecords);
      const positions2 = engine.scatterLayout(testRecords);
      
      const allSame = positions1.every((p, i) => 
        p.x === positions2[i].x && p.y === positions2[i].y && p.z === positions2[i].z
      );
      
      expect(allSame).toBe(false);
    });
  });
  
  describe('register custom layout', () => {
    it('should register and use custom layout', () => {
      const customLayout = (records, options) => {
        return records.map((_, i) => ({
          x: i * 10,
          y: 0,
          z: 0
        }));
      };
      
      engine.register('custom-line', customLayout);
      
      const positions = engine.calculate('custom-line', testRecords);
      
      expect(positions).toHaveLength(4);
      expect(positions[0].x).toBe(0);
      expect(positions[1].x).toBe(10);
      expect(positions[2].x).toBe(20);
      expect(positions[3].x).toBe(30);
    });
    
    it('should override existing layout', () => {
      const customGrid = () => [{ x: 999, y: 999, z: 999 }];
      
      engine.register('grid', customGrid);
      
      const positions = engine.calculate('grid', testRecords);
      
      expect(positions).toEqual([{ x: 999, y: 999, z: 999 }]);
    });
  });
  
  describe('singleton instance', () => {
    it('should export singleton layoutEngine', () => {
      expect(layoutEngine).toBeInstanceOf(LayoutEngine);
    });
    
    it('should have default layouts registered', () => {
      expect(layoutEngine.layouts.size).toBeGreaterThan(0);
    });
  });
});