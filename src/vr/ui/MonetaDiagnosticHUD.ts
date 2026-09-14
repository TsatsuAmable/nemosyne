import * as THREE from 'three';
import { Container, Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { Button } from '../ui-system/components/Button.ts';
import { SPACING_TOKENS } from '../ui-system/tokens.ts';
import { getTheme } from '../ui-system/theme.ts';
import { MonetaTopologyNode } from '../../moneta/MonetaTopologyNode.ts';

const PANEL_WIDTH = 1100;
const PANEL_HEIGHT = 640;

export class MonetaDiagnosticHUD extends SpatialPanel {
  readonly title = 'MONETA CONSTRAINT DIAGNOSTIC';
  readonly defaultPosition: THREE.Vector3;
  readonly tilt = 0.22;
  isMinimized = false;
  onHide: (() => void) | null = null;
  onDragDelta: ((delta: THREE.Vector3) => void) | null = null;
  onDragEnd: (() => void) | null = null;

  monetaNode: MonetaTopologyNode;
  candidateHistory: Array<{ layout: string; geometry: string; cost: number; timestamp: number }> = [];

  private readonly _summary: Text;
  private readonly _constraints: Container;
  private _lastCost: number | null = null;
  private _costDelta = 0;
  private _clickCooldownMs = 350;
  private _lastClickAt = -this._clickCooldownMs;

  constructor(
    analystAnchor: THREE.Object3D,
    monetaNode: MonetaTopologyNode,
    position: [number, number, number] = [-0.8, 1.5, -1.2]
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

    this.name = 'moneta-diagnostic-hud';
    this.monetaNode = monetaNode;
    this.scale.setScalar(1.3 / PANEL_WIDTH);
    this.defaultPosition = new THREE.Vector3(...position);
    this.position.copy(this.defaultPosition);

    this._summary = new Text({
      text: '',
      fontSize: 18,
      color: Number(theme.textPrimary),
    });
    this._constraints = new Container({
      flexDirection: 'column',
      gap: SPACING_TOKENS.grid.x8,
    });
    this.add(this._summary, this._constraints);

    this.render();
    if (import.meta.env.VITE_NEMOSYNE_DIAGNOSTICS !== '1') {
      this.hide();
    }
  }

  get dracoNode(): MonetaTopologyNode {
    return this.monetaNode;
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

  adjustConstraint(ruleName: string, delta: number, now = performance.now()): boolean {
    if (now - this._lastClickAt < this._clickCooldownMs) return false;
    this._lastClickAt = now;
    this.monetaNode.adjustWeight(ruleName, delta);
    this.render();
    return true;
  }

  render(): void {
    const result = this.monetaNode.solverResult;
    if (result?.spec) {
      const currentCost = result.cost;
      if (this._lastCost !== null && this._lastCost !== currentCost) {
        this._costDelta = currentCost - this._lastCost;
        this.candidateHistory.unshift({
          layout: result.spec.layout,
          geometry: result.spec.geometry,
          cost: currentCost,
          timestamp: Date.now(),
        });
        if (this.candidateHistory.length > 5) this.candidateHistory.pop();
      }
      this._lastCost = currentCost;
    }

    this._summary.setProperties({
      text: result?.spec
        ? [
            'LAYOUT: [ ' + result.spec.layout + ' ]',
            'GEOM: [ ' + result.spec.geometry + ' ]',
            'BEHAV: [ ' + result.spec.behavior + ' ]',
            'COST: ' + (result.cost ?? 0).toFixed(1) + ' | LOWER IS BETTER',
            this._costDelta !== 0
              ? 'DELTA: ' + (this._costDelta > 0 ? '+' : '') + this._costDelta.toFixed(1)
              : '',
          ]
            .filter(Boolean)
            .join('\n')
        : 'No Moneta solver result available.',
    });

    for (const child of [...this._constraints.children]) {
      this._constraints.remove(child);
      if ('dispose' in child && typeof child.dispose === 'function') child.dispose();
    }

    for (const [index, constraint] of this.monetaNode.engine.softConstraints.entries()) {
      let penalty = 0;
      if (result?.spec && result?.facts) {
        penalty = constraint.eval(result.facts, result.spec);
      }

      const row = new Container({
        flexDirection: 'row',
        gap: SPACING_TOKENS.grid.x8,
        alignItems: 'center',
      });
      const label = new Text({
        text:
          String(index + 1) +
          '. ' +
          constraint.name.toUpperCase() +
          ' | weight=' +
          constraint.weight +
          ' | penalty=' +
          penalty.toFixed(1),
        fontSize: 15,
        flexGrow: 1,
      });
      const decrease = new Button({
        label: '−5',
        variant: 'danger',
        onClick: () => {
          this.adjustConstraint(constraint.name, -5);
        },
      });
      const increase = new Button({
        label: '+5',
        variant: 'primary',
        onClick: () => {
          this.adjustConstraint(constraint.name, 5);
        },
      });
      row.add(label, decrease, increase);
      this._constraints.add(row);
    }
  }
}

export { MonetaDiagnosticHUD as DracoDiagnosticHUD };
