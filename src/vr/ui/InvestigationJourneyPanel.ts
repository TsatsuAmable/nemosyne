import * as THREE from 'three';
import { Container, Text } from '@pmndrs/uikit';
import type { DiscoveryEpisode } from '../../investigation/DiscoveryEpisode.ts';
import type {
  DiscoveryReasoningSnapshot,
  DiscoveryTestOutcome,
} from '../../app/investigation/DiscoveryReasoningService.ts';
import type {
  InvestigationJourneyController,
  RecordUnderstandingInput,
} from '../../app/investigation/InvestigationJourneyController.ts';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { Button } from '../ui-system/components/Button.ts';
import { SPACING_TOKENS } from '../ui-system/tokens.ts';
import { getTheme } from '../ui-system/theme.ts';
import type { AccessibilityOptions } from '../coordinators/types.ts';

type JourneyActionId =
  | 'refresh'
  | 'notice'
  | 'question'
  | 'hypothesis'
  | 'understanding'
  | 'support'
  | 'refute'
  | 'inconclusive'
  | 'return';

interface JourneyButton {
  id: JourneyActionId;
  label: string;
  enabled: boolean;
}

interface TextEntryButton {
  id: string;
  label: string;
  value?: string;
}

interface TextEntrySession {
  label: string;
  value: string;
  maxLength: number;
  submitLabel: string;
  onSubmit: (value: string) => void | Promise<void>;
}

const TEXT_LIMITS = Object.freeze({
  notice: 500,
  question: 500,
  hypothesis: 500,
  understandingTitle: 120,
  understandingDescription: 1000,
});

const PANEL_WIDTH = 760;
const PANEL_HEIGHT = 900;

function terminal(episode: DiscoveryEpisode | null): boolean {
  return Boolean(
    episode &&
      episode.validationStatus !== 'UNTESTED' &&
      episode.validationStatus !== 'UNDER_INVESTIGATION',
  );
}

function friendlyStatus(status: DiscoveryEpisode['validationStatus']): string {
  if (status === 'UNTESTED') return 'Question saved';
  if (status === 'UNDER_INVESTIGATION') return 'Investigation in progress';
  if (status === 'SUPPORTED') return 'Hypothesis supported';
  if (status === 'REFUTED') return 'Hypothesis refuted';
  if (status === 'INCONCLUSIVE') return 'Evidence inconclusive';
  return 'Externally validated';
}

function stageLabel(snapshot: DiscoveryReasoningSnapshot, episode: DiscoveryEpisode | null): string {
  if (!snapshot.latestObservation) return 'Notice something worth investigating';
  if (!episode) return 'Ask a research question';
  if (episode.validationStatus === 'UNTESTED') return 'Form a testable hypothesis';
  if (episode.validationStatus === 'UNDER_INVESTIGATION' && !episode.conclusion) {
    return snapshot.latestResult
      ? 'Record what the evidence means'
      : 'Investigate with an analytical tool';
  }
  if (episode.validationStatus === 'UNDER_INVESTIGATION') return 'Validate the hypothesis';
  return 'Discovery recorded';
}

/**
 * XR presentation for the NIL-backed investigation controller.
 *
 * The panel owns only bounded, ephemeral text-entry state. Investigation and
 * evidence state remain authoritative in InvestigationJourneyController.
 */
export class InvestigationJourneyPanel extends SpatialPanel {
  readonly title = 'INVESTIGATION';
  readonly defaultPosition = new THREE.Vector3(0.7, 1.45, -1.05);
  readonly tilt = 0.22;
  isMinimized = false;
  onHide: (() => void) | null = null;
  onDragDelta: ((delta: THREE.Vector3) => void) | null = null;
  onDragEnd: (() => void) | null = null;

  private readonly journey: InvestigationJourneyController;
  private snapshotValue: DiscoveryReasoningSnapshot;
  private selectedDiscoveryId: string | null = null;
  private busy = false;
  private textEntry: TextEntrySession | null = null;
  private uppercase = false;
  private keyboardButtons: TextEntryButton[] = [];

  status = 'Ready';
  buttons: JourneyButton[] = [];

  private readonly _summary: Text;
  private readonly _actions: Container;
  private readonly _keyboard: Container;
  private _actionButtons: Button[] = [];
  private _keyboardControls: Array<Button | Container> = [];
  private _keyboardSignature = '';
  private _textScale = 1;
  private _highContrast = false;

