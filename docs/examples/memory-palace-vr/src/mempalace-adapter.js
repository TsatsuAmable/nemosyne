/**
 * MemPalace Adapter: Bridge between SQLite DB and Nemosyne format
 * 
 * Handles:
 * - Database connection and querying
 * - Spatial position calculation (t-SNE/semantic clustering)
 * - Color mapping from embeddings
 * - Change detection
 * - Delta encoding
 */

class MemPalaceAdapter {
  constructor(config = {}) {
    this.dbPath = config.dbPath || `${process.env.HOME}/.mempalace/palace/palace.db`;
    this.centroid = { x: 0, y: 1.6, z: -2 }; // Standing eye level
    
    // Spatial layout configuration
    this.layoutConfig = {
      wingRadius: 5.0,
      roomRadius: 1.5,
      hallSpacing: 0.5,
      crystalSize: 0.1,
      colorMap: 'embedding' // 'embedding' | 'wing' | 'age' | 'tags'
    };
    
    this.lastSyncTime = 0;
    this.crystalCache = new Map();
  }

  /**
   * Load all drawers from MemPalace and convert to crystals
   */
  async loadAllDrawers() {
    const query = `
      SELECT 
        d.id as drawer_id,
        d.wing_id,
        d.room_id,
        d.hall_id,
        d.content,
        d.created_at,
        d.modified_at,
        d.embedding,
        w.name as wing_name,
        r.name as room_name,
        h.name as hall_name
      FROM drawers d
      LEFT JOIN wings w ON d.wing_id = w.id
      LEFT JOIN rooms r ON d.room_id = r.id
      LEFT JOIN halls h ON d.hall_id = h.id
      WHERE d.deleted_at IS NULL
      ORDER BY d.wing_id, d.room_id, d.hall_id, d.created_at DESC
      LIMIT 1000
    `;
    
    try {
      // For browser environment, we'll use a REST API or IndexedDB
      // For now, return mock data structure that matches expected format
      const drawers = await this.fetchDrawers();
      const crystals = drawers.map(d => this.drawerToCrystal(d));
      
      // Calculate spatial positions (semantic clustering)
      this.calculateSpatialLayout(crystals);
      
      // Cache for delta comparison
      crystals.forEach(c => this.crystalCache.set(c.data.drawerId, c));
      
      return crystals;
    } catch (error) {
      console.error('[MemPalaceAdapter] Failed to load drawers:', error);
      return this.getSampleCrystals(); // Fallback
    }
  }

  /**
   * Mock drawer data (for development)
   * In production, this would query SQLite via REST API or WASM
   */
  async fetchDrawers() {
    // Generate sample data matching MemPalace structure
    const wings = ['projects', 'research', 'conversations', 'ideas', 'tasks'];
    const rooms = {
      'projects': ['nemosyne', 'vride', 'mempalace', 'gestures'],
      'research': ['vr-ux', 'data-viz', 'ai-memory'],
      'conversations': ['clawdia', 'user-t', 'team-sync'],
      'ideas': ['brainstorms', 'future', 'integrations'],
      'tasks': ['current', 'backlog', 'completed']
    };
    
    const drawers = [];
    let id = 0;
    
    for (const wing of wings) {
      for (const room of rooms[wing] || ['general']) {
        const drawerCount = 10 + Math.floor(Math.random() * 20);
        
        for (let i = 0; i < drawerCount; i++) {
          id++;
          drawers.push({
            drawer_id: `drawer-${wing}-${room}-${id}`,
            wing_id: wing,
            room_id: room,
            hall_id: null,
            content: this.generateSampleContent(wing, room),
            created_at: Date.now() - Math.random() * 10000000,
            modified_at: Date.now() - Math.random() * 1000000,
            embedding: this.generateSampleEmbedding(wing, room),
            wing_name: wing,
            room_name: room,
            hall_name: null
          });
        }
      }
    }
    
    console.log(`[MemPalaceAdapter] Generated ${drawers.length} sample drawers`);
    return drawers;
  }

  /**
   * Convert MemPalace drawer to Nemosyne 6DOF crystal
   */
  drawerToCrystal(drawer) {
    const embedding = drawer.embedding || this.generateSampleEmbedding(drawer.wing_id, drawer.room_id);
    
    return {
      data: {
        drawerId: drawer.drawer_id,
        wingId: drawer.wing_id,
        roomId: drawer.room_id,
        hallId: drawer.hall_id,
        content: drawer.content,
        tags: [drawer.wing_id, drawer.room_id].filter(Boolean),
        timestamp: drawer.created_at,
        vector: embedding
      },
      position: { x: 0, y: 0, z: 0 }, // Will be calculated
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
      visual: {
        geometry: this.selectGeometry(drawer.wing_id),
        color: this.embeddingToColor(embedding),
        emissive: this.embeddingToEmissive(embedding),
        metalness: 0.8,
        roughness: 0.2,
        pulse: this.isRecent(drawer.modified_at)
      },
      interaction: {
        isHovered: false,
        isSelected: false,
        isDragging: false,
        lastInteraction: 0
      }
    };
  }

