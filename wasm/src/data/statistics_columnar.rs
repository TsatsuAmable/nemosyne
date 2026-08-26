//! Columnar analytical hot-path helpers.
//!
//! This module is the parity bridge between row-major compatibility statistics
//! and the Rust-owned columnar sidecar. Numeric descriptive statistics,
//! pairwise Pearson correlation, categorical summaries, and numeric/epoch
//! temporal trend semantics live here under Rust analytical authority.

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
    pub iqr: f64,
    pub is_multimodal: bool,
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
    /// Seasonality is deliberately not inferred from observation-rank lag
    /// autocorrelation. Regular-series seasonality belongs to the spectral
    /// estimator, which validates actual sampling geometry first.
    pub seasonality_hint: bool,
    /// Dimensionless slope after normalising the actual time axis to [0, 1]
    /// and dividing by observed value range. This is invariant to time units.
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
            iqr: 0.0,
            is_multimodal: false,
        };
    }

    values.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let sum: f64 = values.iter().sum();
    let mean = sum / count as f64;
    let median = median_of(&values);
    let var = values
        .iter()
        .map(|value| (value - mean).powi(2))
        .sum::<f64>()
        / count as f64;
    let std = var.sqrt();
    let min = values[0];
    let max = values[count - 1];
    let skew = statify::skewness(&values).unwrap_or(0.0);
    let kurtosis = statify::kurtosis(&values).unwrap_or(0.0);
    let outlier_count = outlier_count(&values, 1.5);
    let (iqr, is_multimodal) = iqr_and_multimodality(&values);

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
        iqr,
        is_multimodal,
    }
}

fn iqr_and_multimodality(sorted: &[f64]) -> (f64, bool) {
    let n = sorted.len();
    if n < 4 {
        return (0.0, false);
    }
    let q1_idx = (0.25 * (n - 1) as f64).round() as usize;
    let q3_idx = (0.75 * (n - 1) as f64).round() as usize;
    let iqr = (sorted[q3_idx] - sorted[q1_idx]).max(0.0);
    let min = sorted[0];
    let max = sorted[n - 1];
    let range = max - min;
    if range <= 1e-9 || n < 12 {
        return (iqr, false);
    }

    let mut bins = [0usize; 8];
    for value in sorted {
        let bin =
            ((((value - min) / range) * bins.len() as f64).floor() as usize).min(bins.len() - 1);
        bins[bin] += 1;
    }
    let mut peaks = 0;
    for index in 0..bins.len() {
        let left = if index == 0 { 0 } else { bins[index - 1] };
        let right = if index + 1 == bins.len() {
            0
        } else {
            bins[index + 1]
        };
        if bins[index] > left && bins[index] > right && bins[index] >= n / 10 {
            peaks += 1;
        }
    }
    (iqr, peaks >= 2)
}

/// Pearson correlation over pairwise-complete finite rows.
pub fn pearson_pairwise(a: &PrimitiveColumn, b: &PrimitiveColumn) -> f64 {
    let len = a
        .values
        .len()
        .min(a.validity.len())
        .min(b.values.len())
        .min(b.validity.len());

    let mut n = 0usize;
    let mut sum_a = 0.0;
    let mut sum_b = 0.0;
    for index in 0..len {
        if a.validity[index] != 0 && b.validity[index] != 0 {
            n += 1;
            sum_a += a.values[index];
            sum_b += b.values[index];
        }
    }

    if n < 2 {
        return 0.0;
    }

    let mean_a = sum_a / n as f64;
    let mean_b = sum_b / n as f64;
    let mut covariance = 0.0;
    let mut variance_a = 0.0;
    let mut variance_b = 0.0;
    for index in 0..len {
        if a.validity[index] != 0 && b.validity[index] != 0 {
            let da = a.values[index] - mean_a;
            let db = b.values[index] - mean_b;
            covariance += da * db;
            variance_a += da * da;
            variance_b += db * db;
        }
    }

    let denominator = (variance_a * variance_b).sqrt();
    if denominator > 1e-12 {
        (covariance / denominator).clamp(-1.0, 1.0)
    } else {
        0.0
    }
}

/// Categorical statistics over dictionary codes rather than row-map strings.
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

/// Trend analysis for numeric/epoch temporal columns paired with a numeric
/// value column.
///
/// RF-028: observations are intersected by validity, sorted by the actual time
/// coordinate, and regressed against normalized timestamps. Observation rank is
/// never substituted for elapsed time. Seasonality is intentionally false here;
/// the spectral estimator owns seasonality only after regular-sampling checks.
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
        if time.validity[index] == 0 || values.validity[index] == 0 {
            continue;
        }
        let time_value = time.values[index];
        let value = values.values[index];
        if time_value.is_finite() && value.is_finite() {
            keyed.push((time_value, value));
        }
    }
    keyed.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

    assemble_temporal_stats(&keyed)
}

