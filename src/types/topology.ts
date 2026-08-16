/**
 * Shared Topology Data Types & Runtime Constants.
 *
 * Enforces strict unidirectional data flow across Nemosyne layers:
 * Data Ingestion (src/data/) → Draco Engine (src/draco/) → VR Runtime (src/vr/)
 */

export type TopologyType =
  | 'HIERARCHY'
  | 'GRAPH'
  | 'TIME_SERIES'
  | 'TABULAR'
  | 'VECTOR_FIELD'
  | 'GEO';

export const TopologyTypes = {
  TABULAR: 'TABULAR',
  GRAPH: 'GRAPH',
  HIERARCHY: 'HIERARCHY',
  VECTOR_FIELD: 'VECTOR_FIELD',
  TIME_SERIES: 'TIME_SERIES',
  GEO: 'GEO',
} as const;
