import * as THREE from 'three';
import { Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { SPACING_TOKENS } from '../ui-system/tokens.ts';
import { getTheme } from '../ui-system/theme.ts';
import type { MonetaTopologyNode } from '../../moneta/MonetaTopologyNode.ts';
import type { MonetaFacts, MonetaSpec } from '../../moneta/types.ts';
import type { AccessibilityOptions } from '../coordinators/types.ts';

const PANEL_WIDTH = 900;
const PANEL_HEIGHT = 600;

export class MonetaExplainerPanel extends SpatialPanel {
  readonly title = 'WHY THIS PALACE? (MONETA EXPLAINER)';
  readonly defaultPosition: THREE.Vector3;
  readonly tilt = 0.22;
  isMinimized = false;
  onHide: (() => void) | null = null;
  onDragDelta: ((delta: THREE.Vector3) => void) | null = null;
  onDragEnd: (() => void) | null = null;

  monetaNode: MonetaTopologyNode | null;
  facts: MonetaFacts | null = null;
  spec: MonetaSpec | null = null;

  private readonly _content: Text;
  private _textScale = 1;
  private _highContrast = false;

  constructor(
    analystAnchor: THREE.Object3D,
    monetaNode: MonetaTopologyNode | null = null,
    position: [number, number, number] = [0.8, 1.5, -1.2]
  ) {
    const theme = getTheme(false);
    super(
      {
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        flexDirection: 'column',
        gap: SPACING_TOKENS.grid.x8,
        padding: SPACING_TOKENS.grid.x16,
        backgroundColor: Number(theme.backgroundColor),
        borderColor: Number(theme.borderColor),
        borderWidth: 2,
        borderRadius: 8,
      },
      analystAnchor,
      null
    );
    this.name = 'moneta-explainer-panel';
    this.scale.setScalar(1.1 / PANEL_WIDTH);
    this.defaultPosition = new THREE.Vector3(...position);
    this.position.copy(this.defaultPosition);

    this._content = new Text({
      text: '',
      fontSize: 16,
      color: Number(theme.textPrimary),
    });
    this.add(this._content);

    this.monetaNode = monetaNode;
    this.refresh();
  }

  get dracoNode(): MonetaTopologyNode | null {
    return this.monetaNode;
  }

  setDracoNode(node: MonetaTopologyNode | null): void {
    this.setMonetaNode(node);
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

  applyAccessibility(options: AccessibilityOptions): void {
    this._textScale = options.textScale;
    this._highContrast = options.highContrast;
    const theme = getTheme(this._highContrast);
    this.setProperties({
      backgroundColor: Number(theme.backgroundColor),
      borderColor: Number(theme.borderColor),
    });
    this.render();
  }

  show(): void {
    this.visible = true;
    this.isMinimized = false;
  }

  hide(): void {
    const changed = this.visible;
    this.visible = false;
    if (changed) this.onHide?.();
  }

  render(): void {
    const theme = getTheme(this._highContrast);
    this._content.setProperties({
      text: ['ANALYTICAL REPRESENTATION SOLVER RATIONALE', '', ...this._generateRationale()].join('\n'),
      fontSize: 16 * this._textScale,
      color: Number(theme.textPrimary),
    });
  }

  _generateRationale(): string[] {
    const facts = this.facts;
    const spec = this.spec;
    if (!facts || !spec) {
      return ['No active dataset loaded. Load a dataset or select a task template.'];
    }

    const lines: string[] = [];
    const rowCount = facts.rowCount ?? 0;
    const colCount =
      (facts.numericColumns ?? 0) +
      (facts.categoricalColumns ?? 0) +
      (facts.temporalColumns ?? 0);
    lines.push(
      'STRUCTURE: ' + rowCount + ' rows, ' + colCount + ' columns across topology [' + facts.topology + '].'
    );

    if (spec.layout === 'FORCE_DIRECTED_3D') {
      lines.push(
        '• LAYOUT: [FORCE_DIRECTED_3D] Force-directed layout with springs chosen because dataset has ' +
          (facts.edgeCount ?? 0) +
          ' relational edges.'
      );
    } else if (spec.layout === 'RADIAL_ORBITAL') {
      lines.push(
        '• LAYOUT: [RADIAL_ORBITAL] Radial orbital hierarchical layout chosen to expose hierarchy depth (' +
          (facts.depth ?? 0) +
          ').'
      );
    } else if (spec.layout === 'TIME_RIBBON') {
      lines.push(
        '• LAYOUT: [TIME_RIBBON] Time ribbon layout chosen to map temporal sequence (trend=' +
          facts.trendDirection +
          ').'
      );
    } else if (spec.layout === 'GEO_SURFACE') {
      lines.push('• LAYOUT: [GEO_SURFACE] Geographic geospatial surface chosen to map latitude/longitude coordinates.');
    } else if (spec.layout === 'VECTOR_STREAMLINE') {
      lines.push('• LAYOUT: [VECTOR_STREAMLINE] Vector field with particle streamlines chosen for flow vectors.');
    } else if (spec.layout === 'SPECTRAL_VOLUME') {
      lines.push('• LAYOUT: [SPECTRAL_VOLUME] Spectral volume chosen to expose harmonic periodicities and power spectrum.');
    } else {
      lines.push('• LAYOUT: [GRID_3D] 3D Grid layout with voxels chosen for uniform multi-dimensional tabular indexing.');
    }

    lines.push('• GEOMETRY: [' + spec.geometry + '] geometry chosen for visual representation.');
    lines.push(
      '• INTERACTION: [' +
        spec.interaction +
        '] selected to optimize inspection for [' +
        facts.topology +
        '].'
    );
    lines.push('• BEHAVIOR: [' + spec.behavior + '] applied to signify dynamics and metric change.');
    return lines;
  }
}

export { MonetaExplainerPanel as DracoExplainerPanel };
