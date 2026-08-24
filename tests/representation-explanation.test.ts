import { describe, it, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset } from '../src/data/Dataset.ts';
import {
  RepresentationHypothesisEngine,
  createDefaultRequirements,
  type DracoFacts,
} from '../src/moneta/index.ts';

describe('Phase 7: Explanation Traces & Canonical Investigation Digest', () => {
  const baseTabularFacts: DracoFacts = {
    topology: 'TABULAR',
    rowCount: 100,
    nodeCount: 100,
    edgeCount: 0,
    depth: 0,
    numericColumns: 3,
    categoricalColumns: 2,
    temporalColumns: 0,
    hasTimeSeries: false,
    hasContinuousValues: true,
    density: 0.2,
    estimatedDensity: 0.2,
    outlierCount: 5,
    cardinalityOfColor: 4,
    hasHighCardinality: false,
    isLargeDataset: false,
    clusterCount: 2,
    columnStats: {},
    correlationMatrix: {},
    categoryDistribution: {},
    trendDirection: 'flat',
    seasonalityHint: false,
    hasOutliers: true,
    hasHighVariance: false,
    numericSkew: 0.8,
    topCategory: null,
  };

  it('produces structured, validated evidence traces for winning family', () => {
    const decision = RepresentationHypothesisEngine.reason(
      baseTabularFacts,
      null,
      createDefaultRequirements('identify-outliers')
    );

    expect(decision.evidence.length).toBeGreaterThan(0);
    for (const ev of decision.evidence) {
      expect(typeof ev.fact).toBe('string');
      expect(ev.fact.length).toBeGreaterThan(0);
      expect(typeof ev.weight).toBe('number');
      expect(ev.weight).toBeGreaterThanOrEqual(0);
      expect(typeof ev.supports).toBe('boolean');
      expect(['kernel', 'heuristic', 'user-requirement', 'moneta-config', 'moneta-sensitivity']).toContain(ev.source);
    }
  });

  it('includes ineligible alternatives with explicit hard-constraint reasons', () => {
    const decision = RepresentationHypothesisEngine.reason(
      baseTabularFacts,
      null,
      createDefaultRequirements('explore')
    );

    const freqRejection = decision.rejectedAlternatives.find((r) => r.family === 'FREQUENCY');
    expect(freqRejection).toBeDefined();
    expect(freqRejection?.hardPassed).toBe(false);
    expect(freqRejection?.reason?.toLowerCase()).toContain('spectral');

    const tempRejection = decision.rejectedAlternatives.find((r) => r.family === 'TEMPORAL');
    expect(tempRejection).toBeDefined();
    expect(tempRejection?.hardPassed).toBe(false);
    expect(tempRejection?.reason).toContain('temporal');
  });

  it('computes deterministic cryptographic digest including representation decision', async () => {
    const atlas = new AtlasCore();
    const dataset = Dataset.fromJSON({
      name: 'digest-test',
      columns: [
        { name: 'val', type: 'numeric' },
        { name: 'cat', type: 'categorical' },
      ],
      rows: [
        { val: 10, cat: 'A' },
        { val: 20, cat: 'B' },
      ],
    });
    atlas.loadDataset(dataset);

    // 1. Digest without decision
    const digestBefore = await atlas.computeDigest();
    expect(typeof digestBefore).toBe('string');
    expect(digestBefore).toHaveLength(64);

    // 2. Restore a separately-tested representation decision. This test owns
    // digest semantics, not the Atlas → Rust DatasetEvidence composition seam.
    const decision = RepresentationHypothesisEngine.reason(
      baseTabularFacts,
      null,
      createDefaultRequirements('explore'),
      { datasetFingerprint: atlas.datasetFingerprint ?? 'digest-test' },
    );
    atlas.aggregate.representation.restoreDecision(decision);

    // 3. Digest with decision
    const digestWithDecision = await atlas.computeDigest();
    expect(typeof digestWithDecision).toBe('string');
    expect(digestWithDecision).toHaveLength(64);
    expect(digestWithDecision).not.toBe(digestBefore);

    // 4. Parity check — recomputing without state change produces exact same hash
    const digestRecompute = await atlas.computeDigest();
    expect(digestRecompute).toBe(digestWithDecision);
  });
});
