import { describe, it, expect } from 'vitest';
import {
  ALL_REPRESENTATION_FAMILIES,
  LAYOUT_TO_FAMILY,
  FAMILY_TO_LAYOUTS,
  minimalDatasetSignature,
  type DatasetSignature,
  type RepresentationDecision,
} from '../src/moneta/index.ts';

describe('Phase 1: Representation Ontology Types', () => {
  it('defines 9 representation families', () => {
    expect(ALL_REPRESENTATION_FAMILIES).toHaveLength(9);
    expect(ALL_REPRESENTATION_FAMILIES).toContain('POINT');
    expect(ALL_REPRESENTATION_FAMILIES).toContain('DISTRIBUTION');
    expect(ALL_REPRESENTATION_FAMILIES).toContain('CLUSTER');
    expect(ALL_REPRESENTATION_FAMILIES).toContain('GRAPH');
    expect(ALL_REPRESENTATION_FAMILIES).toContain('FIELD');
    expect(ALL_REPRESENTATION_FAMILIES).toContain('TOPOLOGY');
    expect(ALL_REPRESENTATION_FAMILIES).toContain('TEMPORAL');
    expect(ALL_REPRESENTATION_FAMILIES).toContain('HIERARCHICAL');
    expect(ALL_REPRESENTATION_FAMILIES).toContain('FREQUENCY');
  });

  it('maps all VR layouts to a valid representation family', () => {
    const layouts = Object.keys(LAYOUT_TO_FAMILY) as Array<keyof typeof LAYOUT_TO_FAMILY>;
    expect(layouts.length).toBeGreaterThanOrEqual(6);

    for (const layout of layouts) {
      const family = LAYOUT_TO_FAMILY[layout];
      expect(ALL_REPRESENTATION_FAMILIES).toContain(family);
      expect(FAMILY_TO_LAYOUTS[family]).toContain(layout);
    }
  });

  it('provides reverse layout mappings for all 9 families', () => {
    for (const family of ALL_REPRESENTATION_FAMILIES) {
      const layouts = FAMILY_TO_LAYOUTS[family];
      expect(Array.isArray(layouts)).toBe(true);
      expect(layouts.length).toBeGreaterThan(0);
    }
  });

  it('constructs a valid minimal DatasetSignature', () => {
    const sig: DatasetSignature = minimalDatasetSignature(100, 4, 2, 1, 'fp-12345', 1000);
    expect(sig.schema.numericCount).toBe(4);
    expect(sig.schema.categoricalCount).toBe(2);
    expect(sig.schema.temporalCount).toBe(1);
    expect(sig.cardinality.rowCount).toBe(100);
    expect(sig.temporalStructure.isTimeSeries).toBe(true);
    expect(sig.provenance.datasetFingerprint).toBe('fp-12345');
    expect(sig.provenance.timestamp).toBe(1000);
    expect(sig.spectralStructure).toBeNull();
  });

  it('validates RepresentationDecision structure', () => {
    const sig = minimalDatasetSignature(50, 2, 1, 0);
    const decision: RepresentationDecision = {
      id: 'dec-1',
      representationFamily: 'POINT',
      confidence: 0.95,
      utilityScore: 8.5,
      evidence: [
        {
          fact: 'Tabular layout with no high correlation',
          weight: 0.8,
          supports: true,
          source: 'kernel',
        },
      ],
      rejectedAlternatives: [
        {
          family: 'TEMPORAL',
          score: 0.1,
          reason: 'No temporal columns',
          hardPassed: false,
        },
      ],
      embodiment: {
        spatialStrategy: {
          id: 'strat-1',
          worldType: 'ANALYST_COCKPIT',
          macroLayout: {
            layout: 'GRID_3D',
            parameters: {},
            positionSemantics: 'ALGORITHMIC_LAYOUT',
          },
          datumEncoding: {
            geometry: 'CUBE_MATRIX',
            mappings: {},
            behavior: 'STATIC',
          },
          interactionStrategy: {
            primaryInteraction: 'INSPECT_CELL',
            supportedGestures: ['pinch'],
            detailLens: 'INSPECTOR_SLATE',
          },
          score: 8.5,
          rationale: 'Optimal grid representation',
          rejectionLog: [],
          provenance: {
            generatedAt: 1000,
            engine: 'ConstraintArbiter',
            version: '1.0.0',
            datasetFingerprint: 'fp-1',
            requirementsHash: 'req-1',
          },
        },
        primaryLayout: 'GRID_3D',
        primaryGeometry: 'CUBE_MATRIX',
        primaryBehavior: 'STATIC',
        primaryInteraction: 'INSPECT_CELL',
      },
      scalePolicy: {
        maxRenderNodes: 50000,
        lodStrategy: 'INSTANCED_LOD',
        budgetTargetMs: 11.1,
      },
      progressiveDisclosurePolicy: {
        primaryFamily: 'POINT',
        secondaryFamilies: ['DISTRIBUTION'],
        defaultViewLevel: 'OVERVIEW',
      },
      datasetSignature: sig,
      provenance: {
        generatedAt: 1000,
        engine: 'RepresentationHypothesisEngine',
        version: '1.0.0',
        datasetFingerprint: 'fp-1',
        requirementsHash: 'req-1',
      },
    };

    expect(decision.representationFamily).toBe('POINT');
    expect(decision.evidence).toHaveLength(1);
    expect(decision.rejectedAlternatives).toHaveLength(1);
  });
});
