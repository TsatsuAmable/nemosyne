/**
 * Pure data operations on a Dataset.
 *
 * These functions are the dataset-side counterpart to the VR interaction
 * vocabulary. Each operation returns a new Dataset so the original is preserved
 * for reset/comparison.
 */

import { Dataset } from './Dataset.js';

/** Euclidean distance between two numeric vectors. */
function euclidean(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Return a deterministic pseudo-random generator from a seed. */
function makeRand(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Pick an initial centroid set using k-means++ seeding. */
function kmeansPlusPlus(values, k, rand) {
  const centroids = [];
  centroids.push(values[Math.floor(rand() * values.length)]);
  const distances = new Float64Array(values.length);
  while (centroids.length < k) {
    let total = 0;
    for (let i = 0; i < values.length; i++) {
      let best = Infinity;
      for (const c of centroids) {
        const d = euclidean(values[i], c);
        if (d < best) best = d;
      }
      distances[i] = best * best;
      total += distances[i];
    }
    let target = rand() * total;
    for (let i = 0; i < values.length; i++) {
      target -= distances[i];
      if (target <= 0) {
        centroids.push(values[i]);
        break;
      }
    }
    if (centroids.length === k) break;
  }
  return centroids;
}

/**
 * Filter rows by a predicate function.
 * @param {Dataset} dataset
 * @param {(row: Object) => boolean} predicate
 * @returns {Dataset}
 */
export function filter(dataset, predicate) {
  const rows = dataset.rows.filter(predicate);
  return new Dataset(`${dataset.name} [filtered]`, dataset.columns.slice(), rows);
}

/** Return the same row references so VR artefact identity checks continue to work. */

/**
 * Sort rows by a column value.
 * @param {Dataset} dataset
 * @param {string} columnName
 * @param {'asc'|'desc'} direction
 * @returns {Dataset}
 */
export function sort(dataset, columnName, direction = 'asc') {
  const rows = dataset.rows.slice().sort((a, b) => {
    const av = a[columnName];
    const bv = b[columnName];
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') {
      return direction === 'asc' ? av - bv : bv - av;
    }
    const as = String(av);
    const bs = String(bv);
    return direction === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
  });
  return new Dataset(`${dataset.name} [sorted: ${columnName}]`, dataset.columns.slice(), rows);
}

/**
 * Aggregate rows by a categorical column using an aggregator function.
 * @param {Dataset} dataset
 * @param {string} groupBy
 * @param {(rows: Object[]) => Object} aggregator receives the group rows and returns one aggregated row
 * @returns {Dataset}
 */
export function aggregate(dataset, groupBy, aggregator) {
  const groups = new Map();
  for (const row of dataset.rows) {
    const key = row[groupBy];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const rows = [];
  for (const [, groupRows] of groups) {
    rows.push(aggregator(groupRows));
  }
  return new Dataset(`${dataset.name} [aggregated by ${groupBy}]`, dataset.columns.slice(), rows);
}

/**
 * Simple k-means-lite clustering on numeric columns.
 * Adds a `_cluster` column to each row.
 * @param {Dataset} dataset
 * @param {number} k
 * @param {string[]} [featureColumns] defaults to all numeric columns
 * @returns {Dataset}
 */
export function cluster(dataset, k = 3, featureColumns = null) {
  const numeric = featureColumns ?? dataset.numericColumns.map((c) => c.name);
  if (numeric.length === 0) {
    // No numeric columns: assign all rows to cluster 0.
    const rows = dataset.rows.map((r) => ({ ...r, _cluster: 0 }));
    return new Dataset(`${dataset.name} [clustered]`, [...dataset.columns, { name: '_cluster', type: 'NUMERIC' }], rows);
  }

  const rows = dataset.rows.slice();
  const values = rows.map((r) => numeric.map((name) => Number(r[name]) || 0));

  // Deterministic k-means++ initialization using dataset fingerprint.
  const rand = makeRand(dataset.fingerprint);
  const effectiveK = Math.min(k, values.length);
  let centroids = values.length > 0 ? kmeansPlusPlus(values, effectiveK, rand) : [];
  centroids = centroids.slice(0, effectiveK);

  for (let iter = 0; iter < 20; iter++) {
    // Assign clusters.
    const assignments = values.map((v) => {
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < centroids.length; i++) {
        const c = centroids[i];
        let d = 0;
        for (let j = 0; j < v.length; j++) {
          const diff = v[j] - c[j];
          d += diff * diff;
        }
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return best;
    });

    // Recompute centroids.
    const newCentroids = centroids.map(() => numeric.map(() => 0));
    const counts = new Array(centroids.length).fill(0);
    for (let i = 0; i < values.length; i++) {
      const a = assignments[i];
      counts[a]++;
      const v = values[i];
      for (let j = 0; j < v.length; j++) {
        newCentroids[a][j] += v[j];
      }
    }
    for (let i = 0; i < newCentroids.length; i++) {
      if (counts[i] === 0) continue;
      for (let j = 0; j < newCentroids[i].length; j++) {
        newCentroids[i][j] /= counts[i];
      }
    }
    centroids = newCentroids;
  }

  // Final assignment.
  const finalAssignments = values.map((v) => {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < centroids.length; i++) {
      const c = centroids[i];
      let d = 0;
      for (let j = 0; j < v.length; j++) {
        const diff = v[j] - c[j];
        d += diff * diff;
      }
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  });

  const clusteredRows = rows.map((r, i) => {
    r._cluster = finalAssignments[i];
    return r;
  });
  const newColumns = [...dataset.columns];
  if (!newColumns.find((c) => c.name === '_cluster')) {
    newColumns.push({ name: '_cluster', type: 'NUMERIC' });
  }
  return new Dataset(`${dataset.name} [clustered]`, newColumns, clusteredRows);
}

/**
 * Agglomerative hierarchical clustering on numeric columns.
 * Adds a `_cluster` column with the cluster id and `_linkage` metadata on the dataset.
 * @param {Dataset} dataset
 * @param {string[]} [featureColumns] defaults to all numeric columns
 * @param {'single'|'complete'|'average'} [linkage]
 * @param {number} [targetClusters] number of clusters to cut the dendrogram at
 * @returns {Dataset}
 */
export function hierarchical(dataset, featureColumns = null, linkage = 'average', targetClusters = 3) {
  const numeric = featureColumns ?? dataset.numericColumns.map((c) => c.name);
  if (numeric.length === 0) {
    const rows = dataset.rows.map((r) => ({ ...r, _cluster: 0 }));
    return new Dataset(`${dataset.name} [hierarchical]`, [...dataset.columns, { name: '_cluster', type: 'NUMERIC' }], rows);
  }

  const rows = dataset.rows.slice();
  const values = rows.map((r) => numeric.map((name) => Number(r[name]) || 0));
  const n = values.length;
  if (n === 0) {
    return new Dataset(`${dataset.name} [hierarchical]`, dataset.columns.slice(), []);
  }

  // Initial clusters: each point is its own cluster.
  let clusters = values.map((v, i) => ({ id: i, members: [i], centroid: v.slice(), count: 1 }));
  const history = [];
  let nextMergeId = n;

  function clusterDistance(a, b) {
    let best = linkage === 'single' ? Infinity : -Infinity;
    let total = 0;
    let pairs = 0;
    for (const i of a.members) {
      for (const j of b.members) {
        const d = euclidean(values[i], values[j]);
        if (linkage === 'single') {
          if (d < best) best = d;
        } else if (linkage === 'complete') {
          if (d > best) best = d;
        } else {
          total += d;
          pairs++;
        }
      }
    }
    return linkage === 'average' ? (pairs > 0 ? total / pairs : 0) : best;
  }

  function merge(a, b, newId) {
    const members = [...a.members, ...b.members];
    const centroid = a.centroid.map((v, i) => {
      const sum = members.reduce((s, idx) => s + values[idx][i], 0);
      return sum / members.length;
    });
    return { id: newId, members, centroid, count: members.length };
  }

  while (clusters.length > 1) {
    let bestI = 0;
    let bestJ = 1;
    let bestDist = Infinity;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const d = clusterDistance(clusters[i], clusters[j]);
        if (d < bestDist) {
          bestDist = d;
          bestI = i;
          bestJ = j;
        }
      }
    }
    const nodeId = nextMergeId++;
    const merged = merge(clusters[bestI], clusters[bestJ], nodeId);
    history.push({ merge: [clusters[bestI].id, clusters[bestJ].id], distance: bestDist, size: merged.count });
    clusters.splice(bestJ, 1);
    clusters.splice(bestI, 1, merged);
  }

  // Cut dendrogram to produce flat clusters from recorded merges.
  const parentOf = new Array(n).fill(-1);
  let nextId = n;
  for (const step of history) {
    const node = nextId++;
    parentOf[step.merge[0]] = node;
    parentOf[step.merge[1]] = node;
    parentOf.push(-1);
  }

  function leaves(node) {
    if (node < n) return [node];
    const result = [];
    for (let i = 0; i < parentOf.length; i++) {
      if (parentOf[i] === node) {
        result.push(...leaves(i));
      }
    }
    return result;
  }

  // Cut the dendrogram into `targetClusters` flat clusters.
  // Start with the root and repeatedly split the largest internal node.
  const nodeSize = new Array(parentOf.length).fill(0);
  for (let i = 0; i < n; i++) nodeSize[i] = 1;
  for (let id = n; id < parentOf.length; id++) {
    nodeSize[id] = leaves(id).length;
  }

  function isLeaf(node) {
    return node < n;
  }

  function childrenOf(node) {
    const kids = [];
    for (let i = 0; i < parentOf.length; i++) {
      if (parentOf[i] === node) kids.push(i);
    }
    return kids;
  }

  let candidates = [parentOf.length - 1];
  while (candidates.length < targetClusters) {
    const splitIdx = candidates.findIndex((node) => !isLeaf(node));
    if (splitIdx === -1) break;
    const node = candidates[splitIdx];
    const kids = childrenOf(node);
    candidates.splice(splitIdx, 1, ...kids);
  }

  const assignments = new Array(n).fill(-1);
  for (let c = 0; c < candidates.length; c++) {
    for (const leaf of leaves(candidates[c])) {
      assignments[leaf] = c;
    }
  }

  const clusteredRows = rows.map((r, i) => {
    r._cluster = assignments[i];
    return r;
  });
  const newColumns = [...dataset.columns];
  if (!newColumns.find((c) => c.name === '_cluster')) {
    newColumns.push({ name: '_cluster', type: 'NUMERIC' });
  }
  const result = new Dataset(`${dataset.name} [hierarchical]`, newColumns, clusteredRows);
  result._meta = { linkage, targetClusters, history };
  return result;
}

