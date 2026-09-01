import * as THREE from 'three';
import { categoricalColor } from '../../data/Encodings.ts';
import type { Dataset } from '../../data/Dataset.ts';
import { computeForceDirectedEdges3d } from '../../wasm/LayoutAuthorityBridge.ts';
import type {
  GraphEmbodimentEnvelopeV1,
  RelationshipGraphPayloadV1,
} from '../representation/GraphEmbodimentPayload.ts';
import {
  MAX_RELATIONSHIP_GRAPH_EDGES_V1,
  MAX_RELATIONSHIP_GRAPH_NODES_V1,
} from '../representation/GraphEmbodimentPayload.ts';
import { setSemanticEmbodimentPresentationStatus } from './SemanticEmbodimentStatus.ts';

export const GRAPH_NODE_SURFACE_NAME = 'graph-semantic-nodes';
export const GRAPH_EDGE_SURFACE_NAME = 'graph-semantic-edges';

/**
 * Presentation-only force-layout seed. It never contributes to semantic
 * identity: node/edge IDs and adjacency come exclusively from the resident
 * payload, so any seed/algorithm change can only move marks, never topology.
 */
export const GRAPH_PRESENTATION_LAYOUT_SEED_V1 = 1;

function invalid(group: THREE.Group): void {
  setSemanticEmbodimentPresentationStatus(group, 'INVALID', undefined, 'RELATIONSHIP_GRAPH');
}

/**
 * Strict self-consistency re-validation of the transported payload. This is a
 * presentation-boundary check, not a second graph authority: any count, bound
 * or index inconsistency renders NO topology (INVALID) rather than a partial
 * or repaired graph.
 */
function validateGraphPayload(
  envelope: GraphEmbodimentEnvelopeV1,
  payload: RelationshipGraphPayloadV1
): boolean {
  if (!Array.isArray(payload.nodes) || !Array.isArray(payload.edges) || !payload.counts) {
    return false;
  }
  if (payload.nodes.length === 0) return false;
  if (payload.nodes.length > MAX_RELATIONSHIP_GRAPH_NODES_V1) return false;
  if (payload.edges.length > MAX_RELATIONSHIP_GRAPH_EDGES_V1) return false;
  if (envelope.resource.elementCount !== payload.edges.length) return false;
  if (payload.counts.retainedNodeCount !== payload.nodes.length) return false;
  if (payload.counts.retainedEdgeCount !== payload.edges.length) return false;
  if (payload.counts.sourceNodeCount !== payload.nodes.length) return false;
  // Mirror the Rust authority's own READY reconciliation: a source edge may
  // be neither silently dropped nor unaccounted at presentation time.
  if (payload.counts.sourceEdgeCount !== payload.edges.length) return false;
  if (payload.counts.refusedEdgeCount !== 0) return false;

  const nodeIds = new Set<string>();
  for (const node of payload.nodes) {
    if (typeof node.semanticId !== 'string' || node.semanticId.length === 0) return false;
    if (typeof node.sourceRowId !== 'string' || node.sourceRowId.length === 0) return false;
    if (nodeIds.has(node.semanticId)) return false;
    nodeIds.add(node.semanticId);
  }

  const edgeIds = new Set<string>();
  for (const edge of payload.edges) {
    if (typeof edge.semanticId !== 'string' || edge.semanticId.length === 0) return false;
    if (edgeIds.has(edge.semanticId)) return false;
    edgeIds.add(edge.semanticId);
    if (
      !Number.isSafeInteger(edge.sourceNodeIndex) ||
      !Number.isSafeInteger(edge.targetNodeIndex) ||
      edge.sourceNodeIndex < 0 ||
      edge.targetNodeIndex < 0 ||
      edge.sourceNodeIndex >= payload.nodes.length ||
      edge.targetNodeIndex >= payload.nodes.length
    ) {
      return false;
    }
    if (edge.weight !== undefined && !Number.isFinite(edge.weight)) return false;
  }
  return true;
}

/**
 * Translator-time staleness fence. The identity hash is the only thing this
 * adapter ever reads from the resident dataset: no row, column or edge value
 * enters presentation. A dataset whose identity cannot be established, or that
 * no longer matches the payload's fingerprint, renders NO topology.
 */
function currentDatasetFingerprint(dataset: Dataset | undefined): string | null {
  if (!dataset) return null;
  try {
    const fingerprint = dataset.fingerprint;
    return typeof fingerprint === 'string' && fingerprint.length > 0 ? fingerprint : null;
  } catch {
    return null;
  }
}

