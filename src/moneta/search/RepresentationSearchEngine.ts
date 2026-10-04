/**
 * RepresentationSearchEngine — Multi-objective Pareto search & synthesis engine for FM7.
 *
 * Discovers novel admissible representation candidates outside the fixed catalogue
 * using bounded grammar operators and 7-dimensional Pareto non-dominated sorting.
 *
 * Invariants:
 * 1. Searching or synthesizing representations does not mutate analytical evidence
 *    or dataset fingerprints.
 * 2. System-1 proposals can seed/prune search but cannot bypass grammar rules or
 *    evidence admissibility.
 * 3. Every synthesized candidate carries complete lineage (generation, parentId,
 *    operator, objectiveVector, and paretoRank).
 */

import type { DatasetSignature } from '../representation/DatasetSignature.ts';
import type {
  RepresentationGraph,
  RepresentationPrimitive,
  RepresentationCompositionEdge,
} from '../representation/RepresentationGraph.ts';
import {
  type RepresentationObjectiveVectorV1,
  type ObjectivePreference,
  evaluateRepresentationObjectives,
  computeWeightedUtility,
  paretoDominates,
} from './RepresentationObjectiveModel.ts';
import {
  RepresentationGraphGrammar,
  validateGraphAgainstGrammar,
  ADMISSIBLE_COMPOSITION_RULES,
} from './RepresentationGraphGrammar.ts';
import { DeterministicReferenceComposer } from './DeterministicReferenceComposer.ts';
import type { FormaProposalSetV1 } from '../forma/FormaSystem1Proposer.ts';
import type { CommittedInvestigationContextV2 } from '../../atlas/domain/CommittedInvestigationContext.ts';

export interface SynthesizedCandidate {
  candidateId: string;
  graph: RepresentationGraph;
  objectiveVector: RepresentationObjectiveVectorV1;
  utility: number;
  paretoRank: number;
  lineage: {
    generation: number;
    parentCandidateId?: string;
    operatorApplied: string;
    searchSessionId: string;
  };
}

export interface SearchOptions {
  preference?: ObjectivePreference;
  maxGenerations?: number;
  populationSize?: number;
  system1Proposals?: FormaProposalSetV1;
  context?: CommittedInvestigationContextV2;
}

export interface RepresentationSearchResult {
  searchSessionId: string;
  preference: ObjectivePreference;
  referenceCandidate: SynthesizedCandidate;
  candidates: SynthesizedCandidate[];
  paretoFrontier: SynthesizedCandidate[];
  metrics: {
    totalEvaluated: number;
    admittedCount: number;
    rejectedCount: number;
    generationsCompleted: number;
  };
}

