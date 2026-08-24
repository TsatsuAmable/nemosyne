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

    let mut observation_count = 0usize;
    let mut value_sum = 0.0;
    let mut value_min = f64::INFINITY;
    let mut value_max = f64::NEG_INFINITY;
    let mut previous_time: Option<f64> = None;
    let mut is_time_ordered = true;
    for index in 0..len {
        if time.validity[index] != 0 && values.validity[index] != 0 {
            let time_value = time.values[index];
            let value = values.values[index];
            if previous_time.is_some_and(|previous| {
                previous
                    .partial_cmp(&time_value)
                    .unwrap_or(std::cmp::Ordering::Equal)
                    == std::cmp::Ordering::Greater
            }) {
                is_time_ordered = false;
            }
            previous_time = Some(time_value);
            observation_count += 1;
            value_sum += value;
            value_min = value_min.min(value);
            value_max = value_max.max(value);
        }
    }

    if observation_count < 3 {
        return ColumnarTemporalStats {
            trend_direction: "flat".to_string(),
            seasonality_hint: false,
            normalized_slope: 0.0,
            observation_count,
        };
    }

    if is_time_ordered {
        let values_in_time_order = || {
            (0..len)
                .filter(|index| time.validity[*index] != 0 && values.validity[*index] != 0)
                .map(|index| values.values[index])
        };
        let y_mean = value_sum / observation_count as f64;
        let x_mean = (observation_count - 1) as f64 / 2.0;
        let mut numerator = 0.0;
        let mut denominator = 0.0;
        for (index, value) in values_in_time_order().enumerate() {
            numerator += (index as f64 - x_mean) * (value - y_mean);
            denominator += (index as f64 - x_mean).powi(2);
        }

        let lag = ((observation_count as f64) / 4.0).floor().max(1.0) as usize;
        let mut covariance = 0.0;
        let mut variance_a = 0.0;
        let mut variance_b = 0.0;
        for (a, b) in values_in_time_order()
            .take(observation_count - lag)
            .zip(values_in_time_order().skip(lag))
        {
            let a = a - y_mean;
            let b = b - y_mean;
            covariance += a * b;
            variance_a += a * a;
            variance_b += b * b;
        }

        return assemble_temporal_stats(
            observation_count,
            numerator,
            denominator,
            value_min,
            value_max,
            covariance,
            variance_a,
            variance_b,
        );
    }

    let mut keyed = Vec::with_capacity(observation_count);
    for index in 0..len {
        if time.validity[index] != 0 && values.validity[index] != 0 {
            keyed.push((time.values[index], values.values[index]));
        }
    }
    keyed.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
    let n = keyed.len();
    let x_mean = (n - 1) as f64 / 2.0;
    let y_mean = keyed.iter().map(|(_, value)| value).sum::<f64>() / n as f64;
    let mut numerator = 0.0;
    let mut denominator = 0.0;
    for (index, (_, value)) in keyed.iter().enumerate() {
        numerator += (index as f64 - x_mean) * (value - y_mean);
        denominator += (index as f64 - x_mean).powi(2);
    }
    let min = keyed
        .iter()
        .map(|(_, value)| *value)
        .fold(f64::INFINITY, f64::min);
    let max = keyed
        .iter()
        .map(|(_, value)| *value)
        .fold(f64::NEG_INFINITY, f64::max);

    let lag = ((n as f64) / 4.0).floor().max(1.0) as usize;
    let mut covariance = 0.0;
    let mut variance_a = 0.0;
    let mut variance_b = 0.0;
    for index in 0..(n - lag) {
        let a = keyed[index].1 - y_mean;
        let b = keyed[index + lag].1 - y_mean;
        covariance += a * b;
        variance_a += a * a;
        variance_b += b * b;
    }

    assemble_temporal_stats(
        n,
        numerator,
        denominator,
        min,
        max,
        covariance,
        variance_a,
        variance_b,
    )
}

fn assemble_temporal_stats(
    observation_count: usize,
    numerator: f64,
    denominator: f64,
    min: f64,
    max: f64,
    covariance: f64,
    variance_a: f64,
    variance_b: f64,
) -> ColumnarTemporalStats {
    let slope = if denominator > 0.0 {
        numerator / denominator
    } else {
        0.0
    };
    let range = max - min;
    let normalized_slope = if range > 0.0 { slope / range } else { 0.0 };
    let trend_direction = if normalized_slope > 0.01 {
        "up"
    } else if normalized_slope < -0.01 {
        "down"
    } else {
        "flat"
    };
    let autocorrelation = if variance_a > 0.0 && variance_b > 0.0 {
        covariance / (variance_a * variance_b).sqrt()
    } else {
        0.0
    };

    ColumnarTemporalStats {
        trend_direction: trend_direction.to_string(),
        seasonality_hint: autocorrelation > 0.5,
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
    fn unordered_numeric_temporal_stats_retain_sorted_time_semantics() {
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
        assert!((actual.normalized_slope - 0.2).abs() < 1e-12);
    }
}
