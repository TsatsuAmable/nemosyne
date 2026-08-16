import type { Dataset } from './Dataset.ts';
import { TopologyTypes, type ColumnSchema } from './types.ts';

type TopologyValue = string;

const GRAPH_HINTS = ['source', 'target', 'from', 'to', 'src', 'dst', 'edge'];
const HIERARCHY_HINTS = ['parent', 'child', 'level', 'parentid', 'childid'];
const GEO_HINTS = ['lat', 'latitude', 'lon', 'longitude', 'x', 'y', 'lng'];
const VECTOR_HINTS = ['u', 'v', 'w', 'vx', 'vy', 'vz'];

/**
 * Normalize a column name for fuzzy matching.
 */
function _normalize(name: string): string {
  return name.toLowerCase().replace(/[_\- ]/g, '');
}

/**
 * Find columns whose normalized name matches any hint.
 */
function _findHintedColumns(columns: ColumnSchema[], hints: string[]): ColumnSchema[] {
  return columns.filter((c) => hints.some((h) => _normalize(c.name).includes(h)));
}

export interface EncodingMapping {
  color?: string;
  size?: string;
  pulse?: string;
  time?: string;
  label?: string;
  [key: string]: string | undefined;
}

/**
 * Infer a topology from the dataset schema.
 */
export function inferTopology(dataset: Dataset, explicitTopology?: string): TopologyValue {
  if (explicitTopology && (TopologyTypes as Record<string, string>)[explicitTopology]) {
    return (TopologyTypes as Record<string, string>)[explicitTopology];
  }

  const numeric = dataset.numericColumns.map((c) => c.name);
  const categorical = dataset.categoricalColumns.map((c) => c.name);
  const temporal = dataset.temporalColumns.map((c) => c.name);

  // Graph: explicit edge columns or source/target pairs.
  const graphCols = _findHintedColumns(dataset.columns, GRAPH_HINTS);
  if (graphCols.length >= 2) {
    return TopologyTypes.GRAPH as string;
  }

  // Hierarchy: parent/child/level columns.
  const hierarchyCols = _findHintedColumns(dataset.columns, HIERARCHY_HINTS);
  if (hierarchyCols.length >= 1 && (categorical.length > 0 || numeric.length > 0)) {
    return TopologyTypes.HIERARCHY as string;
  }

  // Geo: lat/lon or x/y coordinate columns.
  const geoCols = _findHintedColumns(dataset.columns, GEO_HINTS);
  if (geoCols.length >= 2) {
    return TopologyTypes.GEO as string;
  }

  // Vector field: u/v/w or vx/vy/vz components.
  const vectorCols = _findHintedColumns(dataset.columns, VECTOR_HINTS);
  if (vectorCols.length >= 2 && numeric.length >= 2) {
    return TopologyTypes.VECTOR_FIELD as string;
  }

  // Time series: temporal column + at least one numeric column.
  if (temporal.length > 0 && numeric.length > 0) {
    return TopologyTypes.TIME_SERIES as string;
  }

  return TopologyTypes.TABULAR as string;
}

/**
 * Suggest default encodings for an inferred topology.
 */
export function inferEncodingsForTopology(dataset: Dataset, topology: string): EncodingMapping {
  const enc: EncodingMapping = {};
  const cat = dataset.categoricalColumns[0]?.name;
  const num = dataset.numericColumns[0]?.name;
  const num2 = dataset.numericColumns[1]?.name;
  const time = dataset.temporalColumns[0]?.name;

  switch (topology) {
    case TopologyTypes.HIERARCHY as string:
      enc.color = cat ?? num;
      enc.size = num;
      enc.pulse = num2;
      break;
    case TopologyTypes.GRAPH as string:
      enc.color = cat ?? num;
      enc.size = num;
      break;
    case TopologyTypes.TIME_SERIES as string:
      enc.color = cat ?? num;
      enc.size = num;
      enc.time = time;
      enc.pulse = num2;
      break;
    case TopologyTypes.VECTOR_FIELD as string:
      enc.color = 'magnitude';
      enc.size = 'magnitude';
      break;
    case TopologyTypes.GEO as string:
      enc.color = cat ?? num;
      enc.size = num;
      enc.label = cat;
      break;
    case TopologyTypes.TABULAR as string:
    default:
      enc.color = cat ?? num;
      enc.size = num;
      break;
  }

  // Drop undefined values so downstream code does not have to guard.
  return Object.fromEntries(Object.entries(enc).filter(([, v]) => v != null));
}