export class RepresentationSearchEngine {
  /**
   * Executes multi-objective search and returns Pareto-optimal candidates.
   */
  public static search(
    signature: DatasetSignature,
    options: SearchOptions = {}
  ): RepresentationSearchResult {
    const preference = options.preference ?? 'BALANCED';
    const maxGenerations = Math.min(10, Math.max(1, options.maxGenerations ?? 3));
    const populationSize = Math.min(24, Math.max(4, options.populationSize ?? 12));
    const sessionSuffix =
      typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
        ? globalThis.crypto.randomUUID().slice(0, 8)
        : `${Date.now().toString(36)}`;
    const searchSessionId = `search-${Date.now().toString(36)}-${sessionSuffix}`;

    let evaluatedCount = 0;
    let rejectedCount = 0;

    // 1. Generate non-stochastic baseline reference candidate
    const refGraph = DeterministicReferenceComposer.composeReferenceGraph(signature, options.context);
    const refObjectives = evaluateRepresentationObjectives(refGraph, signature, {
      task: options.context?.intent?.currentTask,
      variablesOfInterest: options.context?.intent?.variablesOfInterest,
      epistemicPurpose: options.context?.epistemicPurpose,
    });
    const refUtility = computeWeightedUtility(refObjectives, preference);

    const referenceCandidate: SynthesizedCandidate = {
      candidateId: `${refGraph.graphId}-baseline`,
      graph: refGraph,
      objectiveVector: refObjectives,
      utility: refUtility,
      paretoRank: 1,
      lineage: {
        generation: 0,
        operatorApplied: 'DETERMINISTIC_REFERENCE',
        searchSessionId,
      },
    };
    evaluatedCount++;

    // 2. Initialize population
    let population: SynthesizedCandidate[] = [referenceCandidate];

    // Seed from System-1 proposals if available
    if (options.system1Proposals && options.system1Proposals.status === 'PROPOSED') {
      for (const prop of options.system1Proposals.candidates) {
        if (prop.score > 0.5) {
          const s1Graph = RepresentationGraphGrammar.cloneGraph(refGraph);
          s1Graph.graphId = `s1-seeded-${prop.candidateId}`;
          // Add proposed primitive kind
          const newPrim: RepresentationPrimitive = {
            id: `prim-${prop.templateId.toLowerCase()}`,
            kind: prop.templateId.includes('DENSITY') ? 'DENSITY' : 'CLUSTER',
            semanticInputs: ['coordinates'],
            visualEncoding: { style: 'system1_advisory' },
            interactionAffordances: ['inspect'],
            analyticalDependencies: [],
            parameters: {},
            limitations: ['system1_advice'],
          };
          const expanded = RepresentationGraphGrammar.addPrimitive(s1Graph, newPrim);
          const validation = validateGraphAgainstGrammar(expanded);
          if (validation.valid) {
            const objs = evaluateRepresentationObjectives(expanded, signature, {
              task: options.context?.intent?.currentTask,
              variablesOfInterest: options.context?.intent?.variablesOfInterest,
              epistemicPurpose: options.context?.epistemicPurpose,
            });
            population.push({
              candidateId: s1Graph.graphId,
              graph: expanded,
              objectiveVector: objs,
              utility: computeWeightedUtility(objs, preference),
              paretoRank: 1,
              lineage: {
                generation: 0,
                parentCandidateId: referenceCandidate.candidateId,
                operatorApplied: `SYSTEM1_SEED_${prop.candidateId}`,
                searchSessionId,
              },
            });
            evaluatedCount++;
          } else {
            rejectedCount++;
          }
        }
      }
    }

    // 3. Search generations
    for (let gen = 1; gen <= maxGenerations; gen++) {
      const offspring: SynthesizedCandidate[] = [];

      for (const parent of population) {
        // Mutation A: Add complementary primitive
        const candidateGraphA = this.mutateAddPrimitive(parent.graph, signature, gen);
        if (candidateGraphA) {
          const valA = validateGraphAgainstGrammar(candidateGraphA);
          evaluatedCount++;
          if (valA.valid) {
            const objsA = evaluateRepresentationObjectives(candidateGraphA, signature, {
              task: options.context?.intent?.currentTask,
              variablesOfInterest: options.context?.intent?.variablesOfInterest,
              epistemicPurpose: options.context?.epistemicPurpose,
            });
            offspring.push({
              candidateId: candidateGraphA.graphId,
              graph: candidateGraphA,
              objectiveVector: objsA,
              utility: computeWeightedUtility(objsA, preference),
              paretoRank: 1,
              lineage: {
                generation: gen,
                parentCandidateId: parent.candidateId,
                operatorApplied: 'MUTATE_ADD_PRIMITIVE',
                searchSessionId,
              },
            });
          } else {
            rejectedCount++;
          }
        }

        // Mutation B: Add composition edge between unconnected compatible primitives
        const candidateGraphB = this.mutateAddEdge(parent.graph, gen);
        if (candidateGraphB) {
          const valB = validateGraphAgainstGrammar(candidateGraphB);
          evaluatedCount++;
          if (valB.valid) {
            const objsB = evaluateRepresentationObjectives(candidateGraphB, signature, {
              task: options.context?.intent?.currentTask,
              variablesOfInterest: options.context?.intent?.variablesOfInterest,
              epistemicPurpose: options.context?.epistemicPurpose,
            });
            offspring.push({
              candidateId: candidateGraphB.graphId,
              graph: candidateGraphB,
              objectiveVector: objsB,
              utility: computeWeightedUtility(objsB, preference),
              paretoRank: 1,
              lineage: {
                generation: gen,
                parentCandidateId: parent.candidateId,
                operatorApplied: 'MUTATE_ADD_EDGE',
                searchSessionId,
              },
            });
          } else {
            rejectedCount++;
          }
        }
      }

      // Combine population and offspring
      const combined = [...population, ...offspring];

      // Deduplicate by graph structure
      const uniqueMap = new Map<string, SynthesizedCandidate>();
      for (const c of combined) {
        const key = `${c.graph.primitives.map((p) => p.kind).sort().join('+')}:${c.graph.edges.map((e) => `${e.from}-${e.relation}->${e.to}`).sort().join(';')}`;
        if (!uniqueMap.has(key) || uniqueMap.get(key)!.utility < c.utility) {
          uniqueMap.set(key, c);
        }
      }
      const uniqueCandidates = Array.from(uniqueMap.values());

      // Assign Pareto ranks
      this.assignParetoRanks(uniqueCandidates);

      // Sort by Pareto rank ascending, then by weighted utility descending
      uniqueCandidates.sort((a, b) => {
        if (a.paretoRank !== b.paretoRank) return a.paretoRank - b.paretoRank;
        return b.utility - a.utility;
      });

      // Truncate to population size
      population = uniqueCandidates.slice(0, populationSize);
    }

    // Final Pareto frontier: all candidates with paretoRank === 1
    const paretoFrontier = population.filter((c) => c.paretoRank === 1);

    return {
      searchSessionId,
      preference,
      referenceCandidate,
      candidates: population,
      paretoFrontier,
      metrics: {
        totalEvaluated: evaluatedCount,
        admittedCount: population.length,
        rejectedCount,
        generationsCompleted: maxGenerations,
      },
    };
  }

