import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { AnalyticalExecutionPort } from '../src/atlas/ports/AnalyticalExecutionPort.ts';
import type { MonetaTopologyNode } from '../src/moneta/MonetaTopologyNode.ts';
import type { SemanticDetailEnvelopeV1 } from '../src/moneta/representation/SemanticDrillDown.ts';
import {
  SEMANTIC_DETAIL_PRODUCT_PAGE_LIMIT_V1,
  SemanticDetailTransition,
  type SemanticDetailAuthority,
} from '../src/app/dataset/SemanticDetailTransition.ts';
import { RepresentationSurface } from '../src/vr/presentation/representation/RepresentationSurface.ts';
import type { MonetaDiagnosticHUD } from '../src/vr/ui/MonetaDiagnosticHUD.ts';

const FP = 'a'.repeat(64);
const DECISION = 'decision-a4-exact-datum';
const MODEL_HASH = 'b'.repeat(64);

function densityEnvelope() {
  return {
    schemaVersion: 1 as const,
    datasetFingerprint: FP,
    candidateId: 'DENSITY_FIELD' as const,
    representationFamily: 'DENSITY' as const,
    analyticalMethod: {
      name: 'bivariate-binned-density',
      version: 'binned-density-contract-v1',
      parameters: {},
    },
    approximation: { mode: 'BINNED' as const, representedRowCount: 2 },
    informationContract: { preserves: [], loses: [] },
    resource: { sourceRowCount: 2, elementCount: 4, maxElementCount: 400 },
    provenance: {
      kernelVersion: 'kernel-a4',
      algorithmVersion: 'binned-density-contract-v1',
      decisionId: DECISION,
      decisionModelVersion: 'model-a4',
      decisionModelArtifactHash: MODEL_HASH,
    },
    result: {
      status: 'READY' as const,
      payload: {
        kind: 'BINNED_DENSITY' as const,
        data: {
          measureFieldX: 'x',
          measureFieldY: 'y',
          domainX: { min: 0, max: 1 },
          domainY: { min: 0, max: 1 },
          counts: { sourceCount: 2, validCount: 2, excludedCount: 0 },
          grid: [],
          binsX: 2,
          binsY: 2,
        },
      },
    },
  };
}

function detailEnvelope(
  observationIds: string[],
  compactViews: Record<string, unknown>[] | undefined,
  limit: number,
  offset: number,
): SemanticDetailEnvelopeV1 {
  return {
    schemaVersion: 1,
    generation: 7,
    request: {
      schemaVersion: 1,
      target: {
        datasetFingerprint: FP,
        decisionId: DECISION,
        representationFamily: 'DENSITY',
        semanticObjectId: 'density-cell:0-0',
      },
      limit,
      offset,
      investigationContext: 'worker-owned-test-context',
    },
    result: {
      status: 'READY',
      totalMemberCount: 2,
      returnedCount: observationIds.length,
      observationIds,
      ...(compactViews ? { compactViews } : {}),
    },
  };
}

function fakeNode(): MonetaTopologyNode {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  mesh.name = 'density-cell:0-0';
  mesh.userData = {
    semanticId: 'density-cell:0-0',
    datasetFingerprint: FP,
    representationKind: 'DENSITY_FIELD',
    provenance: { decisionId: DECISION },
  };
  group.add(mesh);
  return {
    dataInput: { topology: 'TABULAR', semanticEmbodiment: densityEnvelope() },
    representationDecision: { id: DECISION, chosenCandidateId: 'DENSITY_FIELD' },
    artifact: { group, nodeMeshes: [mesh], edgeMeshes: [], behaviors: [], interactions: {} },
    group,
    reSolveAndSynthesize: vi.fn(),
    cancelPendingSemanticEmbodiment: vi.fn(),
  } as unknown as MonetaTopologyNode;
}

function diagnostic(): MonetaDiagnosticHUD {
  return {
    mesh: new THREE.Group(),
    dispose: vi.fn(),
    render: vi.fn(),
  } as unknown as MonetaDiagnosticHUD;
}

function surfaceFor(node: MonetaTopologyNode): RepresentationSurface {
  const dependencies = {
    scene: new THREE.Scene(),
    cameraGroup: new THREE.Group(),
    analystAnchor: new THREE.Group(),
    getColorblindMode: () => 'none',
    getFactProvider: () => ({ facts: () => null }),
    addUpdatable: vi.fn(),
    removeUpdatable: vi.fn(),
    addInteractable: vi.fn(),
    removeInteractable: vi.fn(),
    addDiagnosticPanel: vi.fn(),
    removeDiagnosticPanel: vi.fn(),
    setTooltipTargets: vi.fn(),
    clearStructureHandles: vi.fn(),
    rebuildStructureHandles: vi.fn(),
    onSelectNode: vi.fn(),
  };
  const surface = new RepresentationSurface(dependencies, {
    createNode: () => node,
    createDiagnostic: () => diagnostic(),
  });
  surface.replace({ topology: 'TABULAR' }, null);
  return surface;
}

function sequencedPort(values: SemanticDetailEnvelopeV1[]) {
  const execute = vi.fn(async (request) => {
    const value = values.shift() ?? null;
    return {
      requestId: request.requestId,
      generation: request.generation,
      datasetVersion: request.dataset.version,
      datasetFingerprint: request.dataset.fingerprint,
      value,
    };
  });
  return {
    port: {
      isAsync: true,
      execute,
      supersede: vi.fn(),
      hasRegisteredDataset: vi.fn(() => true),
    } as unknown as AnalyticalExecutionPort,
    execute,
  };
}