/**
 * Thin B3 presentation adapter for the Rust-owned source-relationship graph.
 *
 * Visible geometry is one instanced node mark per payload node plus one line
 * segment per payload edge, in exact payload order. Positions come from the
 * kernel force-directed solver over PAYLOAD adjacency only; layout, proximity
 * or correlation can never create, drop or reinterpret an edge here. No raw
 * source row payload is attached to any node or edge proxy.
 */
export function buildGraphSemanticTopology(
  group: THREE.Group,
  nodeMeshes: THREE.Mesh[],
  edgeMeshes: THREE.Line[],
  envelope: GraphEmbodimentEnvelopeV1 | null | undefined,
  dataset: Dataset | undefined
): void {
  if (!envelope) {
    setSemanticEmbodimentPresentationStatus(group, 'PENDING', undefined, 'RELATIONSHIP_GRAPH');
    return;
  }
  // Runtime-shape fence: a truthy but non-conforming transport value (an
  // unresolved promise, a torn payload, a foreign envelope) renders INVALID
  // rather than crashing the synthesis loop. The declared types are trusted
  // everywhere below this point.
  const shapedEnvelope = envelope as {
    schemaVersion?: unknown;
    result?: { status?: unknown; refusal?: { message?: unknown }; payload?: unknown } | null;
  };
  if (
    typeof envelope !== 'object' ||
    shapedEnvelope.schemaVersion !== 1 ||
    !shapedEnvelope.result ||
    typeof shapedEnvelope.result.status !== 'string'
  ) {
    invalid(group);
    return;
  }
  if (envelope.result.status === 'REFUSED') {
    if (
      typeof envelope.result.refusal?.message !== 'string' ||
      envelope.result.refusal.message.length === 0
    ) {
      invalid(group);
      return;
    }
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
    envelope.result.payload?.kind !== 'RELATIONSHIP_GRAPH'
  ) {
    invalid(group);
    return;
  }

  const payload = envelope.result.payload.data;
  if (!validateGraphPayload(envelope, payload)) {
    invalid(group);
    return;
  }

  if (currentDatasetFingerprint(dataset) !== envelope.datasetFingerprint) {
    invalid(group);
    return;
  }

  // Layout is a pure presentation transform over immutable semantic IDs: the
  // solver consumes payload node indexes and payload edges only.
  const indexedEdges = payload.edges.map((edge) => ({
    source: edge.sourceNodeIndex,
    target: edge.targetNodeIndex,
    weight: typeof edge.weight === 'number' && Number.isFinite(edge.weight) ? edge.weight : 1,
  }));
  const positions = computeForceDirectedEdges3d(
    payload.nodes.length,
    indexedEdges,
    120,
    120,
    0.02,
    0.08,
    4,
    1.2,
    GRAPH_PRESENTATION_LAYOUT_SEED_V1
  );
  if (!positions || positions.length !== payload.nodes.length * 3) {
    invalid(group);
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
    directionality: payload.directionality,
    analyticalMethod: envelope.analyticalMethod,
    approximation: envelope.approximation,
    informationContract: envelope.informationContract,
    provenance: envelope.provenance,
    presentationSemantics: 'force-directed-positioning-over-payload-topology',
    supportBoundaryClaim: false,
  };

  const nodeGeometry = new THREE.IcosahedronGeometry(0.11, 1);
  const nodeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.4,
    metalness: 0.12,
  });
  const nodeBatch = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, payload.nodes.length);
  nodeBatch.name = GRAPH_NODE_SURFACE_NAME;
  nodeBatch.userData = {
    ...commonMetadata,
    semanticNodeCount: payload.nodes.length,
    semanticEdgeCount: payload.edges.length,
    candidateLocalDrawCalls: 2,
    interactionModel: 'non-rendering-semantic-proxies',
  };

  const proxyGeometry = new THREE.BoxGeometry(1, 1, 1);
  const proxyMaterial = new THREE.MeshBasicMaterial();
  proxyMaterial.visible = false;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();

  const nodePositions: THREE.Vector3[] = [];
  payload.nodes.forEach((node, index) => {
    const position = new THREE.Vector3(
      positions[index * 3],
      positions[index * 3 + 1],
      positions[index * 3 + 2]
    );
    nodePositions.push(position);
    const color = new THREE.Color(categoricalColor(node.sourceRowId, index, 'none'));
    matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));
    nodeBatch.setMatrixAt(index, matrix);
    nodeBatch.setColorAt(index, color);

    const proxy = new THREE.Mesh(proxyGeometry, proxyMaterial);
    proxy.name = node.semanticId;
    proxy.position.copy(position);
    proxy.scale.setScalar(0.22);
    proxy.userData = {
      ...commonMetadata,
      semanticRole: 'node',
      semanticId: node.semanticId,
      sourceRowId: node.sourceRowId,
      nodeInstanceIndex: index,
      nodeInstanceBaseColor: color.getHex(),
      nonRenderingSemanticProxy: true,
      // Tooltip summary only: deliberately not the raw source row payload.
      row: { semanticRole: 'graph-node', sourceRowId: node.sourceRowId },
    };
    group.add(proxy);
    nodeMeshes.push(proxy);
  });

  nodeBatch.instanceMatrix.needsUpdate = true;
  if (nodeBatch.instanceColor) nodeBatch.instanceColor.needsUpdate = true;
  nodeBatch.computeBoundingBox();
  nodeBatch.computeBoundingSphere();
  group.add(nodeBatch);

  // One segment per payload edge, in payload order. A self-loop renders a
  // degenerate zero-length segment rather than an invented geometry.
  const segmentPositions: number[] = [];
  const segmentColors: number[] = [];
  payload.edges.forEach((edge, index) => {
    const source = nodePositions[edge.sourceNodeIndex];
    const target = nodePositions[edge.targetNodeIndex];
    segmentPositions.push(
      source.x, source.y, source.z,
      target.x, target.y, target.z
    );
    const sourceColor = nodeBatch.instanceColor
      ? new THREE.Color().fromBufferAttribute(nodeBatch.instanceColor, edge.sourceNodeIndex)
      : new THREE.Color(0x88ccff);
    segmentColors.push(
      sourceColor.r, sourceColor.g, sourceColor.b,
      sourceColor.r, sourceColor.g, sourceColor.b
    );

    const proxy = new THREE.Mesh(proxyGeometry, proxyMaterial);
    proxy.name = edge.semanticId;
    proxy.position.copy(source.clone().add(target).multiplyScalar(0.5));
    const span = source.distanceTo(target);
    proxy.scale.set(0.14, 0.14, Math.max(0.14, span));
    // A degenerate (self-loop) segment has no orientation to invent.
    if (span > 1e-9) proxy.lookAt(target);
    proxy.userData = {
      ...commonMetadata,
      semanticRole: 'edge',
      semanticId: edge.semanticId,
      edgePayloadIndex: index,
      sourceNodeSemanticId: payload.nodes[edge.sourceNodeIndex].semanticId,
      targetNodeSemanticId: payload.nodes[edge.targetNodeIndex].semanticId,
      sourceRowId: payload.nodes[edge.sourceNodeIndex].sourceRowId,
      targetRowId: payload.nodes[edge.targetNodeIndex].sourceRowId,
      weightPresent: typeof edge.weight === 'number',
      nonRenderingSemanticProxy: true,
      row: { semanticRole: 'graph-edge', edgePayloadIndex: index },
    };
    group.add(proxy);
    nodeMeshes.push(proxy);
  });

  const segmentGeometry = new THREE.BufferGeometry();
  segmentGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(segmentPositions, 3)
  );
  segmentGeometry.setAttribute('color', new THREE.Float32BufferAttribute(segmentColors, 3));
  const segmentMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.55,
  });
  const segments = new THREE.LineSegments(segmentGeometry, segmentMaterial);
  segments.name = GRAPH_EDGE_SURFACE_NAME;
  segments.userData = {
    ...commonMetadata,
    selectable: false,
    analyticalElement: false,
  };
  group.add(segments);
  edgeMeshes.push(segments);

  setSemanticEmbodimentPresentationStatus(group, 'READY', undefined, 'RELATIONSHIP_GRAPH');
  group.userData.semanticEmbodiment = {
    ...commonMetadata,
    candidateId: envelope.candidateId,
    resource: envelope.resource,
    counts: payload.counts,
  };
  group.userData.graphRenderSurface = {
    semanticNodeCount: payload.nodes.length,
    semanticEdgeCount: payload.edges.length,
    renderedBatchCount: 2,
    candidateLocalDrawCalls: 2,
    interactionProxyCount: nodeMeshes.length,
  };
}