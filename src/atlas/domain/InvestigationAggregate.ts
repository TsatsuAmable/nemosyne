/**
 * InvestigationAggregate — authoritative domain aggregate root encapsulating:
 * - AnalyticalState (dataset versioning, handle allocation, space projection)
 * - EvidenceLedger (append-only provenance stream, results, structures, derived history)
 * - RepresentationState (Moneta facts mapping and representation decisions)
 * - DecisionHistory (recommendation guidance and auditor decision tracking)
 * - ResearchContext (session identity and provenance timestamps)
 * - InvestigationGraph (DAG of investigation nodes and branch points)
 * - DiscoveryEpisodeStore (validated discovery lifecycle records)
 */

import { Dataset } from '../../data/Dataset.ts';
import { canonicalDatasetIdentityHex } from '../../data/DatasetIdentity.ts';
import type { AnalysisResult, AtlasCoreState, ResearchEvent } from '../types.ts';
import { AnalyticalState } from './AnalyticalState.ts';
import { EvidenceLedger } from './EvidenceLedger.ts';
import { RepresentationState } from './RepresentationState.ts';
import { DecisionHistory } from './DecisionHistory.ts';
import { ResearchContext, type ResearchContextOptions } from './ResearchContext.ts';
import { InvestigationGraph } from './InvestigationGraph.ts';
import {
  computeInvestigationDigest,
  computeSemanticInvestigationDigest,
  DiscoveryEpisodeStore,
  type DiscoveryEpisodeStoreSnapshot,
  type NoFeasibleRepresentationRecord,
} from '../../investigation/index.ts';

export interface InvestigationDigestIdentityOptions {
  /**
   * Read-only compatibility for replaying format-v1 portable archives created
   * before RF-048. New digests must never opt into this mode.
   */
  legacyImmutableDatasetSeedHash?: boolean;
  /**
   * Read-only compatibility for packages exported before RF-046. Their digest
   * used the historical schema-v1 lossy projection and carried no algorithm
   * label in the manifest.
   */
  legacyDigestSchemaV1?: boolean;
  /** Session-owned NIL outcomes are part of portable investigation semantics. */
  nilOutcomes?: readonly NoFeasibleRepresentationRecord[];
  /** Session-owned research context overrides the aggregate-local compatibility view. */
  researchContext?: import('../types.ts').ResearchContext;
}

/**
 * RF-046/RF-048: analysis-result semantics commit the authoritative result and
 * provenance, but the embedded row-major DatasetJSON is represented by the
 * canonical scientific dataset identity. This preserves the explicit RF-048
 * invariant that lineage-only `rowIds` do not alter scientific identity while
 * still making any governed schema/row/edge content change alter the digest.
 */
function semanticAnalysisResult(result: AnalysisResult): Record<string, unknown> {
  const { dataset, ...rest } = result;
  return {
    ...rest,
    outputDatasetFingerprint: canonicalDatasetIdentityHex(dataset),
  };
}

function semanticResearchEvent(event: ResearchEvent): Record<string, unknown> {
  if (!event.result) return event as unknown as Record<string, unknown>;
  return {
    ...event,
    result: semanticAnalysisResult(event.result),
  };
}

export class InvestigationAggregate {
  readonly analytical: AnalyticalState;
  readonly ledger: EvidenceLedger;
  readonly representation: RepresentationState;
  readonly decisions: DecisionHistory;
  readonly context: ResearchContext;
  readonly graph: InvestigationGraph;
  readonly discoveries: DiscoveryEpisodeStore;

  constructor(options: ResearchContextOptions = {}) {
    this.analytical = new AnalyticalState();
    this.ledger = new EvidenceLedger();
    this.representation = new RepresentationState();
    this.decisions = new DecisionHistory();
    this.context = new ResearchContext(options);
    this.graph = new InvestigationGraph();
    this.discoveries = new DiscoveryEpisodeStore();
  }

  get sessionId(): string {
    return this.context.sessionId;
  }

  /**
   * RF-027: persist a remediation action as durable, replayable provenance in
   * the EvidenceLedger. The caller builds the {@link RemediationProvenance}
   * (via `buildRemediationProvenance`) capturing remediation → old requirements
   * → new requirements → resulting decision; this appends the ledger event so
   * the chain survives `.nemosyne` export/import.
   */
  recordRemediation(
    provenance: import('../../moneta/representation/ActionableNil.ts').RemediationProvenance
  ): void {
    this.ledger.recordRemediation(
      provenance,
      this.sessionId,
      this.analytical.datasetVersion,
      this.analytical.getFingerprint() ?? provenance.datasetFingerprint
    );
  }

