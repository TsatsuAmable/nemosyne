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
  private _outgoingMap: Map<string, Set<string>> = new Map();
  private _incomingMap: Map<string, Set<string>> = new Map();
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
    if (!node || !node.id) {
      throw new Error('Invalid node: node must have a valid non-empty id');
    }
    this._nodes.set(node.id, {
      ...node,
      kind: node.kind ?? 'operation',
    });
    if (!this._outgoingMap.has(node.id)) {
      this._outgoingMap.set(node.id, new Set());
    }
    if (!this._incomingMap.has(node.id)) {
      this._incomingMap.set(node.id, new Set());
    }
    this._activeNodeId = node.id;
  }

  addEdge(edge: InvestigationEdge): void {
    if (!edge || !edge.id) {
      throw new Error('Invalid edge: edge must have a valid non-empty id');
    }
    if (!this._nodes.has(edge.source)) {
      throw new Error(`Invalid edge: source node "${edge.source}" does not exist in InvestigationGraph`);
    }
    if (!this._nodes.has(edge.target)) {
      throw new Error(`Invalid edge: target node "${edge.target}" does not exist in InvestigationGraph`);
    }
    if (edge.source === edge.target) {
      throw new Error(`Invalid edge: self-loops are forbidden in InvestigationGraph (node "${edge.source}")`);
    }

    // Check if adding this edge creates a cycle (iterative DFS reachability from target to source)
    if (this._isReachable(edge.target, edge.source)) {
      throw new Error(`CycleDetected: adding edge "${edge.source}" -> "${edge.target}" violates acyclic DAG invariant`);
    }

    this._edges.set(edge.id, edge);

    let outSet = this._outgoingMap.get(edge.source);
    if (!outSet) {
      outSet = new Set();
      this._outgoingMap.set(edge.source, outSet);
    }
    outSet.add(edge.id);

    let inSet = this._incomingMap.get(edge.target);
    if (!inSet) {
      inSet = new Set();
      this._incomingMap.set(edge.target, inSet);
    }
    inSet.add(edge.id);
  }

  /**
   * Iterative DFS reachability check from fromNodeId to toNodeId.
   */
  private _isReachable(fromNodeId: string, toNodeId: string): boolean {
    if (fromNodeId === toNodeId) return true;

    const visited = new Set<string>();
    const stack = [fromNodeId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === toNodeId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const edgeIds = this._outgoingMap.get(current);
      if (edgeIds) {
        for (const edgeId of edgeIds) {
          const edge = this._edges.get(edgeId);
          if (edge && !visited.has(edge.target)) {
            stack.push(edge.target);
          }
        }
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
    const edgeIds = this._outgoingMap.get(nodeId);
    if (!edgeIds) return [];
    const result: InvestigationEdge[] = [];
    for (const id of edgeIds) {
      const edge = this._edges.get(id);
      if (edge) result.push(edge);
    }
    return result;
  }

  getIncomingEdges(nodeId: string): InvestigationEdge[] {
    const edgeIds = this._incomingMap.get(nodeId);
    if (!edgeIds) return [];
    const result: InvestigationEdge[] = [];
    for (const id of edgeIds) {
      const edge = this._edges.get(id);
      if (edge) result.push(edge);
    }
    return result;
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
    this._outgoingMap.clear();
    this._incomingMap.clear();
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
    if (!json || !Array.isArray(json.nodes)) {
      throw new Error('Invalid InvestigationGraph JSON: missing nodes array');
    }
    const graph = new InvestigationGraph();
    for (const node of json.nodes) {
      graph.addNode(node);
    }
    if (json.edges && Array.isArray(json.edges)) {
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
