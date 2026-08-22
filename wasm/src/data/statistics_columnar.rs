//! Columnar analytical hot-path helpers.
//!
//! This module is the parity bridge between the row-major compatibility
//! statistics implementation and the Rust-owned primitive columnar sidecar.
//! It deliberately covers numeric descriptive statistics and pairwise Pearson
//! correlation first. Categorical and temporal policy remain in
//! `statistics.rs` until their columnar representations are ready.

use serde::Serialize;

use crate::data::columnar::PrimitiveColumn;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnarNumericStats {
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

pub fn numeric_stats(column: &PrimitiveColumn) -> ColumnarNumericStats {
    let mut values: Vec<f64> = column.finite_values().collect();
    let count = values.len();
    if count == 0 {
        return ColumnarNumericStats {
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
    let median = median_of(&values);
    let var = values.iter().map(|value| (value - mean).powi(2)).sum::<f64>() / count as f64;
    let std = var.sqrt();
    let min = values[0];
    let max = values[count - 1];
    let skew = statify::skewness(&values).unwrap_or(0.0);
    let kurtosis = statify::kurtosis(&values).unwrap_or(0.0);
    let outlier_count = outlier_count(&values, 1.5);

    ColumnarNumericStats {
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

/// Pearson correlation over pairwise-complete finite rows.
///
/// Validity is intersected directly in the columnar buffers, avoiding row-map
/// lookup and preserving the existing statistics contract for staggered
/// missingness.
pub fn pearson_pairwise(a: &PrimitiveColumn, b: &PrimitiveColumn) -> f64 {
    let len = a
        .values
        .len()
        .min(a.validity.len())
        .min(b.values.len())
        .min(b.validity.len());

    let mut a_vals = Vec::new();
    let mut b_vals = Vec::new();
    for index in 0..len {
        if a.validity[index] != 0 && b.validity[index] != 0 {
            a_vals.push(a.values[index]);
            b_vals.push(b.values[index]);
        }
    }

    let n = a_vals.len();
    if n < 2 {
        return 0.0;
    }

    let mean_a = a_vals.iter().sum::<f64>() / n as f64;
    let mean_b = b_vals.iter().sum::<f64>() / n as f64;
    let mut covariance = 0.0;
    let mut variance_a = 0.0;
    let mut variance_b = 0.0;
    for index in 0..n {
        let da = a_vals[index] - mean_a;
        let db = b_vals[index] - mean_b;
        covariance += da * db;
        variance_a += da * da;
        variance_b += db * db;
    }

    let denominator = (variance_a * variance_b).sqrt();
    if denominator > 1e-12 {
        (covariance / denominator).clamp(-1.0, 1.0)
    } else {
        0.0
    }
}

fn median_of(sorted: &[f64]) -> f64 {
    let n = sorted.len();
    if n == 0 {
        0.0
    } else if n % 2 == 1 {
        sorted[n / 2]
    } else {
        (sorted[n / 2 - 1] + sorted[n / 2]) / 2.0
    }
}

fn outlier_count(sorted: &[f64], iqr_multiplier: f64) -> usize {
    let n = sorted.len();
    if n < 4 {
        return 0;
    }
    let median = median_of(sorted);
    let mut deviations: Vec<f64> = sorted.iter().map(|value| (value - median).abs()).collect();
    deviations.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let mad = median_of(&deviations);
    if mad == 0.0 {
        let q1 = sorted[(n as f64 * 0.25).floor() as usize];
        let q3_index = (n as f64 * 0.75).ceil() as usize;
        let q3 = sorted[if q3_index >= n { n - 1 } else { q3_index }];
        let iqr = q3 - q1;
        let lower = q1 - iqr_multiplier * iqr;
        let upper = q3 + iqr_multiplier * iqr;
        return sorted.iter().filter(|value| **value < lower || **value > upper).count();
    }

    sorted
        .iter()
        .filter(|value| (0.6745 * (**value - median) / mad).abs() > 3.5)
        .count()
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::data::column::{Column, ColumnType};
    use crate::data::columnar::ColumnarDataset;
    use crate::data::dataset::Dataset;
    use crate::data::statistics;
    use crate::data::value::Value;

    use super::*;

    fn dataset() -> Dataset {
        Dataset::new(
            "columnar-statistics",
            vec![
                Column::new("x", ColumnType::Numeric),
                Column::new("y", ColumnType::Numeric),
            ],
            vec![
                HashMap::from([
                    ("x".to_string(), Value::Number(1.0)),
                    ("y".to_string(), Value::Number(2.0)),
                ]),
                HashMap::from([
                    ("x".to_string(), Value::Number(2.0)),
                    ("y".to_string(), Value::Number(4.0)),
                ]),
                HashMap::from([
                    ("x".to_string(), Value::Null),
                    ("y".to_string(), Value::Number(8.0)),
                ]),
                HashMap::from([
                    ("x".to_string(), Value::Number(4.0)),
                    ("y".to_string(), Value::Number(8.0)),
                ]),
            ],
        )
    }

    #[test]
    fn numeric_stats_match_row_major_contract() {
        let dataset = dataset();
        let columnar = ColumnarDataset::from_dataset(&dataset);
        let column = columnar.primitive_column(0).expect("x column");
        let actual = numeric_stats(column);
        let legacy = statistics::compute_statistics(&dataset)
            .numeric
            .into_iter()
            .find(|stats| stats.name == "x")
            .expect("legacy x stats");

        assert_eq!(actual.count, legacy.count);
        assert_eq!(actual.sum, legacy.sum);
        assert_eq!(actual.mean, legacy.mean);
        assert_eq!(actual.median, legacy.median);
        assert_eq!(actual.std, legacy.std);
        assert_eq!(actual.var, legacy.var);
        assert_eq!(actual.min, legacy.min);
        assert_eq!(actual.max, legacy.max);
        assert_eq!(actual.skew, legacy.skew);
        assert_eq!(actual.kurtosis, legacy.kurtosis);
        assert_eq!(actual.outlier_count, legacy.outlier_count);
    }

    #[test]
    fn pairwise_correlation_matches_row_major_contract_with_missingness() {
        let dataset = dataset();
        let columnar = ColumnarDataset::from_dataset(&dataset);
        let actual = pearson_pairwise(
            columnar.primitive_column(0).expect("x column"),
            columnar.primitive_column(1).expect("y column"),
        );
        let legacy = statistics::compute_statistics(&dataset)
            .correlation
            .into_iter()
            .find(|pair| pair.a == "x" && pair.b == "y")
            .expect("legacy xy correlation")
            .value;

        assert!((actual - legacy).abs() < 1e-12);
        assert!((actual - 1.0).abs() < 1e-12);
    }
}
