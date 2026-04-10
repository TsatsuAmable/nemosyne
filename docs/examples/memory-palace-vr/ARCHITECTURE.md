# Memory Palace VR: Technical Architecture

## Real-Time 6DOF VR Datasphere with MemPalace Integration

**Version:** 1.0.0  
**Branch:** `memory-palace-vr`  
**Status:** Implementation Phase

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     MEMORY PALACE VR                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│   │  MemPalace   │◄───►│   Sync       │◄───►│   Nemosyne   │   │
│   │   Backend    │      │   Bridge     │      │   VR View    │   │
│   │   (SQLite)   │      │  (WebSocket) │      │  (A-Frame)   │   │
│   └──────────────┘     └──────────────┘     └──────────────┘   │
│          ▲                                         │            │
│          │                                         │            │
│          │    File Watch / Polling                 │            │
│          │                                         ▼            │
│   ┌──────┴──────────────────────────────────────────────┐       │
│   │                    Update Pipeline                      │       │
│   │  1. DB Change → 2. Diff Calc → 3. Delta Msg → 4. Apply │       │
│   └─────────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 6 Degrees of Freedom (6DOF) Artefacts

### 2.1 The 6DOF Crystal Component

**Degrees of Freedom:**
- **Translation (3):** X, Y, Z position
- **Rotation (3):** Pitch, Yaw, Roll (Euler) or Quaternion
- **Scale (1):** Uniform or non-uniform (bonus)

```typescript
interface Crystal6DOF {
  // Position (meters from origin)
  position: { x: number; y: number; z: number };
  
  // Rotation (quaternion for smooth interpolation)
  rotation: { x: number; y: number; z: number; w: number };
  
  // Scale (1.0 = default)
  scale: { x: number; y: number; z: number };
  
  // Metadata from MemPalace
  data: {
    wingId: string;
    roomId: string;
    hallId: string;
    drawerId: string;
    content: string;
    tags: string[];
    timestamp: number;
    vector: number[]; // Embedding vector for color mapping
  };
  
  // Visualization properties
  visual: {
    geometry: 'octahedron' | 'dodecahedron' | 'icosahedron';
    color: string; // Derived from embedding vector
    emissive: string;
    metalness: number;
    roughness: number;
    pulse: boolean; // Active indicator
  };
  
  // Interaction state
  interaction: {
    isHovered: boolean;
    isSelected: boolean;
    isDragging: boolean;
    lastInteraction: number;
  };
}
```

### 2.2 Spatial Mapping Strategy

```
Memory Palace Structure → VR Space:

Level 1: WINGS (Top-level containers)
├─ Position: Distributed in 3D sphere
├─ Scale: Large (radius ~5m each)
├─ Visual: Crystal clusters with shared color theme
└─ Layout: Force-directed spread

Level 2: ROOMS (Topics within wings)
├─ Position: Orbital rings around parent wing
├─ Scale: Medium (radius ~1m each)
├─ Visual: Ring formations of crystals
└─ Layout: Radial distribution

Level 3: HALLS (Memory corridors)
├─ Position: Connecting paths (bezier curves)
├─ Scale: Linear formations
├─ Visual: Highway-like glowing paths
└─ Layout: Spline interpolation

Level 4: DRAWERS (Individual memories)
├─ Position: Specific 6DOF coordinates
├─ Scale: Individual crystals (~0.1m)
├─ Visual: Unique color from content embedding
└─ Layout: Semantic clustering (t-SNE/PCA)

Level 5: CLOSETS (Compressed summaries)
├─ Position: Aggregated positions
├─ Scale: LOD (Level of Detail) crystals
├─ Visual: Billboard proxies at distance
└─ Layout: Aggregation when >100 children
```

---

## 3. Real-Time Sync Architecture

### 3.1 Change Detection

