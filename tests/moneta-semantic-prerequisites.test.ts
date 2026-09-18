import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { abstractionLevelForRequirements } from '../src/moneta/representation/SemanticAbstraction.ts';
import { MONETA_REPRESENTATION_CANDIDATES } from '../src/moneta/representation/RepresentationCandidate.ts';
import { decideRawRowAuthority } from '../src/moneta/representation/RawRowAuthority.ts';
import { validateSemanticEmbodimentGraphV1, type SemanticEmbodimentGraphV1 } from '../src/moneta/representation/SemanticEmbodimentGraphV1.ts';
import { NEMOSYNE_EXPERIMENT_SPECIMEN_CAPABILITIES } from '../src/moneta/representation/ExperimentSpecimenCapabilities.ts';
import { VRTopologyTranslator } from '../src/moneta/VRTopologyTranslator.ts';
import type { MonetaFacts } from '../src/moneta/types.ts';

describe('dataset-first Moneta prerequisite contracts', () => {
  it('requires explicit observation authority for raw rows', () => {
    expect(MONETA_REPRESENTATION_CANDIDATES.POINT_SET.abstractionLevel).toBe('OBSERVATION');
    expect(MONETA_REPRESENTATION_CANDIDATES.MATRIX_FIELD.abstractionLevel).toBe('OBSERVATION');
    expect(abstractionLevelForRequirements({ task: 'overview' })).toBe('DATASET');
    expect(decideRawRowAuthority({ candidateId: 'POINT_SET', intentAbstractionLevel: 'DATASET', governedEmbodiment: 'NOT_REQUIRED' }).authorized).toBe(false);
    expect(decideRawRowAuthority({ candidateId: 'POINT_SET', intentAbstractionLevel: 'OBSERVATION', governedEmbodiment: 'NOT_REQUIRED' }).authorized).toBe(true);
    expect(decideRawRowAuthority({ candidateId: 'DENSITY_FIELD', intentAbstractionLevel: 'DATASET', governedEmbodiment: 'MISSING' }).authorized).toBe(false);
  });

  it('gates the generic translator row path behind semantic authority', () => {
    const source = readFileSync('src/moneta/VRTopologyTranslator.ts', 'utf8');
    const gate = source.indexOf('decideRawRowAuthority({');
    const rows = source.indexOf('rows = dataset?.rows ?? dataInput.rows ?? []');
    expect(gate).toBeGreaterThan(-1);
    expect(rows).toBeGreaterThan(gate);

    const artifact = VRTopologyTranslator.synthesizeArtifact(
      {
        spec: { layout: 'GEO_SURFACE', geometry: 'GEO_COLUMN', behavior: 'STATIC', interaction: 'BEACON' },
        facts: { numericColumns: 1, hasTimeSeries: false } as MonetaFacts,
        cost: 0,
      },
      { rows: [{ lat: 51.5, lon: -0.1, value: 1 }] },
    );
    expect(artifact.nodeMeshes).toHaveLength(0);
  });

  it('permits primary observation rows only for POINT_SET and MATRIX_FIELD', () => {
    for (const candidateId of Object.keys(MONETA_REPRESENTATION_CANDIDATES)) {
      const decision = decideRawRowAuthority({
        candidateId: candidateId as keyof typeof MONETA_REPRESENTATION_CANDIDATES,
        intentAbstractionLevel: 'OBSERVATION',
        governedEmbodiment: 'NOT_REQUIRED',
      });
      expect(decision.authorized).toBe(candidateId === 'POINT_SET' || candidateId === 'MATRIX_FIELD');
    }
  });

  it('validates graph identity, references and information contracts', () => {
    const graph: SemanticEmbodimentGraphV1 = {
      schemaVersion: 1, graphId: 'graph:1', datasetFingerprint: 'sha256:dataset',
      decisionId: 'decision:1', provenanceRef: 'evidence:1', rootNodeIds: ['dataset'],
      nodes: [
        { id: 'dataset', kind: 'DATASET', abstractionLevel: 'DATASET', childIds: ['population:a'], refinementTargetIds: ['population:a'], preserves: ['cluster-separation'], loses: [], evidenceRefs: ['evidence:structure'] },
        { id: 'population:a', kind: 'POPULATION', abstractionLevel: 'REGION', parentId: 'dataset', childIds: [], refinementTargetIds: [], preserves: ['cluster-separation'], loses: ['individual-observation-identity'], evidenceRefs: ['evidence:cluster:a'] },
      ],
    };
    expect(validateSemanticEmbodimentGraphV1(graph)).toEqual({ ok: true, errors: [] });
    const invalid: SemanticEmbodimentGraphV1 = { ...graph, nodes: [graph.nodes[0], { ...graph.nodes[1], loses: ['cluster-separation'] }] };
    expect(validateSemanticEmbodimentGraphV1(invalid).ok).toBe(false);
  });

  it('advertises versioned laboratory-facing semantic capabilities', () => {
    expect(NEMOSYNE_EXPERIMENT_SPECIMEN_CAPABILITIES.capabilities).toEqual(['semantic-embodiment-graph-v1', 'spatial-embodiment-plan-v1']);
  });
});
