import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import { COLOR_TOKENS, cssHex } from '../ui-system/tokens.ts';
import type { MovablePanelOptions } from '../coordinators/types.ts';
import type { AtlasRecommendation } from '../../atlas/types.ts';
import type {
  InvestigatorActionableOutcome,
  RemedialAction,
} from '../../moneta/representation/ActionableNil.ts';
import type { RepresentationDecision } from '../../moneta/representation/RepresentationDecision.ts';

export interface RecommendationPanelOptions extends MovablePanelOptions {
  getRecommendation: () => AtlasRecommendation | null;
  getOutcome?: () => InvestigatorActionableOutcome | null;
  onAccept?: () => void;
  onReject?: () => void;
  onOverride?: () => void;
  onGenerate?: () => void;
  onApplyRemediation?: (action: RemedialAction) => void;
  onPreviewRemediation?: (action: RemedialAction) => boolean;
  getPreviewDecision?: () => RepresentationDecision | null;
  onCommitRemediation?: (action: RemedialAction) => void;
  onCancelRemediationPreview?: () => void;
}

interface BtnRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const ACTION_LABELS: Record<string, string> = {
  'inspect-cluster': 'Inspect Cluster',
  'inspect-boundary': 'Inspect Boundary',
  'explore-region': 'Explore Region',
  'compare-regions': 'Compare Regions',
  'investigate-anomaly': 'Investigate Anomaly',
};

const UI = {
  focus: cssHex(COLOR_TOKENS.interaction.focus),
  commit: cssHex(COLOR_TOKENS.interaction.commit),
  uncertain: cssHex(COLOR_TOKENS.epistemic.uncertain),
  contradiction: cssHex(COLOR_TOKENS.epistemic.contradiction),
  danger: cssHex(COLOR_TOKENS.danger.destructive),
  verified: cssHex(COLOR_TOKENS.status.verified),
  primary: cssHex(COLOR_TOKENS.text.primary),
  secondary: cssHex(COLOR_TOKENS.text.secondary),
  muted: cssHex(COLOR_TOKENS.text.muted),
  surface: cssHex(COLOR_TOKENS.surface.base),
  raised: cssHex(COLOR_TOKENS.surface.raised),
  border: cssHex(COLOR_TOKENS.surface.border),
} as const;

const DECISION_COLOR: Record<string, string> = {
  pending: UI.uncertain,
  accepted: UI.commit,
  rejected: UI.danger,
  overridden: UI.contradiction,
};

const HEURISTIC_RANK_DISCLAIMER =
  'HEURISTIC RANK is a rank-dominance heuristic, not statistical confidence or significance.';

