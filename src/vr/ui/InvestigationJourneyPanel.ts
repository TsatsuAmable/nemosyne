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

interface JourneyButton {
  id:
    | 'refresh'
    | 'notice'
    | 'question'
    | 'hypothesis'
    | 'understanding'
    | 'support'
    | 'refute'
    | 'inconclusive'
    | 'return';
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  enabled: boolean;
}

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
 * XR presentation for the same NIL-backed investigation controller used by desktop.
 * It owns no investigation state. Text entry currently delegates to the browser's
 * user-text prompt surface so controller/headset input cannot become a second domain path.
 */
export class InvestigationJourneyPanel extends MovablePanel {
  private readonly journey: InvestigationJourneyController;
  private snapshotValue: DiscoveryReasoningSnapshot;
  private selectedDiscoveryId: string | null = null;
  private busy = false;
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

  private selectedEpisode(): DiscoveryEpisode | null {
    return (
      this.snapshotValue.discoveries.find(
        (entry) => entry.discoveryId === this.selectedDiscoveryId,
      ) ?? null
    );
  }

  private registerButtons(): void {
    const episode = this.selectedEpisode();
    const hasObservation = Boolean(this.snapshotValue.latestObservation);
    const hasResult = Boolean(this.snapshotValue.latestResult);
    const rowH = 48;
    const gap = 8;
    const x = 40;
    const w = 680;
    let y = 190;
    const add = (id: JourneyButton['id'], label: string, enabled: boolean): void => {
      this.buttons.push({ id, label, x, y, w, h: rowH, enabled: enabled && !this.busy });
      y += rowH + gap;
    };

    this.buttons = [];
    add('refresh', 'Refresh investigation', true);
    add('notice', '1 · Save a notice', true);
    add('question', '2 · Ask a question', hasObservation);
    add('hypothesis', '3 · Form a hypothesis', Boolean(episode && episode.validationStatus === 'UNTESTED'));
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

  private promptText(label: string, initial = ''): string | null {
    if (typeof window.prompt !== 'function') {
      this.status = 'Text entry is unavailable on this runtime';
      return null;
    }
    const value = window.prompt(label, initial);
    if (value === null) return null;
    const normalized = value.trim();
    if (!normalized) {
      this.status = `${label} cannot be empty`;
      return null;
    }
    return normalized;
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

  async activate(id: JourneyButton['id']): Promise<void> {
    if (id === 'refresh') {
      this.status = 'Investigation refreshed';
      this.refreshJourney();
      return;
    }

    if (id === 'notice') {
      const note = this.promptText('What did you notice?');
      if (!note) return this.render();
      await this.run(async () => {
        const observation = await this.journey.observe(note);
        this.status = `Notice saved · ${observation.id}`;
      });
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
      const question = this.promptText('What question does this notice raise?');
      if (!question) return this.render();
      await this.run(async () => {
        this.selectedDiscoveryId = await this.journey.ask(observation.id, question);
        this.status = 'Research question saved';
      });
      return;
    }

    if (!episode) {
      this.status = 'Ask a research question first';
      return this.render();
    }

    if (id === 'hypothesis') {
      const hypothesis = this.promptText('State a testable hypothesis');
      if (!hypothesis) return this.render();
      await this.run(async () => {
        await this.journey.hypothesise(episode.discoveryId, hypothesis);
        this.status = 'Hypothesis saved · investigate with an analytical tool';
      });
      return;
    }

    if (id === 'understanding') {
      const result = snapshot.latestResult;
      if (!result) {
        this.status = 'Run an analysis before recording understanding';
        return this.render();
      }
      const title = this.promptText('Short title for what you now understand');
      if (!title) return this.render();
      const description = this.promptText('What does the evidence mean?');
      if (!description) return this.render();
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

  renderContent(ctx: CanvasRenderingContext2D): void {
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
    const contentY = canvasY + this.scrollOffset;
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