```typescript
class MemPalaceWatcher {
  private dbPath: string = '~/.mempalace/palace/palace.db';
  private lastChecksum: string = '';
  private pollInterval: number = 1000; // ms
  
  async startWatching(callback: (changes: ChangeSet) => void): Promise<void> {
    // Method 1: File-system watch (SQLite WAL)
    if (this.supportsFSWatch()) {
      this.watchFile(this.dbPath, async () => {
        const changes = await this.detectChanges();
        if (changes.hasUpdates) {
          callback(changes);
        }
      });
    }
    
    // Method 2: Polling fallback
    setInterval(async () => {
      const changes = await this.detectChanges();
      if (changes.hasUpdates) {
        callback(changes);
      }
    }, this.pollInterval);
  }
  
  async detectChanges(): Promise<ChangeSet> {
    // Query for new/modified drawers since last sync
    const newDrawers = await this.query({
      table: 'drawers',
      where: { modified_at: { $gt: this.lastSyncTime } }
    });
    
    const movedDrawers = await this.query({
      table: 'drawers',
      where: { room_id_changed: true }
    });
    
    const deletedDrawers = await this.query({
      table: 'drawers',
      where: { deleted_at: { $gt: this.lastSyncTime } }
    });
    
    return {
      hasUpdates: newDrawers.length > 0 || movedDrawers.length > 0 || deletedDrawers.length > 0,
      additions: newDrawers.map(d => this.toCrystal(d)),
      moves: movedDrawers.map(d => ({ id: d.id, newPosition: this.calculatePosition(d) })),
      deletions: deletedDrawers.map(d => d.id),
      timestamp: Date.now()
    };
  }
}
```

### 3.2 Delta Encoding

**Efficient Network Updates:**

```typescript
interface DeltaMessage {
  type: 'add' | 'update' | 'delete' | 'batch';
  timestamp: number;
  
  // For single updates
  crystal?: Crystal6DOF;
  crystalId?: string;
  
  // For batch updates (most common)
  crystals?: Crystal6DOF[];
  updates?: Partial<Crystal6DOF>[];
  deletions?: string[];
  
  // Metadata
  totalCount: number;
  sequence: number;
  checksum: string;
}

class DeltaEncoder {
  private sequence: number = 0;
  
  encode(changes: ChangeSet): DeltaMessage[] {
    const messages: DeltaMessage[] = [];
    
    // Batch additions in groups of 100
    for (let i = 0; i < changes.additions.length; i += 100) {
      messages.push({
        type: 'batch',
        timestamp: Date.now(),
        crystals: changes.additions.slice(i, i + 100),
        totalCount: changes.additions.length,
        sequence: this.sequence++,
        checksum: this.calculateChecksum(changes.additions)
      });
    }
    
    // Send move updates
    if (changes.moves.length > 0) {
      messages.push({
        type: 'update',
        timestamp: Date.now(),
        updates: changes.moves,
        sequence: this.sequence++,
        checksum: this.calculateChecksum(changes.moves)
      });
    }
    
    // Send deletions
    if (changes.deletions.length > 0) {
      messages.push({
        type: 'delete',
        timestamp: Date.now(),
        deletions: changes.deletions,
        sequence: this.sequence++,
        checksum: this.calculateChecksum(changes.deletions)
      });
    }
    
    return messages;
  }
  
  // Apply delta to existing scene
  applyDelta(scene: Crystal6DOF[], delta: DeltaMessage): Crystal6DOF[] {
    switch (delta.type) {
      case 'add':
        return [...scene, delta.crystal!];
        
      case 'batch':
        return [...scene, ...delta.crystals!];
        
      case 'update':
        return scene.map(c => {
          const update = delta.updates?.find(u => u.id === c.data.drawerId);
          return update ? { ...c, ...update } : c;
        });
        
      case 'delete':
        return scene.filter(c => !delta.deletions?.includes(c.data.drawerId));
    }
  }
}
```

### 3.3 Update Application (Smooth Transitions)