function rgba(token: number, alpha: number): string {
  const r = (token >> 16) & 0xff;
  const g = (token >> 8) & 0xff;
  const b = token & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export class RecommendationPanel extends MovablePanel {
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
  private _buttons: BtnRect[] = [];
  private _activeTab: 'guidance' | 'alternatives' | 'constraints' | 'remediation' = 'guidance';
  private _previewedRemediationId: string | null = null;

  constructor(cameraGroup: THREE.Group, options: RecommendationPanelOptions) {
    super(cameraGroup, {
      title: 'GUIDANCE',
      width: 720,
      height: 620,
      position: options.position ?? [0.8, 1.55, -1.1],
      worldSize: options.worldSize ?? [0.72, 0.62],
      titleBarHeight: 44,
      tilt: 0.22,
      textScale: options.textScale ?? 1,
      highContrast: options.highContrast ?? false,
      colorblindMode: options.colorblindMode ?? 'none',
    });
    this._getRecommendation = options.getRecommendation;
    this._getOutcome = options.getOutcome;
    this._onAccept = options.onAccept;
    this._onReject = options.onReject;
    this._onOverride = options.onOverride;
    this._onGenerate = options.onGenerate;
    this._onApplyRemediation = options.onApplyRemediation;
    this._onPreviewRemediation = options.onPreviewRemediation;
    this._getPreviewDecision = options.getPreviewDecision;
    this._onCommitRemediation = options.onCommitRemediation;
    this._onCancelRemediationPreview = options.onCancelRemediationPreview;
    this.render();
  }

  update(): void {
    if (this._dirty) {
      this._dirty = false;
      this.render();
    }
  }

  markDirty(): void {
    this._dirty = true;
  }

  setActiveTab(tab: 'guidance' | 'alternatives' | 'constraints' | 'remediation'): void {
    if (this._activeTab !== tab) {
      this._activeTab = tab;
      this._dirty = true;
      this.render();
    }
  }

  renderContent(ctx: CanvasRenderingContext2D, w: number, contentH: number): void {
    const pad = 20;
    const lineH = 24;
    this._buttons = [];

    const tabY = 10;
    const tabH = 36;
    const tabW = (w - pad * 2) / 4;
    this._drawTabButton(
      ctx,
      'guidance-tab',
      'Guidance',
      pad + tabW * 0,
      tabY,
      tabW - 4,
      tabH,
      this._activeTab === 'guidance'
    );
    this._drawTabButton(
      ctx,
      'alternatives-tab',
      'Alternatives',
      pad + tabW * 1,
      tabY,
      tabW - 4,
      tabH,
      this._activeTab === 'alternatives'
    );
    this._drawTabButton(
      ctx,
      'constraints-tab',
      'Constraints',
      pad + tabW * 2,
      tabY,
      tabW - 4,
      tabH,
      this._activeTab === 'constraints'
    );
    this._drawTabButton(
      ctx,
      'remediation-tab',
      'Remediation',
      pad + tabW * 3,
      tabY,
      tabW - 4,
      tabH,
      this._activeTab === 'remediation'
    );

    const y = tabY + tabH + 20;
    if (this._activeTab === 'guidance') {
      this._renderGuidanceTab(ctx, w, contentH, pad, lineH, y);
    } else if (this._activeTab === 'alternatives') {
      this._renderAlternativesTab(ctx, w, contentH, pad, lineH, y);
    } else if (this._activeTab === 'constraints') {
      this._renderConstraintsTab(ctx, w, contentH, pad, lineH, y);
    } else {
      this._renderRemediationTab(ctx, w, contentH, pad, lineH, y);
    }
  }

  private _drawTabButton(
    ctx: CanvasRenderingContext2D,
    id: string,
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    active: boolean
  ): void {
    ctx.fillStyle = active
      ? rgba(COLOR_TOKENS.interaction.focus, 0.16)
      : UI.raised;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = active ? UI.focus : UI.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.font = this._scaleFont('bold 14px monospace');
    ctx.fillStyle = active ? UI.primary : UI.secondary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    this._buttons.push({ id, x, y, w, h });
  }

  private _renderGuidanceTab(
    ctx: CanvasRenderingContext2D,
    w: number,
    contentH: number,
    pad: number,
    lineH: number,
    y: number
  ): void {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const rec = this._getRecommendation();

    if (!rec) {
      ctx.font = this._scaleFont('bold 18px monospace');
      ctx.fillStyle = UI.muted;
      ctx.fillText('No active recommendation', pad, y + lineH);
      y += lineH + 8;
      ctx.font = this._scaleFont('14px monospace');
      ctx.fillStyle = UI.secondary;
      ctx.fillText('Run structure discovery (cluster/TDA)', pad, y + lineH);
      ctx.fillText('to generate guidance.', pad, y + lineH * 2);
      y += lineH * 2 + 16;
      if (this._onGenerate) {
        this._drawButton(ctx, 'generate', 'Generate', pad, y, 200, 40, UI.focus);
        y += 56;
      }
      this.totalContentHeight = y;
      return;
    }

    ctx.font = this._scaleFont('bold 18px monospace');
    ctx.fillStyle = UI.focus;
    ctx.fillText('// RECOMMENDATION', pad, y + lineH);
    y += lineH + 4;

    ctx.font = this._scaleFont('15px monospace');
    ctx.fillStyle = UI.primary;
    const actionLabel = ACTION_LABELS[rec.action] ?? rec.action;
    ctx.fillText(`Action: ${actionLabel}`, pad + 8, y + lineH);
    y += lineH + 2;

    ctx.fillStyle = DECISION_COLOR[rec.decision] ?? UI.uncertain;
    ctx.fillText(`Decision: ${rec.decision}`, pad + 8, y + lineH);
    y += lineH + 8;

    ctx.font = this._scaleFont('bold 15px monospace');
    ctx.fillStyle = UI.focus;
    ctx.fillText('// RATIONALE', pad, y + lineH);
    y += lineH + 2;
    ctx.font = this._scaleFont('14px monospace');
    ctx.fillStyle = UI.secondary;
    y = this._wrapText(ctx, rec.rationale, pad + 8, y, w - pad * 2 - 8, lineH, contentH) + 8;

    ctx.font = this._scaleFont('bold 15px monospace');
    ctx.fillStyle = UI.focus;
    ctx.fillText('// EVIDENCE', pad, y + lineH);
    y += lineH + 2;
    ctx.font = this._scaleFont('13px monospace');
    ctx.fillStyle = UI.secondary;
    if (rec.evidenceItems && rec.evidenceItems.length > 0) {
      for (const item of rec.evidenceItems) {
        const text = `${item.type}: ${item.value.toFixed(3)} (${item.source.slice(-24)})`;
        y = this._wrapText(ctx, text, pad + 8, y, w - pad * 2 - 8, lineH, contentH) + 2;
      }
    } else {
      ctx.fillText(rec.evidence || 'No evidence provided', pad + 8, y + lineH);
      y += lineH;
    }
    y += 8;

    ctx.font = this._scaleFont('bold 15px monospace');
    ctx.fillStyle = UI.focus;
    ctx.fillText('// HEURISTIC RANK', pad, y + lineH);
    y += lineH + 4;
    const barW = w - pad * 2 - 8;
    const barH = 18;
    ctx.fillStyle = UI.raised;
    ctx.fillRect(pad + 8, y, barW, barH);
    const scoreW = Math.max(0, Math.min(1, rec.heuristicScore)) * barW;
    ctx.fillStyle =
      rec.heuristicScore > 0.6
        ? UI.commit
        : rec.heuristicScore > 0.3
          ? UI.uncertain
          : UI.danger;
    ctx.fillRect(pad + 8, y, scoreW, barH);
    ctx.font = this._scaleFont('12px monospace');
    ctx.fillStyle = UI.primary;
    ctx.fillText(`${(rec.heuristicScore * 100).toFixed(0)}%`, pad + 12, y + 14);
    y += barH + 12;
    ctx.fillStyle = UI.uncertain;
    y =
      this._wrapText(
        ctx,
        `// ${HEURISTIC_RANK_DISCLAIMER}`,
        pad + 8,
        y,
        w - pad * 2 - 8,
        lineH,
        contentH
      ) + 8;

    if (rec.limitations) {
      ctx.font = this._scaleFont('13px monospace');
      ctx.fillStyle = UI.uncertain;
      y =
        this._wrapText(
          ctx,
          `Limitations: ${rec.limitations}`,
          pad + 8,
          y,
          w - pad * 2 - 8,
          lineH,
          contentH
        ) + 8;
    }

    if (rec.suggestedEmbodiment) {
      ctx.font = this._scaleFont('13px monospace');
      ctx.fillStyle = UI.contradiction;
      ctx.fillText(`Embodiment: ${rec.suggestedEmbodiment}`, pad + 8, y + lineH);
      y += lineH + 8;
    }

    if (rec.decision === 'pending') {
      const btnW = 180;
      const btnH = 42;
      const gap = 12;
      const totalW = btnW * 3 + gap * 2;
      const startX = (w - totalW) / 2;
      this._drawButton(ctx, 'accept', '✓ Accept', startX, y, btnW, btnH, UI.commit);
      this._drawButton(
        ctx,
        'reject',
        '✗ Reject',
        startX + btnW + gap,
        y,
        btnW,
        btnH,
        UI.danger
      );
      this._drawButton(
        ctx,
        'override',
        '↻ Override',
        startX + (btnW + gap) * 2,
        y,
        btnW,
        btnH,
        UI.contradiction
      );
      y += btnH + 16;
    } else {
      ctx.font = this._scaleFont('14px monospace');
      ctx.fillStyle = DECISION_COLOR[rec.decision] ?? UI.uncertain;
      ctx.fillText(`Decision recorded: ${rec.decision}`, pad + 8, y + lineH);
      y += lineH + 16;
    }

    this.totalContentHeight = y;
  }

  private _renderAlternativesTab(
    ctx: CanvasRenderingContext2D,
    w: number,
    contentH: number,
    pad: number,
    lineH: number,
    y: number
  ): void {
    ctx.font = this._scaleFont('bold 15px monospace');
    ctx.fillStyle = UI.focus;
    ctx.fillText('// VIABLE ALTERNATIVES / NEAR MISSES', pad, y + lineH);
    y += lineH + 12;

    const outcome = this._getOutcome ? this._getOutcome() : null;
    if (outcome?.nearMisses?.length) {
      for (const miss of outcome.nearMisses) {
        ctx.font = this._scaleFont('bold 14px monospace');
        ctx.fillStyle = UI.primary;
        const candidateName = miss.candidateId ?? miss.family;
        const utility = miss.score ?? 0;
        ctx.fillText(`${candidateName} (Utility: ${utility.toFixed(3)})`, pad + 8, y + lineH);
        y += lineH + 4;
        ctx.font = this._scaleFont('12px monospace');
        ctx.fillStyle = UI.secondary;
        const rationale = miss.disqualificationReason ?? 'Close runner up';
        y =
          this._wrapText(
            ctx,
            `Layout: ${miss.layout}. Rationale: ${rationale}`,
            pad + 16,
            y,
            w - pad * 2 - 16,
            16,
            contentH
          ) + 12;
      }
    } else {
      ctx.font = this._scaleFont('13px monospace');
      ctx.fillStyle = UI.muted;
      ctx.fillText(
        'No alternative representations or near-miss candidates found.',
        pad + 8,
        y + lineH
      );
      y += lineH + 8;
    }
    this.totalContentHeight = y;
  }

  private _renderConstraintsTab(
    ctx: CanvasRenderingContext2D,
    w: number,
    contentH: number,
    pad: number,
    lineH: number,
    y: number
  ): void {
    ctx.font = this._scaleFont('bold 15px monospace');
    ctx.fillStyle = UI.focus;
    ctx.fillText('// DISQUALIFIED / BLOCKING CONSTRAINTS', pad, y + lineH);
    y += lineH + 12;

    const outcome = this._getOutcome ? this._getOutcome() : null;
    if (outcome?.blockingConstraints?.length) {
      for (const bc of outcome.blockingConstraints) {
        ctx.font = this._scaleFont('bold 13px monospace');
        ctx.fillStyle = UI.danger;
        ctx.fillText(`Rule: ${bc.rule} on ${bc.candidateName}`, pad + 8, y + lineH);
        y += lineH + 4;
        ctx.font = this._scaleFont('12px monospace');
        ctx.fillStyle = UI.secondary;
        y =
          this._wrapText(
            ctx,
            bc.disqualificationReason,
            pad + 16,
            y,
            w - pad * 2 - 16,
            16,
            contentH
          ) + 12;
      }
    } else {
      ctx.font = this._scaleFont('13px monospace');
      ctx.fillStyle = UI.muted;
      ctx.fillText(
        'No active blocking constraints. Representation requirements satisfied.',
        pad + 8,
        y + lineH
      );
      y += lineH + 8;
    }
    this.totalContentHeight = y;
  }

  private _renderRemediationTab(
    ctx: CanvasRenderingContext2D,
    w: number,
    contentH: number,
    pad: number,
    lineH: number,
    y: number
  ): void {
    ctx.font = this._scaleFont('bold 15px monospace');
    ctx.fillStyle = UI.focus;
    ctx.fillText('// AVAILABLE REMEDIATION ACTIONS', pad, y + lineH);
    y += lineH + 12;

    const outcome = this._getOutcome ? this._getOutcome() : null;
    if (outcome?.availableRemediations?.length) {
      for (const action of outcome.availableRemediations) {
        const isPreviewed = this._previewedRemediationId === action.id;

        ctx.font = this._scaleFont('bold 14px monospace');
        ctx.fillStyle = UI.primary;
        ctx.fillText(action.label, pad + 8, y + lineH);
        y += lineH + 4;
        ctx.font = this._scaleFont('12px monospace');
        ctx.fillStyle = UI.secondary;
        y =
          this._wrapText(
            ctx,
            action.description,
            pad + 16,
            y,
            w - pad * 2 - 16,
            16,
            contentH
          ) + 6;

        ctx.font = this._scaleFont('bold 11px monospace');
        const safetyText = action.isSafeToRelax
          ? 'Scientifically Permissible'
          : 'Not Scientifically Safe';
        ctx.fillStyle = action.isSafeToRelax ? UI.commit : UI.danger;
        ctx.fillText(safetyText, pad + 16, y + 12);

        let feasibilityText = '';
        let feasibilityColor = UI.primary;
        if (action.deviceFeasibility === 'unverified') {
          feasibilityText = '⚠ UNVERIFIED DEVICE FEASIBILITY';
          feasibilityColor = UI.uncertain;
        } else if (action.deviceFeasibility === 'feasible') {
          feasibilityText = '✓ Feasible';
          feasibilityColor = UI.commit;
        } else {
          feasibilityText = '✗ Infeasible';
          feasibilityColor = UI.danger;
        }
        ctx.fillStyle = feasibilityColor;
        ctx.fillText(feasibilityText, pad + 190, y + 12);
        y += 24;

        const btnW = 120;
        const btnH = 30;
        const gap = 12;
        if (isPreviewed) {
          const previewDecision = this._getPreviewDecision?.() ?? null;
          if (previewDecision) {
            const candidate =
              previewDecision.chosenCandidateId ?? previewDecision.representationFamily;
            const layout =
              previewDecision.chosenLayout ?? previewDecision.embodiment.primaryLayout;
            const status = previewDecision.decisionStatus ?? 'DECISIVE';
            ctx.fillStyle = UI.uncertain;
            ctx.font = this._scaleFont('bold 12px monospace');
            ctx.fillText(`PREVIEW: ${candidate} · ${layout}`, pad + 16, y + 12);
            ctx.font = this._scaleFont('11px monospace');
            ctx.fillStyle = UI.secondary;
            ctx.fillText(
              `Utility ${previewDecision.utilityScore.toFixed(3)} · ${status}`,
              pad + 16,
              y + 30
            );
            y += 40;
            this._drawButton(
              ctx,
              `remedi-commit-${action.id}`,
              'Apply',
              pad + 16,
              y,
              btnW,
              btnH,
              UI.commit
            );
            this._drawButton(
              ctx,
              `remedi-cancel-${action.id}`,
              'Revert',
              pad + 16 + btnW + gap,
              y,
              btnW,
              btnH,
              UI.danger
            );
          } else {
            ctx.fillStyle = UI.uncertain;
            ctx.font = this._scaleFont('bold 12px monospace');
            ctx.fillText('PREVIEW STALE — run preview again', pad + 16, y + 12);
            y += 20;
            this._drawButton(
              ctx,
              `remedi-preview-${action.id}`,
              'Re-preview',
              pad + 16,
              y,
              btnW,
              btnH,
              UI.focus
            );
            this._drawButton(
              ctx,
              `remedi-cancel-${action.id}`,
              'Revert',
              pad + 16 + btnW + gap,
              y,
              btnW,
              btnH,
              UI.danger
            );
          }
        } else {
          this._drawButton(
            ctx,
            `remedi-preview-${action.id}`,
            'Preview',
            pad + 16,
            y,
            btnW,
            btnH,
            UI.focus
          );
        }
        y += btnH + 20;
      }
    } else {
      ctx.font = this._scaleFont('13px monospace');
      ctx.fillStyle = UI.muted;
      ctx.fillText(
        'No remediations available for the current representation state.',
        pad + 8,
        y + lineH
      );
      y += lineH + 8;
    }
    this.totalContentHeight = y;
  }

  private _drawButton(
    ctx: CanvasRenderingContext2D,
    id: string,
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string
  ): void {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI.primary;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.font = this._scaleFont('bold 15px monospace');
    ctx.fillStyle = UI.primary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    this._buttons.push({ id, x, y, w, h });
  }

  handleContentClick(raycaster: THREE.Raycaster): boolean {
    const hits = raycaster.intersectObject(this.mesh, false);
    if (hits.length === 0) return false;
    const uv = hits[0].uv;
    if (!uv) return false;
    const cx = uv.x * this.width;
    const cy = (1 - uv.y) * this.height;

    for (const b of this._buttons) {
      if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
        this._dispatchButton(b.id);
        return true;
      }
    }
    return false;
  }

  private _dispatchButton(id: string): void {
    if (id === 'guidance-tab') {
      this._activeTab = 'guidance';
    } else if (id === 'alternatives-tab') {
      this._activeTab = 'alternatives';
    } else if (id === 'constraints-tab') {
      this._activeTab = 'constraints';
    } else if (id === 'remediation-tab') {
      this._activeTab = 'remediation';
    } else if (id.startsWith('remedi-preview-')) {
      const actionId = id.slice(15);
      const outcome = this._getOutcome ? this._getOutcome() : null;
      const action = outcome?.availableRemediations.find((a) => a.id === actionId);
      if (action) {
        const accepted = this._onPreviewRemediation?.(action) ?? false;
        if (accepted) this._previewedRemediationId = actionId;
      }
    } else if (id.startsWith('remedi-commit-')) {
      const actionId = id.slice(14);
      const outcome = this._getOutcome ? this._getOutcome() : null;
      const action = outcome?.availableRemediations.find((a) => a.id === actionId);
      if (action) {
        this._previewedRemediationId = null;
        this._onCommitRemediation?.(action);
      }
    } else if (id.startsWith('remedi-cancel-')) {
      this._previewedRemediationId = null;
      this._onCancelRemediationPreview?.();
    } else if (id.startsWith('remedi-')) {
      const actionId = id.slice(7);
      const outcome = this._getOutcome ? this._getOutcome() : null;
      const action = outcome?.availableRemediations.find((a) => a.id === actionId);
      if (action) this._onApplyRemediation?.(action);
    } else {
      switch (id) {
        case 'accept':
          this._onAccept?.();
          break;
        case 'reject':
          this._onReject?.();
          break;
        case 'override':
          this._onOverride?.();
          break;
        case 'generate':
          this._onGenerate?.();
          break;
        default:
          break;
      }
    }
    this._dirty = true;
    this.render();
  }

  private _wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineH: number,
    maxY: number
  ): number {
    const words = text.split(/\s+/);
    let line = '';
    let cy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, cy + lineH);
        cy += lineH;
        line = word;
        if (cy > maxY) return cy;
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, x, cy + lineH);
      cy += lineH;
    }
    return cy;
  }
}
