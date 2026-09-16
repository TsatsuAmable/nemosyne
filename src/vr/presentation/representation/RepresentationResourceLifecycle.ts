import type { Mesh, Object3D } from 'three';

import type { MonetaTopologyNode } from '../../../moneta/MonetaTopologyNode.ts';
import { disposeObjectShallow } from '../../../utils/Dispose.ts';
import type {
  ResourceIdentity,
  ResourceLifecycleAdapter,
} from '../../scalability/ResourceLifecycleGovernor.ts';
import type { MonetaDiagnosticHUD } from '../../ui/MonetaDiagnosticHUD.ts';

const DESCRIPTOR_KEYS = [
  'schemaVersion',
  'datasetFingerprint',
  'datasetGeneration',
  'datasetVersion',
  'decisionId',
  'semanticId',
  'representationKind',
] as const;
const DESCRIPTOR_KEY_SET = new Set<PropertyKey>(DESCRIPTOR_KEYS);

export interface RepresentationColdDescriptorV1 {
  schemaVersion: 'representation-resource/v1';
  datasetFingerprint: string | null;
  datasetGeneration: number | null;
  datasetVersion: number | null;
  decisionId: string | null;
  semanticId: string;
  representationKind: string | null;
}

export interface RepresentationResourceRuntime {
  identity: ResourceIdentity;
  node: MonetaTopologyNode;
  diagnostic: MonetaDiagnosticHUD | null;
  disposalStack: Object3D[];
  diagnosticDisposed: boolean;
}

export interface RepresentationResourceDetachHooks {
  removeUpdatable(node: MonetaTopologyNode): void;
  removeInteractable(mesh: Mesh): void;
  removeDiagnosticPanel(panel: MonetaDiagnosticHUD): void;
  clearStructureHandles(): void;
}

export function createRepresentationResourceAdapter(
  hooks: RepresentationResourceDetachHooks
): ResourceLifecycleAdapter<RepresentationResourceRuntime, RepresentationColdDescriptorV1> {
  return {
    family: 'MONETA_REPRESENTATION',
    validateDescriptor: isRepresentationColdDescriptorV1,
    detach: (runtime) => detachRepresentation(runtime, hooks),
    coolStep: coolRepresentationStep,
    forceDispose: forceDisposeRepresentation,
  };
}

export function isRepresentationColdDescriptorV1(
  value: unknown
): value is RepresentationColdDescriptorV1 {
  if (typeof value !== 'object' || value === null) return false;

  try {
    if (Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== DESCRIPTOR_KEYS.length ||
      !keys.every((key) => DESCRIPTOR_KEY_SET.has(key))
    ) {
      return false;
    }
    if (
      !keys.every((key) => {
        const property = Object.getOwnPropertyDescriptor(value, key);
        return property !== undefined && 'value' in property && property.enumerable;
      })
    ) {
      return false;
    }

    const descriptor = value as Record<(typeof DESCRIPTOR_KEYS)[number], unknown>;
    return (
      descriptor.schemaVersion === 'representation-resource/v1' &&
      isNullableString(descriptor.datasetFingerprint) &&
      isNullableSafeInteger(descriptor.datasetGeneration) &&
      isNullableSafeInteger(descriptor.datasetVersion) &&
      isNullableString(descriptor.decisionId) &&
      typeof descriptor.semanticId === 'string' &&
      isNullableString(descriptor.representationKind)
    );
  } catch {
    return false;
  }
}

function detachRepresentation(
  runtime: RepresentationResourceRuntime,
  hooks: RepresentationResourceDetachHooks
): void {
  const { node, diagnostic } = runtime;
  node.cancelPendingSemanticEmbodiment();
  hooks.clearStructureHandles();

  if (node.artifact) {
    for (const mesh of node.artifact.nodeMeshes) hooks.removeInteractable(mesh);
  }
  hooks.removeUpdatable(node);
  if (diagnostic) hooks.removeDiagnosticPanel(diagnostic);

  if (node.group?.parent) node.group.parent.remove(node.group);
  const diagnosticGroup = diagnostic?.mesh;
  if (diagnosticGroup?.parent) diagnosticGroup.parent.remove(diagnosticGroup);
}

function coolRepresentationStep(
  runtime: RepresentationResourceRuntime
): ReturnType<
  ResourceLifecycleAdapter<
    RepresentationResourceRuntime,
    RepresentationColdDescriptorV1
  >['coolStep']
> {
  const object = runtime.disposalStack.pop();
  if (object) {
    runtime.disposalStack.push(...object.children.slice());
    disposeObjectShallow(object);
    return hasRemainingWork(runtime) ? { status: 'PENDING' } : completeCooling(runtime);
  }

  if (runtime.diagnostic && !runtime.diagnosticDisposed) {
    runtime.diagnostic.dispose();
    runtime.diagnosticDisposed = true;
    return completeCooling(runtime);
  }

  return completeCooling(runtime);
}

function forceDisposeRepresentation(runtime: RepresentationResourceRuntime): void {
  let object = runtime.disposalStack.pop();
  while (object) {
    runtime.disposalStack.push(...object.children.slice());
    disposeObjectShallow(object);
    object = runtime.disposalStack.pop();
  }

  if (runtime.diagnostic && !runtime.diagnosticDisposed) {
    runtime.diagnostic.dispose();
    runtime.diagnosticDisposed = true;
  }
}

function hasRemainingWork(runtime: RepresentationResourceRuntime): boolean {
  return (
    runtime.disposalStack.length > 0 || (runtime.diagnostic !== null && !runtime.diagnosticDisposed)
  );
}

function completeCooling(runtime: RepresentationResourceRuntime): {
  status: 'COMPLETE';
  descriptor: RepresentationColdDescriptorV1;
} {
  const { identity, node } = runtime;
  return {
    status: 'COMPLETE',
    descriptor: {
      schemaVersion: 'representation-resource/v1',
      datasetFingerprint: identity.datasetFingerprint,
      datasetGeneration: identity.datasetGeneration,
      datasetVersion: identity.datasetVersion,
      decisionId: identity.decisionId,
      semanticId: identity.semanticId,
      representationKind: node.representationDecision?.chosenCandidateId ?? null,
    },
  };
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableSafeInteger(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isSafeInteger(value));
}
