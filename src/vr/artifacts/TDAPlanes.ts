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
import type {
  BettiPoint as KernelBettiPoint,
  PersistenceInterval as KernelPersistenceInterval,
  Provenance,
  TdaMapperGraph,
} from '../../data/types.ts';
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

export interface TDAComputationResult {
  datasetVersion: number;
  datasetFingerprint: string;
  persistence: KernelPersistenceInterval[];
  mapper: TdaMapperGraph;
  betti0: KernelBettiPoint[];
  persistenceProvenance: Provenance | null;
  mapperProvenance: Provenance | null;
  bettiProvenance: Provenance | null;
  persistenceParams: Record<string, unknown>;
  mapperParams: Record<string, unknown>;
  bettiParams: Record<string, unknown>;
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

/** Build a persistence barcode panel. */
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

/** Build a mapper graph panel. */
export function buildMapperPlane(options: TDAPlaneOptions = {}): PanelWithUpdate<MapperGraph> & { pickNode: (cx: number, cy: number) => unknown | null } {
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

  let nodeHitAreas: { id: unknown; x: number; y: number; r: number }[] = [];

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
    const layout = new Map<unknown, { x: number; y: number }>();
    const sorted = nodes.slice().sort((a, b) => a.filterCenter - b.filterCenter);
    for (let i = 0; i < sorted.length; i++) {
      const angle = (i / Math.max(1, sorted.length)) * Math.PI * 2 - Math.PI / 2;
      layout.set(sorted[i].id, {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      });
    }

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

    nodeHitAreas = [];
    for (const node of nodes) {
      const p = layout.get(node.id);
      if (!p) continue;
      const r = 8 + Math.min(24, node.size * 3);
      nodeHitAreas.push({ id: node.id, x: p.x, y: p.y, r });
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

  function pickNode(cx: number, cy: number): unknown | null {
    for (const area of nodeHitAreas) {
      const dx = cx - area.x;
      const dy = cy - area.y;
      if (dx * dx + dy * dy <= area.r * area.r) return area.id;
    }
    return null;
  }

  return { mesh, update, pickNode };
}

/** Build a Betti-0 curve panel. */
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
    ctx.strokeStyle = '#88ccff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y + rect.height);
    ctx.lineTo(rect.x + rect.width, rect.y + rect.height);
    ctx.stroke();

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
  compute: () => Promise<TDAComputationResult | null>;
  apply: (result: TDAComputationResult) => boolean;
  recompute: () => Promise<TDAComputationResult | null>;
  pickStructure: (raycaster: THREE.Raycaster) => string | null;
}

/**
 * Build a group of TDA summary panels. `compute()` obtains authoritative
 * results; `apply()` is presentation-only. The split lets RF-061 coalesce
 * derived analysis and reject stale generations before publishing UI state.
 */
export function buildTDASummaryGroup(
  _dataset: Dataset,
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

  const orderedFeatureColumns = [
    filterColumn,
    ...featureColumns.filter((column) => column !== filterColumn),
  ];
  const persistenceParams = { featureColumns: orderedFeatureColumns };
  const mapperParams = { ...persistenceParams, bins: 10, overlap: 0.5 };
  const bettiParams = { featureColumns: orderedFeatureColumns, steps: 12 };

  const isCurrent = (version: number, fingerprint: string) =>
    Boolean(
      atlas &&
      atlas.datasetVersion === version &&
      atlas.datasetFingerprint === fingerprint
    );

  async function compute(): Promise<TDAComputationResult | null> {
    if (!atlas || !atlas.isReady()) return null;
    const datasetVersion = atlas.datasetVersion;
    const datasetFingerprint = atlas.datasetFingerprint;
    if (!datasetFingerprint) return null;

    let pIntervals: KernelPersistenceInterval[] | null;
    let g: TdaMapperGraph | null;
    let bettiPoints: KernelBettiPoint[] | null;
    let persistenceProvenance: Provenance | null = null;
    let mapperProvenance: Provenance | null = null;
    let bettiProvenance: Provenance | null = null;

    if (atlas.executionPort?.isAsync) {
      // Complete the first request (and therefore its resident-registration
      // fence) before launching the remaining pair. Each response carries its
      // own provenance so concurrent Mapper/Betti execution cannot race through
      // a mutable "last provenance" slot.
      const persistenceEvidence = await atlas.computePersistenceEvidenceAsync(persistenceParams);
      if (!persistenceEvidence || !isCurrent(datasetVersion, datasetFingerprint)) return null;
      const [mapperEvidence, bettiEvidence] = await Promise.all([
        atlas.computeMapperEvidenceAsync(mapperParams),
        atlas.computeBetti0EvidenceAsync(bettiParams),
      ]);
      if (!mapperEvidence || !bettiEvidence) return null;
      pIntervals = persistenceEvidence.value;
      g = mapperEvidence.value;
      bettiPoints = bettiEvidence.value;
      persistenceProvenance = persistenceEvidence.provenance;
      mapperProvenance = mapperEvidence.provenance;
      bettiProvenance = bettiEvidence.provenance;
    } else {
      pIntervals = atlas.computePersistenceIntervalsForCurrent(persistenceParams);
      persistenceProvenance = atlas.lastProvenance();
      g = atlas.computeMapperGraphForCurrent(mapperParams);
      mapperProvenance = atlas.lastProvenance();
      bettiPoints = atlas.computeBetti0CurveForCurrent(bettiParams);
      bettiProvenance = atlas.lastProvenance();
    }

    if (
      !pIntervals ||
      !g ||
      !bettiPoints ||
      !isCurrent(datasetVersion, datasetFingerprint)
    ) {
      return null;
    }

    return {
      datasetVersion,
      datasetFingerprint,
      persistence: pIntervals,
      mapper: g,
      betti0: bettiPoints,
      persistenceProvenance,
      mapperProvenance,
      bettiProvenance,
      persistenceParams,
      mapperParams,
      bettiParams,
    };
  }

  function apply(result: TDAComputationResult): boolean {
    if (!atlas || !isCurrent(result.datasetVersion, result.datasetFingerprint)) return false;
    persistence.update(
      result.persistence.map((interval) => ({
        birth: interval.birth,
        death: interval.death ?? null,
      }))
    );
    mapperPanel.update({
      nodes: (result.mapper.nodes ?? []).map((node) => ({
        id: node.id,
        filterCenter: node.filterCenter,
        size: node.size,
      })),
      edges: (result.mapper.edges ?? []) as [unknown, unknown][],
    });
    betti.update(result.betti0);
    return true;
  }

  async function recompute(): Promise<TDAComputationResult | null> {
    try {
      const result = await compute();
      if (!result) return null;
      return apply(result) ? result : null;
    } catch (error) {
      console.warn('[TDAPlanes] TDA execution error:', error);
      return null;
    }
  }

  function pickStructure(raycaster: THREE.Raycaster): string | null {
    const hits = raycaster.intersectObject(mapperPanel.mesh, false);
    if (hits.length === 0) return null;
    const uv = hits[0].uv;
    if (!uv) return null;
    const cx = uv.x * DEFAULT_WIDTH;
    const cy = (1 - uv.y) * DEFAULT_HEIGHT;
    const nodeId = mapperPanel.pickNode(cx, cy);
    if (nodeId === null) return null;
    for (const set of atlas?.structures ?? []) {
      for (const structure of set.structures) {
        if (structure.evidence.method === 'mapper' && structure.evidence.rank === nodeId) {
          return structure.id;
        }
      }
    }
    return null;
  }

  return { group, persistence, mapper: mapperPanel, betti, compute, apply, recompute, pickStructure };
}
