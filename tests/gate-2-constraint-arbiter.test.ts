/**
 * Gate 2 (Represent) contract coverage.
 *
 * Historical ConstraintArbiter scoring coverage was removed when the duplicate
 * representation scorer was retired. Canonical ranking is owned by
 * MonetaHypothesisEngine/FitnessModel; this suite keeps schema and Atlas
 * composition coverage only.
 */

import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import {
  RepresentationRequirementsSchema,
  createDefaultRequirements,
} from '../src/moneta/index.ts';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset } from '../src/data/Dataset.ts';

describe('Gate 2 (Represent): RepresentationRequirements Schema', () => {
  it('validates valid requirements successfully', () => {
    const req = createDefaultRequirements('explore', ['dimA', 'dimB', 'dimC']);
    const parsed = v.parse(RepresentationRequirementsSchema, req);
    expect(parsed.task).toBe('explore');
    expect(parsed.primaryDimensions).toEqual(['dimA', 'dimB', 'dimC']);
    expect(parsed.preservationGoal).toBe('cluster-separation');
  });

  it('rejects invalid task identifiers', () => {
    const invalid = {
      task: 'invalid-task-type',
      primaryDimensions: ['dimA'],
    };
    expect(() => v.parse(RepresentationRequirementsSchema, invalid)).toThrow();
  });

  it('populates default hardware envelope', () => {
    const req = createDefaultRequirements('identify-outliers');
    expect(req.hardwareConstraints?.deviceTier).toBe('quest3');
    expect(req.hardwareConstraints?.preferInstanced).toBe(true);
  });
});

describe('Gate 2 (Represent): AtlasCore composition', () => {
  it('derives SpatialStrategy from the canonical RepresentationDecision', () => {
    const clusterRows = [
      ...Array.from({ length: 10 }, (_, i) => ({
        feat1: 1 + i * 0.1,
        feat2: 2 + i * 0.1,
        feat3: 3 + i * 0.1,
        cluster: 'A',
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        feat1: 10 + i * 0.1,
        feat2: 11 + i * 0.1,
        feat3: 12 + i * 0.1,
        cluster: 'B',
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        feat1: 20 + i * 0.1,
        feat2: 21 + i * 0.1,
        feat3: 22 + i * 0.1,
        cluster: 'C',
      })),
    ];
    const dataset = Dataset.fromJSON({
      name: 'ClusterTest',
      columns: [
        { name: 'feat1', type: 'numeric' },
        { name: 'feat2', type: 'numeric' },
        { name: 'feat3', type: 'numeric' },
        { name: 'cluster', type: 'categorical' },
      ],
      rows: clusterRows,
    });

    const atlas = new AtlasCore();
    atlas.loadDataset(dataset);
    const req = createDefaultRequirements('compare-clusters', ['feat1', 'feat2', 'feat3']);

    const decision = atlas.arbitrateRepresentation(req);
    const strategy = atlas.arbitrateSpatialStrategy(req);

    expect(strategy).toBeDefined();
    expect(strategy.id).toContain('strat:');
    expect(strategy).toEqual(atlas.activeSpatialStrategy);
    expect(strategy.provenance.engine).toBe('MonetaHypothesisEngine');
    expect(decision.provenance.engine).toBe('MonetaHypothesisEngine');
  });
});