```typescript
class SmoothTransition {
  private duration: number = 500; // ms
  private easing: string = 'easeInOutQuad';
  
  animateTo(crystal: Entity, target: Partial<Crystal6DOF>): void {
    const start = {
      position: crystal.getAttribute('position'),
      rotation: crystal.getAttribute('rotation'),
      scale: crystal.getAttribute('scale')
    };
    
    // Create A-Frame animation
    if (target.position) {
      crystal.setAttribute('animation__position', {
        property: 'position',
        to: `${target.position.x} ${target.position.y} ${target.position.z}`,
        dur: this.duration,
        easing: this.easing
      });
    }
    
    if (target.rotation) {
      crystal.setAttribute('animation__rotation', {
        property: 'rotation',
        to: this.quaternionToEuler(target.rotation),
        dur: this.duration,
        easing: this.easing
      });
    }
    
    if (target.scale) {
      crystal.setAttribute('animation__scale', {
        property: 'scale',
        to: `${target.scale.x} ${target.scale.y} ${target.scale.z}`,
        dur: this.duration,
        easing: this.easing
      });
    }
  }
  
  // Spawn animation for new crystals
  spawn(crystal: Entity): void {
    // Start at 0 scale
    crystal.setAttribute('scale', '0 0 0');
    
    // Animate to full size
    crystal.setAttribute('animation__spawn', {
      property: 'scale',
      to: `${crystal.data.scale.x} ${crystal.data.scale.y} ${crystal.data.scale.z}`,
      dur: 300,
      easing: 'easeOutElastic'
    });
    
    // Add spawn flash
    crystal.setAttribute('animation__flash', {
      property: 'material.emissiveIntensity',
      from: 2.0,
      to: 0.5,
      dur: 500,
      easing: 'easeOutQuad'
    });
  }
  
  // Vanish animation for deletions
  vanish(crystal: Entity): Promise<void> {
    return new Promise((resolve) => {
      // Shrink to nothing
      crystal.setAttribute('animation__vanish', {
        property: 'scale',
        to: '0 0 0',
        dur: 300,
        easing: 'easeInQuad'
      });
      
      // Fade out
      crystal.setAttribute('animation__fade', {
        property: 'material.opacity',
        to: 0,
        dur: 300,
        easing: 'easeInQuad'
      });
      
      setTimeout(() => resolve(), 300);
    });
  }
}
```

---

## 4. Performance Optimizations

### 4.1 Level of Detail (LOD)

```typescript
class LODSystem {
  private levels: LODLevel[] = [
    { distance: 0, geometry: 'icosahedron', segments: 1 },
    { distance: 5, geometry: 'dodecahedron', segments: 0 },
    { distance: 15, geometry: 'octahedron', segments: 0 },
    { distance: 30, geometry: 'billboard', segments: 0 },
    { distance: 100, geometry: 'hidden', segments: 0 }
  ];
  
  updateLOD(crystals: Entity[], cameraPosition: Vec3): void {
    for (const crystal of crystals) {
      const distance = crystal.position.distanceTo(cameraPosition);
      const level = this.getLevelForDistance(distance);
      
      if (crystal.currentLOD !== level) {
        this.applyLOD(crystal, level);
        crystal.currentLOD = level;
      }
    }
  }
  
  private applyLOD(crystal: Entity, level: LODLevel): void {
    if (level.geometry === 'hidden') {
      crystal.setAttribute('visible', false);
    } else if (level.geometry === 'billboard') {
      // Switch to 2D sprite
      crystal.setAttribute('geometry', 'plane');
      crystal.setAttribute('material', 'shader: flat; transparent: true');
      crystal.setAttribute('billboard', true);
    } else {
      crystal.setAttribute('geometry', `primitive: ${level.geometry}`);
      crystal.setAttribute('visible', true);
    }
  }
}
```

### 4.2 Occlusion Culling

```typescript
class OcclusionCulling {
  private frustum: THREE.Frustum;
  private bspTree: BSPTree;
  
  updateVisibleSet(camera: THREE.Camera, crystals: Entity[]): Entity[] {
    // Update frustum from camera
    this.frustum.setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      )
    );
    
    // Quick frustum cull
    const potentiallyVisible = crystals.filter(c => 
      this.frustum.intersectsObject(c)
    );
    
    // Occlusion query for dense areas
    const visible: Entity[] = [];
    for (const crystal of potentiallyVisible) {
      if (!this.isOccluded(crystal, visible)) {
        visible.push(crystal);
      }
    }
    
    return visible;
  }
  
  private isOccluded(crystal: Entity, frontEntities: Entity[]): boolean {
    // Ray cast from camera to crystal
    // If intersects closer opaque entity, occluded
  }
}
```

### 4.3 Spatial Partitioning

