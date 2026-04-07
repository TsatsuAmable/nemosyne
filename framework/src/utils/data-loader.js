/**
 * Data Loader
 * Loads data from various sources (URLs, inline, APIs)
 */

export class DataLoader {
  /**
   * Load JSON from URL
   * @param {string} url - URL to load from
   * @returns {Promise<Object>} Loaded data
   */
  static async loadJSON(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Nemosyne: Failed to load ${url}:`, error);
      throw error;
    }
  }

  /**
   * Load CSV data
   * @param {string} url - URL to load from
   * @returns {Promise<Object>} Parsed CSV as array of records
   */
  static async loadCSV(url) {
    try {
      const response = await fetch(url);
      const text = await response.text();
      return this.parseCSV(text);
    } catch (error) {
      console.error(`Nemosyne: Failed to load CSV ${url}:`, error);
      throw error;
    }
  }

  /**
   * Parse CSV text to array of objects
   * @param {string} text - CSV text
   * @returns {Object} Parsed data
   */
  static parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return { records: [] };

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    // Parse rows
    const records = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const record = {};
      headers.forEach((header, i) => {
        // Try to parse numbers
        const numValue = Number(values[i]);
        record[header] = isNaN(numValue) ? values[i] : numValue;
      });
      return record;
    });

    return { records };
  }

  /**
   * Load from WebSocket for real-time data
   * @param {string} url - WebSocket URL
   * @param {Function} callback - Callback for new data
   * @returns {WebSocket} WebSocket instance
   */
  static loadWebSocket(url, callback) {
    const ws = new WebSocket(url);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callback(data);
      } catch (error) {
        console.error('Nemosyne: WebSocket parse error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('Nemosyne: WebSocket error:', error);
    };

    return ws;
  }

  /**
   * Generate sample/demo data
   * @param {string} type - Type of sample data
   * @param {number} count - Number of records
   * @returns {Object} Sample data
   */
  static generateSample(type = 'random', count = 10) {
    const records = [];
    
    switch (type) {
      case 'network':
        for (let i = 0; i < count; i++) {
          records.push({
            id: `node-${i}`,
            value: Math.floor(Math.random() * 100),
            connections: Math.floor(Math.random() * 5),
            category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)]
          });
        }
        break;
        
      case 'timeline':
        const baseDate = new Date();
        for (let i = 0; i < count; i++) {
          const date = new Date(baseDate);
          date.setDate(date.getDate() - i);
          records.push({
            date: date.toISOString().split('T')[0],
            value: 50 + Math.random() * 50,
            change: (Math.random() - 0.5) * 20
          });
        }
        break;
        
      case 'hierarchy':
        const buildTree = (id, depth) => {
          const node = { id, value: Math.random() * 100 };
          if (depth > 0) {
            node.children = [];
            for (let i = 0; i < 3; i++) {
              node.children.push(buildTree(`${id}-${i}`, depth - 1));
            }
          }
          return node;
        };
        return { root: buildTree('root', 3) };
        
      case 'random':
      default:
        for (let i = 0; i < count; i++) {
          records.push({
            id: i,
            value: Math.random() * 100,
            label: `Item ${i}`,
            category: Math.floor(Math.random() * 5)
          });
        }
    }
    
    return { records };
  }
}
