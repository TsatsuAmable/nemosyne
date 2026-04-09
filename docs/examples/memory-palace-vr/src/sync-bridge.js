/**
 * Sync Bridge: Real-time connection between MemPalace and VR scene
 * 
 * Features:
 * - File watching for database changes
 * - Polling fallback
 * - Delta encoding/decoding
 * - Smooth transitions for updates
 * - Connection status management
 */

class SyncBridge extends EventTarget {
  constructor(options = {}) {
    super();
    
    this.adapter = options.adapter || new MemPalaceAdapter(options);
    this.updateInterval = options.updateInterval || 2000;
    this.mode = options.mode || 'auto'; // 'realtime', 'polling', 'manual'
    
    this.isConnected = false;
    this.isWatching = false;
    this.lastUpdateTime = 0;
    
    this.onCrystalCreated = options.onCrystalCreated || (() => {});
    this.onCrystalUpdated = options.onCrystalUpdated || (() => {});
    this.onCrystalDeleted = options.onCrystalDeleted || (() => {});
    
    this.checksum = '';
    this.sequence = 0;
  }

  /**
   * Start watching for changes
   */
  async start() {
    console.log('[SyncBridge] Starting...');
    
    // Initial load
    await this.fullSync();
    
    // Start watching based on mode
    if (this.mode === 'realtime' || this.mode === 'auto') {
      this.startWatching();
    }
    
    this.isConnected = true;
    this.emit('connected', { timestamp: Date.now() });
  }

  /**
   * Stop watching
   */
  stop() {
    console.log('[SyncBridge] Stopping...');
    this.isWatching = false;
    
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
    
    if (this.watchObserver) {
      this.watchObserver.disconnect();
      this.watchObserver = null;
    }
    
    this.isConnected = false;
    this.emit('disconnected', { timestamp: Date.now() });
  }

  /**
   * Full sync: Load all data
   */
  async fullSync() {
    console.log('[SyncBridge] Performing full sync...');
    
    try {
      const crystals = await this.adapter.loadAllDrawers();
      
      this.emit('full-sync', {
        crystals: crystals,
        count: crystals.length,
        timestamp: Date.now()
      });
      
      this.lastUpdateTime = Date.now();
      this.sequence = 0;
      
      return crystals;
    } catch (error) {
      console.error('[SyncBridge] Full sync failed:', error);
      this.emit('error', { type: 'full-sync', error });
      throw error;
    }
  }

  /**
   * Start file watching (or polling fallback)
   */
  startWatching() {
    if (this.isWatching) return;
    
    this.isWatching = true;
    console.log(`[SyncBridge] Watching started (mode: ${this.mode})`);
    
    // Try File System Access API if available
    if (typeof window !== 'undefined' && 'FileSystemObserver' in window) {
      this.setupFileObserver();
    } else {
      // Fall back to polling
      this.setupPolling();
    }
    
    // Also listen for custom events (for testing/manual triggers)
    document?.addEventListener('mempalace-update', (e) => {
      this.handleExternalUpdate(e.detail);
    });
  }

  /**
   * Setup File System Observer (experimental)
   */
  setupFileObserver() {
    // This is experimental and may not be available
    // For now, use polling
    this.setupPolling();
  }

  /**
   * Setup polling fallback
   */
  setupPolling() {
    console.log(`[SyncBridge] Polling every ${this.updateInterval}ms`);
    
    this.watchInterval = setInterval(async () => {
      await this.checkForChanges();
    }, this.updateInterval);
  }

  /**
   * Check for changes and emit deltas
   */
  async checkForChanges() {
    try {
      const changes = await this.adapter.detectChanges();
      
      if (changes.hasUpdates) {
        console.log('[SyncBridge] Changes detected:', {
          additions: changes.additions.length,
          moves: changes.moves.length,
          updates: changes.updates.length,
          deletions: changes.deletions.length
        });
        
        this.applyChanges(changes);
        this.lastUpdateTime = changes.timestamp;
      }
    } catch (error) {
      console.error('[SyncBridge] Change detection failed:', error);
      this.emit('error', { type: 'polling', error });
    }
  }

  /**
   * Apply changes to scene
   */
  applyChanges(changes) {
    // Process additions
    for (const crystal of changes.additions) {
      this.sequence++;
      this.emit('crystal-created', {
        crystal: crystal,
        sequence: this.sequence,
        timestamp: changes.timestamp
      });
      this.onCrystalCreated(crystal);
    }
    
    // Process updates (moves + property changes)
    const allUpdates = [...changes.moves, ...changes.updates];
    for (const update of allUpdates) {
      this.sequence++;
      this.emit('crystal-updated', {
        update: update,
        sequence: this.sequence,
        timestamp: changes.timestamp
      });
      this.onCrystalUpdated(update);
    }
    
    // Process deletions
    for (const drawerId of changes.deletions) {
      this.sequence++;
      this.emit('crystal-deleted', {
        drawerId: drawerId,
        sequence: this.sequence,
        timestamp: changes.timestamp
      });
      this.onCrystalDeleted(drawerId);
    }
  }

  /**
   * Handle external update events (for testing or manual triggers)
   */
  handleExternalUpdate(data) {
    if (!data) return;
    
    switch (data.type) {
      case 'crystal-created':
        this.emit('crystal-created', { crystal: data.crystal });
        break;
      case 'crystal-updated':
        this.emit('crystal-updated', { update: data.update });
        break;
      case 'crystal-deleted':
        this.emit('crystal-deleted', { drawerId: data.drawerId });
        break;
      case 'full-sync':
        this.emit('full-sync', { crystals: data.crystals });
        break;
    }
  }

  /**
   * Trigger manual refresh
   */
  async refresh() {
    return await this.fullSync();
  }

  /**
   * Simulate a new crystal (for testing)
   */
  simulateNewCrystal() {
    const crystal = this.adapter.generateRandomCrystal();
    
    // Add spatial position
    this.adapter.calculateSpatialLayout([crystal]);
    
    this.handleExternalUpdate({
      type: 'crystal-created',
      crystal: crystal
    });
    
    console.log('[SyncBridge] Simulated new crystal:', crystal.data.drawerId);
  }

  /**
   * Emit events (compatible with EventTarget)
   */
  emit(eventName, detail = {}) {
    const event = new CustomEvent(eventName, { detail });
    this.dispatchEvent(event);
    
    // Also log for debugging
    console.log(`[SyncBridge] Event: ${eventName}`, detail);
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      isWatching: this.isWatching,
      lastUpdateTime: this.lastUpdateTime,
      mode: this.mode,
      sequence: this.sequence
    };
  }

  /**
   * Pause syncing temporarily
   */
  pause() {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
    console.log('[SyncBridge] Paused');
  }

  /**
   * Resume syncing
   */
  resume() {
    if (this.isWatching && !this.watchInterval) {
      this.setupPolling();
      console.log('[SyncBridge] Resumed');
    }
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SyncBridge;
}
