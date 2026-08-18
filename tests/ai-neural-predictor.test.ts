// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { NeuralConstraintPredictor } from '../src/ai/NeuralConstraintPredictor.ts';
import { DracoWorldModel } from '../src/ai/DracoWorldModel.ts';

describe('Neural Soft-Constraint Predictive Layer & Auto-Tuner Subsystem', () => {
  let predictor: NeuralConstraintPredictor;
  let worldModel: DracoWorldModel;

  beforeEach(() => {
    predictor = new NeuralConstraintPredictor();
    worldModel = new DracoWorldModel();
  });

  it('extracts normalized feature vectors from raw dataset topology facts', () => {
    const features = predictor.extractFeatureVector({
      rowCount: 2500,
      numericCount: 10,
      categoricalCount: 5,
      maxCardinality: 50,
      hasTimeSeries: true,
      outlierRatio: 0.15,
      clusterCount: 4,
    });

    expect(features.length).toBe(7);
    expect(features[0]).toBeCloseTo(0.5); // 2500 / 5000
    expect(features[1]).toBeCloseTo(0.5); // 10 / 20
    expect(features[4]).toBe(1.0); // hasTimeSeries
  });

  it('predicts recommended soft constraint weights with confidence scores', () => {
    const rec = predictor.predict({
      rowCount: 1000,
      numericCount: 4,
      categoricalCount: 2,
      maxCardinality: 20,
    });

    expect(rec.separabilityWeight).toBeGreaterThanOrEqual(0);
    expect(rec.occlusionWeight).toBeGreaterThanOrEqual(0);
    expect(rec.audioProximityWeight).toBeGreaterThanOrEqual(0);
    expect(rec.instancedPointCloudWeight).toBeGreaterThanOrEqual(0);
    expect(rec.clusterVolumeWeight).toBeGreaterThanOrEqual(0);
    expect(rec.confidence).toBeGreaterThan(0.5);
  });

  it('executes online training steps when analyst tunes weights manually', () => {
    const features = { rowCount: 800, numericCount: 3 };
    const before = predictor.predict(features);

    predictor.trainStep(features, {
      separabilityWeight: 80,
      occlusionWeight: 40,
      audioProximityWeight: 50,
      instancedPointCloudWeight: 30,
      clusterVolumeWeight: 60,
    });

    expect(predictor.isTrained).toBe(true);
    const after = predictor.predict(features);
    expect(after.separabilityWeight).not.toBe(before.separabilityWeight);
  });

  it('integrates NeuralConstraintPredictor into DracoWorldModel pipeline', () => {
    const features = { rowCount: 1200, numericCount: 5, hasTimeSeries: true };
    const rec = worldModel.predictWeightsForDataset(features);

    expect(rec).toBeDefined();
    expect(worldModel.currentGAParameters.fitnessWeights.separability).toBe(rec.separabilityWeight / 100.0);

    // Ingest manual analyst tuning
    worldModel.ingestManualTuning({ separability: 0.9, occlusion: 0.3 }, features);
    expect(worldModel.currentGAParameters.fitnessWeights.separability).toBe(0.9);
  });
});
