import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import { COLOR_TOKENS, cssHex } from '../ui-system/tokens.ts';
import type { MonetaTopologyNode } from '../../moneta/MonetaTopologyNode.ts';
import type { MonetaFacts, MonetaSpec } from '../../moneta/types.ts';

export class MonetaExplainerPanel extends MovablePanel {
  monetaNode: MonetaTopologyNode | null;
  facts: MonetaFacts | null = null;
  spec: MonetaSpec | null = null;

  constructor(
    cameraGroup: THREE.Group,
    monetaNode: MonetaTopologyNode | null = null,
    position: [number, number, number] = [0.8, 1.5, -1.2]
  ) {
    super(cameraGroup, {
      title: 'WHY THIS PALACE? (MONETA EXPLAINER)',
      width: 900,
      height: 600,
      position,
      worldSize: [1.1, 0.72],
      titleBarHeight: 50,
      contentPadding: 24,
    });

    this.monetaNode = monetaNode;
    this.refresh();
  }

  get dracoNode(): MonetaTopologyNode | null {
    return this.monetaNode;
  }

  setDracoNode(node: MonetaTopologyNode | null): void {
    this.monetaNode = node;
    this.refresh();
  }

  setMonetaNode(node: MonetaTopologyNode | null): void {
    this.monetaNode = node;
    this.refresh();
  }

  setExplanation(facts: MonetaFacts, spec: MonetaSpec): void {
    this.facts = facts;
    this.spec = spec;
    this.render();
  }

  refresh(): void {
    if (this.monetaNode?.solverResult) {
      this.facts = this.monetaNode.solverResult.facts ?? null;
      this.spec = this.monetaNode.solverResult.spec ?? null;
    }
    this.render();
  }

  _generateRationale(): string[] {
    const lines: string[] = [];
    const facts = this.facts;
    const spec = this.spec;

    if (!facts || !spec) {
      lines.push('No active dataset loaded. Load a dataset or select a task template.');
      return lines;
    }

    const rowCount = facts.rowCount ?? (facts as unknown as { rowCount?: number }).rowCount ?? 0;
    const colCount = (facts.numericColumns ?? 0) + (facts.categoricalColumns ?? 0) + (facts.temporalColumns ?? 0);
    lines.push(`STRUCTURE: ${rowCount} rows, ${colCount} columns across topology [${facts.topology}].`);

    if (spec.layout === 'FORCE_DIRECTED_3D') {
      lines.push(`• LAYOUT: [FORCE_DIRECTED_3D] Force-directed layout with springs chosen because dataset has ${facts.edgeCount ?? 0} relational edges.`);
    } else if (spec.layout === 'RADIAL_ORBITAL') {
      lines.push(`• LAYOUT: [RADIAL_ORBITAL] Radial orbital hierarchical layout chosen to expose hierarchy depth (${facts.depth ?? 0}).`);
    } else if (spec.layout === 'TIME_RIBBON') {
      lines.push(`• LAYOUT: [TIME_RIBBON] Time ribbon layout chosen to map temporal sequence (trend=${facts.trendDirection}).`);
    } else if (spec.layout === 'GEO_SURFACE') {
      lines.push('• LAYOUT: [GEO_SURFACE] Geographic geospatial surface chosen to map latitude/longitude coordinates.');
    } else if (spec.layout === 'VECTOR_STREAMLINE') {
      lines.push('• LAYOUT: [VECTOR_STREAMLINE] Vector field with particle streamlines chosen for flow vectors.');
    } else if (spec.layout === 'SPECTRAL_VOLUME') {
      lines.push('• LAYOUT: [SPECTRAL_VOLUME] Spectral volume chosen to expose harmonic periodicities and power spectrum.');
    } else {
      lines.push('• LAYOUT: [GRID_3D] 3D Grid layout with voxels chosen for uniform multi-dimensional tabular indexing.');
    }

    lines.push(`• GEOMETRY: [${spec.geometry}] geometry chosen for visual representation.`);
    lines.push(`• INTERACTION: [${spec.interaction}] selected to optimize inspection for [${facts.topology}].`);
    lines.push(`• BEHAVIOR: [${spec.behavior}] applied to signify dynamics and metric change.`);

    return lines;
  }

renderContent(ctx: CanvasRenderingContext2D, _w: number, _contentH: number): void {
    const pad = 24;
    let y = 30;

    ctx.fillStyle = cssHex(COLOR_TOKENS.interaction.focus);
    ctx.font = 'bold 20px monospace';
    ctx.fillText('ANALYTICAL REPRESENTATION SOLVER RATIONALE', pad, y);
    y += 36;

    const lines = this._generateRationale();
    ctx.font = '16px monospace';
    ctx.fillStyle = cssHex(COLOR_TOKENS.text.secondary);

    for (const line of lines) {
      if (line.startsWith('STRUCTURE:')) {
        ctx.fillStyle = cssHex(COLOR_TOKENS.epistemic.uncertain);
      } else if (line.startsWith('• LAYOUT:')) {
        ctx.fillStyle = cssHex(COLOR_TOKENS.interaction.focus);
      } else if (line.startsWith('• GEOMETRY:')) {
        ctx.fillStyle = cssHex(COLOR_TOKENS.epistemic.contradiction);
      } else if (line.startsWith('• INTERACTION:')) {
        ctx.fillStyle = cssHex(COLOR_TOKENS.status.verified);
      } else {
        ctx.fillStyle = cssHex(COLOR_TOKENS.text.secondary);
      }

      ctx.fillText(line, pad, y);
      y += 28;
    }
  }
}

export { MonetaExplainerPanel as DracoExplainerPanel };
