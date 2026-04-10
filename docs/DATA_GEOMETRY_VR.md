# Data Geometry in VR: Nemosyne Implementation Guide

## From Mathematical Abstraction to Spatial Tangibility

**Version:** 1.0.0  
**Based on:** AI assistant recommendations for Mnemosyne library  
**Status:** Implementation Roadmap

---

## Quick Assessment: What's Already Built vs. Needed

| Concept | Status | Implementation Path |
|---------|--------|---------------------|
| **Point clouds** | ✅ Ready | `nemosyne-memory-crystal` is already a point cloud system |
| **Distance metrics** | 🔄 Partial | Connections exist, need distance-based coloring |
| **t-SNE/UMAP terrain** | 🆕 New | New `nemosyne-terrain` component needed |
| **Persistent homology** | 🆕 New | TDA extension with bar visualization |
| **Decision boundaries** | 🆕 New | Voxel/implicit surface renderer |
| **Grasp interaction** | ✅ Ready | Hand tracking in `gestures` branch |
| **Time-travel epochs** | 🔄 Partial | Sync bridge supports temporal updates |
| **Multi-scale browsing** | 🆕 New | Scale zones + LOD system enhancement |

---

## 1. Vector Spaces & Embeddings

### 1.1 Point Clouds as Crystal Systems

**Already Implemented:** `nemosyne-memory-crystal` is exactly this.

**Enhancement: Dense Point Clouds (10k+ points)**

```javascript
// Instanced mesh for performance
AFRAME.registerComponent('nemosyne-point-cloud', {
  schema: {
    points: { type: 'array' }, // [{x,y,z,embedding[]}, ...]
    maxPoints: { default: 50000 }
  },
  
  init() {
    // Use THREE.InstancedMesh for 10k+ points
    const geometry = new THREE.IcosahedronGeometry(0.02, 0);
    const material = new THREE.MeshStandardMaterial({
      color: 0x00d4aa,
      emissive: 0x004433,
      roughness: 0.3,
      metalness: 0.8
    });
    
    this.mesh = new THREE.InstancedMesh(geometry, material, this.data.maxPoints);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    
    // Color per instance
    this.mesh.setColorAt = (i, color) => {
      this.mesh.instanceColor.array[i * 3] = color.r;
      this.mesh.instanceColor.array[i * 3 + 1] = color.g;
      this.mesh.instanceColor.array[i * 3 + 2] = color.b;
    };
    
    this.el.setObject3D('mesh', this.mesh);
    this.updatePoints(this.data.points);
  },
  
  updatePoints(points) {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    
    points.forEach((point, i) => {
      // Position
      dummy.position.set(point.x, point.y, point.z);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      
      // Color from embedding
      if (point.embedding) {
        color.setRGB(
          (point.embedding[0] + 1) * 0.5,
          (point.embedding[1] + 1) * 0.5,
          (point.embedding[2] + 1) * 0.5
        );
        this.mesh.setColorAt(i, color);
      }
    });
    
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
});
```

### 1.2 Distance Metrics as Animated Lines

```javascript
// New component: nemosyne-distance-field
AFRAME.registerComponent('nemosyne-distance-field', {
  schema: {
    sourcePoint: { type: 'vec3' },
    neighbors: { type: 'array' }, // Array of {position, distance, similarity}
    threshold: { default: 0.5 }, // Max distance to show
    animate: { default: true }
  },
  
  init() {
    this.lines = [];
    this.createDistanceLines();
  },
  
  createDistanceLines() {
    const material = new THREE.LineBasicMaterial({
      color: 0x00d4aa,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    
    this.data.neighbors.forEach((neighbor, i) => {
      if (neighbor.distance > this.data.threshold) return;
      
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(this.data.sourcePoint.x, this.data.sourcePoint.y, this.data.sourcePoint.z),
        new THREE.Vector3(neighbor.position.x, neighbor.position.y, neighbor.position.z)
      ]);
      
      const line = new THREE.Line(geometry, material.clone());
      
      // Thickness based on similarity
      line.material.linewidth = Math.max(1, 5 * neighbor.similarity);
      
      // Opacity pulse based on distance
      line.material.opacity = 1 - (neighbor.distance / this.data.threshold);
      
      this.el.object3D.add(line);
      this.lines.push({ line, neighbor });
    });
  },
  
  tick() {
    // Animate lines
    if (this.data.animate) {
      const time = performance.now() * 0.001;
      this.lines.forEach(({ line }, i) => {
        line.material.opacity = 0.3 + 0.3 * Math.sin(time + i);
      });
    }
  }
});
```

