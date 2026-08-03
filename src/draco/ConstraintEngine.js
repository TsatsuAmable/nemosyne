/**
 * Draco-style constraint engine.
 * Symbolic, explainable recommender that picks a layout/geometry/behavior/interaction
 * specification from data facts and user-tunable soft weights.
 */

export const TopologyTypes = {
  TABULAR: 'TABULAR',
  GRAPH: 'GRAPH',
  HIERARCHY: 'HIERARCHY',
  VECTOR_FIELD: 'VECTOR_FIELD',
  TIME_SERIES: 'TIME_SERIES',
  GEO: 'GEO',
};

export const VRChannels = {
  LAYOUT: [
    'GRID_3D',
    'FORCE_DIRECTED_3D',
    'RADIAL_ORBITAL',
    'VECTOR_STREAMLINE',
    'TIME_RIBBON',
    'GEO_SURFACE',
  ],
  GEOMETRY: [
    'CUBE_MATRIX',
    'ICOSA_NODE',
    'CONICAL_TREE',
    'FLOW_RAY',
    'GEO_COLUMN',
    'CLUSTER_VOLUME',
    'INSTANCED_POINT_CLOUD',
    'AGGREGATE_BARS',
    'ORB',
    'COLUMN',
    'BEAM',
  ],
  BEHAVIOR: ['PULSE_QUANTITATIVE', 'ORBITAL_SPIN', 'WAVE_OSCILLATION', 'STATIC'],
  INTERACTION: [
    'INSPECT_CELL',
    'TRAVERSE_EDGE',
    'DRILL_DOWN',
    'HARVEST_STREAM',
    'CLUSTER_PROBE',
    'FILTER_BRUSH',
    'RESONANCE_PULSE',
    'FORK_PLANE',
    'CHRONO_DIAL',
    'CONSTELLATION',
    'BEACON',
    'ALEPH',
  ],
};

export class ConstraintEngine {
  constructor({
    largeRowThreshold = 500,
    highCardinalityThreshold = 12,
    outlierIqrMultiplier = 1.5,
  } = {}) {
    this.largeRowThreshold = largeRowThreshold;
    this.highCardinalityThreshold = highCardinalityThreshold;
    this.outlierIqrMultiplier = outlierIqrMultiplier;
    this.hardConstraints = [];
    this.softConstraints = [];
    this.registerDefaultRules();
  }

  /** Extract symbolic facts from a dataset + topology hint. */
  extractFacts(dataInput) {
    const ds = dataInput.dataset;
    const rowCount = ds?.rowCount ?? dataInput.rows?.length ?? dataInput.nodes?.length ?? 0;
    const edgeCount = dataInput.edges?.length ?? ds?.edges?.length ?? 0;
    const numericColumns = ds?.numericColumns ?? [];
    const categoricalColumns = ds?.categoricalColumns ?? [];
    const temporalColumns = ds?.temporalColumns ?? [];
    const colorColumn = dataInput.encodings?.color ?? categoricalColumns[0]?.name ?? null;
    const cardinalityOfColor = colorColumn && ds ? ds.cardinalityOf(colorColumn) : 0;
    const numericValues =
      numericColumns.length > 0 && ds
        ? ds
            .getColumnValues(numericColumns[0].name)
            .filter((v) => typeof v === 'number' && !Number.isNaN(v))
        : [];

    const columnStats = {};
    for (const col of numericColumns) {
      if (!ds) continue;
      const values = ds
        .getColumnValues(col.name)
        .filter((v) => typeof v === 'number' && !Number.isNaN(v));
      columnStats[col.name] = this._numericStats(values);
    }

    const categoryDistribution = {};
    for (const col of categoricalColumns) {
      if (!ds) continue;
      categoryDistribution[col.name] = this._categoricalDistribution(ds, col.name);
    }

    const correlationMatrix =
      ds && numericColumns.length >= 2
        ? this._correlationMatrix(
            ds,
            numericColumns.map((c) => c.name)
          )
        : {};

    const primaryTimeColumn = temporalColumns[0]?.name;
    const temporalStats =
      primaryTimeColumn && ds
        ? this._temporalStats(ds, primaryTimeColumn, numericColumns[0]?.name)
        : { trendDirection: 'flat', seasonalityHint: false };

    const primaryStats = columnStats[numericColumns[0]?.name] || {};

    return {
      topology: dataInput.topology || TopologyTypes.TABULAR,
      rowCount,
      nodeCount: dataInput.nodes?.length ?? rowCount,
      edgeCount,
      depth: dataInput.maxDepth ?? ds?.temporalColumns?.length ?? 1,
      numericColumns: numericColumns.length,
      categoricalColumns: categoricalColumns.length,
      temporalColumns: temporalColumns.length,
      hasTimeSeries: dataInput.isTimeSeries || ds?.hasTemporal || false,
      hasContinuousValues: ds?.hasNumeric || numericColumns.length > 0,
      density: edgeCount / Math.max(1, rowCount),
      estimatedDensity: rowCount / 64,
      outlierCount: this._estimateOutlierCount(numericValues),
      cardinalityOfColor,
      hasHighCardinality: cardinalityOfColor > this.highCardinalityThreshold,
      isLargeDataset: rowCount > this.largeRowThreshold,
      clusterCount: this._estimateClusterCount(rowCount, cardinalityOfColor, numericColumns.length),
      // Phase 8 statistical facts.
      columnStats,
      correlationMatrix,
      categoryDistribution,
      trendDirection: temporalStats.trendDirection,
      seasonalityHint: temporalStats.seasonalityHint,
      hasOutliers: this._estimateOutlierCount(numericValues) > 0,
      hasHighVariance: primaryStats.stdDev != null && primaryStats.stdDev > 0,
      numericSkew: primaryStats.skew ?? 0,
      topCategory: categoryDistribution[colorColumn]?.[0]?.value ?? null,
    };
  }

