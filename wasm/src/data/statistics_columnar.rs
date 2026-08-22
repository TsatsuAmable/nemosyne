//! Columnar analytical hot-path helpers.
//!
//! This module is the parity bridge between row-major compatibility statistics
//! and the Rust-owned columnar sidecar. Numeric descriptive statistics and
//! pairwise Pearson correlation are already live. Categorical and numeric/epoch
//! temporal helpers live here first so their semantics can be proven before the
//! public `Facts` path switches authority.

use serde::Serialize;

use crate::data::columnar::{CategoricalColumn, PrimitiveColumn};

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

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ColumnarCategoryCount {
    pub value: String,
    pub count: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnarCategoricalStats {
    pub cardinality: usize,
    pub entropy: f64,
    pub top: Vec<ColumnarCategoryCount>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnarTemporalStats {
    pub trend_direction: String,
    pub seasonality_hint: bool,
    pub normalized_slope: f64,
    pub observation_count: usize,
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

/// Categorical statistics over dictionary codes rather than row-map strings.
/// Missing rows are excluded exactly as in the compatibility implementation.
pub fn categorical_stats(column: &CategoricalColumn) -> ColumnarCategoricalStats {
    let mut counts = vec![0usize; column.dictionary.len()];
    let mut total = 0usize;

    for code in column.valid_codes() {
        let index = code as usize;
        assert!(
            index < counts.len(),
            "columnar invariant violation: categorical code {index} exceeds dictionary cardinality {}",
            counts.len()
        );
        counts[index] += 1;
        total += 1;
    }

    let cardinality = counts.iter().filter(|count| **count > 0).count();
    let entropy = if total == 0 || cardinality <= 1 {
        0.0
    } else {
        counts
            .iter()
            .filter(|count| **count > 0)
            .map(|count| {
                let p = *count as f64 / total as f64;
                -p * p.log2()
            })
            .sum()
    };

    let mut top: Vec<ColumnarCategoryCount> = counts
        .into_iter()
        .enumerate()
        .filter(|(_, count)| *count > 0)
        .map(|(index, count)| ColumnarCategoryCount {
            value: column.dictionary[index].clone(),
            count,
        })
        .collect();
    top.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.value.cmp(&b.value)));
    top.truncate(5);

    ColumnarCategoricalStats {
        cardinality,
        entropy,
        top,
    }
}

/// Trend and seasonality analysis for numeric/epoch temporal columns paired
/// with a numeric value column.
///
/// This deliberately does not reinterpret string temporal values. Those retain
/// their compatibility policy until temporal parsing is represented explicitly
/// in the kernel rather than hidden in row-materialization heuristics.
pub fn temporal_stats_numeric(
    time: &PrimitiveColumn,
    values: &PrimitiveColumn,
) -> ColumnarTemporalStats {
    let len = time
        .values
        .len()
        .min(time.validity.len())
        .min(values.values.len())
        .min(values.validity.len());

    let mut keyed = Vec::new();
    for index in 0..len {
        if time.validity[index] != 0 && values.validity[index] != 0 {
            keyed.push((time.values[index], values.values[index]));
        }
    }
    keyed.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
    let series: Vec<f64> = keyed.iter().map(|(_, value)| *value).collect();
    let n = series.len();

    if n < 3 {
        return ColumnarTemporalStats {
            trend_direction: "flat".to_string(),
            seasonality_hint: false,
            normalized_slope: 0.0,
            observation_count: n,
        };
    }

    let x_mean = (n - 1) as f64 / 2.0;
    let y_mean = series.iter().sum::<f64>() / n as f64;
    let mut numerator = 0.0;
    let mut denominator = 0.0;
    for (index, value) in series.iter().enumerate() {
        numerator += (index as f64 - x_mean) * (value - y_mean);
        denominator += (index as f64 - x_mean).powi(2);
    }
    let slope = if denominator > 0.0 {
        numerator / denominator
    } else {
        0.0
    };
    let min = series.iter().copied().fold(f64::INFINITY, f64::min);
    let max = series.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let range = max - min;
    let normalized_slope = if range > 0.0 { slope / range } else { 0.0 };

    let trend_direction = if normalized_slope > 0.01 {
        "up"
    } else if normalized_slope < -0.01 {
        "down"
    } else {
        "flat"
    };

    let lag = ((n as f64) / 4.0).floor().max(1.0) as usize;
    let mut covariance = 0.0;
    let mut variance_a = 0.0;
    let mut variance_b = 0.0;
    for index in 0..(n - lag) {
        let a = series[index] - y_mean;
        let b = series[index + lag] - y_mean;
        covariance += a * b;
        variance_a += a * a;
        variance_b += b * b;
    }
    let autocorrelation = if variance_a > 0.0 && variance_b > 0.0 {
        covariance / (variance_a * variance_b).sqrt()
    } else {
        0.0
    };

    ColumnarTemporalStats {
        trend_direction: trend_direction.to_string(),
        seasonality_hint: autocorrelation > 0.5,
        normalized_slope,
        observation_count: n,
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
    fn numeric_stats_match_compatibility_contract() {
        let dataset = dataset();
        let columnar = ColumnarDataset::from_dataset(&dataset);
        let column = columnar.primitive_column(0).expect("x column");
        let actual = numeric_stats(column);
        let legacy = statistics::compute_statistics(&dataset)
            .numeric
            .into_iter()
            .find(|stats| stats.name == "x")
            .expect("compatibility x stats");

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
    fn pairwise_correlation_matches_compatibility_contract_with_missingness() {
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
            .expect("compatibility xy correlation")
            .value;

        assert!((actual - legacy).abs() < 1e-12);
        assert!((actual - 1.0).abs() < 1e-12);
    }

    #[test]
    fn dictionary_categorical_stats_match_compatibility_contract() {
        let dataset = Dataset::new(
            "categorical-parity",
            vec![Column::new("g", ColumnType::Categorical)],
            vec![
                HashMap::from([("g".to_string(), Value::Text("A".to_string()))]),
                HashMap::from([("g".to_string(), Value::Text("A".to_string()))]),
                HashMap::from([("g".to_string(), Value::Text("B".to_string()))]),
                HashMap::from([("g".to_string(), Value::Null)]),
                HashMap::new(),
            ],
        );
        let columnar = ColumnarDataset::from_dataset(&dataset);
        let actual = categorical_stats(columnar.categorical_column(0).expect("g column"));
        let legacy = statistics::compute_statistics(&dataset)
            .categorical
            .into_iter()
            .find(|stats| stats.name == "g")
            .expect("compatibility g stats");

        assert_eq!(actual.cardinality, legacy.cardinality);
        assert!((actual.entropy - legacy.entropy).abs() < 1e-12);
        assert_eq!(actual.top.len(), legacy.top.len());
        for (actual, legacy) in actual.top.iter().zip(legacy.top.iter()) {
            assert_eq!(actual.value, legacy.value);
            assert_eq!(actual.count, legacy.count);
        }
    }

    #[test]
    fn numeric_temporal_stats_match_compatibility_contract() {
        let dataset = Dataset::new(
            "temporal-parity",
            vec![
                Column::new("t", ColumnType::Temporal),
                Column::new("v", ColumnType::Numeric),
            ],
            (1..=8)
                .map(|index| {
                    HashMap::from([
                        ("t".to_string(), Value::Number(index as f64 * 10.0)),
                        ("v".to_string(), Value::Number(index as f64)),
                    ])
                })
                .collect(),
        );
        let columnar = ColumnarDataset::from_dataset(&dataset);
        let actual = temporal_stats_numeric(
            columnar.primitive_column(0).expect("t column"),
            columnar.primitive_column(1).expect("v column"),
        );
        let legacy = statistics::compute_statistics(&dataset)
            .temporal_stats
            .into_iter()
            .find(|stats| stats.column == "t")
            .expect("compatibility temporal stats");

        assert_eq!(actual.trend_direction, legacy.trend_direction);
        assert_eq!(actual.seasonality_hint, legacy.seasonality_hint);
        assert!((actual.normalized_slope - legacy.normalized_slope).abs() < 1e-12);
        assert_eq!(actual.observation_count, 8);
    }

    #[test]
    fn numeric_temporal_pairwise_validity_preserves_missingness() {
        let time = PrimitiveColumn {
            values: vec![10.0, 20.0, 30.0, 40.0],
            validity: vec![1, 1, 0, 1],
        };
        let values = PrimitiveColumn {
            values: vec![1.0, 2.0, 3.0, 4.0],
            validity: vec![1, 0, 1, 1],
        };
        let actual = temporal_stats_numeric(&time, &values);
        assert_eq!(actual.observation_count, 2);
        assert_eq!(actual.trend_direction, "flat");
        assert_eq!(actual.normalized_slope, 0.0);
    }
}
