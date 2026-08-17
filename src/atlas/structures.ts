import type { PersistenceInterval, Provenance, TdaMapperGraph } from '../data/types.ts';

export type StructureKind = 'mapper-node' | 'persistent-component' | 'cluster';

export interface StructureEvidence {
  method: 'mapper' | 'persistence' | 'cluster';
  parameters: Record<string, unknown>;
  rank: number;
  score?: number;
}

export interface DiscoveredStructure {
  id: string;
  kind: StructureKind;
  rowIndices: number[];
  datumIds: string[];
  evidence: StructureEvidence;
}

export interface StructureSet {
  id: string;
  datasetFingerprint: string;
  datasetVersion: number;
  algorithmVersion: string;
  structures: DiscoveredStructure[];
  provenance: Provenance | null;
}

function structureId(
  datasetFingerprint: string,
  method: StructureEvidence['method'],
  parameters: Record<string, unknown>,
  rowIndices: number[],
  rank: number,
): string {
  return `${datasetFingerprint}:structure-${method}-${rank}-${rowIndices.join(',')}-${canonicalParams(parameters)}`;
}

function canonicalParams(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalParams(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalParams((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function mapMapperStructures(
  graph: TdaMapperGraph,
  datumIds: readonly string[],
  datasetFingerprint: string,
  datasetVersion: number,
  algorithmVersion: string,
  parameters: Record<string, unknown>,
  provenance: Provenance | null,
): StructureSet {
  const structures = [...graph.nodes]
    .sort((a, b) => a.id - b.id)
    .map((node, rank) => {
      const rowIndices = [...node.rowIndices].sort((a, b) => a - b);
      return {
        id: structureId(datasetFingerprint, 'mapper', parameters, rowIndices, rank),
        kind: 'mapper-node' as const,
        rowIndices,
        datumIds: rowIndices.map((index) => datumIds[index]).filter((id): id is string => !!id),
        evidence: {
          method: 'mapper' as const,
          parameters: { ...parameters },
          rank,
          score: node.size,
        },
      };
    });
  return {
    id: `${datasetFingerprint}:structures-mapper-${canonicalParams(parameters)}`,
    datasetFingerprint,
    datasetVersion,
    algorithmVersion,
    structures,
    provenance,
  };
}

export function mapPersistenceStructures(
  intervals: PersistenceInterval[],
  datasetFingerprint: string,
  datasetVersion: number,
  algorithmVersion: string,
  parameters: Record<string, unknown>,
  provenance: Provenance | null,
): StructureSet {
  const structures = intervals
    .map((interval, index) => ({ interval, index }))
    .sort((a, b) => a.interval.birth - b.interval.birth || a.index - b.index)
    .map(({ interval }, rank) => ({
      id: structureId(datasetFingerprint, 'persistence', parameters, [], rank),
      kind: 'persistent-component' as const,
      rowIndices: [],
      datumIds: [],
      evidence: {
        method: 'persistence' as const,
        parameters: { ...parameters },
        rank,
        score: (interval.death ?? interval.birth) - interval.birth,
      },
    }));
  return {
    id: `${datasetFingerprint}:structures-persistence-${canonicalParams(parameters)}`,
    datasetFingerprint,
    datasetVersion,
    algorithmVersion,
    structures,
    provenance,
  };
}

export function mapClusterStructures(
  assignments: readonly number[],
  datumIds: readonly string[],
  datasetFingerprint: string,
  datasetVersion: number,
  algorithmVersion: string,
  parameters: Record<string, unknown>,
  provenance: Provenance | null,
): StructureSet {
  const groups = new Map<number, number[]>();
  assignments.forEach((label, index) => {
    const rows = groups.get(label) ?? [];
    rows.push(index);
    groups.set(label, rows);
  });
  const structures = [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([label, rowIndices], rank) => ({
      id: structureId(datasetFingerprint, 'cluster', parameters, rowIndices, rank),
      kind: 'cluster' as const,
      rowIndices,
      datumIds: rowIndices.map((index) => datumIds[index]).filter((id): id is string => !!id),
      evidence: {
        method: 'cluster' as const,
        parameters: { ...parameters, label },
        rank,
        score: rowIndices.length,
      },
    }));
  return {
    id: `${datasetFingerprint}:structures-cluster-${canonicalParams(parameters)}`,
    datasetFingerprint,
    datasetVersion,
    algorithmVersion,
    structures,
    provenance,
  };
}
