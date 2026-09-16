import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

import type { MonetaTopologyNode } from '../src/moneta/MonetaTopologyNode.ts';
import { disposeObject, disposeObjectShallow } from '../src/utils/Dispose.ts';
import { sharedSphereGeometry } from '../src/utils/ObjectPool.ts';
import type { MonetaDiagnosticHUD } from '../src/vr/ui/MonetaDiagnosticHUD.ts';
import {
  createRepresentationResourceAdapter,
  type RepresentationResourceDetachHooks,
  type RepresentationResourceRuntime,
} from '../src/vr/presentation/representation/RepresentationResourceLifecycle.ts';
import type { ResourceIdentity } from '../src/vr/scalability/ResourceLifecycleGovernor.ts';

const identity: ResourceIdentity = {
  family: 'MONETA_REPRESENTATION',
  datasetFingerprint: 'dataset-fingerprint',
  datasetGeneration: 4,
  datasetVersion: 7,
  decisionId: 'decision-1',
  semanticId: 'representation:decision-1:projection:2',
};

interface RuntimeFixture {
  runtime: RepresentationResourceRuntime;
  root: THREE.Object3D;
  node: MonetaTopologyNode;
  diagnostic: MonetaDiagnosticHUD | null;
  hooks: RepresentationResourceDetachHooks;
}

