import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import type { DracoTopologyNode } from '../../draco/DracoTopologyNode.ts';
import type { DracoFacts, DracoSpec } from '../../draco/types.ts';

export class DracoExplainerPanel extends MovablePanel {
  dracoNode: DracoTopologyNode | null;
  facts: DracoFacts | null = null;
  spec: DracoSpec | null = null;

  constructor(
    cameraGroup: THREE.Group,
    dracoNode: DracoTopologyNode | null = null,
    position: [number, number, number] = [0.8, 1.5, -1.2]
  ) {
    super(cameraGroup, {
      title: 'WHY THIS PALACE? (DRACO EXPLAINER)',
      width: 900,
      height: 600,
      position,
      worldSize: [1.1, 0.72],
      titleBarHeight: 50,
      contentPadding: 24,
    });

    this.dracoNode = dracoNode;
    this.refresh();
  }

  setDracoNode(node: DracoTopologyNode | null): void {
    this.dracoNode = node;
    this.refresh();
  }

  setExplanation(facts: DracoFacts, spec: DracoSpec): void {
    this.facts = facts;
    this.spec = spec;
    this.render();
  }

  refresh(): void {
    if (this.dracoNode?.solverResult) {
      this.facts = this.dracoNode.solverResult.facts ?? null;
      this.spec = this.dracoNode.solverResult.spec ?? null;
    }
    this.render();
  }

  private _generateRationale(): string[] {
    const lines: string[] = [];
    const facts = this.facts;
    const spec = this.spec;

    if (!facts || !spec) {
      lines.push('No active dataset loaded. Load a dataset or select a task template.');
      return lines;
    }

    // 1. Topology & Structure
    const colCount = (facts.numericColumns ?? 0) + (facts.categoricalColumns ?? 0) + (facts.temporalColumns ?? 0);
    lines.push(`• Detected Topology: ${facts.topology} (${facts.rowCount ?? 0} rows, ${colCount} columns)`);
    if (facts.hasTimeSeries) {
      lines.push('  Temporal structure detected; time-ordered sequences identified.');
    }
    if (facts.topology === 'GEO') {
      lines.push('  Geographic latitude/longitude coordinates mapped to spatial surface.');
    }
    if (facts.hasHighCardinality) {
      lines.push('  High category cardinality observed; optimized for cluster aggregation.');
    }

    // 2. Visual Layout Rationale
    lines.push('');
    lines.push(`• Layout: [ ${spec.layout} ]`);
    switch (spec.layout) {
      case 'GRID_3D':
        lines.push('  Rationale: Organizes discrete multi-dimensional records into ordered 3D voxels,');
        lines.push('  minimizing occlusion and enabling spatial row-wise comparison.');
        break;
      case 'FORCE_DIRECTED_3D':
        lines.push('  Rationale: Balances edge connectivity springs with repulsive node forces,');
        lines.push('  clustering dense topological communities in 3D Euclidean space.');
        break;
      case 'TIME_RIBBON':
        lines.push('  Rationale: Extrudes chronologically ordered events along a continuous path,');
        lines.push('  highlighting trends and cyclical fluctuations across time.');
        break;
      case 'GEO_SURFACE':
        lines.push('  Rationale: Projects coordinates onto a normalized geographic terrain,');
        lines.push('  preserving geospatial adjacency and relative regional density.');
        break;
      case 'RADIAL_ORBITAL':
        lines.push('  Rationale: Arranges hierarchical parent-child relationships in concentric rings,');
        lines.push('  maximizing tree branching breadth and depth legibility.');
        break;
      case 'VECTOR_STREAMLINE':
        lines.push('  Rationale: Integrates vector field velocities into continuous particle streamlines.');
        break;
      default:
        lines.push('  Rationale: Selected by constraint solver to minimize spatial visual clutter.');
    }

    // 3. Geometry & Representation Rationale
    lines.push('');
    lines.push(`• Mark Geometry: [ ${spec.geometry} ]`);
    switch (spec.geometry) {
      case 'BEAM':
        lines.push('  Rationale: Highlights strong inter-column correlation paths (>0.7) with energy beams.');
        break;
      case 'CLUSTER_VOLUME':
        lines.push('  Rationale: Groups high-density categorical subsets into volumetric bounding hulls.');
        break;
      case 'INSTANCED_POINT_CLOUD':
        lines.push('  Rationale: GPU-instanced point cloud utilized for high row count (>500 records)');
        lines.push('  to sustain 90/120 FPS WebXR rendering on standalone VR headsets.');
        break;
      case 'AGGREGATE_BARS':
        lines.push('  Rationale: Aggregates continuous numeric columns into spatial bar markers.');
        break;
      default:
        lines.push('  Rationale: Discrete interactive 3D glyph marks representing individual datums.');
    }

    // 4. Interaction Metaphor
    lines.push('');
    lines.push(`• Primary Interaction: [ ${spec.interaction} ]`);
    switch (spec.interaction) {
      case 'CLUSTER_PROBE':
        lines.push('  Rationale: Spatial probe allows inspecting localized cluster distributions.');
        break;
      case 'RESONANCE_PULSE':
        lines.push('  Rationale: Emits wave pulses across connected graph nodes to reveal paths.');
        break;
      case 'CHRONO_DIAL':
        lines.push('  Rationale: Wrist/pointer dial allows scrubbing forward and backward through time.');
        break;
      default:
        lines.push('  Rationale: Point-and-click laser selection with direct tactile manipulation.');
    }

    return lines;
  }

  renderContent(ctx: CanvasRenderingContext2D, w: number, _contentH: number): void {
    const pad = 20;

    // Header container
    ctx.fillStyle = 'rgba(0, 40, 60, 0.85)';
    ctx.fillRect(pad, pad, w - pad * 2, 70);

    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#00ffcc';
    ctx.fillText('DRACO SPATIAL SYNTHESIS RATIONALE', pad + 20, pad + 32);

    ctx.font = '16px monospace';
    ctx.fillStyle = '#ffaa00';
    const score = this.dracoNode?.solverResult?.cost ?? 0;
    ctx.fillText(`Empirical Constraint Penalty Score: ${score.toFixed(1)} (Optimal Configuration)`, pad + 20, pad + 58);

    // Rationale Body
    const lines = this._generateRationale();
    let y = pad + 105;

    ctx.font = '16px monospace';
    for (const line of lines) {
      if (line.startsWith('•')) {
        ctx.fillStyle = '#00ffff';
        ctx.font = 'bold 17px monospace';
      } else if (line.includes('Rationale:')) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '15px monospace';
      } else {
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '15px monospace';
      }
      ctx.fillText(line, pad + 15, y);
      y += 24;
    }

    this.totalContentHeight = y + 40;
  }
}
