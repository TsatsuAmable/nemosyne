/**
 * WebSocketDataSource - Real-time data streaming for Nemosyne
 * Manages WebSocket connections and updates visualizations in real-time
 * 
 * @module WebSocketDataSource
 * @version 1.2.0
 */

import { parseCSV } from './DataLoader.js';

/**
 * WebSocket Data Source for real-time streaming
 * @class
 */
export class WebSocketDataSource {
  /**
   * Create a WebSocket data source
   * @param {string} url - WebSocket server URL
   * @param {Object} options - Configuration options
   * @param {string} [options.format='json'] - Data format: 'json' | 'csv'
   * @param {boolean} [options.autoReconnect=true] - Auto-reconnect on disconnect
   * @param {number} [options.reconnectDelay=3000] - Reconnect delay in ms
   * @param {number} [options.maxReconnects=10] - Max reconnection attempts
   * @param {Function} [options.transform] - Transform function for incoming data
   * @param {Object} [options.csvOptions] - Options for CSV parsing
   */
  constructor(url, options = {}) {
    this.url = url;
    this.options = {
      format: 'json',
      autoReconnect: true,
      reconnectDelay: 3000,
      maxReconnects: 10,
      transform: null,
      csvOptions: {},
      ...options
    };
    
    this.ws = null;
    this.records = [];
    this.isConnected = false;
    this.reconnectCount = 0;
    this.listeners = new Map();
    
    // Bind methods
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.send = this.send.bind(this);
  }

  /**
   * Connect to WebSocket server
   * @returns {Promise<void>}
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (typeof WebSocket === 'undefined') {
        reject(new Error('WebSocket not supported in this environment'));
        return;
      }

      try {
        this.ws = new WebSocket(this.url);
        
        this.ws.onopen = () => {
          this.isConnected = true;
          this.reconnectCount = 0;
          this.emit('connect');
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
        
        this.ws.onerror = (error) => {
          this.emit('error', error);
          if (!this.isConnected) {
            reject(error);
          }
        };
        
        this.ws.onclose = () => {
          this.isConnected = false;
          this.emit('disconnect');
          
          if (this.options.autoReconnect && this.reconnectCount < this.options.maxReconnects) {
            this.reconnectCount++;
            setTimeout(() => this.connect(), this.options.reconnectDelay);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket message
   * @param {string} data - Raw message data
   * @private
   */
  handleMessage(data) {
    let parsed;
    
    try {
      if (this.options.format === 'csv') {
        // Parse CSV data
        const result = parseCSV(data, this.options.csvOptions);
        parsed = result.records;
      } else {
        // Parse JSON data
        parsed = JSON.parse(data);
        // Handle both single records and arrays
        if (!Array.isArray(parsed)) {
          parsed = [parsed];
        }
      }
      
      // Apply transform if provided
      if (this.options.transform) {
        parsed = parsed.map(this.options.transform);
      }
      
      // Update records
      this.records = parsed;
      
      // Emit message event
      this.emit('message', parsed);
    } catch (error) {
      this.emit('error', new Error(`Failed to parse message: ${error.message}`));
    }
  }

  /**
   * Send data to WebSocket server
   * @param {*} data - Data to send (will be JSON.stringified)
   * @returns {boolean} Success
   */
  send(data) {
    if (!this.isConnected || !this.ws) {
      this.emit('error', new Error('WebSocket not connected'));
      return false;
    }
    
    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws.send(message);
      return true;
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    this.options.autoReconnect = false; // Disable auto-reconnect
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
  }

  /**
   * Get current records
   * @returns {Array} Current data records
   */
  getRecords() {
    return [...this.records];
  }

  /**
   * Subscribe to events
   * @param {string} event - Event name: 'connect' | 'disconnect' | 'message' | 'error'
   * @param {Function} callback - Event handler
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from events
   * @param {string} event - Event name
   * @param {Function} callback - Handler to remove
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * Emit event to all listeners
   * @param {string} event - Event name
   * @param {*} data - Event data
   * @private
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`WebSocketDataSource event handler error: ${error}`);
        }
      });
    }
  }

  /**
   * Check connection status
   * @returns {boolean} Connected state
   */
  get connected() {
    return this.isConnected;
  }
}

/**
 * Create and connect to a WebSocket data source
 * Convenience function for quick setup
 * @param {string} url - WebSocket URL
 * @param {Object} options - Options passed to WebSocketDataSource
 * @returns {Promise<WebSocketDataSource>} Connected data source
 */
export async function loadWebSocket(url, options = {}) {
  const source = new WebSocketDataSource(url, options);
  await source.connect();
  return source;
}

// Default export
export default {
  WebSocketDataSource,
  loadWebSocket
};