  /**
   * Assigns Pareto ranks using non-dominated sorting.
   */
  private static assignParetoRanks(candidates: SynthesizedCandidate[]): void {
    const n = candidates.length;
    const dominationCounts = new Array<number>(n).fill(0);
    const dominatedSets: number[][] = Array.from({ length: n }, () => []);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        if (paretoDominates(candidates[i].objectiveVector, candidates[j].objectiveVector)) {
          dominatedSets[i].push(j);
        } else if (paretoDominates(candidates[j].objectiveVector, candidates[i].objectiveVector)) {
          dominationCounts[i]++;
        }
      }
    }

    let currentRank = 1;
    let currentFront = candidates
      .map((_, idx) => idx)
      .filter((idx) => dominationCounts[idx] === 0);

    while (currentFront.length > 0) {
      const nextFront: number[] = [];
      for (const p of currentFront) {
        candidates[p].paretoRank = currentRank;
        for (const q of dominatedSets[p]) {
          dominationCounts[q]--;
          if (dominationCounts[q] === 0) {
            nextFront.push(q);
          }
        }
      }
      currentRank++;
      currentFront = nextFront;
    }
  }

  /**
   * Mutation operator: adds an admissible complementary primitive.
   */
  private static mutateAddPrimitive(
    graph: RepresentationGraph,
    signature: DatasetSignature,
    gen: number
  ): RepresentationGraph | null {
    const existingKinds = new Set(graph.primitives.map((p) => p.kind));

    // Select candidate complementary primitive not yet present
    let candidateKind: RepresentationPrimitive['kind'] | null = null;
    if (!existingKinds.has('UNCERTAINTY')) {
      candidateKind = 'UNCERTAINTY';
    } else if (!existingKinds.has('DENSITY') && signature.cardinality.rowCount > 50) {
      candidateKind = 'DENSITY';
    } else if (
      !existingKinds.has('CLUSTER') &&
      (signature.clusterStructure?.hasClusters === true ||
        (signature.clusterStructure?.estimatedCount ?? 0) > 1)
    ) {
      candidateKind = 'CLUSTER';
    } else if (!existingKinds.has('COMPARISON')) {
      candidateKind = 'COMPARISON';
    }

    if (!candidateKind) return null;

    const newId = `synth-prim-${candidateKind.toLowerCase()}-g${gen}`;
    const newPrim: RepresentationPrimitive = {
      id: newId,
      kind: candidateKind,
      semanticInputs: ['dataset_properties'],
      visualEncoding: { channel: 'synthesized_representation' },
      interactionAffordances: ['inspect', 'filter'],
      analyticalDependencies: [],
      parameters: {},
      limitations: [],
    };

    const cloned = RepresentationGraphGrammar.addPrimitive(graph, newPrim);
    cloned.graphId = `synth-graph-g${gen}-${Date.now().toString(36).slice(-4)}`;
    return cloned;
  }

  /**
   * Mutation operator: adds a valid composition edge between existing primitives.
   */
  private static mutateAddEdge(graph: RepresentationGraph, gen: number): RepresentationGraph | null {
    if (graph.primitives.length < 2) return null;

    // Find any valid admissible pair that isn't connected yet
    const existingEdges = new Set(graph.edges.map((e) => `${e.from}->${e.to}`));

    for (const from of graph.primitives) {
      const rules = ADMISSIBLE_COMPOSITION_RULES[from.kind];
      if (!rules) continue;

      for (const to of graph.primitives) {
        if (from.id === to.id) continue;
        const edgeKey = `${from.id}->${to.id}`;
        if (existingEdges.has(edgeKey)) continue;

        const allowed = rules[to.kind];
        if (allowed && allowed.length > 0) {
          const newEdge: RepresentationCompositionEdge = {
            from: from.id,
            to: to.id,
            relation: allowed[0],
          };
          const cloned = RepresentationGraphGrammar.addEdge(graph, newEdge);
          cloned.graphId = `synth-edge-g${gen}-${Date.now().toString(36).slice(-4)}`;
          return cloned;
        }
      }
    }

    return null;
  }
}
