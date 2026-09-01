import * as THREE from 'three';
import type { Finding, Observation } from '../../../atlas/types.ts';
import type {
  InvestigationEdge,
  InvestigationNode,
} from '../../../atlas/domain/InvestigationGraph.ts';
import {
  EPISTEMIC_COLORS,
  EPISTEMIC_CUES,
  type EpistemicObjectKind,
} from '../../../memory/EpistemicObject.ts';
import { disposeObject } from '../../../utils/Dispose.ts';

export const MAX_MEMORY_PALACE_OBJECTS = 48;
export const MAX_MEMORY_PALACE_RELATIONSHIPS = 24;

export interface MemoryPalaceProjectionSource {
  sessionId: string;
  researchQuestion?: string;
  hypothesis?: string;
  nodes: readonly InvestigationNode[];
  edges: readonly InvestigationEdge[];
  activeNodeId: string | null;
  observations: readonly Observation[];
  findings: readonly Finding[];
}

interface ProjectedEpistemicObject {
  id: string;
  kind: EpistemicObjectKind;
  title: string;
  description: string;
  sourceKind: string;
  explicitPosition?: readonly [number, number, number];
}

export interface MemoryPalaceWorldViewHost {
  scene: THREE.Scene;
  addInteractable(
    object: THREE.Object3D,
    handlers: {
      onSelect?: (mesh: THREE.Object3D) => void;
      semantic?: { kind: 'investigation-artifact'; structureId?: string; salience?: number };
    },
  ): void;
  removeInteractable(object: THREE.Object3D): void;
  registerTooltipTarget(object: THREE.Object3D): void;
  unregisterTooltipTarget(object: THREE.Object3D): void;
}

function authoritativeKind(node: InvestigationNode): EpistemicObjectKind | null {
  const explicit = node.metadata?.epistemicKind;
  if (
    explicit === 'notice' ||
    explicit === 'question' ||
    explicit === 'hypothesis' ||
    explicit === 'test' ||
    explicit === 'finding' ||
    explicit === 'contradiction' ||
    explicit === 'branch_point'
  ) {
    return explicit;
  }

  switch (node.kind) {
    case 'question':
      return 'question';
    case 'operation':
      return 'test';
    case 'observation':
    case 'evidence_item':
      return 'notice';
    case 'finding':
    case 'conclusion':
      return 'finding';
    default:
      return null;
  }
}

function geometryFor(kind: EpistemicObjectKind): THREE.BufferGeometry {
  switch (kind) {
    case 'question':
      return new THREE.CylinderGeometry(0.13, 0.13, 0.08, 6);
    case 'hypothesis':
      return new THREE.ConeGeometry(0.15, 0.24, 3);
    case 'test':
      return new THREE.BoxGeometry(0.2, 0.2, 0.2);
    case 'finding':
      return new THREE.OctahedronGeometry(0.16, 0);
    case 'contradiction':
      return new THREE.TorusKnotGeometry(0.11, 0.035, 36, 6, 2, 3);
    case 'branch_point':
      return new THREE.DodecahedronGeometry(0.15, 0);
    case 'notice':
    default:
      return new THREE.SphereGeometry(0.13, 12, 8);
  }
}

function colorFor(kind: EpistemicObjectKind): number {
  return kind === 'branch_point' ? EPISTEMIC_COLORS.branch : EPISTEMIC_COLORS[kind];
}

function descriptionForNode(node: InvestigationNode): string {
  const relationship = typeof node.metadata?.description === 'string'
    ? node.metadata.description
    : node.operation
      ? `Recorded analysis: ${node.operation}`
      : `Recorded ${node.kind ?? 'investigation'} state`;
  return relationship;
}

