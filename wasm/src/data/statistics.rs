//! Descriptive statistics (`Facts`) for a dataset.
//!
//! Numeric descriptive statistics, pairwise Pearson correlation, and
//! numeric/epoch temporal trend analysis use the canonical primitive columnar
//! substrate. Row-major access remains only for categorical compatibility.

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
    /// Seasonality is supplied by the sampling-aware spectral estimator, not a
    /// rank-lag autocorrelation heuristic.
    pub seasonality_hint: bool,
    /// Dimensionless trend slope over normalized actual timestamps.
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
/// A temporary columnar representation is constructed and the canonical
/// numerical/temporal implementation is used.
pub fn compute_statistics(dataset: &Dataset) -> Facts {
    let columnar = ColumnarDataset::from_dataset(dataset);
    compute_statistics_with_columnar(dataset, &columnar)
}

/// Compute `Facts` using the synchronized columnar analytical substrate.
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

    let temporal_columns: Vec<(usize, String)> = dataset
        .columns
        .iter()
        .enumerate()
        .filter(|(_, column)| column.ty == ColumnType::Temporal)
        .map(|(index, column)| (index, column.name.clone()))
        .collect();
    let temporal = temporal_columns
        .iter()
        .map(|(_, name)| name.clone())
        .collect();
    let temporal_stats = build_temporal_stats(
        &dataset.columns,
        columnar,
        dataset.row_count(),
        &temporal_columns,
        numeric_columns.first(),
    )
    .expect("owned Dataset -> ColumnarDataset temporal invariants must hold");

    Facts {
        row_count: dataset.row_count(),
        column_count: dataset.column_count(),
        numeric,
        correlation,
        categorical,
        temporal,
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

    let temporal_columns: Vec<(usize, String)> = columns
        .iter()
        .enumerate()
        .filter(|(_, column)| column.ty == ColumnType::Temporal)
        .map(|(index, column)| (index, column.name.clone()))
        .collect();
    let temporal = temporal_columns
        .iter()
        .map(|(_, name)| name.clone())
        .collect();
    let temporal_stats = build_temporal_stats(
        columns,
        columnar,
        row_count,
        &temporal_columns,
        numeric_columns.first(),
    )?;

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

fn build_temporal_stats(
    columns: &[Column],
    columnar: &ColumnarDataset,
    row_count: usize,
    temporal_columns: &[(usize, String)],
    value_column: Option<&(usize, String)>,
) -> Result<Vec<TemporalStats>, String> {
    let mut output = Vec::new();
    for (time_index, time_name) in temporal_columns {
        let Some((value_index, value_name)) = value_column else {
            output.push(TemporalStats {
                column: time_name.clone(),
                value_column: String::new(),
                trend_direction: "flat".to_string(),
                seasonality_hint: false,
                normalized_slope: 0.0,
            });
            continue;
        };

        let time = columnar.primitive_column(*time_index).ok_or_else(|| {
            format!(
                "columnar invariant violation: temporal column '{}' at schema index {time_index} is missing",
                time_name
            )
        })?;
        if time.values.len() != row_count || time.validity.len() != row_count {
            return Err(format!(
                "columnar invariant violation: temporal column '{}' length does not match {row_count} rows",
                time_name
            ));
        }
        let values = columnar
            .primitive_column(*value_index)
            .expect("validated numeric primitive column must exist");
        let stats = temporal_stats_numeric(time, values);
        output.push(TemporalStats {
            column: time_name.clone(),
            value_column: value_name.clone(),
            trend_direction: stats.trend_direction,
            seasonality_hint: stats.seasonality_hint,
            normalized_slope: stats.normalized_slope,
        });
    }

    // Keep the schema argument in the signature as an explicit synchronized
    // generation witness; callers may not pair arbitrary sidecars with a
    // different schema even when indexes happen to exist.
    debug_assert!(temporal_columns
        .iter()
        .all(|(index, name)| columns.get(*index).is_some_and(|column| column.name == *name)));
    Ok(output)
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

fn categorical_stats(dataset: &Dataset, name: &str) -> CategoricalStats {
    let mut counts: HashMap<String, usize> = HashMap::new();
    let mut total = 0usize;
    for row in &dataset.rows {
        let key = match row.get(name) {
            Some(Value::Null) | None => continue,
            Some(value) => value.to_key_string(),
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
        let mut row = HashMap::new();
        for (key, value) in pairs {
            if let Ok(number) = value.parse::<f64>() {
                row.insert(key.to_string(), Value::Number(number));
            } else {
                row.insert(key.to_string(), Value::Text(value.to_string()));
            }
        }
        row
    }

    #[test]
    fn computes_numeric_stats() {
        let facts = compute_statistics(&stats_dataset());
        let x = facts.numeric.iter().find(|column| column.name == "x").unwrap();
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
            .find(|pair| (pair.a == "x" && pair.b == "y") || (pair.a == "y" && pair.b == "x"))
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

        let facts = compute_statistics(&Dataset::new("staggered", columns, vec![r1, r2, r3, r4]));
        let ab = facts
            .correlation
            .iter()
            .find(|pair| (pair.a == "a" && pair.b == "b") || (pair.a == "b" && pair.b == "a"))
            .unwrap();
        assert!((ab.value - 1.0).abs() < 1e-9);
    }

    #[test]
    fn categorical_entropy_and_top() {
        let facts = compute_statistics(&stats_dataset());
        let g = facts.categorical.iter().find(|column| column.name == "g").unwrap();
        assert_eq!(g.cardinality, 2);
        assert!(g.entropy > 0.0);
        assert_eq!(g.top.len(), 2);
        assert!(g.top.iter().all(|bucket| bucket.count == 2));
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
        let facts = compute_statistics(&Dataset::new("sym", columns, rows));
        let x = facts.numeric.iter().find(|column| column.name == "x").unwrap();
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
        let facts = compute_statistics(&Dataset::new("out", columns, rows));
        assert!(facts.numeric[0].outlier_count >= 1);
    }

    #[test]
    fn temporal_trend_uses_actual_numeric_timestamps() {
        let columns = vec![
            Column::new("t", ColumnType::Temporal),
            Column::new("v", ColumnType::Numeric),
        ];
        let rows = (0..8)
            .map(|index| {
                HashMap::from([
                    ("t".to_string(), Value::Number((index * index + 1) as f64)),
                    ("v".to_string(), Value::Number((index * index + 1) as f64 * 2.0)),
                ])
            })
            .collect();
        let facts = compute_statistics(&Dataset::new("ts", columns, rows));
        let temporal = facts.temporal_stats.iter().find(|stats| stats.column == "t").unwrap();
        assert_eq!(temporal.trend_direction, "up");
        assert!((temporal.normalized_slope - 1.0).abs() < 1e-12);
        assert!(!temporal.seasonality_hint);
    }

    #[test]
    fn unparsed_temporal_strings_fail_closed_instead_of_hashing_lexical_order() {
        let dataset = Dataset::new(
            "string-time",
            vec![
                Column::new("t", ColumnType::Temporal),
                Column::new("v", ColumnType::Numeric),
            ],
            (1..=8)
                .map(|index| {
                    HashMap::from([
                        ("t".to_string(), Value::Text(format!("2020-0{index}-01"))),
                        ("v".to_string(), Value::Number(index as f64)),
                    ])
                })
                .collect(),
        );
        let facts = compute_statistics(&dataset);
        let temporal = &facts.temporal_stats[0];
        assert_eq!(temporal.trend_direction, "flat");
        assert_eq!(temporal.normalized_slope, 0.0);
        assert!(!temporal.seasonality_hint);
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
        let facts = compute_statistics(&dataset);
        let compatibility = &facts.temporal_stats[0];
        let columnar = ColumnarDataset::from_dataset(&dataset);
        let direct = temporal_stats_numeric(
            columnar.primitive_column(0).expect("temporal primitive"),
            columnar.primitive_column(1).expect("numeric primitive"),
        );
        assert_eq!(direct.observation_count, 4);
        assert_eq!(compatibility.trend_direction, direct.trend_direction);
        assert_eq!(compatibility.seasonality_hint, direct.seasonality_hint);
        assert!((compatibility.normalized_slope - direct.normalized_slope).abs() < 1e-12);
    }

    #[test]
    fn temporal_row_order_and_time_unit_are_metamorphically_invariant() {
        let columns = vec![
            Column::new("t", ColumnType::Temporal),
            Column::new("v", ColumnType::Numeric),
        ];
        let base_rows = vec![
            temporal_row(Value::Number(0.0), 0.0),
            temporal_row(Value::Number(1.0), 1.0),
            temporal_row(Value::Number(4.0), 4.0),
            temporal_row(Value::Number(9.0), 9.0),
        ];
        let mut shuffled_rows = base_rows.clone();
        shuffled_rows.reverse();
        let milliseconds = base_rows
            .iter()
            .map(|row| {
                let time = row.get("t").and_then(Value::as_number).unwrap() * 1000.0;
                let value = row.get("v").cloned().unwrap();
                HashMap::from([("t".to_string(), Value::Number(time)), ("v".to_string(), value)])
            })
            .collect();

        let base = compute_statistics(&Dataset::new("base", columns.clone(), base_rows));
        let shuffled = compute_statistics(&Dataset::new("shuffled", columns.clone(), shuffled_rows));
        let scaled = compute_statistics(&Dataset::new("scaled", columns, milliseconds));
        assert_eq!(base.temporal_stats[0].trend_direction, shuffled.temporal_stats[0].trend_direction);
        assert_eq!(base.temporal_stats[0].trend_direction, scaled.temporal_stats[0].trend_direction);
        assert!((base.temporal_stats[0].normalized_slope - shuffled.temporal_stats[0].normalized_slope).abs() < 1e-12);
        assert!((base.temporal_stats[0].normalized_slope - scaled.temporal_stats[0].normalized_slope).abs() < 1e-12);
    }

    #[test]
    fn direct_columnar_and_compatibility_entry_points_match() {
        let dataset = stats_dataset();
        let columnar = ColumnarDataset::from_dataset(&dataset);
        let compatibility = serde_json::to_value(compute_statistics(&dataset)).unwrap();
        let direct = serde_json::to_value(compute_statistics_with_columnar(&dataset, &columnar)).unwrap();
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
            vec![HashMap::from([("x".to_string(), Value::Text("1".to_string()))])],
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

    fn temporal_row(time: Value, value: f64) -> HashMap<String, Value> {
        HashMap::from([
            ("t".to_string(), time),
            ("v".to_string(), Value::Number(value)),
        ])
    }

    fn row2(key: &str, value: &str) -> HashMap<String, Value> {
        let mut row = HashMap::new();
        if let Ok(number) = value.parse::<f64>() {
            row.insert(key.to_string(), Value::Number(number));
        } else {
            row.insert(key.to_string(), Value::Text(value.to_string()));
        }
        row
    }
}
