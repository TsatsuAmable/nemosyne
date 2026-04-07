/**
 * Nemosyne WebSocket Extension
 * Real-time data streaming for IoT, finance, and live data sources
 * 
 * Usage:
 *   <nemosyne-stream
 *     src="ws://sensor-server:8080"
 *     artefact="#iot-vis"
 *     buffer="60"
 *     interpolation="linear"
 *   >
 *   </a-entity>
 */

export const NemosyneStream = {
  schema: {
    src: { type: 'string', default: '' },           // WebSocket URL
    artefact: { type: 'selector', default: '' },     // Target nemosyne-artefact
    buffer: { type: 'number', default: 60 },       // Number of data points to keep
    interpolation: { type: 'string', default: 'linear' }, // none | linear | smooth
    updateRate: { type: 'number', default: 30 },   // Max updates per second
    reconnect: { type: 'boolean', default: true },    // Auto-reconnect on disconnect
    reconnectInterval: { type: 'number', default: 5000 }, // Reconnect delay (ms)
    binary: { type: 'boolean', default: false }   // Expect binary data
  },

  init() {
    this.ws = null;
    this.dataBuffer = [];
    this.lastUpdate = 0;
    this.reconnectTimer = null;
    this.isConnected = false;
    
    this.connect();
    
    this.el.addEventListener('componentremoved', (evt) => {
      if (evt.detail.name === 'nemosyne-stream') {
        this.disconnect();
      }
    });
  },

  connect() {
    if (!this.data.src || this.ws) return;
    
    try {
      this.ws = new WebSocket(this.data.src);
      
      this.ws.onopen = () => {
        console.log(`Nemosyne Stream: Connected to ${this.data.src}`);
        this.isConnected = true;
        this.el.emit('stream-connected');
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
      
      this.ws.onerror = (error) => {
        console.error('Nemosyne Stream: WebSocket error', error);
        this.el.emit('stream-error', { error });
      };
      
      this.ws.onclose = () => {
        console.log('Nemosyne Stream: Disconnected');
        this.isConnected = false;
        this.el.emit('stream-disconnected');
        
        if (this.data.reconnect) {
          this.reconnectTimer = setTimeout(() => this.connect(), this.data.reconnectInterval);
        }
      };
      
    } catch (err) {
      console.error('Nemosyne Stream: Failed to connect', err);
    }
  },

  handleMessage(data) {
    // Parse based on data type
    let parsed;
    if (this.data.binary && data instanceof Blob) {
      // Handle binary data (protobuf, msgpack, etc.)
      // Would need additional library
      console.warn('Binary data support requires additional library');
      return;
    } else {
      parsed = JSON.parse(data);
    }
    
    // Buffer management
    this.dataBuffer.push(parsed);
    if (this.dataBuffer.length > this.data.buffer) {
      this.dataBuffer.shift();
    }
    
    // Rate limiting
    const now = performance.now();
    if (now - this.lastUpdate < (1000 / this.data.updateRate)) {
      return;
    }
    this.lastUpdate = now;
    
    // Update target artefact
    this.updateArtefact();
  },

  updateArtefact() {
    const target = this.data.artefact;
    if (!target) return;
    
    // Prepare data for artefact
    const updateData = {
      records: this.dataBuffer,
      meta: {
        lastUpdate: new Date().toISOString(),
        bufferSize: this.dataBuffer.length,
        connected: this.isConnected
      }
    };
    
    // Update the dataset
    target.setAttribute('nemosyne-artefact-v2', 'dataset', JSON.stringify(updateData));
  },

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  },

  remove() {
    this.disconnect();
  }
};

/**
 * Time-series buffer for historical data analysis
 */
export class TimeSeriesBuffer {
  constructor(capacity = 1000) {
    this.capacity = capacity;
    this.buffer = new Map(); // Keyed by series ID
  }

  add(seriesId, dataPoint, timestamp = Date.now()) {
    if (!this.buffer.has(seriesId)) {
      this.buffer.set(seriesId, []);
    }
    const series = this.buffer.get(seriesId);
    series.push({ data: dataPoint, timestamp });
    
    // Trim to capacity
    if (series.length > this.capacity) {
      series.shift();
    }
  }

  get(seriesId, count = null) {
    const series = this.buffer.get(seriesId) || [];
    if (count) {
      return series.slice(-count);
    }
    return series;
  }

  getLatest(seriesId) {
    const series = this.buffer.get(seriesId) || [];
    return series[series.length - 1] || null;
  }

  getRange(seriesId, startTime, endTime) {
    const series = this.buffer.get(seriesId) || [];
    return series.filter(p => p.timestamp >= startTime && p.timestamp <= endTime);
  }

  clear(seriesId = null) {
    if (seriesId) {
      this.buffer.delete(seriesId);
    } else {
      this.buffer.clear();
    }
  }
}