  /** Compute mean, median, stdDev, skew, and kurtosis for a numeric array. */
  _numericStats(values) {
    const n = values.length;
    if (n === 0) {
      return { mean: 0, median: 0, stdDev: 0, skew: 0, kurtosis: 0, min: 0, max: 0 };
    }
    const sorted = values.slice().sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[n - 1];
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const median =
      n % 2 === 1 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;

    let variance = 0;
    for (const v of values) {
      const d = v - mean;
      variance += d * d;
    }
    variance /= n;
    const stdDev = Math.sqrt(variance);

    let skew = 0;
    let kurtosis = 0;
    if (stdDev > 1e-9) {
      for (const v of values) {
        const z = (v - mean) / stdDev;
        skew += z * z * z;
        kurtosis += z * z * z * z;
      }
      skew /= n;
      kurtosis = kurtosis / n - 3; // excess kurtosis
    }

    return { mean, median, stdDev, skew, kurtosis, min, max };
  }

  /** Return { topCategories: [{value, count, fraction}], entropy } for a categorical column. */
  _categoricalDistribution(ds, name) {
    const values = ds.getColumnValues(name);
    const counts = new Map();
    for (const v of values) {
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    const n = values.length || 1;
    const sorted = [...counts.entries()]
      .map(([value, count]) => ({ value, count, fraction: count / n }))
      .sort((a, b) => b.count - a.count);

    let entropy = 0;
    for (const { fraction } of sorted) {
      if (fraction > 0) entropy -= fraction * Math.log2(fraction);
    }

    return { topCategories: sorted.slice(0, 5), entropy };
  }

  /** Pearson correlation matrix for numeric columns. */
  _correlationMatrix(ds, names) {
    const columns = names.map((name) =>
      ds.getColumnValues(name).filter((v) => typeof v === 'number' && !Number.isNaN(v))
    );
    const n = columns[0]?.length || 0;
    const matrix = {};
    if (n === 0) return matrix;

    const stats = columns.map((vals) => {
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
      return { mean, std };
    });

    for (let i = 0; i < names.length; i++) {
      matrix[names[i]] = {};
      for (let j = 0; j < names.length; j++) {
        if (stats[i].std === 0 || stats[j].std === 0) {
          matrix[names[i]][names[j]] = i === j ? 1 : 0;
          continue;
        }
        let cov = 0;
        for (let k = 0; k < n; k++) {
          cov += (columns[i][k] - stats[i].mean) * (columns[j][k] - stats[j].mean);
        }
        cov /= n;
        matrix[names[i]][names[j]] = cov / (stats[i].std * stats[j].std);
      }
    }
    return matrix;
  }

  /** Simple trend and seasonality heuristics for a temporal column paired with a numeric value column. */
  _temporalStats(ds, timeColumn, valueColumn) {
    if (!valueColumn || !ds) return { trendDirection: 'flat', seasonalityHint: false };
    const rows = ds.rows.slice().sort((a, b) => new Date(a[timeColumn]) - new Date(b[timeColumn]));
    const values = rows.map((r) => Number(r[valueColumn])).filter((v) => !Number.isNaN(v));
    if (values.length < 3) return { trendDirection: 'flat', seasonalityHint: false };

    // Linear regression slope via least squares (x = 0..n-1).
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (values[i] - yMean);
      den += (i - xMean) ** 2;
    }
    const slope = den > 0 ? num / den : 0;
    const range = Math.max(...values) - Math.min(...values);
    const normalizedSlope = range > 0 ? slope / range : 0;

    let trendDirection = 'flat';
    if (normalizedSlope > 0.01) trendDirection = 'up';
    else if (normalizedSlope < -0.01) trendDirection = 'down';

    // Very simple seasonality hint: autocorrelation at lag ~ n/4.
    const lag = Math.max(1, Math.floor(n / 4));
    let cov = 0;
    let varA = 0;
    let varB = 0;
    for (let i = 0; i < n - lag; i++) {
      const a = values[i] - yMean;
      const b = values[i + lag] - yMean;
      cov += a * b;
      varA += a * a;
      varB += b * b;
    }
    const corr = varA > 0 && varB > 0 ? cov / Math.sqrt(varA * varB) : 0;
    const seasonalityHint = corr > 0.5;

    return { trendDirection, seasonalityHint, normalizedSlope };
  }

