import { describe, expect, it } from 'vitest';
import { BootstrapFitnessModel } from '../src/moneta/representation/FitnessModel.ts';
import { MONETA_REPRESENTATION_CANDIDATES } from '../src/moneta/representation/RepresentationCandidate.ts';
import { createDefaultRequirements } from '../src/moneta/representation/RepresentationRequirements.ts';
import { createMonetaStructureProfile } from './helpers/moneta-kernel-fixture.ts';
import { structureProfileToDatasetEvidence } from '../src/data/evidence/StructureProfileEvidenceAdapter.ts';
import { datasetEvidenceToSignature } from '../src/moneta/representation/DatasetEvidenceSignature.ts';
import { markDatasetSignatureFact } from '../src/moneta/representation/DatasetSignature.ts';
import { buildDatasetSignature } from '../src/moneta/representation/SignatureBuilder.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import type { Facts } from '../src/data/types.ts';

// TEC3-MA2 control fixtures for the F-1 structure component of the fitness
// model (docs/audits/TEC3_METRIC_ADMISSIBILITY_INVENTORY_2026-10-02.md F-1,
// and that inventory's section 4 gate mismatch). The canonical producer
// labels clusterStructure.hasClusters and distribution.highVariance
// 'heuristic'; these tests pin what the epistemic gate then does with those
// labels, observed through the production BootstrapFitnessModel, without
// changing any production threshold.

const clustered = createMonetaStructureProfile({
  datasetName: 'ma2-cluster-positive',
  rowCount: 200,
  columnCount: 3,
  numericColumns: 3,
  categoricalColumns: 0,
  clusterCount: 3,
  hasClusters: true,
  separationScore: 0.8,
});

const flat = createMonetaStructureProfile({
  datasetName: 'ma2-cluster-negative',
  rowCount: 200,
  columnCount: 3,
  numericColumns: 3,
  categoricalColumns: 0,
  clusterCount: 1,
  hasClusters: false,
  separationScore: 0,
});

function structureRawScore(signature: ReturnType<typeof datasetEvidenceToSignature>) {
  const model = new BootstrapFitnessModel();
  const req = createDefaultRequirements('compare-clusters', 'MEDIUM');
  const evaluation = model.evaluate(
    signature,
    req,
    MONETA_REPRESENTATION_CANDIDATES.CLUSTER_REGIONS,
    'CLUSTER'
  );
  return evaluation.components.find((component) => component.dimension === 'structure')!.rawScore;
}

