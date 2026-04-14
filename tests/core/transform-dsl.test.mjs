/**
 * Unit tests for TransformDSL
 * Tests data field access, range mapping, and interpolation
 */

import { describe, it, expect } from '@jest/globals';
import {
  executeTransform,
  compileTransform,
  transformRecords,
  transformFields,
  parseTransformExpression,
  createScale
} from '../../src/core/TransformDSL.js';

describe('TransformDSL', () => {
  const mockRecord = {
    id: '1',
    revenue: 50000,
    count: 42,
    category: 'A',
    nested: {
      value: 100,
      items: [1, 2, 3]
    }
  };

  describe('executeTransform', () => {
    it('should access data field with $data', () => {
      const result = executeTransform({ $data: 'revenue' }, mockRecord);
      expect(result).toBe(50000);
    });

    it('should access nested field with dot notation', () => {
      const result = executeTransform({ $data: 'nested.value' }, mockRecord);
      expect(result).toBe(100);
    });

    it('should map range with $domain and $range', () => {
      const transform = {
        $data: 'count',
        $domain: [0, 100],
        $range: [0, 1]
      };
      const result = executeTransform(transform, mockRecord);
      expect(result).toBe(0.42);
    });

    it('should clamp values outside domain', () => {
      const transform = {
        $data: 'count',
        $domain: [0, 10],
        $range: [0, 1]
      };
      // count is 42, should clamp to 1
      const result = executeTransform(transform, mockRecord);
      expect(result).toBe(1);
    });

    it('should map discrete values with $map', () => {
      const transform = {
        $data: 'category',
        $map: {
          from: ['A', 'B', 'C'],
          to: ['red', 'green', 'blue']
        }
      };
      const result = executeTransform(transform, mockRecord);
      expect(result).toBe('red');
    });

    it('should apply $step quantization', () => {
      const transform = {
        $data: 'count',
        $range: [0, 100],
        $step: 10
      };
      const result = executeTransform(transform, mockRecord);
      expect(result % 10).toBe(0);
    });

    it('should apply linear interpolation by default', () => {
      const transform = {
        $data: 'count',
        $domain: [0, 100],
        $range: [0, 10]
      };
      const result = executeTransform(transform, mockRecord);
      expect(result).toBe(4.2);
    });

    it('should apply ease interpolation', () => {
      const transform = {
        $data: 'count',
        $domain: [0, 100],
        $range: [0, 10],
        $interpolate: 'ease'
      };
      const result = executeTransform(transform, mockRecord);
      // Ease should give different value than linear
      expect(result).not.toBe(4.2);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(10);
    });

    it('should handle non-transform values', () => {
      expect(executeTransform(null, mockRecord)).toBe(null);
      expect(executeTransform(42, mockRecord)).toBe(42);
      expect(executeTransform('test', mockRecord)).toBe('test');
    });

    it('should handle index parameter', () => {
      const transform = { $data: 'count' };
      const result = executeTransform(transform, mockRecord, 5);
      expect(result).toBe(42);
    });
  });

  describe('compileTransform', () => {
    it('should return a reusable function', () => {
      const transform = { $data: 'revenue' };
      const fn = compileTransform(transform);
      
      expect(fn(mockRecord)).toBe(50000);
      expect(fn({ revenue: 100000 })).toBe(100000);
    });
  });

  describe('transformRecords', () => {
    it('should transform array of records', () => {
      const records = [
        { value: 0 },
        { value: 50 },
        { value: 100 }
      ];
      const transform = {
        $data: 'value',
        $domain: [0, 100],
        $range: [0, 1]
      };
      
      const results = transformRecords(records, transform);
      
      expect(results).toEqual([0, 0.5, 1]);
    });
  });

  describe('transformFields', () => {
    it('should transform multiple fields', () => {
      const transforms = {
        scaledCount: {
          $data: 'count',
          $domain: [0, 100],
          $range: [0, 1]
        },
        categoryColor: {
          $data: 'category',
          $map: {
            from: ['A', 'B'],
            to: ['red', 'blue']
          }
        }
      };
      
      const result = transformFields(mockRecord, transforms);
      
      expect(result.scaledCount).toBe(0.42);
      expect(result.categoryColor).toBe('red');
      expect(result.id).toBe('1'); // Original fields preserved
    });
  });

  describe('parseTransformExpression', () => {
    it('should parse simple $data expression', () => {
      const result = parseTransformExpression('$data: revenue');
      expect(result).toEqual({ $data: 'revenue' });
    });

    it('should parse expression with multiple parts', () => {
      const result = parseTransformExpression('$data: count; $range: [0, 10]');
      expect(result).toEqual({
        $data: 'count',
        $range: [0, 10]
      });
    });

    it('should parse expression with array', () => {
      const result = parseTransformExpression('$data: value; $domain: [0, 100]');
      expect(result).toEqual({
        $data: 'value',
        $domain: [0, 100]
      });
    });

    it('should handle empty expression', () => {
      const result = parseTransformExpression('');
      expect(result).toEqual({});
    });

    it('should handle non-string input', () => {
      expect(parseTransformExpression(null)).toEqual({});
      expect(parseTransformExpression(123)).toEqual({});
    });
  });

  describe('createScale', () => {
    it('should create a reusable scale function', () => {
      const scale = createScale({
        domain: [0, 100],
        range: [0, 10]
      });
      
      expect(scale(0)).toBe(0);
      expect(scale(50)).toBe(5);
      expect(scale(100)).toBe(10);
    });

    it('should clamp values outside domain', () => {
      const scale = createScale({
        domain: [0, 100],
        range: [0, 1]
      });
      
      expect(scale(-50)).toBe(0);
      expect(scale(150)).toBe(1);
    });

    it('should support ease interpolation', () => {
      const scale = createScale({
        domain: [0, 100],
        range: [0, 10],
        interpolate: 'ease'
      });
      
      // At 25 and 75, ease should differ from linear
      const result25 = scale(25);
      expect(result25).toBeGreaterThan(0);
      expect(result25).toBeLessThan(10);
      
      // Ease-in-out at midpoint (50) equals linear due to symmetry
      expect(scale(50)).toBe(5);
    });
  });

  describe('Combined transforms', () => {
    it('should handle complex transform with all features', () => {
      const records = [
        { category: 'A', value: 25 },
        { category: 'B', value: 75 },
        { category: 'A', value: 50 }
      ];
      
      const transforms = {
        x: {
          $data: 'value',
          $domain: [0, 100],
          $range: [-5, 5],
          $interpolate: 'ease-out'
        },
        color: {
          $data: 'category',
          $map: {
            from: ['A', 'B'],
            to: ['#ff0000', '#00ff00']
          }
        },
        height: {
          $data: 'value',
          $domain: [0, 100],
          $range: [0.5, 5],
          $step: 0.5
        }
      };
      
      const results = records.map(r => transformFields(r, transforms));
      
      // Check x is scaled and eased
      expect(results[0].x).toBeGreaterThan(-5);
      expect(results[0].x).toBeLessThan(5);
      
      // Check color mapping
      expect(results[0].color).toBe('#ff0000');
      expect(results[1].color).toBe('#00ff00');
      
      // Check height is stepped
      expect(results[0].height % 0.5).toBe(0);
    });
  });
});