  /** Reset all constituent sub-states on loading a new dataset. */
  loadDataset(dataset: Dataset, destroyer?: (handle: number) => void): void {
    this.analytical.loadDataset(dataset, destroyer);
    this.ledger.reset();
    this.decisions.reset();
    this.graph.reset();
    this.discoveries.reset();

    const fp = this.analytical.getFingerprint() ?? '';
    if (fp && this.analytical.originalNullable) {
      this.ledger.registerDatasetVersion(
        { datasetVersion: this.analytical.datasetVersion, datasetFingerprint: fp },
        this.analytical.originalNullable
      );
    }
    this.ledger.appendEvent(
      {
        timestamp: this.context.now(),
        kind: 'load',
        command: { op: 'load' },
        datasetVersion: this.analytical.datasetVersion,
        datasetFingerprint: fp,
        stateHash: fp,
      },
      this.sessionId
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

  /** Reset all constituent sub-states on loading a new typed/columnar dataset. */
  loadTypedDataset(handle: number, fingerprint: string, destroyer?: (handle: number) => void): void {
    this.analytical.adoptColumnarHandle(handle, { fingerprint }, destroyer);
    this.ledger.reset();
    this.decisions.reset();
    this.graph.reset();
    this.discoveries.reset();

    const fp = fingerprint || (this.analytical.getFingerprint() ?? '');
    this.ledger.appendEvent(
      {
        timestamp: this.context.now(),
        kind: 'load',
        command: { op: 'load' },
        datasetVersion: this.analytical.datasetVersion,
        datasetFingerprint: fp,
        stateHash: fp,
      },
      this.sessionId
    );

    this.graph.addNode({
      id: `${this.sessionId}:v${this.analytical.datasetVersion}`,
      parentId: null,
      datasetVersion: this.analytical.datasetVersion,
      datasetFingerprint: fp,
      label: 'Initial Dataset (Columnar)',
      timestamp: this.context.now(),
    });
  }

  /** Export the serialisable state snapshot of the aggregate. */
  toState(): AtlasCoreState {
    const space = this.analytical.getDatasetSpace();
    return {
      datasetVersion: this.analytical.datasetVersion,
      datasetFingerprint: this.analytical.getFingerprint(),
      originalDataset: this.analytical.originalNullable?.toJSON?.() ?? null,
      currentDataset: this.analytical.currentNullable?.toJSON?.() ?? null,
      datasetSpace: space?.toJSON() ?? null,
      analysisResults: this.ledger.materializedResults(),
      eventLedger: this.ledger.materializedLedger(),
      analysisHistory: this.ledger.getAnalysisHistory(this.analytical.originalNullable).toJSON(),
      activeRecommendation: this.decisions.activeRecommendation,
      decisionHistory: this.decisions.history.slice(),
      structures: this.ledger.structures.slice(),
      observations: this.ledger.observations.slice(),
      findings: this.ledger.findings.slice(),
      annotations: this.ledger.annotations.slice(),
      investigationGraph: this.graph.toJSON(),
      representationDecision: this.representation.activeDecision,
      discoveryEpisodes: this.discoveries.toJSON(),
      researchContext: {
        studyId: this.context.studyId,
        researchQuestion: this.context.researchQuestion,
        hypothesis: this.context.hypothesis,
      },
    };
  }

  /** Reconstitute aggregate state from a persisted snapshot. */
  restoreState(state: AtlasCoreState, destroyer?: (handle: number) => void): void {
    // Validate discovery state before mutating the live aggregate. Older session
    // snapshots legitimately omit this field and restore to an empty store.
    const validatedDiscoveries = new DiscoveryEpisodeStore();
    const discoverySnapshot: DiscoveryEpisodeStoreSnapshot | undefined = state.discoveryEpisodes;
    if (discoverySnapshot) validatedDiscoveries.restore(discoverySnapshot);

    const original = state.originalDataset ? Dataset.fromJSON(state.originalDataset) : null;
    const current = state.currentDataset
      ? Dataset.fromJSON(state.currentDataset)
      : (original?.clone?.() ?? null);
    const version = state.datasetVersion ?? 0;

    this.analytical.restore(original, current, version, destroyer);
    this.ledger.restore(
      state.analysisResults ?? [],
      state.eventLedger ?? [],
      state.structures,
      state.observations,
      state.findings,
      state.annotations
    );
    // RF-035B2B: persisted results repopulate their own full version entries,
    // but a valid schema-v2 snapshot may contain zero results. Re-register the
    // restored original as the borrowed baseline so the first subsequently
    // verified row-view mutation has a source without allocating another row
    // snapshot. Fingerprint fallback handles reset/seek versions of this same
    // canonical content while logical version identity remains distinct.
    const loadEvent = (state.eventLedger ?? []).find(
      (event) => event.kind === 'load' && Boolean(event.datasetFingerprint)
    );
    const baselineFingerprint =
      loadEvent?.datasetFingerprint ??
      ((state.analysisResults?.length ?? 0) === 0 ? state.datasetFingerprint : null);
    if (original && baselineFingerprint) {
      this.ledger.registerDatasetVersion(
        {
          datasetVersion: loadEvent?.datasetVersion ?? 1,
          datasetFingerprint: baselineFingerprint,
        },
        original
      );
    }
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

    this.representation.restoreDecision(state.representationDecision ?? null);

    if (discoverySnapshot) {
      this.discoveries.restore(validatedDiscoveries.toJSON());
    } else {
      this.discoveries.reset();
    }
  }

  /** Compute the canonical cryptographic digest representing this aggregate's semantic state. */
  async computeDigest(
    kernelVersion = 'unknown',
    identityOptions: InvestigationDigestIdentityOptions = {},
  ): Promise<string> {
    const fp = this.analytical.getFingerprint() ?? '';
    const originalDataset = this.analytical.originalNullable;
    const originalFp = originalDataset
      ? String(
          identityOptions.legacyImmutableDatasetSeedHash
            ? originalDataset.seedHash
            : originalDataset.fingerprint,
        )
      : fp;

    if (identityOptions.legacyDigestSchemaV1) {
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
            utilityScore: repDecision.utilityScore,
            decisionStatus: repDecision.decisionStatus,
            decisionMargin: repDecision.decisionMargin,
            fitnessModelVersion: repDecision.fitnessModelVersion,
            fitnessModelArtifactHash: repDecision.fitnessModelArtifactHash ?? null,
            explanation: repDecision.explanation,
            preserves: repDecision.preserves,
            loses: repDecision.loses,
            runnerUp: repDecision.runnerUp
              ? {
                  candidateId: repDecision.runnerUp.candidateId,
                  family: repDecision.runnerUp.family,
                  layout: repDecision.runnerUp.layout,
                  score: repDecision.runnerUp.score,
                }
              : null,
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
          findings: this.ledger.findings.map((f) => ({
            id: f.id,
            title: f.title,
            confidence: f.confidence,
          })),
          observations: this.ledger.observations.map((o) => ({ id: o.id, notes: o.notes })),
        },
        discoveryEpisodes: this.discoveries.all(),
        representationDecision: repDecisionPayload,
        researchContext: {
          studyId: this.context.studyId,
          researchQuestion: this.context.researchQuestion,
          hypothesis: this.context.hypothesis,
        },
      });
    }

