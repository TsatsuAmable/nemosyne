import type { Provenance } from '../data/types.ts';
import type {
  AnalyticalAction,
  AnalyticalEvidence,
  AtlasRecommendation,
} from './types.ts';
import type { DiscoveredStructure, StructureSet } from './structures.ts';

export interface GuidanceOptions {
  minConfidence?: number;
}

export function generateGuidance(
  structureSets: readonly StructureSet[],
  kernelVersion: string,
  options?: GuidanceOptions,
): AtlasRecommendation | null {
  const minConfidence = options?.minConfidence ?? 0;
  const candidates = structureSets
    .flatMap((set) => set.structures.map((structure) => ({ set, structure })))
    .filter((entry) => entry.structure.evidence.score !== undefined)
    .sort((a, b) => (b.structure.evidence.score ?? 0) - (a.structure.evidence.score ?? 0));

  if (candidates.length === 0) return null;

  const best = candidates[0];
  const structure = best.structure;
  const action = actionForKind(structure.kind);
  const evidenceItems = buildEvidenceItems(structure, best.set.id);
  const confidence = computeConfidence(structure, candidates.length);
  if (confidence < minConfidence) return null;

  return {
    targetIds: [structure.id],
    action,
    rationale: rationaleForKind(structure.kind, structure.evidence.rank),
    evidence: evidenceSummary(evidenceItems),
    evidenceItems,
    confidence,
    limitations: limitationsForKind(structure.kind),
    suggestedEmbodiment: embodimentForAction(action),
    provenance: best.set.provenance,
    decision: 'pending',
  };
}

function actionForKind(kind: DiscoveredStructure['kind']): AnalyticalAction {
  switch (kind) {
    case 'cluster':
      return 'inspect-cluster';
    case 'persistent-component':
      return 'inspect-boundary';
    case 'mapper-node':
      return 'explore-region';
  }
}

function buildEvidenceItems(
  structure: DiscoveredStructure,
  setId: string,
): AnalyticalEvidence[] {
  const items: AnalyticalEvidence[] = [
    {
      type: `${structure.evidence.method}-score`,
      value: structure.evidence.score ?? 0,
      source: structure.id,
    },
    {
      type: 'rank',
      value: structure.evidence.rank,
      source: setId,
    },
  ];
  if (structure.rowIndices.length > 0) {
    items.push({
      type: 'membership-size',
      value: structure.rowIndices.length,
      source: structure.id,
    });
  }
  return items;
}

function computeConfidence(structure: DiscoveredStructure, totalCandidates: number): number {
  const score = structure.evidence.score ?? 0;
  if (totalCandidates <= 1) return 1;
  const dominance = score / (score + 0.001);
  const rankPenalty = structure.evidence.rank / totalCandidates;
  return Math.max(0, Math.min(1, dominance * (1 - rankPenalty * 0.2)));
}

function rationaleForKind(kind: DiscoveredStructure['kind'], rank: number): string {
  switch (kind) {
    case 'cluster':
      return `Largest cluster (rank ${rank}) has the highest membership score; inspect for coherent subpopulation structure.`;
    case 'persistent-component':
      return `Most persistent topological feature (rank ${rank}); boundary likely separates distinct data regimes.`;
    case 'mapper-node':
      return `Largest Mapper region (rank ${rank}) covers the most data points; explore for dominant local structure.`;
  }
}

function evidenceSummary(items: AnalyticalEvidence[]): string {
  return items.map((item) => `${item.type}=${item.value.toFixed(3)}`).join(', ');
}

function limitationsForKind(kind: DiscoveredStructure['kind']): string {
  switch (kind) {
    case 'cluster':
      return 'Cluster identity depends on algorithm parameters; validate with domain knowledge.';
    case 'persistent-component':
      return 'Persistence score is scale-dependent; compare against null-model baseline.';
    case 'mapper-node':
      return 'Mapper partition depends on filter function and bin parameters.';
  }
}

function embodimentForAction(action: AnalyticalAction): string {
  switch (action) {
    case 'inspect-cluster':
      return 'highlight-cluster';
    case 'inspect-boundary':
      return 'annotate-boundary';
    case 'explore-region':
      return 'focus-region';
    case 'compare-regions':
      return 'split-view';
    case 'investigate-anomaly':
      return 'outlier-orb';
  }
}

export function propagateProvenance(
  sets: readonly StructureSet[],
): Provenance | null {
  for (let i = sets.length - 1; i >= 0; i--) {
    if (sets[i].provenance) return sets[i].provenance;
  }
  return null;
}