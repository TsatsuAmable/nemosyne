//! Descriptive statistics (`Facts`) for a dataset.
//!
//! Numeric descriptive statistics and pairwise Pearson correlation use the
//! canonical primitive columnar substrate. Row-major access remains only for
//! categorical and transitional temporal/string policy until those physical
//! representations migrate as well.

use std::collections::HashMap;

use serde::Serialize;

use crate::data::column::{Column, ColumnType};
use crate::data::columnar::{ColumnarDataset, PrimitiveColumn};
use crate::data::dataset::Dataset;
use crate::data::statistics_columnar::{
    categorical_stats as columnar_categorical_stats, numeric_stats, pearson_pairwise,
    temporal_stats_numeric,
};
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
    pub iqr: f64,
    pub is_multimodal: bool,
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

/// Compatibility entry point for callers that hold only an owned Dataset.
///
/// Numeric analysis does not fall back to row-major algorithms: a temporary
/// columnar representation is constructed and the canonical implementation is
/// used. Registered handle-based callers should use `compute_statistics_with_columnar`
/// with the synchronized registry sidecar to avoid rebuilding it.
pub fn compute_statistics(dataset: &Dataset) -> Facts {
    let columnar = ColumnarDataset::from_dataset(dataset);
    compute_statistics_with_columnar(dataset, &columnar)
}

/// Compute the full `Facts` block using the synchronized columnar analytical
/// substrate for numeric descriptive statistics and pairwise correlation.
///
/// Dataset/schema and columnar storage are one analytical generation. Any
/// mismatch is therefore an invariant violation and must fail loudly rather
/// than producing partial scientific evidence.
pub fn compute_statistics_with_columnar(dataset: &Dataset, columnar: &ColumnarDataset) -> Facts {
    assert_eq!(
        dataset.row_count(),
        columnar.row_count(),
        "columnar invariant violation: dataset row count {} != columnar row count {}",
        dataset.row_count(),
        columnar.row_count()
    );

    let numeric_columns: Vec<(usize, String)> = dataset
        .columns
        .iter()
        .enumerate()
        .filter(|(_, column)| column.ty == ColumnType::Numeric)
        .map(|(index, column)| (index, column.name.clone()))
        .collect();

    validate_numeric_columnar_invariants(columnar, &numeric_columns, dataset.row_count());

    let numeric = numeric_columns
        .iter()
        .map(|(index, name)| {
            let primitive = columnar
                .primitive_column(*index)
                .expect("validated numeric primitive column must exist");
            let stats = numeric_stats(primitive);
            ColumnStats {
                name: name.clone(),
                count: stats.count,
                sum: stats.sum,
                mean: stats.mean,
                median: stats.median,
                std: stats.std,
                var: stats.var,
                min: stats.min,
                max: stats.max,
                skew: stats.skew,
                kurtosis: stats.kurtosis,
                outlier_count: stats.outlier_count,
                iqr: stats.iqr,
                is_multimodal: stats.is_multimodal,
            }
        })
        .collect();

    let correlation = correlate_columnar(columnar, &numeric_columns);

    let categorical = dataset
        .categorical_columns()
        .iter()
        .map(|column| categorical_stats(dataset, &column.name))
        .collect();

    let temporal_names: Vec<String> = dataset
        .temporal_columns()
        .iter()
        .map(|column| column.name.clone())
        .collect();

    let value_column = numeric_columns.first().map(|(_, name)| name.clone());
    let temporal_stats = temporal_names
        .iter()
        .map(|name| temporal_stats(dataset, name, value_column.as_deref()))
        .collect();

    Facts {
        row_count: dataset.row_count(),
        column_count: dataset.column_count(),
        numeric,
        correlation,
        categorical,
        temporal: temporal_names,
        temporal_stats,
    }
}

