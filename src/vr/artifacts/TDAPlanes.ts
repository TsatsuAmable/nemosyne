/**
 * World-space VR panels that visualise TDA summaries from `TDAMapper`.
 *
 * - Persistence barcode
 * - Mapper graph
 * - Betti-0 curve
 *
 * Each panel is a ChartPlane-style canvas texture so it integrates cleanly
 * with the dashboard wall and snap zones planned for Phase 9.
 */

import * as THREE from 'three';
import type { Dataset } from '../../data/Dataset.ts';
import type { AtlasCore } from '../../atlas/AtlasCore.ts';

const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 768;
const MARGIN = { top: 70, right: 60, bottom: 80, left: 90 };

export interface PersistenceInterval {
  birth: number;
  death: number | null;
}

export interface MapperNode {
  id: unknown;
  filterCenter: number;
  size: number;
}

export interface MapperGraph {
  nodes: MapperNode[];
  edges: [unknown, unknown][];
}

export interface BettiPoint {
  radius: number;
  betti0: number;
}

interface CanvasTextureSet {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
}

interface TDAPlaneOptions {
  width?: number;
  height?: number;
  worldSize?: [number, number];
  title?: string;
}

interface ChartRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PanelWithUpdate<T> {
  mesh: THREE.Mesh;
  update: (data: T) => void;
}

function createCanvasTexture(width: number, height: number): CanvasTextureSet {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return { canvas, ctx, texture };
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, title: string): void {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(4, 12, 24, 0.94)';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#00ffcc';
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, w - 24, h - 24);

  ctx.fillStyle = 'rgba(0, 255, 204, 0.03)';
  for (let y = 0; y < h; y += 8) {
    ctx.fillRect(0, y, w, 2);
  }

  ctx.font = 'bold 32px monospace';
  ctx.fillStyle = '#00ffcc';
  ctx.textAlign = 'center';
  ctx.fillText(`// ${title}`, w / 2, 44);
  ctx.textAlign = 'left';
}

function chartRect(w: number, h: number): ChartRect {
  return {
    x: MARGIN.left,
    y: MARGIN.top,
    width: w - MARGIN.left - MARGIN.right,
    height: h - MARGIN.top - MARGIN.bottom,
  };
}

/**
 * Build a persistence barcode panel.
 */
export function buildPersistencePlane(options: TDAPlaneOptions = {}): PanelWithUpdate<PersistenceInterval[]> {
  const {
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    worldSize = [1.6, 1.2],
    title = 'Persistence Barcode',
  } = options;
  const { ctx, texture } = createCanvasTexture(width, height);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldSize[0], worldSize[1]), material);
  mesh.name = 'tda-persistence-plane';

  function update(intervals: PersistenceInterval[]): void {
    drawBackground(ctx, width, height, title);
    const rect = chartRect(width, height);
    const finite = intervals.filter((i): i is PersistenceInterval & { death: number } =>
      i.death != null && Number.isFinite(i.death)
    );
    if (finite.length === 0) {
      texture.needsUpdate = true;
      return;
    }
    const min = Math.min(...finite.map((i) => i.birth));
    const max = Math.max(...finite.map((i) => i.death), min + 1);
    const range = max - min;
    const rowHeight = rect.height / Math.max(1, finite.length);

    ctx.strokeStyle = '#88ccff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y + rect.height);
    ctx.lineTo(rect.x + rect.width, rect.y + rect.height);
    ctx.stroke();

    finite.sort((a, b) => b.death - b.birth - (a.death - a.birth));
    for (let i = 0; i < finite.length; i++) {
      const { birth, death } = finite[i];
      const x1 = rect.x + ((birth - min) / range) * rect.width;
      const x2 = rect.x + ((death - min) / range) * rect.width;
      const y = rect.y + i * rowHeight + rowHeight * 0.5;
      ctx.strokeStyle = '#ff0055';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();

      // Birth/death ticks.
      ctx.fillStyle = '#00ffcc';
      ctx.beginPath();
      ctx.arc(x1, y, 5, 0, Math.PI * 2);
      ctx.arc(x2, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    texture.needsUpdate = true;
  }

  return { mesh, update };
}

/**
 * Build a mapper graph panel.
 */
export function buildMapperPlane(options: TDAPlaneOptions = {}): PanelWithUpdate<MapperGraph> {
  const {
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    worldSize = [1.6, 1.2],
    title = 'Mapper Graph',
  } = options;
  const { ctx, texture } = createCanvasTexture(width, height);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldSize[0], worldSize[1]), material);
  mesh.name = 'tda-mapper-plane';

  function update(graph: MapperGraph): void {
    drawBackground(ctx, width, height, title);
    const rect = chartRect(width, height);
    const { nodes, edges } = graph;
    if (nodes.length === 0) {
      texture.needsUpdate = true;
      return;
    }

    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const radius = Math.min(rect.width, rect.height) * 0.38;

    // Layout nodes in a circle, ordered by filter level.
    const layout = new Map<unknown, { x: number; y: number }>();
    const sorted = nodes.slice().sort((a, b) => a.filterCenter - b.filterCenter);
    for (let i = 0; i < sorted.length; i++) {
      const angle = (i / Math.max(1, sorted.length)) * Math.PI * 2 - Math.PI / 2;
      layout.set(sorted[i].id, {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      });
    }

    // Edges.
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.5)';
    ctx.lineWidth = 2;
    for (const [a, b] of edges) {
      const pa = layout.get(a);
      const pb = layout.get(b);
      if (!pa || !pb) continue;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }

    // Nodes.
    for (const node of nodes) {
      const p = layout.get(node.id);
      if (!p) continue;
      const r = 8 + Math.min(24, node.size * 3);
      ctx.fillStyle = '#ff0055';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    texture.needsUpdate = true;
  }

  return { mesh, update };
}