  /**
   * Calculate spatial positions for semantic clustering
   */
  calculateSpatialLayout(crystals) {
    // Group by wing for major positioning
    const wingGroups = this.groupBy(crystals, c => c.data.wingId);
    
    // Arrange wings in a sphere
    const wings = Object.keys(wingGroups);
    const wingPositions = this.distributeOnSphere(wings.length, 10);
    
    wings.forEach((wingId, index) => {
      const wingCenter = wingPositions[index];
      const wingCrystals = wingGroups[wingId];
      
      // Group by room within wing
      const roomGroups = this.groupBy(wingCrystals, c => c.data.roomId);
      const rooms = Object.keys(roomGroups);
      
      // Arrange rooms around wing center
      const roomPositions = this.distributeInRing(rooms.length, wingCenter, 3);
      
      rooms.forEach((roomId, rIndex) => {
        const roomCenter = roomPositions[rIndex];
        const roomCrystals = roomGroups[roomId];
        
        // Arrange individual crystals in semantic clusters
        this.arrangeCrystals(roomCrystals, roomCenter);
      });
    });
  }

  /**
   * Arrange crystals in semantic clusters using simple force simulation
   */
  arrangeCrystals(crystals, center) {
    const count = crystals.length;
    
    // For small groups, arrange in circle
    if (count <= 10) {
      const radius = 0.5;
      crystals.forEach((crystal, i) => {
        const angle = (i / count) * Math.PI * 2;
        crystal.position = {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(i / 3) * 0.2, // Slight vertical variation
          z: center.z + Math.sin(angle) * radius
        };
        
        // Add some random rotation for visual interest
        crystal.rotation = {
          x: Math.random() * 0.2,
          y: Math.random() * Math.PI * 2,
          z: Math.random() * 0.2,
          w: 1
        };
      });
    } else {
      // For larger groups, use grid + noise for organic feel
      const cols = Math.ceil(Math.sqrt(count));
      const spacing = this.layoutConfig.crystalSize * 3;
      
      crystals.forEach((crystal, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        
        // Base position in grid
        const baseX = (col - cols / 2) * spacing;
        const baseZ = (row - Math.ceil(count / cols) / 2) * spacing;
        
        // Add organic noise
        const noise = () => (Math.random() - 0.5) * spacing * 0.5;
        
        crystal.position = {
          x: center.x + baseX + noise(),
          y: center.y + Math.sin(i * 0.1) * 0.3,
          z: center.z + baseZ + noise()
        };
        
        crystal.rotation = {
          x: (Math.random() - 0.5) * 0.5,
          y: Math.random() * Math.PI * 2,
          z: (Math.random() - 0.5) * 0.5,
          w: 1
        };
      });
    }
  }

  /**
   * Detect changes since last sync
   */
  async detectChanges() {
    const currentTime = Date.now();
    
    // In production, query DB for modified > lastSyncTime
    // For now, simulate changes
    const changes = {
      hasUpdates: false,
      additions: [],
      moves: [],
      updates: [],
      deletions: [],
      timestamp: currentTime
    };
    
    // Randomly add a new crystal (simulation)
    if (Math.random() > 0.9) {
      const newCrystal = this.generateRandomCrystal();
      changes.additions.push(newCrystal);
      changes.hasUpdates = true;
    }
    
    this.lastSyncTime = currentTime;
    return changes;
  }

  /**
   * Generate delta messages from changes
   */
  encodeDeltas(changes) {
    const messages = [];
    
    if (changes.additions.length > 0) {
      messages.push({
        type: 'batch',
        timestamp: changes.timestamp,
        crystals: changes.additions,
        totalCount: changes.additions.length
      });
    }
    
    if (changes.moves.length > 0) {
      messages.push({
        type: 'update',
        timestamp: changes.timestamp,
        updates: changes.moves
      });
    }
    
    if (changes.deletions.length > 0) {
      messages.push({
        type: 'delete',
        timestamp: changes.timestamp,
        deletions: changes.deletions
      });
    }
    
    return messages;
  }

