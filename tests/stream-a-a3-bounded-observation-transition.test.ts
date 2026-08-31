import fs from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { AnalyticalExecutionPort } from '../src/atlas/ports/AnalyticalExecutionPort.ts';
import type { MonetaTopologyNode } from '../src/moneta/MonetaTopologyNode.ts';
import type { SemanticDetailEnvelopeV1 } from '../src/moneta/representation/SemanticDrillDown.ts';
import {
  SemanticDetailTransition,
  SEMANTIC_DETAIL_PRODUCT_PAGE_LIMIT_V1,
} from '../src/app/dataset/SemanticDetailTransition.ts';
import { SEMANTIC_DETAIL_OVERLAY_NAME } from '../src/vr/presentation/representation/SemanticDetailObservationOverlay.ts';
import { RepresentationSurface } from '../src/vr/presentation/representation/RepresentationSurface.ts';
import type { MonetaDiagnosticHUD } from '../src/vr/ui/MonetaDiagnosticHUD.ts';

const FP = 'a'.repeat(64);
const DECISION = 'decision-density-a3';

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
    provenance: { kernelVersion: 'test', algorithmVersion: 'test', decisionId: DECISION },
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

function detailEnvelope(generation = 7): SemanticDetailEnvelopeV1 {
  return {
    schemaVersion: 1,
    generation,
    request: {
      schemaVersion: 1,
      target: {
        datasetFingerprint: FP,
        decisionId: DECISION,
        representationFamily: 'DENSITY',
        semanticObjectId: 'density-cell:0-0',
      },
      limit: SEMANTIC_DETAIL_PRODUCT_PAGE_LIMIT_V1,
      offset: 0,
      investigationContext: 'test',
    },
    result: {
      status: 'READY',
      totalMemberCount: 2,
      returnedCount: 2,
      observationIds: ['obs-1', 'obs-2'],
      compactViews: [{ id: 'obs-1', x: 0.1, y: 0.1 }, { id: 'obs-2', x: 0.2, y: 0.2 }],
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

function portWith(value: SemanticDetailEnvelopeV1 | null, resident = true) {
  const execute = vi.fn(async (request) => ({
    requestId: request.requestId,
    generation: request.generation,
    datasetVersion: request.dataset.version,
    datasetFingerprint: request.dataset.fingerprint,
    value,
  }));
  const registerDataset = vi.fn(async () => undefined);
  const port = {
    isAsync: true,
    execute,
    supersede: vi.fn(),
    hasRegisteredDataset: vi.fn(() => resident),
    registerDataset,
  } as unknown as AnalyticalExecutionPort;
  return { port, execute, registerDataset };
}

function authority(port: AnalyticalExecutionPort) {
  return {
    executionPort: port,
    generation: 7,
    datasetVersion: 3,
    datasetFingerprint: FP,
    sessionId: 'investigation-a3',
  };
}

describe('Stream A A3 bounded observation transition', () => {
  it('reveals only the bounded Worker result while preserving the parent semantic structure', async () => {
    const node = fakeNode();
    const surface = surfaceFor(node);
    const { port, execute, registerDataset } = portWith(detailEnvelope());
    const transition = new SemanticDetailTransition(surface, authority(port));
    const parent = node.artifact!.nodeMeshes[0];

    surface.setSelectedMesh(parent);

    await vi.waitFor(() => expect(transition.snapshot.status).toBe('READY'));
    expect(execute).toHaveBeenCalledTimes(1);
    expect(registerDataset).not.toHaveBeenCalled();
    expect(execute.mock.calls[0][0]).toMatchObject({
      operation: 'semanticDetail',
      dataset: { fingerprint: FP, version: 3 },
      generation: 7,
      params: {
        request: {
          target: {
            datasetFingerprint: FP,
            decisionId: DECISION,
            representationFamily: 'DENSITY',
            semanticObjectId: 'density-cell:0-0',
          },
          limit: SEMANTIC_DETAIL_PRODUCT_PAGE_LIMIT_V1,
          offset: 0,
        },
        embodimentRequest: {
          candidateId: 'DENSITY_FIELD',
          measureFieldX: 'x',
          measureFieldY: 'y',
          binsX: 2,
          binsY: 2,
        },
      },
    });

    expect(node.group!.children).toContain(parent);
    const overlay = node.group!.children.find((child) => child.name === SEMANTIC_DETAIL_OVERLAY_NAME);
    expect(overlay).toBeTruthy();
    const batch = overlay!.children[0] as THREE.InstancedMesh;
    expect(batch.isInstancedMesh).toBe(true);
    expect(batch.count).toBe(2);
    expect(batch.userData.observationIds).toEqual(['obs-1', 'obs-2']);
    expect(overlay!.userData.candidateLocalDrawCalls).toBe(1);

    transition.dispose();
    surface.dispose();
  });

  it('uses re-selection as an explicit reverse step without querying or replacing the structure again', async () => {
    const node = fakeNode();
    const surface = surfaceFor(node);
    const { port, execute } = portWith(detailEnvelope());
    const transition = new SemanticDetailTransition(surface, authority(port));
    const parent = node.artifact!.nodeMeshes[0];

    surface.setSelectedMesh(parent);
    await vi.waitFor(() => expect(transition.snapshot.status).toBe('READY'));
    surface.setSelectedMesh(parent);

    expect(transition.snapshot.status).toBe('IDLE');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(node.group!.children).toContain(parent);
    expect(node.group!.children.some((child) => child.name === SEMANTIC_DETAIL_OVERLAY_NAME)).toBe(false);

    transition.dispose();
    surface.dispose();
  });

  it('fails closed when the authoritative dataset is not already resident instead of registering rows', async () => {
    const node = fakeNode();
    const surface = surfaceFor(node);
    const { port, execute, registerDataset } = portWith(detailEnvelope(), false);
    const transition = new SemanticDetailTransition(surface, authority(port));

    surface.setSelectedMesh(node.artifact!.nodeMeshes[0]);
    await Promise.resolve();

    expect(transition.snapshot.status).toBe('REFUSED');
    expect(transition.snapshot.refusalReason).toContain('not resident');
    expect(execute).not.toHaveBeenCalled();
    expect(registerDataset).not.toHaveBeenCalled();
    expect(node.group!.children.some((child) => child.name === SEMANTIC_DETAIL_OVERLAY_NAME)).toBe(false);

    transition.dispose();
    surface.dispose();
  });

  it('rejects stale or malformed READY envelopes rather than rendering an observation fallback', async () => {
    const node = fakeNode();
    const surface = surfaceFor(node);
    const malformed = detailEnvelope(6);
    const { port } = portWith(malformed);
    const transition = new SemanticDetailTransition(surface, authority(port));

    surface.setSelectedMesh(node.artifact!.nodeMeshes[0]);
    await vi.waitFor(() => expect(transition.snapshot.status).toBe('REFUSED'));

    expect(transition.snapshot.refusalReason).toContain('generation');
    expect(node.group!.children.some((child) => child.name === SEMANTIC_DETAIL_OVERLAY_NAME)).toBe(false);

    transition.dispose();
    surface.dispose();
  });

  it('does not treat distribution summary marks as member containers', async () => {
    const node = fakeNode();
    const mesh = node.artifact!.nodeMeshes[0];
    mesh.name = 'distribution-q:0.5';
    mesh.userData.semanticId = mesh.name;
    mesh.userData.representationKind = 'DISTRIBUTION_FIELD';
    (node as unknown as { dataInput: Record<string, unknown> }).dataInput.semanticEmbodiment = {
      ...densityEnvelope(),
      candidateId: 'DISTRIBUTION_FIELD',
      representationFamily: 'DISTRIBUTION',
      result: {
        status: 'READY',
        payload: {
          kind: 'EMPIRICAL_DISTRIBUTION',
          data: {
            measureField: 'x',
            domain: { min: 0, max: 1 },
            counts: { sourceCount: 2, validCount: 2, excludedCount: 0 },
            histogram: [{ semanticId: 'distribution-bin:000', lowerBound: 0, upperBound: 1, count: 2, upperInclusive: true }],
            ecdf: [{ semanticId: 'distribution-ecdf:000', value: 0, cumulativeCount: 1, cumulativeProbability: 0.5 }],
            quantiles: [{ semanticId: mesh.name, probability: 0.5, value: 0.5 }],
          },
        },
      },
    };
    (node as unknown as { representationDecision: Record<string, unknown> }).representationDecision = {
      id: DECISION,
      chosenCandidateId: 'DISTRIBUTION_FIELD',
    };
    const surface = surfaceFor(node);
    const { port, execute } = portWith(detailEnvelope());
    const transition = new SemanticDetailTransition(surface, authority(port));

    surface.setSelectedMesh(mesh);
    await Promise.resolve();

    expect(transition.snapshot.status).toBe('REFUSED');
    expect(execute).not.toHaveBeenCalled();

    transition.dispose();
    surface.dispose();
  });

  it('keeps the UI transition row-free and without a registration fallback', () => {
    const source = fs.readFileSync('src/app/dataset/SemanticDetailTransition.ts', 'utf8');
    expect(source).not.toContain('.rows');
    expect(source).not.toContain('dataset.toJSON');
    expect(source).not.toContain('registerDataset(');
    expect(source).toContain("operation: 'semanticDetail'");
    expect(source).toContain('hasRegisteredDataset');
  });
});
