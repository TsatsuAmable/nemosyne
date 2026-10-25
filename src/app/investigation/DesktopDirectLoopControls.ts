import type { AtlasCore } from '../../atlas/AtlasCore.ts';
import { computeCommittedContextIdentity } from '../../atlas/domain/CommittedInvestigationContext.ts';
import { NIL_VERSION, type NilCommand, type NilExecutor } from '../../interaction/nil/index.ts';
import { WorldTopics, type WorldEventBus } from '../../utils/EventBus.ts';
import {
  directEvidenceReadinessMessage,
  type DirectEvidenceReadinessV1,
} from './DirectEvidenceReadiness.ts';
import type { DirectEmbodimentCompileResult } from '../../moneta/representation/DirectEmbodimentCompiler.ts';

export interface DesktopDirectLoopHandle {
  refresh(): void;
  dispose(): void;
}

const CRITIQUE_KINDS = [
  'SPATIAL_SCALE', 'DENSITY_RESOLUTION', 'CLUSTER_SEPARATION', 'OCCLUSION', 'CUSTOM',
] as const;

function createSelect(id: string, label: string): HTMLSelectElement {
  const control = document.createElement('select');
  control.id = id;
  control.setAttribute('aria-label', label);
  control.style.cssText = 'width: 100%; background: var(--nms-color-surface-raised); color: var(--nms-color-text-primary); padding: var(--nms-spacing-x8);';
  return control;
}

function fillSelect(select: HTMLSelectElement, values: readonly string[]): void {
  const previous = select.value;
  select.replaceChildren();
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
  if (values.includes(previous)) select.value = previous;
}

function actionButton(id: string, label: string): HTMLElement {
  const button = document.createElement('nms-button');
  button.id = id;
  button.setAttribute('label', label);
  button.setAttribute('aria-label', label);
  button.setAttribute('variant', 'secondary');
  button.setAttribute('size', 'sm');
  button.style.width = '100%';
  return button;
}

/**
 * An investigator command surface over the already-running Journey NIL
 * executor and the authoritative Atlas direct compilation. It never creates
 * a synthetic snapshot, compiler result, model verdict or branch.
 */
