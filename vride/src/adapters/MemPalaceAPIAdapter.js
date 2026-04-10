/**
 * MemPalace API Adapter for VRIDE
 * 
 * Connects to MemPalace REST API for real-time data access.
 * Replaces the mock adapter with real SQLite database connection.
 */

class MemPalaceAPIAdapter {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:8765';
    this.wsUrl = options.wsUrl || 'ws://localhost:8766';
    this.updateInterval = options.updateInterval || 3000;
    
    this.crystalCache = new Map();
    this.lastSyncTime = 0;
    this.ws = null;
    this.isConnected = false;
  }

  /**
   * Initialize connection and load initial data
   */
  async initialize() {
    console.log('[MemPalaceAPIAdapter] Initializing...');
    
    try {
      // Test connection
      const health = await this.fetchHealth();
      console.log('[MemPalaceAPIAdapter] Health check:', health);
      
      // Load all drawers
      const crystals = await this.loadAllDrawers();
      
      // Setup WebSocket for real-time updates
      this.setupWebSocket();
      
      return crystals;
    } catch (error) {
      console.error('[MemPalaceAPIAdapter] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Fetch health status
   */
  async fetchHealth() {
    const response = await fetch(`${this.baseUrl}/api/health`);
    if (!response.ok) throw new Error('Health check failed');
    return response.json();
  }

  /**
   * Fetch database statistics
   */
  async fetchStats() {
    const response = await fetch(`${this.baseUrl}/api/stats`);
    if (!response.ok) throw new Error('Stats fetch failed');
    return response.json();
  }

  /**
   * Load all drawers with 3D positions
   */
  async loadAllDrawers() {
    console.log('[MemPalaceAPIAdapter] Loading all drawers...');
    
    const response = await fetch(`${this.baseUrl}/api/drawers?positions=true`);
    if (!response.ok) throw new Error('Failed to load drawers');
    
    const data = await response.json();
    
    // Cache crystals
    data.drawers.forEach(crystal => {
      this.crystalCache.set(crystal.data.drawerId, crystal);
    });
    
    this.lastSyncTime = data.timestamp;
    
    console.log(`[MemPalaceAPIAdapter] Loaded ${data.drawers.length} crystals`);
    return data.drawers;
  }

  /**
   * Poll for changes (fallback if WebSocket unavailable)
   */
  async detectChanges() {
    try {
      const response = await fetch(`${this.baseUrl}/api/changes?since=${this.lastSyncTime}`);
      if (!response.ok) return { hasUpdates: false };
      
      const changes = await response.json();
      
      const hasUpdates = changes.modified.length > 0 || changes.deleted.length > 0;
      
      if (hasUpdates) {
        console.log('[MemPalaceAPIAdapter] Changes detected:', {
          modified: changes.modified.length,
          deleted: changes.deleted.length
        });
      }
      
      this.lastSyncTime = changes.timestamp;
      
      return {
        hasUpdates,
        additions: changes.modified.filter(c => !this.crystalCache.has(c.data.drawerId)),
        moves: changes.modified.filter(c => this.crystalCache.has(c.data.drawerId)),
        deletions: changes.deleted,
        timestamp: changes.timestamp
      };
    } catch (error) {
      console.error('[MemPalaceAPIAdapter] Change detection failed:', error);
      return { hasUpdates: false };
    }
  }

  /**
   * Setup WebSocket for real-time updates
   */
  setupWebSocket() {
    if (this.ws) return;
    
    console.log('[MemPalaceAPIAdapter] Connecting WebSocket...');
    
    try {
      this.ws = new WebSocket(this.wsUrl);
      
      this.ws.onopen = () => {
        console.log('[MemPalaceAPIAdapter] WebSocket connected');
        this.isConnected = true;
        this.emit('connected', { timestamp: Date.now() });
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('[MemPalaceAPIAdapter] WebSocket message parse error:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('[MemPalaceAPIAdapter] WebSocket disconnected');
        this.isConnected = false;
        this.emit('disconnected', { timestamp: Date.now() });
        
        // Reconnect after 5 seconds
        setTimeout(() => this.setupWebSocket(), 5000);
      };
      
      this.ws.onerror = (error) => {
        console.error('[MemPalaceAPIAdapter] WebSocket error:', error);
        this.emit('error', { type: 'websocket', error });
      };
    } catch (error) {
      console.error('[MemPalaceAPIAdapter] WebSocket setup failed:', error);
      this.emit('error', { type: 'websocket-setup', error });
    }
  }

  /**
   * Handle WebSocket messages
   */
  handleWebSocketMessage(message) {
    switch (message.type) {
      case 'init':
        console.log('[MemPalaceAPIAdapter] Received initial data:', message.count);
        this.emit('full-sync', { crystals: message.crystals });
        break;
        
      case 'update':
        console.log('[MemPalaceAPIAdapter] Received update:', message.changes);
        
        const changes = message.changes;
        const hasAdditions = changes.modified.some(c => !this.crystalCache.has(c.data.drawerId));
        
        this.emit('changes', {
          additions: changes.modified.filter(c => !this.crystalCache.has(c.data.drawerId)),
          moves: changes.modified.filter(c => this.crystalCache.has(c.data.drawerId)),
          deletions: changes.deleted,
          timestamp: message.timestamp
        });
        
        // Update cache
        changes.modified.forEach(c => {
          this.crystalCache.set(c.data.drawerId, c);
        });
        changes.deleted.forEach(id => {
          this.crystalCache.delete(id);
        });
        break;
    }
  }

  /**
   * Emit events
   */
  emit(eventName, detail) {
    const event = new CustomEvent(eventName, { detail });
    document.dispatchEvent(event);
  }

  /**
   * Get palace structure (wings, rooms, halls)
   */
  async fetchStructure() {
    const response = await fetch(`${this.baseUrl}/api/structure`);
    if (!response.ok) throw new Error('Failed to fetch structure');
    return response.json();
  }

  /**
   * Close connection
   */
  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MemPalaceAPIAdapter;
}
