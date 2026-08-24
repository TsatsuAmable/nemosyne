use std::collections::{HashMap, HashSet, VecDeque};
use serde::{Deserialize, Serialize};

use crate::data::column::{Column, ColumnType};
use crate::data::columnar::{ColumnarDataset, PrimitiveColumn};
use crate::data::dataset::Dataset;
use crate::data::spectral::{
    compute_spectral_facts, compute_spectral_facts_columnar, SpectralFacts,
};
use crate::data::statistics::{
    compute_statistics, compute_statistics_from_columnar, Facts,
};
use crate::data::value::Value;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DimensionalityProfile {
    pub total_columns: usize,
    pub numeric_columns: usize,
    pub categorical_columns: usize,
    pub temporal_columns: usize,
    pub constant_columns: usize,
    pub redundant_columns: usize,
    pub effective_dimensions: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NumericDistributionSummary {
    pub column: String,
    pub mean: f64,
    pub median: f64,
    pub std_dev: f64,
    pub variance: f64,
    pub min: f64,
    pub max: f64,
    pub iqr: f64,
    pub skewness: f64,
    pub kurtosis: f64,
    pub outlier_count: usize,
    pub is_multimodal: bool,
    pub is_heavy_tailed: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DistributionProfile {
    pub numeric_summaries: Vec<NumericDistributionSummary>,
    pub global_has_outliers: bool,
    pub global_high_variance: bool,
    pub max_skewness: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrelationPairSummary {
    pub column_a: String,
    pub column_b: String,
    pub r: f64,
    pub is_strong: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrelationProfile {
    pub pairs: Vec<CorrelationPairSummary>,
    pub max_correlation: f64,
    pub significant_pairs_count: usize,
    pub is_rank_deficient: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClusterProfile {
    pub estimated_count: usize,
    pub has_clusters: bool,
    pub separation_score: f64,
    pub density_variation: f64,
    pub stability_confidence: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DensityProfile {
    pub global_density: f64,
    pub local_density_variation: f64,
    pub mode_count: usize,
    pub is_sparse: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeriodicityProfile {
    pub frequency: f64,
    pub period_samples: f64,
    pub confidence: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemporalProfile {
    pub is_time_series: bool,
    pub time_column: Option<String>,
    pub trend_direction: String,
    pub trend_strength: f64,
    pub has_seasonality: bool,
    pub periodicities: Vec<PeriodicityProfile>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphProfile {
    pub is_graph: bool,
    pub node_count: usize,
    pub edge_count: usize,
    pub has_cycles: bool,
    pub is_connected: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HierarchyProfile {
    pub is_hierarchy: bool,
    pub depth: usize,
    pub branching_factor: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpatialProfile {
    pub is_geospatial: bool,
    pub coordinate_dimensions: usize,
    pub lat_column: Option<String>,
    pub lon_column: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnomalyProfile {
    pub total_anomalies: usize,
    pub anomaly_fraction: f64,
    pub has_anomalies: bool,
    pub max_anomaly_score: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingnessProfile {
    pub total_missing: usize,
    pub missing_fraction: f64,
    pub has_missingness: bool,
    pub column_missingness: HashMap<String, f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryBucketSummary {
    pub value: String,
    pub count: usize,
    pub fraction: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoricalColumnSummary {
    pub column: String,
    pub cardinality: usize,
    pub entropy: f64,
    pub top_categories: Vec<CategoryBucketSummary>,
    pub is_high_cardinality: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoricalProfile {
    pub summaries: Vec<CategoricalColumnSummary>,
    pub mean_entropy: f64,
    pub has_high_cardinality: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpectralProfile {
    pub dominant_frequencies: Vec<f64>,
    pub spectral_entropy: f64,
    pub power_spectrum_peak: f64,
    pub has_periodicity: bool,
    pub periodicity_confidence: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisProvenance {
    pub kernel_version: String,
    pub dataset_fingerprint: String,
    pub timestamp_ms: u64,
    pub algorithm_suite: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatasetStructureProfile {
    pub dataset_name: String,
    pub row_count: usize,
    pub column_count: usize,

    pub dimensionality: DimensionalityProfile,
    pub distributions: DistributionProfile,
    pub correlations: CorrelationProfile,
    pub clusters: ClusterProfile,
    pub density: DensityProfile,

    pub temporal: Option<TemporalProfile>,
    pub graph: Option<GraphProfile>,
    pub hierarchy: Option<HierarchyProfile>,
    pub spatial: Option<SpatialProfile>,

    pub anomalies: AnomalyProfile,
    pub missingness: MissingnessProfile,
    pub categorical: CategoricalProfile,
    pub spectral: Option<SpectralProfile>,

    pub provenance: AnalysisProvenance,
}

fn compute_true_iqr_and_multimodality(values: &[f64]) -> (f64, bool) {
    if values.len() < 4 {
        return (0.0, false);
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let n = sorted.len();

    let q1_idx = (0.25 * (n - 1) as f64).round() as usize;
    let q3_idx = (0.75 * (n - 1) as f64).round() as usize;
    let iqr = (sorted[q3_idx] - sorted[q1_idx]).max(0.0);

    // Multimodality via 8-bin histogram peak counting with threshold
    let min = sorted[0];
    let max = sorted[n - 1];
    let range = max - min;
    let mut is_multimodal = false;

    if range > 1e-9 && n >= 12 {
        let num_bins = 8;
        let mut bins = vec![0usize; num_bins];
        for &v in &sorted {
            let bin = (((v - min) / range) * (num_bins as f64)).floor() as usize;
            let bin = bin.min(num_bins - 1);
            bins[bin] += 1;
        }

        // Count local peaks with valleys
        let mut peaks = 0;
        for i in 0..num_bins {
            let left = if i == 0 { 0 } else { bins[i - 1] };
            let right = if i + 1 >= num_bins { 0 } else { bins[i + 1] };
            let count = bins[i];
            if count > left && count > right && count >= (n / 10) {
                peaks += 1;
            }
        }
        is_multimodal = peaks >= 2;
    }

    (iqr, is_multimodal)
}

fn evaluate_clusters_from_accessor(
    row_count: usize,
    dimensions: usize,
    mut value_at: impl FnMut(usize, usize) -> Option<f64>,
) -> ClusterProfile {
    if row_count < 6 || dimensions == 0 {
        return ClusterProfile {
            estimated_count: 1,
            has_clusters: false,
            separation_score: 0.0,
            density_variation: 0.0,
            stability_confidence: 0.0,
        };
    }

    let mut min_val = vec![f64::INFINITY; dimensions];
    let mut max_val = vec![f64::NEG_INFINITY; dimensions];
    let mut complete_rows = 0usize;
    let mut values = vec![0.0; dimensions];
    for row in 0..row_count {
        let mut complete = true;
        for dimension in 0..dimensions {
            match value_at(row, dimension) {
                Some(value) if value.is_finite() => values[dimension] = value,
                _ => {
                    complete = false;
                    break;
                }
            }
        }
        if !complete {
            continue;
        }
        complete_rows += 1;
        for dimension in 0..dimensions {
            min_val[dimension] = min_val[dimension].min(values[dimension]);
            max_val[dimension] = max_val[dimension].max(values[dimension]);
        }
    }

    if complete_rows < 6 {
        return ClusterProfile {
            estimated_count: 1,
            has_clusters: false,
            separation_score: 0.0,
            density_variation: 0.0,
            stability_confidence: 0.0,
        };
    }

    let mut best_k = 1;
    let mut best_silhouette = -1.0;

    for k in 2..=3.min(complete_rows / 2) {
        let mut centroids = vec![vec![0.0; dimensions]; k];
        for (index, centroid) in centroids.iter_mut().enumerate() {
            let fraction = (index as f64 + 0.5) / k as f64;
            for coordinate in centroid {
                *coordinate = fraction;
            }
        }

        let mut normalized = vec![0.0; dimensions];
        for _ in 0..5 {
            let mut counts = vec![0usize; k];
            let mut sums = vec![vec![0.0; dimensions]; k];
            for row in 0..row_count {
                let mut complete = true;
                for dimension in 0..dimensions {
                    let Some(value) = value_at(row, dimension).filter(|value| value.is_finite()) else {
                        complete = false;
                        break;
                    };
                    let span = max_val[dimension] - min_val[dimension];
                    normalized[dimension] = if span > 1e-9 {
                        (value - min_val[dimension]) / span
                    } else {
                        0.0
                    };
                }
                if !complete {
                    continue;
                }
                let mut min_dist = f64::INFINITY;
                let mut best_cluster = 0;
                for (cluster, centroid) in centroids.iter().enumerate() {
                    let mut d2 = 0.0;
                    for dimension in 0..dimensions {
                        let diff = normalized[dimension] - centroid[dimension];
                        d2 += diff * diff;
                    }
                    if d2 < min_dist {
                        min_dist = d2;
                        best_cluster = cluster;
                    }
                }
                counts[best_cluster] += 1;
                for dimension in 0..dimensions {
                    sums[best_cluster][dimension] += normalized[dimension];
                }
            }
            for cluster in 0..k {
                if counts[cluster] > 0 {
                    for dimension in 0..dimensions {
                        centroids[cluster][dimension] =
                            sums[cluster][dimension] / counts[cluster] as f64;
                    }
                }
            }
        }

        let mut samples = Vec::with_capacity(complete_rows.min(50));
        for row in 0..row_count {
            let mut complete = true;
            for dimension in 0..dimensions {
                let Some(value) = value_at(row, dimension).filter(|value| value.is_finite()) else {
                    complete = false;
                    break;
                };
                let span = max_val[dimension] - min_val[dimension];
                normalized[dimension] = if span > 1e-9 {
                    (value - min_val[dimension]) / span
                } else {
                    0.0
                };
            }
            if complete {
                samples.push(normalized.clone());
                if samples.len() == 50 {
                    break;
                }
            }
        }
        let assignments: Vec<usize> = samples
            .iter()
            .map(|sample| {
                centroids
                    .iter()
                    .enumerate()
                    .min_by(|(_, a), (_, b)| {
                        let distance_a: f64 = sample
                            .iter()
                            .zip(a.iter())
                            .map(|(value, center)| (value - center).powi(2))
                            .sum();
                        let distance_b: f64 = sample
                            .iter()
                            .zip(b.iter())
                            .map(|(value, center)| (value - center).powi(2))
                            .sum();
                        distance_a
                            .partial_cmp(&distance_b)
                            .unwrap_or(std::cmp::Ordering::Equal)
                    })
                    .map(|(cluster, _)| cluster)
                    .unwrap_or(0)
            })
            .collect();

        let mut s_sum = 0.0;
        let mut valid_samples = 0;
        for i in 0..samples.len() {
            let my_c = assignments[i];
            let mut a_dist = 0.0;
            let mut a_count = 0;
            let mut b_dists = vec![0.0; k];
            let mut b_counts = vec![0usize; k];

            for j in 0..samples.len() {
                if i == j { continue; }
                let other_c = assignments[j];
                let mut dist = 0.0;
                for dimension in 0..dimensions {
                    let diff = samples[i][dimension] - samples[j][dimension];
                    dist += diff * diff;
                }
                dist = dist.sqrt();
                if other_c == my_c {
                    a_dist += dist;
                    a_count += 1;
                } else {
                    b_dists[other_c] += dist;
                    b_counts[other_c] += 1;
                }
            }

            if a_count > 0 {
                let a = a_dist / a_count as f64;
                let mut b = f64::INFINITY;
                for c in 0..k {
                    if c != my_c && b_counts[c] > 0 {
                        let avg_b = b_dists[c] / b_counts[c] as f64;
                        if avg_b < b { b = avg_b; }
                    }
                }
                if b.is_finite() && a.max(b) > 1e-9 {
                    let s = (b - a) / a.max(b);
                    s_sum += s;
                    valid_samples += 1;
                }
            }
        }

        let avg_s = if valid_samples > 0 { s_sum / valid_samples as f64 } else { 0.0 };
        if avg_s > best_silhouette {
            best_silhouette = avg_s;
            best_k = k;
        }
    }

    let has_clusters = best_silhouette > 0.35 && best_k > 1;
    ClusterProfile {
        estimated_count: if has_clusters { best_k } else { 1 },
        has_clusters,
        separation_score: if has_clusters { best_silhouette.clamp(0.0, 1.0) } else { 0.0 },
        density_variation: if has_clusters { 0.25 } else { 0.0 },
        stability_confidence: if has_clusters { (best_silhouette * 0.9).clamp(0.1, 1.0) } else { 0.0 },
    }
}

fn evaluate_clusters(dataset: &Dataset, numeric_cols: &[String]) -> ClusterProfile {
    evaluate_clusters_from_accessor(dataset.rows.len(), numeric_cols.len(), |row, dimension| {
        dataset.rows[row]
            .get(&numeric_cols[dimension])
            .and_then(Value::as_number)
    })
}

fn evaluate_clusters_columnar(
    columnar: &ColumnarDataset,
    numeric_columns: &[usize],
) -> ClusterProfile {
    let sources: Vec<&PrimitiveColumn> = numeric_columns
        .iter()
        .map(|index| {
            columnar
                .primitive_column(*index)
                .expect("validated numeric primitive column must exist")
        })
        .collect();
    evaluate_clusters_from_accessor(columnar.row_count(), sources.len(), |row, dimension| {
        let source = sources[dimension];
        (source.validity[row] != 0).then_some(source.values[row])
    })
}

fn analyze_graph(row_count: usize, edges: &[crate::data::dataset::Edge]) -> (Option<GraphProfile>, Option<HierarchyProfile>) {
    if edges.is_empty() {
        return (None, None);
    }

    let edge_count = edges.len();
    let mut adj: HashMap<usize, Vec<usize>> = HashMap::new();
    let mut in_degrees: HashMap<usize, usize> = HashMap::new();
    let mut nodes = HashSet::new();

    for edge in edges {
        nodes.insert(edge.source);
        nodes.insert(edge.target);
        adj.entry(edge.source).or_default().push(edge.target);
        *in_degrees.entry(edge.target).or_insert(0) += 1;
        in_degrees.entry(edge.source).or_insert(0);
    }

    let node_count = nodes.len().max(row_count);

    // Connected components via BFS
    let mut visited = HashSet::new();
    let mut components = 0;
    for &node in &nodes {
        if !visited.contains(&node) {
            components += 1;
            let mut q = VecDeque::new();
            q.push_back(node);
            visited.insert(node);
            while let Some(curr) = q.pop_front() {
                if let Some(neighbors) = adj.get(&curr) {
                    for &nxt in neighbors {
                        if visited.insert(nxt) {
                            q.push_back(nxt);
                        }
                    }
                }
            }
        }
    }
    let is_connected = components <= 1 && nodes.len() >= row_count;

    // Cycle detection via iterative 3-state DFS (0 = unvisited, 1 = visiting/rec_stack, 2 = visited)
    let mut has_cycles = false;
    let mut node_state: HashMap<usize, u8> = HashMap::new();

    for &start_node in &nodes {
        if node_state.get(&start_node).copied().unwrap_or(0) != 0 {
            continue;
        }

        let mut stack: Vec<(usize, usize)> = vec![(start_node, 0)];
        node_state.insert(start_node, 1);

        while let Some((curr, next_idx)) = stack.pop() {
            let neighbors = adj.get(&curr).map(|v| v.as_slice()).unwrap_or(&[]);
            if next_idx < neighbors.len() {
                let nxt = neighbors[next_idx];
                stack.push((curr, next_idx + 1));
                let nxt_state = node_state.get(&nxt).copied().unwrap_or(0);
                if nxt_state == 1 {
                    has_cycles = true;
                    break;
                } else if nxt_state == 0 {
                    node_state.insert(nxt, 1);
                    stack.push((nxt, 0));
                }
            } else {
                node_state.insert(curr, 2);
            }
        }

        if has_cycles {
            break;
        }
    }

    let is_tree = !has_cycles && (edge_count + 1 == node_count);

    if is_tree {
        // Find roots (in-degree == 0)
        let roots: Vec<usize> = in_degrees.iter().filter(|(_, &deg)| deg == 0).map(|(&n, _)| n).collect();
        let root = roots.first().copied().unwrap_or(0);

        // Compute max depth and branching factor
        let mut depth_q = VecDeque::new();
        depth_q.push_back((root, 1usize));
        let mut max_depth = 1usize;
        let mut total_branches = 0;
        let mut branch_nodes = 0;

        while let Some((curr, d)) = depth_q.pop_front() {
            if d > max_depth { max_depth = d; }
            if let Some(children) = adj.get(&curr) {
                let deg = children.len();
                if deg > 0 {
                    total_branches += deg;
                    branch_nodes += 1;
                    for &c in children {
                        depth_q.push_back((c, d + 1));
                    }
                }
            }
        }

        let branching_factor = if branch_nodes > 0 {
            total_branches as f64 / branch_nodes as f64
        } else {
            1.0
        };

        (
            None,
            Some(HierarchyProfile {
                is_hierarchy: true,
                depth: max_depth,
                branching_factor,
            }),
        )
    } else {
        (
            Some(GraphProfile {
                is_graph: true,
                node_count,
                edge_count,
                has_cycles,
                is_connected,
            }),
            None,
        )
    }
}

pub fn compute_dataset_structure_profile(
    dataset: &Dataset,
    dataset_fingerprint: &str,
    kernel_version: &str,
) -> DatasetStructureProfile {
    let row_count = dataset.rows.len();
    let mut col_missingness = HashMap::new();
    let mut total_missing = 0;
    for col in &dataset.columns {
        let mut missing_in_col = 0;
        for row in &dataset.rows {
            match row.get(&col.name) {
                None | Some(Value::Null) => missing_in_col += 1,
                _ => {}
            }
        }
        total_missing += missing_in_col;
        let frac = if row_count > 0 {
            missing_in_col as f64 / row_count as f64
        } else {
            0.0
        };
        col_missingness.insert(col.name.clone(), frac);
    }
    let total_cells = (row_count as u64) * (dataset.columns.len() as u64);
    let missing_fraction = if total_cells > 0 {
        total_missing as f64 / total_cells as f64
    } else {
        0.0
    };

    let missingness = MissingnessProfile {
        total_missing,
        missing_fraction,
        has_missingness: total_missing > 0,
        column_missingness: col_missingness,
    };
    let stats = compute_statistics(dataset);
    let numeric_col_names: Vec<String> = dataset
        .columns
        .iter()
        .filter(|column| column.ty == ColumnType::Numeric)
        .map(|column| column.name.clone())
        .collect();
    let clusters = evaluate_clusters(dataset, &numeric_col_names);
    let (graph, hierarchy) = dataset
        .edges
        .as_deref()
        .map(|edges| analyze_graph(row_count, edges))
        .unwrap_or((None, None));

    assemble_structure_profile(
        &dataset.name,
        &dataset.columns,
        row_count,
        missingness,
        stats,
        clusters,
        graph,
        hierarchy,
        dataset_fingerprint,
        kernel_version,
        |name| {
            dataset
                .get_column_values(name)
                .into_iter()
                .flatten()
                .filter_map(Value::as_number)
                .filter(|value| value.is_finite())
                .collect()
        },
        |time_column, value_column| {
            compute_spectral_facts(dataset, time_column, value_column)
        },
    )
}

pub fn compute_columnar_dataset_structure_profile(
    dataset_name: &str,
    columns: &[Column],
    columnar: &ColumnarDataset,
    dataset_fingerprint: &str,
    kernel_version: &str,
) -> Result<DatasetStructureProfile, String> {
    let row_count = columnar.row_count();
    let mut column_missingness = HashMap::new();
    let mut total_missing = 0usize;
    for (index, column) in columns.iter().enumerate() {
        let validity = match column.ty {
            ColumnType::Numeric | ColumnType::Temporal => columnar
                .primitive_column(index)
                .map(|source| source.validity.as_slice()),
            ColumnType::Categorical => columnar
                .categorical_column(index)
                .map(|source| source.validity.as_slice()),
            ColumnType::Text | ColumnType::Unknown => {
                return Err(format!(
                    "columnar structure profile does not support {:?} column '{}'",
                    column.ty, column.name
                ));
            }
        }
        .ok_or_else(|| {
            format!(
                "columnar invariant violation: column '{}' at schema index {index} is missing",
                column.name
            )
        })?;
        if validity.len() != row_count {
            return Err(format!(
                "columnar invariant violation: column '{}' validity length {} does not match {row_count} rows",
                column.name,
                validity.len()
            ));
        }
        let missing = validity.iter().filter(|valid| **valid == 0).count();
        total_missing += missing;
        column_missingness.insert(
            column.name.clone(),
            if row_count > 0 {
                missing as f64 / row_count as f64
            } else {
                0.0
            },
        );
    }
    let total_cells = (row_count as u64) * (columns.len() as u64);
    let missingness = MissingnessProfile {
        total_missing,
        missing_fraction: if total_cells > 0 {
            total_missing as f64 / total_cells as f64
        } else {
            0.0
        },
        has_missingness: total_missing > 0,
        column_missingness,
    };
    let stats = compute_statistics_from_columnar(columns, columnar)?;
    let numeric_indices: Vec<usize> = columns
        .iter()
        .enumerate()
        .filter(|(_, column)| column.ty == ColumnType::Numeric)
        .map(|(index, _)| index)
        .collect();
    let clusters = evaluate_clusters_columnar(columnar, &numeric_indices);

    Ok(assemble_structure_profile(
        dataset_name,
        columns,
        row_count,
        missingness,
        stats,
        clusters,
        None,
        None,
        dataset_fingerprint,
        kernel_version,
        |name| {
            let index = columns
                .iter()
                .position(|column| column.name == name)
                .expect("statistics column must exist in schema");
            columnar
                .primitive_column(index)
                .expect("validated numeric primitive column must exist")
                .finite_values()
                .collect()
        },
        |_time_column, value_column| {
            let index = columns.iter().position(|column| column.name == value_column)?;
            compute_spectral_facts_columnar(columnar.primitive_column(index)?)
        },
    ))
}

fn assemble_structure_profile(
    dataset_name: &str,
    columns: &[Column],
    row_count: usize,
    missingness: MissingnessProfile,
    stats: Facts,
    clusters: ClusterProfile,
    graph: Option<GraphProfile>,
    hierarchy: Option<HierarchyProfile>,
    dataset_fingerprint: &str,
    kernel_version: &str,
    mut numeric_values: impl FnMut(&str) -> Vec<f64>,
    mut spectral_facts: impl FnMut(&str, &str) -> Option<SpectralFacts>,
) -> DatasetStructureProfile {
    let column_count = columns.len();
    let numeric_col_count = columns
        .iter()
        .filter(|column| column.ty == ColumnType::Numeric)
        .count();
    let categorical_col_count = columns
        .iter()
        .filter(|column| column.ty == ColumnType::Categorical)
        .count();
    let temporal_col_count = columns
        .iter()
        .filter(|column| column.ty == ColumnType::Temporal)
        .count();

    let mut numeric_summaries = Vec::new();
    let mut global_has_outliers = false;
    let mut global_high_variance = false;
    let mut max_skewness: f64 = 0.0;
    let mut constant_columns = 0;
    let mut max_observed_anomaly_score = 0.0;

    for cs in &stats.numeric {
        let abs_skew = cs.skew.abs();
        if abs_skew > max_skewness {
            max_skewness = abs_skew;
        }
        if cs.outlier_count > 0 {
            global_has_outliers = true;
        }
        if cs.var > 100.0 {
            global_high_variance = true;
        }
        if (cs.max - cs.min).abs() < 1e-9 {
            constant_columns += 1;
        }

        let raw_values = numeric_values(&cs.name);
        let (iqr, is_multimodal) = compute_true_iqr_and_multimodality(&raw_values);

        if cs.outlier_count > 0 && cs.std > 1e-9 {
            let max_dev = (cs.max - cs.mean).abs().max((cs.min - cs.mean).abs());
            let z_score = max_dev / cs.std;
            let score = (z_score / 5.0).clamp(0.0, 1.0);
            if score > max_observed_anomaly_score {
                max_observed_anomaly_score = score;
            }
        }

        numeric_summaries.push(NumericDistributionSummary {
            column: cs.name.clone(),
            mean: cs.mean,
            median: cs.median,
            std_dev: cs.std,
            variance: cs.var,
            min: cs.min,
            max: cs.max,
            iqr,
            skewness: cs.skew,
            kurtosis: cs.kurtosis,
            outlier_count: cs.outlier_count,
            is_multimodal,
            is_heavy_tailed: cs.kurtosis > 3.0,
        });
    }

    let total_anomalies = numeric_summaries.iter().map(|n| n.outlier_count).sum();

    let distributions = DistributionProfile {
        numeric_summaries,
        global_has_outliers,
        global_high_variance,
        max_skewness,
    };

    let mut corr_pairs = Vec::new();
    let mut max_correlation: f64 = 0.0;
    let mut significant_pairs_count = 0;

    for pair in &stats.correlation {
        let abs_r = pair.value.abs();
        if abs_r > max_correlation {
            max_correlation = abs_r;
        }
        let is_strong = abs_r > 0.6;
        if is_strong {
            significant_pairs_count += 1;
        }
        corr_pairs.push(CorrelationPairSummary {
            column_a: pair.a.clone(),
            column_b: pair.b.clone(),
            r: pair.value,
            is_strong,
        });
    }

    let correlations = CorrelationProfile {
        pairs: corr_pairs,
        max_correlation,
        significant_pairs_count,
        is_rank_deficient: max_correlation > 0.98,
    };

    let dimensionality = DimensionalityProfile {
        total_columns: column_count,
        numeric_columns: numeric_col_count,
        categorical_columns: categorical_col_count,
        temporal_columns: temporal_col_count,
        constant_columns,
        redundant_columns: if max_correlation > 0.95 { 1 } else { 0 },
        effective_dimensions: column_count.saturating_sub(constant_columns),
    };

    let mut cat_summaries = Vec::new();
    let mut sum_entropy = 0.0;
    let mut has_high_cardinality = false;

    for cat in &stats.categorical {
        sum_entropy += cat.entropy;
        if cat.cardinality > 20 {
            has_high_cardinality = true;
        }
        let top = cat
            .top
            .iter()
            .map(|t| CategoryBucketSummary {
                value: t.value.clone(),
                count: t.count,
                fraction: if row_count > 0 {
                    t.count as f64 / row_count as f64
                } else {
                    0.0
                },
            })
            .collect();
        cat_summaries.push(CategoricalColumnSummary {
            column: cat.name.clone(),
            cardinality: cat.cardinality,
            entropy: cat.entropy,
            top_categories: top,
            is_high_cardinality: cat.cardinality > 20,
        });
    }

    let categorical = CategoricalProfile {
        mean_entropy: if !stats.categorical.is_empty() {
            sum_entropy / stats.categorical.len() as f64
        } else {
            0.0
        },
        summaries: cat_summaries,
        has_high_cardinality,
    };

    let density = DensityProfile {
        global_density: if row_count >= 50 { 0.7 } else if row_count >= 20 { 0.4 } else { 0.15 },
        local_density_variation: if clusters.has_clusters { 0.3 } else { 0.1 },
        mode_count: clusters.estimated_count,
        is_sparse: row_count < 15,
    };

    let (temporal, spectral) = if !stats.temporal_stats.is_empty() && numeric_col_count > 0 {
        let ts = &stats.temporal_stats[0];
        let computed_spectral_facts = spectral_facts(&ts.column, &ts.value_column);
        let spectral_profile = computed_spectral_facts.as_ref().map(|s| SpectralProfile {
            dominant_frequencies: s.dominant_frequencies.clone(),
            spectral_entropy: s.spectral_entropy,
            power_spectrum_peak: s.power_spectrum_peak,
            has_periodicity: s.has_periodicity,
            periodicity_confidence: s.periodicity_confidence,
        });

        let periodicities = if let Some(ref s) = spectral_profile {
            s.dominant_frequencies
                .iter()
                .map(|&f| PeriodicityProfile {
                    frequency: f,
                    period_samples: if f > 0.0 { 1.0 / f } else { 0.0 },
                    confidence: s.periodicity_confidence,
                })
                .collect()
        } else {
            Vec::new()
        };

        let temp_prof = TemporalProfile {
            is_time_series: true,
            time_column: Some(ts.column.clone()),
            trend_direction: ts.trend_direction.clone(),
            trend_strength: ts.normalized_slope.abs(),
            has_seasonality: spectral_profile
                .as_ref()
                .map(|s| s.has_periodicity)
                .unwrap_or(ts.seasonality_hint),
            periodicities,
        };

        (Some(temp_prof), spectral_profile)
    } else {
        (None, None)
    };

    let mut lat_col = None;
    let mut lon_col = None;
    for col in columns {
        let lower = col.name.to_lowercase();
        if lower == "lat" || lower == "latitude" {
            lat_col = Some(col.name.clone());
        }
        if lower == "lon" || lower == "lng" || lower == "longitude" {
            lon_col = Some(col.name.clone());
        }
    }

    let spatial = if lat_col.is_some() && lon_col.is_some() {
        Some(SpatialProfile {
            is_geospatial: true,
            coordinate_dimensions: 2,
            lat_column: lat_col,
            lon_column: lon_col,
        })
    } else {
        None
    };

    let anomalies = AnomalyProfile {
        total_anomalies,
        anomaly_fraction: if row_count > 0 {
            total_anomalies as f64 / row_count as f64
        } else {
            0.0
        },
        has_anomalies: total_anomalies > 0,
        max_anomaly_score: if total_anomalies > 0 { max_observed_anomaly_score.max(0.2) } else { 0.0 },
    };

    let provenance = AnalysisProvenance {
        kernel_version: kernel_version.to_string(),
        dataset_fingerprint: dataset_fingerprint.to_string(),
        timestamp_ms: 0,
        algorithm_suite: "nemosyne-rust-analytical-core-v1".to_string(),
    };

    DatasetStructureProfile {
        dataset_name: dataset_name.to_string(),
        row_count,
        column_count,
        dimensionality,
        distributions,
        correlations,
        clusters,
        density,
        temporal,
        graph,
        hierarchy,
        spatial,
        anomalies,
        missingness,
        categorical,
        spectral,
        provenance,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_dataset_structure_profile() {
        let mut rows = Vec::new();
        for i in 0..50 {
            let mut row = HashMap::new();
            row.insert("x".to_string(), Value::Number(i as f64));
            row.insert("y".to_string(), Value::Number((i * 2) as f64));
            row.insert("cat".to_string(), Value::Text(if i % 2 == 0 { "A".to_string() } else { "B".to_string() }));
            rows.push(row);
        }

        let dataset = Dataset::new(
            "test_ds".to_string(),
            vec![
                Column::new("x".to_string(), ColumnType::Numeric),
                Column::new("y".to_string(), ColumnType::Numeric),
                Column::new("cat".to_string(), ColumnType::Categorical),
            ],
            rows,
        );

        let profile = compute_dataset_structure_profile(&dataset, "fp-test", "0.1.0");
        assert_eq!(profile.row_count, 50);
        assert_eq!(profile.column_count, 3);
        assert_eq!(profile.dimensionality.numeric_columns, 2);
        assert_eq!(profile.dimensionality.categorical_columns, 1);
        assert!(profile.correlations.max_correlation > 0.99);
        assert_eq!(profile.categorical.summaries.len(), 1);
    }

    #[test]
    fn columnar_profile_matches_row_profile_without_materialising_rows() {
        let rows: Vec<HashMap<String, Value>> = (0..64)
            .map(|index| {
                HashMap::from([
                    ("time".to_string(), Value::Number(index as f64)),
                    (
                        "value".to_string(),
                        if index == 7 {
                            Value::Null
                        } else {
                            Value::Number(((index as f64) / 4.0).sin())
                        },
                    ),
                    (
                        "cohort".to_string(),
                        if index == 11 {
                            Value::Null
                        } else {
                            Value::Text(if index % 2 == 0 { "A" } else { "B" }.to_string())
                        },
                    ),
                ])
            })
            .collect();
        let dataset = Dataset::new(
            "profile-parity",
            vec![
                Column::new("time", ColumnType::Temporal),
                Column::new("value", ColumnType::Numeric),
                Column::new("cohort", ColumnType::Categorical),
            ],
            rows,
        );
        let fingerprint = dataset.fingerprint();
        let columnar = ColumnarDataset::from_dataset(&dataset);

        let row_profile =
            compute_dataset_structure_profile(&dataset, &fingerprint, "0.1.0");
        let columnar_profile = compute_columnar_dataset_structure_profile(
            &dataset.name,
            &dataset.columns,
            &columnar,
            &fingerprint,
            "0.1.0",
        )
        .expect("columnar profile");

        assert_eq!(columnar_profile, row_profile);
    }
}
