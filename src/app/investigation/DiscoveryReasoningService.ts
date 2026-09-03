import type { AtlasCore } from '../../atlas/AtlasCore.ts';
import type { AnalysisResult, Finding, Observation } from '../../atlas/types.ts';
import type {
  DiscoveryAnalyticalTest,
  DiscoveryEpisode,
  DiscoveryValidationStatus,
} from '../../investigation/DiscoveryEpisode.ts';
import { DISCOVERY_EPISODE_SCHEMA_VERSION } from '../../investigation/DiscoveryEpisode.ts';
import type { InvestigationNode } from '../../atlas/domain/InvestigationGraph.ts';

export type DiscoveryTestOutcome = DiscoveryAnalyticalTest['outcome'];

export interface DiscoveryBranchSummary {
  id: string;
  discoveryId: string;
  label: string;
  parentId: string | null;
  active: boolean;
}

export interface DiscoveryReasoningSnapshot {
  discoveries: readonly DiscoveryEpisode[];
  latestObservation: Observation | null;
  latestResult: AnalysisResult | null;
  latestFinding: Finding | null;
  activeGraphNodeId: string | null;
  activeGraphNode: InvestigationNode | null;
  branches: readonly DiscoveryBranchSummary[];
}

export interface AskDiscoveryInput {
  observationId: string;
  question: string;
}

export interface HypothesiseDiscoveryInput {
  discoveryId: string;
  hypothesis: string;
}

export interface RecordDiscoveryUnderstandingInput {
  discoveryId: string;
  findingId: string;
}

export interface ValidateDiscoveryInput {
  discoveryId: string;
  resultId: string;
  outcome: DiscoveryTestOutcome;
}

/** Compatibility input retained for the C4 combined authoring surface. */
export interface StartDiscoveryInput {
  observationId: string;
  question: string;
  hypothesis: string;
}

/** Compatibility input retained for the C4 combined test/conclusion surface. */
export interface RecordDiscoveryTestInput {
  discoveryId: string;
  resultId: string;
  outcome: DiscoveryTestOutcome;
  conclusion: string;
}

export interface BranchDiscoveryInput {
  discoveryId: string;
  label?: string;
}

export interface DiscoveryReasoningServiceOptions {
  idFactory?: (prefix: string) => string;
  now?: () => number;
  investigationVersion?: string;
}

function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function validationStatus(outcome: DiscoveryTestOutcome): DiscoveryValidationStatus {
  switch (outcome) {
    case 'SUPPORTS':
      return 'SUPPORTED';
    case 'REFUTES':
      return 'REFUTED';
    case 'INCONCLUSIVE':
      return 'INCONCLUSIVE';
  }
}

function graphNodeForDiscoveryRole(
  nodes: readonly InvestigationNode[],
  discoveryId: string,
  role: string,
): InvestigationNode | null {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    if (node.metadata?.discoveryId === discoveryId && node.metadata?.discoveryRole === role) {
      return node;
    }
  }
  return null;
}

function sameDatasetFingerprint(
  episode: DiscoveryEpisode,
  evidence: { datasetFingerprint: string },
): boolean {
  return evidence.datasetFingerprint === episode.provenance.datasetFingerprint;
}

/**
 * Application-layer authoring seam for explicit researcher reasoning.
 *
 * This service never calculates analytical truth. PT5C makes the lifecycle
 * progressive while retaining the C4 combined methods for compatibility:
 *
 * notice -> question -> hypothesis -> analytical investigation -> explicit
 * Atlas Finding (understanding) -> evidence-backed validation -> discovery.
 */
export class DiscoveryReasoningService {
  private readonly atlas: AtlasCore;
  private readonly now: () => number;
  private readonly idFactory: (prefix: string) => string;
  private readonly investigationVersion: string;
  private fallbackCounter = 0;