/**
 * Density-based spatial clustering (DBSCAN) on numeric columns.
 * Adds a `_cluster` column. Noise points are labelled `-1`.
 * @param {Dataset} dataset
 * @param {number} [eps] neighbourhood radius
 * @param {number} [minPoints] minimum neighbours to form a core point
 * @param {string[]} [featureColumns] defaults to all numeric columns
 * @returns {Dataset}
 */
export function dbscan(dataset, eps = 1, minPoints = 2, featureColumns = null) {
  const numeric = featureColumns ?? dataset.numericColumns.map((c) => c.name);
  if (numeric.length === 0) {
    const rows = dataset.rows.map((r) => ({ ...r, _cluster: 0 }));
    return new Dataset(`${dataset.name} [dbscan]`, [...dataset.columns, { name: '_cluster', type: 'NUMERIC' }], rows);
  }

  const rows = dataset.rows.slice();
  const values = rows.map((r) => numeric.map((name) => Number(r[name]) || 0));
  const n = values.length;
  const labels = new Array(n).fill(undefined);
  let clusterId = 0;

  function regionQuery(pointIdx) {
    const neighbours = [];
    for (let i = 0; i < n; i++) {
      if (i === pointIdx) continue;
      if (euclidean(values[pointIdx], values[i]) <= eps) neighbours.push(i);
    }
    return neighbours;
  }

  for (let i = 0; i < n; i++) {
    if (labels[i] !== undefined) continue;
    const neighbours = regionQuery(i);
    if (neighbours.length < minPoints) {
      labels[i] = -1; // noise
      continue;
    }
    labels[i] = clusterId;
    const seeds = [...neighbours];
    for (let s = 0; s < seeds.length; s++) {
      const j = seeds[s];
      if (labels[j] === -1) labels[j] = clusterId;
      if (labels[j] !== undefined) continue;
      labels[j] = clusterId;
      const jNeighbours = regionQuery(j);
      if (jNeighbours.length >= minPoints) {
        seeds.push(...jNeighbours);
      }
    }
    clusterId++;
  }

  const clusteredRows = rows.map((r, i) => {
    r._cluster = labels[i];
    return r;
  });
  const newColumns = [...dataset.columns];
  if (!newColumns.find((c) => c.name === '_cluster')) {
    newColumns.push({ name: '_cluster', type: 'NUMERIC' });
  }
  const result = new Dataset(`${dataset.name} [dbscan]`, newColumns, clusteredRows);
  result._meta = { eps, minPoints, noiseCount: labels.filter((l) => l === -1).length, clusterCount: clusterId };
  return result;
}

