/**
 * DataLoader - CSV and data loading utilities for Nemosyne
 * Provides CSV parsing with automatic type inference and delimiter detection
 * 
 * @module DataLoader
 * @version 1.2.0
 */

/**
 * Parse CSV text into an array of records
 * @param {string} csvText - The CSV text to parse
 * @param {Object} options - Parsing options
 * @param {string} [options.delimiter=auto] - Field delimiter (auto-detected if not specified)
 * @param {boolean} [options.hasHeader=true] - Whether the first row contains headers
 * @param {boolean} [options.trim=true] - Whether to trim whitespace from values
 * @param {boolean} [options.inferTypes=true] - Whether to infer types (number, boolean, date)
 * @returns {Object} Parsed result with { headers: string[], records: Object[] }
 */
export function parseCSV(csvText, options = {}) {
  const {
    delimiter: userDelimiter,
    hasHeader = true,
    trim = true,
    inferTypes = true
  } = options;

  if (typeof csvText !== 'string') {
    throw new Error('parseCSV: csvText must be a string');
  }

  // Handle empty string
  if (csvText.trim() === '') {
    return { headers: [], records: [] };
  }

  // Detect delimiter if not specified
  const delimiter = userDelimiter || detectDelimiter(csvText);
  
  // Parse lines
  const lines = parseLines(csvText);
  if (lines.length === 0) {
    return { headers: [], records: [] };
  }

  // Parse headers
  let headers = [];
  let dataStartIndex = 0;
  
  if (hasHeader) {
    headers = parseRow(lines[0], delimiter).map(h => trim ? h.trim() : h);
    dataStartIndex = 1;
  } else {
    // Generate numeric headers
    const firstRow = parseRow(lines[0], delimiter);
    headers = firstRow.map((_, i) => `column${i + 1}`);
  }

  // Parse records
  const records = [];
  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines
    
    const values = parseRow(line, delimiter);
    const record = {};
    
    headers.forEach((header, index) => {
      let value = values[index] !== undefined ? values[index] : '';
      if (trim) value = value.trim();
      
      if (inferTypes) {
        value = inferType(value);
      }
      
      record[header] = value;
    });
    
    records.push(record);
  }

  return { headers, records };
}

/**
 * Detect the delimiter used in CSV text
 * Supports: comma, semicolon, tab, pipe
 * @param {string} csvText - CSV text to analyze
 * @returns {string} Detected delimiter
 */
function detectDelimiter(csvText) {
  const sample = csvText.slice(0, 2000);
  const delimiters = [',', ';', '\t', '|'];
  const counts = {};
  
  delimiters.forEach(delim => {
    // Count occurrences outside of quoted strings
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < sample.length; i++) {
      if (sample[i] === '"') {
        inQuotes = !inQuotes;
      } else if (!inQuotes && sample[i] === delim) {
        count++;
      }
    }
    counts[delim] = count;
  });
  
  // Return delimiter with highest count
  const detected = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return detected[1] > 0 ? detected[0] : ',';
}

/**
 * Parse a single CSV line into fields
 * Handles quoted fields and escaped quotes
 * @param {string} line - CSV line
 * @param {string} delimiter - Field delimiter
 * @returns {string[]} Array of field values
 */
function parseRow(line, delimiter) {
  const fields = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // End of field
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }
  
  // Add final field
  fields.push(currentField);
  
  return fields;
}

/**
 * Split CSV text into lines, handling newlines within quoted fields
 * @param {string} csvText - CSV text
 * @returns {string[]} Array of lines
 */
function parseLines(csvText) {
  const lines = [];
  let currentLine = '';
  let inQuotes = false;
  
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if (char === '\n' && !inQuotes) {
      lines.push(currentLine);
      currentLine = '';
    } else if (char !== '\r') { // Skip carriage returns
      currentLine += char;
    }
  }
  
  // Add final line if not empty
  if (currentLine.trim()) {
    lines.push(currentLine);
  }
  
  return lines;
}

/**
 * Infer the type of a value
 * @param {string} value - Value to analyze
 * @returns {string|number|boolean|Date} Inferred type
 */
function inferType(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  
  // Boolean
  const lower = value.toLowerCase();
  if (lower === 'true' || lower === 'yes' || lower === '1') return true;
  if (lower === 'false' || lower === 'no' || lower === '0') return false;
  
  // Number
  const num = Number(value);
  if (!isNaN(num) && value !== '' && !value.includes(' ')) {
    return num;
  }
  
  // Date (ISO format)
  const datePattern = /^\d{4}-\d{2}-\d{2}/;
  if (datePattern.test(value)) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  // Return as string
  return value;
}

/**
 * Load CSV from a URL (browser environment)
 * @param {string} url - URL to fetch CSV from
 * @param {Object} options - Options passed to parseCSV
 * @returns {Promise<Object>} Parsed CSV result
 */
export async function fetchCSV(url, options = {}) {
  if (typeof fetch !== 'function') {
    throw new Error('fetchCSV requires fetch API (browser environment)');
  }
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
  }
  
  const text = await response.text();
  return parseCSV(text, options);
}

/**
 * Convert records array to CSV string
 * @param {Object[]} records - Array of record objects
 * @param {Object} options - Export options
 * @param {string[]} [options.headers] - Specific headers to use (auto-detected if not provided)
 * @param {string} [options.delimiter=','] - Field delimiter
 * @param {boolean} [options.includeHeader=true] - Whether to include header row
 * @returns {string} CSV formatted string
 */
export function toCSV(records, options = {}) {
  if (!Array.isArray(records) || records.length === 0) {
    return '';
  }
  
  const {
    headers: userHeaders,
    delimiter = ',',
    includeHeader = true
  } = options;
  
  // Determine headers
  const headers = userHeaders || Object.keys(records[0]);
  
  // Escape value for CSV
  const escapeValue = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Escape quotes and wrap in quotes if contains delimiter, newline, or quote
    if (str.includes('"') || str.includes(delimiter) || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };
  
  const lines = [];
  
  // Add header
  if (includeHeader) {
    lines.push(headers.join(delimiter));
  }
  
  // Add records
  records.forEach(record => {
    const values = headers.map(header => escapeValue(record[header]));
    lines.push(values.join(delimiter));
  });
  
  return lines.join('\n');
}

/**
 * Transform records with custom mapping function
 * @param {Object[]} records - Array of records
 * @param {Function} transform - Transform function(record, index) => newRecord
 * @returns {Object[]} Transformed records
 */
export function transformRecords(records, transform) {
  return records.map((record, index) => transform(record, index));
}

/**
 * Filter records based on predicate
 * @param {Object[]} records - Array of records
 * @param {Function} predicate - Filter function(record, index) => boolean
 * @returns {Object[]} Filtered records
 */
export function filterRecords(records, predicate) {
  return records.filter((record, index) => predicate(record, index));
}

/**
 * Aggregate records by a key
 * @param {Object[]} records - Array of records
 * @param {string} key - Key to group by
 * @returns {Object} Grouped records { groupKey: records[] }
 */
export function groupBy(records, key) {
  return records.reduce((groups, record) => {
    const groupKey = record[key];
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(record);
    return groups;
  }, {});
}

// Default export
export default {
  parseCSV,
  fetchCSV,
  toCSV,
  transformRecords,
  filterRecords,
  groupBy
};
