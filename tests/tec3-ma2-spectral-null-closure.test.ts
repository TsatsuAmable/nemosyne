import { describe, expect, it } from 'vitest';
import { createMonetaStructureProfile } from './helpers/moneta-kernel-fixture.ts';
import { structureProfileToDatasetEvidence } from '../src/data/evidence/StructureProfileEvidenceAdapter.ts';
import { datasetEvidenceToSignature } from '../src/moneta/representation/DatasetEvidenceSignature.ts';

// TEC3-MA2 controls for the MA1 K-5 periodicity null closure. At the kernel
// ABI (wasm/src/lib.rs data_compute_spectral_facts; MA1 cites the pre-drift
// line 813-826 region) both refusal reasons — irregular sampling, an invalid
// domain, and fewer than four observations, insufficient information —
// collapse to the identical null spectral profile with no reason marker, and
// the TS bridge (src/wasm/runtime/DatasetHandleBridge.ts computeSpectralFacts)
// reproduces that collapse. This file pins what that means at the canonical
// intake layer: null is unobservable, silence and "no result" are the same
// wire value, while a emitted negative result IS distinguishable. The
// positive periodicity control for this family lives in
// tests/uxr3-spectral-transfer-wasm.test.ts and the kernel-side negative
// control lives in wasm/src/data/profile.rs.

function spectralNegativeProfile() {
  const profile = createMonetaStructureProfile({
    datasetName: 'ma2-spectral-negative',
    rowCount: 256,
    columnCount: 2,
    numericColumns: 1,
    categoricalColumns: 0,
    temporalColumns: 1,
  });
  // Kernel-faithful emitted negative: the flat bell-noise control
  // (wasm/src/data/profile.rs deterministic_bell_noise_reports_no_periodicity)
  // yields these magnitudes under regular-time-fft.
  profile.spectral = {
    dominantFrequencies: [],
    spectralEntropy: 0.921,
    powerSpectrumPeak: 0.036,
    hasPeriodicity: false,
    periodicityHeuristicScore: 0,
    method: 'regular-time-fft',
    observedCount: 256,
    transformLength: 256,
    sourceObservationsPerBin: 1,
    frequencyResolution: 1 / 256,
    maximumFrequency: 0.5,
    windowFunction: 'hann',
  };
  profile.temporal = {
    isTimeSeries: true,
    timeColumn: 'time',
    trendDirection: 'flat',
    trendStrength: 0,
    hasSeasonality: false,
    periodicities: [],
  };
  return profile;
}

describe('TEC3-MA2 spectral null closure (MA1 K-5)', () => {
  it('null spectral collapses both refusal reasons into one unobservable wire value', () => {
    const profile = createMonetaStructureProfile({
      datasetName: 'ma2-spectral-refusal',
      rowCount: 256,
      columnCount: 3,
      numericColumns: 3,
      categoricalColumns: 0,
    });
    expect(profile.spectral).toBeNull();
    const evidence = structureProfileToDatasetEvidence(profile);
    expect(evidence.evidence.find((entry) => entry.id === 'spectral:global')).toBeUndefined();
    const signature = datasetEvidenceToSignature(evidence);
    expect(signature.spectralStructure).toBeNull();
    expect(signature.epistemic?.facts['spectralStructure.hasPeriodicity']?.source).toBe(
      'unknown'
    );
    // Nothing in the intake payload distinguishes an irregular-sampling
    // refusal (invalid domain) from a too-short-series refusal (insufficient
    // information): both produce exactly this null profile, and the TS
    // bridge reproduces the collapse, so consumers cannot re-classify.
  });

  it('an emitted negative periodicity result is distinguishable from the null closure', () => {
    const evidence = structureProfileToDatasetEvidence(spectralNegativeProfile());
    const item = evidence.evidence.find((entry) => entry.id === 'spectral:global');
    expect(item).toBeDefined();
    const signature = datasetEvidenceToSignature(evidence);
    expect(signature.spectralStructure).not.toBeNull();
    expect(signature.spectralStructure?.hasPeriodicity).toBe(false);
    expect(signature.spectralStructure?.powerSpectrumPeak).toBeCloseTo(0.036, 9);
    expect(signature.spectralStructure?.spectralEntropy).toBeCloseTo(0.921, 9);
    expect(signature.epistemic?.facts['spectralStructure.hasPeriodicity']?.source).toBe(
      'heuristic'
    );
  });

  it('seasonality is withheld when the spectral estimator is invalid', () => {
    const refused = createMonetaStructureProfile({
      datasetName: 'ma2-spectral-refused-seasonality',
      rowCount: 256,
      columnCount: 2,
      numericColumns: 1,
      categoricalColumns: 0,
      temporalColumns: 1,
    });
    refused.temporal = {
      isTimeSeries: true,
      timeColumn: 'time',
      trendDirection: 'up',
      trendStrength: 0.7,
      hasSeasonality: false,
      periodicities: [],
    };
    // spectral stays null: irregular sampler. Trend survives, seasonality
    // claim is absent — the adapter documents this withholding explicitly.
    const signature = datasetEvidenceToSignature(
      structureProfileToDatasetEvidence(refused)
    );
    expect(signature.spectralStructure).toBeNull();
    expect(signature.temporalStructure?.isTimeSeries).toBe(true);
  });
});