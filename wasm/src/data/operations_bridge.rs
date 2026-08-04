use serde::Deserialize;

use crate::data::dataset::Dataset;
use crate::data::operations;

/// Generic operation request sent from the JS host as JSON.
#[derive(Debug, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum Operation {
    Filter {
        column: String,
        #[serde(default)]
        min: Option<f64>,
        #[serde(default)]
        max: Option<f64>,
    },
    Sort {
        column: String,
        #[serde(default = "default_ascending")]
        ascending: bool,
    },
    Aggregate {
        group_by: String,
    },
    Slice {
        start: usize,
        end: usize,
    },
    Anomaly {
        column: String,
        #[serde(default = "default_sensitivity")]
        sensitivity: f64,
    },
    KMeans {
        k: usize,
        #[serde(default)]
        features: Option<Vec<String>>,
    },
    Hierarchical {
        k: usize,
        #[serde(default = "default_linkage")]
        linkage: String,
        #[serde(default)]
        features: Option<Vec<String>>,
    },
    Dbscan {
        eps: f64,
        min_points: usize,
        #[serde(default)]
        features: Option<Vec<String>>,
    },
}

fn default_ascending() -> bool {
    true
}

fn default_sensitivity() -> f64 {
    1.5
}

fn default_linkage() -> String {
    "average".to_string()
}

/// Apply a generic operation to a dataset and return the transformed dataset.
pub fn apply(dataset: &Dataset, op: Operation) -> Result<Dataset, String> {
    match op {
        Operation::Filter { column, min, max } => {
            let predicate = |row: &std::collections::HashMap<String, crate::data::value::Value>| {
                if let Some(v) = row.get(&column).and_then(|v| v.as_number()) {
                    if let Some(m) = min {
                        if v < m {
                            return false;
                        }
                    }
                    if let Some(m) = max {
                        if v > m {
                            return false;
                        }
                    }
                    true
                } else {
                    false
                }
            };
            Ok(operations::filter(dataset, predicate))
        }
        Operation::Sort { column, ascending } => Ok(operations::sort(dataset, &column, ascending)),
        Operation::Aggregate { group_by } => Ok(operations::aggregate(dataset, &group_by, |group| {
            operations::default_sum_aggregator(&group_by, group)
        })),
        Operation::Slice { start, end } => Ok(operations::slice(dataset, start, end)),
        Operation::Anomaly { column, sensitivity } => Ok(operations::anomaly_iqr(dataset, &column, sensitivity)),
        Operation::KMeans { k, features } => {
            let feature_refs: Option<Vec<&str>> = features.as_ref().map(|v| v.iter().map(|s| s.as_str()).collect());
            Ok(operations::k_means(dataset, k, feature_refs.as_deref()))
        }
        Operation::Hierarchical { k, linkage, features } => {
            let feature_refs: Option<Vec<&str>> = features.as_ref().map(|v| v.iter().map(|s| s.as_str()).collect());
            Ok(operations::hierarchical(dataset, feature_refs.as_deref(), &linkage, k))
        }
        Operation::Dbscan { eps, min_points, features } => {
            let feature_refs: Option<Vec<&str>> = features.as_ref().map(|v| v.iter().map(|s| s.as_str()).collect());
            Ok(operations::dbscan(dataset, eps, min_points, feature_refs.as_deref()))
        }
    }
}