function buildProjection(source: MemoryPalaceProjectionSource): ProjectedEpistemicObject[] {
  const byId = new Map<string, ProjectedEpistemicObject>();

  if (source.researchQuestion?.trim()) {
    byId.set(`research-question:${source.sessionId}`, {
      id: `research-question:${source.sessionId}`,
      kind: 'question',
      title: 'Research question',
      description: source.researchQuestion.trim(),
      sourceKind: 'research-context',
    });
  }
  if (source.hypothesis?.trim()) {
    byId.set(`research-hypothesis:${source.sessionId}`, {
      id: `research-hypothesis:${source.sessionId}`,
      kind: 'hypothesis',
      title: 'Hypothesis',
      description: source.hypothesis.trim(),
      sourceKind: 'research-context',
    });
  }

  for (const observation of source.observations) {
    if (byId.size >= MAX_MEMORY_PALACE_OBJECTS) break;
    byId.set(observation.id, {
      id: observation.id,
      kind: 'notice',
      title: 'Observation',
      description: observation.notes,
      sourceKind: 'atlas-observation',
      explicitPosition: observation.spatialContext?.position,
    });
  }

  for (const finding of source.findings) {
    if (byId.size >= MAX_MEMORY_PALACE_OBJECTS) break;
    byId.set(finding.id, {
      id: finding.id,
      kind: 'finding',
      title: finding.title,
      description: finding.description,
      sourceKind: 'atlas-finding',
    });
  }

  for (const node of source.nodes) {
    if (byId.size >= MAX_MEMORY_PALACE_OBJECTS) break;
    const kind = authoritativeKind(node);
    if (!kind) continue;
    if (byId.has(node.id)) continue;
    byId.set(node.id, {
      id: node.id,
      kind,
      title: node.label,
      description: descriptionForNode(node),
      sourceKind: `investigation-${node.kind ?? 'operation'}`,
    });
  }

  let branchIndex = 0;
  for (const edge of source.edges) {
    if (byId.size >= MAX_MEMORY_PALACE_OBJECTS) break;
    if (edge.relationship !== 'branches_from') continue;
    const id = `branch:${edge.id}`;
    byId.set(id, {
      id,
      kind: 'branch_point',
      title: 'Branch point',
      description: `Recorded branch ${edge.source} → ${edge.target}`,
      sourceKind: 'investigation-branch',
    });
    branchIndex += 1;
    if (branchIndex >= 8) break;
  }

  return Array.from(byId.values()).slice(0, MAX_MEMORY_PALACE_OBJECTS);
}

/**
 * Sparse, presentation-only Memory Palace view. It consumes explicit Atlas and
 * InvestigationGraph records and never creates analytical/epistemic claims.
 * Only relationships incident to the selected/active object are drawn.
 */
export class MemoryPalaceWorldView {
  readonly group = new THREE.Group();
  private readonly host: MemoryPalaceWorldViewHost;
  private readonly meshes = new Map<string, THREE.Mesh>();
  private relationshipGroup = new THREE.Group();
  private selectedId: string | null = null;
  private signature = '';
  private lastSource: MemoryPalaceProjectionSource | null = null;

  constructor(host: MemoryPalaceWorldViewHost) {
    this.host = host;
    this.group.name = 'memory-palace-epistemic-world';
    this.group.position.set(-3.8, 1.45, -4.6);
    this.group.visible = false;
    this.group.userData = {
      role: 'memory-palace',
      maxObjects: MAX_MEMORY_PALACE_OBJECTS,
      maxRelationships: MAX_MEMORY_PALACE_RELATIONSHIPS,
    };
    this.group.add(this.relationshipGroup);
    host.scene.add(this.group);
  }

  sync(source: MemoryPalaceProjectionSource): void {
    this.lastSource = source;
    const projected = buildProjection(source);
    const nextSignature = JSON.stringify({
      ids: projected.map((entry) => [entry.id, entry.kind, entry.title, entry.description]),
      edgeIds: source.edges.map((edge) => [edge.id, edge.relationship]),
      activeNodeId: source.activeNodeId,
    });

    if (nextSignature !== this.signature) {
      this.signature = nextSignature;
      this.rebuildObjects(projected);
    }

    if (!this.selectedId || !this.meshes.has(this.selectedId)) {
      this.selectedId = source.activeNodeId && this.meshes.has(source.activeNodeId)
        ? source.activeNodeId
        : null;
    }
    this.refreshSelection();
    this.group.visible = projected.length > 0;
  }