describe('TEC3-MA2 fitness model cluster-boost controls (MA1 F-1)', () => {
  it('canonical cluster presence does not separate positive from negative structure score', () => {
    const posSig = datasetEvidenceToSignature(structureProfileToDatasetEvidence(clustered));
    const negSig = datasetEvidenceToSignature(structureProfileToDatasetEvidence(flat));

    expect(posSig.clusterStructure.hasClusters).toBe(true);
    expect(posSig.epistemic?.facts['clusterStructure.hasClusters']?.source).toBe('heuristic');

    const pos = structureRawScore(posSig);
    const neg = structureRawScore(negSig);
    expect(neg).toBeCloseTo(0.58, 12);
    expect(pos).toBeCloseTo(neg, 12);
    expect(posSig.clusterStructure.hasClusters).not.toBe(negSig.clusterStructure.hasClusters);
  });

  it('the cluster boost is reachable only by flipping the fact to measured/derived', () => {
    const posSig = datasetEvidenceToSignature(structureProfileToDatasetEvidence(clustered));
    const canonical = structureRawScore(posSig);
    markDatasetSignatureFact(posSig.epistemic!, 'clusterStructure.hasClusters', 'measured');
    const flipped = structureRawScore(posSig);

    expect(flipped).toBeGreaterThan(0.9);
    expect(flipped).toBeCloseTo(0.965, 12);
    expect(flipped - canonical).toBeCloseTo(0.385, 9);
  });

  it('the legacy SignatureBuilder path does not fire the cluster boost either', () => {
    // MA1 section 4 attributes the boost firing to "the legacy
    // buildDatasetSignature/SignatureBuilder path or historical persisted
    // signatures". The legacy half of that claim is false in this build: the
    // legacy producer leaves clusterStructure empty in both MonetaFacts and
    // Dataset branches (SignatureBuilder "Do NOT populate" comment), so the
    // gate has no fact to admit and the structure score is identical to the
    // canonical one. Recorded rather than reconciled — reconciling either way
    // would be a production-source change outside MA2 slice 1.
    const dataset = new Dataset(
      'ma2-legacy-fixture',
      [
        { name: 'x', type: ColumnType.NUMERIC },
        { name: 'y', type: ColumnType.NUMERIC },
      ],
      Array.from({ length: 200 }, (_, i) => ({ x: i as unknown, y: (i % 10) as unknown }))
    );
    const facts: Facts = {
      rowCount: 200,
      columnCount: 2,
      numeric: [
        { name: 'x', count: 200, sum: 19900, mean: 99.5, median: 100, std: 58, var: 3364,
          min: 0, max: 199, skew: 0, kurtosis: -1.2, outlierCount: 0 },
        { name: 'y', count: 200, sum: 900, mean: 4.5, median: 5, std: 2.87, var: 8.25,
          min: 0, max: 9, skew: 0, kurtosis: -1.2, outlierCount: 3 },
      ],
      correlation: [],
      categorical: [],
      temporal: [],
      temporalStats: [],
    };
    const legacy = buildDatasetSignature(dataset, facts, 'fp-legacy', 'legacy-kernel');

    expect(legacy.clusterStructure).toEqual({});
    expect(legacy.epistemic?.facts['clusterStructure.hasClusters']?.source).toBe('unknown');
    expect(legacy.distribution.highVariance).toBeUndefined();
    expect(structureRawScore(legacy)).toBeCloseTo(0.58, 12);
    expect(structureRawScore(legacy)).toBeCloseTo(
      structureRawScore(datasetEvidenceToSignature(structureProfileToDatasetEvidence(clustered))),
      12
    );
  });

  it('distribution boost asymmetry: heuristic hasOutliers fires, heuristic highVariance is gated dead', () => {
    const model = new BootstrapFitnessModel();
    const req = createDefaultRequirements('explore', 'MEDIUM');
    const evaluateDistribution = (sig: ReturnType<typeof datasetEvidenceToSignature>) =>
      model.evaluate(
        sig,
        req,
        MONETA_REPRESENTATION_CANDIDATES.DISTRIBUTION_FIELD,
        'DISTRIBUTION'
      ).components.find((component) => component.dimension === 'structure')!.rawScore;

    const highVarianceProfile = createMonetaStructureProfile({
      datasetName: 'ma2-highvariance-positive',
      rowCount: 200,
      columnCount: 3,
      numericColumns: 3,
      categoricalColumns: 0,
    });
    highVarianceProfile.distributions.globalHighVariance = true;
    const hvSig = datasetEvidenceToSignature(
      structureProfileToDatasetEvidence(highVarianceProfile)
    );
    expect(hvSig.epistemic?.facts['distribution.highVariance']?.source).toBe('heuristic');
    expect(evaluateDistribution(hvSig)).toBeCloseTo(0.43, 12);

    // The highVariance-absent negative control is measured here, not inferred
    // from ladder arithmetic, so the report's D = 0.0 stays execution-backed.
    const noneProfile = createMonetaStructureProfile({
      datasetName: 'ma2-distribution-negative',
      rowCount: 200,
      columnCount: 3,
      numericColumns: 3,
      categoricalColumns: 0,
    });
    const noneSig = datasetEvidenceToSignature(structureProfileToDatasetEvidence(noneProfile));
    expect(evaluateDistribution(noneSig)).toBeCloseTo(0.43, 12);

    const outliersProfile = createMonetaStructureProfile({
      datasetName: 'ma2-outliers-positive',
      rowCount: 200,
      columnCount: 3,
      numericColumns: 3,
      categoricalColumns: 0,
    });
    (outliersProfile.distributions.numericSummaries as unknown[]) = [];
    // The Rust producer couples global = OR of per-column outlier_count and
    // total = sum, so a kernel-faithful mock sets both.
    outliersProfile.distributions.globalHasOutliers = true;
    outliersProfile.anomalies = {
      totalAnomalies: 1,
      anomalyFraction: 1 / 200,
      hasAnomalies: true,
      maxAnomalyScore: 1,
    };
    const outSig = datasetEvidenceToSignature(
      structureProfileToDatasetEvidence(outliersProfile)
    );
    expect(outSig.distribution.hasOutliers).toBe(true);
    expect(outSig.epistemic?.facts['distribution.hasOutliers']?.source).toBe('heuristic');
    // Not epistemically gated (FitnessModel DISTRIBUTION branch), so the boost
    // fires on the very fact the CLUSTER branch would have gated out.
    expect(evaluateDistribution(outSig)).toBeCloseTo(0.78, 12);
    expect(evaluateDistribution(outSig) - evaluateDistribution(hvSig)).toBeCloseTo(0.35, 9);
  });
});