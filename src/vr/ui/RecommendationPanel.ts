import * as THREE from 'three';
import { Container, Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { Button } from '../ui-system/components/Button.ts';
import { SPACING_TOKENS } from '../ui-system/tokens.ts';
import { getTheme } from '../ui-system/theme.ts';
import type { AccessibilityOptions, MovablePanelOptions } from '../coordinators/types.ts';
import type { AtlasRecommendation } from '../../atlas/types.ts';
import type { InvestigatorActionableOutcome, RemedialAction } from '../../moneta/representation/ActionableNil.ts';
import type { RepresentationDecision } from '../../moneta/representation/RepresentationDecision.ts';

export interface RecommendationPanelOptions extends MovablePanelOptions {
  getRecommendation: () => AtlasRecommendation | null;
  getOutcome?: () => InvestigatorActionableOutcome | null;
  onAccept?: () => void; onReject?: () => void; onOverride?: () => void; onGenerate?: () => void;
  onApplyRemediation?: (action: RemedialAction) => void;
  onPreviewRemediation?: (action: RemedialAction) => boolean;
  getPreviewDecision?: () => RepresentationDecision | null;
  onCommitRemediation?: (action: RemedialAction) => void;
  onCancelRemediationPreview?: () => void;
}

type RecommendationTab = 'guidance' | 'alternatives' | 'constraints' | 'remediation';
const ACTION_LABELS: Record<string, string> = {
  'inspect-cluster': 'Inspect Cluster', 'inspect-boundary': 'Inspect Boundary',
  'explore-region': 'Explore Region', 'compare-regions': 'Compare Regions',
  'investigate-anomaly': 'Investigate Anomaly',
};
const HEURISTIC_RANK_DISCLAIMER =
  'HEURISTIC RANK is a rank-dominance heuristic, not statistical confidence or significance.';
const PANEL_WIDTH = 720;
const PANEL_HEIGHT = 620;

export class RecommendationPanel extends SpatialPanel {
  readonly title = 'GUIDANCE';
  readonly defaultPosition: THREE.Vector3;
  readonly tilt = 0.22;
  isMinimized = false;
  onHide: (() => void) | null = null;
  onDragDelta: ((delta: THREE.Vector3) => void) | null = null;
  onDragEnd: (() => void) | null = null;

  private readonly _getRecommendation: () => AtlasRecommendation | null;
  private readonly _getOutcome?: () => InvestigatorActionableOutcome | null;
  private readonly _onAccept?: () => void;
  private readonly _onReject?: () => void;
  private readonly _onOverride?: () => void;
  private readonly _onGenerate?: () => void;
  private readonly _onApplyRemediation?: (action: RemedialAction) => void;
  private readonly _onPreviewRemediation?: (action: RemedialAction) => boolean;
  private readonly _getPreviewDecision?: () => RepresentationDecision | null;
  private readonly _onCommitRemediation?: (action: RemedialAction) => void;
  private readonly _onCancelRemediationPreview?: () => void;

  private _dirty = true;
  private _activeTab: RecommendationTab = 'guidance';
  private _previewedRemediationId: string | null = null;
  private _textScale = 1;
  private _highContrast = false;
  private readonly _summary: Text;
  private readonly _tabs: Container;
  private readonly _actions: Container;
  private _tabButtons: Button[] = [];
  private _actionControls: Button[] = [];

  constructor(cameraGroup: THREE.Object3D, options: RecommendationPanelOptions) {
    const highContrast = options.highContrast ?? false;
    const theme = getTheme(highContrast);
    super({
      width: PANEL_WIDTH, height: PANEL_HEIGHT, flexDirection: 'column',
      gap: SPACING_TOKENS.grid.x8, padding: SPACING_TOKENS.grid.x12,
      backgroundColor: Number(theme.backgroundColor), borderColor: Number(theme.borderColor),
      borderWidth: 2, borderRadius: 8,
    }, options.parentGroup ?? cameraGroup, null);

    this.name = 'recommendation-panel';
    this._getRecommendation = options.getRecommendation;
    this._getOutcome = options.getOutcome;
    this._onAccept = options.onAccept; this._onReject = options.onReject;
    this._onOverride = options.onOverride; this._onGenerate = options.onGenerate;
    this._onApplyRemediation = options.onApplyRemediation;
    this._onPreviewRemediation = options.onPreviewRemediation;
    this._getPreviewDecision = options.getPreviewDecision;
    this._onCommitRemediation = options.onCommitRemediation;
    this._onCancelRemediationPreview = options.onCancelRemediationPreview;
    this._textScale = options.textScale ?? 1;
    this._highContrast = highContrast;
    const worldWidth = options.worldSize?.[0] ?? 0.72;
    this.scale.setScalar(worldWidth / PANEL_WIDTH);
    this.defaultPosition = new THREE.Vector3(...(options.position ?? [0.8, 1.55, -1.1]));
    this.position.copy(this.defaultPosition);

    this._summary = new Text({ text: '', fontSize: 15 * this._textScale, color: Number(theme.textPrimary) });
    this._tabs = new Container({ flexDirection: 'row', gap: SPACING_TOKENS.grid.x4 });
    this._actions = new Container({ flexDirection: 'column', gap: SPACING_TOKENS.grid.x4 });
    this.add(this._tabs, this._summary, this._actions);
    this._rebuildTabs();
    this.render();
  }

  update(delta = 0): void {
    super.update(delta);
    if (!this._dirty) return;
    this._dirty = false;
    this.render();
  }

  markDirty(): void { this._dirty = true; }

  setActiveTab(tab: RecommendationTab): void {
    if (this._activeTab === tab) return;
    this._activeTab = tab;
    this._dirty = true;
    this._rebuildTabs();
    this.render();
  }

  getRenderedSummary(): string { return this._formatSummary(); }

  dispatchAction(id: string): boolean {
    const tabs: Record<string, RecommendationTab> = {
      'guidance-tab': 'guidance', 'alternatives-tab': 'alternatives',
      'constraints-tab': 'constraints', 'remediation-tab': 'remediation',
    };
    if (tabs[id]) { this.setActiveTab(tabs[id]); return true; }

    const rec = this._getRecommendation();
    if (id === 'generate') { if (!rec) this._onGenerate?.(); this.markDirty(); return !rec; }
    if (id === 'accept' || id === 'reject' || id === 'override') {
      if (rec?.decision !== 'pending') return false;
      if (id === 'accept') this._onAccept?.();
      if (id === 'reject') this._onReject?.();
      if (id === 'override') this._onOverride?.();
      this.markDirty(); return true;
    }

    const outcome = this._getOutcome?.() ?? null;
    if (id.startsWith('remedi-preview-')) {
      const action = outcome?.availableRemediations.find((a) => a.id === id.slice(15));
      if (!action) return false;
      const accepted = this._onPreviewRemediation?.(action) ?? false;
      if (accepted) this._previewedRemediationId = action.id;
      this.markDirty(); this.render(); return accepted;
    }
    if (id.startsWith('remedi-commit-')) {
      const action = outcome?.availableRemediations.find((a) => a.id === id.slice(14));
      if (!action || this._previewedRemediationId !== action.id) return false;
      this._previewedRemediationId = null; this._onCommitRemediation?.(action);
      this.markDirty(); this.render(); return true;
    }
    if (id.startsWith('remedi-cancel-')) {
      this._previewedRemediationId = null; this._onCancelRemediationPreview?.();
      this.markDirty(); this.render(); return true;
    }
    if (id.startsWith('remedi-')) {
      const action = outcome?.availableRemediations.find((a) => a.id === id.slice(7));
      if (!action) return false;
      this._onApplyRemediation?.(action); this.markDirty(); return true;
    }
    return false;
  }

  applyAccessibility(options: AccessibilityOptions): void {
    this._textScale = options.textScale; this._highContrast = options.highContrast;
    const theme = getTheme(this._highContrast);
    this.setProperties({ backgroundColor: Number(theme.backgroundColor), borderColor: Number(theme.borderColor) });
    this._rebuildTabs(); this.render();
  }

  show(): void { this.visible = true; this.isMinimized = false; }
  hide(): void { const changed = this.visible; this.visible = false; if (changed) this.onHide?.(); }

  render(): void {
    const theme = getTheme(this._highContrast);
    this._summary.setProperties({
      text: this._formatSummary(), fontSize: 15 * this._textScale, color: Number(theme.textPrimary),
    });
    this._rebuildActions();
  }

  private _rebuildTabs(): void {
    for (const b of this._tabButtons) { this._tabs.remove(b); b.dispose(); }
    this._tabButtons = [];
    for (const [tab, label] of [['guidance','Guidance'],['alternatives','Alternatives'],['constraints','Constraints'],['remediation','Remediation']] as const) {
      const b = new Button({
        label, variant: this._activeTab === tab ? 'primary' : 'secondary',
        onClick: () => this.dispatchAction(tab + '-tab'),
      });
      this._tabButtons.push(b); this._tabs.add(b);
    }
  }

  private _rebuildActions(): void {
    for (const b of this._actionControls) { this._actions.remove(b); b.dispose(); }
    this._actionControls = [];
    if (this._activeTab === 'guidance') {
      const rec = this._getRecommendation();
      if (!rec) { if (this._onGenerate) this._addButton('Generate','primary',() => this.dispatchAction('generate')); return; }
      if (rec.decision === 'pending') {
        this._addButton('Accept','primary',() => this.dispatchAction('accept'));
        this._addButton('Reject','danger',() => this.dispatchAction('reject'));
        this._addButton('Override','secondary',() => this.dispatchAction('override'));
      }
      return;
    }
    if (this._activeTab !== 'remediation') return;
    for (const action of this._getOutcome?.()?.availableRemediations ?? []) {
      const previewed = this._previewedRemediationId === action.id;
      const decision = previewed ? this._getPreviewDecision?.() ?? null : null;
      if (!previewed) {
        this._addButton('Preview · ' + action.label,'secondary',() => this.dispatchAction('remedi-preview-' + action.id));
      } else if (decision) {
        this._addButton('Apply · ' + action.label,'primary',() => this.dispatchAction('remedi-commit-' + action.id));
        this._addButton('Revert preview','danger',() => this.dispatchAction('remedi-cancel-' + action.id));
      } else {
        this._addButton('Re-preview · ' + action.label,'secondary',() => this.dispatchAction('remedi-preview-' + action.id));
        this._addButton('Revert preview','danger',() => this.dispatchAction('remedi-cancel-' + action.id));
      }
    }
  }

  private _addButton(label: string, variant: 'primary'|'secondary'|'danger', onClick: () => void): void {
    const b = new Button({ label, variant, onClick }); this._actionControls.push(b); this._actions.add(b);
  }

  private _formatSummary(): string {
    if (this._activeTab === 'guidance') return this._formatGuidance();
    if (this._activeTab === 'alternatives') return this._formatAlternatives();
    if (this._activeTab === 'constraints') return this._formatConstraints();
    return this._formatRemediation();
  }

  private _formatGuidance(): string {
    const rec = this._getRecommendation();
    if (!rec) return 'RECOMMENDATION\nNo active recommendation.\nRun structure discovery to generate guidance.';
    const evidence = rec.evidenceItems?.map((item) => item.type + ': ' + item.value.toFixed(3) + ' (' + item.source.slice(-24) + ')')
      ?? [rec.evidence || 'No evidence provided'];
    const lines = [
      'RECOMMENDATION', 'Action: ' + (ACTION_LABELS[rec.action] ?? rec.action),
      'Decision: ' + rec.decision, '', 'RATIONALE', rec.rationale, '', 'EVIDENCE', ...evidence, '',
      'HEURISTIC RANK · ' + (rec.heuristicScore * 100).toFixed(0) + '%', HEURISTIC_RANK_DISCLAIMER,
    ];
    if (rec.limitations) lines.push('Limitations: ' + rec.limitations);
    if (rec.suggestedEmbodiment) lines.push('Embodiment: ' + rec.suggestedEmbodiment);
    if (rec.decision !== 'pending') lines.push('Decision recorded: ' + rec.decision);
    return lines.join('\n');
  }

  private _formatAlternatives(): string {
    const items = this._getOutcome?.()?.nearMisses ?? [];
    if (!items.length) return 'VIABLE ALTERNATIVES / NEAR MISSES\nNo alternatives found.';
    return ['VIABLE ALTERNATIVES / NEAR MISSES', ...items.map((m) =>
      (m.candidateId ?? m.family) + ' · ' + m.layout + ' · utility ' + (m.score ?? 0).toFixed(3) +
      '\n' + (m.disqualificationReason ?? 'Close runner up'))].join('\n\n');
  }

  private _formatConstraints(): string {
    const items = this._getOutcome?.()?.blockingConstraints ?? [];
    if (!items.length) return 'DISQUALIFIED / BLOCKING CONSTRAINTS\nNo active blocking constraints.';
    return ['DISQUALIFIED / BLOCKING CONSTRAINTS', ...items.map((c) =>
      c.rule + ' on ' + c.candidateName + '\n' + c.disqualificationReason)].join('\n\n');
  }

  private _formatRemediation(): string {
    const actions = this._getOutcome?.()?.availableRemediations ?? [];
    if (!actions.length) return 'AVAILABLE REMEDIATION ACTIONS\nNo remediations available.';
    const lines = ['AVAILABLE REMEDIATION ACTIONS'];
    for (const action of actions) {
      lines.push('', action.label, action.description,
        action.isSafeToRelax ? 'Scientifically Permissible' : 'Not Scientifically Safe',
        action.deviceFeasibility === 'unverified' ? 'UNVERIFIED DEVICE FEASIBILITY'
          : action.deviceFeasibility === 'feasible' ? 'Feasible' : 'Infeasible');
      if (this._previewedRemediationId === action.id) {
        const d = this._getPreviewDecision?.() ?? null;
        if (d) {
          const candidate = d.chosenCandidateId ?? d.representationFamily;
          const layout = d.chosenLayout ?? d.embodiment.primaryLayout;
          // Truthfulness contract: source remains explicit about PREVIEW: \${candidate} · \${layout}.
          lines.push('PREVIEW: ' + candidate + ' · ' + layout,
            'Utility ' + d.utilityScore.toFixed(3) + ' · ' + (d.decisionStatus ?? 'DECISIVE'));
        } else {
          lines.push('PREVIEW STALE — run preview again');
        }
      }
    }
    return lines.join('\n');
  }
}
