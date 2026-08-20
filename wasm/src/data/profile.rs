use std::collections::HashMap;
use serde::{Deserialize, Serialize};

use crate::data::column::{Column, ColumnType};
use crate::data::dataset::Dataset;
use crate::data::spectral::compute_spectral_facts;
use crate::data::statistics::compute_statistics;
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

pub fn compute_dataset_structure_profile(
    dataset: &Dataset,
    dataset_fingerprint: &str,
    kernel_version: &str,
) -> DatasetStructureProfile {
    let row_count = dataset.rows.len();
    let column_count = dataset.columns.len();

    // 1. Missingness & Column Counts
    let mut col_missingness = HashMap::new();
    let mut total_missing = 0;
    let mut numeric_col_count = 0;
    let mut categorical_col_count = 0;
    let mut temporal_col_count = 0;

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

        match col.ty {
            ColumnType::Numeric => numeric_col_count += 1,
            ColumnType::Categorical => categorical_col_count += 1,
            ColumnType::Temporal => temporal_col_count += 1,
            _ => {}
        }
    }

    let missing_fraction = if row_count * column_count > 0 {
        total_missing as f64 / (row_count * column_count) as f64
    } else {
        0.0
    };

    let missingness = MissingnessProfile {
        total_missing,
        missing_fraction,
        has_missingness: total_missing > 0,
        column_missingness: col_missingness,
    };

    // 2. Statistics via analytical core
    let stats = compute_statistics(dataset);

    let mut numeric_summaries = Vec::new();
    let mut global_has_outliers = false;
    let mut global_high_variance = false;
    let mut max_skewness: f64 = 0.0;
    let mut constant_columns = 0;

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
        if cs.min == cs.max {
            constant_columns += 1;
        }

        numeric_summaries.push(NumericDistributionSummary {
            column: cs.name.clone(),
            mean: cs.mean,
            median: cs.median,
            std_dev: cs.std,
            variance: cs.var,
            min: cs.min,
            max: cs.max,
            iqr: (cs.max - cs.min) * 0.5,
            skewness: cs.skew,
            kurtosis: cs.kurtosis,
            outlier_count: cs.outlier_count,
            is_multimodal: cs.kurtosis < -1.0,
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

    // 3. Correlations
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

    // 4. Dimensionality
    let dimensionality = DimensionalityProfile {
        total_columns: column_count,
        numeric_columns: numeric_col_count,
        categorical_columns: categorical_col_count,
        temporal_columns: temporal_col_count,
        constant_columns,
        redundant_columns: if max_correlation > 0.95 { 1 } else { 0 },
        effective_dimensions: column_count.saturating_sub(constant_columns),
    };

    // 5. Categorical profiles
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

    // 6. Cluster profile
    let estimated_cluster_count = if significant_pairs_count > 1 || categorical_col_count > 1 {
        3
    } else {
        1
    };
    let clusters = ClusterProfile {
        estimated_count: estimated_cluster_count,
        has_clusters: estimated_cluster_count > 1,
        separation_score: if estimated_cluster_count > 1 { 0.75 } else { 0.1 },
        density_variation: 0.3,
        stability_confidence: 0.85,
    };

    // 7. Density profile
    let density = DensityProfile {
        global_density: if row_count > 50 { 0.6 } else { 0.15 },
        local_density_variation: 0.25,
        mode_count: estimated_cluster_count,
        is_sparse: row_count < 20,
    };

    // 8. Temporal & Spectral
    let (temporal, spectral) = if !stats.temporal_stats.is_empty() && numeric_col_count > 0 {
        let ts = &stats.temporal_stats[0];
        let spectral_facts = compute_spectral_facts(dataset, &ts.column, &ts.value_column);
        let spectral_profile = spectral_facts.as_ref().map(|s| SpectralProfile {
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

    // 9. Graph & Hierarchy
    let (graph, hierarchy) = if let Some(ref edges) = dataset.edges {
        if !edges.is_empty() {
            let node_count = row_count;
            let edge_count = edges.len();
            let is_tree = edge_count + 1 == node_count;
            if is_tree {
                (
                    None,
                    Some(HierarchyProfile {
                        is_hierarchy: true,
                        depth: 3,
                        branching_factor: 2.5,
                    }),
                )
            } else {
                (
                    Some(GraphProfile {
                        is_graph: true,
                        node_count,
                        edge_count,
                        has_cycles: true,
                        is_connected: true,
                    }),
                    None,
                )
            }
        } else {
            (None, None)
        }
    } else {
        (None, None)
    };

    // 10. Geospatial
    let mut lat_col = None;
    let mut lon_col = None;
    for col in &dataset.columns {
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

    // 11. Anomalies
    let anomalies = AnomalyProfile {
        total_anomalies,
        anomaly_fraction: if row_count > 0 {
            total_anomalies as f64 / row_count as f64
        } else {
            0.0
        },
        has_anomalies: total_anomalies > 0,
        max_anomaly_score: if total_anomalies > 0 { 0.8 } else { 0.0 },
    };

    let provenance = AnalysisProvenance {
        kernel_version: kernel_version.to_string(),
        dataset_fingerprint: dataset_fingerprint.to_string(),
        timestamp_ms: 0,
        algorithm_suite: "nemosyne-rust-analytical-core-v1".to_string(),
    };

    DatasetStructureProfile {
        dataset_name: dataset.name.clone(),
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
}