```typescript
class SpatialHash {
  private cellSize: number = 2.0; // meters
  private cells: Map<string, Entity[]> = new Map();
  
  insert(crystal: Entity): void {
    const cell = this.getCell(crystal.position);
    const key = `${cell.x},${cell.y},${cell.z}`;
    
    if (!this.cells.has(key)) {
      this.cells.set(key, []);
    }
    this.cells.get(key)?.push(crystal);
  }
  
  queryRadius(center: Vec3, radius: number): Entity[] {
    const results: Entity[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    
    const originCell = this.getCell(center);
    
    for (let x = -cellRadius; x <= cellRadius; x++) {
      for (let y = -cellRadius; y <= cellRadius; y++) {
        for (let z = -cellRadius; z <= cellRadius; z++) {
          const key = `${originCell.x + x},${originCell.y + y},${originCell.z + z}`;
          const cell = this.cells.get(key);
          if (cell) {
            for (const entity of cell) {
              if (entity.position.distanceTo(center) <= radius) {
                results.push(entity);
              }
            }
          }
        }
      }
    }
    
    return results;
  }
}
```

---

## 5. API and Configuration

### 5.1 Component Interface

```html
<!-- Usage Example -->
<a-scene>
  <nemosyne-memory-palace
    db-path="~/.mempalace/palace/palace.db"
    sync-mode="realtime"
    update-interval="1000"
    lod-distance="[5, 15, 30, 100]"
    max-visible="1000"
    layout="semantic"
    color-map="embedding"
    interactive="true">
  </nemosyne-memory-palace>
  
  <!-- Individual crystal with 6DOF -->
  <nemosyne-memory-crystal
    position="2 1.6 -3"
    rotation="0 45 0"
    scale="1 1 1"
    drawer-id="abc123"
    wing="projects"
    room="nemosyne"
    content="VR IDE architecture..."
    tags="["architecture", "vride"]"
    pulse="true">
  </nemosyne-memory-crystal>
</a-scene>
```

### 5.2 JavaScript API

```typescript
interface MemoryPalaceVRConfig {
  // Connection
  dbPath: string;
  syncMode: 'realtime' | 'polling' | 'manual';
  pollInterval?: number;
  
  // Visualization
  layout: 'semantic' | 'chronological' | 'hierarchical' | 'force';
  colorMap: 'embedding' | 'wing' | 'age' | 'tags';
  scaleMode: 'uniform' | 'content-length' | 'importance';
  
  // Performance
  maxVisibleCrystals: number;
  lodDistances: number[];
  enableCulling: boolean;
  
  // Interaction
  interactive: boolean;
  hoverEffect: 'glow' | 'scale' | 'label';
  selectAction: 'preview' | 'expand' | 'teleport';
}

class MemoryPalaceVR extends HTMLElement {
  config: MemoryPalaceVRConfig;
  crystals: Map<string, Crystal6DOF>;
  
  // Public API
  refresh(): Promise<void>;
  flyTo(drawerId: string): Promise<void>;
  filter(query: string): void;
  highlight(wingId?: string, roomId?: string): void;
  
  // Events
  onCrystalHover: (crystal: Crystal6DOF) => void;
  onCrystalSelect: (crystal: Crystal6DOF) => void;
  onCrystalCreated: (crystal: Crystal6DOF) => void;
  onCrystalDeleted: (drawerId: string) => void;
}
```

---

## 6. Implementation Phases

### Phase 1: Foundation (Today)
- [ ] 6DOF Crystal component
- [ ] MemPalace database adapter
- [ ] Static scene rendering (895 drawers)
- [ ] Basic LOD system

### Phase 2: Sync (Tomorrow)
- [ ] File watcher for DB changes
- [ ] Delta encoding/decoder
- [ ] Smooth transition animations
- [ ] WebSocket bridge (optional)

### Phase 3: Interaction (This Week)
- [ ] Hover effects
- [ ] Selection and preview
- [ ] Teleport navigation
- [ ] Filter and search

### Phase 4: Polish (Next Week)
- [ ] Performance optimization
- [ ] Visual polish (glow, particles)
- [ ] Audio spatialization
- [ ] Deploy to nemosyne.world

---

## 7. Quick Start

```bash
# 1. Navigate to example
cd examples/memory-palace-vr

# 2. Install dependencies
npm install

# 3. Configure MemPalace path
export MEMPALACE_PATH="$HOME/.mempalace/palace"

# 4. Run dev server
npm run dev

# 5. Open in VR headset
# http://localhost:5173
```

---

*"Memory made spatial, data made embodied."*
