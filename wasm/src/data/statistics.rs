//! Descriptive statistics (`Facts`) for a dataset.
//!
//! The numeric matrix and Pearson correlation are computed over `ndarray` —
//! the battle-tested linear-algebra substrate called out in the Wave 1 plan —
//! so the kernel does not hand-roll the matrix algebra. Per-column descriptive
//! stats (mean / median / std / var / min / max) are computed from the finite
//! values of each column; correlation uses listwise-complete numeric rows so
//! the covariance matrix is well-defined.
//!
//! `Facts` is the input Draco will consume via a `FactProvider` in Wave 5.

use std::collections::HashMap;

use ndarray::{Array2, Axis};
use serde::Serialize;

use crate::data::dataset::Dataset;
use crate::data::value::Value;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnStats {
    pub name: String,
    pub count: usize,
    pub sum: f64,
    pub mean: f64,
    pub median: f64,
    pub std: f64,
    pub var: f64,
    pub min: f64,
    pub max: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct CorrelationPair {
    pub a: String,
    pub b: String,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct CategoryCount {
    pub value: String,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoricalStats {
    pub name: String,
    pub cardinality: usize,
    pub entropy: f64,
    pub top: Vec<CategoryCount>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Facts {
    pub row_count: usize,
    pub column_count: usize,
    pub numeric: Vec<ColumnStats>,
    pub correlation: Vec<CorrelationPair>,
    pub categorical: Vec<CategoricalStats>,
    pub temporal: Vec<String>,
}

/// Compute the full `Facts` block for a dataset.
pub fn compute_statistics(dataset: &Dataset) -> Facts {
    let numeric_names: Vec<String> = dataset
        .numeric_columns()
        .iter()
        .map(|c| c.name.clone())
        .collect();

    // Per-column descriptive stats over each column's finite values.
    let numeric_stats: Vec<ColumnStats> = numeric_names
        .iter()
        .map(|name| column_stats(dataset, name))
        .collect();

    // Correlation over listwise-complete numeric rows, via ndarray.
    let correlation = correlate(dataset, &numeric_names);

    let categorical = dataset
        .categorical_columns()
        .iter()
        .map(|c| categorical_stats(dataset, &c.name))
        .collect();

    let temporal = dataset
        .temporal_columns()
        .iter()
        .map(|c| c.name.clone())
        .collect();

    Facts {
        row_count: dataset.row_count(),
        column_count: dataset.column_count(),
        numeric: numeric_stats,
        correlation,
        categorical,
        temporal,
    }
}

fn finite_values(dataset: &Dataset, name: &str) -> Vec<f64> {
    dataset
        .get_column_values(name)
        .into_iter()
        .flatten()
        .filter_map(|v| v.as_number())
        .filter(|n| n.is_finite())
        .collect()
}

fn column_stats(dataset: &Dataset, name: &str) -> ColumnStats {
    let mut values = finite_values(dataset, name);
    let count = values.len();
    if count == 0 {
        return ColumnStats {
            name: name.to_string(),
            count: 0,
            sum: 0.0,
            mean: 0.0,
            median: 0.0,
            std: 0.0,
            var: 0.0,
            min: 0.0,
            max: 0.0,
        };
    }
    values.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let sum: f64 = values.iter().sum();
    let mean = sum / count as f64;
    let median = if count % 2 == 0 {
        (values[count / 2 - 1] + values[count / 2]) / 2.0
    } else {
        values[count / 2]
    };
    // Population variance (ddof = 0).
    let var = if count > 0 {
        values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / count as f64
    } else {
        0.0
    };
    let std = var.sqrt();
    let min = values[0];
    let max = values[count - 1];
    ColumnStats {
        name: name.to_string(),
        count,
        sum,
        mean,
        median,
        std,
        var,
        min,
        max,
    }
}

fn correlate(dataset: &Dataset, numeric_names: &[String]) -> Vec<CorrelationPair> {
    let m = numeric_names.len();
    if m < 2 {
        return Vec::new();
    }
    // Listwise-complete rows: keep only rows where every numeric column is
    // finite. `n` rows x `m` numeric columns.
    let mut rows: Vec<Vec<f64>> = Vec::new();
    for row in &dataset.rows {
        let mut vals = Vec::with_capacity(m);
        let mut complete = true;
        for name in numeric_names {
            match row.get(name).and_then(|v| v.as_number()) {
                Some(n) if n.is_finite() => vals.push(n),
                _ => {
                    complete = false;
                    break;
                }
            }
        }
        if complete {
            rows.push(vals);
        }
    }
    if rows.is_empty() {
        return Vec::new();
    }
    let n = rows.len();
    let mat = Array2::from_shape_vec((n, m), rows.into_iter().flatten().collect::<Vec<_>>())
        .unwrap_or_else(|_| Array2::zeros((0, m)));
    if mat.nrows() == 0 {
        return Vec::new();
    }
    let means = mat
        .mean_axis(Axis(0))
        .unwrap_or_else(|| ndarray::Array1::zeros(m));
    let centered = &mat - &means;
    let variances: Vec<f64> = (0..m)
        .map(|j| centered.column(j).mapv(|x| x * x).mean().unwrap_or(0.0))
        .collect();
    let mut pairs = Vec::new();
    for i in 0..m {
        for j in (i + 1)..m {
            let std_i = variances[i].sqrt();
            let std_j = variances[j].sqrt();
            let denom = std_i * std_j;
            let value = if denom > 1e-12 {
                let cov = (&centered.column(i) * &centered.column(j))
                    .mean()
                    .unwrap_or(0.0);
                (cov / denom).clamp(-1.0, 1.0)
            } else {
                0.0
            };
            pairs.push(CorrelationPair {
                a: numeric_names[i].clone(),
                b: numeric_names[j].clone(),
                value,
            });
        }
    }
    pairs
}

fn categorical_stats(dataset: &Dataset, name: &str) -> CategoricalStats {
    let mut counts: HashMap<String, usize> = HashMap::new();
    let mut total = 0usize;
    for row in &dataset.rows {
        let key = match row.get(name) {
            Some(Value::Null) | None => continue,
            Some(v) => v.to_key_string(),
        };
        *counts.entry(key).or_default() += 1;
        total += 1;
    }
    let cardinality = counts.len();
    let entropy = if total == 0 || cardinality <= 1 {
        0.0
    } else {
        counts
            .values()
            .map(|&c| {
                let p = c as f64 / total as f64;
                -p * p.log2()
            })
            .sum()
    };
    let mut top: Vec<CategoryCount> = counts
        .into_iter()
        .map(|(value, count)| CategoryCount { value, count })
        .collect();
    top.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.value.cmp(&b.value)));
    top.truncate(5);
    CategoricalStats {
        name: name.to_string(),
        cardinality,
        entropy,
        top,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::column::{Column, ColumnType};

    fn stats_dataset() -> Dataset {
        let columns = vec![
            Column::new("g", ColumnType::Categorical),
            Column::new("x", ColumnType::Numeric),
            Column::new("y", ColumnType::Numeric),
        ];
        let rows = vec![
            row([("g", "A"), ("x", "1.0"), ("y", "2.0")]),
            row([("g", "A"), ("x", "2.0"), ("y", "4.0")]),
            row([("g", "B"), ("x", "3.0"), ("y", "6.0")]),
            row([("g", "B"), ("x", "4.0"), ("y", "8.0")]),
        ];
        Dataset::new("stats", columns, rows)
    }

    fn row(pairs: [(&str, &str); 3]) -> HashMap<String, Value> {
        let mut r = HashMap::new();
        for (k, v) in pairs {
            if let Ok(n) = v.parse::<f64>() {
                r.insert(k.to_string(), Value::Number(n));
            } else {
                r.insert(k.to_string(), Value::Text(v.to_string()));
            }
        }
        r
    }

    #[test]
    fn computes_numeric_stats() {
        let facts = compute_statistics(&stats_dataset());
        let x = facts.numeric.iter().find(|c| c.name == "x").unwrap();
        assert_eq!(x.count, 4);
        assert_eq!(x.sum, 10.0);
        assert_eq!(x.mean, 2.5);
        assert_eq!(x.median, 2.5);
        assert_eq!(x.min, 1.0);
        assert_eq!(x.max, 4.0);
        assert!(x.var > 0.0);
        assert!(x.std > 0.0);
    }

    #[test]
    fn correlation_of_perfect_linear_pair_is_one() {
        let facts = compute_statistics(&stats_dataset());
        let xy = facts
            .correlation
            .iter()
            .find(|p| (p.a == "x" && p.b == "y") || (p.a == "y" && p.b == "x"))
            .unwrap();
        assert!((xy.value - 1.0).abs() < 1e-9);
    }

    #[test]
    fn categorical_entropy_and_top() {
        let facts = compute_statistics(&stats_dataset());
        let g = facts.categorical.iter().find(|c| c.name == "g").unwrap();
        assert_eq!(g.cardinality, 2);
        assert!(g.entropy > 0.0);
        assert_eq!(g.top.len(), 2);
        // Each category has count 2; top is sorted by count desc then value.
        assert!(g.top.iter().all(|c| c.count == 2));
    }
}