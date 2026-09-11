import { describe, expect, it } from 'vitest';
import { DATASET_ENVELOPES, DEVICE_ENVELOPES, FAULT_ENVELOPES, expandExperimentMatrix } from '../../dev/xr-lab/ExperimentalProfiles.ts';
import { WebXRSimulatorAdapter } from '../../dev/xr-simulator/WebXRSimulatorAdapter.ts';

describe('XR experimental engine profiles', () => {
  it('keeps simulator evidence explicitly below physical-device qualification', () => {
    for (const profile of Object.values(DEVICE_ENVELOPES)) {
      if (profile.runtime !== 'physical') expect(['S0', 'S1', 'S2', 'S3']).toContain(profile.evidenceTier);
    }
  });

  it('instantiates each IWER-backed device envelope with its declared profile', () => {
    for (const profile of Object.values(DEVICE_ENVELOPES).filter((p) => p.iwerConfig)) {
      const adapter = new WebXRSimulatorAdapter(profile.iwerConfig);
      expect(adapter.device.name).toBe(profile.iwerConfig!.name);
      expect(adapter.device.supportedFrameRates).toEqual(profile.iwerConfig!.supportedFrameRates);
    }
  });

  it('expands a deterministic device × fault × dataset × repetition campaign', () => {
    const cells = expandExperimentMatrix({ devices: ['quest3-class', 'generic-webxr'], faults: ['clean', 'hostile'], datasets: ['tiny', 'dense-low-structure'], repetitions: 3 });
    expect(cells).toHaveLength(24);
    expect(new Set(cells.map((c) => c.id)).size).toBe(24);
  });

  it('makes source cardinality and semantic cardinality independently testable', () => {
    expect(DATASET_ENVELOPES['dense-low-structure'].rows).toBeGreaterThan(DATASET_ENVELOPES['sparse-high-structure'].rows);
    expect(DATASET_ENVELOPES['dense-low-structure'].semanticStructures).toBeLessThan(DATASET_ENVELOPES['sparse-high-structure'].semanticStructures);
    expect(FAULT_ENVELOPES.hostile.trackingPositionNoiseM).toBeGreaterThan(FAULT_ENVELOPES.noisy.trackingPositionNoiseM);
  });

  it('fails closed on unknown matrix dimensions', () => {
    expect(() => expandExperimentMatrix({ devices: ['not-a-device'], faults: ['clean'], datasets: ['tiny'], repetitions: 1 })).toThrow(/unknown device/);
    expect(() => expandExperimentMatrix({ devices: ['quest3-class'], faults: ['wat'], datasets: ['tiny'], repetitions: 1 })).toThrow(/unknown fault/);
    expect(() => expandExperimentMatrix({ devices: ['quest3-class'], faults: ['clean'], datasets: ['wat'], repetitions: 1 })).toThrow(/unknown dataset/);
  });
});
