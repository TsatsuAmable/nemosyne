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

interface ScoredStructure {
  set: StructureSet;
  structure: DiscoveredStructure;
}

export function generateGuidance(
  structureSets: readonly StructureSet[],
  _kernelVersion: string,
  options?: GuidanceOptions,
): AtlasRecommendation | null {
  const minConfidence = options?.minConfidence ?? 0;
  const candidates = scoreAndSort(structureSets);
  if (candidates.length === 0) return null;

  const anomaly = detectAnomaly(candidates);
  if (anomaly && anomaly.confidence >= minConfidence) return anomaly;

  const comparison = detectComparison(candidates);
  if (comparison && comparison.confidence >= minConfidence) return comparison;

  const single = bestSingle(candidates);
  if (single && single.confidence >= minConfidence) return single;

  return null;
}

function scoreAndSort(structureSets: readonly StructureSet[]): ScoredStructure[] {
  return structureSets
    .flatMap((set) => set.structures.map((structure) => ({ set, structure })))
    .filter((entry) => entry.structure.evidence.score !== undefined)
    .sort((a, b) => (b.structure.evidence.score ?? 0) - (a.structure.evidence.score ?? 0));
}

function bestSingle(candidates: ScoredStructure[]): AtlasRecommendation | null {
  if (candidates.length === 0) return null;
  const best = candidates[0];
  const structure = best.structure;
  const action = actionForKind(structure.kind);
  const evidenceItems = buildEvidenceItems(structure, best.set.id);
  const confidence = computeConfidence(structure, candidates.length);

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

function detectComparison(candidates: ScoredStructure[]): AtlasRecommendation | null {
  const clusters = candidates.filter((c) => c.structure.kind === 'cluster');
  if (clusters.length < 2) return null;

  const topTwo = clusters.slice(0, 2);
  const [a, b] = topTwo;
  const scoreA = a.structure.evidence.score ?? 0;
  const scoreB = b.structure.evidence.score ?? 0;
  const scoreGap = Math.abs(scoreA - scoreB);
  const meanScore = (scoreA + scoreB) / 2;
  const relativeGap = meanScore > 0 ? scoreGap / meanScore : 0;

  if (relativeGap < 0.15) return null;

  const evidenceItems: AnalyticalEvidence[] = [
    {
      type: 'cluster-size-delta',
      value: scoreGap,
      source: `${a.structure.id},${b.structure.id}`,
    },
    {
      type: 'relative-gap',
      value: relativeGap,
      source: `${a.set.id},${b.set.id}`,
    },
    ...buildEvidenceItems(a.structure, a.set.id),
    ...buildEvidenceItems(b.structure, b.set.id),
  ];

  const confidence = Math.min(1, relativeGap * 2);

  return {
    targetIds: [a.structure.id, b.structure.id],
    action: 'compare-regions',
    rationale: `Two clusters show a ${(relativeGap * 100).toFixed(0)}% size disparity (scores ${scoreA.toFixed(1)} vs ${scoreB.toFixed(1)}); compare their memberships for structural divergence.`,
    evidence: evidenceSummary(evidenceItems),
    evidenceItems,
    confidence,
    limitations: 'Comparison assumes same clustering parameters; validate with domain knowledge.',
    suggestedEmbodiment: 'split-view',
    provenance: a.set.provenance ?? b.set.provenance,
    decision: 'pending',
  };
}

function detectAnomaly(candidates: ScoredStructure[]): AtlasRecommendation | null {
  const anomalies = candidates.filter((c) => isAnomalous(c.structure));
  if (anomalies.length === 0) return null;

  const best = anomalies[0];
  const structure = best.structure;
  const evidenceItems: AnalyticalEvidence[] = [
    {
      type: 'anomaly-score',
      value: structure.evidence.score ?? 0,
      source: structure.id,
    },
    {
      type: 'membership-size',
      value: structure.rowIndices.length,
      source: structure.id,
    },
    ...buildEvidenceItems(structure, best.set.id),
  ];

  const allScores = candidates.map((c) => c.structure.evidence.score ?? 0);
  const meanScore = allScores.reduce((s, v) => s + v, 0) / allScores.length;
  const deviation = meanScore > 0 ? Math.abs((structure.evidence.score ?? 0) - meanScore) / meanScore : 0;
  const confidence = Math.min(1, deviation * 1.5);

  return {
    targetIds: [structure.id],
    action: 'investigate-anomaly',
    rationale: anomalyRationale(structure),
    evidence: evidenceSummary(evidenceItems),
    evidenceItems,
    confidence,
    limitations: 'Anomaly detection is relative to current structure set; validate against domain baseline.',
    suggestedEmbodiment: 'outlier-orb',
    provenance: best.set.provenance,
    decision: 'pending',
  };
}

function isAnomalous(structure: DiscoveredStructure): boolean {
  if (structure.kind === 'cluster') {
    const params = structure.evidence.parameters as Record<string, unknown>;
    if (params.label === -1 || params.label === '-1') return true;
    return false;
  }
  if (structure.kind === 'persistent-component') {
    const score = structure.evidence.score ?? 0;
    return score > 0 && score < 0.5;
  }
  return false;
}

function anomalyRationale(structure: DiscoveredStructure): string {
  if (structure.kind === 'cluster') {
    const params = structure.evidence.parameters as Record<string, unknown>;
    if (params.label === -1 || params.label === '-1') {
      return 'DBSCAN noise cluster (label -1) contains unclassified points; investigate as potential anomalies.';
    }
    return `Cluster ${structure.evidence.parameters.label} is unusually small (${structure.rowIndices.length} members); investigate as potential outlier micro-cluster.`;
  }
  if (structure.kind === 'persistent-component') {
    return `Low-persistence feature (score ${structure.evidence.score?.toFixed(3)}) may represent noise; investigate before interpreting as real structure.`;
  }
  return 'Anomalous structure detected; investigate before drawing conclusions.';
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