/**
 * Build a Betti-0 curve panel.
 */
export function buildBettiPlane(options: TDAPlaneOptions = {}): PanelWithUpdate<BettiPoint[]> {
  const {
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    worldSize = [1.6, 1.2],
    title = 'Betti-0 Curve',
  } = options;
  const { ctx, texture } = createCanvasTexture(width, height);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldSize[0], worldSize[1]), material);
  mesh.name = 'tda-betti-plane';

  function update(curve: BettiPoint[]): void {
    drawBackground(ctx, width, height, title);
    const rect = chartRect(width, height);
    if (curve.length === 0) {
      texture.needsUpdate = true;
      return;
    }

    const maxRadius = Math.max(...curve.map((p) => p.radius), 1);
    const maxBetti = Math.max(...curve.map((p) => p.betti0), 1);

    // Axes.
    ctx.strokeStyle = '#88ccff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y + rect.height);
    ctx.lineTo(rect.x + rect.width, rect.y + rect.height);
    ctx.stroke();

    // Curve.
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < curve.length; i++) {
      const { radius, betti0 } = curve[i];
      const x = rect.x + (radius / maxRadius) * rect.width;
      const y = rect.y + rect.height - (betti0 / maxBetti) * rect.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Points.
    ctx.fillStyle = '#ffffff';
    for (const { radius, betti0 } of curve) {
      const x = rect.x + (radius / maxRadius) * rect.width;
      const y = rect.y + rect.height - (betti0 / maxBetti) * rect.height;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    texture.needsUpdate = true;
  }

  return { mesh, update };
}

export interface TDASummaryGroup {
  group: THREE.Group;
  persistence: PanelWithUpdate<PersistenceInterval[]>;
  mapper: PanelWithUpdate<MapperGraph>;
  betti: PanelWithUpdate<BettiPoint[]>;
  recompute: () => void;
}

/**
 * Convenience: build a group of TDA summary panels. When an `atlas` is supplied
 * and the kernel is ready, `recompute()` routes persistence / mapper / betti0
 * through AtlasCore (the single production kernel caller). With no atlas,
 * `recompute()` is a no-op and the panels stay blank — this is the
 * mandatory-kernel unavailable state, NOT a JS analytical fallback.
 */
export function buildTDASummaryGroup(
  dataset: Dataset,
  featureColumns: string[],
  filterColumn: string,
  atlas?: AtlasCore | null
): TDASummaryGroup {
  const group = new THREE.Group();
  group.name = 'tda-summary-group';

  const persistence = buildPersistencePlane({ title: 'Persistence Barcode' });
  persistence.mesh.position.set(-2.0, 1.6, -3.5);
  persistence.mesh.lookAt(0, 1.6, -3.5);
  group.add(persistence.mesh);

  const mapperPanel = buildMapperPlane({ title: 'Mapper Graph' });
  mapperPanel.mesh.position.set(0, 1.6, -3.5);
  mapperPanel.mesh.lookAt(0, 1.6, -3.5);
  group.add(mapperPanel.mesh);

  const betti = buildBettiPlane({ title: 'Betti-0 Curve' });
  betti.mesh.position.set(2.0, 1.6, -3.5);
  betti.mesh.lookAt(0, 1.6, -3.5);
  group.add(betti.mesh);

  function recompute(): void {
    if (!atlas || !atlas.isReady()) return;
    const filterValues = dataset.rows.map((r) => Number(r[filterColumn]) || 0);
    const tdaParams = { featureColumns, filterValues };
    persistence.update(
      (atlas.computePersistenceIntervals(dataset, tdaParams) ?? []).map(
        (i) => ({ birth: i.birth, death: i.death ?? null })
      )
    );
    const mapperParams = { ...tdaParams, bins: 10, overlap: 0.5 };
    const g = atlas.computeMapperGraph(dataset, mapperParams);
    const graph: MapperGraph = {
      nodes: (g?.nodes ?? []).map((n) => ({
        id: n.id,
        filterCenter: n.filterCenter,
        size: n.size,
      })),
      edges: (g?.edges ?? []) as [unknown, unknown][],
    };
    mapperPanel.update(graph);
    betti.update(atlas.computeBetti0Curve(dataset, { featureColumns, steps: 12 }) ?? []);

    atlas.discoverPersistenceStructures(dataset, tdaParams);
    atlas.discoverMapperStructures(dataset, mapperParams);
  }

  return { group, persistence, mapper: mapperPanel, betti, recompute };
}
