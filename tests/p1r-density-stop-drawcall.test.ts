import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  buildDensitySemanticField,
  DENSITY_INSTANCED_SURFACE_NAME,
} from '../src/moneta/embodiment/DensitySemanticEmbodiment.ts';
import { TopologyInteractionOwner } from '../src/moneta/embodiment/TopologyInteractionOwner.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.ts';
import { disposeObject } from '../src/utils/Dispose.ts';

function envelope(): SemanticEmbodimentEnvelopeV1 {
  const grid = [
    { semanticId: 'density-cell:0:0', xIndex: 0, yIndex: 0, count: 0 },
    { semanticId: 'density-cell:1:0', xIndex: 1, yIndex: 0, count: 2 },
    { semanticId: 'density-cell:0:1', xIndex: 0, yIndex: 1, count: 4 },
    { semanticId: 'density-cell:1:1', xIndex: 1, yIndex: 1, count: 8 },
  ].map((cell) => ({
    ...cell,
    xLowerBound: cell.xIndex,
    xUpperBound: cell.xIndex + 1,
    yLowerBound: cell.yIndex,
    yUpperBound: cell.yIndex + 1,
    xUpperInclusive: cell.xIndex === 1,
    yUpperInclusive: cell.yIndex === 1,
  }));
  return {
    schemaVersion: 1,
    datasetFingerprint: 'f'.repeat(64),
    candidateId: 'DENSITY_FIELD',
    representationFamily: 'DENSITY',
    analyticalMethod: {
      name: 'bivariate-binned-density',
      version: 'binned-density-contract-v1',
      parameters: {
        binning: 'equal-width',
        interval: 'left-closed-right-open-final-closed',
        excludedPolicy: 'canonical-invalid-exclude-and-count',
        constantDomain: 'assign-final-bin-per-degenerate-axis',
      },
    },
    approximation: { mode: 'BINNED', representedRowCount: 14 },
    informationContract: {
      preserves: ['empirical-bivariate-bin-mass'],
      loses: ['individual-observation-identity', 'exact-metric-values'],
    },
    resource: { sourceRowCount: 14, elementCount: 4, maxElementCount: 400 },
    provenance: {
      kernelVersion: 'test-kernel',
      algorithmVersion: 'bivariate-binned-density-columnar-v1',
      decisionId: 'density-stop-drawcall',
      decisionModelVersion: 'bootstrap-fitness-v2',
    },
    result: {
      status: 'READY',
      payload: {
        kind: 'BINNED_DENSITY',
        data: {
          measureFieldX: 'x',
          measureFieldY: 'y',
          domainX: { min: 0, max: 2 },
          domainY: { min: 0, max: 2 },
          counts: { sourceCount: 14, validCount: 14, excludedCount: 0 },
          binsX: 2,
          binsY: 2,
          grid,
        },
      },
    },
  } as SemanticEmbodimentEnvelopeV1;
}

describe('P1-R2C density STOP draw-call fix-forward', () => {
  it('renders one instanced batch while retaining one semantic interaction proxy per Rust cell', () => {
    const group = new THREE.Group();
    const nodeMeshes: THREE.Mesh[] = [];
    const semantic = envelope();
    buildDensitySemanticField(group, nodeMeshes, semantic);
    try {
      expect(nodeMeshes).toHaveLength(semantic.resource.elementCount);
      expect(nodeMeshes.map((mesh) => mesh.name)).toEqual([
        'density-cell:0:0',
        'density-cell:1:0',
        'density-cell:0:1',
        'density-cell:1:1',
      ]);
      expect(
        nodeMeshes.every(
          (mesh) =>
            mesh.userData.nonRenderingSemanticProxy === true &&
            (mesh.material as THREE.Material).visible === false
        )
      ).toBe(true);

      const batch = group.getObjectByName(DENSITY_INSTANCED_SURFACE_NAME);
      expect(batch).toBeInstanceOf(THREE.InstancedMesh);
      expect((batch as THREE.InstancedMesh).count).toBe(4);
      expect(group.userData.densityRenderSurface).toEqual({
        semanticCellCount: 4,
        renderedBatchCount: 1,
        candidateLocalDrawCalls: 1,
        interactionProxyCount: 4,
      });
    } finally {
      disposeObject(group);
    }
  });

  it('routes proxy hover/select feedback to the matching visible density instance', () => {
    const group = new THREE.Group();
    const nodeMeshes: THREE.Mesh[] = [];
    buildDensitySemanticField(group, nodeMeshes, envelope());
    try {
      const batch = group.getObjectByName(DENSITY_INSTANCED_SURFACE_NAME) as THREE.InstancedMesh;
      const target = nodeMeshes[3];
      const base = new THREE.Color();
      const changed = new THREE.Color();
      batch.getColorAt(3, base);

      const interactions = new TopologyInteractionOwner({}).create(
        'INSPECT_CELL',
        group,
        nodeMeshes,
        []
      );
      interactions.onHover?.(target);
      batch.getColorAt(3, changed);
      expect(changed.getHex()).not.toBe(base.getHex());

      interactions.onUnhover?.(target);
      batch.getColorAt(3, changed);
      expect(changed.getHex()).toBe(base.getHex());

      interactions.onSelect?.(target);
      batch.getColorAt(3, changed);
      expect(changed.getHex()).not.toBe(base.getHex());
      expect(target.userData.semanticId).toBe('density-cell:1:1');
    } finally {
      disposeObject(group);
    }
  });
});