  constructor(atlas: AtlasCore, options: DiscoveryReasoningServiceOptions = {}) {
    this.atlas = atlas;
    this.now = options.now ?? (() => Date.now());
    this.investigationVersion = options.investigationVersion ?? 'pt5c-investigation-journey/1';
    this.idFactory =
      options.idFactory ??
      ((prefix) => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          return `${prefix}-${crypto.randomUUID()}`;
        }
        this.fallbackCounter += 1;
        return `${prefix}-${this.now()}-${this.fallbackCounter}`;
      });
  }

  snapshot(): DiscoveryReasoningSnapshot {
    const graph = this.atlas.aggregate.graph;
    const activeGraphNodeId = graph.activeNodeId;
    return {
      discoveries: this.atlas.aggregate.discoveries.all(),
      latestObservation: this.atlas.observations.at(-1) ?? null,
      latestResult: this.atlas.results.at(-1) ?? null,
      latestFinding: this.atlas.findings.at(-1) ?? null,
      activeGraphNodeId,
      activeGraphNode: activeGraphNodeId ? graph.getNode(activeGraphNodeId) ?? null : null,
      branches: graph.nodes
        .filter((node) => node.metadata?.discoveryRole === 'branch')
        .map((node) => ({
          id: node.id,
          discoveryId: String(node.metadata?.discoveryId ?? ''),
          label: node.label,
          parentId: node.parentId,
          active: node.id === activeGraphNodeId,
        })),
    };
  }

  ask(input: AskDiscoveryInput): DiscoveryEpisode {
    const observation = this.atlas.observations.find((entry) => entry.id === input.observationId);
    if (!observation) throw new Error(`Observation not found: ${input.observationId}`);
    if (!this.atlas.datasetFingerprint) throw new Error('A loaded dataset is required.');
    if (observation.datasetFingerprint !== this.atlas.datasetFingerprint) {
      throw new Error('The notice belongs to a different dataset.');
    }

    const question = requiredText(input.question, 'Question');
    const discoveryId = this.idFactory('discovery');
    const graph = this.atlas.aggregate.graph;
    const previousActiveId = graph.activeNodeId;

    if (!graph.getNode(observation.id)) {
      graph.addNode({
        id: observation.id,
        kind: 'observation',
        parentId: previousActiveId,
        datasetVersion: observation.datasetVersion,
        datasetFingerprint: observation.datasetFingerprint,
        label: 'Notice',
        timestamp: observation.timestamp,
        metadata: {
          epistemicKind: 'notice',
          description: observation.notes,
          discoveryId,
          discoveryRole: 'notice',
        },
      });
      if (previousActiveId && previousActiveId !== observation.id && graph.getNode(previousActiveId)) {
        graph.connect(previousActiveId, observation.id, 'observes', this.idFactory('edge'));
      }
    }

    const questionId = this.idFactory('question');
    graph.addNode({
      id: questionId,
      kind: 'question',
      parentId: observation.id,
      datasetVersion: this.atlas.datasetVersion,
      datasetFingerprint: this.atlas.datasetFingerprint,
      label: 'Research question',
      timestamp: this.now(),
      metadata: {
        epistemicKind: 'question',
        description: question,
        discoveryId,
        discoveryRole: 'question',
      },
    });
    graph.connect(observation.id, questionId, 'motivates', this.idFactory('edge'));

    const decision = this.atlas.activeRepresentationDecision;
    const episode: DiscoveryEpisode = {
      schemaVersion: DISCOVERY_EPISODE_SCHEMA_VERSION,
      discoveryId,
      investigationId: this.atlas.aggregate.sessionId,
      notice: observation.notes,
      question,
      explorationPath: [observation.id, questionId],
      analyticalTests: [],
      evidenceIds: [observation.id],
      validationStatus: 'UNTESTED',
      representationContext: decision
        ? {
            representationDecisionId: decision.id,
            fitnessModelVersion: decision.fitnessModelVersion,
            fitnessModelArtifactHash: decision.fitnessModelArtifactHash,
            decisionDatasetFingerprint:
              decision.datasetFingerprint ?? decision.provenance.datasetFingerprint,
          }
        : {},
      provenance: {
        datasetFingerprint: this.atlas.datasetFingerprint,
        datasetVersion: this.atlas.datasetVersion,
        kernelVersion: this.atlas.kernelVersion() ?? 'unknown',
        investigationVersion: this.investigationVersion,
        randomSeeds: {},
      },
    };

    this.atlas.aggregate.discoveries.record(episode);
    return episode;
  }

  hypothesise(input: HypothesiseDiscoveryInput): DiscoveryEpisode {
    const episode = this.atlas.aggregate.discoveries.get(input.discoveryId);
    if (!episode) throw new Error(`Discovery not found: ${input.discoveryId}`);
    if (episode.validationStatus !== 'UNTESTED') {
      throw new Error('A hypothesis can only be set before validation begins.');
    }
    if (!episode.question?.trim()) throw new Error('Record a research question before a hypothesis.');
    if (episode.hypothesis?.trim()) throw new Error('This investigation already has a hypothesis.');

    const questionNode = graphNodeForDiscoveryRole(
      this.atlas.aggregate.graph.nodes,
      episode.discoveryId,
      'question',
    );
    if (!questionNode) throw new Error('The research question has no authoritative lineage node.');

    const hypothesis = requiredText(input.hypothesis, 'Hypothesis');
    const hypothesisId = this.idFactory('hypothesis');
    const graph = this.atlas.aggregate.graph;
    graph.addNode({
      id: hypothesisId,
      kind: 'question',
      parentId: questionNode.id,
      datasetVersion: this.atlas.datasetVersion,
      datasetFingerprint: episode.provenance.datasetFingerprint,
      label: 'Hypothesis',
      timestamp: this.now(),
      metadata: {
        epistemicKind: 'hypothesis',
        description: hypothesis,
        discoveryId: episode.discoveryId,
        discoveryRole: 'hypothesis',
      },
    });
    graph.connect(questionNode.id, hypothesisId, 'motivates', this.idFactory('edge'));

    const updated: DiscoveryEpisode = {
      ...episode,
      hypothesis,
      validationStatus: 'UNDER_INVESTIGATION',
      explorationPath: [...episode.explorationPath, hypothesisId],
    };
    this.atlas.aggregate.discoveries.replace(updated);
    return updated;
  }

  recordUnderstanding(input: RecordDiscoveryUnderstandingInput): DiscoveryEpisode {
    const episode = this.atlas.aggregate.discoveries.get(input.discoveryId);
    if (!episode) throw new Error(`Discovery not found: ${input.discoveryId}`);
    if (episode.validationStatus !== 'UNDER_INVESTIGATION') {
      throw new Error('Record a hypothesis before recording understanding.');
    }
    if (episode.conclusion?.trim()) throw new Error('This investigation already has a recorded understanding.');

    const finding = this.atlas.findings.find((entry) => entry.id === input.findingId);
    if (!finding) throw new Error(`Finding not found: ${input.findingId}`);
    if (!sameDatasetFingerprint(episode, finding)) {
      throw new Error('The understanding belongs to a different dataset.');
    }
    if (finding.resultIds.length === 0) {
      throw new Error('Understanding must cite at least one analytical result.');
    }
    const originalNoticeId = episode.evidenceIds[0];
    if (originalNoticeId && !finding.observationIds.includes(originalNoticeId)) {
      throw new Error('Understanding must cite the notice that started this investigation.');
    }

    const results = finding.resultIds.map((resultId) => {
      const result = this.atlas.results.find((entry) => entry.resultId === resultId);
      if (!result) throw new Error(`Analytical evidence not found: ${resultId}`);
      if (!sameDatasetFingerprint(episode, result)) {
        throw new Error(`Analytical evidence belongs to a different dataset: ${resultId}`);
      }
      return result;
    });

    const hypothesisNode = graphNodeForDiscoveryRole(
      this.atlas.aggregate.graph.nodes,
      episode.discoveryId,
      'hypothesis',
    );
    if (!hypothesisNode) throw new Error('The hypothesis has no authoritative lineage node.');

    const graph = this.atlas.aggregate.graph;
    const evidenceNodeId = this.idFactory('reasoning-evidence');
    graph.addNode({
      id: evidenceNodeId,
      kind: 'operation',
      parentId: hypothesisNode.id,
      datasetVersion: finding.datasetVersion,
      datasetFingerprint: finding.datasetFingerprint,
      label: `Evidence · ${results[0]!.spec.operation.op}`,
      timestamp: finding.timestamp,
      operation: results[0]!.spec.operation.op,
      metadata: {
        epistemicKind: 'test',
        description: `Analytical evidence · ${finding.resultIds.join(', ')}`,
        discoveryId: episode.discoveryId,
        discoveryRole: 'test',
        findingId: finding.id,
        resultIds: [...finding.resultIds],
      },
    });
    graph.connect(hypothesisNode.id, evidenceNodeId, 'produces', this.idFactory('edge'));

    const understandingNodeId = this.idFactory('understanding');
    graph.addNode({
      id: understandingNodeId,
      kind: 'conclusion',
      parentId: evidenceNodeId,
      datasetVersion: finding.datasetVersion,
      datasetFingerprint: finding.datasetFingerprint,
      label: 'Understanding',
      timestamp: finding.timestamp,
      metadata: {
        epistemicKind: 'finding',
        description: finding.description,
        discoveryId: episode.discoveryId,
        discoveryRole: 'understanding',
        findingId: finding.id,
        humanJudgement: true,
      },
    });
    graph.connect(evidenceNodeId, understandingNodeId, 'produces', this.idFactory('edge'));

    const updated: DiscoveryEpisode = {
      ...episode,
      conclusion: finding.description,
      evidenceIds: Array.from(
        new Set([
          ...episode.evidenceIds,
          finding.id,
          ...finding.observationIds,
          ...finding.resultIds,
        ]),
      ),
      explorationPath: [...episode.explorationPath, evidenceNodeId, understandingNodeId],
    };
    this.atlas.aggregate.discoveries.replace(updated);
    return updated;
  }

  validate(input: ValidateDiscoveryInput): DiscoveryEpisode {
    const episode = this.atlas.aggregate.discoveries.get(input.discoveryId);
    if (!episode) throw new Error(`Discovery not found: ${input.discoveryId}`);
    if (episode.validationStatus !== 'UNDER_INVESTIGATION') {
      throw new Error(`Discovery ${input.discoveryId} already has a terminal validation outcome.`);
    }
    if (!episode.hypothesis?.trim()) throw new Error('Record a hypothesis before validation.');
    if (!episode.conclusion?.trim()) {
      throw new Error('Record your understanding before validating the hypothesis.');
    }

    const result = this.atlas.results.find((entry) => entry.resultId === input.resultId);
    if (!result) throw new Error(`Analysis evidence not found: ${input.resultId}`);
    if (!sameDatasetFingerprint(episode, result)) {
      throw new Error('The analytical evidence belongs to a different dataset.');
    }
    if (!episode.evidenceIds.includes(result.resultId)) {
      throw new Error('Validation must use analytical evidence cited by the recorded understanding.');
    }

    const test: DiscoveryAnalyticalTest = {
      id: this.idFactory('test'),
      method: result.spec.operation.op,
      evidenceIds: [result.resultId],
      outcome: input.outcome,
      note: `Researcher classified the cited analytical result as ${input.outcome}.`,
    };

    const parent =
      graphNodeForDiscoveryRole(this.atlas.aggregate.graph.nodes, episode.discoveryId, 'understanding') ??
      graphNodeForDiscoveryRole(this.atlas.aggregate.graph.nodes, episode.discoveryId, 'conclusion');
    if (!parent) throw new Error('The recorded understanding has no authoritative lineage node.');

    const graph = this.atlas.aggregate.graph;
    const validationNodeId = this.idFactory('validation');
    const status = validationStatus(input.outcome);
    graph.addNode({
      id: validationNodeId,
      kind: 'conclusion',
      parentId: parent.id,
      datasetVersion: result.datasetVersion,
      datasetFingerprint: result.datasetFingerprint,
      label:
        input.outcome === 'SUPPORTS'
          ? 'Supported'
          : input.outcome === 'REFUTES'
            ? 'Refuted'
            : 'Qualified',
      timestamp: this.now(),
      metadata: {
        epistemicKind: input.outcome === 'REFUTES' ? 'contradiction' : 'finding',
        description: `${status} using ${result.resultId}`,
        discoveryId: episode.discoveryId,
        discoveryRole: 'validation',
        resultId: result.resultId,
        outcome: input.outcome,
        humanJudgement: true,
      },
    });
    graph.connect(
      parent.id,
      validationNodeId,
      input.outcome === 'SUPPORTS'
        ? 'supports'
        : input.outcome === 'REFUTES'
          ? 'refutes'
          : 'produces',
      this.idFactory('edge'),
    );

    const updated: DiscoveryEpisode = {
      ...episode,
      analyticalTests: [...episode.analyticalTests, test],
      evidenceIds: Array.from(new Set([...episode.evidenceIds, result.resultId])),
      validationStatus: status,
      explorationPath: [...episode.explorationPath, validationNodeId],
    };
    this.atlas.aggregate.discoveries.replace(updated);
    return updated;
  }

  /** C4 compatibility: ask + hypothesise in one action. */
  start(input: StartDiscoveryInput): DiscoveryEpisode {
    const episode = this.ask({ observationId: input.observationId, question: input.question });
    return this.hypothesise({ discoveryId: episode.discoveryId, hypothesis: input.hypothesis });
  }

  /**
   * C4 compatibility: combine understanding and validation in one action.
   * This path remains for existing tests/UI; PT5C product surfaces use the
   * progressive NIL journey above.
   */
  recordTest(input: RecordDiscoveryTestInput): DiscoveryEpisode {
    const episode = this.atlas.aggregate.discoveries.get(input.discoveryId);
    if (!episode) throw new Error(`Discovery not found: ${input.discoveryId}`);
    if (episode.validationStatus !== 'UNDER_INVESTIGATION' && episode.validationStatus !== 'UNTESTED') {
      throw new Error(`Discovery ${input.discoveryId} already has a terminal validation outcome.`);
    }

    const result = this.atlas.results.find((entry) => entry.resultId === input.resultId);
    if (!result) throw new Error(`Analysis evidence not found: ${input.resultId}`);
    if (!result.resultId.trim()) throw new Error('Analytical test evidence requires a stable result id.');
    const conclusion = requiredText(input.conclusion, 'Conclusion');
    const hypothesisNode = graphNodeForDiscoveryRole(
      this.atlas.aggregate.graph.nodes,
      episode.discoveryId,
      'hypothesis',
    );
    if (!hypothesisNode) {
      throw new Error(`Discovery ${episode.discoveryId} has no authoritative hypothesis lineage node.`);
    }

    const testId = this.idFactory('test');
    const test: DiscoveryAnalyticalTest = {
      id: testId,
      method: result.spec.operation.op,
      evidenceIds: [result.resultId],
      outcome: input.outcome,
      note: `Researcher classified the cited analytical result as ${input.outcome}.`,
    };

    const graph = this.atlas.aggregate.graph;
    const testNodeId = this.idFactory('reasoning-test');
    graph.addNode({
      id: testNodeId,
      kind: 'operation',
      parentId: hypothesisNode.id,
      datasetVersion: result.datasetVersion,
      datasetFingerprint: result.datasetFingerprint,
      label: `Test · ${result.spec.operation.op}`,
      timestamp: this.now(),
      operation: result.spec.operation.op,
      metadata: {
        epistemicKind: 'test',
        description: `Evidence ${result.resultId} · ${input.outcome}`,
        discoveryId: episode.discoveryId,
        discoveryRole: 'test',
        resultId: result.resultId,
        outcome: input.outcome,
      },
    });
    graph.connect(hypothesisNode.id, testNodeId, 'produces', this.idFactory('edge'));

    const conclusionNodeId = this.idFactory('conclusion');
    graph.addNode({
      id: conclusionNodeId,
      kind: 'conclusion',
      parentId: testNodeId,
      datasetVersion: this.atlas.datasetVersion,
      datasetFingerprint: this.atlas.datasetFingerprint ?? result.datasetFingerprint,
      label: input.outcome === 'REFUTES' ? 'Contradiction' : 'Conclusion',
      timestamp: this.now(),
      metadata: {
        epistemicKind: input.outcome === 'REFUTES' ? 'contradiction' : 'finding',
        description: conclusion,
        discoveryId: episode.discoveryId,
        discoveryRole: 'conclusion',
        resultId: result.resultId,
        outcome: input.outcome,
        humanJudgement: true,
      },
    });
    graph.connect(
      testNodeId,
      conclusionNodeId,
      input.outcome === 'SUPPORTS'
        ? 'supports'
        : input.outcome === 'REFUTES'
          ? 'refutes'
          : 'produces',
      this.idFactory('edge'),
    );

    const updated: DiscoveryEpisode = {
      ...episode,
      analyticalTests: [...episode.analyticalTests, test],
      evidenceIds: Array.from(new Set([...episode.evidenceIds, result.resultId])),
      conclusion,
      validationStatus: validationStatus(input.outcome),
      explorationPath: [...episode.explorationPath, testNodeId, conclusionNodeId],
    };
    this.atlas.aggregate.discoveries.replace(updated);
    return updated;
  }

  recordUnderstandingFromFinding(discoveryId: string, findingId: string): DiscoveryEpisode {
    return this.recordUnderstanding({ discoveryId, findingId });
  }

  returnToConclusion(discoveryId: string): InvestigationNode {
    const episode = this.atlas.aggregate.discoveries.get(discoveryId);
    if (!episode) throw new Error(`Discovery not found: ${discoveryId}`);
    const conclusionNode =
      graphNodeForDiscoveryRole(this.atlas.aggregate.graph.nodes, discoveryId, 'validation') ??
      graphNodeForDiscoveryRole(this.atlas.aggregate.graph.nodes, discoveryId, 'understanding') ??
      graphNodeForDiscoveryRole(this.atlas.aggregate.graph.nodes, discoveryId, 'conclusion');
    if (!conclusionNode) {
      throw new Error(`Discovery ${discoveryId} has no tested conclusion to return to.`);
    }
    if (!this.atlas.aggregate.graph.setActiveNode(conclusionNode.id)) {
      throw new Error(`Conclusion node is unavailable: ${conclusionNode.id}`);
    }
    return conclusionNode;
  }

  branch(input: BranchDiscoveryInput): InvestigationNode {
    const episode = this.atlas.aggregate.discoveries.get(input.discoveryId);
    if (!episode) throw new Error(`Discovery not found: ${input.discoveryId}`);
    if (!episode.conclusion) {
      throw new Error('Record an understanding before branching this reasoning path.');
    }

    const graph = this.atlas.aggregate.graph;
    const conclusionNode =
      graphNodeForDiscoveryRole(graph.nodes, episode.discoveryId, 'validation') ??
      graphNodeForDiscoveryRole(graph.nodes, episode.discoveryId, 'understanding') ??
      graphNodeForDiscoveryRole(graph.nodes, episode.discoveryId, 'conclusion');
    if (!conclusionNode) {
      throw new Error(`Discovery ${episode.discoveryId} has no authoritative conclusion lineage node.`);
    }

    const branchId = this.idFactory('branch');
    const label = input.label?.trim() || 'Branch from understanding';
    graph.addNode({
      id: branchId,
      kind: 'question',
      parentId: conclusionNode.id,
      datasetVersion: this.atlas.datasetVersion,
      datasetFingerprint: this.atlas.datasetFingerprint ?? conclusionNode.datasetFingerprint,
      label,
      timestamp: this.now(),
      metadata: {
        epistemicKind: 'branch_point',
        description: `Investigator-created branch from ${episode.discoveryId}`,
        discoveryId: episode.discoveryId,
        discoveryRole: 'branch',
        humanJudgement: true,
      },
    });
    graph.connect(conclusionNode.id, branchId, 'branches_from', this.idFactory('edge'));
    return graph.getNode(branchId)!;
  }
}
