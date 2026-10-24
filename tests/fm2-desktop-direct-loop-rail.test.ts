// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mountDesktopReviewRecoveryRail,
  type DesktopReviewRecoveryActions,
} from '../src/app/investigation/DesktopReviewRecoveryRail.ts';
import type { RepresentationReviewSnapshot } from '../src/app/investigation/RepresentationReviewService.ts';
import type { DirectLoopSurfaceViewsV1 } from '../src/moneta/representation/DirectLoopViewModels.ts';

const review: RepresentationReviewSnapshot = {
  outcomeState: null, explanation: null, current: null, preview: null,
  previewActionId: null, alternatives: [], constraints: [], remediations: [],
  canRevertLastChange: false, lastRemediationId: null,
};

function emptyDirect(): DirectLoopSurfaceViewsV1 {
  return {
    schemaVersion: '1.0.0',
    inspector: { disclosures: null, purpose: null, alternatives: [] },
    history: { alternatives: [], bindings: [] },
    alternative: { alternatives: [], pair: null },
  };
}

function fixture(): { actions: DesktopReviewRecoveryActions; setDirect: (v: DirectLoopSurfaceViewsV1) => void } {
  document.body.innerHTML = '<section id="investigation-shell"><aside><details><summary>More tools</summary></details></aside></section>';
  let direct = emptyDirect();
  const actions: DesktopReviewRecoveryActions = {
    representationSnapshot: () => review,
    directLoopViews: () => direct,
    previewRemediation: vi.fn(() => review),
    commitRemediation: vi.fn(() => review),
    rejectPreview: vi.fn(() => review),
    revertLastRepresentationChange: vi.fn(() => review),
    archives: () => [],
    freezeCurrent: vi.fn(async () => {}),
    restoreLatest: vi.fn(async () => {}),
  };
  return { actions, setDirect: (v) => { direct = v; } };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('FM1/FM2 direct-loop display on existing desktop Review & Recovery rail', () => {
  it('does not invent alternatives, history or device qualification in an empty investigation', () => {
    const { actions } = fixture();
    const handle = mountDesktopReviewRecoveryRail(actions);
    expect(document.getElementById('review-direct-alternatives')?.textContent).toBe(
      'Direct-loop alternatives · none recorded',
    );
    expect(document.getElementById('review-direct-history')?.textContent).toBe(
      'Direct-loop history · no critique-to-alternative branches',
    );
    expect(document.getElementById('review-direct-variants')?.textContent).toBe(
      'Compiled direct variants · none recorded',
    );
    expect(document.querySelectorAll('#desktop-review-recovery-rail')).toHaveLength(1);
    expect(document.getElementById('review-preview-remediation')?.hasAttribute('disabled')).toBe(true);
    handle.dispose();
  });

  it('shows source-provided alternative lineage and compiled budgets without mutating it, then clears stale data', () => {
    const { actions, setDirect } = fixture();
    const link = {
      linkId: 'rnt-direct-evidence', critiqueId: 'critique-1',
      priorDecisionId: 'decision-before', alternativeDecisionId: 'decision-after',
      targetElementId: 'element-1', contextPurpose: 'CLAIM_BEARING',
      feedbackRecordId: 'feedback-1',
    } as const;
    const views: DirectLoopSurfaceViewsV1 = {
      schemaVersion: '1.0.0',
      inspector: { disclosures: null, purpose: null, alternatives: [link] },
      history: { alternatives: [link], bindings: [{ bindingId: 'binding-1', linkId: link.linkId, critiqueRecordId: 'feedback-1' }] },
      alternative: {
        alternatives: [link],
        pair: {
          traversalRootId: 'traversal-1',
          mandatoryNodeIds: ['semantic-node-1'],
          mandatoryChannels: ['spatial_scatter'],
          variants: [
            { budgetProfile: 'DESKTOP_EXPANSIVE', variantTier: 'MONA_LISA_EXPANSIVE',
              planId: 'plan-desktop', decisionId: 'decision-desktop',
              elementCount: 7, shedOptionalChannels: [] },
            { budgetProfile: 'QUEST_CONSTRAINED', variantTier: 'STICKMAN_ESSENTIAL',
              planId: 'plan-constrained', decisionId: 'decision-constrained',
              elementCount: 2, shedOptionalChannels: ['secondary_voxel_surface'] },
          ],
        },
      },
    };
    setDirect(views);
    const handle = mountDesktopReviewRecoveryRail(actions);
    expect(document.getElementById('review-direct-alternatives')?.textContent).toContain(
      'element-1: decision-before → decision-after',
    );
    expect(document.getElementById('review-direct-history')?.textContent).toContain(
      'critique-1 / CLAIM_BEARING / feedback feedback-1',
    );
    expect(document.getElementById('review-direct-variants')?.textContent)
      .toContain('Compiled direct variants (device unverified)');
    expect(document.getElementById('review-direct-variants')?.textContent)
      .toContain('DESKTOP_EXPANSIVE: 7 elements');
    expect(document.getElementById('review-direct-variants')?.textContent)
      .toContain('QUEST_CONSTRAINED: 2 elements');
    expect(views.alternative.alternatives).toEqual([link]);

    setDirect(emptyDirect());
    handle.refresh();
    expect(document.getElementById('review-direct-alternatives')?.textContent)
      .toBe('Direct-loop alternatives · none recorded');
    expect(document.getElementById('review-direct-history')?.textContent)
      .toBe('Direct-loop history · no critique-to-alternative branches');
    expect(document.getElementById('review-direct-variants')?.textContent)
      .toBe('Compiled direct variants · none recorded');
    handle.dispose();
  });
});