    const researchContext = identityOptions.researchContext ?? {
      studyId: this.context.studyId,
      researchQuestion: this.context.researchQuestion,
      hypothesis: this.context.hypothesis,
    };

    return computeSemanticInvestigationDigest({
      datasetFingerprint: fp,
      immutableDatasetFingerprint: originalFp,
      kernelVersion,
      analyticalState: {
        datasetVersion: this.analytical.datasetVersion,
        datasetFingerprint: fp,
        rowCount: this.analytical.currentNullable?.rowCount ?? 0,
        columnCount: this.analytical.currentNullable?.columns?.length ?? 0,
      },
      eventLedger: this.ledger.ledger.map(semanticResearchEvent),
      analysisResults: this.ledger.results.map(semanticAnalysisResult),
      structures: this.ledger.structures,
      observations: this.ledger.observations,
      findings: this.ledger.findings,
      annotations: this.ledger.annotations,
      // A full RepresentationDecision is persisted as representation.json and
      // replayed authoritatively. A strategy-only transient is not portable and
      // is therefore intentionally excluded from v2 rather than overclaiming.
      representationState: this.representation.activeDecision ?? undefined,
      discoveryEpisodes: this.discoveries.all(),
      nilOutcomes: identityOptions.nilOutcomes,
      researchContext,
    });
  }

  /** Clean up transient resources. */
  dispose(destroyer?: (handle: number) => void): void {
    this.analytical.invalidateHandle(destroyer);
  }
}