  /**
   * Convert embedding vector to color
   */
  embeddingToColor(embedding) {
    if (!embedding || embedding.length < 3) {
      return '#00d4aa';
    }
    
    // Use first 3 dimensions for RGB
    const r = Math.floor((embedding[0] + 1) * 127.5);
    const g = Math.floor((embedding[1] + 1) * 127.5);
    const b = Math.floor((embedding[2] + 1) * 127.5);
    
    // Clamp
    const clamp = (v) => Math.max(0, Math.min(255, v));
    
    return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;
  }

  /**
   * Convert embedding to emissive color (brighter version)
   */
  embeddingToEmissive(embedding) {
    const color = this.embeddingToColor(embedding);
    return color; // Same color, different intensity
  }

  /**
   * Select geometry type based on wing/category
   */
  selectGeometry(wingId) {
    const geometryMap = {
      'projects': 'octahedron',
      'research': 'dodecahedron',
      'conversations': 'icosahedron',
      'ideas': 'sphere',
      'tasks': 'box'
    };
    return geometryMap[wingId] || 'octahedron';
  }

  /**
   * Utility: Distribute points on sphere surface
   */
  distributeOnSphere(n, radius) {
    const positions = [];
    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle
    
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2; // y goes from 1 to -1
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phi * i;
      
      const x = Math.cos(theta) * radiusAtY * radius;
      const z = Math.sin(theta) * radiusAtY * radius;
      
      positions.push({
        x: x + this.centroid.x,
        y: y * radius + this.centroid.y,
        z: z + this.centroid.z
      });
    }
    
    return positions;
  }

  /**
   * Utility: Distribute points in a ring
   */
  distributeInRing(n, center, radius) {
    const positions = [];
    
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2;
      positions.push({
        x: center.x + Math.cos(angle) * radius,
        y: center.y,
        z: center.z + Math.sin(angle) * radius
      });
    }
    
    return positions;
  }

  /**
   * Utility: Group array by key
   */
  groupBy(array, keyFn) {
    return array.reduce((groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {});
  }

  /**
   * Generate sample content
   */
  generateSampleContent(wing, room) {
    const contents = {
      'nemosyne': 'VR framework for data visualization',
      'vride': 'VR IDE for spatial development',
      'mempalace': 'AI memory storage system',
      'gestures': 'Hand tracking and gesture recognition',
      'vr-ux': 'User experience research in VR',
      'clawdia': 'Conversations with AI assistant'
    };
    return contents[room] || `${wing}/${room} content`;
  }

  /**
   * Generate sample embedding
   */
  generateSampleEmbedding(wing, room) {
    // Create deterministic pseudo-embeddings based on wing/room
    const hash = (str) => {
      let h = 0;
      for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h = h & h;
      }
      return h;
    };
    
    const wingHash = hash(wing);
    const roomHash = hash(room);
    
    return [
      (wingHash % 200 - 100) / 100,
      (roomHash % 200 - 100) / 100,
      ((wingHash + roomHash) % 200 - 100) / 100,
      ((wingHash * roomHash) % 200 - 100) / 100
    ];
  }

  /**
   * Check if drawer is recently modified
   */
  isRecent(timestamp) {
    const oneDay = 24 * 60 * 60 * 1000;
    return (Date.now() - timestamp) < oneDay;
  }

  /**
   * Generate random crystal (for simulation)
   */
  generateRandomCrystal() {
    const wings = ['projects', 'research', 'conversations'];
    const wing = wings[Math.floor(Math.random() * wings.length)];
    
    return this.drawerToCrystal({
      drawer_id: `new-${Date.now()}`,
      wing_id: wing,
      room_id: 'new-items',
      hall_id: null,
      content: 'Newly added content',
      created_at: Date.now(),
      modified_at: Date.now(),
      embedding: this.generateSampleEmbedding(wing, 'new'),
      wing_name: wing,
      room_name: 'new-items'
    });
  }

  /**
   * Sample crystals for fallback/demo
   */
  getSampleCrystals() {
    const samples = [];
    
    for (let i = 0; i < 50; i++) {
      const wing = ['projects', 'research', 'conversations'][i % 3];
      const room = ['alpha', 'beta', 'gamma'][Math.floor(i / 10) % 3];
      
      samples.push(this.drawerToCrystal({
        drawer_id: `sample-${i}`,
        wing_id: wing,
        room_id: room,
        content: `Sample memory ${i}`,
        created_at: Date.now() - i * 100000,
        embedding: this.generateSampleEmbedding(wing, room)
      }));
    }
    
    this.calculateSpatialLayout(samples);
    return samples;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MemPalaceAdapter;
}
