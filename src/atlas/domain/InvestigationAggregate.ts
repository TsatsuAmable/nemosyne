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
import { InvestigationGraph, type InvestigationNode } from './InvestigationGraph.ts';
import {
  CommittedInvestigationContextLedger,
  type CommittedInvestigationContextV2,
  type CommittedContextActivation,
} from './CommittedInvestigationContext.ts';
import { canonicalizeInvestigationPerspective } from './InvestigationPerspective.ts';
import { canonicalizeInvestigationIntent } from './InvestigationIntent.ts';
import {
  type AlternativeCandidate,
  type RepresentationDecision,
  createEmbodimentForAlternative,
} from '../../moneta/representation/RepresentationDecision.ts';
import {
  computeGovernedInvestigationDigest,
  computeInvestigationDigest,
  computeSemanticInvestigationDigest,
  DiscoveryEpisodeStore,
  type DiscoveryEpisodeStoreSnapshot,
  type NoFeasibleRepresentationRecord,
} from '../../investigation/index.ts';
import {
  recordEmbodimentCritique as recordCritiqueHelper,
  recordHumanMeaningJudgment as recordJudgmentHelper,
  assertNotSelfLabeled,
  type EmbodimentCritiqueInputV1,
  type EmbodimentCritiqueRecordV1,
  type HumanMeaningJudgmentInputV1,
  type HumanMeaningJudgmentRecordV1,
} from '../../moneta/forma/FormaHumanFeedback.ts';
import {
  FormaKnowledgeStore,
  type FormaKnowledgeBaseV1,
  type FormaMetaphorCaseV1,
  type PromoteCaseCandidateInputV1,
} from '../../moneta/forma/FormaKnowledgeBase.ts';
import type {
  DiscoveryOutcomeLinkJudgement,
  JudgementOutcome,
} from '../../judgement/RepresentationJudgement.ts';
import { buildDatasetSignature } from '../../moneta/representation/SignatureBuilder.ts';
import {
  RepresentationSearchEngine,
  type RepresentationSearchResult,
  type SearchOptions,
} from '../../moneta/search/index.ts';


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
  /**
   * RFC 0009 tranche 2: exact persisted evidence-receipt envelope bytes. When
   * present, the digest switches from the V2 semantic projection to the
   * governed V3 composition over the identical state; the kernelVersion
   * argument must equal the captured bundle identity or the digest throws.
   */
  evidenceReceiptBytes?: Uint8Array;
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
  readonly formaKnowledge: FormaKnowledgeStore;
  readonly contextLedger: CommittedInvestigationContextLedger;
  private readonly embodimentCritiques: EmbodimentCritiqueRecordV1[] = [];
  private readonly humanMeaningJudgments: HumanMeaningJudgmentRecordV1[] = [];
  private readonly discoveryLinks: DiscoveryOutcomeLinkJudgement[] = [];

  constructor(options: ResearchContextOptions = {}) {
    this.analytical = new AnalyticalState();
    this.ledger = new EvidenceLedger();
    this.representation = new RepresentationState();
    this.decisions = new DecisionHistory();
    this.context = new ResearchContext(options);
    this.graph = new InvestigationGraph();
    this.discoveries = new DiscoveryEpisodeStore();
    this.contextLedger = new CommittedInvestigationContextLedger();
    this.formaKnowledge = new FormaKnowledgeStore();
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

    const rootNodeId = `${this.sessionId}:v${this.analytical.datasetVersion}`;
    this.graph.addNode({
      id: rootNodeId,
      parentId: null,
      datasetVersion: this.analytical.datasetVersion,
      datasetFingerprint: fp,
      label: 'Initial Dataset',
      timestamp: this.context.now(),
    });

    this.contextLedger.reset();
    this.contextLedger.commit(rootNodeId, {
      schemaVersion: 2,
      nodeId: rootNodeId,
      epistemicPurpose: 'CLAIM_BEARING',
      intent: {
        schemaVersion: 1,
        researchQuestion: this.context.researchQuestion,
        hypothesis: this.context.hypothesis,
      },
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

    const rootNodeId = `${this.sessionId}:v${this.analytical.datasetVersion}`;
    this.graph.addNode({
      id: rootNodeId,
      parentId: null,
      datasetVersion: this.analytical.datasetVersion,
      datasetFingerprint: fp,
      label: 'Initial Dataset (Columnar)',
      timestamp: this.context.now(),
    });

    this.contextLedger.reset();
    this.contextLedger.commit(rootNodeId, {
      schemaVersion: 2,
      nodeId: rootNodeId,
      epistemicPurpose: 'CLAIM_BEARING',
      intent: {
        schemaVersion: 1,
        researchQuestion: this.context.researchQuestion,
        hypothesis: this.context.hypothesis,
      },
    });
  }

  /**
   * FM1: Commit an authoritative investigation context bound to an investigation node.
   */
  commitContext(nodeId: string, context: unknown): CommittedContextActivation {
    return this.contextLedger.commit(nodeId, context);
  }

  /**
   * FM1: Get the current active committed investigation context.
   */
  getActiveContext(): CommittedInvestigationContextV2 | undefined {
    const current = this.contextLedger.current();
    if (!current) return undefined;
    return this.contextLedger.getCommitted(current.nodeId);
  }

  /**
   * FM1: Activate an existing committed investigation node/context.
   */
  activateContext(nodeId: string): CommittedContextActivation {
    return this.contextLedger.activate(nodeId);
  }

  /**
   * FM1: Foreground a new perspective over the currently active investigation context,
   * returning a fresh activation epoch and updating context identity without modifying
   * analytical dataset state.
   */
  setPerspective(perspective: unknown): CommittedContextActivation {
    const active = this.getActiveContext();
    if (!active) {
      throw new Error('Cannot set perspective: no committed investigation context is active');
    }
    const canonicalPerspective = canonicalizeInvestigationPerspective(perspective);
    const updatedContext: CommittedInvestigationContextV2 = {
      ...active,
      perspective: canonicalPerspective,
    };
    return this.contextLedger.commit(active.nodeId, updatedContext);
  }

  /**
   * FM2: Retrieve inspectable alternative candidates from the active decision.
   */
  getRepresentationAlternatives(): readonly AlternativeCandidate[] {
    return this.representation.activeDecision?.alternatives ?? [];
  }

  /**
   * FM2: Preview an alternative representation without mutating active state or graph nodes.
   */
  previewAlternative(candidateId: string): {
    embodiment: import('../../moneta/representation/RepresentationDecision.ts').DecisionEmbodiment;
    candidate: AlternativeCandidate;
  } {
    const alternatives = this.getRepresentationAlternatives();
    const candidate = alternatives.find((a) => a.candidateId === candidateId);
    if (!candidate) {
      throw new Error(
        `[InvestigationAggregate] Alternative candidate "${candidateId}" not found in active decision`
      );
    }
    const fp = this.analytical.getFingerprint() ?? '';
    const embodiment = createEmbodimentForAlternative(candidate, fp);
    return { embodiment, candidate };
  }

  /**
   * FM2: Compare the active representation decision against an alternative candidate,
   * preserving semantic correspondence anchors across representations.
   */
  compareAlternative(candidateId: string): {
    current: RepresentationDecision;
    alternative: AlternativeCandidate;
    sharedAnchors: readonly string[];
  } {
    const current = this.representation.activeDecision;
    if (!current) {
      throw new Error(
        '[InvestigationAggregate] No active representation decision to compare against'
      );
    }
    const { candidate } = this.previewAlternative(candidateId);
    return {
      current,
      alternative: candidate,
      sharedAnchors: candidate.sharedSemanticAnchors ?? [],
    };
  }

  /**
   * FM2: Branch the investigation to an eligible alternative candidate via Road Not Taken.
   * Promotes the alternative to the active representation on a newly committed child branch node
   * in the InvestigationGraph, maintaining parent-child lineage while leaving parent node state
   * and historical digests bitwise invariant. Fails closed against disqualified alternatives.
   */
  branchToAlternative(
    candidateId: string,
    intentOverride?: unknown
  ): InvestigationNode {
    const { embodiment, candidate } = this.previewAlternative(candidateId);
    if (candidate.eligibility === 'DISQUALIFIED') {
      throw new Error(
        `[InvestigationAggregate] Cannot branch to disqualified alternative "${candidateId}": ${candidate.reason}`
      );
    }
    if (candidate.eligibility === 'ABSTAIN') {
      throw new Error(
        `[InvestigationAggregate] Cannot branch to alternative "${candidateId}": engine abstained`
      );
    }

    const parentNodeId = this.graph.activeNodeId;
    if (!parentNodeId) {
      throw new Error(
        '[InvestigationAggregate] Cannot branch: no active investigation node in graph'
      );
    }

    const currentDecision = this.representation.activeDecision;
    if (!currentDecision) {
      throw new Error(
        '[InvestigationAggregate] Cannot branch: no active representation decision'
      );
    }

    const fp = this.analytical.getFingerprint() ?? '';
    const branchIndex =
      this.graph.nodes.filter((n) => n.parentId === parentNodeId).length + 1;
    const childNodeId = `${parentNodeId}:branch-rnt-${candidate.candidateId.toLowerCase()}-${branchIndex}`;

    const childNode: InvestigationNode = {
      id: childNodeId,
      kind: 'representation_decision',
      parentId: parentNodeId,
      datasetVersion: this.analytical.datasetVersion,
      datasetFingerprint: fp,
      label: `Road Not Taken: ${candidate.family} (${candidate.layout})`,
      timestamp: this.context.now(),
      metadata: {
        branchedFromAlternative: candidateId,
        candidateId: candidate.candidateId,
        family: candidate.family,
        layout: candidate.layout,
        score: candidate.score,
        parentDecisionId: currentDecision.id,
      },
    };

    this.graph.addNode(childNode);
    this.graph.addEdge({
      id: `edge:${parentNodeId}->${childNodeId}:branches_from`,
      source: parentNodeId,
      target: childNodeId,
      relationship: 'branches_from',
      metadata: { candidateId: candidate.candidateId },
    });
    this.graph.setActiveNode(childNodeId);

    const activeContext = this.getActiveContext();
    if (activeContext) {
      const newContext: CommittedInvestigationContextV2 = {
        schemaVersion: 2,
        nodeId: childNodeId,
        epistemicPurpose: activeContext.epistemicPurpose,
        intent: intentOverride
          ? canonicalizeInvestigationIntent(intentOverride)
          : activeContext.intent,
        perspective: activeContext.perspective,
      };
      this.contextLedger.commit(childNodeId, newContext);
    }

    const now = this.context.now();
    const branchedDecision: RepresentationDecision = {
      ...currentDecision,
      id: `decision_rnt_${candidate.candidateId}_${fp.slice(0, 8)}_${now}`,
      chosenCandidateId: candidate.candidateId,
      chosenFamily: candidate.family,
      chosenLayout: candidate.layout,
      representationFamily: candidate.family,
      utilityScore: candidate.score,
      decisionStatus: 'DECISIVE',
      explanation: `Branched via Road Not Taken from ${currentDecision.chosenCandidateId ?? currentDecision.representationFamily} to ${candidate.candidateId}. ${candidate.reason}`,
      embodiment,
      provenance: {
        ...currentDecision.provenance,
        generatedAt: now,
      },
    };

    this.representation.activeDecision = branchedDecision;
    this.representation.activeStrategy = embodiment.spatialStrategy;

    this.ledger.appendEvent(
      {
        timestamp: now,
        kind: 'embodiment',
        command: {
          op: 'embodiment',
        },
        datasetVersion: this.analytical.datasetVersion,
        datasetFingerprint: fp,
        stateHash: fp,
      },
      this.sessionId
    );

    return childNode;
  }

  /**
   * FM6: Records an attributable, confirmed human critique of an embodiment plan or mapping.
   * Fails closed if the critique was generated from automated or self-labeling events.
   * Does not mutate underlying scientific analytical data or dataset state.
   */
  recordEmbodimentCritique(input: EmbodimentCritiqueInputV1): EmbodimentCritiqueRecordV1 {
    assertNotSelfLabeled(input as unknown as { automated?: boolean; passiveClick?: boolean; systemDefault?: boolean; source?: string });
    const record = recordCritiqueHelper(input);
    this.embodimentCritiques.push(record);
    return record;
  }

  /**
   * FM6: Records an attributable, confirmed human meaning judgment testing recovery of intended meaning.
   * Fails closed if the judgment was generated from automated or self-labeling events.
   * Does not mutate underlying scientific analytical data or dataset state.
   */
  recordHumanMeaningJudgment(input: HumanMeaningJudgmentInputV1): HumanMeaningJudgmentRecordV1 {
    assertNotSelfLabeled(input as unknown as { automated?: boolean; passiveClick?: boolean; systemDefault?: boolean; source?: string });
    const record = recordJudgmentHelper(input);
    this.humanMeaningJudgments.push(record);
    return record;
  }

  getEmbodimentCritiques(): readonly EmbodimentCritiqueRecordV1[] {
    return Object.freeze([...this.embodimentCritiques]);
  }

  getHumanMeaningJudgments(): readonly HumanMeaningJudgmentRecordV1[] {
    return Object.freeze([...this.humanMeaningJudgments]);
  }

  /**
   * FM6: Links a validated DiscoveryEpisode to the representation that framed it.
   */
  linkDiscoveryOutcomeToRepresentation(
    discoveryId: string,
    graphId: string,
    outcome: JudgementOutcome,
    researcherId: string = 'researcher-unspecified',
    rationale?: string
  ): DiscoveryOutcomeLinkJudgement {
    const judgementId = `disc-link-v1:${this.context.now()}-${discoveryId}-${graphId}`;
    const link: DiscoveryOutcomeLinkJudgement = {
      schemaVersion: '1.0.0',
      judgementId,
      investigationId: this.context.studyId || 'investigation-default',
      researcherId,
      sequence: this.discoveryLinks.length + 1,
      recordedAt: this.context.now(),
      kind: 'DISCOVERY_OUTCOME_LINK',
      discoveryId,
      graphId,
      outcome,
      rationale,
      provenance: {
        datasetFingerprint: this.analytical.getFingerprint() ?? '',
        kernelVersion: '1.0.0',
        monetaVersion: '1.0.0',
        fitnessModelVersion: '1.0.0',
        ontologyVersion: '1.0.0',
        nilVersion: '1.0.0',
        representationGraphId: graphId,
        discoveryId,
      },
    };
    this.discoveryLinks.push(link);
    return link;
  }

  getDiscoveryOutcomeLinks(): readonly DiscoveryOutcomeLinkJudgement[] {
    return Object.freeze([...this.discoveryLinks]);
  }

  getFormaKnowledgeBase(): FormaKnowledgeBaseV1 {
    return this.formaKnowledge.toSnapshot();
  }

  promoteFormaMetaphorCase(candidate: PromoteCaseCandidateInputV1): FormaMetaphorCaseV1 {
    return this.formaKnowledge.promoteCase(candidate);
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
    if (
      identityOptions.evidenceReceiptBytes !== undefined &&
      identityOptions.legacyDigestSchemaV1
    ) {
      throw new Error(
        'Governed evidence digests cannot be composed with the legacy schema-v1 lossy projection'
      );
    }
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

    // RFC 0009: the governed V3 composition must commit exactly the semantic
    // state the V2 projection commits, plus the verbatim evidence envelope.
    const semanticState = {
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
    };

    if (identityOptions.evidenceReceiptBytes !== undefined) {
      return computeGovernedInvestigationDigest(semanticState, identityOptions.evidenceReceiptBytes);
    }
    return computeSemanticInvestigationDigest(semanticState);
  }

  /**
   * FM7: Executes multi-objective search & synthesis for representations.
   * Pure inquiry; does not mutate analytical state, dataset fingerprint, or graph.
   */
  searchRepresentations(options?: SearchOptions): RepresentationSearchResult {
    const ds = this.analytical.current;
    const signature = buildDatasetSignature(ds);
    return RepresentationSearchEngine.search(signature, {
      ...options,
      context: this.getActiveContext(),
    });
  }

  /** Clean up transient resources. */
  dispose(destroyer?: (handle: number) => void): void {
    this.analytical.invalidateHandle(destroyer);
  }
}
