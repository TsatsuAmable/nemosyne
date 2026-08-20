import { describe, expect, it } from 'vitest';
import {
  createDefaultRequirements,
  minimalDatasetSignature,
  MonetaHypothesisEngine,
  NoFeasibleRepresentationError,
} from '../src/moneta/index.ts';

describe('Moneta hypothesis hard constraints', () => {
  it('returns a typed infeasibility outcome rather than selecting a disqualified candidate', () => {
    const signature = minimalDatasetSignature(1_000, 3, 1, 0, 'hardware-infeasible', 0);
    const requirements = createDefaultRequirements('individual-inspection');
    requirements.hardwareConstraints = { ...requirements.hardwareConstraints, maxElements: 1 };

    expect(() => new MonetaHypothesisEngine().arbitrate(signature, requirements)).toThrow(
      NoFeasibleRepresentationError
    );
  });

  it('keeps the rendered strategy layout identical to the ranked winner', () => {
    const signature = minimalDatasetSignature(100, 3, 1, 1, 'temporal-fp', 0);
    signature.temporalStructure.isTimeSeries = true;
    const decision = new MonetaHypothesisEngine().arbitrate(
      signature,
      createDefaultRequirements('temporal-trend')
    );

    expect(decision.embodiment.primaryLayout).toBe(decision.chosenLayout);
    expect(decision.embodiment.spatialStrategy.macroLayout.layout).toBe(decision.chosenLayout);
    expect(decision.provenance.generatedAt).toBe(0);
  });

  it('does not permit an invalid hypothesis-weight vector', () => {
    expect(() => new MonetaHypothesisEngine({ w_struct: -0.1 })).toThrow(/finite non-negative/);
    expect(() => new MonetaHypothesisEngine({ w_struct: 0.5 })).toThrow(/sum to 1/);
  });

  it('includes hardware in the canonicalised requirements identity and stays deterministic', () => {
    const signature = minimalDatasetSignature(100, 3, 1, 0, 'hash-fp', 0);
    const quest = createDefaultRequirements('explore');
    const desktop = createDefaultRequirements('explore');
    desktop.hardwareConstraints = {
      ...desktop.hardwareConstraints,
      deviceTier: 'desktop',
      maxDrawCalls: 60,
    };

    const engine = new MonetaHypothesisEngine();
    const first = engine.arbitrate(signature, quest);
    const second = engine.arbitrate(signature, quest);
    const hardwareChanged = engine.arbitrate(signature, desktop);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.embodiment.spatialStrategy.provenance.requirementsHash).not.toBe(
      hardwareChanged.embodiment.spatialStrategy.provenance.requirementsHash
    );
  });
});
