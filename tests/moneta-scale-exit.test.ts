import { describe, expect, it } from 'vitest';
import { datasetEvidenceFromKernelProfile } from '../src/atlas/MonetaEvidenceAuthority.ts';
import { RepresentationState } from '../src/atlas/domain/RepresentationState.ts';
import { NoFeasibleRepresentationError } from '../src/moneta/representation/NoFeasibleRepresentationError.ts';
import { createMonetaStructureProfile } from './helpers/moneta-kernel-fixture.ts';

const CARDINALITIES = [10_000, 100_000, 1_000_000, 10_000_000] as const;

type ScaleOutcome = {
  rows: number;
  evidenceItems: number;
  evaluatedCandidates: number;
  sensitivityScenarios: number | null;
  outcome: 'decision' | 'nil';
};

function runAtScale(rows: number): ScaleOutcome {
  const fingerprint = `sha256:scale-exit:${rows}`;
  const profile = createMonetaStructureProfile({
    datasetName: `scale-${rows}`,
    rowCount: rows,
    columnCount: 8,
    numericColumns: 6,
    categoricalColumns: 2,
    fingerprint,
    clusterCount: 4,
    hasClusters: true,
    separationScore: 0.78,
    densityVariation: 0.42,
  });

  // This bridge exposes only compact Rust-owned profile metadata. There is no
  // row collection here for Moneta to traverse or rematerialise in JS.
  const evidence = datasetEvidenceFromKernelProfile(
    {
      computeDatasetStructureProfile: () => profile,
      datasetFingerprint: () => fingerprint,
    },
    7,
  );
  const state = new RepresentationState();

  try {
    const decision = state.arbitrateRepresentationFromEvidence(evidence);
    return {
      rows,
      evidenceItems: evidence.evidence.length,
      evaluatedCandidates: decision.rankedCandidates.length,
      sensitivityScenarios: decision.weightSensitivity.scenarioCount,
      outcome: 'decision',
    };
  } catch (error) {
    if (!(error instanceof NoFeasibleRepresentationError)) throw error;
    return {
      rows,
      evidenceItems: evidence.evidence.length,
      evaluatedCandidates: error.nearMisses.length,
      sensitivityScenarios: null,
      outcome: 'nil',
    };
  }
}

describe('Moneta migration scale exit', () => {
  it('keeps evidence and candidate work bounded from 10K through 10M rows', () => {
    const outcomes = CARDINALITIES.map(runAtScale);

    const evidenceCounts = new Set(outcomes.map((outcome) => outcome.evidenceItems));
    const candidateCounts = new Set(outcomes.map((outcome) => outcome.evaluatedCandidates));

    expect(evidenceCounts.size).toBe(1);
    expect(candidateCounts.size).toBe(1);
    expect(outcomes.every((outcome) => outcome.evaluatedCandidates > 0)).toBe(true);

    for (const outcome of outcomes) {
      expect(outcome.evidenceItems).toBeLessThan(32);
      expect(outcome.evaluatedCandidates).toBeLessThan(256);
      if (outcome.sensitivityScenarios !== null) {
        expect(outcome.sensitivityScenarios).toBeLessThan(64);
      }
    }
  });

  it('never requires JS row materialisation to build the authoritative scale profile', () => {
    for (const rows of CARDINALITIES) {
      const profile = createMonetaStructureProfile({
        datasetName: `scale-shape-${rows}`,
        rowCount: rows,
        columnCount: 8,
        numericColumns: 6,
        categoricalColumns: 2,
        fingerprint: `sha256:scale-shape:${rows}`,
      });
      const serialized = JSON.stringify(profile);

      expect(profile.rowCount).toBe(rows);
      expect(serialized).not.toContain('"rows"');
      expect(serialized.length).toBeLessThan(8_192);
    }
  });
});