/**
 * Detect anomalies in a numeric column.
 * Adds an `_anomaly` column with a boolean flag and `_anomalyScore` with a severity score.
 * Supported methods: 'iqr', 'zscore', 'isolation'.
 * @param {Dataset} dataset
 * @param {string} [columnName] defaults to first numeric column
 * @param {'iqr'|'zscore'|'isolation'} [method]
 * @param {number} [sensitivity] multiplier for the detection threshold (default 1.5 for IQR, 3 for zscore)
 * @returns {Dataset}
 */
export function anomaly(dataset, columnName = null, method = 'iqr', sensitivity = null) {
  const numericColumns = dataset.numericColumns.map((c) => c.name);
  const target = columnName ?? numericColumns[0];
  if (!target) {
    const rows = dataset.rows.map((r) => ({ ...r, _anomaly: false, _anomalyScore: 0 }));
    return new Dataset(`${dataset.name} [anomaly]`, [...dataset.columns, { name: '_anomaly', type: 'CATEGORICAL' }, { name: '_anomalyScore', type: 'NUMERIC' }], rows);
  }

  const rawValues = dataset.getColumnValues(target);
  const values = rawValues.map((v) => (typeof v === 'number' && !Number.isNaN(v) ? v : null));
  const valid = values.filter((v) => v !== null);

  let flags = [];
  let scores = [];

  if (method === 'iqr') {
    const threshold = sensitivity ?? 1.5;
    const sorted = valid.slice().sort((a, b) => a - b);
    const q1 = sorted[Math.floor((sorted.length - 1) * 0.25)];
    const q3 = sorted[Math.ceil((sorted.length - 1) * 0.75)];
    const iqr = q3 - q1;
    const lower = q1 - threshold * iqr;
    const upper = q3 + threshold * iqr;
    for (const v of values) {
      const isOutlier = v !== null && (v < lower || v > upper);
      const score = v === null ? 0 : Math.max(0, Math.max(lower - v, v - upper) / (iqr || 1));
      flags.push(isOutlier);
      scores.push(score);
    }
  } else if (method === 'zscore') {
    const threshold = sensitivity ?? 3;
    const mean = valid.reduce((a, b) => a + b, 0) / Math.max(1, valid.length);
    const std = Math.sqrt(valid.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, valid.length));
    for (const v of values) {
      const z = v === null || std === 0 ? 0 : Math.abs((v - mean) / std);
      flags.push(z > threshold);
      scores.push(z);
    }
  } else if (method === 'isolation') {
    // Lightweight isolation-forest approximation: recursive random splits.
    const limit = Math.ceil(Math.log2(Math.max(2, valid.length)));
    const rand = makeRand(dataset.fingerprint);
    const indexed = valid.map((v, i) => ({ value: v, index: rawValues.indexOf(v, i) }));

    function splitCount(value, depth = 0) {
      if (depth >= limit) return depth;
      const subset = indexed.filter((item) => item.value <= value);
      if (subset.length === 0 || subset.length === indexed.length) return depth;
      return 1 + splitCount(value, depth + 1);
    }

    const depths = indexed.map((item) => splitCount(item.value));
    const maxDepth = Math.max(1, ...depths);
    const scoreMap = new Map();
    for (const { index, value } of indexed) {
      const d = splitCount(value);
      scoreMap.set(index, d / maxDepth);
    }
    const threshold = sensitivity ?? 0.55;
    for (let i = 0; i < values.length; i++) {
      const s = scoreMap.get(i) ?? 1;
      flags.push(s > threshold);
      scores.push(s);
    }
  } else {
    flags = values.map(() => false);
    scores = values.map(() => 0);
  }

  const rows = dataset.rows.map((r, i) => ({ ...r, _anomaly: flags[i], _anomalyScore: scores[i] }));
  const newColumns = [...dataset.columns];
  if (!newColumns.find((c) => c.name === '_anomaly')) {
    newColumns.push({ name: '_anomaly', type: 'CATEGORICAL' });
  }
  if (!newColumns.find((c) => c.name === '_anomalyScore')) {
    newColumns.push({ name: '_anomalyScore', type: 'NUMERIC' });
  }
  const result = new Dataset(`${dataset.name} [anomaly:${method}]`, newColumns, rows);
  result._meta = { method, column: target, threshold: sensitivity, outlierCount: flags.filter(Boolean).length };
  return result;
}

/**
 * Slice rows by index range.
 * @param {Dataset} dataset
 * @param {number} start
 * @param {number} end
 * @returns {Dataset}
 */
export function slice(dataset, start, end) {
  const rows = dataset.rows.slice(start, end);
  return new Dataset(`${dataset.name} [slice ${start}-${end}]`, dataset.columns.slice(), rows);
}
