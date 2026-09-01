import type { AtlasCore } from '../../atlas/AtlasCore.ts';
import type { AnalysisResult, Observation } from '../../atlas/types.ts';
import type {
  DiscoveryAnalyticalTest,
  DiscoveryEpisode,
  DiscoveryValidationStatus,
} from '../../investigation/DiscoveryEpisode.ts';
import { DISCOVERY_EPISODE_SCHEMA_VERSION } from '../../investigation/DiscoveryEpisode.ts';
import type { InvestigationNode } from '../../atlas/domain/InvestigationGraph.ts';

export type DiscoveryTestOutcome = DiscoveryAnalyticalTest['outcome'];

export interface DiscoveryReasoningSnapshot {
  discoveries: readonly DiscoveryEpisode[];
  latestObservation: Observation | null;
  latestResult: AnalysisResult | null;
  activeGraphNodeId: string | null;
  activeGraphNode: InvestigationNode | null;
}

export interface StartDiscoveryInput {
  observationId: string;
  question: string;
  hypothesis: string;
}

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
    if (
      node.metadata?.discoveryId === discoveryId &&
      node.metadata?.discoveryRole === role
    ) {
      return node;
    }
  }
  return null;
}

/**
 * Application-layer authoring seam for explicit researcher reasoning.
 *
 * This service does not calculate analytical truth. It records human-authored
 * question/hypothesis/conclusion text, cites an existing Atlas AnalysisResult
 * for every terminal test outcome, persists the validated lifecycle in the
 * authoritative DiscoveryEpisodeStore, and mirrors only that explicit lineage
 * into InvestigationGraph for Memory Palace presentation.
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
    this.investigationVersion = options.investigationVersion ?? 'c4-discovery-reasoning/1';
    this.idFactory = options.idFactory ?? ((prefix) => {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}-${crypto.randomUUID()}`;
      }
      this.fallbackCounter += 1;
      return `${prefix}-${this.now()}-${this.fallbackCounter}`;
    });
  }

  snapshot(): DiscoveryReasoningSnapshot {
    const activeGraphNodeId = this.atlas.aggregate.graph.activeNodeId;
    return {
      discoveries: this.atlas.aggregate.discoveries.all(),
      latestObservation: this.atlas.observations.at(-1) ?? null,
      latestResult: this.atlas.results.at(-1) ?? null,
      activeGraphNodeId,
      activeGraphNode: activeGraphNodeId
        ? this.atlas.aggregate.graph.getNode(activeGraphNodeId) ?? null
        : null,
    };
  }

  start(input: StartDiscoveryInput): DiscoveryEpisode {
    const observation = this.atlas.observations.find((entry) => entry.id === input.observationId);
    if (!observation) throw new Error(`Observation not found: ${input.observationId}`);
    if (!this.atlas.datasetFingerprint) throw new Error('A loaded dataset is required.');

    const question = requiredText(input.question, 'Question');
    const hypothesis = requiredText(input.hypothesis, 'Hypothesis');
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
        label: 'Observation',
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

    const hypothesisId = this.idFactory('hypothesis');
    graph.addNode({
      id: hypothesisId,
      kind: 'question',
      parentId: questionId,
      datasetVersion: this.atlas.datasetVersion,
      datasetFingerprint: this.atlas.datasetFingerprint,
      label: 'Hypothesis',
      timestamp: this.now(),
      metadata: {
        epistemicKind: 'hypothesis',
        description: hypothesis,
        discoveryId,
        discoveryRole: 'hypothesis',
      },
    });
    graph.connect(questionId, hypothesisId, 'motivates', this.idFactory('edge'));

    const decision = this.atlas.activeRepresentationDecision;
    const episode: DiscoveryEpisode = {
      schemaVersion: DISCOVERY_EPISODE_SCHEMA_VERSION,
      discoveryId,
      investigationId: this.atlas.aggregate.sessionId,
      notice: observation.notes,
      question,
      hypothesis,
      explorationPath: [observation.id, questionId, hypothesisId],
      analyticalTests: [],
      evidenceIds: [observation.id],
      validationStatus: 'UNDER_INVESTIGATION',
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

  returnToConclusion(discoveryId: string): InvestigationNode {
    const episode = this.atlas.aggregate.discoveries.get(discoveryId);
    if (!episode) throw new Error(`Discovery not found: ${discoveryId}`);
    const conclusionNode = graphNodeForDiscoveryRole(
      this.atlas.aggregate.graph.nodes,
      discoveryId,
      'conclusion',
    );
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
      throw new Error('Record a tested conclusion before branching this reasoning path.');
    }

    const graph = this.atlas.aggregate.graph;
    const conclusionNode = graphNodeForDiscoveryRole(graph.nodes, episode.discoveryId, 'conclusion');
    if (!conclusionNode) {
      throw new Error(`Discovery ${episode.discoveryId} has no authoritative conclusion lineage node.`);
    }

    const branchId = this.idFactory('branch');
    const label = input.label?.trim() || 'Branch from conclusion';
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
