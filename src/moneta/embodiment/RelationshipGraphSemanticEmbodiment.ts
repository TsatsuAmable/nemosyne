import * as THREE from 'three';
import type { SemanticEmbodimentEnvelopeV1 } from '../representation/SemanticEmbodimentPayload.ts';
import { setSemanticEmbodimentPresentationStatus } from './SemanticEmbodimentStatus.ts';

export const RELATIONSHIP_GRAPH_NODE_BATCH = 'relationship-graph-instanced-nodes';
export const RELATIONSHIP_GRAPH_EDGE_BATCH = 'relationship-graph-edge-segments';

function fibonacciPosition(index: number, count: number): THREE.Vector3 {
  if (count <= 1) return new THREE.Vector3(0, 0.5, 0);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (2 * (index + 0.5)) / count;
  const radial = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = goldenAngle * index;
  return new THREE.Vector3(
    Math.cos(theta) * radial * 2.5,
    y * 2.5 + 0.5,
    Math.sin(theta) * radial * 2.5
  );
}

/**
 * Thin R2E source-graph adapter. Rust owns which nodes/edges exist, endpoint
 * identity, weights, resource bounds and provenance. The Fibonacci sphere is a
 * deterministic presentation layout only; it does not infer relationships or
 * claim that spatial distance has analytical meaning.
 */
export function buildRelationshipGraphSemanticEmbodiment(
  group: THREE.Group,
  nodeMeshes: THREE.Mesh[],
  edgeMeshes: THREE.Line[],
  envelope: SemanticEmbodimentEnvelopeV1 | null | undefined
): void {
  if (!envelope) {
    setSemanticEmbodimentPresentationStatus(group, 'PENDING', undefined, 'RELATIONSHIP_GRAPH');
    return;
  }
  if (envelope.result.status === 'REFUSED') {
    setSemanticEmbodimentPresentationStatus(
      group,
      'REFUSED',
      envelope.result.refusal.message,
      'RELATIONSHIP_GRAPH'
    );
    group.userData.semanticEmbodimentRefusal = envelope.result.refusal;
    return;
  }
  if (
    envelope.candidateId !== 'RELATIONSHIP_GRAPH' ||
    envelope.representationFamily !== 'GRAPH' ||
    envelope.result.payload.kind !== 'RELATIONSHIP_GRAPH'
  ) {
    setSemanticEmbodimentPresentationStatus(group, 'INVALID', undefined, 'RELATIONSHIP_GRAPH');
    return;
  }

  const payload = envelope.result.payload.data;
  if (
    payload.nodes.length + payload.edges.length !== envelope.resource.elementCount ||
    envelope.resource.elementCount > envelope.resource.maxElementCount
  ) {
    setSemanticEmbodimentPresentationStatus(group, 'INVALID', undefined, 'RELATIONSHIP_GRAPH');
    return;
  }

  const artifactId = [
    'semantic-embodiment',
    envelope.datasetFingerprint,
    envelope.candidateId,
    envelope.provenance.algorithmVersion,
    envelope.provenance.decisionId ?? 'unbound-decision',
  ].join(':');
  const commonMetadata = {
    representationKind: 'RELATIONSHIP_GRAPH',
    payloadKind: 'RELATIONSHIP_GRAPH',
    artifactId,
    datasetFingerprint: envelope.datasetFingerprint,
    analyticalMethod: envelope.analyticalMethod,
    approximation: envelope.approximation,
    informationContract: envelope.informationContract,
    provenance: envelope.provenance,
    layoutSemantics: 'presentation-only-fibonacci-sphere',
  };

  const positions = new Map<string, THREE.Vector3>();
  payload.nodes.forEach((node, index) => {
    positions.set(node.semanticId, fibonacciPosition(index, payload.nodes.length));
  });

  if (payload.edges.length > 0) {
    const coordinates = new Float32Array(payload.edges.length * 6);
    payload.edges.forEach((edge, index) => {
      const source = positions.get(edge.sourceSemanticId);
      const target = positions.get(edge.targetSemanticId);
      if (!source || !target) return;
      const offset = index * 6;
      coordinates[offset] = source.x;
      coordinates[offset + 1] = source.y;
      coordinates[offset + 2] = source.z;
      coordinates[offset + 3] = target.x;
      coordinates[offset + 4] = target.y;
      coordinates[offset + 5] = target.z;
    });
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute('position', new THREE.BufferAttribute(coordinates, 3));
    const edgeMaterial = new THREE.LineBasicMaterial({
      transparent: true,
      opacity: 0.34,
    });
    const edgeBatch = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edgeBatch.name = RELATIONSHIP_GRAPH_EDGE_BATCH;
    edgeBatch.userData = {
      ...commonMetadata,
      semanticEdgeCount: payload.edges.length,
      candidateLocalDrawCalls: 1,
    };
    group.add(edgeBatch);
    edgeMeshes.push(edgeBatch as unknown as THREE.Line);
  }

  if (payload.nodes.length > 0) {
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.4,
      metalness: 0.16,
    });
    const batch = new THREE.InstancedMesh(geometry, material, payload.nodes.length);
    batch.name = RELATIONSHIP_GRAPH_NODE_BATCH;
    batch.userData = {
      ...commonMetadata,
      semanticNodeCount: payload.nodes.length,
      candidateLocalDrawCalls: 1,
      interactionModel: 'non-rendering-semantic-proxies',
    };

    const proxyGeometry = new THREE.IcosahedronGeometry(1, 1);
    const proxyMaterial = new THREE.MeshBasicMaterial();
    proxyMaterial.visible = false;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const maxDegree = Math.max(1, ...payload.nodes.map((node) => node.degree));

    payload.nodes.forEach((node, index) => {
      const position = positions.get(node.semanticId) ?? new THREE.Vector3();
      const radius = 0.08 + 0.15 * Math.sqrt(node.degree / maxDegree);
      scale.setScalar(radius);
      matrix.compose(position, quaternion, scale);
      batch.setMatrixAt(index, matrix);

      const proxy = new THREE.Mesh(proxyGeometry, proxyMaterial);
      proxy.name = node.semanticId;
      proxy.position.copy(position);
      proxy.scale.copy(scale);
      proxy.userData = {
        ...commonMetadata,
        semanticId: node.semanticId,
        sourceIdentity: node.sourceIdentity,
        degree: node.degree,
        row: { identity: node.sourceIdentity, degree: node.degree },
        relationshipInstanceIndex: index,
        nonRenderingSemanticProxy: true,
      };
      group.add(proxy);
      nodeMeshes.push(proxy);
    });

    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingBox();
    batch.computeBoundingSphere();
    group.add(batch);
  }

  setSemanticEmbodimentPresentationStatus(group, 'READY', undefined, 'RELATIONSHIP_GRAPH');
  group.userData.semanticEmbodiment = {
    ...commonMetadata,
    resource: envelope.resource,
    sourceEdgeCount: payload.sourceEdgeCount,
    semanticNodeCount: payload.nodes.length,
    semanticEdgeCount: payload.edges.length,
    candidateLocalDrawCalls: (payload.nodes.length > 0 ? 1 : 0) + (payload.edges.length > 0 ? 1 : 0),
  };
}