pub fn compute_statistics_from_columnar(
    columns: &[Column],
    columnar: &ColumnarDataset,
) -> Result<Facts, String> {
    let row_count = columnar.row_count();
    let numeric_columns: Vec<(usize, String)> = columns
        .iter()
        .enumerate()
        .filter(|(_, column)| column.ty == ColumnType::Numeric)
        .map(|(index, column)| (index, column.name.clone()))
        .collect();
    validate_numeric_columnar_invariants(columnar, &numeric_columns, row_count);

    let numeric = numeric_columns
        .iter()
        .map(|(index, name)| {
            let stats = numeric_stats(
                columnar
                    .primitive_column(*index)
                    .expect("validated numeric primitive column must exist"),
            );
            ColumnStats {
                name: name.clone(),
                count: stats.count,
                sum: stats.sum,
                mean: stats.mean,
                median: stats.median,
                std: stats.std,
                var: stats.var,
                min: stats.min,
                max: stats.max,
                skew: stats.skew,
                kurtosis: stats.kurtosis,
                outlier_count: stats.outlier_count,
                iqr: stats.iqr,
                is_multimodal: stats.is_multimodal,
            }
        })
        .collect();
    let correlation = correlate_columnar(columnar, &numeric_columns);

    let mut categorical = Vec::new();
    for (index, column) in columns.iter().enumerate() {
        if column.ty != ColumnType::Categorical {
            continue;
        }
        let source = columnar.categorical_column(index).ok_or_else(|| {
            format!(
                "columnar invariant violation: categorical column '{}' at schema index {index} is missing",
                column.name
            )
        })?;
        if source.codes.len() != row_count || source.validity.len() != row_count {
            return Err(format!(
                "columnar invariant violation: categorical column '{}' length does not match {row_count} rows",
                column.name
            ));
        }
        let stats = columnar_categorical_stats(source);
        categorical.push(CategoricalStats {
            name: column.name.clone(),
            cardinality: stats.cardinality,
            entropy: stats.entropy,
            top: stats
                .top
                .into_iter()
                .map(|bucket| CategoryCount {
                    value: bucket.value,
                    count: bucket.count,
                })
                .collect(),
        });
    }

    let temporal: Vec<String> = columns
        .iter()
        .filter(|column| column.ty == ColumnType::Temporal)
        .map(|column| column.name.clone())
        .collect();
    let value_column = numeric_columns.first();
    let mut temporal_stats = Vec::new();
    for (time_index, time_column) in columns
        .iter()
        .enumerate()
        .filter(|(_, column)| column.ty == ColumnType::Temporal)
    {
        let Some((value_index, value_name)) = value_column else {
            temporal_stats.push(TemporalStats {
                column: time_column.name.clone(),
                value_column: String::new(),
                trend_direction: "flat".to_string(),
                seasonality_hint: false,
                normalized_slope: 0.0,
            });
            continue;
        };
        let time = columnar.primitive_column(time_index).ok_or_else(|| {
            format!(
                "columnar invariant violation: temporal column '{}' at schema index {time_index} is missing",
                time_column.name
            )
        })?;
        let values = columnar
            .primitive_column(*value_index)
            .expect("validated numeric primitive column must exist");
        if time.values.len() != row_count || time.validity.len() != row_count {
            return Err(format!(
                "columnar invariant violation: temporal column '{}' length does not match {row_count} rows",
                time_column.name
            ));
        }
        let stats = temporal_stats_numeric(time, values);
        temporal_stats.push(TemporalStats {
            column: time_column.name.clone(),
            value_column: value_name.clone(),
            trend_direction: stats.trend_direction,
            seasonality_hint: stats.seasonality_hint,
            normalized_slope: stats.normalized_slope,
        });
    }

    Ok(Facts {
        row_count,
        column_count: columns.len(),
        numeric,
        correlation,
        categorical,
        temporal,
        temporal_stats,
    })
}

fn validate_numeric_columnar_invariants(
    columnar: &ColumnarDataset,
    numeric_columns: &[(usize, String)],
    expected_rows: usize,
) {
    for (index, name) in numeric_columns {
        let primitive = columnar.primitive_column(*index).unwrap_or_else(|| {
            panic!(
                "columnar invariant violation: numeric column '{name}' at schema index {index} is missing from the columnar dataset"
            )
        });
        validate_primitive_column(name, *index, primitive, expected_rows);
    }
}

fn validate_primitive_column(
    name: &str,
    index: usize,
    primitive: &PrimitiveColumn,
    expected_rows: usize,
) {
    assert_eq!(
        primitive.values.len(),
        expected_rows,
        "columnar invariant violation: numeric column '{name}' at schema index {index} has {} values for {expected_rows} rows",
        primitive.values.len()
    );
    assert_eq!(
        primitive.validity.len(),
        expected_rows,
        "columnar invariant violation: numeric column '{name}' at schema index {index} has validity length {} for {expected_rows} rows",
        primitive.validity.len()
    );
}

