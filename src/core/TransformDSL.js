/**
 * TransformDSL - Domain-Specific Language for Data Transformations
 * Enables declarative data transformations in Nemosyne component specs
 * 
 * Supports:
 * - $data: Access data field
 * - $map: Map values between ranges
 * - $range: Define output range
 * - $domain: Define input domain
 * - $step: Step increments
 * - $interpolate: Interpolation type
 * 
 * @module TransformDSL
 * @version 1.2.0
 */

/**
 * Parse and execute a transform expression
 * @param {Object} transform - Transform spec object
 * @param {Object} record - Data record to transform
 * @param {number} index - Record index
 * @returns {*} Transformed value
 * 
 * @example
 * // Simple field access
 * const value = executeTransform({ $data: 'revenue' }, record);
 * 
 * // Range mapping
 * const value = executeTransform({
 *   $data: 'count',
 *   $domain: [0, 100],
 *   $range: [1, 5]
 * }, record);
 */
export function executeTransform(transform, record, index = 0) {
  if (!transform || typeof transform !== 'object') {
    return transform;
  }

  // Handle $data field access
  let value = record;
  if (transform.$data) {
    value = getField(record, transform.$data);
  }

  // Get domain (input range)
  const domain = transform.$domain;
  
  // Calculate normalized value (0-1) within domain
  let normalized = value;
  if (domain && Array.isArray(domain) && domain.length === 2) {
    const [min, max] = domain;
    normalized = (value - min) / (max - min);
    normalized = Math.max(0, Math.min(1, normalized)); // Clamp to 0-1
  }

  // Apply $map if present
  if (transform.$map) {
    const { from, to } = transform.$map;
    if (Array.isArray(from) && Array.isArray(to) && from.length === to.length) {
      // Map discrete values
      const mapIndex = from.indexOf(value);
      if (mapIndex !== -1) {
        value = to[mapIndex];
      }
    }
  }

  // Apply $range if present
  if (transform.$range && Array.isArray(transform.$range)) {
    const [min, max] = transform.$range;
    
    // Interpolation type
    const interpolate = transform.$interpolate || 'linear';
    
    let t = normalized;
    if (typeof t === 'number' && domain) {
      // Already normalized above
    } else if (typeof value === 'number') {
      // Auto-calculate domain from value if not specified
      t = Math.max(0, Math.min(1, value)); // Assume 0-1 if no domain
    }

    // Apply easing
    if (interpolate === 'ease') {
      t = easeInOutCubic(t);
    } else if (interpolate === 'ease-in') {
      t = t * t;
    } else if (interpolate === 'ease-out') {
      t = 1 - (1 - t) * (1 - t);
    }

    value = min + t * (max - min);
  }

  // Apply $step quantization
  if (transform.$step && typeof value === 'number') {
    value = Math.round(value / transform.$step) * transform.$step;
  }

  return value;
}

/**
 * Get nested field from object using dot notation
 * @param {Object} obj - Source object
 * @param {string} path - Field path (e.g., 'user.name' or 'items.0.value')
 * @returns {*} Field value
 */
function getField(obj, path) {
  if (!path || typeof path !== 'string') {
    return obj;
  }

  const parts = path.split('.');
  let value = obj;

  for (const part of parts) {
    if (value === null || value === undefined) {
      return undefined;
    }
    
    // Handle array index access
    if (/^\d+$/.test(part)) {
      value = value[parseInt(part, 10)];
    } else {
      value = value[part];
    }
  }

  return value;
}

/**
 * Cubic ease-in-out interpolation
 * @param {number} t - Input (0-1)
 * @returns {number} Eased value (0-1)
 */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Compile a transform spec into an executable function
 * @param {Object} transform - Transform spec
 * @returns {Function} Compiled transform function(record, index) => value
 */
export function compileTransform(transform) {
  return (record, index) => executeTransform(transform, record, index);
}

/**
 * Transform an array of records using a transform spec
 * @param {Object[]} records - Records to transform
 * @param {Object} transform - Transform spec
 * @returns {*[]} Transformed values
 */
export function transformRecords(records, transform) {
  const fn = compileTransform(transform);
  return records.map((record, index) => fn(record, index));
}

/**
 * Apply transforms to multiple fields of a record
 * @param {Object} record - Source record
 * @param {Object} transforms - Object mapping field names to transform specs
 * @returns {Object} Transformed record
 * 
 * @example
 * const transformed = transformFields(record, {
 *   x: { $data: 'longitude', $domain: [-180, 180], $range: [-10, 10] },
 *   y: { $data: 'latitude', $domain: [-90, 90], $range: [-5, 5] },
 *   height: { $data: 'elevation', $range: [0.1, 5] }
 * });
 */
export function transformFields(record, transforms) {
  const result = { ...record };
  
  for (const [field, transform] of Object.entries(transforms)) {
    result[field] = executeTransform(transform, record);
  }
  
  return result;
}

/**
 * Parse a transform expression string
 * Legacy support for string expressions like "$data: revenue; $range: [1, 5]"
 * @param {string} expr - Transform expression
 * @returns {Object} Parsed transform spec
 */
export function parseTransformExpression(expr) {
  if (!expr || typeof expr !== 'string') {
    return {};
  }

  const spec = {};
  const parts = expr.split(';').map(s => s.trim()).filter(Boolean);
  
  for (const part of parts) {
    const match = part.match(/^\$(\w+)\s*:\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      spec[`$${key}`] = parseValue(value);
    }
  }
  
  return spec;
}

/**
 * Parse a value from string representation
 * @param {string} value - String value
 * @returns {*} Parsed value
 */
function parseValue(value) {
  value = value.trim();
  
  // Array: [1, 2, 3]
  if (value.startsWith('[') && value.endsWith(']')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1).split(',').map(s => parseValue(s.trim()));
    }
  }
  
  // Object: { a: 1, b: 2 }
  if (value.startsWith('{') && value.endsWith('}')) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  
  // Number
  if (/^-?\d+\.?\d*$/.test(value)) {
    return parseFloat(value);
  }
  
  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;
  
  // String (remove quotes if present)
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  
  return value;
}

/**
 * Create a scale function for repeated use
 * @param {Object} options - Scale options
 * @param {number[]} options.domain - Input domain [min, max]
 * @param {number[]} options.range - Output range [min, max]
 * @param {string} [options.interpolate='linear'] - Interpolation type
 * @returns {Function} Scale function(value) => scaledValue
 */
export function createScale(options) {
  const { domain, range, interpolate = 'linear' } = options;
  const [d0, d1] = domain;
  const [r0, r1] = range;
  
  return (value) => {
    let t = (value - d0) / (d1 - d0);
    t = Math.max(0, Math.min(1, t));
    
    if (interpolate === 'ease') {
      t = easeInOutCubic(t);
    } else if (interpolate === 'ease-in') {
      t = t * t;
    } else if (interpolate === 'ease-out') {
      t = 1 - (1 - t) * (1 - t);
    }
    
    return r0 + t * (r1 - r0);
  };
}

// Default export
export default {
  executeTransform,
  compileTransform,
  transformRecords,
  transformFields,
  parseTransformExpression,
  createScale
};
