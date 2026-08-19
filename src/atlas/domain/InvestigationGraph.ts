/**
 * InvestigationGraph — DAG representation of analytical investigation steps, branch points, and evidence links.
 */

export interface InvestigationNode {
  id: string;
  parentId: string | null;
  datasetVersion: number;
  datasetFingerprint: string;
  label: string;
  timestamp: number;
  operation?: string;
  findingCount?: number;
}

export class InvestigationGraph {
  private _nodes: Map<string, InvestigationNode> = new Map();
  private _activeNodeId: string | null = null;

  get activeNodeId(): string | null {
    return this._activeNodeId;
  }

  get nodes(): readonly InvestigationNode[] {
    return Array.from(this._nodes.values());
  }

  addNode(node: InvestigationNode): void {
    this._nodes.set(node.id, node);
    this._activeNodeId = node.id;
  }

  getNode(id: string): InvestigationNode | undefined {
    return this._nodes.get(id);
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
    this._activeNodeId = null;
  }
}
