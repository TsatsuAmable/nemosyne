import * as THREE from 'three';
import { Container, Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { Button } from '../ui-system/components/Button.ts';
import { COLOR_TOKENS, SPACING_TOKENS, TYPOGRAPHY_TOKENS } from '../ui-system/tokens.ts';
import type { WheelMenuCategory } from '../coordinators/types.ts';
import {
  INVESTIGATOR_TASKS,
  type InvestigatorTaskIntent,
} from '../../app/intents/InvestigatorTaskIntent.ts';
import type { ContextualTaskSurface } from './ContextualTaskSurface.ts';

export interface CapabilityGuidePanelOptions {
  parent: THREE.Object3D;
  getWheelCategories: () => readonly WheelMenuCategory[];
  contextualTaskSurface: ContextualTaskSurface;
}

const PANEL_WIDTH = 760;
const PANEL_HEIGHT = 860;

/**
 * Transient capability map for the question "What can I do here?".
 *
 * It deliberately derives from the live wheel categories and canonical selected-
 * object task definitions instead of owning another capability taxonomy.
 */
export class CapabilityGuidePanel extends SpatialPanel {
  readonly title = 'WHAT CAN I DO HERE?';
  readonly defaultPosition = new THREE.Vector3(0, 0.12, -0.92);
  readonly tilt = 0.12;
  isMinimized = false;
  onHide: (() => void) | null = null;
  private readonly _getWheelCategories: () => readonly WheelMenuCategory[];
  private readonly _taskSurface: ContextualTaskSurface;
  private readonly _summary: Text;
  private readonly _actions: Container;
  private _buttons: Button[] = [];

  constructor(options: CapabilityGuidePanelOptions) {
    super(
      {
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        flexDirection: 'column',
        gap: SPACING_TOKENS.grid.x8,
        padding: SPACING_TOKENS.grid.x12,
        borderRadius: 10,
        backgroundColor: COLOR_TOKENS.surface.base,
        borderColor: COLOR_TOKENS.surface.border,
      },
      options.parent,
      null
    );
    this.name = 'capability-guide-panel';
    this._getWheelCategories = options.getWheelCategories;
    this._taskSurface = options.contextualTaskSurface;
    this.scale.setScalar(0.82 / PANEL_WIDTH);
    this.position.copy(this.defaultPosition);

    this._summary = new Text({
      text: '',
      fontSize: TYPOGRAPHY_TOKENS.scale.body,
      color: COLOR_TOKENS.text.primary,
      maxWidth: PANEL_WIDTH - 40,
    });
    this._actions = new Container({
      flexDirection: 'column',
      gap: SPACING_TOKENS.grid.x4,
      width: '100%',
    });
    this.add(this._summary, this._actions);
    this.visible = false;
  }

  show(): void {
    this.visible = true;
    this.refresh();
  }

  hide(): void {
    const changed = this.visible;
    this.visible = false;
    if (changed) this.onHide?.();
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }
  getRenderedSummary(): string {
    return this._formatSummary();
  }

  private _formatSummary(): string {
    const selected = this._taskSurface.activeData;
    const selectedName =
      selected?.name ?? selected?.label ?? selected?.id ?? null;
    const lines: string[] = [
      'WHAT CAN I DO HERE?',
      selectedName
        ? 'Selected: ' + String(selectedName).slice(0, 60)
        : 'Nothing selected. Select a data object for context-specific actions.',
      '',
      'NOW',
    ];

    for (const task of INVESTIGATOR_TASKS) {
      const availability = this._taskSurface.taskAvailability(task.id, selected);
      lines.push(
        (availability.available ? '✓ ' : '– ') +
          task.label +
          ' — ' +
          (availability.available ? task.description : availability.reason ?? 'Unavailable')
      );
    }

    lines.push('', 'GLOBAL CAPABILITIES');
    for (const category of this._getWheelCategories()) {
      if (category.id === 'SUPERUSER' || category.id === 'GUIDE') continue;
      const labels = category.items.map((item) => item.label).filter(Boolean);
      if (!labels.length) continue;
      const visible = labels.slice(0, 5);
      const remainder = labels.length - visible.length;
      lines.push(
        category.label +
          ': ' +
          visible.join(' · ') +
          (remainder > 0 ? ' · +' + remainder + ' more' : '')
      );
    }

    lines.push(
      '',
      'Tip: use GUIDE whenever you are unsure. Context actions dispatch directly; global actions remain grouped by intent.'
    );
    return lines.join('\n');
  }

  refresh(): void {
    this._summary.setProperties({ text: this._formatSummary() });
    this._rebuildButtons();
  }

  dispatchSelected(intent: InvestigatorTaskIntent): boolean {
    const ok = this._taskSurface.dispatchTask(intent, this._taskSurface.activeData);
    if (ok) this.hide();
    return ok;
  }

  dispatchGlobal(categoryId: string, actionId: string): boolean {
    const category = this._getWheelCategories().find((candidate) => candidate.id === categoryId);
    const action = category?.items.find((candidate) => candidate.id === actionId);
    if (!action) return false;
    action.callback();
    this.hide();
    return true;
  }
  private _rebuildButtons(): void {
    for (const button of this._buttons) {
      this._actions.remove(button);
      button.dispose();
    }
    this._buttons = [];

    const selected = this._taskSurface.activeData;
    if (selected) {
      for (const task of INVESTIGATOR_TASKS) {
        const availability = this._taskSurface.taskAvailability(task.id, selected);
        if (!availability.available) continue;
        const button = new Button({
          label: task.label,
          variant: task.id === 'inspect' ? 'primary' : 'secondary',
          onClick: () => {
            this.dispatchSelected(task.id);
          },
        });
        this._buttons.push(button);
        this._actions.add(button);
      }
    }

    const usefulGlobalIds: Array<[string, string]> = [
      ['DATA', 'data-sources'],
      ['ANALYSE', 'anomaly'],
      ['STUDY', 'guidance'],
      ['STUDY', 'vault'],
    ];
    for (const [categoryId, actionId] of usefulGlobalIds) {
      const category = this._getWheelCategories().find((item) => item.id === categoryId);
      const action = category?.items.find((item) => item.id === actionId);
      if (!action) continue;
      const button = new Button({
        label: action.label,
        variant: !selected && actionId === 'data-sources' ? 'primary' : 'secondary',
        onClick: () => {
          this.dispatchGlobal(categoryId, actionId);
        },
      });
      this._buttons.push(button);
      this._actions.add(button);
    }
  }

  override dispose(): void {
    for (const button of this._buttons) button.dispose();
    this._buttons = [];
    super.dispose();
  }
}
