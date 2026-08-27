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
    confidence: 0.9,
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
    (panel as any)._dispatchButton('alternatives-tab');
    expect((panel as any)._activeTab).toBe('alternatives');

    // Simulate clicking Constraints tab
    (panel as any)._dispatchButton('constraints-tab');
    expect((panel as any)._activeTab).toBe('constraints');

    // Simulate clicking Remediation tab
    (panel as any)._dispatchButton('remediation-tab');
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
    (panel as any)._dispatchButton('remedi-remedi-adjust-hardware-limit');
    expect(onApplyRemediation).toHaveBeenCalledWith(mockRemediation);
  });
});
