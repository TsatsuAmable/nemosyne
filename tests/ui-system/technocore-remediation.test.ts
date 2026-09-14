/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { RecommendationPanel } from '../../src/vr/ui/RecommendationPanel.ts';
import type { AtlasRecommendation } from '../../src/atlas/types.ts';
import type { InvestigatorActionableOutcome, RemedialAction } from '../../src/moneta/representation/ActionableNil.ts';
import type { SemanticRepresentationId } from '../../src/moneta/representation/RepresentationCandidate.ts';

describe('P1-U5 RecommendationPanel Diagnostic Views', () => {
  const cameraGroup = new THREE.Group();

  const mockRecommendation: AtlasRecommendation = {
    targetIds: ['node_1'],
    action: 'inspect-cluster',
    rationale: 'High density clustering found in the central partition.',
    evidence: 'Density score: 0.85',
    heuristicScore: 0.9,
    limitations: 'Limited by boundary constraints.',
    suggestedEmbodiment: '3D Scatterplot',
    decision: 'pending',
  };

  const mockRemediation: RemedialAction = {
    id: 'remedi-adjust-hardware-limit',
    label: 'Increase hardware element budget',
    kind: 'adjust-hardware-limit',
    description: 'Double the max elements threshold to allow rendering.',
    isSafeToRelax: true,
    deviceFeasibility: 'unverified',
    suggestedRequirementPatch: {
      hardwareConstraints: { maxElements: 4000 } as any,
    },
    unblocksCandidates: ['CLUSTER_REGIONS'] as SemanticRepresentationId[],
  };

  const mockOutcome: InvestigatorActionableOutcome = {
    state: 'AMBIGUOUS',
    readableExplanation: 'Ambiguous results between Scatterplot and Force Directed.',
    decision: null,
    nearMisses: [
      {
        candidateId: 'RELATIONSHIP_GRAPH' as SemanticRepresentationId,
        family: 'RELATIONSHIP_GRAPH' as any,
        layout: 'FORCE_3D',
        score: 0.72,
        components: [],
        disqualified: false,
        preserves: [],
        loses: [],
        disqualificationReason: 'Close runner up.',
      } as any
    ],
    blockingConstraints: [
      {
        rule: 'HARD_LIMIT',
        candidateId: 'RELATIONSHIP_GRAPH' as SemanticRepresentationId,
        candidateName: 'Force Directed Graph',
        disqualificationReason: 'Lacks sufficient memory bounds.',
        isInformationLossConstraint: false,
        isHardwareConstraint: true,
        isPerceptualConstraint: false,
        remediationAction: mockRemediation,
      }
    ],
    availableRemediations: [mockRemediation],
    provenance: {} as any,
  };

  it('initializes and switches tabs correctly', () => {
    const getRec = () => mockRecommendation;
    const getOutcome = () => mockOutcome;

    const panel = new RecommendationPanel(cameraGroup, {
      getRecommendation: getRec,
      getOutcome,
    });

    expect((panel as any)._activeTab).toBe('guidance');

    // Simulate clicking Alternatives tab
    panel.dispatchAction('alternatives-tab');
    expect((panel as any)._activeTab).toBe('alternatives');

    // Simulate clicking Constraints tab
    panel.dispatchAction('constraints-tab');
    expect((panel as any)._activeTab).toBe('constraints');

    // Simulate clicking Remediation tab
    panel.dispatchAction('remediation-tab');
    expect((panel as any)._activeTab).toBe('remediation');
  });

  it('triggers onApplyRemediation callback when Apply is clicked', () => {
    const getRec = () => mockRecommendation;
    const getOutcome = () => mockOutcome;
    const onApplyRemediation = vi.fn();

    const panel = new RecommendationPanel(cameraGroup, {
      getRecommendation: getRec,
      getOutcome,
      onApplyRemediation,
    });

    // Dispatch a click on the remediation button
    panel.dispatchAction('remedi-remedi-adjust-hardware-limit');
    expect(onApplyRemediation).toHaveBeenCalledWith(mockRemediation);
  });
  it('requires an accepted preview of the same remediation before commit', () => {
    const onPreviewRemediation = vi.fn(() => true);
    const onCommitRemediation = vi.fn();
    const panel = new RecommendationPanel(cameraGroup, {
      getRecommendation: () => mockRecommendation,
      getOutcome: () => mockOutcome,
      onPreviewRemediation,
      onCommitRemediation,
      getPreviewDecision: () => ({
        chosenCandidateId: 'RELATIONSHIP_GRAPH',
        representationFamily: 'RELATIONSHIP_GRAPH',
        chosenLayout: 'FORCE_3D',
        embodiment: { primaryLayout: 'FORCE_3D' },
        utilityScore: 0.71,
        decisionStatus: 'DECISIVE',
      } as any),
    });

    expect(panel.dispatchAction('remedi-commit-remedi-adjust-hardware-limit')).toBe(false);
    expect(onCommitRemediation).not.toHaveBeenCalled();

    expect(panel.dispatchAction('remedi-preview-remedi-adjust-hardware-limit')).toBe(true);
    expect(onPreviewRemediation).toHaveBeenCalledWith(mockRemediation);
    expect(panel.getRenderedSummary()).not.toContain('PREVIEW:');

    panel.setActiveTab('remediation');
    expect(panel.getRenderedSummary()).toContain('PREVIEW: RELATIONSHIP_GRAPH · FORCE_3D');

    expect(panel.dispatchAction('remedi-commit-remedi-adjust-hardware-limit')).toBe(true);
    expect(onCommitRemediation).toHaveBeenCalledWith(mockRemediation);
    panel.dispose();
  });

  it('does not record a preview when preview authority refuses it', () => {
    const panel = new RecommendationPanel(cameraGroup, {
      getRecommendation: () => mockRecommendation,
      getOutcome: () => mockOutcome,
      onPreviewRemediation: () => false,
    });
    panel.setActiveTab('remediation');

    expect(panel.dispatchAction('remedi-preview-remedi-adjust-hardware-limit')).toBe(false);
    expect(panel.getRenderedSummary()).not.toContain('PREVIEW:');
    panel.dispose();
  });

  it('dispatches recommendation decisions only while recommendation is pending', () => {
    const onAccept = vi.fn();
    const accepted = { ...mockRecommendation, decision: 'accepted' as const };
    const panel = new RecommendationPanel(cameraGroup, {
      getRecommendation: () => accepted,
      onAccept,
    });

    expect(panel.dispatchAction('accept')).toBe(false);
    expect(onAccept).not.toHaveBeenCalled();
    panel.dispose();
  });

});