  constructor(analystAnchor: THREE.Object3D, journey: InvestigationJourneyController) {
    const theme = getTheme(false);
    super({
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      flexDirection: 'column',
      gap: SPACING_TOKENS.grid.x8,
      padding: SPACING_TOKENS.grid.x12,
      backgroundColor: Number(theme.backgroundColor),
      borderColor: Number(theme.borderColor),
      borderWidth: 2,
      borderRadius: 8,
    }, analystAnchor, null);

    this.name = 'investigation-journey-panel';
    this.journey = journey;
    this.snapshotValue = journey.snapshot();
    this.scale.setScalar(0.9 / PANEL_WIDTH);
    this.position.copy(this.defaultPosition);

    this._summary = new Text({
      text: '',
      fontSize: 16,
      color: Number(theme.textPrimary),
    });
    this._actions = new Container({
      flexDirection: 'column',
      gap: SPACING_TOKENS.grid.x4,
    });
    this._keyboard = new Container({
      flexDirection: 'column',
      gap: SPACING_TOKENS.grid.x4,
    });
    this.add(this._summary, this._actions, this._keyboard);

    this.syncSelection();
    this.registerButtons();
    this.render();
  }

  private syncSelection(): void {
    const discoveries = this.snapshotValue.discoveries;
    if (
      this.selectedDiscoveryId &&
      discoveries.some((entry) => entry.discoveryId === this.selectedDiscoveryId)
    ) {
      return;
    }
    this.selectedDiscoveryId = discoveries.at(-1)?.discoveryId ?? null;
  }

  refreshJourney(): void {
    this.snapshotValue = this.journey.snapshot();
    this.syncSelection();
    this.registerButtons();
    this.render();
  }

  isTextEntryActive(): boolean {
    return this.textEntry !== null;
  }

  getRenderedSummary(): string {
    return this._formatSummary();
  }

  private selectedEpisode(): DiscoveryEpisode | null {
    return (
      this.snapshotValue.discoveries.find(
        (entry) => entry.discoveryId === this.selectedDiscoveryId,
      ) ?? null
    );
  }

  private registerButtons(): void {
    if (this.textEntry) {
      this.buttons = [];
      this.registerTextEntryButtons();
      return;
    }

    this.keyboardButtons = [];
    const episode = this.selectedEpisode();
    const hasObservation = Boolean(this.snapshotValue.latestObservation);
    const hasResult = Boolean(this.snapshotValue.latestResult);

    const add = (id: JourneyActionId, label: string, enabled: boolean): void => {
      this.buttons.push({ id, label, enabled: enabled && !this.busy });
    };

    this.buttons = [];
    add('refresh', 'Refresh investigation', true);
    add('notice', '1 · Save a notice', true);
    add('question', '2 · Ask a question', hasObservation);
    add(
      'hypothesis',
      '3 · Form a hypothesis',
      Boolean(episode && episode.validationStatus === 'UNTESTED'),
    );
    add(
      'understanding',
      '4 · Record understanding from latest evidence',
      Boolean(
        episode &&
          episode.validationStatus === 'UNDER_INVESTIGATION' &&
          !episode.conclusion &&
          hasResult,
      ),
    );
    const canValidate = Boolean(episode?.conclusion && !terminal(episode) && hasResult);
    add('support', '5 · Evidence supports the hypothesis', canValidate);
    add('refute', '5 · Evidence refutes the hypothesis', canValidate);
    add('inconclusive', '5 · Evidence is inconclusive', canValidate);
    add('return', 'Return to recorded discovery', Boolean(episode?.conclusion));
  }

