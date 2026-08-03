import * as THREE from 'three';

/**
 * Lightweight topological-data-analysis visual summaries.
 *
 * These are decorative/science overlays rather than full TDA computations.
 * They attach to an artifact group and give users a quick visual cue of
 * topological structure (connected components, holes, persistence).
 */
export class TDAGlyphs {
  /**
   * Persistence barcode: horizontal lines from birth to death, stacked by dimension.
   * intervals: [{ birth, death, dimension }]
   */
  static persistenceBarcode(intervals, options = {}) {
    const {
      width = 1.6,
      height = 0.6,
      yOffset = 1.2,
      colors = [0x00ffcc, 0xff00cc, 0xccff00],
    } = options;

    const group = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });

    if (!intervals?.length) {
      // No data: show an empty frame.
      const frame = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(width, height)),
        mat
      );
      frame.position.y = yOffset;
      group.add(frame);
      return group;
    }

    const maxDeath = Math.max(...intervals.map((i) => i.death));
    const byDim = {};
    for (const iv of intervals) {
      if (!byDim[iv.dimension]) byDim[iv.dimension] = [];
      byDim[iv.dimension].push(iv);
    }

    const dims = Object.keys(byDim)
      .map(Number)
      .sort((a, b) => a - b);
    const rowH = height / Math.max(1, dims.length);

    dims.forEach((dim, dimIdx) => {
      const rowY = yOffset + height / 2 - (dimIdx + 0.5) * rowH;
      const color = colors[dim % colors.length];
      const rowMat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
      });

      for (const iv of byDim[dim]) {
        const x1 = (iv.birth / maxDeath - 0.5) * width;
        const x2 = (iv.death / maxDeath - 0.5) * width;
        const geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x1, rowY, 0),
          new THREE.Vector3(x2, rowY, 0),
        ]);
        group.add(new THREE.Line(geo, rowMat));
      }
    });

    return group;
  }

  /**
   * Mapper graph preview: nodes placed in a circle, edges as lines.
   * nodes: [{ id }]
   * edges: [{ source, target }]
   */
  static mapperGraph(nodes = [], edges = [], options = {}) {
    const { radius = 0.7, yOffset = 1.2, nodeColor = 0x00ffcc, edgeColor = 0x88ccff } = options;

    const group = new THREE.Group();
    const positions = [];
    const nodeMeshes = [];
    const nodeGeo = new THREE.SphereGeometry(0.04, 12, 12);
    const nodeMat = new THREE.MeshBasicMaterial({ color: nodeColor });
    const edgeMat = new THREE.LineBasicMaterial({
      color: edgeColor,
      transparent: true,
      opacity: 0.5,
    });

    const n = nodes.length || 1;
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const pos = new THREE.Vector3(x, yOffset, z);
      positions.push(pos);

      const mesh = new THREE.Mesh(nodeGeo, nodeMat.clone());
      mesh.position.copy(pos);
      mesh.userData = { row: nodes[i] };
      group.add(mesh);
      nodeMeshes.push(mesh);
    }

    for (const e of edges) {
      const srcIdx = nodes.findIndex((n) => n.id === e.source);
      const dstIdx = nodes.findIndex((n) => n.id === e.target);
      if (srcIdx < 0 || dstIdx < 0) continue;
      const geo = new THREE.BufferGeometry().setFromPoints([
        positions[srcIdx].clone(),
        positions[dstIdx].clone(),
      ]);
      group.add(new THREE.Line(geo, edgeMat));
    }

    return group;
  }

  /**
   * Betti curve: simple line plot of Betti numbers across a filter parameter.
   * points: [{ x, b0, b1, b2 }]
   */
  static bettiCurve(points = [], options = {}) {
    const {
      width = 1.6,
      height = 0.6,
      yOffset = 1.2,
      colors = [0x00ffcc, 0xff00cc, 0xccff00],
    } = options;

    const group = new THREE.Group();
    if (points.length < 2) return group;

    const xs = points.map((p) => p.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const maxB = Math.max(...points.flatMap((p) => [p.b0 ?? 0, p.b1 ?? 0, p.b2 ?? 0]), 1);

    const dims = [
      { key: 'b0', idx: 0 },
      { key: 'b1', idx: 1 },
      { key: 'b2', idx: 2 },
    ];

    for (const { key, idx } of dims) {
      const mat = new THREE.LineBasicMaterial({
        color: colors[idx % colors.length],
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
      });
      const linePoints = points
        .filter((p) => Number.isFinite(p[key]))
        .map((p) => {
          const nx = maxX === minX ? 0 : (p.x - minX) / (maxX - minX) - 0.5;
          const ny = p[key] / maxB - 0.5;
          return new THREE.Vector3(nx * width, yOffset + ny * height, 0);
        });
      if (linePoints.length < 2) continue;
      const geo = new THREE.BufferGeometry().setFromPoints(linePoints);
      group.add(new THREE.Line(geo, mat));
    }

    return group;
  }
}
