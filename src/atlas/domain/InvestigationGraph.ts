/**
 * InvestigationGraph — Typed DAG representation of analytical investigation steps,
 * hypothesis lineages, branch points, and evidence relationships.
 */

export type InvestigationNodeKind =
  | 'question'
  | 'dataset_version'
  | 'operation'
  | 'evidence_item'
  | 'observation'
  | 'finding'
  | 'representation_decision'
  | 'conclusion';

export type InvestigationEdgeRelationship =
  | 'motivates'
  | 'uses_dataset'
  | 'produces'
  | 'observes'
  | 'supports'
  | 'refutes'
  | 'branches_from';

export interface InvestigationNode {
  id: string;
  kind?: InvestigationNodeKind;
  parentId: string | null;
  datasetVersion: number;
  datasetFingerprint: string;
  label: string;
  timestamp: number;
  operation?: string;
  findingCount?: number;
  metadata?: Record<string, unknown>;
}

export interface InvestigationEdge {
  id: string;
  source: string;
  target: string;
  relationship: InvestigationEdgeRelationship;
  metadata?: Record<string, unknown>;
}

export interface InvestigationGraphJSON {
  nodes: InvestigationNode[];
  edges: InvestigationEdge[];
  activeNodeId: string | null;
}

export class InvestigationGraph {
  private _nodes: Map<string, InvestigationNode> = new Map();
  private _edges: Map<string, InvestigationEdge> = new Map();
  private _activeNodeId: string | null = null;

  get activeNodeId(): string | null {
    return this._activeNodeId;
  }

  get nodes(): readonly InvestigationNode[] {
    return Array.from(this._nodes.values());
  }

  get edges(): readonly InvestigationEdge[] {
    return Array.from(this._edges.values());
  }

  addNode(node: InvestigationNode): void {
    this._nodes.set(node.id, {
      ...node,
      kind: node.kind ?? 'operation',
    });
    this._activeNodeId = node.id;
  }

  addEdge(edge: InvestigationEdge): void {
    if (!this._nodes.has(edge.source)) {
      throw new Error(`Invalid edge: source node "${edge.source}" does not exist in InvestigationGraph`);
    }
    if (!this._nodes.has(edge.target)) {
      throw new Error(`Invalid edge: target node "${edge.target}" does not exist in InvestigationGraph`);
    }
    if (edge.source === edge.target) {
      throw new Error(`Invalid edge: self-loops are forbidden in InvestigationGraph (node "${edge.source}")`);
    }

    // Check if adding this edge creates a cycle (DFS reachability from target to source)
    if (this._isReachable(edge.target, edge.source)) {
      throw new Error(`CycleDetected: adding edge "${edge.source}" -> "${edge.target}" violates acyclic DAG invariant`);
    }

    this._edges.set(edge.id, edge);
  }

  private _isReachable(fromNodeId: string, toNodeId: string, visited = new Set<string>()): boolean {
    if (fromNodeId === toNodeId) return true;
    if (visited.has(fromNodeId)) return false;
    visited.add(fromNodeId);

    const outgoing = this.getOutgoingEdges(fromNodeId);
    for (const edge of outgoing) {
      if (this._isReachable(edge.target, toNodeId, visited)) {
        return true;
      }
    }
    return false;
  }

  connect(sourceId: string, targetId: string, relationship: InvestigationEdgeRelationship, id?: string): InvestigationEdge {
    const edgeId = id ?? `edge-${sourceId}-${targetId}-${relationship}`;
    const edge: InvestigationEdge = {
      id: edgeId,
      source: sourceId,
      target: targetId,
      relationship,
    };
    this.addEdge(edge);
    return edge;
  }

  getNode(id: string): InvestigationNode | undefined {
    return this._nodes.get(id);
  }

  getEdges(): readonly InvestigationEdge[] {
    return Array.from(this._edges.values());
  }

  getOutgoingEdges(nodeId: string): InvestigationEdge[] {
    return Array.from(this._edges.values()).filter((e) => e.source === nodeId);
  }

  getIncomingEdges(nodeId: string): InvestigationEdge[] {
    return Array.from(this._edges.values()).filter((e) => e.target === nodeId);
  }

  setActiveNode(id: string): boolean {
    if (this._nodes.has(id)) {
      this._activeNodeId = id;
      return true;
    }
    return false;
  }

  reset(): void {
    this._nodes.clear();
    this._edges.clear();
    this._activeNodeId = null;
  }

  toJSON(): InvestigationGraphJSON {
    return {
      nodes: Array.from(this._nodes.values()),
      edges: Array.from(this._edges.values()),
      activeNodeId: this._activeNodeId,
    };
  }

  static fromJSON(json: InvestigationGraphJSON): InvestigationGraph {
    const graph = new InvestigationGraph();
    for (const node of json.nodes) {
      graph.addNode(node);
    }
    if (json.edges) {
      for (const edge of json.edges) {
        graph.addEdge(edge);
      }
    }
    if (json.activeNodeId) {
      graph.setActiveNode(json.activeNodeId);
    }
    return graph;
  }
}
