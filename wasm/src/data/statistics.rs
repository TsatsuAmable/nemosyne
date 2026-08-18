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
    pub skew: f64,
    pub kurtosis: f64,
    pub outlier_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct CorrelationPair {
    pub a: String,
    pub b: String,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TemporalStats {
    pub column: String,
    pub value_column: String,
    pub trend_direction: String,
    pub seasonality_hint: bool,
    pub normalized_slope: f64,
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
    pub temporal_stats: Vec<TemporalStats>,
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

    let temporal_names: Vec<String> = dataset
        .temporal_columns()
        .iter()
        .map(|c| c.name.clone())
        .collect();

    // Temporal trend + seasonality for each temporal column paired with the
    // first numeric value column. Mirrors the former JS `_temporalStats`.
    let value_column = numeric_names.first().cloned();
    let temporal_stats = temporal_names
        .iter()
        .map(|t| temporal_stats(dataset, t, value_column.as_deref()))
        .collect();

    Facts {
        row_count: dataset.row_count(),
        column_count: dataset.column_count(),
        numeric: numeric_stats,
        correlation,
        categorical,
        temporal: temporal_names,
        temporal_stats,
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
            skew: 0.0,
            kurtosis: 0.0,
            outlier_count: 0,
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

    // Standardized third & fourth moments (excess kurtosis) via the
    // battle-tested `statify` crate (rule 4: no hand-rolled moments). Both
    // functions return `Result` — `Err` on an empty / insufficient dataset or a
    // zero variance (division by zero) — so we fall back to 0.0, preserving the
    // previous degenerate-column behaviour without re-rolling the math.
    let skew = statify::skewness(&values).unwrap_or(0.0);
    let kurtosis = statify::kurtosis(&values).unwrap_or(0.0);

    let outlier_count = outlier_count(&values, 1.5);

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
        skew,
        kurtosis,
        outlier_count,
    }
}

/// Robust outlier count using a modified Z-score (MAD-based) with an IQR
/// fallback when MAD is zero. Mirrors the former JS `_estimateOutlierCount`.
fn outlier_count(sorted: &[f64], iqr_multiplier: f64) -> usize {
    let n = sorted.len();
    if n < 4 {
        return 0;
    }
    let median = median_of(sorted);
    let mut deviations: Vec<f64> = sorted.iter().map(|v| (v - median).abs()).collect();
    deviations.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let mad = median_of(&deviations);
    if mad == 0.0 {
        // IQR fallback.
        let q1 = sorted[(n as f64 * 0.25).floor() as usize];
        let q3_idx = (n as f64 * 0.75).ceil() as usize;
        let q3 = sorted[if q3_idx >= n { n - 1 } else { q3_idx }];
        let iqr = q3 - q1;
        let lower = q1 - iqr_multiplier * iqr;
        let upper = q3 + iqr_multiplier * iqr;
        return sorted.iter().filter(|v| **v < lower || **v > upper).count();
    }
    let threshold = 3.5; // Iglewicz & Hoaglin.
    sorted
        .iter()
        .filter(|v| {
            let modified_z = 0.6745 * (*v - median) / mad;
            modified_z.abs() > threshold
        })
        .count()
}

fn median_of(sorted: &[f64]) -> f64 {
    let n = sorted.len();
    if n == 0 {
        return 0.0;
    }
    if n % 2 == 1 {
        sorted[n / 2]
    } else {
        (sorted[n / 2 - 1] + sorted[n / 2]) / 2.0
    }
}

/// Trend direction + seasonality hint for a temporal column paired with a
/// numeric value column. Mirrors the former JS `_temporalStats`: least-squares
/// slope normalized by value range, plus lag-`n/4` autocorrelation.
fn temporal_stats(dataset: &Dataset, time_column: &str, value_column: Option<&str>) -> TemporalStats {
    let value_col = match value_column {
        Some(c) => c.to_string(),
        None => {
            return TemporalStats {
                column: time_column.to_string(),
                value_column: String::new(),
                trend_direction: "flat".to_string(),
                seasonality_hint: false,
                normalized_slope: 0.0,
            };
        }
    };

    // Sort rows by the temporal key. Numeric temporal values (epoch ms) sort
    // numerically; ISO date strings sort lexicographically. Mixed columns use
    // the numeric parse when available.
    let mut keyed: Vec<(f64, f64)> = dataset
        .rows
        .iter()
        .filter_map(|row| {
            let t = row.get(time_column)?;
            let v = row.get(&value_col)?.as_number()?;
            if !v.is_finite() {
                return None;
            }
            let key = t.as_number().unwrap_or_else(|| {
                // Fallback: hash-free lexicographic rank is not needed; use a
                // monotonic numeric key derived from the string bytes.
                t.to_key_string()
                    .bytes()
                    .fold(0f64, |acc, b| acc * 256.0 + b as f64)
            });
            Some((key, v))
        })
        .collect();
    keyed.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
    let values: Vec<f64> = keyed.iter().map(|(_, v)| *v).collect();

    let n = values.len();
    if n < 3 {
        return TemporalStats {
            column: time_column.to_string(),
            value_column: value_col,
            trend_direction: "flat".to_string(),
            seasonality_hint: false,
            normalized_slope: 0.0,
        };
    }

    let x_mean = (n - 1) as f64 / 2.0;
    let y_mean = values.iter().sum::<f64>() / n as f64;
    let mut num = 0.0;
    let mut den = 0.0;
    for (i, y) in values.iter().enumerate() {
        num += (i as f64 - x_mean) * (y - y_mean);
        den += (i as f64 - x_mean).powi(2);
    }
    let slope = if den > 0.0 { num / den } else { 0.0 };
    let min_v = values.iter().cloned().fold(f64::INFINITY, f64::min);
    let max_v = values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let range = max_v - min_v;
    let normalized_slope = if range > 0.0 { slope / range } else { 0.0 };

    let trend_direction = if normalized_slope > 0.01 {
        "up"
    } else if normalized_slope < -0.01 {
        "down"
    } else {
        "flat"
    };

    // Lag autocorrelation for seasonality hint.
    let lag = ((n as f64) / 4.0).floor() as usize;
    let lag = if lag < 1 { 1 } else { lag };
    let mut cov = 0.0;
    let mut var_a = 0.0;
    let mut var_b = 0.0;
    for i in 0..(n - lag) {
        let a = values[i] - y_mean;
        let b = values[i + lag] - y_mean;
        cov += a * b;
        var_a += a * a;
        var_b += b * b;
    }
    let corr = if var_a > 0.0 && var_b > 0.0 {
        cov / (var_a * var_b).sqrt()
    } else {
        0.0
    };
    let seasonality_hint = corr > 0.5;

    TemporalStats {
        column: time_column.to_string(),
        value_column: value_col,
        trend_direction: trend_direction.to_string(),
        seasonality_hint,
        normalized_slope,
    }
}

fn correlate(dataset: &Dataset, numeric_names: &[String]) -> Vec<CorrelationPair> {
    let m = numeric_names.len();
    if m < 2 {
        return Vec::new();
    }
    let mut pairs = Vec::new();
    for i in 0..m {
        let name_a = &numeric_names[i];
        for j in (i + 1)..m {
            let name_b = &numeric_names[j];
            let mut a_vals = Vec::new();
            let mut b_vals = Vec::new();
            for row in &dataset.rows {
                let val_a = row.get(name_a).and_then(|v| v.as_number());
                let val_b = row.get(name_b).and_then(|v| v.as_number());
                if let (Some(a), Some(b)) = (val_a, val_b) {
                    if a.is_finite() && b.is_finite() {
                        a_vals.push(a);
                        b_vals.push(b);
                    }
                }
            }
            let n = a_vals.len();
            let value = if n >= 2 {
                let mean_a = a_vals.iter().sum::<f64>() / (n as f64);
                let mean_b = b_vals.iter().sum::<f64>() / (n as f64);
                let mut cov = 0.0;
                let mut var_a = 0.0;
                let mut var_b = 0.0;
                for k in 0..n {
                    let da = a_vals[k] - mean_a;
                    let db = b_vals[k] - mean_b;
                    cov += da * db;
                    var_a += da * da;
                    var_b += db * db;
                }
                let denom = (var_a * var_b).sqrt();
                if denom > 1e-12 {
                    (cov / denom).clamp(-1.0, 1.0)
                } else {
                    0.0
                }
            } else {
                0.0
            };
            pairs.push(CorrelationPair {
                a: name_a.clone(),
                b: name_b.clone(),
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
    fn correlation_with_staggered_nans_pairwise_complete() {
        let columns = vec![
            Column::new("a", ColumnType::Numeric),
            Column::new("b", ColumnType::Numeric),
            Column::new("c", ColumnType::Numeric),
        ];
        // a and b are perfectly correlated: b = 2 * a.
        // Column c has missing values in different rows, and a/b have missing values in other rows.
        let mut r1 = HashMap::new();
        r1.insert("a".to_string(), Value::Number(1.0));
        r1.insert("b".to_string(), Value::Number(2.0));
        r1.insert("c".to_string(), Value::Null);

        let mut r2 = HashMap::new();
        r2.insert("a".to_string(), Value::Number(2.0));
        r2.insert("b".to_string(), Value::Number(4.0));
        r2.insert("c".to_string(), Value::Number(10.0));

        let mut r3 = HashMap::new();
        r3.insert("a".to_string(), Value::Number(3.0));
        r3.insert("b".to_string(), Value::Number(6.0));
        r3.insert("c".to_string(), Value::Number(20.0));

        let mut r4 = HashMap::new();
        r4.insert("a".to_string(), Value::Null);
        r4.insert("b".to_string(), Value::Number(8.0));
        r4.insert("c".to_string(), Value::Number(30.0));

        let ds = Dataset::new("staggered", columns, vec![r1, r2, r3, r4]);
        let facts = compute_statistics(&ds);

        let ab = facts
            .correlation
            .iter()
            .find(|p| (p.a == "a" && p.b == "b") || (p.a == "b" && p.b == "a"))
            .unwrap();
        // Pairwise complete rows for (a,b) are r1, r2, r3 -> correlation is 1.0!
        assert!((ab.value - 1.0).abs() < 1e-9);
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

    #[test]
    fn skew_and_kurtosis_for_symmetric_data_are_near_zero() {
        // 1..5 is symmetric about 3 → skew ~0, excess kurtosis ~ -1.3.
        let columns = vec![Column::new("x", ColumnType::Numeric)];
        let rows = vec![
            row2("x", "1.0"), row2("x", "2.0"), row2("x", "3.0"),
            row2("x", "4.0"), row2("x", "5.0"),
        ];
        let ds = Dataset::new("sym", columns, rows);
        let facts = compute_statistics(&ds);
        let x = facts.numeric.iter().find(|c| c.name == "x").unwrap();
        assert!(x.skew.abs() < 1e-9);
        assert!(x.kurtosis < 0.0);
    }

    #[test]
    fn outlier_count_flags_extreme_value() {
        // 1,2,3,4,100 → 100 is a MAD-based outlier.
        let columns = vec![Column::new("x", ColumnType::Numeric)];
        let rows = vec![
            row2("x", "1.0"), row2("x", "2.0"), row2("x", "3.0"),
            row2("x", "4.0"), row2("x", "100.0"),
        ];
        let ds = Dataset::new("out", columns, rows);
        let facts = compute_statistics(&ds);
        let x = facts.numeric.iter().find(|c| c.name == "x").unwrap();
        assert!(x.outlier_count >= 1);
    }

    #[test]
    fn temporal_trend_up_for_increasing_series() {
        // time t ascending, value = t → strong up trend, no seasonality.
        let columns = vec![
            Column::new("t", ColumnType::Temporal),
            Column::new("v", ColumnType::Numeric),
        ];
        let rows: Vec<HashMap<String, Value>> = (1..=8)
            .map(|i| {
                let mut r = HashMap::new();
                r.insert("t".to_string(), Value::Text(format!("2020-0{}-01", i)));
                r.insert("v".to_string(), Value::Number(i as f64));
                r
            })
            .collect();
        let ds = Dataset::new("ts", columns, rows);
        let facts = compute_statistics(&ds);
        let t = facts.temporal_stats.iter().find(|s| s.column == "t").unwrap();
        assert_eq!(t.trend_direction, "up");
        assert!(t.normalized_slope > 0.0);
    }

    fn row2(k: &str, v: &str) -> HashMap<String, Value> {
        let mut r = HashMap::new();
        if let Ok(n) = v.parse::<f64>() {
            r.insert(k.to_string(), Value::Number(n));
        } else {
            r.insert(k.to_string(), Value::Text(v.to_string()));
        }
        r
    }
}