fn assemble_temporal_stats(keyed: &[(f64, f64)]) -> ColumnarTemporalStats {
    let observation_count = keyed.len();
    if observation_count < 3 {
        return ColumnarTemporalStats {
            trend_direction: "flat".to_string(),
            seasonality_hint: false,
            normalized_slope: 0.0,
            observation_count,
        };
    }

    let time_min = keyed.first().map(|pair| pair.0).unwrap_or(0.0);
    let time_max = keyed.last().map(|pair| pair.0).unwrap_or(time_min);
    let time_span = time_max - time_min;
    let value_min = keyed
        .iter()
        .map(|(_, value)| *value)
        .fold(f64::INFINITY, f64::min);
    let value_max = keyed
        .iter()
        .map(|(_, value)| *value)
        .fold(f64::NEG_INFINITY, f64::max);
    let value_range = value_max - value_min;

    if !time_span.is_finite() || time_span <= 0.0 || !value_range.is_finite() || value_range <= 0.0 {
        return ColumnarTemporalStats {
            trend_direction: "flat".to_string(),
            seasonality_hint: false,
            normalized_slope: 0.0,
            observation_count,
        };
    }

    let x_mean = keyed
        .iter()
        .map(|(time, _)| (*time - time_min) / time_span)
        .sum::<f64>()
        / observation_count as f64;
    let y_mean = keyed.iter().map(|(_, value)| *value).sum::<f64>() / observation_count as f64;
    let mut numerator = 0.0;
    let mut denominator = 0.0;
    for (time, value) in keyed {
        let x = (*time - time_min) / time_span;
        numerator += (x - x_mean) * (*value - y_mean);
        denominator += (x - x_mean).powi(2);
    }

    let slope = if denominator > 0.0 {
        numerator / denominator
    } else {
        0.0
    };
    let normalized_slope = slope / value_range;
    let trend_direction = if normalized_slope > 0.01 {
        "up"
    } else if normalized_slope < -0.01 {
        "down"
    } else {
        "flat"
    };

    ColumnarTemporalStats {
        trend_direction: trend_direction.to_string(),
        seasonality_hint: false,
        normalized_slope,
        observation_count,
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
        return sorted
            .iter()
            .filter(|value| **value < lower || **value > upper)
            .count();
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
    fn numeric_distribution_shape_reuses_the_sorted_statistics_buffer() {
        let mut values = vec![0.0; 20];
        values.extend(vec![10.0; 20]);
        let column = PrimitiveColumn {
            validity: vec![1; values.len()],
            values,
        };
        let actual = numeric_stats(&column);
        assert_eq!(actual.iqr, 10.0);
        assert!(actual.is_multimodal);
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

    #[test]
    fn unordered_numeric_temporal_stats_use_actual_time_coordinates() {
        let time = PrimitiveColumn {
            values: vec![40.0, 10.0, 30.0, 20.0, 50.0, 60.0],
            validity: vec![1; 6],
        };
        let values = PrimitiveColumn {
            values: vec![4.0, 1.0, 3.0, 2.0, 5.0, 6.0],
            validity: vec![1; 6],
        };

        let actual = temporal_stats_numeric(&time, &values);
        assert_eq!(actual.observation_count, 6);
        assert_eq!(actual.trend_direction, "up");
        assert!((actual.normalized_slope - 1.0).abs() < 1e-12);
        assert!(!actual.seasonality_hint);
    }

    #[test]
    fn irregular_time_spacing_does_not_change_linear_trend_semantics() {
        let time = PrimitiveColumn {
            values: vec![0.0, 1.0, 3.0, 7.0, 15.0],
            validity: vec![1; 5],
        };
        let values = PrimitiveColumn {
            values: vec![0.0, 2.0, 6.0, 14.0, 30.0],
            validity: vec![1; 5],
        };
        let actual = temporal_stats_numeric(&time, &values);
        assert_eq!(actual.trend_direction, "up");
        assert!((actual.normalized_slope - 1.0).abs() < 1e-12);
        assert!(!actual.seasonality_hint);
    }

    #[test]
    fn temporal_trend_is_invariant_to_time_unit_rescaling() {
        let values = PrimitiveColumn {
            values: vec![1.0, 2.0, 4.0, 8.0],
            validity: vec![1; 4],
        };
        let seconds = PrimitiveColumn {
            values: vec![0.0, 1.0, 2.0, 3.0],
            validity: vec![1; 4],
        };
        let milliseconds = PrimitiveColumn {
            values: vec![0.0, 1000.0, 2000.0, 3000.0],
            validity: vec![1; 4],
        };
        let a = temporal_stats_numeric(&seconds, &values);
        let b = temporal_stats_numeric(&milliseconds, &values);
        assert_eq!(a.trend_direction, b.trend_direction);
        assert!((a.normalized_slope - b.normalized_slope).abs() < 1e-12);
    }
}
