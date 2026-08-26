use serde::{Deserialize, Serialize};
use std::collections::{BinaryHeap, HashMap, HashSet, VecDeque};

use crate::data::column::{Column, ColumnType};
use crate::data::columnar::{ColumnarDataset, PrimitiveColumn};
use crate::data::dataset::{Dataset, EdgeEndpoint};
use crate::data::spectral::{
    compute_spectral_facts, compute_spectral_facts_columnar, SpectralFacts,
};
use crate::data::statistics::{compute_statistics, compute_statistics_from_columnar, Facts};
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
    pub method: String,
    pub eligible_observation_count: usize,
    pub sample_count: usize,
    pub sampling_seed: Option<u32>,
    pub source_observations_per_sample: f64,
    pub normalization: String,
    pub maximum_candidate_clusters: usize,
    pub iterations: usize,
    pub silhouette_sample_count: usize,
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
    /// Cycles per time-coordinate unit.
    pub frequency: f64,
    /// Period in the same time-coordinate unit. This replaces the scientifically
    /// incorrect `periodSamples` label now that FFT uses the actual time axis.
    pub period_time_units: f64,
    /// Historical heuristic score, not calibrated statistical confidence.
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
    /// Cycles per actual time-coordinate unit.
    pub dominant_frequencies: Vec<f64>,
    pub spectral_entropy: f64,
    pub power_spectrum_peak: f64,
    pub has_periodicity: bool,
    pub periodicity_confidence: f64,
    pub method: String,
    pub observed_count: usize,
    pub transform_length: usize,
    pub source_observations_per_bin: f64,
    pub frequency_resolution: f64,
    pub maximum_frequency: f64,
    pub window_function: String,
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

const MAX_CLUSTER_SAMPLE_ROWS: usize = 65_536;
const CLUSTER_SAMPLING_SEED: u32 = 0x4e4d_5359;
const CLUSTER_ITERATIONS: usize = 5;
const MAX_CANDIDATE_CLUSTERS: usize = 3;
const MAX_SILHOUETTE_SAMPLE_ROWS: usize = 50;

struct ClusterSample {
    key: (u64, u64),
    values: Vec<f64>,
}

