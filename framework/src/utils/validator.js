/**
 * Schema and Data Validator
 * Ensures specs and data conform to expected formats
 */

export class Validator {
  static validateSpec(spec) {
    const errors = [];
    
    if (!spec) {
      errors.push('Spec is required');
      return errors;
    }
    
    // Required fields
    if (!spec.id) {
      errors.push('Spec must have an "id"');
    }
    
    // Geometry validation
    if (spec.geometry) {
      const validTypes = ['sphere', 'box', 'cylinder', 'octahedron', 
                          'tetrahedron', 'dodecahedron', 'icosahedron', 
                          'torus', 'plane', 'circle'];
      if (spec.geometry.type && !validTypes.includes(spec.geometry.type)) {
        errors.push(`Invalid geometry type: ${spec.geometry.type}`);
      }
    }
    
    // Material validation
    if (spec.material) {
      if (spec.material.properties?.color) {
        const color = spec.material.properties.color;
        if (typeof color === 'string' && !this.isValidColor(color)) {
          errors.push(`Invalid color: ${color}`);
        }
      }
    }
    
    // Behaviours validation
    if (spec.behaviours) {
      if (!Array.isArray(spec.behaviours)) {
        errors.push('Behaviours must be an array');
      } else {
        const validTriggers = ['hover', 'hover-leave', 'click', 'idle', 'data-update'];
        const validActions = ['glow', 'scale', 'move', 'rotate', 'color-shift', 
                              'show-label', 'hide-label', 'pulse', 'emit', 'reveal'];
        
        spec.behaviours.forEach((b, i) => {
          if (b.trigger && !validTriggers.includes(b.trigger)) {
            errors.push(`Behaviour ${i}: Invalid trigger "${b.trigger}"`);
          }
          if (b.action && !validActions.includes(b.action)) {
            errors.push(`Behaviour ${i}: Invalid action "${b.action}"`);
          }
        });
      }
    }
    
    if (errors.length > 0) {
      console.warn('Nemosyne spec validation errors:', errors);
      throw new Error(`Spec validation failed: ${errors.join(', ')}`);
    }
    
    return true;
  }

  static validateData(data) {
    const errors = [];
    
    if (!data) {
      errors.push('Data is required');
      return errors;
    }
    
    // Check for records
    const records = data.records || data.nodes || data.data;
    if (!records) {
      errors.push('Data must contain "records", "nodes", or "data" array');
    } else if (!Array.isArray(records)) {
      errors.push('Records must be an array');
    }
    
    if (errors.length > 0) {
      console.warn('Nemosyne data validation errors:', errors);
      throw new Error(`Data validation failed: ${errors.join(', ')}`);
    }
    
    return true;
  }

  static isValidColor(color) {
    // Hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) return true;
    // Short hex
    if (/^#[0-9A-Fa-f]{3}$/.test(color)) return true;
    // RGB
    if (/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(color)) return true;
    // Named colors (common ones)
    const namedColors = [
      'red', 'green', 'blue', 'yellow', 'cyan', 'magenta', 'white', 
      'black', 'gray', 'grey', 'orange', 'purple', 'pink', 'teal'
    ];
    if (namedColors.includes(color.toLowerCase())) return true;
    
    return false;
  }
}

// Export shorthand functions
export const validateSpec = Validator.validateSpec.bind(Validator);
export const validateData = Validator.validateData.bind(Validator);