  /** Robust outlier count for the primary numeric channel.
   *  Uses a modified Z-score (MAD-based) so small VR datasets still flag anomalies.
   */
  _estimateOutlierCount(values) {
    if (values.length < 4) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const median =
      sorted.length % 2 === 1
        ? sorted[Math.floor(sorted.length / 2)]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const deviations = values.map((v) => Math.abs(v - median));
    const mad =
      deviations.length % 2 === 1
        ? deviations.slice().sort((a, b) => a - b)[Math.floor(deviations.length / 2)]
        : (deviations.slice().sort((a, b) => a - b)[deviations.length / 2 - 1] +
            deviations.slice().sort((a, b) => a - b)[deviations.length / 2]) /
          2;
    if (mad === 0) {
      // Fall back to IQR when the middle half is degenerate.
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.ceil(sorted.length * 0.75)];
      const iqr = q3 - q1;
      const lower = q1 - this.outlierIqrMultiplier * iqr;
      const upper = q3 + this.outlierIqrMultiplier * iqr;
      return values.filter((v) => v < lower || v > upper).length;
    }
    const threshold = 3.5; // Iglewicz & Hoaglin recommendation.
    return values.filter((v) => {
      const modifiedZ = (0.6745 * (v - median)) / mad;
      return Math.abs(modifiedZ) > threshold;
    }).length;
  }

  /** Heuristic cluster count when no explicit clustering is supplied. */
  _estimateClusterCount(rowCount, cardinalityOfColor, numericColumnCount) {
    if (cardinalityOfColor > 1 && cardinalityOfColor <= 20) return cardinalityOfColor;
    if (numericColumnCount === 0) return 1;
    return Math.min(20, Math.max(1, Math.round(Math.sqrt(rowCount))));
  }

  registerDefaultRules() {
    // Hard constraints eliminate invalid physical/spatial bindings.
    this.hardConstraints.push((facts, spec) => {
      if (facts.topology === TopologyTypes.GRAPH && spec.layout === 'GRID_3D') return false;
      return true;
    });
    this.hardConstraints.push((facts, spec) => {
      if (facts.topology === TopologyTypes.HIERARCHY && spec.layout === 'VECTOR_STREAMLINE')
        return false;
      return true;
    });
    this.hardConstraints.push((facts, spec) => {
      if (facts.topology === TopologyTypes.VECTOR_FIELD && spec.layout !== 'VECTOR_STREAMLINE')
        return false;
      return true;
    });
    this.hardConstraints.push((facts, spec) => {
      if (facts.topology === TopologyTypes.TIME_SERIES && spec.layout !== 'TIME_RIBBON')
        return false;
      return true;
    });
    this.hardConstraints.push((facts, spec) => {
      if (facts.topology === TopologyTypes.GEO && spec.layout !== 'GEO_SURFACE') return false;
      return true;
    });
    // Large datasets must use aggregate or instanced geometry to stay within VR render budget.
    this.hardConstraints.push((facts, spec) => {
      if (facts.isLargeDataset) {
        const scalableGeometries = ['CLUSTER_VOLUME', 'INSTANCED_POINT_CLOUD', 'AGGREGATE_BARS'];
        if (!scalableGeometries.includes(spec.geometry)) return false;
      }
      return true;
    });

    // Soft constraints express weighted preferences.
    this.softConstraints.push({
      name: 'prefer_pulse_for_timeseries',
      weight: 10,
      eval: (facts, spec) =>
        facts.hasTimeSeries && spec.behavior !== 'PULSE_QUANTITATIVE' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_radial_for_deep_hierarchy',
      weight: 15,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.HIERARCHY &&
        facts.depth > 2 &&
        spec.layout !== 'RADIAL_ORBITAL'
          ? 1
          : 0,
    });
    this.softConstraints.push({
      name: 'prefer_grid_for_tabular',
      weight: 8,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.TABULAR && spec.layout !== 'GRID_3D' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'match_interaction_to_topology',
      weight: 12,
      eval: (facts, spec) => {
        if (facts.topology === TopologyTypes.HIERARCHY && spec.interaction !== 'DRILL_DOWN')
          return 1;
        if (facts.topology === TopologyTypes.GRAPH && spec.interaction !== 'TRAVERSE_EDGE')
          return 1;
        if (
          (facts.topology === TopologyTypes.TABULAR || facts.topology === TopologyTypes.GEO) &&
          spec.interaction !== 'INSPECT_CELL'
        )
          return 1;
        if (
          (facts.topology === TopologyTypes.VECTOR_FIELD ||
            facts.topology === TopologyTypes.TIME_SERIES) &&
          spec.interaction !== 'HARVEST_STREAM'
        )
          return 1;
        return 0;
      },
    });
    this.softConstraints.push({
      name: 'prefer_force_directed_for_graphs',
      weight: 14,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.GRAPH && spec.layout !== 'FORCE_DIRECTED_3D' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_streamline_for_vectors',
      weight: 14,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.VECTOR_FIELD && spec.layout !== 'VECTOR_STREAMLINE'
          ? 1
          : 0,
    });
    this.softConstraints.push({
      name: 'prefer_geo_surface_for_geo',
      weight: 14,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.GEO && spec.layout !== 'GEO_SURFACE' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_geo_column_geometry',
      weight: 14,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.GEO && spec.geometry !== 'GEO_COLUMN' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_motion_for_continuous_data',
      weight: 6,
      eval: (facts, spec) => (facts.hasContinuousValues && spec.behavior === 'STATIC' ? 1 : 0),
    });

    // Scale-aware soft constraints (Phase 7).
    this.softConstraints.push({
      name: 'prefer_instanced_for_large_tabular',
      weight: 25,
      eval: (facts, spec) => {
        if (!facts.isLargeDataset || facts.topology !== TopologyTypes.TABULAR) return 0;
        return spec.geometry !== 'INSTANCED_POINT_CLOUD' ? 1 : 0;
      },
    });
    this.softConstraints.push({
      name: 'prefer_aggregate_for_large_geo_or_time',
      weight: 25,
      eval: (facts, spec) => {
        if (!facts.isLargeDataset) return 0;
        if (facts.topology !== TopologyTypes.GEO && facts.topology !== TopologyTypes.TIME_SERIES)
          return 0;
        return spec.geometry !== 'AGGREGATE_BARS' ? 1 : 0;
      },
    });
    this.softConstraints.push({
      name: 'prefer_cluster_volume_for_high_cardinality',
      weight: 18,
      eval: (facts, spec) => {
        if (!facts.hasHighCardinality) return 0;
        return spec.geometry !== 'CLUSTER_VOLUME' ? 1 : 0;
      },
    });
    this.softConstraints.push({
      name: 'prefer_cluster_probe_for_large_datasets',
      weight: 16,
      eval: (facts, spec) => {
        if (!facts.isLargeDataset) return 0;
        return spec.interaction !== 'CLUSTER_PROBE' ? 1 : 0;
      },
    });

    // Phase 7 interaction metaphors (low-weight so base interactions still win
    // by default, but the metaphors are available for weight tuning later).
    this.softConstraints.push({
      name: 'prefer_resonance_for_graphs',
      weight: 8,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.GRAPH && spec.interaction !== 'RESONANCE_PULSE' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_constellation_for_graphs',
      weight: 6,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.GRAPH && spec.interaction !== 'CONSTELLATION' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_aleph_for_dense_graphs',
      weight: 7,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.GRAPH &&
        facts.density > 0.5 &&
        spec.interaction !== 'ALEPH'
          ? 1
          : 0,
    });
    this.softConstraints.push({
      name: 'prefer_chrono_dial_for_timeseries',
      weight: 8,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.TIME_SERIES && spec.interaction !== 'CHRONO_DIAL' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_fork_plane_for_tabular',
      weight: 8,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.TABULAR && spec.interaction !== 'FORK_PLANE' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_beacon_for_geo',
      weight: 8,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.GEO && spec.interaction !== 'BEACON' ? 1 : 0,
    });

    // Phase 8 statistical soft constraints.
    this.softConstraints.push({
      name: 'prefer_orb_for_outliers',
      weight: 12,
      eval: (facts, spec) => {
        if (!facts.hasOutliers) return 0;
        return spec.geometry !== 'ORB' ? 1 : 0;
      },
    });
    this.softConstraints.push({
      name: 'prefer_column_for_high_variance',
      weight: 10,
      eval: (facts, spec) => {
        if (!facts.hasHighVariance || facts.topology !== TopologyTypes.TABULAR) return 0;
        return spec.geometry !== 'COLUMN' ? 1 : 0;
      },
    });
    this.softConstraints.push({
      name: 'prefer_beam_for_correlations',
      weight: 9,
      eval: (facts, spec) => {
        const matrix = facts.correlationMatrix || {};
        const names = Object.keys(matrix);
        if (names.length < 2) return 0;
        let hasStrongCorrelation = false;
        for (let i = 0; i < names.length && !hasStrongCorrelation; i++) {
          for (let j = i + 1; j < names.length && !hasStrongCorrelation; j++) {
            if (Math.abs(matrix[names[i]][names[j]]) > 0.7) hasStrongCorrelation = true;
          }
        }
        if (!hasStrongCorrelation) return 0;
        return spec.geometry !== 'BEAM' ? 1 : 0;
      },
    });
    this.softConstraints.push({
      name: 'prefer_chrono_dial_for_trends',
      weight: 11,
      eval: (facts, spec) => {
        if (facts.trendDirection === 'flat' || facts.topology !== TopologyTypes.TIME_SERIES)
          return 0;
        return spec.interaction !== 'CHRONO_DIAL' ? 1 : 0;
      },
    });
    this.softConstraints.push({
      name: 'prefer_wave_for_seasonality',
      weight: 8,
      eval: (facts, spec) => {
        if (!facts.seasonalityHint) return 0;
        return spec.behavior !== 'WAVE_OSCILLATION' ? 1 : 0;
      },
    });

    // Phase 8 chart-plane attachment rule: prefer chart-plane capable specs
    // when there is rich numeric or temporal data to visualise.
    this.softConstraints.push({
      name: 'attach_chart_plane_for_rich_numeric_or_time',
      weight: 3,
      eval: (facts, spec) => {
        const richData = facts.numericColumns > 1 || facts.hasTimeSeries;
        if (!richData) return 0;
        // This is a preference, not a hard requirement; cost is small so it
        // only nudges the solver toward expressive specs.
        return spec.interaction === 'INSPECT_CELL' ? 0 : 1;
      },
    });
  }

  setWeight(ruleName, weight) {
    const sc = this.softConstraints.find((c) => c.name === ruleName);
    if (sc) sc.weight = Math.max(0, Math.min(100, weight));
  }

  adjustWeight(ruleName, delta) {
    const sc = this.softConstraints.find((c) => c.name === ruleName);
    if (sc) this.setWeight(ruleName, sc.weight + delta);
  }

  solve(dataInput) {
    const facts = this.extractFacts(dataInput);
    const candidates = [];
    for (const layout of VRChannels.LAYOUT) {
      for (const geometry of VRChannels.GEOMETRY) {
        for (const behavior of VRChannels.BEHAVIOR) {
          for (const interaction of VRChannels.INTERACTION) {
            candidates.push({ layout, geometry, behavior, interaction });
          }
        }
      }
    }

    const valid = candidates.filter((spec) => this.hardConstraints.every((hc) => hc(facts, spec)));

    if (valid.length === 0) {
      throw new Error('ConstraintEngine: unsatisfiable constraint set for input facts');
    }

    let bestSpec = null;
    let minCost = Infinity;
    for (const spec of valid) {
      let cost = 0;
      for (const sc of this.softConstraints) {
        cost += sc.eval(facts, spec) * sc.weight;
      }
      if (cost < minCost) {
        minCost = cost;
        bestSpec = spec;
      }
    }

    return { facts, spec: bestSpec, cost: minCost };
  }
}