fn correlate_columnar(
    columnar: &ColumnarDataset,
    numeric_columns: &[(usize, String)],
) -> Vec<CorrelationPair> {
    let mut pairs = Vec::new();
    for i in 0..numeric_columns.len() {
        let (index_a, name_a) = &numeric_columns[i];
        let column_a = columnar
            .primitive_column(*index_a)
            .expect("validated numeric primitive column must exist");
        for (index_b, name_b) in numeric_columns.iter().skip(i + 1) {
            let column_b = columnar
                .primitive_column(*index_b)
                .expect("validated numeric primitive column must exist");
            pairs.push(CorrelationPair {
                a: name_a.clone(),
                b: name_b.clone(),
                value: pearson_pairwise(column_a, column_b),
            });
        }
    }
    pairs
}

/// Trend direction + seasonality hint for a temporal column paired with a
/// numeric value column. String-temporal handling remains row-materialized in
/// this transitional phase; epoch/numeric temporal migration is next.
fn temporal_stats(
    dataset: &Dataset,
    time_column: &str,
    value_column: Option<&str>,
) -> TemporalStats {
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
                t.to_key_string()
                    .bytes()
                    .fold(0f64, |acc, b| acc * 256.0 + b as f64)
            });
            // Keep the compatibility path aligned with the columnar validity
            // contract: a numeric/parseable temporal coordinate is admissible
            // only when finite. Non-numeric temporal text retains the existing
            // deterministic key-string fallback until temporal parsing policy
            // is formalized in the kernel.
            if !key.is_finite() {
                return None;
            }
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

    TemporalStats {
        column: time_column.to_string(),
        value_column: value_col,
        trend_direction: trend_direction.to_string(),
        seasonality_hint: corr > 0.5,
        normalized_slope,
    }
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
            .map(|&count| {
                let p = count as f64 / total as f64;
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
    use crate::data::statistics_columnar::temporal_stats_numeric;

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
        assert!((ab.value - 1.0).abs() < 1e-9);
    }

    #[test]
    fn categorical_entropy_and_top() {
        let facts = compute_statistics(&stats_dataset());
        let g = facts.categorical.iter().find(|c| c.name == "g").unwrap();
        assert_eq!(g.cardinality, 2);
        assert!(g.entropy > 0.0);
        assert_eq!(g.top.len(), 2);
        assert!(g.top.iter().all(|c| c.count == 2));
    }

    #[test]
    fn skew_and_kurtosis_for_symmetric_data_are_near_zero() {
        let columns = vec![Column::new("x", ColumnType::Numeric)];
        let rows = vec![
            row2("x", "1.0"),
            row2("x", "2.0"),
            row2("x", "3.0"),
            row2("x", "4.0"),
            row2("x", "5.0"),
        ];
        let ds = Dataset::new("sym", columns, rows);
        let facts = compute_statistics(&ds);
        let x = facts.numeric.iter().find(|c| c.name == "x").unwrap();
        assert!(x.skew.abs() < 1e-9);
        assert!(x.kurtosis < 0.0);
    }

    #[test]
    fn outlier_count_flags_extreme_value() {
        let columns = vec![Column::new("x", ColumnType::Numeric)];
        let rows = vec![
            row2("x", "1.0"),
            row2("x", "2.0"),
            row2("x", "3.0"),
            row2("x", "4.0"),
            row2("x", "100.0"),
        ];
        let ds = Dataset::new("out", columns, rows);
        let facts = compute_statistics(&ds);
        let x = facts.numeric.iter().find(|c| c.name == "x").unwrap();
        assert!(x.outlier_count >= 1);
    }

    #[test]
    fn temporal_trend_up_for_increasing_series() {
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
        let t = facts
            .temporal_stats
            .iter()
            .find(|s| s.column == "t")
            .unwrap();
        assert_eq!(t.trend_direction, "up");
        assert!(t.normalized_slope > 0.0);
    }

    #[test]
    fn non_finite_numeric_temporal_values_match_columnar_validity_policy() {
        let columns = vec![
            Column::new("t", ColumnType::Temporal),
            Column::new("v", ColumnType::Numeric),
        ];
        let rows = vec![
            temporal_row(Value::Number(1.0), 1.0),
            temporal_row(Value::Number(f64::NAN), 1000.0),
            temporal_row(Value::Number(2.0), 2.0),
            temporal_row(Value::Number(f64::INFINITY), 500.0),
            temporal_row(Value::Text("NaN".to_string()), -1000.0),
            temporal_row(Value::Number(f64::NEG_INFINITY), 250.0),
            temporal_row(Value::Number(3.0), 3.0),
            temporal_row(Value::Number(4.0), 4.0),
        ];
        let dataset = Dataset::new("temporal-nonfinite", columns, rows);
        let clean = Dataset::new(
            "temporal-clean",
            vec![
                Column::new("t", ColumnType::Temporal),
                Column::new("v", ColumnType::Numeric),
            ],
            vec![
                temporal_row(Value::Number(1.0), 1.0),
                temporal_row(Value::Number(2.0), 2.0),
                temporal_row(Value::Number(3.0), 3.0),
                temporal_row(Value::Number(4.0), 4.0),
            ],
        );

        let compatibility = temporal_stats(&dataset, "t", Some("v"));
        let clean_compatibility = temporal_stats(&clean, "t", Some("v"));
        assert_eq!(
            compatibility.trend_direction,
            clean_compatibility.trend_direction
        );
        assert_eq!(
            compatibility.seasonality_hint,
            clean_compatibility.seasonality_hint
        );
        assert!(
            (compatibility.normalized_slope - clean_compatibility.normalized_slope).abs() < 1e-12
        );

        let columnar = ColumnarDataset::from_dataset(&dataset);
        let columnar_stats = temporal_stats_numeric(
            columnar.primitive_column(0).expect("temporal primitive"),
            columnar.primitive_column(1).expect("numeric primitive"),
        );
        assert_eq!(columnar_stats.observation_count, 4);
        assert_eq!(
            compatibility.trend_direction,
            columnar_stats.trend_direction
        );
        assert_eq!(
            compatibility.seasonality_hint,
            columnar_stats.seasonality_hint
        );
        assert!((compatibility.normalized_slope - columnar_stats.normalized_slope).abs() < 1e-12);
    }

    #[test]
    fn direct_columnar_and_compatibility_entry_points_match() {
        let dataset = stats_dataset();
        let columnar = ColumnarDataset::from_dataset(&dataset);
        let compatibility = serde_json::to_value(compute_statistics(&dataset)).unwrap();
        let direct =
            serde_json::to_value(compute_statistics_with_columnar(&dataset, &columnar)).unwrap();
        assert_eq!(compatibility, direct);
    }

    #[test]
    #[should_panic(expected = "dataset row count")]
    fn row_count_mismatch_fails_fast() {
        let dataset = stats_dataset();
        let shorter = Dataset::new(
            "shorter",
            dataset.columns.clone(),
            dataset.rows.iter().take(3).cloned().collect(),
        );
        let columnar = ColumnarDataset::from_dataset(&shorter);
        let _ = compute_statistics_with_columnar(&dataset, &columnar);
    }

    #[test]
    #[should_panic(expected = "is missing from the columnar dataset")]
    fn missing_numeric_primitive_column_fails_fast() {
        let dataset = Dataset::new(
            "numeric-schema",
            vec![Column::new("x", ColumnType::Numeric)],
            vec![HashMap::from([("x".to_string(), Value::Number(1.0))])],
        );
        let incompatible = Dataset::new(
            "categorical-sidecar",
            vec![Column::new("x", ColumnType::Categorical)],
            vec![HashMap::from([(
                "x".to_string(),
                Value::Text("1".to_string()),
            )])],
        );
        let columnar = ColumnarDataset::from_dataset(&incompatible);
        let _ = compute_statistics_with_columnar(&dataset, &columnar);
    }

    #[test]
    #[should_panic(expected = "validity length")]
    fn truncated_validity_fails_fast() {
        let primitive = PrimitiveColumn {
            values: vec![1.0, 2.0],
            validity: vec![1],
        };
        validate_primitive_column("x", 0, &primitive, 2);
    }

    #[test]
    fn all_missing_numeric_column_is_valid_data_not_storage_corruption() {
        let dataset = Dataset::new(
            "all-missing",
            vec![Column::new("x", ColumnType::Numeric)],
            vec![
                HashMap::from([("x".to_string(), Value::Null)]),
                HashMap::from([("x".to_string(), Value::Null)]),
            ],
        );
        let facts = compute_statistics(&dataset);
        assert_eq!(facts.numeric.len(), 1);
        assert_eq!(facts.numeric[0].name, "x");
        assert_eq!(facts.numeric[0].count, 0);
    }

    fn temporal_row(t: Value, v: f64) -> HashMap<String, Value> {
        HashMap::from([("t".to_string(), t), ("v".to_string(), Value::Number(v))])
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
