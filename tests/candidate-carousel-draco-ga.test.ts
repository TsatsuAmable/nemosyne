import { describe, it, expect, beforeEach } from 'vitest';
import { RepresentationCarousel } from '../src/vr/ui/RepresentationCarousel.ts';
import { DracoWorldModel } from '../src/ai/DracoWorldModel.ts';

describe('Sprint 12.1: Candidate Carousel Sliders & Evolutionary Draco GA Modulation', () => {
  describe('RepresentationCarousel', () => {
    let carousel: RepresentationCarousel;
    let tunedCandidateId: string | null = null;

    beforeEach(() => {
      carousel = new RepresentationCarousel({
        onWeightChange: (id) => {
          tunedCandidateId = id;
        },
      });
    });

    it('instantiates correctly with candidates', () => {
      expect(carousel).toBeDefined();
      expect(carousel.candidates.length).toBeGreaterThan(0);
    });

    it('tunes weights on selected candidate', () => {
      const selected = carousel.getSelectedCandidate();
      carousel.tuneWeight(selected.id, 'separability', 0.95);
      expect(selected.weights.separability).toBe(0.95);
      expect(tunedCandidateId).toBe(selected.id);
    });

    it('cycles candidate selection prev and next', () => {
      const first = carousel.getSelectedCandidate();
      const second = carousel.selectNext();
      expect(second.id).not.toBe(first.id);
      const prev = carousel.selectPrev();
      expect(prev.id).toBe(first.id);
    });
  });

  describe('DracoWorldModel', () => {
    let model: DracoWorldModel;

    beforeEach(() => {
      model = new DracoWorldModel();
    });

    it('ingests manual tuning feedback and modulates GA parameters', () => {
      const initial = model.currentGAParameters.fitnessWeights.separability;
      const updated = model.ingestManualTuning({ separability: 0.99 });
      expect(updated.fitnessWeights.separability).toBe(0.99);
      expect(updated.fitnessWeights.separability).not.toBe(initial);
    });

    it('modulates gene seed bias based on dataset topology', () => {
      const params = model.modulateGAForTopology('TdaMapper');
      expect(params.geneSeedBias).toBe('TdaMapper');
    });
  });
});
