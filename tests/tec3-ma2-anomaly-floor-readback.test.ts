import { describe, expect, it } from 'vitest';
import { createMonetaStructureProfile } from './helpers/moneta-kernel-fixture.ts';
import { structureProfileToDatasetEvidence } from '../src/data/evidence/StructureProfileEvidenceAdapter.ts';
import { datasetEvidenceToSignature } from '../src/moneta/representation/DatasetEvidenceSignature.ts';

// TEC3-MA2 controls for the MA1 K-8 anomaly-score floor. The kernel's
// max_anomaly_score is max(max_deviation/std/5 clamped, 0.2) when anomalies
// exist (wasm/src/data/profile.rs), and only binds exactly (at 0.2) through
// the degenerate regime where the column std falls under the 1e-9 guard;
// see the companion kernel-side test in wasm/src/data/profile.rs. This file
// pins what the canonical TS intake does with that value: the floor
// survives into the DatasetEvidence item and is dropped from the decision
// signature, which has no maxAnomalyScore field at all.

function floorProfile() {
  const profile = createMonetaStructureProfile({
    datasetName: 'ma2-anomaly-floor',
    rowCount: 200,
    columnCount: 3,
    numericColumns: 3,
    categoricalColumns: 0,
  });
  (profile.distributions.numericSummaries as unknown[]) = [];
  // The Rust producer couples global = OR of per-column outlier_count and
  // total = sum, so a kernel-faithful mock sets both. maxAnomalyScore 0.2 is
  // the exact floor value the kernel emits in the floor-binding control.
  profile.distributions.globalHasOutliers = true;
  profile.anomalies = {
    totalAnomalies: 1,
    anomalyFraction: 0.005,
    hasAnomalies: true,
    maxAnomalyScore: 0.2,
  };
  return profile;
}

describe('TEC3-MA2 anomaly floor readback (MA1 K-8)', () => {
  it('the exact floor value survives into the evidence item', () => {
    const evidence = structureProfileToDatasetEvidence(floorProfile());
    const item = evidence.evidence.find((entry) => entry.id === 'anomaly:global');
    expect(item).toBeDefined();
    expect(item?.value).toEqual({
      totalAnomalies: 1,
      anomalyFraction: 0.005,
      heuristicAnomalyDetected: true,
      maxAnomalyScore: 0.2,
    });
  });

  it('the decision signature has no maxAnomalyScore field at all', () => {
    const signature = datasetEvidenceToSignature(
      structureProfileToDatasetEvidence(floorProfile())
    );
    expect(signature.distribution.hasOutliers).toBe(true);
    expect(signature.distribution.outlierFraction).toBe(0.005);
    expect(signature.distribution.anomalyCount).toBe(1);
    // The floor-quantitative value is not merely re-labeled or gated here;
    // it has no field in the signature shape, so any downstream decision
    // consumer of the signature cannot read it.
    expect(Object.keys(signature.distribution)).not.toContain('maxAnomalyScore');
    expect(signature.epistemic?.facts['distribution.hasOutliers']?.source).toBe('heuristic');
  });

  it('an anomaly-free profile readbacks as the zero-score negative control', () => {
    const negative = createMonetaStructureProfile({
      datasetName: 'ma2-anomaly-negative',
      rowCount: 200,
      columnCount: 3,
      numericColumns: 3,
      categoricalColumns: 0,
    });
    const evidence = structureProfileToDatasetEvidence(negative);
    const item = evidence.evidence.find((entry) => entry.id === 'anomaly:global');
    expect(item?.value).toEqual({
      totalAnomalies: 0,
      anomalyFraction: 0,
      heuristicAnomalyDetected: false,
      maxAnomalyScore: 0,
    });
    const signature = datasetEvidenceToSignature(evidence);
    expect(signature.distribution.hasOutliers).toBe(false);
  });
});