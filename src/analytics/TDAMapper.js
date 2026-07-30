/**
 * Lightweight Topological Data Analysis (TDA) toolkit for Nemosyne.
 *
 * Provides:
 *  - approximate Mapper graph from a filter function and clustering inside bins
 *  - persistence intervals for a 1D filtration
 *  - Betti-0 curve from a VR-style proximity graph
 *
 * These are intentionally fast, deterministic, JS-only approximations suitable
 * for live VR datasets, not a replacement for full TDA libraries.
 */

import { hierarchical } from '../data/DatasetOperations.js';

/** Euclidean distance between two numeric vectors (shared features). */
function euclidean(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Approximate Mapper graph.
 *
 * @param {Array<Object>} rows
 * @param {Array<string>} featureColumns
 * @param {(row: Object) => number} filterFn
 * @param {number} bins number of overlapping filter intervals
 * @param {number} overlap fraction of interval overlap (0..0.5)
 * @param {number} linkage 'single' | 'complete' | 'average'
 * @returns {{ nodes: Array<{ id, rows, level, center }>, edges: Array<[number, number]> }}
 */
export function mapper(rows, featureColumns, filterFn, bins = 5, overlap = 0.3, linkage = 'single') {
  if (rows.length === 0) return { nodes: [], edges: [] };

  const values = rows.map((r) => ({
    row: r,
    feature: featureColumns.map((c) => Number(r[c]) || 0),
    f: filterFn(r),
  }));

  const fMin = Math.min(...values.map((v) => v.f));
  const fMax = Math.max(...values.map((v) => v.f), fMin + 1);
  const span = fMax - fMin;
  const step = span / Math.max(1, bins - overlap * 2);

  const nodes = [];
  for (let i = 0; i < bins; i++) {
    const lo = fMin + i * step - overlap * step;
    const hi = lo + step + 2 * overlap * step;
    const bucket = values.filter((v) => v.f >= lo && v.f <= hi);
    if (bucket.length === 0) continue;

    // Cluster each bin into connected components using a tiny threshold.
    const visited = new Set();
    for (let a = 0; a < bucket.length; a++) {
      if (visited.has(a)) continue;
      const cluster = [bucket[a]];
      visited.add(a);
      const stack = [a];
      while (stack.length > 0) {
        const idx = stack.pop();
        for (let b = 0; b < bucket.length; b++) {
          if (visited.has(b)) continue;
          const dist = euclidean(bucket[idx].feature, bucket[b].feature);
          if (dist <= step * 0.5) {
            visited.add(b);
            cluster.push(bucket[b]);
            stack.push(b);
          }
        }
      }
      if (cluster.length >= 1) {
        const centerFeature = cluster[0].feature.map((_, dim) =>
          cluster.reduce((s, p) => s + p.feature[dim], 0) / cluster.length
        );
        nodes.push({
          id: nodes.length,
          rows: cluster.map((p) => p.row),
          level: i,
          center: centerFeature,
          filterCenter: cluster.reduce((s, p) => s + p.f, 0) / cluster.length,
          size: cluster.length,
        });
      }
    }
  }

  // Edges when two nodes share at least one row.
  const rowToNodes = new Map();
  for (const node of nodes) {
    for (const row of node.rows) {
      if (!rowToNodes.has(row)) rowToNodes.set(row, []);
      rowToNodes.get(row).push(node.id);
    }
  }
  const edgeSet = new Set();
  const edges = [];
  for (const nodeIds of rowToNodes.values()) {
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const a = nodeIds[i];
        const b = nodeIds[j];
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push([a, b]);
        }
      }
    }
  }

  return { nodes, edges };
}

/**
 * Persistence intervals for a 1D filtration.
 * Sorts rows by filterFn, then builds a union-find as the threshold grows.
 *
 * @param {Array<Object>} rows
 * @param {(row: Object) => number} filterFn
 * @param {Array<string>} featureColumns
 * @param {number} maxDistance maximum feature distance to consider an edge
 * @returns {Array<{ birth: number, death: number | null }>}
 */
export function persistenceIntervals(rows, filterFn, featureColumns, maxDistance = 1) {
  if (rows.length === 0) return [];

  const values = rows.map((r) => ({
    row: r,
    feature: featureColumns.map((c) => Number(r[c]) || 0),
    f: filterFn(r),
  }));
  values.sort((a, b) => a.f - b.f);

  const n = values.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const rank = new Array(n).fill(0);

  function find(i) {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }

  function union(i, j) {
    const ri = find(i);
    const rj = find(j);
    if (ri === rj) return;
    if (rank[ri] < rank[rj]) parent[ri] = rj;
    else if (rank[ri] > rank[rj]) parent[rj] = ri;
    else {
      parent[rj] = ri;
      rank[ri]++;
    }
  }

  // Sweep filter threshold and record component births.
  const intervals = [];
  const bornAt = new Map();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!bornAt.has(root)) bornAt.set(root, values[i].f);
    for (let j = i + 1; j < n; j++) {
      if (values[j].f - values[i].f > maxDistance) break;
      const d = euclidean(values[i].feature, values[j].feature);
      if (d <= maxDistance) union(i, j);
    }
  }

  // Record final components as infinite deaths; merged components as finite.
  const active = new Map();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!active.has(root)) active.set(root, []);
    active.get(root).push(i);
  }
  for (const [root, members] of active) {
    const death = members.length > 1 ? values[members[members.length - 1]].f : Infinity;
    intervals.push({ birth: bornAt.get(root) ?? values[members[0]].f, death });
  }

  return intervals;
}

/**
 * Betti-0 curve: number of connected components as a function of proximity radius.
 *
 * @param {Array<Object>} rows
 * @param {Array<string>} featureColumns
 * @param {number} samples number of radius samples
 * @param {number} maxRadius
 * @returns {Array<{ radius: number, betti0: number }>}
 */
export function betti0Curve(rows, featureColumns, samples = 20, maxRadius = 5) {
  if (rows.length === 0) return [];

  const features = rows.map((r) => featureColumns.map((c) => Number(r[c]) || 0));
  const n = features.length;
  const max = Math.max(1, maxRadius);
  const result = [];

  for (let s = 0; s < samples; s++) {
    const radius = (s / Math.max(1, samples - 1)) * max;
    const parent = Array.from({ length: n }, (_, i) => i);
    function find(i) {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    }
    function union(i, j) {
      const ri = find(i);
      const rj = find(j);
      if (ri !== rj) parent[rj] = ri;
    }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (euclidean(features[i], features[j]) <= radius) union(i, j);
      }
    }
    const roots = new Set();
    for (let i = 0; i < n; i++) roots.add(find(i));
    result.push({ radius, betti0: roots.size });
  }
  return result;
}