function authority(port: AnalyticalExecutionPort): SemanticDetailAuthority {
  return {
    executionPort: port,
    generation: 7,
    datasetVersion: 3,
    datasetFingerprint: FP,
    sessionId: 'investigation-a4',
  };
}

describe('Stream A A4 exact datum/provenance inspection', () => {
  it('re-queries exactly one selected observation instead of reading the overview compact view', async () => {
    const node = fakeNode();
    const surface = surfaceFor(node);
    const overview = detailEnvelope(
      ['obs-1', 'obs-2'],
      [{ previewOnly: 'one' }, { previewOnly: 'two' }],
      SEMANTIC_DETAIL_PRODUCT_PAGE_LIMIT_V1,
      0,
    );
    const exact = detailEnvelope(['obs-2'], [{ x: 0.75, y: 0.25, label: 'exact' }], 1, 1);
    const { port, execute } = sequencedPort([overview, exact]);
    const transition = new SemanticDetailTransition(surface, authority(port));

    surface.setSelectedMesh(node.artifact!.nodeMeshes[0]);
    await vi.waitFor(() => expect(transition.snapshot.status).toBe('READY'));
    expect(transition.snapshot.observationIds).toEqual(['obs-1', 'obs-2']);

    const inspection = await transition.inspectObservation('obs-2');

    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[1][0]).toMatchObject({
      operation: 'semanticDetail',
      generation: 7,
      dataset: { fingerprint: FP, version: 3 },
      params: {
        request: {
          target: {
            datasetFingerprint: FP,
            decisionId: DECISION,
            representationFamily: 'DENSITY',
            semanticObjectId: 'density-cell:0-0',
          },
          limit: 1,
          offset: 1,
        },
      },
    });
    expect(inspection).toMatchObject({
      status: 'READY',
      observationId: 'obs-2',
      fields: { x: 0.75, y: 0.25, label: 'exact' },
      lineage: {
        datasetFingerprint: FP,
        observationId: 'obs-2',
        decisionId: DECISION,
        representationFamily: 'DENSITY',
        semanticObjectId: 'density-cell:0-0',
        generation: 7,
        datasetVersion: 3,
        kernelVersion: 'kernel-a4',
        algorithmVersion: 'binned-density-contract-v1',
        decisionModelVersion: 'model-a4',
        decisionModelArtifactHash: MODEL_HASH,
      },
      sourceProvenance: { status: 'UNAVAILABLE' },
    });
    if (inspection.status === 'READY') {
      expect(inspection.fields).not.toHaveProperty('previewOnly');
      expect(inspection.sourceProvenance.status).toBe('UNAVAILABLE');
    }

    transition.dispose();
    surface.dispose();
  });

  it('refuses observation IDs outside the active bounded page without querying the Worker', async () => {
    const node = fakeNode();
    const surface = surfaceFor(node);
    const overview = detailEnvelope(['obs-1'], undefined, SEMANTIC_DETAIL_PRODUCT_PAGE_LIMIT_V1, 0);
    const { port, execute } = sequencedPort([overview]);
    const transition = new SemanticDetailTransition(surface, authority(port));

    surface.setSelectedMesh(node.artifact!.nodeMeshes[0]);
    await vi.waitFor(() => expect(transition.snapshot.status).toBe('READY'));

    const inspection = await transition.inspectObservation('foreign-observation');
    expect(inspection).toEqual({
      status: 'REFUSED',
      observationId: 'foreign-observation',
      reason: 'observation is not in the active bounded detail page',
    });
    expect(execute).toHaveBeenCalledTimes(1);

    transition.dispose();
    surface.dispose();
  });

  it('fails closed when the exact query returns a different observation identity', async () => {
    const node = fakeNode();
    const surface = surfaceFor(node);
    const overview = detailEnvelope(['obs-1', 'obs-2'], undefined, SEMANTIC_DETAIL_PRODUCT_PAGE_LIMIT_V1, 0);
    const wrongExact = detailEnvelope(['obs-1'], [{ x: 0.1 }], 1, 1);
    const { port } = sequencedPort([overview, wrongExact]);
    const transition = new SemanticDetailTransition(surface, authority(port));

    surface.setSelectedMesh(node.artifact!.nodeMeshes[0]);
    await vi.waitFor(() => expect(transition.snapshot.status).toBe('READY'));

    const inspection = await transition.inspectObservation('obs-2');
    expect(inspection).toEqual({
      status: 'REFUSED',
      observationId: 'obs-2',
      reason: 'exact datum query did not return the selected observation',
    });

    transition.dispose();
    surface.dispose();
  });

  it('refuses exact inspection after semantic context is cleared', async () => {
    const node = fakeNode();
    const surface = surfaceFor(node);
    const overview = detailEnvelope(['obs-1'], undefined, SEMANTIC_DETAIL_PRODUCT_PAGE_LIMIT_V1, 0);
    const { port, execute } = sequencedPort([overview]);
    const transition = new SemanticDetailTransition(surface, authority(port));

    surface.setSelectedMesh(node.artifact!.nodeMeshes[0]);
    await vi.waitFor(() => expect(transition.snapshot.status).toBe('READY'));
    transition.clear();

    const inspection = await transition.inspectObservation('obs-1');
    expect(inspection.status).toBe('REFUSED');
    expect(execute).toHaveBeenCalledTimes(1);

    transition.dispose();
    surface.dispose();
  });
});
