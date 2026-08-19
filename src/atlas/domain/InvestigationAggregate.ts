/**
 * InvestigationAggregate — authoritative domain aggregate root encapsulating:
 * - AnalyticalState (dataset versioning, handle allocation, space projection)
 * - EvidenceLedger (append-only provenance stream, results, structures, derived history)
 * - RepresentationState (Draco facts mapping, visual heuristics)
 * - DecisionHistory (recommendation guidance and auditor decision tracking)
 * - ResearchContext (session identity and provenance timestamps)
 * - InvestigationGraph (DAG of investigation nodes and branch points)
 */

import { Dataset } from '../../data/Dataset.ts';
import type { AtlasCoreState } from '../types.ts';
import { AnalyticalState } from './AnalyticalState.ts';
import { EvidenceLedger } from './EvidenceLedger.ts';
import { RepresentationState } from './RepresentationState.ts';
import { DecisionHistory } from './DecisionHistory.ts';
import { ResearchContext, type ResearchContextOptions } from './ResearchContext.ts';
import { InvestigationGraph } from './InvestigationGraph.ts';

export class InvestigationAggregate {
  readonly analytical: AnalyticalState;
  readonly ledger: EvidenceLedger;
  readonly representation: RepresentationState;
  readonly decisions: DecisionHistory;
  readonly context: ResearchContext;
  readonly graph: InvestigationGraph;

  constructor(options: ResearchContextOptions = {}) {
    this.analytical = new AnalyticalState();
    this.ledger = new EvidenceLedger();
    this.representation = new RepresentationState();
    this.decisions = new DecisionHistory();
    this.context = new ResearchContext(options);
    this.graph = new InvestigationGraph();
  }

  get sessionId(): string {
    return this.context.sessionId;
  }

  /**
   * Reset all constituent sub-states on loading a new dataset.
   */
  loadDataset(dataset: Dataset, destroyer?: (handle: number) => void): void {
    this.analytical.loadDataset(dataset, destroyer);
    this.ledger.reset();
    this.decisions.reset();
    this.graph.reset();

    const fp = this.analytical.getFingerprint() ?? '';
    this.ledger.appendEvent(
      {
        timestamp: this.context.now(),
        kind: 'load',
        command: { op: 'load' },
        datasetVersion: this.analytical.datasetVersion,
        datasetFingerprint: fp,
        stateHash: fp,
      },
      this.sessionId,
    );

    this.graph.addNode({
      id: `${this.sessionId}:v${this.analytical.datasetVersion}`,
      parentId: null,
      datasetVersion: this.analytical.datasetVersion,
      datasetFingerprint: fp,
      label: 'Initial Dataset',
      timestamp: this.context.now(),
    });
  }

  /**
   * Export the serialisable state snapshot of the aggregate.
   */
  toState(): AtlasCoreState {
    const space = this.analytical.getDatasetSpace();
    return {
      datasetVersion: this.analytical.datasetVersion,
      datasetFingerprint: this.analytical.getFingerprint(),
      originalDataset: this.analytical.originalNullable?.toJSON?.() ?? null,
      currentDataset: this.analytical.currentNullable?.toJSON?.() ?? null,
      datasetSpace: space?.toJSON() ?? null,
      analysisResults: this.ledger.results.slice(),
      eventLedger: this.ledger.ledger.slice(),
      analysisHistory: this.ledger.getAnalysisHistory(this.analytical.originalNullable).toJSON(),
      activeRecommendation: this.decisions.activeRecommendation,
      decisionHistory: this.decisions.history.slice(),
      structures: this.ledger.structures.slice(),
    };
  }

  /**
   * Reconstitute aggregate state from a persisted snapshot.
   */
  restoreState(state: AtlasCoreState, destroyer?: (handle: number) => void): void {
    const original = state.originalDataset ? Dataset.fromJSON(state.originalDataset) : null;
    const current = state.currentDataset ? Dataset.fromJSON(state.currentDataset) : original?.clone?.() ?? null;
    const version = state.datasetVersion ?? 0;

    this.analytical.restore(original, current, version, destroyer);
    this.ledger.restore(state.analysisResults ?? [], state.eventLedger ?? [], state.structures);
    this.decisions.restore(state.activeRecommendation ?? null, state.decisionHistory ?? []);
    this.graph.reset();

    if (current) {
      const fp = this.analytical.getFingerprint() ?? '';
      this.graph.addNode({
        id: `${this.sessionId}:v${version}`,
        parentId: null,
        datasetVersion: version,
        datasetFingerprint: fp,
        label: 'Restored Dataset',
        timestamp: this.context.now(),
      });
    }
  }

  /**
   * Clean up transient resources.
   */
  dispose(destroyer?: (handle: number) => void): void {
    this.analytical.invalidateHandle(destroyer);
  }
}
