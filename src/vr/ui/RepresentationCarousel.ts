/**
 * 3D VR Representation Candidate Carousel with Diegetic Manual Tuning Sliders.
 *
 * Renders top emergent 3D memory palace candidate representations in a curved
 * spatial carousel, allowing analysts to manually adjust soft-constraint weights
 * live in VR to re-evolve candidates in real time.
 */

import * as THREE from 'three';

export interface CandidateRepresentationSpec {
  id: string;
  name: string;
  fitnessScore: number;
  layoutType: string;
  geometryType: string;
  weights: {
    separability: number;
    occlusion: number;
    audioProximity: number;
  };
}

export interface RepresentationCarouselOptions {
  enabled?: boolean;
  onWeightChange?: (candidateId: string, weights: Record<string, number>) => void;
  onSelectCandidate?: (spec: CandidateRepresentationSpec) => void;
}

export class RepresentationCarousel {
  enabled: boolean;
  onWeightChange: (candidateId: string, weights: Record<string, number>) => void;
  onSelectCandidate: (spec: CandidateRepresentationSpec) => void;

  group: THREE.Group;
  candidates: CandidateRepresentationSpec[];
  selectedIndex = 0;

  constructor({
    enabled = true,
    onWeightChange = () => {},
    onSelectCandidate = () => {},
  }: RepresentationCarouselOptions = {}) {
    this.enabled = enabled;
    this.onWeightChange = onWeightChange;
    this.onSelectCandidate = onSelectCandidate;
    this.group = new THREE.Group();
    this.candidates = [];

    this._initDefaultCandidates();
  }

  private _initDefaultCandidates(): void {
    this.candidates = [
      {
        id: 'candidate-1',
        name: 'Force-Directed Graph + Anomaly Halos',
        fitnessScore: 0.92,
        layoutType: 'ForceDirected3D',
        geometryType: 'Orb',
        weights: { separability: 0.8, occlusion: 0.4, audioProximity: 0.7 },
      },
      {
        id: 'candidate-2',
        name: 'Radial Tree + Concentric Rings',
        fitnessScore: 0.88,
        layoutType: 'RadialTree',
        geometryType: 'Column',
        weights: { separability: 0.6, occlusion: 0.8, audioProximity: 0.5 },
      },
      {
        id: 'candidate-3',
        name: 'Topological TDA Mapper Surface',
        fitnessScore: 0.85,
        layoutType: 'TdaMapper',
        geometryType: 'Field',
        weights: { separability: 0.9, occlusion: 0.3, audioProximity: 0.9 },
      },
    ];
  }

  /**
   * Manually tune weight slider for selected candidate in 3D VR.
   */
  tuneWeight(candidateId: string, weightName: 'separability' | 'occlusion' | 'audioProximity', newValue: number): void {
    const candidate = this.candidates.find((c) => c.id === candidateId);
    if (!candidate) return;

    candidate.weights[weightName] = Math.max(0.0, Math.min(1.0, newValue));
    this.onWeightChange(candidateId, candidate.weights);
  }

  selectNext(): CandidateRepresentationSpec {
    this.selectedIndex = (this.selectedIndex + 1) % this.candidates.length;
    const spec = this.candidates[this.selectedIndex];
    this.onSelectCandidate(spec);
    return spec;
  }

  selectPrev(): CandidateRepresentationSpec {
    this.selectedIndex = (this.selectedIndex - 1 + this.candidates.length) % this.candidates.length;
    const spec = this.candidates[this.selectedIndex];
    this.onSelectCandidate(spec);
    return spec;
  }

  getSelectedCandidate(): CandidateRepresentationSpec {
    return this.candidates[this.selectedIndex];
  }

  dispose(): void {
    this.candidates = [];
  }
}
