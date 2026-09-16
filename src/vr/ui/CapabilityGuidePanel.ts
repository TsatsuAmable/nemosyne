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
  hasDataset?: () => boolean;
  hasRepresentation?: () => boolean;
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
  private readonly _hasDataset: () => boolean;
  private readonly _hasRepresentation: () => boolean;
  private readonly _summary: Text;
  private readonly _actions: Container;
  private _buttons: Button[] = [];
  private _detailsExpanded = false;
  private _renderedSummary = '';
  private _lastContextSignature = '';

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
    this._hasDataset = options.hasDataset ?? (() => false);
    this._hasRepresentation = options.hasRepresentation ?? (() => false);
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
    this._detailsExpanded = false;
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

  update(delta = 0): void {
    super.update(delta);
    if (!this.visible) return;
    if (this._contextSignature() !== this._lastContextSignature) this.refresh();
  }

  getRenderedSummary(): string {
    return this._renderedSummary;
  }

  private _contextSignature(): string {
    const selected = this._taskSurface.activeData;
    return JSON.stringify({
      detailsExpanded: this._detailsExpanded,
      hasDataset: this._hasDataset(),
      hasRepresentation: this._hasRepresentation(),
      selected: selected
        ? [
            selected.name ?? null,
            selected.label ?? null,
            selected.id ?? null,
            selected.topology ?? null,
          ]
        : null,
      availability: INVESTIGATOR_TASKS.map((task) => {
        const state = this._taskSurface.taskAvailability(task.id, selected);
        return [task.id, state.available, state.reason ?? null];
      }),
      categories: this._getWheelCategories().map((category) => [
        category.id,
        category.label,
        category.items.map((item) => [item.id, item.label]),
      ]),
    });
  }

  private _formatSummary(): string {
    const selected = this._taskSurface.activeData;
    const selectedName = selected?.name ?? selected?.label ?? selected?.id ?? null;

    if (this._detailsExpanded) {
      const lines: string[] = [
        'CAPABILITY MAP',
        selectedName ? 'Selected: ' + String(selectedName).slice(0, 60) : 'Nothing selected.',
        '',
        'NOW',
      ];

      for (const task of INVESTIGATOR_TASKS) {
        const availability = this._taskSurface.taskAvailability(task.id, selected);
        lines.push(
          (availability.available ? '✓ ' : '– ') +
            task.label +
            ' — ' +
            (availability.available ? task.description : (availability.reason ?? 'Unavailable'))
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
      return lines.join('\n');
    }

    const hasDataset = this._hasDataset();
    const hasRepresentation = this._hasRepresentation();
    const nextTask = selected
      ? INVESTIGATOR_TASKS.find(
          (task) =>
            task.id !== 'more' && this._taskSurface.taskAvailability(task.id, selected).available
        )
      : null;
    const contextTask = INVESTIGATOR_TASKS.find((task) => task.id === 'more');
    const dataSources = this._getWheelCategories()
      .find((category) => category.id === 'DATA')
      ?.items.find((item) => item.id === 'data-sources');
    const nextStep = nextTask
      ? `${nextTask.label} — ${nextTask.description}`
      : !hasDataset
        ? dataSources
          ? `${dataSources.label} — load a dataset to begin an investigation`
          : 'Open DATA to load a dataset and begin an investigation'
        : hasRepresentation
          ? 'Select a structure — choose a visible dataset structure to inspect or challenge'
          : contextTask
            ? `${contextTask.label} — ${contextTask.description}`
            : 'Review representation constraints and current investigation context';

    return [
      'WHAT CAN I DO HERE?',
      '',
      'PURPOSE',
      'Nemosyne turns governed analytical structure into spatial representations you can inspect, challenge, and trace to evidence.',
      '',
      'MENTAL MODEL',
      'dataset → representation → structure → question → investigation → evidence',
      'A representation is a governed view of the dataset, not the dataset itself.',
      '',
      'CONTEXT',
      selectedName
        ? 'Selected: ' + String(selectedName).slice(0, 60)
        : !hasDataset
          ? 'No dataset loaded yet.'
          : hasRepresentation
            ? 'Dataset loaded. Nothing selected.'
            : 'Dataset loaded. No representation is currently promoted.',
      `NEXT: ${nextStep}`,
    ].join('\n');
  }

  setCapabilityDetailsExpanded(expanded: boolean): void {
    if (this._detailsExpanded === expanded) return;
    this._detailsExpanded = expanded;
    if (this.visible) this.refresh();
  }

  refresh(): void {
    this._renderedSummary = this._formatSummary();
    this._summary.setProperties({ text: this._renderedSummary });
    this._rebuildButtons();
    this._lastContextSignature = this._contextSignature();
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
    const addButton = (button: Button) => {
      this._buttons.push(button);
      this._actions.add(button);
    };

    addButton(
      new Button({
        label: this._detailsExpanded ? 'Back to orientation' : 'Show capability map',
        variant: 'secondary',
        onClick: () => this.setCapabilityDetailsExpanded(!this._detailsExpanded),
      })
    );

    if (!this._detailsExpanded) {
      if (selected) {
        const nextTask = INVESTIGATOR_TASKS.find(
          (task) =>
            task.id !== 'more' && this._taskSurface.taskAvailability(task.id, selected).available
        );
        if (nextTask) {
          addButton(
            new Button({
              label: nextTask.label,
              variant: 'primary',
              onClick: () => {
                this.dispatchSelected(nextTask.id);
              },
            })
          );
        }
      } else if (!this._hasDataset()) {
        const dataSources = this._getWheelCategories()
          .find((category) => category.id === 'DATA')
          ?.items.find((item) => item.id === 'data-sources');
        if (dataSources) {
          addButton(
            new Button({
              label: dataSources.label,
              variant: 'primary',
              onClick: () => this.dispatchGlobal('DATA', 'data-sources'),
            })
          );
        }
      } else if (!this._hasRepresentation()) {
        const contextTask = INVESTIGATOR_TASKS.find((task) => task.id === 'more');
        if (contextTask) {
          addButton(
            new Button({
              label: contextTask.label,
              variant: 'primary',
              onClick: () => {
                this.dispatchSelected(contextTask.id);
              },
            })
          );
        }
      }
      return;
    }

    if (selected) {
      for (const task of INVESTIGATOR_TASKS) {
        const availability = this._taskSurface.taskAvailability(task.id, selected);
        if (!availability.available) continue;
        addButton(
          new Button({
            label: task.label,
            variant: task.id === 'inspect' ? 'primary' : 'secondary',
            onClick: () => {
              this.dispatchSelected(task.id);
            },
          })
        );
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
      addButton(
        new Button({
          label: action.label,
          variant: !selected && actionId === 'data-sources' ? 'primary' : 'secondary',
          onClick: () => {
            this.dispatchGlobal(categoryId, actionId);
          },
        })
      );
    }
  }

  override dispose(): void {
    for (const button of this._buttons) button.dispose();
    this._buttons = [];
    super.dispose();
  }
}
