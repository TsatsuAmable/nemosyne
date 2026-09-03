import * as THREE from 'three';
import type { DiscoveryEpisode } from '../../investigation/DiscoveryEpisode.ts';
import type {
  DiscoveryReasoningSnapshot,
  DiscoveryTestOutcome,
} from '../../app/investigation/DiscoveryReasoningService.ts';
import type {
  InvestigationJourneyController,
  RecordUnderstandingInput,
} from '../../app/investigation/InvestigationJourneyController.ts';
import { COLOR_TOKENS, cssHex } from '../ui-system/tokens.ts';
import { MovablePanel } from './MovablePanel.ts';

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
  x: number;
  y: number;
  w: number;
  h: number;
  enabled: boolean;
}

interface TextEntryButton {
  id: string;
  label: string;
  value?: string;
  x: number;
  y: number;
  w: number;
  h: number;
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

function wrapText(value: string, maxColumns = 66): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (word.length > maxColumns) {
      if (line) {
        lines.push(line);
        line = '';
      }
      for (let offset = 0; offset < word.length; offset += maxColumns) {
        lines.push(word.slice(offset, offset + maxColumns));
      }
      continue;
    }
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxColumns) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * XR presentation for the same NIL-backed investigation controller used by desktop.
 * It owns no investigation state. Text authoring stays inside this spatial panel as
 * bounded ephemeral presentation state until explicit submit delegates to the shared
 * journey controller.
 */
export class InvestigationJourneyPanel extends MovablePanel {
  private readonly journey: InvestigationJourneyController;
  private snapshotValue: DiscoveryReasoningSnapshot;
  private selectedDiscoveryId: string | null = null;
  private busy = false;
  private textEntry: TextEntrySession | null = null;
  private uppercase = false;
  private keyboardButtons: TextEntryButton[] = [];
  status = 'Ready';
  buttons: JourneyButton[] = [];

  constructor(cameraGroup: THREE.Group, journey: InvestigationJourneyController) {
    super(cameraGroup, {
      title: 'INVESTIGATION',
      width: 760,
      height: 900,
      position: [0.7, 1.45, -1.05],
      worldSize: [0.9, 1.08],
      titleBarHeight: 44,
      contentPadding: 18,
    });
    this.journey = journey;
    this.snapshotValue = journey.snapshot();
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
      this.totalContentHeight = 790;
      return;
    }

    this.keyboardButtons = [];
    const episode = this.selectedEpisode();
    const hasObservation = Boolean(this.snapshotValue.latestObservation);
    const hasResult = Boolean(this.snapshotValue.latestResult);
    const rowH = 48;
    const gap = 8;
    const x = 40;
    const w = 680;
    let y = 190;
    const add = (id: JourneyActionId, label: string, enabled: boolean): void => {
      this.buttons.push({ id, label, x, y, w, h: rowH, enabled: enabled && !this.busy });
      y += rowH + gap;
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
    add(
      'support',
      '5 · Evidence supports the hypothesis',
      Boolean(episode?.conclusion && !terminal(episode) && hasResult),
    );
    add(
      'refute',
      '5 · Evidence refutes the hypothesis',
      Boolean(episode?.conclusion && !terminal(episode) && hasResult),
    );
    add(
      'inconclusive',
      '5 · Evidence is inconclusive',
      Boolean(episode?.conclusion && !terminal(episode) && hasResult),
    );
    add('return', 'Return to recorded discovery', Boolean(episode?.conclusion));
    this.totalContentHeight = y + 40;
  }

