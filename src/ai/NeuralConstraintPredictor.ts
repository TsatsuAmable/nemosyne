/**
 * Neural Soft-Constraint Predictive Layer & Auto-Tuner.
 *
 * Evaluates dataset topology facts (rows, cardinality, density, stats) using an
 * on-device neural weight predictor to recommend optimal soft-constraint weights
 * for the Draco Evolutionary GA Solver.
 *
 * Implements online gradient descent learning from analyst VR candidate selections.
 */

export interface DatasetFeatureVector {
  rowCount: number;
  numericCount: number;
  categoricalCount: number;
  maxCardinality: number;
  hasTimeSeries: boolean;
  outlierRatio: number;
  clusterCount: number;
}

export interface RecommendedConstraintWeights {
  separabilityWeight: number;
  occlusionWeight: number;
  audioProximityWeight: number;
  instancedPointCloudWeight: number;
  clusterVolumeWeight: number;
  confidence: number;
}

export class NeuralConstraintPredictor {
  // Model weights matrix: (7 inputs -> 5 constraint outputs)
  weights: number[][];
  bias: number[];
  learningRate = 0.02;
  isTrained = false;

  constructor() {
    // Initialize feature weights
    this.weights = [
      [0.2, 0.4, 0.1, 0.8, 0.3], // rowCount
      [0.3, 0.2, 0.2, 0.4, 0.5], // numericCount
      [0.4, 0.5, 0.1, 0.2, 0.6], // categoricalCount
      [0.1, 0.6, 0.3, 0.3, 0.7], // maxCardinality
      [0.5, 0.1, 0.6, 0.2, 0.1], // hasTimeSeries
      [0.6, 0.3, 0.5, 0.7, 0.4], // outlierRatio
      [0.3, 0.4, 0.4, 0.5, 0.8], // clusterCount
    ];
    this.bias = [10.0, 15.0, 10.0, 5.0, 5.0];
  }

  /**
   * Normalizes dataset topology facts into a [0, 1] feature vector.
   */
  extractFeatureVector(facts: Partial<DatasetFeatureVector>): number[] {
    const rows = Math.min((facts.rowCount ?? 0) / 5000.0, 1.0);
    const numCols = Math.min((facts.numericCount ?? 0) / 20.0, 1.0);
    const catCols = Math.min((facts.categoricalCount ?? 0) / 20.0, 1.0);
    const maxCard = Math.min((facts.maxCardinality ?? 0) / 100.0, 1.0);
    const isTs = facts.hasTimeSeries ? 1.0 : 0.0;
    const outliers = Math.min(facts.outlierRatio ?? 0, 1.0);
    const clusters = Math.min((facts.clusterCount ?? 0) / 10.0, 1.0);

    return [rows, numCols, catCols, maxCard, isTs, outliers, clusters];
  }

  /**
   * Predicts recommended soft constraint weights given dataset topology features.
   */
  predict(features: Partial<DatasetFeatureVector>): RecommendedConstraintWeights {
    const x = this.extractFeatureVector(features);
    const output = [...this.bias];

    for (let j = 0; j < 5; j++) {
      for (let i = 0; i < 7; i++) {
        output[j] += x[i] * this.weights[i][j];
      }
      // ReLU activation bounded between 0 and 100
      output[j] = Math.max(0, Math.min(100, output[j]));
    }

    // Confidence metric derived from input signal variance
    const signalSum = x.reduce((acc, val) => acc + val, 0);
    const confidence = Math.min(0.99, 0.6 + (signalSum / 7.0) * 0.35);

    return {
      separabilityWeight: Math.round(output[0]),
      occlusionWeight: Math.round(output[1]),
      audioProximityWeight: Math.round(output[2]),
      instancedPointCloudWeight: Math.round(output[3]),
      clusterVolumeWeight: Math.round(output[4]),
      confidence: Number(confidence.toFixed(2)),
    };
  }

  /**
   * Online training step: updates weights based on analyst manual selection/feedback.
   */
  trainStep(features: Partial<DatasetFeatureVector>, targetWeights: Record<string, number>): void {
    const x = this.extractFeatureVector(features);
    const targets = [
      targetWeights.separabilityWeight ?? 20,
      targetWeights.occlusionWeight ?? 15,
      targetWeights.audioProximityWeight ?? 10,
      targetWeights.instancedPointCloudWeight ?? 10,
      targetWeights.clusterVolumeWeight ?? 10,
    ];

    const current = this.predict(features);
    const actuals = [
      current.separabilityWeight,
      current.occlusionWeight,
      current.audioProximityWeight,
      current.instancedPointCloudWeight,
      current.clusterVolumeWeight,
    ];

    // Stochastic gradient descent update
    for (let j = 0; j < 5; j++) {
      const error = targets[j] - actuals[j];
      this.bias[j] += this.learningRate * error;
      for (let i = 0; i < 7; i++) {
        this.weights[i][j] += this.learningRate * error * x[i];
      }
    }
    this.isTrained = true;
  }
}
