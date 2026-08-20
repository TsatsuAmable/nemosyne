/**
 * RepresentationDecision — The formal, explainable decision produced by
 * the RepresentationHypothesisEngine.
 *
 * Wraps the underlying SpatialStrategy produced by ConstraintArbiter and
 * provides higher-level representation reasoning, structured evidence,
 * rejected alternatives, and scale/progressive disclosure policies.
 */

import type { RepresentationFamily } from './RepresentationFamily.ts';
import type { DatasetSignature } from './DatasetSignature.ts';
import type { SpatialStrategy } from '../SpatialStrategy.ts';
import type { VRLayout, VRGeometry, VRBehavior, VRInteraction } from '../types.ts';

export interface RepresentationEvidence {
  fact: string;
  weight: number;
  supports: boolean;
  source: 'kernel' | 'heuristic' | 'user-requirement';
  explanation?: string;
}

export interface RejectedAlternative {
  family: RepresentationFamily;
  score: number;
  reason: string;
  hardPassed: boolean;
}

export interface ScalePolicy {
  maxRenderNodes: number;
  lodStrategy: 'INSTANCED_LOD' | 'BILLBOARD' | 'OCCLUSION_CULL' | 'DIRECT';
  budgetTargetMs: number;
}

export interface ProgressiveDisclosurePolicy {
  primaryFamily: RepresentationFamily;
  secondaryFamilies: RepresentationFamily[];
  detailFamily?: RepresentationFamily;
  defaultViewLevel: 'OVERVIEW' | 'DISTRIBUTION' | 'DETAIL';
}

export interface RepresentationEmbodiment {
  spatialStrategy: SpatialStrategy;
  primaryLayout: VRLayout;
  primaryGeometry: VRGeometry;
  primaryBehavior: VRBehavior;
  primaryInteraction: VRInteraction;
}

export interface RepresentationDecisionProvenance {
  generatedAt: number;
  engine: string;
  version: string;
  datasetFingerprint: string;
  requirementsHash: string;
}

export interface RepresentationDecision {
  id: string;
  representationFamily: RepresentationFamily;
  confidence: number;
  utilityScore: number;
  evidence: RepresentationEvidence[];
  rejectedAlternatives: RejectedAlternative[];
  embodiment: RepresentationEmbodiment;
  scalePolicy: ScalePolicy;
  progressiveDisclosurePolicy: ProgressiveDisclosurePolicy;
  datasetSignature: DatasetSignature;
  provenance: RepresentationDecisionProvenance;
}
