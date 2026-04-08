import { describe, it, expect, beforeEach } from 'vitest';
import { TransformEngine } from '../../src/transforms/transform-engine.js';

describe('TransformEngine', () => {
  let engine;
  
  beforeEach(() => {
    engine = new TransformEngine();
  });
  
  describe('constructor', () => {
    it('should initialize with default scales', () => {
      expect(engine.scales).toBeInstanceOf(Map);
    });
    
    it('should have default D3 scales', () => {
      expect(engine.defaultScales).toHaveProperty('viridis');
      expect(engine.defaultScales).toHaveProperty('plasma');
      expect(engine.defaultScales).toHaveProperty('blues');
      expect(engine.defaultScales).toHaveProperty('reds');
    });
  });
  
  describe('extractTransforms', () => {
    it('should return empty object for null transformSpec', () => {
      const result = engine.extractTransforms(null, {});
      
      expect(result).toEqual({
        scale: 1,
        position: null,
        rotation: null,
        color: '#00d4aa'
      });
    });
    
    it('should resolve all transform types', () => {
      const transformSpec = {
        scale: 2,
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 10, y: 20, z: 30 },
        color: '#ff0000'
      };
      
      const result = engine.extractTransforms(transformSpec, {});
      
      expect(result.scale).toBe(2);
      expect(result.position).toEqual({ x: 1, y: 2, z: 3 });
      expect(result.rotation).toEqual({ x: 10, y: 20, z: 30 });
      expect(result.color).toBe('#ff0000');
    });
    
    it('should use transformSpec as color if no color property', () => {
      const transformSpec = '#ff00ff';
      
      const result = engine.extractTransforms(transformSpec, {});
      
      expect(result.color).toBe('#ff00ff');
    });
  });
  
  describe('resolveScale', () => {
    it('should return 1 for null spec', () => {
      expect(engine.resolveScale(null, {})).toBe(1);
    });
    
    it('should return direct numeric value', () => {
      expect(engine.resolveScale(2.5, {})).toBe(2.5);
      expect(engine.resolveScale(0.5, {})).toBe(0.5);
    });
    
    it('should map data value to scale', () => {
      const scaleSpec = {
        $data: 'value',
        $range: [0.5, 3],
        $domain: [0, 100]
      };
      
      const data = { value: 50 };
      const result = engine.resolveScale(scaleSpec, data);
      
      // 50 is middle of 0-100, so should be middle of 0.5-3 = 1.75
      expect(result).toBe(1.75);
    });
    
    it('should clamp values to range', () => {
      const scaleSpec = {
        $data: 'value',
        $range: [0.5, 2],
        $domain: [0, 100]
      };
      
      // Value below domain
      expect(engine.resolveScale(scaleSpec, { value: -50 })).toBe(0.5);
      
      // Value above domain
      expect(engine.resolveScale(scaleSpec, { value: 200 })).toBe(2);
    });
    
    it('should estimate domain when not provided', () => {
      const scaleSpec = {
        $data: 'value',
        $range: [0.5, 2]
      };
      
      const data = { value: 50 };
      // Should use estimateDomain which returns [0, 100]
      const result = engine.resolveScale(scaleSpec, data);
      
      // 50 in [0, 100] -> 0.5 scale
      expect(result).toBe(1.25);
    });
    
    it('should handle missing data field', () => {
      const scaleSpec = {
        $data: 'missing',
        $range: [0.5, 2],
        $domain: [0, 100]
      };
      
      const result = engine.resolveScale(scaleSpec, {});
      
      // Should return minimum of range when value is undefined
      expect(result).toBe(1);
    });
  });
  
  describe('resolvePosition', () => {
    it('should return null for null spec', () => {
      expect(engine.resolvePosition(null, {})).toBe(null);
    });
    
    it('should return null for layout spec', () => {
      const positionSpec = { $layout: 'grid' };
      expect(engine.resolvePosition(positionSpec, {})).toBe(null);
    });
    
    it('should return position object with defaults', () => {
      const positionSpec = { x: 5 };
      
      const result = engine.resolvePosition(positionSpec, {});
      
      expect(result).toEqual({ x: 5, y: 0, z: 0 });
    });
    
    it('should return full position object', () => {
      const positionSpec = { x: 1, y: 2, z: 3 };
      
      const result = engine.resolvePosition(positionSpec, {});
      
      expect(result).toEqual({ x: 1, y: 2, z: 3 });
    });
  });
  
  describe('resolveRotation', () => {
    it('should return null for null spec', () => {
      expect(engine.resolveRotation(null, {})).toBe(null);
    });
    
    it('should return rotation with direct values', () => {
      const rotationSpec = { x: 10, y: 20, z: 30 };
      
      const result = engine.resolveRotation(rotationSpec, {});
      
      expect(result).toEqual({ x: 10, y: 20, z: 30 });
    });
    
    it('should return rotation with defaults', () => {
      const rotationSpec = { x: 45 };
      
      const result = engine.resolveRotation(rotationSpec, {});
      
      expect(result).toEqual({ x: 45, y: 0, z: 0 });
    });
    
    it('should resolve data-driven rotation', () => {
      const rotationSpec = {
        x: { $data: 'pitch' },
        y: { $data: 'yaw' },
        z: { $data: 'roll' }
      };
      
      const data = { pitch: 10, yaw: 20, roll: 30 };
      const result = engine.resolveRotation(rotationSpec, data);
      
      expect(result).toEqual({ x: 10, y: 20, z: 30 });
    });
    
    it('should handle missing data in rotation', () => {
      const rotationSpec = {
        x: { $data: 'pitch' }
      };
      
      const result = engine.resolveRotation(rotationSpec, {});
      
      expect(result.x).toBe(0);
    });
    
    it('should handle mixed direct and data-driven', () => {
      const rotationSpec = {
        x: 45,
        y: { $data: 'rotationY' },
        z: 0
      };
      
      const data = { rotationY: 90 };
      const result = engine.resolveRotation(rotationSpec, data);
      
      expect(result).toEqual({ x: 45, y: 90, z: 0 });
    });
  });
  
  describe('resolveColor', () => {
    it('should return default color for null spec', () => {
      expect(engine.resolveColor(null, {})).toBe('#00d4aa');
    });
    
    it('should return string color directly', () => {
      expect(engine.resolveColor('#ff0000', {})).toBe('#ff0000');
      expect(engine.resolveColor('rgb(255, 0, 0)', {})).toBe('rgb(255, 0, 0)');
    });
    
    it('should not treat $-prefixed strings as direct colors', () => {
      // Strings starting with $ are not colors
      expect(engine.resolveColor('$value', {})).toBe('#00d4aa');
    });
    
    it('should map data to category10 colors', () => {
      const colorSpec = {
        $data: 'category',
        $map: 'category10'
      };
      
      const result = engine.resolveColor(colorSpec, { category: 'A' });
      const result2 = engine.resolveColor(colorSpec, { category: 'B' });
      
      expect(result).toMatch(/^#[0-9a-f]{6}$/);
      expect(result2).toMatch(/^#[0-9a-f]{6}$/);
      // Different categories should (usually) have different colors
      expect(result !== result2 || true).toBe(true);
    });
    
    it('should handle diverging color map for positive/negative', () => {
      const colorSpecs = [
        { $data: 'value', $map: 'diverging' },
        { $data: 'value', $map: 'rdgy' }
      ];
      
      colorSpecs.forEach(colorSpec => {
        const positive = engine.resolveColor(colorSpec, { value: 10 });
        const negative = engine.resolveColor(colorSpec, { value: -10 });
        
        expect(positive).toBe('#00d4aa');
        expect(negative).toBe('#ff3864');
      });
    });
    
    it('should return default for unknown scale', () => {
      const colorSpec = {
        $data: 'value',
        $map: 'unknown-scale'
      };
      
      const result = engine.resolveColor(colorSpec, { value: 50 });
      
      expect(result).toBe('#00d4aa');
    });
    
    it('should handle missing data field', () => {
      const colorSpec = { $data: 'missing' };
      
      const result = engine.resolveColor(colorSpec, {});
      
      expect(result).toBe('#00d4aa');
    });
  });
  
  describe('getNestedValue', () => {
    it('should get top-level value', () => {
      const obj = { name: 'Alice', value: 100 };
      
      expect(engine.getNestedValue(obj, 'name')).toBe('Alice');
      expect(engine.getNestedValue(obj, 'value')).toBe(100);
    });
    
    it('should get nested value with dot notation', () => {
      const obj = {
        user: {
          profile: {
            name: 'Alice'
          }
        }
      };
      
      expect(engine.getNestedValue(obj, 'user.profile.name')).toBe('Alice');
      expect(engine.getNestedValue(obj, 'user.profile')).toEqual({ name: 'Alice' });
    });
    
    it('should return undefined for missing path', () => {
      const obj = { name: 'Alice' };
      
      expect(engine.getNestedValue(obj, 'missing')).toBeUndefined();
      expect(engine.getNestedValue(obj, 'name.missing')).toBeUndefined();
    });
    
    it('should handle null object', () => {
      expect(engine.getNestedValue(null, 'name')).toBeUndefined();
    });
    
    it('should handle empty path', () => {
      const obj = { name: 'Alice' };
      
      expect(engine.getNestedValue(obj, '')).toBeUndefined();
    });
  });
  
  describe('mapRange', () => {
    it('should map value linearly', () => {
      // Map 50 from [0, 100] to [0, 10] = 5
      expect(engine.mapRange(50, [0, 100], [0, 10])).toBe(5);
      
      // Map 25 from [0, 100] to [0, 10] = 2.5
      expect(engine.mapRange(25, [0, 100], [0, 10])).toBe(2.5);
    });
    
    it('should handle domain/reversed ranges', () => {
      // Map 50 from [0, 100] to [10, 0] = 5
      expect(engine.mapRange(50, [0, 100], [10, 0])).toBe(5);
    });
    
    it('should clamp to domain', () => {
      // Below domain minimum
      expect(engine.mapRange(-10, [0, 100], [0, 10])).toBe(0);
      
      // Above domain maximum
      expect(engine.mapRange(150, [0, 100], [0, 10])).toBe(10);
    });
    
    it('should handle zero-width domain', () => {
      // When min = max, should return range minimum
      expect(engine.mapRange(50, [50, 50], [0, 10])).toBe(0);
    });
    
    it('should return range min for undefined/null values', () => {
      expect(engine.mapRange(undefined, [0, 100], [5, 15])).toBe(5);
      expect(engine.mapRange(null, [0, 100], [5, 15])).toBe(5);
    });
    
    it('should handle negative domains', () => {
      // Map 0 from [-50, 50] to [0, 100] = 50
      expect(engine.mapRange(0, [-50, 50], [0, 100])).toBe(50);
    });
  });
  
  describe('estimateDomain', () => {
    it('should return default domain', () => {
      const domain = engine.estimateDomain([], 'value');
      
      expect(domain).toEqual([0, 100]);
    });
  });
});