  getSnapshot(): {
    visible: boolean;
    objectCount: number;
    relationshipCount: number;
    selectedId: string | null;
    objectIds: string[];
  } {
    return {
      visible: this.group.visible,
      objectCount: this.meshes.size,
      relationshipCount: this.relationshipGroup.children.length,
      selectedId: this.selectedId,
      objectIds: Array.from(this.meshes.keys()),
    };
  }

  private rebuildObjects(projected: ProjectedEpistemicObject[]): void {
    for (const mesh of this.meshes.values()) {
      this.host.removeInteractable(mesh);
      this.host.unregisterTooltipTarget(mesh);
      disposeObject(mesh);
    }
    this.meshes.clear();

    projected.forEach((entry, index) => {
      const material = new THREE.MeshStandardMaterial({
        color: colorFor(entry.kind),
        emissive: colorFor(entry.kind),
        emissiveIntensity: 0.18,
        roughness: 0.55,
        metalness: 0.15,
        transparent: true,
        opacity: 0.86,
      });
      const mesh = new THREE.Mesh(geometryFor(entry.kind), material);
      const column = index % 8;
      const row = Math.floor(index / 8);
      mesh.position.set((column - 3.5) * 0.42, row * 0.42, row * -0.08);
      mesh.name = `epistemic:${entry.id}`;
      mesh.userData = {
        epistemicId: entry.id,
        epistemicKind: entry.kind,
        sourceKind: entry.sourceKind,
        explicitSpatialContext: entry.explicitPosition ?? null,
        nonColorCue: entry.kind === 'branch_point' ? EPISTEMIC_CUES.branch : EPISTEMIC_CUES[entry.kind],
        tooltipMeta: {
          title: `${entry.kind.replace('_', ' ')}: ${entry.title}`,
          body: entry.description,
          priority: 2,
        },
      };
      this.meshes.set(entry.id, mesh);
      this.group.add(mesh);
      this.host.registerTooltipTarget(mesh);
      this.host.addInteractable(mesh, {
        semantic: { kind: 'investigation-artifact', structureId: entry.id, salience: 0.8 },
        onSelect: () => {
          this.selectedId = entry.id;
          this.refreshSelection();
        },
      });
    });
  }

  private refreshSelection(): void {
    for (const [id, mesh] of this.meshes) {
      const selected = id === this.selectedId;
      mesh.scale.setScalar(selected ? 1.28 : 1);
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = selected ? 0.65 : 0.18;
    }
    this.rebuildRelationships();
  }

  private rebuildRelationships(): void {
    disposeObject(this.relationshipGroup);
    this.relationshipGroup = new THREE.Group();
    this.relationshipGroup.name = 'memory-palace-contextual-relationships';
    this.group.add(this.relationshipGroup);
    if (!this.selectedId || !this.lastSource) return;

    const incident = this.lastSource.edges
      .filter((edge) => edge.source === this.selectedId || edge.target === this.selectedId)
      .filter((edge) => this.meshes.has(edge.source) && this.meshes.has(edge.target))
      .slice(0, MAX_MEMORY_PALACE_RELATIONSHIPS);

    for (const edge of incident) {
      const source = this.meshes.get(edge.source);
      const target = this.meshes.get(edge.target);
      if (!source || !target) continue;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        source.position.clone(),
        target.position.clone(),
      ]);
      const color = edge.relationship === 'refutes'
        ? EPISTEMIC_COLORS.refutes
        : edge.relationship === 'supports'
          ? EPISTEMIC_COLORS.supports
          : EPISTEMIC_COLORS.extends;
      const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.58,
      });
      const line = new THREE.Line(geometry, material);
      line.userData = {
        relationshipId: edge.id,
        relationship: edge.relationship,
        authoritative: true,
      };
      this.relationshipGroup.add(line);
    }
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) {
      this.host.removeInteractable(mesh);
      this.host.unregisterTooltipTarget(mesh);
    }
    this.meshes.clear();
    disposeObject(this.group);
  }
}