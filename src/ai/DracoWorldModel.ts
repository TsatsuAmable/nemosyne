import { NeuralConstraintPredictor, type DatasetFeatureVector, type RecommendedConstraintWeights } from './NeuralConstraintPredictor.ts';

export interface GAParameterSet {
  fitnessWeights: {
    separability: number;
    occlusion: number;
    audioProximity: number;
  };
  mutationRate: number;
  geneSeedBias: string;
}

export class DracoWorldModel {
  modelLoaded = true;
  currentGAParameters: GAParameterSet;
  predictor: NeuralConstraintPredictor;

  private _tuningHistory: Record<string, number>[] = [];

  constructor() {
    this.predictor = new NeuralConstraintPredictor();
    this.currentGAParameters = {
      fitnessWeights: {
        separability: 0.75,
        occlusion: 0.5,
        audioProximity: 0.65,
      },
      mutationRate: 0.05,
      geneSeedBias: 'ForceDirected3D',
    };
  }

  /**
   * Predicts recommended soft constraint weights for a given dataset feature profile.
   */
  predictWeightsForDataset(features: Partial<DatasetFeatureVector>): RecommendedConstraintWeights {
    const rec = this.predictor.predict(features);
    // Sync predicted weights to active GA parameters
    this.currentGAParameters.fitnessWeights.separability = rec.separabilityWeight / 100.0;
    this.currentGAParameters.fitnessWeights.occlusion = rec.occlusionWeight / 100.0;
    this.currentGAParameters.fitnessWeights.audioProximity = rec.audioProximityWeight / 100.0;
    return rec;
  }

  /**
   * Ingest manual candidate weight tuning feedback from VR Candidate Carousel.
   */
  ingestManualTuning(weights: Record<string, number>, features?: Partial<DatasetFeatureVector>): GAParameterSet {
    this._tuningHistory.push(weights);

    // Modulate GA fitness weights live based on analyst preferences
    if (weights.separability !== undefined) {
      this.currentGAParameters.fitnessWeights.separability = weights.separability;
    }
    if (weights.occlusion !== undefined) {
      this.currentGAParameters.fitnessWeights.occlusion = weights.occlusion;
    }
    if (weights.audioProximity !== undefined) {
      this.currentGAParameters.fitnessWeights.audioProximity = weights.audioProximity;
    }

    // Perform online training step if dataset features are provided
    if (features) {
      this.predictor.trainStep(features, weights);
    }

    // Adaptive mutation rate adjustment based on tuning intensity
    if (this._tuningHistory.length > 5) {
      this.currentGAParameters.mutationRate = 0.08; // Increase exploration
    }

    return this.currentGAParameters;
  }

  /**
   * Modulate GA parameters for current dataset topology.
   */
  modulateGAForTopology(topologyType: string): GAParameterSet {
    this.currentGAParameters.geneSeedBias = topologyType;
    return this.currentGAParameters;
  }

  reset(): void {
    this._tuningHistory = [];
  }
}