  private registerTextEntryButtons(): void {
    const buttons: TextEntryButton[] = [];
    const addRow = (characters: readonly string[]): void => {
      for (const character of characters) {
        buttons.push({
          id: 'char:' + character,
          label: this.uppercase ? character.toUpperCase() : character,
          value: character,
        });
      }
    };

    addRow(['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p']);
    addRow(['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l']);
    addRow(['z', 'x', 'c', 'v', 'b', 'n', 'm']);
    addRow(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
    addRow(['.', ',', '?', '-', '+', '=', '/', '%', '<', '>']);
    addRow(['(', ')', ':', ';', "'", '"', '_', '#', '@', '&']);

    buttons.push(
      { id: 'shift', label: this.uppercase ? 'SHIFT ON' : 'Shift' },
      { id: 'space', label: 'Space', value: ' ' },
      { id: 'backspace', label: 'Backspace' },
      { id: 'cancel', label: 'Cancel' },
      { id: 'clear', label: 'Clear' },
      { id: 'submit', label: this.textEntry?.submitLabel ?? 'Save' },
    );
    this.keyboardButtons = buttons;
  }

  private beginTextEntry(
    label: string,
    onSubmit: TextEntrySession['onSubmit'],
    options: { maxLength: number; submitLabel?: string },
  ): void {
    this.textEntry = {
      label,
      value: '',
      maxLength: options.maxLength,
      submitLabel: options.submitLabel ?? 'Save',
      onSubmit,
    };
    this.uppercase = false;
    this.status = 'Enter text · 0/' + options.maxLength;
    this.registerButtons();
    this.render();
  }

  private cancelTextEntry(): void {
    this.textEntry = null;
    this.uppercase = false;
    this.keyboardButtons = [];
    this.status = 'Text entry cancelled';
    this.refreshJourney();
  }

  private async submitTextEntry(): Promise<void> {
    const session = this.textEntry;
    if (!session) return;
    const normalized = session.value.trim();
    if (!normalized) {
      this.status = session.label + ' cannot be empty';
      this.render();
      return;
    }

    this.textEntry = null;
    this.uppercase = false;
    this.keyboardButtons = [];
    this.registerButtons();
    this.render();
    try {
      await session.onSubmit(normalized);
    } catch (error: unknown) {
      this.status = error instanceof Error ? error.message : String(error);
      this.refreshJourney();
    }
  }

  async activateTextKey(id: string): Promise<void> {
    const session = this.textEntry;
    if (!session) return;
    const button = this.keyboardButtons.find((entry) => entry.id === id);
    if (!button) return;

    if (id === 'cancel') {
      this.cancelTextEntry();
      return;
    }
    if (id === 'clear') {
      session.value = '';
      this.status = 'Enter text · 0/' + session.maxLength;
      this.render();
      return;
    }
    if (id === 'backspace') {
      session.value = session.value.slice(0, -1);
      this.status = 'Enter text · ' + session.value.length + '/' + session.maxLength;
      this.render();
      return;
    }
    if (id === 'shift') {
      this.uppercase = !this.uppercase;
      this.registerTextEntryButtons();
      this.render();
      return;
    }
    if (id === 'submit') {
      await this.submitTextEntry();
      return;
    }

    const raw = button.value;
    if (raw === undefined) return;
    if (session.value.length >= session.maxLength) {
      this.status = 'Text limit reached · ' + session.maxLength + ' characters';
      this.render();
      return;
    }

    session.value += raw === ' ' ? raw : this.uppercase ? raw.toUpperCase() : raw;
    if (this.uppercase && raw !== ' ') {
      this.uppercase = false;
      this.registerTextEntryButtons();
    }
    this.status = 'Enter text · ' + session.value.length + '/' + session.maxLength;
    this.render();
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.registerButtons();
    this.render();
    try {
      await action();
    } catch (error: unknown) {
      this.status = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.refreshJourney();
    }
  }

  async activate(id: JourneyActionId): Promise<void> {
    if (this.textEntry) {
      this.status = 'Finish or cancel text entry first';
      this.render();
      return;
    }

    const button = this.buttons.find((candidate) => candidate.id === id);
    if (!button?.enabled) return;

    if (id === 'refresh') {
      this.status = 'Investigation refreshed';
      this.refreshJourney();
      return;
    }

    if (id === 'notice') {
      this.beginTextEntry(
        'What did you notice?',
        async (note) => {
          await this.run(async () => {
            const observation = await this.journey.observe(note);
            this.status = 'Notice saved · ' + observation.id;
          });
        },
        { maxLength: TEXT_LIMITS.notice, submitLabel: 'Save notice' },
      );
      return;
    }

    const snapshot = this.journey.snapshot();
    const episode = this.selectedEpisode();

    if (id === 'question') {
      const observation = snapshot.latestObservation;
      if (!observation) return;
      this.beginTextEntry(
        'What question does this notice raise?',
        async (question) => {
          await this.run(async () => {
            this.selectedDiscoveryId = await this.journey.ask(observation.id, question);
            this.status = 'Research question saved';
          });
        },
        { maxLength: TEXT_LIMITS.question, submitLabel: 'Save question' },
      );
      return;
    }

    if (!episode) return;

    if (id === 'hypothesis') {
      this.beginTextEntry(
        'State a testable hypothesis',
        async (hypothesis) => {
          await this.run(async () => {
            await this.journey.hypothesise(episode.discoveryId, hypothesis);
            this.status = 'Hypothesis saved · investigate with an analytical tool';
          });
        },
        { maxLength: TEXT_LIMITS.hypothesis, submitLabel: 'Save hypothesis' },
      );
      return;
    }

    if (id === 'understanding') {
      const result = snapshot.latestResult;
      if (!result) return;
      this.beginTextEntry(
        'Short title for what you now understand',
        (title) => {
          this.beginTextEntry(
            'What does the evidence mean?',
            async (description) => {
              const input: RecordUnderstandingInput = {
                discoveryId: episode.discoveryId,
                title,
                description,
                resultId: result.resultId,
              };
              await this.run(async () => {
                await this.journey.recordUnderstanding(input);
                this.status = 'Understanding recorded · ready to validate';
              });
            },
            {
              maxLength: TEXT_LIMITS.understandingDescription,
              submitLabel: 'Save understanding',
            },
          );
        },
        { maxLength: TEXT_LIMITS.understandingTitle, submitLabel: 'Continue' },
      );
      return;
    }

    if (id === 'support' || id === 'refute' || id === 'inconclusive') {
      const result = snapshot.latestResult;
      if (!result) return;
      const outcome: DiscoveryTestOutcome =
        id === 'support' ? 'SUPPORTS' : id === 'refute' ? 'REFUTES' : 'INCONCLUSIVE';
      await this.run(async () => {
        await this.journey.validate(episode.discoveryId, result.resultId, outcome);
        this.status =
          outcome === 'SUPPORTS'
            ? 'Discovery recorded · hypothesis supported'
            : outcome === 'REFUTES'
              ? 'Discovery recorded · hypothesis refuted'
              : 'Discovery recorded · evidence inconclusive';
      });
      return;
    }

    if (id === 'return') {
      try {
        const node = this.journey.returnToDiscovery(episode.discoveryId);
        this.status = 'Returned to discovery · ' + node.id;
      } catch (error: unknown) {
        this.status = error instanceof Error ? error.message : String(error);
      }
      this.refreshJourney();
    }
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
    this._summary.setProperties({
      text: this._formatSummary(),
      fontSize: 16 * this._textScale,
      color: Number(theme.textPrimary),
    });
    this._renderActions();
    this._renderKeyboard();
  }

  private _formatSummary(): string {
    if (this.textEntry) {
      return [
        'IN-HEADSET TEXT ENTRY',
        this.textEntry.label,
        this.status,
        '',
        this.textEntry.value || 'Type with the spatial keyboard below.',
      ].join('\n');
    }

    const episode = this.selectedEpisode();
    const lines = [
      'GUIDED INVESTIGATION',
      'Next · ' + stageLabel(this.snapshotValue, episode),
      this.status,
    ];
    if (episode) {
      lines.push(
        'Question · ' + (episode.question ?? 'not set').slice(0, 68),
        'Status · ' + friendlyStatus(episode.validationStatus),
      );
    } else if (this.snapshotValue.latestObservation) {
      lines.push('Notice · ' + this.snapshotValue.latestObservation.notes.slice(0, 68));
    }
    return lines.join('\n');
  }

  private _renderActions(): void {
    for (const button of this._actionButtons) {
      this._actions.remove(button);
      button.dispose();
    }
    this._actionButtons = [];

    if (this.textEntry) return;
    for (const action of this.buttons) {
      const button = new Button({
        label: action.label,
        variant:
          action.id === 'refute' || action.id === 'inconclusive' ? 'secondary' : 'primary',
        disabled: !action.enabled,
        onClick: () => {
          void this.activate(action.id);
        },
      });
      this._actionButtons.push(button);
      this._actions.add(button);
    }
  }

  private _renderKeyboard(): void {
    const signature = this.textEntry
      ? (this.uppercase ? 'upper:' : 'lower:') + this.textEntry.submitLabel
      : 'none';
    if (signature === this._keyboardSignature) return;
    this._keyboardSignature = signature;

    for (const control of this._keyboardControls) {
      this._keyboard.remove(control);
      control.dispose();
    }
    this._keyboardControls = [];

    if (!this.textEntry) return;

    const rows: TextEntryButton[][] = [];
    const rowDefinitions = [
      ['q','w','e','r','t','y','u','i','o','p'],
      ['a','s','d','f','g','h','j','k','l'],
      ['z','x','c','v','b','n','m'],
      ['1','2','3','4','5','6','7','8','9','0'],
      ['.',',','?','-','+','=','/','%','<','>'],
      ['(',')',':',';',"'","'",'_','#','@','&'],
    ];
    for (const values of rowDefinitions) {
      rows.push(
        values
          .map((value) => this.keyboardButtons.find((entry) => entry.id === 'char:' + value))
          .filter((entry): entry is TextEntryButton => Boolean(entry)),
      );
    }
    rows.push(
      ['shift', 'space', 'backspace']
        .map((id) => this.keyboardButtons.find((entry) => entry.id === id))
        .filter((entry): entry is TextEntryButton => Boolean(entry)),
    );
    rows.push(
      ['cancel', 'clear', 'submit']
        .map((id) => this.keyboardButtons.find((entry) => entry.id === id))
        .filter((entry): entry is TextEntryButton => Boolean(entry)),
    );

    for (const entries of rows) {
      const row = new Container({
        flexDirection: 'row',
        gap: SPACING_TOKENS.grid.x4,
      });
      this._keyboardControls.push(row);
      this._keyboard.add(row);
      for (const entry of entries) {
        const button = new Button({
          label: entry.label,
          variant: entry.id === 'cancel' || entry.id === 'clear' ? 'danger' : 'secondary',
          onClick: () => {
            void this.activateTextKey(entry.id);
          },
        });
        row.add(button);
      }
    }
  }
}