function createRuntimeFixture(
  options: {
    root?: THREE.Object3D;
    diagnostic?: boolean;
    dataInput?: Record<string, unknown>;
  } = {}
): RuntimeFixture {
  const root = options.root ?? new THREE.Group();
  const node = {
    dataInput: options.dataInput ?? {},
    group: root,
    artifact: {
      group: root,
      nodeMeshes: root.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh),
    },
    representationDecision: { chosenCandidateId: 'RELATIONSHIP_GRAPH' },
    cancelPendingSemanticEmbodiment: vi.fn(),
  } as unknown as MonetaTopologyNode;

  let diagnostic: MonetaDiagnosticHUD | null = null;
  if (options.diagnostic !== false) {
    const diagnosticGroup = new THREE.Group() as THREE.Group & {
      readonly mesh: THREE.Object3D;
      dispose: ReturnType<typeof vi.fn>;
    };
    Object.defineProperty(diagnosticGroup, 'mesh', {
      configurable: true,
      get: () => diagnosticGroup,
    });
    diagnosticGroup.dispose = vi.fn();
    diagnostic = diagnosticGroup as unknown as MonetaDiagnosticHUD;
  }

  const hooks: RepresentationResourceDetachHooks = {
    removeUpdatable: vi.fn(),
    removeInteractable: vi.fn(),
    removeDiagnosticPanel: vi.fn(),
    clearStructureHandles: vi.fn(),
  };

  return {
    root,
    node,
    diagnostic,
    hooks,
    runtime: {
      identity: { ...identity },
      node,
      diagnostic,
      disposalStack: [root],
      diagnosticDisposed: false,
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('representation resource lifecycle', () => {
  it('disposes only the named object in a shallow disposal work unit', () => {
    const parent = new THREE.Group();
    const childGeometry = new THREE.BoxGeometry();
    const child = new THREE.Mesh(childGeometry, new THREE.MeshBasicMaterial());
    const childGeometryDispose = vi.spyOn(childGeometry, 'dispose');
    parent.add(child);

    disposeObjectShallow(parent);

    expect(childGeometryDispose).not.toHaveBeenCalled();
    expect(child.parent).toBe(parent);
  });

  it('preserves recursive disposal and shared pooled geometry protection', () => {
    const parent = new THREE.Group();
    const childGeometry = new THREE.BoxGeometry();
    const child = new THREE.Mesh(childGeometry, new THREE.MeshBasicMaterial());
    const childGeometryDispose = vi.spyOn(childGeometry, 'dispose');
    const sharedGeometryDispose = vi.spyOn(sharedSphereGeometry, 'dispose');
    const pooledMesh = new THREE.Mesh(sharedSphereGeometry, new THREE.MeshBasicMaterial());
    parent.add(child, pooledMesh);

    disposeObject(parent);

    expect(childGeometryDispose).toHaveBeenCalledTimes(1);
    expect(sharedGeometryDispose).not.toHaveBeenCalled();
    expect(child.parent).toBeNull();
    expect(pooledMesh.parent).toBeNull();
  });

  it('produces only the fixed primitive cold descriptor despite forbidden source sentinels', async () => {
    const forbiddenDataset = new Proxy(
      { secret: 'dataset-must-not-survive' },
      {
        get() {
          throw new Error('cold descriptor read Dataset');
        },
        ownKeys() {
          throw new Error('cold descriptor enumerated Dataset');
        },
      }
    );
    const forbiddenRows = new Proxy([{ secret: 'rows-must-not-survive' }], {
      get() {
        throw new Error('cold descriptor read rows');
      },
      ownKeys() {
        throw new Error('cold descriptor enumerated rows');
      },
    });
    const fixture = createRuntimeFixture({
      diagnostic: false,
      dataInput: {
        dataset: forbiddenDataset,
        rows: forbiddenRows,
        workerPayload: { secret: 'worker-payload-must-not-survive' },
        semanticEmbodimentPromise: Promise.resolve(null),
      },
    });
    const adapter = createRepresentationResourceAdapter(fixture.hooks);

    const completion = await adapter.coolStep(fixture.runtime);

    if (completion.status !== 'COMPLETE') throw new Error('cooling should be complete');

    expect(completion).toEqual({
      status: 'COMPLETE',
      descriptor: {
        schemaVersion: 'representation-resource/v1',
        datasetFingerprint: 'dataset-fingerprint',
        datasetGeneration: 4,
        datasetVersion: 7,
        decisionId: 'decision-1',
        semanticId: 'representation:decision-1:projection:2',
        representationKind: 'RELATIONSHIP_GRAPH',
      },
    });
    expect(Reflect.ownKeys(completion.descriptor)).toEqual([
      'schemaVersion',
      'datasetFingerprint',
      'datasetGeneration',
      'datasetVersion',
      'decisionId',
      'semanticId',
      'representationKind',
    ]);
    expect(
      Object.values(completion.descriptor).every(
        (value) => value === null || ['string', 'number'].includes(typeof value)
      )
    ).toBe(true);
  });

  it('rejects descriptor extras, object-bearing values, and wrong primitive types', () => {
    const fixture = createRuntimeFixture({ diagnostic: false });
    const adapter = createRepresentationResourceAdapter(fixture.hooks);
    const valid = {
      schemaVersion: 'representation-resource/v1',
      datasetFingerprint: 'dataset-fingerprint',
      datasetGeneration: 4,
      datasetVersion: 7,
      decisionId: 'decision-1',
      semanticId: 'representation:decision-1:projection:2',
      representationKind: 'RELATIONSHIP_GRAPH',
    } as const;
    const reorderedValid = {
      representationKind: 'RELATIONSHIP_GRAPH',
      semanticId: 'representation:decision-1:projection:2',
      decisionId: 'decision-1',
      datasetVersion: 7,
      datasetGeneration: 4,
      datasetFingerprint: 'dataset-fingerprint',
      schemaVersion: 'representation-resource/v1',
    } as const;

    expect(adapter.validateDescriptor(valid)).toBe(true);
    expect(adapter.validateDescriptor(reorderedValid)).toBe(true);
    expect(adapter.validateDescriptor({ ...valid, family: 'MONETA_REPRESENTATION' })).toBe(false);
    expect(adapter.validateDescriptor({ ...valid, dataset: { rows: [] } })).toBe(false);
    expect(adapter.validateDescriptor({ ...valid, datasetFingerprint: { value: 'fp' } })).toBe(
      false
    );
    expect(adapter.validateDescriptor({ ...valid, datasetGeneration: '4' })).toBe(false);
    expect(adapter.validateDescriptor({ ...valid, datasetVersion: Number.NaN })).toBe(false);
    expect(adapter.validateDescriptor({ ...valid, semanticId: null })).toBe(false);

    const symbolBearing = { ...valid, [Symbol('hidden')]: { rows: [] } };
    expect(adapter.validateDescriptor(symbolBearing)).toBe(false);

    const getterBearing = { ...valid };
    Object.defineProperty(getterBearing, 'semanticId', {
      enumerable: true,
      get: () => valid.semanticId,
    });
    expect(adapter.validateDescriptor(getterBearing)).toBe(false);
  });

  it('performs at most one disposal work unit per coolStep', () => {
    const parentGeometry = new THREE.BoxGeometry();
    const childGeometry = new THREE.SphereGeometry();
    const parent = new THREE.Mesh(parentGeometry, new THREE.MeshBasicMaterial());
    const child = new THREE.Mesh(childGeometry, new THREE.MeshBasicMaterial());
    parent.add(child);
    const parentGeometryDispose = vi.spyOn(parentGeometry, 'dispose');
    const childGeometryDispose = vi.spyOn(childGeometry, 'dispose');
    const fixture = createRuntimeFixture({ root: parent, diagnostic: false });
    const adapter = createRepresentationResourceAdapter(fixture.hooks);

    expect(adapter.coolStep(fixture.runtime)).toEqual({ status: 'PENDING' });
    expect(parentGeometryDispose).toHaveBeenCalledTimes(1);
    expect(childGeometryDispose).not.toHaveBeenCalled();

    expect(adapter.coolStep(fixture.runtime)).toEqual(
      expect.objectContaining({ status: 'COMPLETE' })
    );
    expect(parentGeometryDispose).toHaveBeenCalledTimes(1);
    expect(childGeometryDispose).toHaveBeenCalledTimes(1);
  });

  it('forceDispose drains remaining presentation units once and is idempotent', () => {
    const parentGeometry = new THREE.BoxGeometry();
    const childGeometry = new THREE.SphereGeometry();
    const parent = new THREE.Mesh(parentGeometry, new THREE.MeshBasicMaterial());
    const child = new THREE.Mesh(childGeometry, new THREE.MeshBasicMaterial());
    parent.add(child);
    const parentGeometryDispose = vi.spyOn(parentGeometry, 'dispose');
    const childGeometryDispose = vi.spyOn(childGeometry, 'dispose');
    const fixture = createRuntimeFixture({ root: parent });
    const diagnosticDispose = vi.spyOn(fixture.diagnostic!, 'dispose');
    const adapter = createRepresentationResourceAdapter(fixture.hooks);

    adapter.forceDispose(fixture.runtime);
    adapter.forceDispose(fixture.runtime);

    expect(parentGeometryDispose).toHaveBeenCalledTimes(1);
    expect(childGeometryDispose).toHaveBeenCalledTimes(1);
    expect(diagnosticDispose).toHaveBeenCalledTimes(1);
    expect(fixture.runtime.disposalStack).toEqual([]);
    expect(fixture.runtime.diagnosticDisposed).toBe(true);
  });

  it('detach removes presentation authority without disposing either tree', () => {
    const scene = new THREE.Scene();
    const analystAnchor = new THREE.Group();
    const geometry = new THREE.BoxGeometry();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    const root = new THREE.Group();
    root.add(mesh);
    scene.add(root);
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const fixture = createRuntimeFixture({ root });
    analystAnchor.add(fixture.diagnostic!.mesh);
    const diagnosticDispose = vi.spyOn(fixture.diagnostic!, 'dispose');
    const adapter = createRepresentationResourceAdapter(fixture.hooks);

    adapter.detach(fixture.runtime);

    expect(fixture.node.cancelPendingSemanticEmbodiment).toHaveBeenCalledTimes(1);
    expect(fixture.hooks.clearStructureHandles).toHaveBeenCalledTimes(1);
    expect(fixture.hooks.removeInteractable).toHaveBeenCalledTimes(1);
    expect(fixture.hooks.removeInteractable).toHaveBeenCalledWith(mesh);
    expect(fixture.hooks.removeUpdatable).toHaveBeenCalledWith(fixture.node);
    expect(fixture.hooks.removeDiagnosticPanel).toHaveBeenCalledWith(fixture.diagnostic);
    expect(root.parent).toBeNull();
    expect(fixture.diagnostic!.mesh.parent).toBeNull();
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(diagnosticDispose).not.toHaveBeenCalled();
  });
});
