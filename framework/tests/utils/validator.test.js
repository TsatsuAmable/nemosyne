import { describe, it, expect, beforeEach } from 'vitest';
import { Validator, validateSpec, validateData } from '../../src/utils/validator.js';

describe('Validator', () => {
  describe('validateSpec', () => {
    it('should pass validation with valid spec', () => {
      const validSpec = {
        id: 'test-artefact',
        geometry: { type: 'box' },
        material: { properties: { color: '#00d4aa' } }
      };
      
      expect(() => Validator.validateSpec(validSpec)).not.toThrow();
      expect(Validator.validateSpec(validSpec)).toBe(true);
    });
    
    it('should throw error for missing spec', () => {
      expect(() => Validator.validateSpec(null)).toThrow('Spec is required');
      expect(() => Validator.validateSpec(undefined)).toThrow('Spec is required');
    });
    
    it('should throw error for missing id', () => {
      const spec = { geometry: { type: 'box' } };
      expect(() => Validator.validateSpec(spec)).toThrow('Spec must have an "id"');
    });
    
    it('should validate geometry types', () => {
      const validTypes = ['sphere', 'box', 'cylinder', 'octahedron', 
                          'tetrahedron', 'dodecahedron', 'icosahedron', 
                          'torus', 'plane', 'circle'];
      
      validTypes.forEach(type => {
        const spec = { 
          id: 'test', 
          geometry: { type } 
        };
        expect(() => Validator.validateSpec(spec)).not.toThrow();
      });
    });
    
    it('should throw error for invalid geometry type', () => {
      const spec = { 
        id: 'test', 
        geometry: { type: 'invalid-shape' } 
      };
      expect(() => Validator.validateSpec(spec)).toThrow('Invalid geometry type');
    });
    
    it('should validate hex colors', () => {
      const validHexColors = ['#00d4aa', '#123ABC', '#ffffff', '#000'];
      
      validHexColors.forEach(color => {
        const spec = { 
          id: 'test',
          material: { properties: { color } }
        };
        expect(() => Validator.validateSpec(spec)).not.toThrow();
      });
    });
    
    it('should validate RGB colors', () => {
      const spec = { 
        id: 'test',
        material: { properties: { color: 'rgb(0, 212, 170)' } }
      };
      expect(() => Validator.validateSpec(spec)).not.toThrow();
    });
    
    it('should validate named colors', () => {
      const namedColors = ['red', 'green', 'blue', 'white', 'black'];
      
      namedColors.forEach(color => {
        const spec = { 
          id: 'test',
          material: { properties: { color } }
        };
        expect(() => Validator.validateSpec(spec)).not.toThrow();
      });
    });
    
    it('should throw error for invalid color', () => {
      const spec = { 
        id: 'test',
        material: { properties: { color: 'not-a-color' } }
      };
      expect(() => Validator.validateSpec(spec)).toThrow('Invalid color');
    });
    
    it('should validate behaviours array', () => {
      const spec = {
        id: 'test',
        behaviours: [
          { trigger: 'hover', action: 'glow' },
          { trigger: 'click', action: 'scale' }
        ]
      };
      expect(() => Validator.validateSpec(spec)).not.toThrow();
    });
    
    it('should throw error for invalid behaviours type', () => {
      const spec = {
        id: 'test',
        behaviours: 'not-an-array'
      };
      expect(() => Validator.validateSpec(spec)).toThrow('Behaviours must be an array');
    });
    
    it('should throw error for invalid trigger', () => {
      const spec = {
        id: 'test',
        behaviours: [
          { trigger: 'invalid-trigger', action: 'glow' }
        ]
      };
      expect(() => Validator.validateSpec(spec)).toThrow('Invalid trigger');
    });
    
    it('should throw error for invalid action', () => {
      const spec = {
        id: 'test',
        behaviours: [
          { trigger: 'hover', action: 'invalid-action' }
        ]
      };
      expect(() => Validator.validateSpec(spec)).toThrow('Invalid action');
    });
    
    it('should validate multiple errors at once', () => {
      const spec = {
        geometry: { type: 'invalid' },
        material: { properties: { color: 'bad' } },
        behaviours: [
          { trigger: 'bad-trigger', action: 'bad-action' }
        ]
      };
      
      expect(() => Validator.validateSpec(spec)).toThrow();
    });
  });
  
  describe('validateData', () => {
    it('should pass validation with valid data', () => {
      const data = { records: [{ id: 1 }, { id: 2 }] };
      expect(() => Validator.validateData(data)).not.toThrow();
      expect(Validator.validateData(data)).toBe(true);
    });
    
    it('should accept data with "nodes" property', () => {
      const data = { nodes: [{ id: 1 }, { id: 2 }] };
      expect(() => Validator.validateData(data)).not.toThrow();
    });
    
    it('should accept data with "data" property', () => {
      const data = { data: [{ id: 1 }, { id: 2 }] };
      expect(() => Validator.validateData(data)).not.toThrow();
    });
    
    it('should throw error for missing data', () => {
      expect(() => Validator.validateData(null)).toThrow('Data is required');
      expect(() => Validator.validateData(undefined)).toThrow('Data is required');
    });
    
    it('should throw error for non-array records', () => {
      const data = { records: 'not-an-array' };
      expect(() => Validator.validateData(data)).toThrow('Records must be an array');
    });
    
    it('should throw error for missing records/nodes/data', () => {
      const data = { somethingElse: [] };
      expect(() => Validator.validateData(data)).toThrow('must contain "records", "nodes", or "data"');
    });
  });
  
  describe('isValidColor', () => {
    it('should validate 6-char hex colors', () => {
      expect(Validator.isValidColor('#00d4aa')).toBe(true);
      expect(Validator.isValidColor('#123ABC')).toBe(true);
      expect(Validator.isValidColor('#ffffff')).toBe(true);
    });
    
    it('should validate 3-char hex colors', () => {
      expect(Validator.isValidColor('#000')).toBe(true);
      expect(Validator.isValidColor('#fff')).toBe(true);
      expect(Validator.isValidColor('#ABC')).toBe(true);
    });
    
    it('should validate RGB format', () => {
      expect(Validator.isValidColor('rgb(0, 212, 170)')).toBe(true);
      expect(Validator.isValidColor('rgb(255, 255, 255)')).toBe(true);
    });
    
    it('should validate named colors', () => {
      expect(Validator.isValidColor('red')).toBe(true);
      expect(Validator.isValidColor('Blue')).toBe(true);
      expect(Validator.isValidColor('GREEN')).toBe(true);
    });
    
    it('should reject invalid colors', () => {
      expect(Validator.isValidColor('not-a-color')).toBe(false);
      expect(Validator.isValidColor('#gggggg')).toBe(false);
      expect(Validator.isValidColor('123')).toBe(false);
    });
  });
  
  describe('export shorthand functions', () => {
    it('should export validateSpec as shorthand', () => {
      const spec = { id: 'test' };
      expect(() => validateSpec(spec)).not.toThrow();
    });
    
    it('should export validateData as shorthand', () => {
      const data = { records: [] };
      expect(() => validateData(data)).not.toThrow();
    });
  });
});