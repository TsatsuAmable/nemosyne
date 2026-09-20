import { describe, expect, it } from 'vitest';
import { validateSpatialEmbodimentPlanV1 } from '../src/moneta/representation/SpatialEmbodimentPlanV1.ts';

describe('SpatialEmbodimentPlanV1 MCR0 validation', () => {
  it('accepts an explicit semantic -> representation -> spatial identity chain', () => {
    expect(
      validateSpatialEmbodimentPlanV1({
        schemaVersion: 1,
        planId: 'plan',
        semanticGraphId: 'semantic',
        datasetFingerprint: 'dataset',
        decisionId: 'decision',
        elements: [
          {
            id: 'spatial-1',
            semanticNodeId: 'semantic-1',
            representationPrimitiveId: 'representation-1',
            primitive: 'GLYPH',
            parameters: {},
          },
        ],
      })
    ).toEqual({ ok: true, errors: [] });
  });
  it('fails closed above the spatial element ceiling', () => {
    const elements = Array.from({ length: 1025 }, (_, i) => ({
      id: `e-${i}`,
      semanticNodeId: 's',
      representationPrimitiveId: 'r',
      primitive: 'GLYPH' as const,
      parameters: {},
    }));
    expect(
      validateSpatialEmbodimentPlanV1({
        schemaVersion: 1,
        planId: 'p',
        semanticGraphId: 's',
        datasetFingerprint: 'd',
        decisionId: 'x',
        elements,
      }).errors
    ).toContain('ELEMENT_BOUND_EXCEEDED');
  });
});
