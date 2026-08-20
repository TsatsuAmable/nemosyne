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
import { computeInvestigationDigest } from '../../investigation/index.ts';

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
      observations: this.ledger.observations.slice(),
      findings: this.ledger.findings.slice(),
      annotations: this.ledger.annotations.slice(),
      investigationGraph: this.graph.toJSON(),
      representationDecision: this.representation.activeDecision,
      researchContext: {
        studyId: this.context.studyId,
        researchQuestion: this.context.researchQuestion,
        hypothesis: this.context.hypothesis,
      },
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
    this.ledger.restore(
      state.analysisResults ?? [],
      state.eventLedger ?? [],
      state.structures,
      state.observations,
      state.findings,
      state.annotations,
    );
    this.decisions.restore(state.activeRecommendation ?? null, state.decisionHistory ?? []);

    if (state.investigationGraph && state.investigationGraph.nodes?.length > 0) {
      // Validate temporary graph first - throws on cycles or invalid edges before touching live graph
      const validatedGraph = InvestigationGraph.fromJSON(state.investigationGraph);
      this.graph.reset();
      for (const node of validatedGraph.nodes) {
        this.graph.addNode(node);
      }
      for (const edge of validatedGraph.edges) {
        this.graph.addEdge(edge);
      }
      if (validatedGraph.activeNodeId) {
        this.graph.setActiveNode(validatedGraph.activeNodeId);
      }
    } else if (current) {
      this.graph.reset();
      const fp = this.analytical.getFingerprint() ?? '';
      this.graph.addNode({
        id: `${this.sessionId}:v${version}`,
        parentId: null,
        datasetVersion: version,
        datasetFingerprint: fp,
        label: 'Restored Dataset',
        timestamp: this.context.now(),
      });
    } else {
      this.graph.reset();
    }

    if (state.representationDecision) {
      this.representation.restoreDecision(state.representationDecision);
    }
  }

  /**
   * Compute the canonical cryptographic digest representing this aggregate's semantic state.
   */
  async computeDigest(kernelVersion = 'unknown'): Promise<string> {
    const fp = this.analytical.getFingerprint() ?? '';
    const originalFp = this.analytical.originalNullable?.fingerprint ? String(this.analytical.originalNullable.fingerprint) : fp;
    const commandStream = this.ledger.ledger.map((evt) => ({
      op: evt.command ? ('op' in evt.command ? evt.command.op : evt.kind) : evt.kind,
      datasetVersion: evt.datasetVersion,
      datasetFingerprint: evt.datasetFingerprint,
    }));

    const repDecision = this.representation.activeDecision;
    const repStrategy = this.representation.activeStrategy;
    const repDecisionPayload = repDecision
      ? {
          strategyId: `strategy_${repDecision.chosenCandidateId}`,
          representationFamily: repDecision.chosenFamily,
          candidateId: repDecision.chosenCandidateId,
          layout: repDecision.chosenLayout,
          confidence: repDecision.confidenceScore,
          utilityScore: repDecision.confidenceScore,
          explanation: repDecision.explanation,
          preserves: repDecision.preserves,
          loses: repDecision.loses,
          rankedAlternatives: (repDecision.rankedCandidates ?? []).slice(1).map((r) => ({
            candidateId: r.candidateId,
            family: r.family,
            layout: r.layout,
            score: r.score,
            disqualified: r.disqualified,
          })),
        }
      : repStrategy
      ? {
          strategyId: repStrategy.id,
          worldType: repStrategy.worldType,
          layout: repStrategy.macroLayout.layout,
          geometry: repStrategy.datumEncoding.geometry,
        }
      : undefined;

    return computeInvestigationDigest({
      schemaVersion: 1,
      datasetFingerprint: fp,
      kernelVersion,
      immutableDatasetFingerprint: originalFp,
      commandStream,
      analyticalState: {
        datasetVersion: this.analytical.datasetVersion,
        datasetFingerprint: fp,
        rowCount: this.analytical.currentNullable?.rowCount ?? 0,
        columnCount: this.analytical.currentNullable?.columns?.length ?? 0,
      },
      evidenceLedger: {
        resultsCount: this.ledger.results.length,
        eventsCount: this.ledger.ledger.length,
        observationCount: this.ledger.observations.length,
        findingCount: this.ledger.findings.length,
        annotationCount: this.ledger.annotations.length,
        findings: this.ledger.findings.map((f) => ({ id: f.id, title: f.title, confidence: f.confidence })),
        observations: this.ledger.observations.map((o) => ({ id: o.id, notes: o.notes })),
      },
      representationDecision: repDecisionPayload,
      researchContext: {
        studyId: this.context.studyId,
        researchQuestion: this.context.researchQuestion,
        hypothesis: this.context.hypothesis,
      },
    });
  }

  /**
   * Clean up transient resources.
   */
  dispose(destroyer?: (handle: number) => void): void {
    this.analytical.invalidateHandle(destroyer);
  }
}