  private registerTextEntryButtons(): void {
    const buttons: TextEntryButton[] = [];
    const left = 40;
    const availableWidth = 680;
    const keyHeight = 52;
    const gap = 6;
    let y = 300;

    const addRow = (characters: readonly string[]): void => {
      const keyWidth = (availableWidth - gap * (characters.length - 1)) / characters.length;
      characters.forEach((character, index) => {
        buttons.push({
          id: `char:${character}`,
          label: this.uppercase ? character.toUpperCase() : character,
          value: character,
          x: left + index * (keyWidth + gap),
          y,
          w: keyWidth,
          h: keyHeight,
        });
      });
      y += keyHeight + gap;
    };

    addRow(['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p']);
    addRow(['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l']);
    addRow(['z', 'x', 'c', 'v', 'b', 'n', 'm']);
    addRow(['.', ',', '?', '-', "'", '!', ':']);

    buttons.push(
      { id: 'shift', label: this.uppercase ? 'SHIFT ON' : 'Shift', x: left, y, w: 120, h: keyHeight },
      { id: 'space', label: 'Space', value: ' ', x: left + 128, y, w: 316, h: keyHeight },
      { id: 'backspace', label: 'Backspace', x: left + 452, y, w: 228, h: keyHeight },
    );
    y += keyHeight + gap;
    buttons.push(
      { id: 'cancel', label: 'Cancel', x: left, y, w: 210, h: keyHeight },
      { id: 'clear', label: 'Clear', x: left + 218, y, w: 210, h: keyHeight },
      {
        id: 'submit',
        label: this.textEntry?.submitLabel ?? 'Save',
        x: left + 436,
        y,
        w: 244,
        h: keyHeight,
      },
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
    this.scrollOffset = 0;
    this.status = `Enter text · 0/${options.maxLength}`;
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
      this.status = `${session.label} cannot be empty`;
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
      this.status = `Enter text · 0/${session.maxLength}`;
      this.render();
      return;
    }
    if (id === 'backspace') {
      session.value = session.value.slice(0, -1);
      this.status = `Enter text · ${session.value.length}/${session.maxLength}`;
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
      this.status = `Text limit reached · ${session.maxLength} characters`;
      this.render();
      return;
    }

    session.value += raw === ' ' ? raw : this.uppercase ? raw.toUpperCase() : raw;
    if (this.uppercase && raw !== ' ') {
      this.uppercase = false;
      this.registerTextEntryButtons();
    }
    this.status = `Enter text · ${session.value.length}/${session.maxLength}`;
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
            this.status = `Notice saved · ${observation.id}`;
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
      if (!observation) {
        this.status = 'Save a notice first';
        return this.render();
      }
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

    if (!episode) {
      this.status = 'Ask a research question first';
      return this.render();
    }

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
      if (!result) {
        this.status = 'Run an analysis before recording understanding';
        return this.render();
      }
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
      if (!result) {
        this.status = 'No analytical evidence is ready for validation';
        return this.render();
      }
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
        this.status = `Returned to discovery · ${node.id}`;
      } catch (error: unknown) {
        this.status = error instanceof Error ? error.message : String(error);
      }
      this.refreshJourney();
    }
  }

  private renderTextEntry(ctx: CanvasRenderingContext2D): void {
    const session = this.textEntry;
    if (!session) return;

    ctx.textAlign = 'left';
    ctx.fillStyle = cssHex(COLOR_TOKENS.text.primary);
    ctx.font = 'bold 22px monospace';
    ctx.fillText('IN-HEADSET TEXT ENTRY', 40, 42);

    ctx.fillStyle = cssHex(COLOR_TOKENS.text.secondary);
    ctx.font = '16px monospace';
    ctx.fillText(session.label, 40, 76, 680);
    ctx.fillText(this.status, 40, 104, 680);

    ctx.fillStyle = cssHex(COLOR_TOKENS.surface.raised);
    ctx.fillRect(40, 126, 680, 142);
    ctx.strokeStyle = cssHex(COLOR_TOKENS.surface.border);
    ctx.strokeRect(40, 126, 680, 142);

    ctx.fillStyle = cssHex(COLOR_TOKENS.text.primary);
    ctx.font = '17px monospace';
    const lines = wrapText(session.value || 'Type with the spatial keyboard below.');
    const visibleLines = lines.slice(-6);
    visibleLines.forEach((line, index) => {
      ctx.fillText(line, 54, 152 + index * 20, 650);
    });

    ctx.font = 'bold 17px monospace';
    for (const button of this.keyboardButtons) {
      const destructive = button.id === 'cancel' || button.id === 'clear';
      ctx.fillStyle = destructive
        ? 'rgba(120, 70, 70, 0.72)'
        : cssHex(COLOR_TOKENS.surface.raised);
      ctx.fillRect(button.x, button.y, button.w, button.h);
      ctx.strokeStyle = cssHex(COLOR_TOKENS.surface.border);
      ctx.strokeRect(button.x, button.y, button.w, button.h);
      ctx.fillStyle = cssHex(COLOR_TOKENS.text.primary);
      ctx.textAlign = 'center';
      ctx.fillText(button.label, button.x + button.w / 2, button.y + 31, button.w - 12);
    }
    ctx.textAlign = 'left';
  }

  renderContent(ctx: CanvasRenderingContext2D): void {
    if (this.textEntry) {
      this.renderTextEntry(ctx);
      return;
    }

    const episode = this.selectedEpisode();
    ctx.textAlign = 'left';
    ctx.fillStyle = cssHex(COLOR_TOKENS.text.primary);
    ctx.font = 'bold 22px monospace';
    ctx.fillText('GUIDED INVESTIGATION', 40, 42);

    ctx.fillStyle = cssHex(COLOR_TOKENS.text.secondary);
    ctx.font = '16px monospace';
    ctx.fillText(`Next · ${stageLabel(this.snapshotValue, episode)}`, 40, 76, 680);
    ctx.fillText(this.status, 40, 104, 680);

    if (episode) {
      ctx.fillText(`Question · ${(episode.question ?? 'not set').slice(0, 68)}`, 40, 132, 680);
      ctx.fillText(`Status · ${friendlyStatus(episode.validationStatus)}`, 40, 158, 680);
    } else if (this.snapshotValue.latestObservation) {
      ctx.fillText(`Notice · ${this.snapshotValue.latestObservation.notes.slice(0, 68)}`, 40, 132, 680);
    }

    ctx.font = 'bold 17px monospace';
    for (const button of this.buttons) {
      ctx.fillStyle = button.enabled
        ? cssHex(COLOR_TOKENS.surface.raised)
        : 'rgba(70, 78, 88, 0.35)';
      ctx.fillRect(button.x, button.y, button.w, button.h);
      ctx.strokeStyle = button.enabled
        ? cssHex(COLOR_TOKENS.surface.border)
        : 'rgba(120, 128, 138, 0.3)';
      ctx.strokeRect(button.x, button.y, button.w, button.h);
      ctx.fillStyle = button.enabled
        ? cssHex(COLOR_TOKENS.text.primary)
        : cssHex(COLOR_TOKENS.text.muted);
      ctx.fillText(button.label, button.x + 14, button.y + 30, button.w - 28);
    }
  }

  handleContentClick(raycaster: THREE.Raycaster): boolean {
    this.mesh.updateMatrixWorld(true);
    const hits = raycaster.intersectObject(this.mesh, false);
    if (hits.length === 0 || !hits[0].uv) return false;
    const canvasX = hits[0].uv.x * this.width;
    const canvasY = (1 - hits[0].uv.y) * this.height;
    const contentY = canvasY - (this.titleBarHeight + 4) + this.scrollOffset;
    if (contentY < 0) return false;

    if (this.textEntry) {
      for (const button of this.keyboardButtons) {
        if (
          canvasX >= button.x &&
          canvasX <= button.x + button.w &&
          contentY >= button.y &&
          contentY <= button.y + button.h
        ) {
          void this.activateTextKey(button.id);
          return true;
        }
      }
      return false;
    }

    for (const button of this.buttons) {
      if (
        button.enabled &&
        canvasX >= button.x &&
        canvasX <= button.x + button.w &&
        contentY >= button.y &&
        contentY <= button.y + button.h
      ) {
        void this.activate(button.id);
        return true;
      }
    }
    return false;
  }
}