fn mix_cluster_hash(state: u64, input: u64) -> u64 {
    let mut value = state ^ input.wrapping_add(0x9e37_79b9_7f4a_7c15);
    value = (value ^ (value >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
    value = (value ^ (value >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
    value ^ (value >> 31)
}

fn cluster_sample_key(values: &[f64]) -> (u64, u64) {
    let mut primary = CLUSTER_SAMPLING_SEED as u64;
    let mut secondary = !(CLUSTER_SAMPLING_SEED as u64);
    for (dimension, value) in values.iter().enumerate() {
        let bits = value.to_bits();
        primary = mix_cluster_hash(primary, bits ^ dimension as u64);
        secondary = mix_cluster_hash(secondary, bits.rotate_left(23) ^ dimension as u64);
    }
    (primary, secondary)
}

fn empty_cluster_profile(
    method: &str,
    eligible_observation_count: usize,
    sample_count: usize,
    sampling_seed: Option<u32>,
) -> ClusterProfile {
    ClusterProfile {
        estimated_count: 1,
        has_clusters: false,
        separation_score: 0.0,
        density_variation: 0.0,
        stability_confidence: 0.0,
        method: method.to_string(),
        eligible_observation_count,
        sample_count,
        sampling_seed,
        source_observations_per_sample: if sample_count > 0 {
            eligible_observation_count as f64 / sample_count as f64
        } else {
            0.0
        },
        normalization: "per-dimension-min-max-over-all-complete-rows".to_string(),
        maximum_candidate_clusters: MAX_CANDIDATE_CLUSTERS,
        iterations: CLUSTER_ITERATIONS,
        silhouette_sample_count: sample_count.min(MAX_SILHOUETTE_SAMPLE_ROWS),
    }
}

fn evaluate_clusters_from_accessor(
    row_count: usize,
    dimensions: usize,
    mut value_at: impl FnMut(usize, usize) -> Option<f64>,
) -> ClusterProfile {
    if dimensions == 0 {
        return empty_cluster_profile("not-applicable", 0, 0, None);
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

    let sample_count = complete_rows.min(MAX_CLUSTER_SAMPLE_ROWS);
    let is_bounded = complete_rows > MAX_CLUSTER_SAMPLE_ROWS;
    let method = if is_bounded {
        "fixed-seed-bottom-k-complete-row-kmeans"
    } else {
        "full-complete-row-kmeans"
    };
    let sampling_seed = is_bounded.then_some(CLUSTER_SAMPLING_SEED);
    if complete_rows < 6 {
        return empty_cluster_profile(method, complete_rows, sample_count, sampling_seed);
    }

    let mut selected = Vec::with_capacity(sample_count);
    let mut priorities = BinaryHeap::with_capacity(sample_count);
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
        let key = cluster_sample_key(&values);
        if selected.len() < sample_count {
            let index = selected.len();
            selected.push(ClusterSample {
                key,
                values: values.clone(),
            });
            if is_bounded {
                priorities.push((key, index));
            }
        } else if let Some(&((maximum_primary, maximum_secondary), index)) = priorities.peek() {
            if key < (maximum_primary, maximum_secondary) {
                priorities.pop();
                selected[index] = ClusterSample {
                    key,
                    values: values.clone(),
                };
                priorities.push((key, index));
            }
        }
    }
    selected.sort_by(|a, b| {
        a.key.cmp(&b.key).then_with(|| {
            a.values
                .iter()
                .map(|value| value.to_bits())
                .cmp(b.values.iter().map(|value| value.to_bits()))
        })
    });

    let mut samples: Vec<Vec<f64>> = selected.into_iter().map(|sample| sample.values).collect();
    for sample in &mut samples {
        for dimension in 0..dimensions {
            let span = max_val[dimension] - min_val[dimension];
            sample[dimension] = if span > 1e-9 {
                (sample[dimension] - min_val[dimension]) / span
            } else {
                0.0
            };
        }
    }

    let mut best_k = 1;
    let mut best_silhouette = -1.0;
    for k in 2..=MAX_CANDIDATE_CLUSTERS.min(samples.len() / 2) {
        let mut centroids = vec![vec![0.0; dimensions]; k];
        for (index, centroid) in centroids.iter_mut().enumerate() {
            let fraction = (index as f64 + 0.5) / k as f64;
            for coordinate in centroid {
                *coordinate = fraction;
            }
        }

        for _ in 0..CLUSTER_ITERATIONS {
            let mut counts = vec![0usize; k];
            let mut sums = vec![vec![0.0; dimensions]; k];
            for sample in &samples {
                let mut min_dist = f64::INFINITY;
                let mut best_cluster = 0;
                for (cluster, centroid) in centroids.iter().enumerate() {
                    let mut d2 = 0.0;
                    for dimension in 0..dimensions {
                        let diff = sample[dimension] - centroid[dimension];
                        d2 += diff * diff;
                    }
                    if d2 < min_dist {
                        min_dist = d2;
                        best_cluster = cluster;
                    }
                }
                counts[best_cluster] += 1;
                for dimension in 0..dimensions {
                    sums[best_cluster][dimension] += sample[dimension];
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

        let silhouette_count = samples.len().min(MAX_SILHOUETTE_SAMPLE_ROWS);
        let silhouette_samples: Vec<&Vec<f64>> = (0..silhouette_count)
            .map(|index| {
                let rank = (((index * 2 + 1) as u64 * samples.len() as u64)
                    / (silhouette_count * 2) as u64) as usize;
                &samples[rank.min(samples.len() - 1)]
            })
            .collect();
        let assignments: Vec<usize> = silhouette_samples
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
        for i in 0..silhouette_samples.len() {
            let my_c = assignments[i];
            let mut a_dist = 0.0;
            let mut a_count = 0;
            let mut b_dists = vec![0.0; k];
            let mut b_counts = vec![0usize; k];
            for j in 0..silhouette_samples.len() {
                if i == j {
                    continue;
                }
                let other_c = assignments[j];
                let mut dist = 0.0;
                for dimension in 0..dimensions {
                    let diff = silhouette_samples[i][dimension] - silhouette_samples[j][dimension];
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
                for cluster in 0..k {
                    if cluster != my_c && b_counts[cluster] > 0 {
                        let avg_b = b_dists[cluster] / b_counts[cluster] as f64;
                        if avg_b < b {
                            b = avg_b;
                        }
                    }
                }
                if b.is_finite() && a.max(b) > 1e-9 {
                    s_sum += (b - a) / a.max(b);
                    valid_samples += 1;
                }
            }
        }

        let avg_s = if valid_samples > 0 {
            s_sum / valid_samples as f64
        } else {
            0.0
        };
        if avg_s > best_silhouette {
            best_silhouette = avg_s;
            best_k = k;
        }
    }

    let has_clusters = best_silhouette > 0.35 && best_k > 1;
    ClusterProfile {
        estimated_count: if has_clusters { best_k } else { 1 },
        has_clusters,
        separation_score: if has_clusters {
            best_silhouette.clamp(0.0, 1.0)
        } else {
            0.0
        },
        density_variation: if has_clusters { 0.25 } else { 0.0 },
        stability_confidence: if has_clusters {
            (best_silhouette * 0.9).clamp(0.1, 1.0)
        } else {
            0.0
        },
        method: method.to_string(),
        eligible_observation_count: complete_rows,
        sample_count,
        sampling_seed,
        source_observations_per_sample: complete_rows as f64 / sample_count as f64,
        normalization: "per-dimension-min-max-over-all-complete-rows".to_string(),
        maximum_candidate_clusters: MAX_CANDIDATE_CLUSTERS,
        iterations: CLUSTER_ITERATIONS,
        silhouette_sample_count: samples.len().min(MAX_SILHOUETTE_SAMPLE_ROWS),
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

/// Analyze an explicit directed source graph without changing its semantic type.
/// Connectivity is weak connectivity (edge direction does not make an otherwise
/// connected source graph disconnected); cycles retain directed source/target
/// semantics. A tree-shaped graph remains a graph. Hierarchy classification is a
/// schema/explicit-topology concern, not an inference from `edge_count == n - 1`.
fn analyze_graph(
    row_count: usize,
    edges: &[crate::data::dataset::Edge],
) -> Option<GraphProfile> {
    if edges.is_empty() {
        return None;
    }

    let edge_count = edges.len();
    let mut directed: HashMap<EdgeEndpoint, Vec<EdgeEndpoint>> = HashMap::new();
    let mut undirected: HashMap<EdgeEndpoint, Vec<EdgeEndpoint>> = HashMap::new();
    let mut nodes: HashSet<EdgeEndpoint> = HashSet::new();

    for edge in edges {
        let source = edge.source.clone();
        let target = edge.target.clone();
        nodes.insert(source.clone());
        nodes.insert(target.clone());
        directed
            .entry(source.clone())
            .or_default()
            .push(target.clone());
        directed.entry(target.clone()).or_default();
        undirected
            .entry(source.clone())
            .or_default()
            .push(target.clone());
        undirected.entry(target).or_default().push(source);
    }

    let node_count = nodes.len().max(row_count);

    let is_connected = if let Some(start) = nodes.iter().next().cloned() {
        let mut visited: HashSet<EdgeEndpoint> = HashSet::new();
        let mut queue = VecDeque::new();
        visited.insert(start.clone());
        queue.push_back(start);
        while let Some(current) = queue.pop_front() {
            if let Some(neighbors) = undirected.get(&current) {
                for next in neighbors {
                    if visited.insert(next.clone()) {
                        queue.push_back(next.clone());
                    }
                }
            }
        }
        visited.len() == nodes.len() && nodes.len() >= row_count
    } else {
        row_count <= 1
    };

    let mut has_cycles = false;
    let mut node_state: HashMap<EdgeEndpoint, u8> = HashMap::new();
    for start_node in nodes.iter().cloned() {
        if node_state.get(&start_node).copied().unwrap_or(0) != 0 {
            continue;
        }
        let mut stack: Vec<(EdgeEndpoint, usize)> = vec![(start_node.clone(), 0)];
        node_state.insert(start_node, 1);
        while let Some((current, next_index)) = stack.pop() {
            let next = directed
                .get(&current)
                .and_then(|neighbors| neighbors.get(next_index))
                .cloned();
            if let Some(next) = next {
                stack.push((current.clone(), next_index + 1));
                let next_state = node_state.get(&next).copied().unwrap_or(0);
                if next_state == 1 {
                    has_cycles = true;
                    break;
                }
                if next_state == 0 {
                    node_state.insert(next.clone(), 1);
                    stack.push((next, 0));
                }
            } else {
                node_state.insert(current, 2);
            }
        }
        if has_cycles {
            break;
        }
    }

    Some(GraphProfile {
        is_graph: true,
        node_count,
        edge_count,
        has_cycles,
        is_connected,
    })
}

pub fn compute_dataset_structure_profile(
    dataset: &Dataset,
    dataset_fingerprint: &str,
    kernel_version: &str,
) -> DatasetStructureProfile {
    let row_count = dataset.rows.len();
    let mut column_missingness = HashMap::new();
    let mut total_missing = 0;
    for column in &dataset.columns {
        let missing = dataset
            .rows
            .iter()
            .filter(|row| matches!(row.get(&column.name), None | Some(Value::Null)))
            .count();
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
    let total_cells = row_count as u64 * dataset.columns.len() as u64;
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
    let stats = compute_statistics(dataset);
    let numeric_col_names: Vec<String> = dataset
        .columns
        .iter()
        .filter(|column| column.ty == ColumnType::Numeric)
        .map(|column| column.name.clone())
        .collect();
    let clusters = evaluate_clusters(dataset, &numeric_col_names);
    let graph = dataset
        .edges
        .as_deref()
        .and_then(|edges| analyze_graph(row_count, edges));
    // RF-044/RF-036: do not manufacture hierarchy from a graph merely because
    // its current edge set is acyclic/tree-shaped. Hierarchy evidence requires
    // explicit/schema semantics and is intentionally absent here.
    let hierarchy = None;

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
        |time_column, value_column| compute_spectral_facts(dataset, time_column, value_column),
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
    let total_cells = row_count as u64 * columns.len() as u64;
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
        |time_column, value_column| {
            let time_index = columns.iter().position(|column| column.name == time_column)?;
            let value_index = columns.iter().position(|column| column.name == value_column)?;
            compute_spectral_facts_columnar(
                Some(columnar.primitive_column(time_index)?),
                columnar.primitive_column(value_index)?,
            )
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
    let mut max_observed_anomaly_score: f64 = 0.0;
    for stats in &stats.numeric {
        let abs_skew = stats.skew.abs();
        max_skewness = max_skewness.max(abs_skew);
        global_has_outliers |= stats.outlier_count > 0;
        global_high_variance |= stats.var > 100.0;
        if (stats.max - stats.min).abs() < 1e-9 {
            constant_columns += 1;
        }
        if stats.outlier_count > 0 && stats.std > 1e-9 {
            let max_deviation = (stats.max - stats.mean)
                .abs()
                .max((stats.min - stats.mean).abs());
            max_observed_anomaly_score = max_observed_anomaly_score
                .max((max_deviation / stats.std / 5.0).clamp(0.0, 1.0));
        }
        numeric_summaries.push(NumericDistributionSummary {
            column: stats.name.clone(),
            mean: stats.mean,
            median: stats.median,
            std_dev: stats.std,
            variance: stats.var,
            min: stats.min,
            max: stats.max,
            iqr: stats.iqr,
            skewness: stats.skew,
            kurtosis: stats.kurtosis,
            outlier_count: stats.outlier_count,
            is_multimodal: stats.is_multimodal,
            is_heavy_tailed: stats.kurtosis > 3.0,
        });
    }
    let total_anomalies = numeric_summaries.iter().map(|summary| summary.outlier_count).sum();
    let distributions = DistributionProfile {
        numeric_summaries,
        global_has_outliers,
        global_high_variance,
        max_skewness,
    };

    let mut correlation_pairs = Vec::new();
    let mut max_correlation: f64 = 0.0;
    let mut significant_pairs_count = 0;
    for pair in &stats.correlation {
        let absolute = pair.value.abs();
        max_correlation = max_correlation.max(absolute);
        let is_strong = absolute > 0.6;
        significant_pairs_count += usize::from(is_strong);
        correlation_pairs.push(CorrelationPairSummary {
            column_a: pair.a.clone(),
            column_b: pair.b.clone(),
            r: pair.value,
            is_strong,
        });
    }
    let correlations = CorrelationProfile {
        pairs: correlation_pairs,
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
        redundant_columns: usize::from(max_correlation > 0.95),
        effective_dimensions: column_count.saturating_sub(constant_columns),
    };

    let mut categorical_summaries = Vec::new();
    let mut sum_entropy = 0.0;
    let mut has_high_cardinality = false;
    for category in &stats.categorical {
        sum_entropy += category.entropy;
        has_high_cardinality |= category.cardinality > 20;
        categorical_summaries.push(CategoricalColumnSummary {
            column: category.name.clone(),
            cardinality: category.cardinality,
            entropy: category.entropy,
            top_categories: category
                .top
                .iter()
                .map(|bucket| CategoryBucketSummary {
                    value: bucket.value.clone(),
                    count: bucket.count,
                    fraction: if row_count > 0 {
                        bucket.count as f64 / row_count as f64
                    } else {
                        0.0
                    },
                })
                .collect(),
            is_high_cardinality: category.cardinality > 20,
        });
    }
    let categorical = CategoricalProfile {
        mean_entropy: if stats.categorical.is_empty() {
            0.0
        } else {
            sum_entropy / stats.categorical.len() as f64
        },
        summaries: categorical_summaries,
        has_high_cardinality,
    };
    let density = DensityProfile {
        global_density: if row_count >= 50 {
            0.7
        } else if row_count >= 20 {
            0.4
        } else {
            0.15
        },
        local_density_variation: if clusters.has_clusters { 0.3 } else { 0.1 },
        mode_count: clusters.estimated_count,
        is_sparse: row_count < 15,
    };

    let (temporal, spectral) = if !stats.temporal_stats.is_empty() && numeric_col_count > 0 {
        let temporal_stats = &stats.temporal_stats[0];
        let spectral_facts = spectral_facts(&temporal_stats.column, &temporal_stats.value_column);
        let spectral_profile = spectral_facts.as_ref().map(|facts| SpectralProfile {
            dominant_frequencies: facts.dominant_frequencies.clone(),
            spectral_entropy: facts.spectral_entropy,
            power_spectrum_peak: facts.power_spectrum_peak,
            has_periodicity: facts.has_periodicity,
            periodicity_confidence: facts.periodicity_confidence,
            method: facts.method.clone(),
            observed_count: facts.observed_count,
            transform_length: facts.transform_length,
            source_observations_per_bin: facts.source_observations_per_bin,
            frequency_resolution: facts.frequency_resolution,
            maximum_frequency: facts.maximum_frequency,
            window_function: facts.window_function.clone(),
        });
        let periodicities = spectral_profile
            .as_ref()
            .map(|profile| {
                profile
                    .dominant_frequencies
                    .iter()
                    .map(|&frequency| PeriodicityProfile {
                        frequency,
                        period_time_units: if frequency > 0.0 { 1.0 / frequency } else { 0.0 },
                        confidence: profile.periodicity_confidence,
                    })
                    .collect()
            })
            .unwrap_or_default();
        let temporal_profile = TemporalProfile {
            is_time_series: true,
            time_column: Some(temporal_stats.column.clone()),
            trend_direction: temporal_stats.trend_direction.clone(),
            trend_strength: temporal_stats.normalized_slope.abs(),
            has_seasonality: spectral_profile
                .as_ref()
                .is_some_and(|profile| profile.has_periodicity),
            periodicities,
        };
        (Some(temporal_profile), spectral_profile)
    } else {
        (None, None)
    };

    let mut latitude_column = None;
    let mut longitude_column = None;
    for column in columns {
        let lower = column.name.to_lowercase();
        if lower == "lat" || lower == "latitude" {
            latitude_column = Some(column.name.clone());
        }
        if lower == "lon" || lower == "lng" || lower == "longitude" {
            longitude_column = Some(column.name.clone());
        }
    }
    let spatial = if latitude_column.is_some() && longitude_column.is_some() {
        Some(SpatialProfile {
            is_geospatial: true,
            coordinate_dimensions: 2,
            lat_column: latitude_column,
            lon_column: longitude_column,
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
        max_anomaly_score: if total_anomalies > 0 {
            max_observed_anomaly_score.max(0.2)
        } else {
            0.0
        },
    };
    let provenance = AnalysisProvenance {
        kernel_version: kernel_version.to_string(),
        dataset_fingerprint: dataset_fingerprint.to_string(),
        timestamp_ms: 0,
        algorithm_suite: "nemosyne-rust-analytical-core-v3".to_string(),
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
    use crate::data::dataset::Edge;
    use std::f64::consts::PI;

    #[test]
    fn test_compute_dataset_structure_profile() {
        let mut rows = Vec::new();
        for index in 0..50 {
            rows.push(HashMap::from([
                ("x".to_string(), Value::Number(index as f64)),
                ("y".to_string(), Value::Number((index * 2) as f64)),
                (
                    "cat".to_string(),
                    Value::Text(if index % 2 == 0 { "A" } else { "B" }.to_string()),
                ),
            ]));
        }
        let dataset = Dataset::new(
            "test_ds",
            vec![
                Column::new("x", ColumnType::Numeric),
                Column::new("y", ColumnType::Numeric),
                Column::new("cat", ColumnType::Categorical),
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
    fn one_edge_graph_remains_graph_and_is_acyclic() {
        let mut dataset = Dataset::new(
            "one-edge",
            vec![Column::new("value", ColumnType::Numeric)],
            vec![
                HashMap::from([("value".to_string(), Value::Number(1.0))]),
                HashMap::from([("value".to_string(), Value::Number(2.0))]),
            ],
        );
        dataset.edges = Some(vec![Edge::new(0, 1)]);
        let profile = compute_dataset_structure_profile(&dataset, "fp", "0.1.0");
        assert_eq!(
            profile.graph,
            Some(GraphProfile {
                is_graph: true,
                node_count: 2,
                edge_count: 1,
                has_cycles: false,
                is_connected: true,
            })
        );
        assert_eq!(profile.hierarchy, None);
    }

    #[test]
    fn stable_string_endpoint_graph_has_truthful_profile() {
        let mut dataset = Dataset::new(
            "string-edge",
            vec![Column::new("id", ColumnType::Categorical)],
            vec![
                HashMap::from([("id".to_string(), Value::Text("A".to_string()))]),
                HashMap::from([("id".to_string(), Value::Text("B".to_string()))]),
            ],
        );
        dataset.edges = Some(vec![Edge::new_id("A", "B")]);
        let profile = compute_dataset_structure_profile(&dataset, "fp", "0.1.0");
        let graph = profile.graph.expect("explicit edge graph profile");
        assert_eq!(graph.node_count, 2);
        assert_eq!(graph.edge_count, 1);
        assert!(!graph.has_cycles);
        assert!(graph.is_connected);
        assert!(profile.hierarchy.is_none());
    }

    #[test]
    fn graph_connectivity_is_weak_and_independent_of_edge_direction() {
        let edges = vec![Edge::new(1, 0), Edge::new(2, 1)];
        let graph = analyze_graph(3, &edges).expect("graph profile");
        assert!(graph.is_connected);
        assert!(!graph.has_cycles);
    }

    #[test]
    fn directed_cycle_is_reported_without_changing_graph_type() {
        let edges = vec![Edge::new_id("A", "B"), Edge::new_id("B", "A")];
        let graph = analyze_graph(2, &edges).expect("graph profile");
        assert!(graph.has_cycles);
        assert!(graph.is_connected);
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
                            Value::Number((index as f64 / 4.0).sin())
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
        let row_profile = compute_dataset_structure_profile(&dataset, &fingerprint, "0.1.0");
        let columnar_profile = compute_columnar_dataset_structure_profile(
            &dataset.name,
            &dataset.columns,
            &columnar,
            &fingerprint,
            "0.1.0",
        )
        .expect("columnar profile");
        assert_eq!(columnar_profile, row_profile);
        assert!(row_profile.spectral.is_none(), "missing sample creates a gap; FFT must fail closed");
    }

    #[test]
    fn regular_temporal_profile_reports_period_in_time_units() {
        let rows = (0..64)
            .map(|index| {
                HashMap::from([
                    ("time".to_string(), Value::Number(index as f64 * 0.5)),
                    (
                        "value".to_string(),
                        Value::Number((2.0 * PI * index as f64 / 16.0).sin()),
                    ),
                ])
            })
            .collect();
        let dataset = Dataset::new(
            "regular-temporal",
            vec![
                Column::new("time", ColumnType::Temporal),
                Column::new("value", ColumnType::Numeric),
            ],
            rows,
        );
        let profile = compute_dataset_structure_profile(&dataset, "fp", "0.1.0");
        let spectral = profile.spectral.as_ref().expect("regular spectral profile");
        assert_eq!(spectral.method, "regular-time-fft");
        let periodicity = &profile.temporal.as_ref().unwrap().periodicities[0];
        assert!((periodicity.frequency - 0.125).abs() < 0.01);
        assert!((periodicity.period_time_units - 8.0).abs() < 0.1);
    }

    #[test]
    fn irregular_temporal_profile_keeps_trend_but_withholds_spectral_claim() {
        let times = [0.0, 1.0, 2.0, 4.0, 7.0, 11.0];
        let rows = times
            .iter()
            .map(|time| {
                HashMap::from([
                    ("time".to_string(), Value::Number(*time)),
                    ("value".to_string(), Value::Number(*time * 2.0)),
                ])
            })
            .collect();
        let dataset = Dataset::new(
            "irregular-temporal",
            vec![
                Column::new("time", ColumnType::Temporal),
                Column::new("value", ColumnType::Numeric),
            ],
            rows,
        );
        let profile = compute_dataset_structure_profile(&dataset, "fp", "0.1.0");
        assert_eq!(profile.temporal.as_ref().unwrap().trend_direction, "up");
        assert!(!profile.temporal.as_ref().unwrap().has_seasonality);
        assert!(profile.spectral.is_none());
    }

    #[test]
    fn bounded_cluster_estimator_is_deterministic_and_provenance_explicit() {
        let row_count = MAX_CLUSTER_SAMPLE_ROWS + 4_096;
        let evaluate = || {
            evaluate_clusters_from_accessor(row_count, 2, |row, dimension| {
                let permuted = row.wrapping_mul(2_654_435_761) % row_count;
                let cluster = if permuted < row_count / 2 { 0.0 } else { 10.0 };
                Some(cluster + dimension as f64 * 0.1 + (permuted % 17) as f64 * 0.001)
            })
        };
        let first = evaluate();
        let second = evaluate();
        assert_eq!(first, second);
        assert_eq!(first.method, "fixed-seed-bottom-k-complete-row-kmeans");
        assert_eq!(first.eligible_observation_count, row_count);
        assert_eq!(first.sample_count, MAX_CLUSTER_SAMPLE_ROWS);
        assert_eq!(first.sampling_seed, Some(CLUSTER_SAMPLING_SEED));
        assert!(first.source_observations_per_sample > 1.0);
        assert_eq!(first.iterations, CLUSTER_ITERATIONS);
        assert_eq!(first.silhouette_sample_count, MAX_SILHOUETTE_SAMPLE_ROWS);
        assert!(first.has_clusters);
    }

    #[test]
    fn bounded_cluster_estimator_is_row_order_invariant() {
        let row_count = MAX_CLUSTER_SAMPLE_ROWS + 4_096;
        let value = |row: usize, dimension: usize| {
            let cluster = if row % 2 == 0 { 0.0 } else { 10.0 };
            cluster + dimension as f64 * 0.1 + (row % 31) as f64 * 0.001
        };
        let forward = evaluate_clusters_from_accessor(row_count, 2, |row, dimension| {
            Some(value(row, dimension))
        });
        let reversed = evaluate_clusters_from_accessor(row_count, 2, |row, dimension| {
            Some(value(row_count - row - 1, dimension))
        });
        assert_eq!(forward, reversed);
    }
}
