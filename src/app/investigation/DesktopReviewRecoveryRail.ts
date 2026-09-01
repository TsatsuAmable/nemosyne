import type { ArchiveEntry } from '../../session/VaultArchiveStore.ts';
import type { RepresentationReviewSnapshot } from './RepresentationReviewService.ts';

export interface DesktopReviewRecoveryActions {
  representationSnapshot(): RepresentationReviewSnapshot;
  previewRemediation(remediationId: string): RepresentationReviewSnapshot;
  commitRemediation(remediationId: string): RepresentationReviewSnapshot;
  rejectPreview(): RepresentationReviewSnapshot;
  revertLastRepresentationChange(): RepresentationReviewSnapshot;
  archives(): readonly ArchiveEntry[];
  freezeCurrent(): Promise<void>;
  restoreLatest(): Promise<void>;
  subscribeContext?(handler: () => void): () => void;
}

export interface DesktopReviewRecoveryHandle {
  refresh(): void;
  dispose(): void;
}

function makeButton(id: string, label: string): HTMLElement {
  const element = document.createElement('nms-button');
  element.id = id;
  element.setAttribute('label', label);
  element.setAttribute('aria-label', label);
  element.setAttribute('variant', 'secondary');
  element.setAttribute('size', 'sm');
  element.style.width = '100%';
  return element;
}

function compactLine(id: string): HTMLParagraphElement {
  const element = document.createElement('p');
  element.id = id;
  element.style.cssText = `
    margin: 0;
    color: var(--nms-color-text-secondary);
    font-size: var(--nms-font-size-meta);
    line-height: 1.35;
    overflow-wrap: anywhere;
  `;
  return element;
}

function decisionLabel(snapshot: RepresentationReviewSnapshot): string {
  const decision = snapshot.current;
  if (!decision) return `${snapshot.outcomeState ?? 'PENDING'} · no committed representation decision`;
  const candidate = decision.candidateId ?? decision.family ?? 'unknown candidate';
  const layout = decision.layout ? ` / ${decision.layout}` : '';
  return `${decision.status ?? snapshot.outcomeState ?? 'PENDING'} · ${candidate}${layout}`;
}

/**
 * Secondary desktop counterpart to the existing TechnoCore/RecommendationPanel
 * and Evidence Vault spatial instruments. It owns no representation or archive
 * state; all mutations delegate to their existing product owners.
 */