export function mountDesktopDirectLoopControls(
  atlas: Pick<AtlasCore, 'aggregate' | 'getActiveDirectCompileResult' | 'getDirectFeedbackLinks' |
    'datasetFingerprint' | 'getActiveInvestigationContext'>,
  executor: NilExecutor,
  eventBus?: Pick<WorldEventBus, 'on'>,
  onChanged?: () => void,
  diagnoseEvidence?: () => Promise<DirectEvidenceReadinessV1>,
  compileDirectDistribution?: () => Promise<DirectEmbodimentCompileResult>,
): DesktopDirectLoopHandle {
  const anchor = document.getElementById('review-direct-variants');
  if (!anchor?.parentElement) return { refresh: () => {}, dispose: () => {} };

  const root = document.createElement('div');
  root.id = 'review-direct-actions';
  root.style.cssText = 'display: grid; gap: var(--nms-spacing-x8); border-top: 1px solid var(--nms-color-surface-border); padding-top: var(--nms-spacing-x8);';

  const state = document.createElement('p');
  state.id = 'review-direct-action-state';
  state.setAttribute('role', 'status');
  state.setAttribute('aria-live', 'polite');
  state.style.cssText = 'margin: 0; overflow-wrap: anywhere; font-size: var(--nms-font-size-meta);';
  const target = createSelect('review-direct-target', 'Direct embodiment target');
  const phenomenon = createSelect('review-direct-phenomenon', 'Governed phenomenon');
  const kind = createSelect('review-direct-kind', 'Critique reason');
  fillSelect(kind, CRITIQUE_KINDS);
  const note = document.createElement('textarea');
  note.id = 'review-direct-note';
  note.setAttribute('aria-label', 'Critique note');
  note.placeholder = 'What is inadequate in this representation?';
  note.rows = 2;
  note.style.cssText = 'width: 100%; box-sizing: border-box; resize: vertical; background: var(--nms-color-surface-raised); color: var(--nms-color-text-primary);';
  const reject = actionButton('review-direct-critique', 'Record critique');
  const critique = createSelect('review-direct-critique-id', 'Recorded direct critique');
  const prefer = actionButton('review-direct-prefer', 'Explore constrained alternative (device unverified)');
  const evidenceButton = actionButton('review-direct-check-evidence', 'Check Rust evidence for direct representation');
  const compileButton = actionButton('review-direct-compile', 'Compile governed direct distribution');
  const disclosures = document.createElement('p');
  disclosures.id = 'review-direct-disclosures';
  disclosures.setAttribute('role', 'status');
  disclosures.setAttribute('aria-live', 'polite');
  disclosures.style.cssText = 'margin: 0; overflow-wrap: anywhere; font-size: var(--nms-font-size-meta);';
  const evidenceStatus = document.createElement('p');
  evidenceStatus.id = 'review-direct-evidence-status';
  evidenceStatus.setAttribute('role', 'status');
  evidenceStatus.setAttribute('aria-live', 'polite');
  evidenceStatus.style.cssText = 'margin: 0; overflow-wrap: anywhere; font-size: var(--nms-font-size-meta);';
  evidenceStatus.textContent = 'Direct evidence · not checked';
  root.append(compileButton, disclosures, evidenceButton, evidenceStatus, state, target, phenomenon, kind, note, reject, critique, prefer);
  anchor.insertAdjacentElement('afterend', root);

  let pending = false;
  let compiling = false;
  let checkingEvidence = false;
  let disposed = false;
  let checkEpoch = 0;
  let lastMessage = '';
  let fallbackSequence = 0;
  // Reject stale direct results after dataset replacement or committed intent changes.
  const currentCompilation = () => {
    const active = atlas.getActiveDirectCompileResult();
    const context = atlas.getActiveInvestigationContext();
    return active && context && active.datasetFingerprint === atlas.datasetFingerprint &&
      active.provenance.contextDigest === computeCommittedContextIdentity(context)
      ? active : undefined;
  };
  const refresh = (): void => {
    const active = currentCompilation();
    if (!active) lastMessage = '';
    const elements = active?.plan.elements.map((entry) => entry.id) ?? [];
    const phenomena = active?.boundedOverview.phenomenonCoverage ?? [];
    const critiqueIds = active?.critiqueLedger.map((entry) => entry.critiqueId) ?? [];
    const conjecturalCount = active?.plan.elements.filter((entry) => Boolean(entry.parameters.isConjectural)).length ?? 0;
    fillSelect(target, elements);
    fillSelect(phenomenon, phenomena);
    fillSelect(critique, critiqueIds);
    state.textContent = lastMessage || (!active
      ? 'Direct-loop actions unavailable: no governed direct compilation. Ordinary analysis does not create one.'
      : `Active direct compilation · ${active.compilationId} · ${elements.length} elements; existing branches: ${atlas.getDirectFeedbackLinks().length}`);
    disclosures.textContent = active
      ? `Direct-loop disclosure · ${conjecturalCount} conjectural elements; ${elements.length - conjecturalCount} grounded elements.`
      : 'Direct-loop disclosure · no governed compilation; no representation promoted.';
    compileButton.toggleAttribute('disabled', compiling || !compileDirectDistribution || !atlas.datasetFingerprint);
    evidenceButton.toggleAttribute('disabled', checkingEvidence || !diagnoseEvidence || !atlas.datasetFingerprint);
    reject.toggleAttribute('disabled', pending || compiling || elements.length === 0 || phenomena.length === 0);
    prefer.toggleAttribute('disabled', pending || compiling || critiqueIds.length === 0);
    target.disabled = pending || compiling || elements.length === 0;
    phenomenon.disabled = pending || compiling || phenomena.length === 0;
    kind.disabled = pending || compiling || elements.length === 0;
    note.disabled = pending || compiling || elements.length === 0;
    critique.disabled = pending || compiling || critiqueIds.length === 0;
  };

  compileButton.addEventListener('click', () => {
    if (!compileDirectDistribution || compiling || disposed || !atlas.datasetFingerprint) return;
    compiling = true;
    lastMessage = '';
    const fingerprint = atlas.datasetFingerprint;
    state.textContent = 'Acquiring Rust direct binding and compiling governed snapshot…';
    refresh();
    void compileDirectDistribution().then((result) => {
      if (disposed) return;
      if (atlas.datasetFingerprint !== fingerprint || currentCompilation()?.compilationId !== result.compilationId) {
        lastMessage = 'Direct compilation discarded: dataset or committed context changed.';
        return;
      }
      lastMessage = `Governed direct compilation ready · ${result.compilationId}; active decision unchanged until an explicit researcher action.`;
      onChanged?.();
    }).catch((error: unknown) => {
      if (disposed) return;
      lastMessage = `Direct compilation refused: ${error instanceof Error ? error.message : String(error)}`;
    }).finally(() => {
      if (disposed) return;
      compiling = false;
      refresh();
    });
  });

  evidenceButton.addEventListener('click', () => {
    if (!diagnoseEvidence || checkingEvidence || disposed || !atlas.datasetFingerprint) return;
    checkingEvidence = true;
    const epoch = ++checkEpoch;
    const fingerprint = atlas.datasetFingerprint;
    evidenceStatus.textContent = 'Checking the live Rust producer and governed receipts…';
    refresh();
    void diagnoseEvidence().then((result) => {
      if (disposed || checkEpoch !== epoch) return;
      if (atlas.datasetFingerprint !== fingerprint) {
        evidenceStatus.textContent = 'Direct evidence check discarded: dataset changed.';
        return;
      }
      evidenceStatus.textContent = directEvidenceReadinessMessage(result);
    }).catch((error: unknown) => {
      if (disposed || checkEpoch !== epoch) return;
      evidenceStatus.textContent = `Direct evidence check refused: ${error instanceof Error ? error.message : String(error)}`;
    }).finally(() => {
      if (disposed || checkEpoch !== epoch) return;
      checkingEvidence = false;
      refresh();
    });
  });

  async function execute(verb: 'REJECT' | 'PREFER', parameters: NilCommand['parameters']): Promise<void> {
    const investigationId = atlas.aggregate.sessionId;
    const sequence = executor.expectedSequence(investigationId);
    const command: NilCommand = {
      nilVersion: NIL_VERSION,
      commandId: `desktop-direct-${investigationId}-${sequence}-${++fallbackSequence}`,
      investigationId,
      sequence,
      verb,
      targetIds: [],
      parameters,
      actor: 'researcher',
    };
    await executor.execute(command);
  }

  reject.addEventListener('click', () => {
    if (pending) return;
    lastMessage = '';
    const active = currentCompilation();
    const selectedTarget = target.value;
    const selectedPhenomenon = phenomenon.value;
    const enteredNote = note.value.trim();
    if (!active || !active.plan.elements.some((element) => element.id === selectedTarget) ||
        !active.boundedOverview.phenomenonCoverage.includes(selectedPhenomenon as typeof active.boundedOverview.phenomenonCoverage[number])) {
      lastMessage = 'Critique refused: direct compilation or target is stale.';
      refresh();
      return;
    }
    if (!enteredNote) {
      lastMessage = 'Critique note is required.';
      refresh();
      return;
    }
    pending = true;
    refresh();
    void execute('REJECT', {
      directTarget: selectedTarget,
      phenomenon: selectedPhenomenon,
      critiqueKind: kind.value,
      note: enteredNote,
    }).then(() => {
      note.value = '';
      lastMessage = 'Attributable critique recorded in the direct-loop ledger.';
      onChanged?.();
    }).catch((error: unknown) => {
      lastMessage = error instanceof Error ? error.message : String(error);
    }).finally(() => {
      pending = false;
      refresh();
    });
  });

  prefer.addEventListener('click', () => {
    if (pending) return;
    lastMessage = '';
    const active = currentCompilation();
    const selectedCritique = critique.value;
    if (!active || !active.critiqueLedger.some((entry) => entry.critiqueId === selectedCritique)) {
      lastMessage = 'Alternative refused: critique is not in the active compilation.';
      refresh();
      return;
    }
    pending = true;
    refresh();
    void execute('PREFER', {
      directCritiqueId: selectedCritique,
      budgetProfile: 'QUEST_CONSTRAINED',
    }).then(() => {
      lastMessage = 'Reproducible alternative linked to critique; active decision unchanged. Device performance unverified.';
      onChanged?.();
    }).catch((error: unknown) => {
      lastMessage = error instanceof Error ? error.message : String(error);
    }).finally(() => {
      pending = false;
      refresh();
    });
  });

  const unsubscribers = eventBus ? [
    eventBus.on(WorldTopics.DATASET_LOADED, () => {
      lastMessage = '';
      checkEpoch += 1;
      checkingEvidence = false;
      compiling = false;
      evidenceStatus.textContent = 'Direct evidence · not checked for the new dataset';
      queueMicrotask(refresh);
    }),
    eventBus.on(WorldTopics.OPERATION_APPLIED, () => { lastMessage = ''; queueMicrotask(refresh); }),
    eventBus.on(WorldTopics.HISTORY_SEEK, () => { lastMessage = ''; queueMicrotask(refresh); }),
  ] : [];
  const details = document.getElementById('desktop-review-recovery-rail');
  details?.addEventListener('toggle', refresh);
  refresh();
  return {
    refresh,
    dispose: () => {
      disposed = true;
      checkEpoch += 1;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      details?.removeEventListener('toggle', refresh);
      root.remove();
    },
  };
}