### 1.3 Cosine Similarity as Color Gradients

**Enhancement to existing crystal component:**

```javascript
// In nemosyne-memory-crystal.js updateMaterial
updateMaterialFromSimilarity(queryEmbedding) {
  const myEmbedding = this.data.embedding;
  const similarity = this.cosineSimilarity(queryEmbedding, myEmbedding);
  
  // Map similarity to color
  // 1.0 = bright cyan (#00ffff)
  // 0.5 = neutral (#888888)
  // 0.0 = dark red (#440000)
  
  const color = new THREE.Color();
  if (similarity > 0.7) {
    color.setHex(0x00ffff); // Bright cyan
  } else if (similarity > 0.5) {
    color.setHex(0x00d4aa); // Teal
  } else {
    color.setHex(0xff4444); // Red
  }
  
  this.el.setAttribute('material', 'color', color.getHexString());
}

cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
```

---

## 2. Manifolds & Dimensionality Reduction

### 2.1 t-SNE/UMAP as 3D Terrain

```javascript
// New: nemosyne-terrain component
AFRAME.registerComponent('nemosyne-terrain', {
  schema: {
    embeddings: { type: 'array' }, // Array of [x,y,z,embedding[]]
    clusterColors: { type: 'array' },
    heightScale: { default: 2.0 },
    resolution: { default: 64 } // Grid resolution
  },
  
  init() {
    // Generate heightmap from embedding density
    const size = 20;
    const segments = this.data.resolution;
    
    // Create geometry
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    
    // Modify height based on point density
    const positions = geometry.attributes.position;
    
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      
      // Calculate local point density (Gaussian kernel)
      let height = 0;
      this.data.embeddings.forEach(point => {
        const dist = Math.sqrt((point.x - x) ** 2 + (point.z - z) ** 2);
        height += Math.exp(-dist * 2); // Gaussian falloff
      });
      
      // Smooth and scale
      height = Math.log(height + 1) * this.data.heightScale;
      positions.setZ(i, height);
    }
    
    geometry.computeVertexNormals();
    
    // Shader material for terrain
    const material = new THREE.ShaderMaterial({
      vertexShader: `
        varying float vHeight;
        varying vec3 vNormal;
        void main() {
          vHeight = position.z;
          vNormal = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying float vHeight;
        varying vec3 vNormal;
        
        void main() {
          // Height-based coloring
          vec3 lowColor = vec3(0.0, 0.1, 0.2);    // Deep ocean
          vec3 midColor = vec3(0.0, 0.4, 0.3);    // Forest
          vec3 highColor = vec3(0.0, 0.8, 0.8);   // Snow peaks
          
          float t = smoothstep(-2.0, 2.0, vHeight);
          vec3 color = mix(lowColor, midColor, t);
          color = mix(color, highColor, smoothstep(1.0, 2.0, vHeight));
          
          // Simple lighting
          vec3 light = normalize(vec3(1.0, 1.0, 0.5));
          float diff = max(dot(vNormal, light), 0.0);
          
          gl_FragColor = vec4(color * (0.5 + 0.5 * diff), 1.0);
        }
      `,
      wireframe: false
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2; // Lay flat
    this.el.setObject3D('terrain', mesh);
    
    // Add cluster labels on peaks
    this.addClusterLabels();
  },
  
  addClusterLabels() {
    // Find local maxima and place floating labels
    // Using nemosyne-label component
  }
});
```

### 2.2 Geodesic Paths as Curved Tubes

```javascript
// New: nemosyne-geodesic component
AFRAME.registerComponent('nemosyne-geodesic', {
  schema: {
    start: { type: 'vec3' },
    end: { type: 'vec3' },
    controlPoints: { type: 'array' }, // Intermediate points on manifold
    radius: { default: 0.05 }
  },
  
  init() {
    // Create curved tube along geodesic
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(this.data.start.x, this.data.start.y, this.data.start.z),
      ...this.data.controlPoints.map(p => new THREE.Vector3(p.x, p.y, p.z)),
      new THREE.Vector3(this.data.end.x, this.data.end.y, this.data.end.z)
    ]);
    
    const geometry = new THREE.TubeGeometry(curve, 64, this.data.radius, 8, false);
    
    const material = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0x442200,
      transparent: true,
      opacity: 0.8
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Animate texture along tube (flow effect)
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 64, 0);
    gradient.addColorStop(0, 'rgba(255, 170, 0, 0)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(1, 'rgba(255, 170, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    
    material.map = texture;
    
    // Animate
    this.el.setObject3D('geodesic', mesh);
    
    this.animation = {
      update: () => {
        texture.offset.x -= 0.01;
      }
    };
  },
  
  tick() {
    if (this.animation) this.animation.update();
  }
});
```

---

## 3. Topological Data Analysis (TDA)

### 3.1 Persistent Homology as 3D Barcodes

```javascript
// New: nemosyne-barcode component
AFRAME.registerComponent('nemosyne-barcode', {
  schema: {
    bars: { type: 'array' }, // [{birth, death, dimension}, ...]
    maxFiltration: { default: 1.0 }
  },
  
  init() {
    // Persistent homology barcode visualization
    // Each bar represents a topological feature (connected component, loop, void)
    
    const container = new THREE.Group();
    
    this.data.bars.forEach((bar, i) => {
      // Bar extends from birth to death along Y-axis
      const height = bar.death - bar.birth;
      const geometry = new THREE.BoxGeometry(0.1, height, 0.1);
      
      // Color by dimension
      const colors = {
        0: 0x00ff00, // H0: Components (green)
        1: 0x00aaff, // H1: Loops (blue)
        2: 0xff00ff  // H2: Voids (purple)
      };
      
      const material = new THREE.MeshStandardMaterial({
        color: colors[bar.dimension] || 0xffffff,
        emissive: colors[bar.dimension] || 0xffffff,
        emissiveIntensity: 0.3
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = bar.birth + height / 2;
      mesh.position.x = i * 0.15; // Spaced along X
      
      // Animate birth/growth
      mesh.scale.y = 0;
      this.animateBar(mesh, bar.birth * 1000);
      
      container.add(mesh);
    });
    
    this.el.setObject3D('barcode', container);
  },
  
  animateBar(mesh, delay) {
    setTimeout(() => {
      const grow = () => {
        mesh.scale.y = Math.min(1, mesh.scale.y + 0.02);
        if (mesh.scale.y < 1) requestAnimationFrame(grow);
      };
      grow();
    }, delay);
  }
});
```

### 3.2 Mapper Graphs as Node-Link Diagrams

```javascript
// New: nemosyne-mapper-graph component
AFRAME.registerComponent('nemosyne-mapper-graph', {
  schema: {
    nodes: { type: 'array' },
    edges: { type: 'array' },
    layout: { default: 'force' } // 'force' | 'hierarchical'
  },
  
  init() {
    // Force-directed layout in 3D
    this.simulation = this.createForceSimulation();
    
    // Create visual elements
    this.createNodes();
    this.createEdges();
    
    // Start simulation
    this.simulation.on('tick', () => this.updatePositions());
  },
  
  createForceSimulation() {
    // Simplified force simulation
    // In production: use d3-force-3d
    
    const nodes = this.data.nodes.map(n => ({
      ...n,
      x: (Math.random() - 0.5) * 10,
      y: (Math.random() - 0.5) * 10,
      z: (Math.random() - 0.5) * 10,
      vx: 0, vy: 0, vz: 0
    }));
    
    return {
      nodes,
      on: (event, callback) => {
        // Simple physics step
        const step = () => {
          // Repulsion between nodes
          for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
              const dx = nodes[i].x - nodes[j].x;
              const dy = nodes[i].y - nodes[j].y;
              const dz = nodes[i].z - nodes[j].z;
              const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
              if (dist > 0) {
                const force = 50 / (dist * dist);
                nodes[i].vx += dx / dist * force;
                nodes[i].vy += dy / dist * force;
                nodes[i].vz += dz / dist * force;
                nodes[j].vx -= dx / dist * force;
                nodes[j].vy -= dy / dist * force;
                nodes[j].vz -= dz / dist * force;
              }
            }
          }
          
          // Attraction along edges
          this.data.edges.forEach(edge => {
            const source = nodes[edge.source];
            const target = nodes[edge.target];
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const dz = target.z - source.z;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            const force = (dist - 2) * 0.05; // Spring force
            source.vx += dx / dist * force;
            source.vy += dy / dist * force;
            source.vz += dz / dist * force;
            target.vx -= dx / dist * force;
            target.vy -= dy / dist * force;
            target.vz -= dz / dist * force;
          });
          
          // Update positions
          nodes.forEach(n => {
            n.vx *= 0.9; // Damping
            n.vy *= 0.9;
            n.vz *= 0.9;
            n.x += n.vx;
            n.y += n.vy;
            n.z += n.vz;
          });
          
          callback();
          requestAnimationFrame(step);
        };
        step();
      }
    };
  },
  
  createNodes() {
    this.nodeMeshes = [];
    
    this.simulation.nodes.forEach((node, i) => {
      const geometry = new THREE.SphereGeometry(0.2, 16, 16);
      const material = new THREE.MeshStandardMaterial({
        color: this.getClusterColor(node.cluster),
        emissive: this.getClusterColor(node.cluster),
        emissiveIntensity: 0.3
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData = { nodeIndex: i };
      
      this.el.object3D.add(mesh);
      this.nodeMeshes.push(mesh);
    });
  },
  
  createEdges() {
    this.edgeLines = [];
    
    this.data.edges.forEach(edge => {
      const material = new THREE.LineBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.5
      });
      
      const geometry = new THREE.BufferGeometry();
      const line = new THREE.Line(geometry, material);
      
      this.el.object3D.add(line);
      this.edgeLines.push({ line, edge });
    });
  },
  
  updatePositions() {
    // Update node positions
    this.nodeMeshes.forEach((mesh, i) => {
      const node = this.simulation.nodes[i];
      mesh.position.set(node.x, node.y, node.z);
    });
    
    // Update edge positions
    this.edgeLines.forEach(({ line, edge }) => {
      const source = this.simulation.nodes[edge.source];
      const target = this.simulation.nodes[edge.target];
      
      line.geometry.setFromPoints([
        new THREE.Vector3(source.x, source.y, source.z),
        new THREE.Vector3(target.x, target.y, target.z)
      ]);
    });
  }
});
```

---

## 4. Decision Boundaries & Gradients

### 4.1 Classification Regions as Voxel Volumes

```javascript
// New: nemosyne-decision-boundary component
AFRAME.registerComponent('nemosyne-decision-boundary', {
  schema: {
    model: { type: 'string' }, // Model prediction function
    resolution: { default: 32 }, // Voxel grid resolution
    threshold: { default: 0.5 } // Decision boundary threshold
  },
  
  init() {
    // Marching cubes algorithm for implicit surface
    const size = 10;
    const res = this.data.resolution;
    const voxels = new Float32Array(res * res * res);
    
    // Sample model predictions
    for (let x = 0; x < res; x++) {
      for (let y = 0; y < res; y++) {
        for (let z = 0; z < res; z++) {
          const pos = [
            (x / res - 0.5) * size,
            (y / res - 0.5) * size,
            (z / res - 0.5) * size
          ];
          
          // Evaluate decision function
          const prediction = this.evaluateModel(pos);
          voxels[x + y * res + z * res * res] = prediction - this.data.threshold;
        }
      }
    }
    
    // Generate mesh from voxels (simplified marching cubes)
    const geometry = this.marchingCubes(voxels, res, size);
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x00d4aa,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    this.el.setObject3D('boundary', mesh);
  },
  
  evaluateModel(position) {
    // Placeholder: would call actual ML model
    // Return classification probability
    return Math.random(); // Demo
  },
  
  marchingCubes(voxels, resolution, size) {
    // Simplified: return a basic surface
    // Full implementation: use Three.js MarchingCubes geometry
    return new THREE.SphereGeometry(size / 2, 32, 32);
  }
});
```

---

## 5. Mnemosyne-Specific Extensions

### 5.1 Time-Travel Through Training Epochs

**Extend existing sync-bridge:**

```javascript
// Add to sync-bridge.js
class TemporalDataController {
  constructor(adapter) {
    this.adapter = adapter;
    this.epochs = new Map(); // epoch -> crystal data
    this.currentEpoch = 0;
    this.isPlaying = false;
  }
  
  async loadEpoch(epoch) {
    // Query API for snapshot at epoch
    const response = await fetch(`${this.adapter.baseUrl}/api/epoch/${epoch}`);
    this.epochs.set(epoch, await response.json());
    return this.epochs.get(epoch);
  }
  
  play() {
    this.isPlaying = true;
    this.animateEpochs();
  }
  
  async animateEpochs() {
    for (let epoch = 0; epoch < this.epochs.size; epoch++) {
      if (!this.isPlaying) break;
      
      await this.transitionToEpoch(epoch);
      await this.delay(500); // 500ms per epoch
    }
  }
  
  async transitionToEpoch(epoch) {
    const data = this.epochs.get(epoch);
    
    // Animate crystals from current positions
    data.crystals.forEach(crystal => {
      const entity = document.querySelector(`[drawer-id="${crystal.id}"]`);
      if (entity) {
        // Smooth transition
        entity.setAttribute('animation', {
          property: 'position',
          to: crystal.position,
          dur: 500,
          easing: 'easeInOutQuad'
        });
      }
    });
  }
}
```

### 5.2 Multi-Scale Browsing

**Extend LOD system:**

```javascript
// In nemosyne-memory-crystal.js
AFRAME.registerComponent('nemosyne-scale-zone', {
  schema: {
    scales: { default: [0.1, 1.0, 10.0] }, // micro, meso, macro
    current: { default: 1 } // Start at mesoscopic
  },
  
  init() {
    // Create scale zone triggers
    this.createTransitionZones();
  },
  
  createTransitionZones() {
    // Invisible spheres at different scales
    // Stepping into one zooms to that level
    
    this.data.scales.forEach((scale, i) => {
      const zone = document.createElement('a-sphere');
      zone.setAttribute('radius', scale * 0.1);
      zone.setAttribute('material', 'visible: false');
      zone.setAttribute('class', 'clickable');
      
      zone.addEventListener('click', () => {
        this.enterScale(i);
      });
      
      this.el.appendChild(zone);
    });
  },
  
  enterScale(scaleIndex) {
    const targetScale = this.data.scales[scaleIndex];
    const camera = document.querySelector('a-camera');
    
    // Animate camera to appropriate distance
    const currentPos = camera.getAttribute('position');
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(
      camera.object3D.quaternion
    );
    
    camera.setAttribute('animation__zoom', {
      property: 'position',
      to: `${currentPos.x + direction.x * targetScale} ${currentPos.y} ${currentPos.z + direction.z * targetScale}`,
      dur: 1000,
      easing: 'easeInOutQuad'
    });
    
    // Update LOD for all crystals at new scale
    this.emit('scale-changed', { scale: targetScale });
  }
});
```

---

## 6. Implementation Priority

### Phase 1: Core (Week 1)
- [x] Point clouds (already in memory-palace-vr)
- [ ] Dense point clouds (InstancedMesh optimization)
- [ ] Distance lines
- [ ] Cosine similarity coloring

### Phase 2: Manifolds (Week 2)
- [ ] Terrain component for t-SNE/UMAP
- [ ] Geodesic paths
- [ ] Wireframe neighborhoods

### Phase 3: Topology (Week 3)
- [ ] Persistent homology barcodes
- [ ] Mapper graphs
- [ ] Force-directed 3D layout

### Phase 4: Interaction (Week 4)
- [ ] Grasp-to-inspect
- [ ] Scale gesture for zoom
- [ ] Temporal scrubber
- [ ] Multi-scale zones

---

## 7. Performance Considerations

**Instanced Rendering:**
- 10k+ points: `THREE.InstancedMesh`
- 100k+ points: Custom shader + point sprites
- 1M+ points: LOD + spatial partitioning

**GPU Picking:**
```javascript
// Instead of raycasting N objects, render IDs to buffer
const pickingTexture = new THREE.WebGLRenderTarget(1, 1);
const pickingMaterial = new THREE.ShaderMaterial({
  vertexShader: `...`,
  fragmentShader: `void main() {
    gl_FragColor = vec4(id.r, id.g, id.b, 1.0);
  }`
});
```

**Computed Textures:**
- Distance matrices as texture maps
- Real-time updates via shader uniforms

---

*"Mathematics is the art of giving the same name to different things. VR is the art of making those things tangible."*