export function mountDesktopReviewRecoveryRail(
  actions: DesktopReviewRecoveryActions,
): DesktopReviewRecoveryHandle {
  const shell = document.getElementById('investigation-shell');
  const sidebar = shell?.querySelector('aside');
  if (!(sidebar instanceof HTMLElement)) {
    return { refresh: () => {}, dispose: () => {} };
  }

  const section = document.createElement('details');
  section.id = 'desktop-review-recovery-rail';
  section.style.cssText = `
    border-top: 1px solid var(--nms-color-surface-border);
    padding-top: var(--nms-spacing-x12);
  `;

  const summary = document.createElement('summary');
  summary.textContent = 'Review & recovery';
  summary.style.cssText = `
    cursor: pointer;
    color: var(--nms-color-text-secondary);
    font-size: var(--nms-font-size-meta);
    font-weight: 500;
  `;
  section.appendChild(summary);

  const body = document.createElement('div');
  body.style.cssText = `
    display: grid;
    gap: var(--nms-spacing-x8);
    margin-top: var(--nms-spacing-x8);
  `;
  section.appendChild(body);

  const representation = compactLine('review-representation');
  const preview = compactLine('review-preview');
  const alternatives = compactLine('review-alternatives');
  const constraints = compactLine('review-constraints');
  body.append(representation, preview, alternatives, constraints);

  const remediationSelect = document.createElement('select');
  remediationSelect.id = 'review-remediation';
  remediationSelect.setAttribute('aria-label', 'Representation remediation');
  remediationSelect.style.cssText = `
    width: 100%;
    box-sizing: border-box;
    padding: var(--nms-spacing-x8);
    background: var(--nms-color-surface-raised);
    border: 1px solid var(--nms-color-surface-border);
    border-radius: var(--nms-panel-border-radius);
    color: var(--nms-color-text-primary);
    font: inherit;
    font-size: var(--nms-font-size-meta);
  `;
  body.appendChild(remediationSelect);

  const previewButton = makeButton('review-preview-remediation', 'Preview representation change');
  const commitButton = makeButton('review-commit-remediation', 'Accept preview');
  const rejectButton = makeButton('review-reject-remediation', 'Reject preview');
  const revertButton = makeButton('review-revert-remediation', 'Revert last representation change');
  body.append(previewButton, commitButton, rejectButton, revertButton);

  const divider = document.createElement('div');
  divider.style.cssText = 'border-top: 1px solid var(--nms-color-surface-border); margin-top: var(--nms-spacing-x4);';
  body.appendChild(divider);

  const archiveStatus = compactLine('recovery-archives');
  body.appendChild(archiveStatus);
  const freezeButton = makeButton('recovery-freeze', 'Freeze current investigation');
  const restoreButton = makeButton('recovery-restore-latest', 'Restore latest frozen investigation');
  body.append(freezeButton, restoreButton);

  const feedback = compactLine('review-recovery-feedback');
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  body.appendChild(feedback);

  const refresh = (): void => {
    const state = actions.representationSnapshot();
    representation.textContent = `Representation · ${decisionLabel(state)}`;
    representation.title = state.explanation ?? '';

    if (state.preview) {
      const candidate = state.preview.candidateId ?? state.preview.family ?? 'unknown candidate';
      preview.textContent = `PREVIEW · ${candidate}${state.preview.layout ? ` / ${state.preview.layout}` : ''} · uncommitted`;
    } else {
      preview.textContent = 'COMMITTED · no representation preview active';
    }

    alternatives.textContent = state.alternatives.length > 0
      ? `Alternatives · ${state.alternatives.map((entry) => `${entry.candidateId} (${entry.layout})${entry.disqualified ? ' unavailable' : ''}`).join(' · ')}`
      : 'Alternatives · none reported by current Moneta decision';
    constraints.textContent = state.constraints.length > 0
      ? `Constraints · ${state.constraints.map((entry) => `${entry.candidateName}: ${entry.reason}`).join(' · ')}`
      : 'Constraints · none blocking the current outcome';

    const selected = remediationSelect.value;
    remediationSelect.replaceChildren();
    for (const remediation of state.remediations) {
      const option = document.createElement('option');
      option.value = remediation.id;
      option.textContent = `${remediation.label} · device ${remediation.deviceFeasibility}`;
      remediationSelect.appendChild(option);
    }
    if (state.remediations.some((entry) => entry.id === selected)) remediationSelect.value = selected;

    const hasRemediation = state.remediations.length > 0;
    previewButton.toggleAttribute('disabled', !hasRemediation || Boolean(state.preview));
    commitButton.toggleAttribute('disabled', !state.preview || !hasRemediation);
    rejectButton.toggleAttribute('disabled', !state.preview);
    revertButton.toggleAttribute('disabled', !state.canRevertLastChange);

    const archives = actions.archives();
    const latest = archives.at(-1) ?? null;
    archiveStatus.textContent = latest
      ? `Vault · ${archives.length} frozen · latest ${latest.label} · ${latest.eventCount} events · ${latest.discoveryCount} discoveries`
      : 'Vault · no frozen investigations';
    restoreButton.toggleAttribute('disabled', !latest);
  };

  const selectedRemediationId = (): string => {
    const id = remediationSelect.value;
    if (!id) throw new Error('No representation remediation is currently available.');
    return id;
  };

  previewButton.addEventListener('click', () => {
    try {
      actions.previewRemediation(selectedRemediationId());
      feedback.textContent = 'Representation preview is active and uncommitted.';
      refresh();
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  commitButton.addEventListener('click', () => {
    try {
      actions.commitRemediation(selectedRemediationId());
      feedback.textContent = 'Representation preview committed.';
      refresh();
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  rejectButton.addEventListener('click', () => {
    try {
      actions.rejectPreview();
      feedback.textContent = 'Representation preview rejected; committed state unchanged.';
      refresh();
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  revertButton.addEventListener('click', () => {
    try {
      actions.revertLastRepresentationChange();
      feedback.textContent = 'Last representation remediation reverted with provenance retained.';
      refresh();
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  freezeButton.addEventListener('click', () => {
    freezeButton.setAttribute('disabled', '');
    feedback.textContent = 'Freezing current investigation…';
    void actions.freezeCurrent()
      .then(() => {
        feedback.textContent = 'Investigation frozen in the Evidence Vault.';
        refresh();
      })
      .catch((error: unknown) => {
        feedback.textContent = error instanceof Error ? error.message : String(error);
      })
      .finally(() => freezeButton.removeAttribute('disabled'));
  });

  restoreButton.addEventListener('click', () => {
    restoreButton.setAttribute('disabled', '');
    feedback.textContent = 'Restoring latest frozen investigation…';
    void actions.restoreLatest()
      .then(() => {
        feedback.textContent = 'Latest frozen investigation restored.';
        refresh();
      })
      .catch((error: unknown) => {
        feedback.textContent = error instanceof Error ? error.message : String(error);
      })
      .finally(() => restoreButton.removeAttribute('disabled'));
  });

  const reasoning = sidebar.querySelector('#desktop-reasoning-rail');
  if (reasoning) reasoning.insertAdjacentElement('afterend', section);
  else {
    const moreTools = Array.from(sidebar.children).find(
      (child) => child instanceof HTMLDetailsElement,
    );
    if (moreTools) sidebar.insertBefore(section, moreTools);
    else sidebar.appendChild(section);
  }

  const unsubscribe = actions.subscribeContext?.(refresh) ?? null;
  section.addEventListener('toggle', refresh);
  refresh();

  return {
    refresh,
    dispose: () => {
      unsubscribe?.();
      section.remove();
    },
  };
}
