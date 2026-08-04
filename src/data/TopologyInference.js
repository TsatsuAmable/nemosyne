import { TopologyTypes } from '../draco/ConstraintEngine.js';

/**
 * Heuristic topology inference from dataset column names and types.
 *
 * The goal is to pick a sensible default so a user can drop a CSV onto
 * Nemosyne and see an appropriate memory palace without manually selecting a
 * topology. Every rule can be overridden by the user in the loader UI.
 */

const GRAPH_HINTS = ['source', 'target', 'from', 'to', 'src', 'dst', 'edge'];
const HIERARCHY_HINTS = ['parent', 'child', 'level', 'parentid', 'childid'];
const GEO_HINTS = ['lat', 'latitude', 'lon', 'longitude', 'x', 'y', 'lng'];
const VECTOR_HINTS = ['u', 'v', 'w', 'vx', 'vy', 'vz'];

/**
 * Normalize a column name for fuzzy matching.
 */
function _normalize(name) {
  return name.toLowerCase().replace(/[_\- ]/g, '');
}

/**
 * Find columns whose normalized name matches any hint.
 */
function _findHintedColumns(columns, hints) {
  return columns.filter((c) => hints.some((h) => _normalize(c.name).includes(h)));
}

/**
 * Infer a topology from the dataset schema.
 *
 * @param {import('./Dataset.ts').Dataset} dataset
 * @param {string} [explicitTopology] Optional user override.
 * @returns {string} A value from TopologyTypes.
 */
export function inferTopology(dataset, explicitTopology) {
  if (explicitTopology && TopologyTypes[explicitTopology]) {
    return TopologyTypes[explicitTopology];
  }

  const numeric = dataset.numericColumns.map((c) => c.name);
  const categorical = dataset.categoricalColumns.map((c) => c.name);
  const temporal = dataset.temporalColumns.map((c) => c.name);
  const allNames = dataset.columns.map((c) => c.name);

  // Graph: explicit edge columns or source/target pairs.
  const graphCols = _findHintedColumns(dataset.columns, GRAPH_HINTS);
  if (graphCols.length >= 2) {
    return TopologyTypes.GRAPH;
  }

  // Hierarchy: parent/child/level columns.
  const hierarchyCols = _findHintedColumns(dataset.columns, HIERARCHY_HINTS);
  if (hierarchyCols.length >= 1 && (categorical.length > 0 || numeric.length > 0)) {
    return TopologyTypes.HIERARCHY;
  }

  // Geo: lat/lon or x/y coordinate columns.
  const geoCols = _findHintedColumns(dataset.columns, GEO_HINTS);
  if (geoCols.length >= 2) {
    return TopologyTypes.GEO;
  }

  // Vector field: u/v/w or vx/vy/vz components.
  const vectorCols = _findHintedColumns(dataset.columns, VECTOR_HINTS);
  if (vectorCols.length >= 2 && numeric.length >= 2) {
    return TopologyTypes.VECTOR_FIELD;
  }

  // Time series: temporal column + at least one numeric column.
  if (temporal.length > 0 && numeric.length > 0) {
    return TopologyTypes.TIME_SERIES;
  }

  return TopologyTypes.TABULAR;
}

/**
 * Suggest default encodings for an inferred topology.
 *
 * @param {import('./Dataset.ts').Dataset} dataset
 * @param {string} topology
 * @returns {Object} Encodings object suitable for `World.loadDataset`.
 */
export function inferEncodingsForTopology(dataset, topology) {
  const enc = {};
  const cat = dataset.categoricalColumns[0]?.name;
  const num = dataset.numericColumns[0]?.name;
  const num2 = dataset.numericColumns[1]?.name;
  const time = dataset.temporalColumns[0]?.name;

  switch (topology) {
    case TopologyTypes.HIERARCHY:
      enc.color = cat ?? num;
      enc.size = num;
      enc.pulse = num2;
      break;
    case TopologyTypes.GRAPH:
      enc.color = cat ?? num;
      enc.size = num;
      break;
    case TopologyTypes.TIME_SERIES:
      enc.color = cat ?? num;
      enc.size = num;
      enc.time = time;
      enc.pulse = num2;
      break;
    case TopologyTypes.VECTOR_FIELD:
      enc.color = 'magnitude';
      enc.size = 'magnitude';
      break;
    case TopologyTypes.GEO:
      enc.color = cat ?? num;
      enc.size = num;
      enc.label = cat;
      break;
    case TopologyTypes.TABULAR:
    default:
      enc.color = cat ?? num;
      enc.size = num;
      break;
  }

  // Drop undefined values so downstream code does not have to guard.
  return Object.fromEntries(Object.entries(enc).filter(([, v]) => v != null));
}
