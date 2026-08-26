//! Generic analytical operation request + dispatcher.
//!
//! The `Operation` enum is the canonical, serialisable analytical ABI: every
//! research-relevant transformation the kernel supports is expressible here,
//! and every variant is reproducible (no opaque JS closures cross the
//! boundary). Op names are aligned to `src/data/types.ts::OperationName`
//! (`anomaly_iqr`, `anomaly_zscore`, `k_means`, …) so the JS `toKernelSpec`
//! mapper (Wave 2) is a 1:1 projection.
//!
//! Provenance is recorded by the JS-facing export in `lib.rs` (which has the
//! raw request JSON for `parameters`); `apply` stays a pure function for
//! direct Rust-test use.

use std::collections::HashMap;

use serde::Deserialize;

use crate::data::column::{Column, ColumnType};
use crate::data::dataset::Dataset;
use crate::data::operations;
use crate::data::resource_budget::{self, AnalysisBudget};
use crate::data::value::Value;

// ---------------------------------------------------------------------------
// Filter predicate DSL
// ---------------------------------------------------------------------------

/// A serialisable filter predicate. This is the bounded DSL that replaces the
/// JS `filter(dataset, predicate: (row) => boolean)` closure: expressive enough
/// for the median-predicate and beyond, reproducible, and inspectable for
/// provenance `parameters`.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "op", rename_all = "lowercase")]
pub enum Predicate {
    Eq {
        column: String,
        value: serde_json::Value,
    },
    Ne {
        column: String,
        value: serde_json::Value,
    },
    Gt {
        column: String,
        value: f64,
    },
    Gte {
        column: String,
        value: f64,
    },
    Lt {
        column: String,
        value: f64,
    },
    Lte {
        column: String,
        value: f64,
    },
    In {
        column: String,
        values: Vec<serde_json::Value>,
    },
    Between {
        column: String,
        lo: f64,
        hi: f64,
    },
    IsNull {
        column: String,
    },
    And {
        children: Vec<Predicate>,
    },
    Or {
        children: Vec<Predicate>,
    },
    Not {
        child: Box<Predicate>,
    },
}

impl Predicate {
    pub fn evaluate(&self, row: &HashMap<String, Value>) -> bool {
        match self {
            Predicate::Eq { column, value } => {
                row.get(column).map(|v| *v == json_to_value(value)).unwrap_or(false)
            }
            Predicate::Ne { column, value } => {
                row.get(column).map(|v| *v != json_to_value(value)).unwrap_or(true)
            }
            Predicate::Gt { column, value } => cmp_num(row, column, |n| n > *value),
            Predicate::Gte { column, value } => cmp_num(row, column, |n| n >= *value),
            Predicate::Lt { column, value } => cmp_num(row, column, |n| n < *value),
            Predicate::Lte { column, value } => cmp_num(row, column, |n| n <= *value),
            Predicate::In { column, values } => {
                let target = row.get(column);
                match target {
                    None => false,
                    Some(v) => values.iter().any(|j| *v == json_to_value(j)),
                }
            }
            Predicate::Between { column, lo, hi } => {
                cmp_num(row, column, |n| n >= *lo && n <= *hi)
            }
            Predicate::IsNull { column } => matches!(row.get(column), None | Some(Value::Null)),
            Predicate::And { children } => children.iter().all(|c| c.evaluate(row)),
            Predicate::Or { children } => children.iter().any(|c| c.evaluate(row)),
            Predicate::Not { child } => !child.evaluate(row),
        }
    }
}

fn cmp_num(row: &HashMap<String, Value>, column: &str, pred: impl Fn(f64) -> bool) -> bool {
    row.get(column)
        .and_then(|v| v.as_number())
        .filter(|n| n.is_finite())
        .map(pred)
        .unwrap_or(false)
}

fn json_to_value(v: &serde_json::Value) -> Value {
    match v {
        serde_json::Value::Null => Value::Null,
        serde_json::Value::Bool(b) => Value::Bool(*b),
        serde_json::Value::Number(n) => Value::Number(n.as_f64().unwrap_or(0.0)),
        serde_json::Value::String(s) => Value::Text(s.clone()),
        other => Value::Text(other.to_string()),
    }
}

// ---------------------------------------------------------------------------
// Aggregate spec
// ---------------------------------------------------------------------------

/// Named aggregator functions. `Std`/`Var` use population statistics (ddof = 0).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AggregatorFn {
    Sum,
    Mean,
    Median,
    Min,
    Max,
    Count,
    Std,
    Var,
}

impl AggregatorFn {
    fn as_str(self) -> &'static str {
        match self {
            AggregatorFn::Sum => "sum",
            AggregatorFn::Mean => "mean",
            AggregatorFn::Median => "median",
            AggregatorFn::Min => "min",
            AggregatorFn::Max => "max",
            AggregatorFn::Count => "count",
            AggregatorFn::Std => "std",
            AggregatorFn::Var => "var",
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct Aggregator {
    pub column: String,
    pub function: AggregatorFn,
    /// Output column name. Defaults to `{column}_{function}`.
    #[serde(default, rename = "as")]
    pub as_name: Option<String>,
}

impl Aggregator {
    fn output_name(&self) -> String {
        self.as_name
            .clone()
            .unwrap_or_else(|| format!("{}_{}", self.column, self.function.as_str()))
    }
}

// ---------------------------------------------------------------------------
// Operation enum
// ---------------------------------------------------------------------------

/// Generic operation request sent from the JS host as JSON. Op names match
/// `src/data/types.ts::OperationName`.
#[derive(Debug, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum Operation {
    Filter {
        /// New: a declarative predicate tree.
        #[serde(default)]
        predicate: Option<Predicate>,
        /// Legacy: numeric range filter on `column` (`min`/`max` inclusive).
        #[serde(default)]
        column: Option<String>,
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
        /// Legacy single group key.
        #[serde(default)]
        group_by: Option<String>,
        /// New: multi-key grouping (overrides `group_by` when present).
        #[serde(default)]
        group_by_columns: Option<Vec<String>>,
        /// New: named aggregators. When absent, the legacy sum-all-numeric
        /// aggregator is used.
        #[serde(default)]
        aggregators: Option<Vec<Aggregator>>,
    },
    Compare {
        group_by: String,
        group_a: String,
        group_b: String,
        #[serde(default)]
        measures: Option<Vec<String>>,
    },
    Slice {
        start: usize,
        end: usize,
    },
    #[serde(rename = "anomaly_iqr")]
    AnomalyIqr {
        column: String,
        #[serde(default = "default_sensitivity")]
        sensitivity: f64,
    },
    #[serde(rename = "anomaly_zscore")]
    AnomalyZscore {
        column: String,
        #[serde(default)]
        sensitivity: Option<f64>,
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

/// Resource preflight deliberately uses source-row count rather than trying to
/// reproduce complete-case eligibility here. That can conservatively refuse a
/// dataset with extensive missingness, but it cannot under-estimate work before
/// the canonical clustering implementation gathers its metric matrix.
fn metric_dimensions(dataset: &Dataset, features: Option<&[String]>) -> usize {
    match features {
        Some(names) => names.len(),
        None => dataset.numeric_columns().len(),
    }
}

fn preflight_kmeans(dataset: &Dataset, k: usize, features: Option<&[String]>) -> Result<(), String> {
    let dimensions = metric_dimensions(dataset, features);
    if dataset.row_count() == 0 || dimensions == 0 {
        return Ok(());
    }
    let estimate = resource_budget::kmeans_estimate(
        dataset.row_count(),
        dimensions,
        k,
        AnalysisBudget::default(),
    );
    resource_budget::require_exact(&estimate)
}

fn preflight_hierarchical(dataset: &Dataset, features: Option<&[String]>) -> Result<(), String> {
    let dimensions = metric_dimensions(dataset, features);
    if dataset.row_count() == 0 || dimensions == 0 {
        return Ok(());
    }
    let estimate = resource_budget::hierarchical_estimate(
        dataset.row_count(),
        dimensions,
        AnalysisBudget::default(),
    );
    resource_budget::require_exact(&estimate)
}

fn preflight_dbscan(dataset: &Dataset, features: Option<&[String]>) -> Result<(), String> {
    let dimensions = metric_dimensions(dataset, features);
    if dataset.row_count() == 0 || dimensions == 0 {
        return Ok(());
    }
    // The current exact/grid neighbourhood implementations both emit a CSR
    // graph whose worst-case edge payload is dense. Until a governed bounded
    // adjacency/approximation mode exists, DBSCAN must fail closed when that
    // output or its work can exceed the shared kernel envelope.
    let estimate = resource_budget::exact_neighbourhood_estimate(
        dataset.row_count(),
        dimensions,
        AnalysisBudget::default(),
    );
    resource_budget::require_exact(&estimate)
}

/// Apply a generic operation to a dataset and return the transformed dataset.
pub fn apply(dataset: &Dataset, op: Operation) -> Result<Dataset, String> {
    match op {
        Operation::Filter {
            predicate,
            column,
            min,
            max,
        } => {
            let pred = if let Some(p) = predicate {
                p
            } else if let Some(col) = column {
                legacy_range_predicate(col, min, max)
            } else {
                return Err("filter requires `predicate` or `column`".to_string());
            };
            Ok(operations::filter(dataset, |row| pred.evaluate(row)))
        }
        Operation::Sort { column, ascending } => Ok(operations::sort(dataset, &column, ascending)),
        Operation::Aggregate {
            group_by,
            group_by_columns,
            aggregators,
        } => {
            let group_keys: Vec<String> = match group_by_columns {
                Some(cols) if !cols.is_empty() => cols,
                Some(_) => group_by.into_iter().collect(),
                None => group_by.into_iter().collect(),
            };
            if group_keys.is_empty() {
                return Err("aggregate requires `group_by` or `group_by_columns`".to_string());
            }
            match aggregators {
                Some(aggs) if !aggs.is_empty() => apply_aggregate(dataset, &group_keys, &aggs),
                _ => {
                    // Legacy: sum every numeric column per group.
                    let single = group_keys.join(",");
                    Ok(operations::aggregate(dataset, &group_keys[0], |group| {
                        operations::default_sum_aggregator(&group_keys[0], group)
                    })
                    .map_name(&format!("[aggregated by {}]", single)))
                }
            }
        }
        Operation::Compare {
            group_by,
            group_a,
            group_b,
            measures,
        } => apply_compare(dataset, &group_by, &group_a, &group_b, measures),
        Operation::Slice { start, end } => Ok(operations::slice(dataset, start, end)),
        Operation::AnomalyIqr { column, sensitivity } => {
            Ok(operations::anomaly_iqr(dataset, &column, sensitivity))
        }
        Operation::AnomalyZscore { column, sensitivity } => {
            Ok(anomaly_zscore(dataset, &column, sensitivity))
        }
        Operation::KMeans { k, features } => {
            preflight_kmeans(dataset, k, features.as_deref())?;
            let feature_refs: Option<Vec<&str>> =
                features.as_ref().map(|v| v.iter().map(|s| s.as_str()).collect());
            Ok(operations::k_means(dataset, k, feature_refs.as_deref()))
        }
        Operation::Hierarchical {
            k,
            linkage,
            features,
        } => {
            preflight_hierarchical(dataset, features.as_deref())?;
            let feature_refs: Option<Vec<&str>> =
                features.as_ref().map(|v| v.iter().map(|s| s.as_str()).collect());
            Ok(operations::hierarchical(
                dataset,
                feature_refs.as_deref(),
                &linkage,
                k,
            ))
        }
        Operation::Dbscan {
            eps,
            min_points,
            features,
        } => {
            preflight_dbscan(dataset, features.as_deref())?;
            let feature_refs: Option<Vec<&str>> =
                features.as_ref().map(|v| v.iter().map(|s| s.as_str()).collect());
            Ok(operations::dbscan(
                dataset,
                eps,
                min_points,
                feature_refs.as_deref(),
            ))
        }
    }
}

fn legacy_range_predicate(column: String, min: Option<f64>, max: Option<f64>) -> Predicate {
    let mut children = Vec::new();
    if let Some(lo) = min {
        children.push(Predicate::Gte {
            column: column.clone(),
            value: lo,
        });
    }
    if let Some(hi) = max {
        children.push(Predicate::Lte {
            column: column.clone(),
            value: hi,
        });
    }
    match children.len() {
        0 => Predicate::In {
            column,
            values: Vec::new(),
        }, // matches nothing
        1 => children.into_iter().next().unwrap(),
        _ => Predicate::And { children },
    }
}

fn apply_aggregate(
    dataset: &Dataset,
    group_keys: &[String],
    aggregators: &[Aggregator],
) -> Result<Dataset, String> {
    use std::collections::BTreeMap;
    let mut groups: BTreeMap<String, (Vec<Value>, Vec<&HashMap<String, Value>>)> = BTreeMap::new();
    for row in &dataset.rows {
        let key_vals: Vec<Value> = group_keys
            .iter()
            .map(|k| row.get(k).cloned().unwrap_or(Value::Null))
            .collect();
        let composite: String = key_vals
            .iter()
            .map(|v| v.to_key_string())
            .collect::<Vec<_>>()
            .join("\u{1f}");
        groups
            .entry(composite)
            .or_insert_with(|| (key_vals.clone(), Vec::new()))
            .1
            .push(row);
    }

    let mut out_columns: Vec<Column> = Vec::new();
    for k in group_keys {
        if let Some(c) = dataset.get_column(k) {
            out_columns.push(c.clone());
        } else {
            out_columns.push(Column::new(k.clone(), ColumnType::Unknown));
        }
    }
    for agg in aggregators {
        out_columns.push(Column::new(agg.output_name(), ColumnType::Numeric));
    }

    let mut out_rows: Vec<HashMap<String, Value>> = Vec::new();
    for (_, (key_vals, rows)) in &groups {
        let mut r = HashMap::new();
        for (k, v) in group_keys.iter().zip(key_vals.iter()) {
            r.insert(k.clone(), v.clone());
        }
        for agg in aggregators {
            let vals: Vec<f64> = rows
                .iter()
                .filter_map(|row| row.get(&agg.column).and_then(|v| v.as_number()))
                .filter(|n| n.is_finite())
                .collect();
            // `count` tallies non-null values of the column (text included),
            // not just numeric-parseable ones — matching the JS aggregator.
            let result = if matches!(agg.function, AggregatorFn::Count) {
                let non_null = rows
                    .iter()
                    .filter(|row| !matches!(row.get(&agg.column), None | Some(Value::Null)))
                    .count();
                non_null as f64
            } else {
                compute_aggregate(agg.function, &vals)
            };
            r.insert(agg.output_name(), Value::Number(result));
        }
        out_rows.push(r);
    }

    let mut result = dataset.clone_with_rows(
        out_rows,
        &format!("[aggregated by {}]", group_keys.join(",")),
    );
    result.columns = out_columns;
    Ok(result)
}

fn compute_aggregate(function: AggregatorFn, vals: &[f64]) -> f64 {
    if vals.is_empty() {
        return match function {
            AggregatorFn::Count => 0.0,
            _ => 0.0,
        };
    }
    let n = vals.len();
    match function {
        AggregatorFn::Sum => vals.iter().sum(),
        AggregatorFn::Mean => vals.iter().sum::<f64>() / n as f64,
        AggregatorFn::Median => {
            let mut s = vals.to_vec();
            s.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            if n % 2 == 0 {
                (s[n / 2 - 1] + s[n / 2]) / 2.0
            } else {
                s[n / 2]
            }
        }
        AggregatorFn::Min => vals.iter().copied().fold(f64::INFINITY, f64::min),
        AggregatorFn::Max => vals.iter().copied().fold(f64::NEG_INFINITY, f64::max),
        AggregatorFn::Count => n as f64,
        AggregatorFn::Var => {
            let mean = vals.iter().sum::<f64>() / n as f64;
            vals.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / n as f64
        }
        AggregatorFn::Std => {
            let mean = vals.iter().sum::<f64>() / n as f64;
            let var = vals.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / n as f64;
            var.sqrt()
        }
    }
}

fn apply_compare(
    dataset: &Dataset,
    group_by: &str,
    group_a: &str,
    group_b: &str,
    measures: Option<Vec<String>>,
) -> Result<Dataset, String> {
    let measure_cols: Vec<String> = match measures {
        Some(m) if !m.is_empty() => m,
        _ => dataset
            .numeric_columns()
            .iter()
            .map(|c| c.name.clone())
            .filter(|n| n != group_by)
            .collect(),
    };

    let mut rows_a: Vec<&HashMap<String, Value>> = Vec::new();
    let mut rows_b: Vec<&HashMap<String, Value>> = Vec::new();
    for row in &dataset.rows {
        let key = row
            .get(group_by)
            .map(|v| v.to_key_string())
            .unwrap_or_default();
        if key == group_a {
            rows_a.push(row);
        } else if key == group_b {
            rows_b.push(row);
        }
    }

    let columns = vec![
        Column::new(group_by.to_string(), ColumnType::Categorical),
        Column::new("_measure".to_string(), ColumnType::Text),
        Column::new("_groupA".to_string(), ColumnType::Categorical),
        Column::new("_groupB".to_string(), ColumnType::Categorical),
        Column::new("_meanA".to_string(), ColumnType::Numeric),
        Column::new("_meanB".to_string(), ColumnType::Numeric),
        Column::new("_difference".to_string(), ColumnType::Numeric),
        Column::new("_countA".to_string(), ColumnType::Numeric),
        Column::new("_countB".to_string(), ColumnType::Numeric),
    ];

    let mut out_rows = Vec::new();
    for measure in &measure_cols {
        let vals_a: Vec<f64> = rows_a
            .iter()
            .filter_map(|r| r.get(measure).and_then(|v| v.as_number()))
            .filter(|n| n.is_finite())
            .collect();
        let vals_b: Vec<f64> = rows_b
            .iter()
            .filter_map(|r| r.get(measure).and_then(|v| v.as_number()))
            .filter(|n| n.is_finite())
            .collect();
        let mean_a = mean_of(&vals_a);
        let mean_b = mean_of(&vals_b);
        let difference = match (mean_a, mean_b) {
            (Some(a), Some(b)) => Some(a - b),
            _ => None,
        };
        let mut r = HashMap::new();
        r.insert(
            group_by.to_string(),
            Value::Text(format!("{} vs {}", group_a, group_b)),
        );
        r.insert("_measure".to_string(), Value::Text(measure.clone()));
        r.insert("_groupA".to_string(), Value::Text(group_a.to_string()));
        r.insert("_groupB".to_string(), Value::Text(group_b.to_string()));
        r.insert("_meanA".to_string(), num_or_null(mean_a));
        r.insert("_meanB".to_string(), num_or_null(mean_b));
        r.insert("_difference".to_string(), num_or_null(difference));
        r.insert(
            "_countA".to_string(),
            Value::Number(vals_a.len() as f64),
        );
        r.insert(
            "_countB".to_string(),
            Value::Number(vals_b.len() as f64),
        );
        out_rows.push(r);
    }

    let mut result = dataset.clone_with_rows(
        out_rows,
        &format!("[compare {} vs {}]", group_a, group_b),
    );
    result.columns = columns;
    Ok(result)
}

fn mean_of(vals: &[f64]) -> Option<f64> {
    if vals.is_empty() {
        None
    } else {
        Some(vals.iter().sum::<f64>() / vals.len() as f64)
    }
}

fn num_or_null(opt: Option<f64>) -> Value {
    match opt {
        Some(n) => Value::Number(n),
        None => Value::Null,
    }
}

/// Z-score anomaly detection. Adds `_anomaly` (boolean) and `_anomalyScore`
/// (the z value). Population std (ddof = 0), matching the JS `anomaly('zscore')`
/// semantics. Default threshold 3.0.
fn anomaly_zscore(dataset: &Dataset, column_name: &str, threshold: Option<f64>) -> Dataset {
    let threshold = threshold.unwrap_or(3.0);
    let values: Vec<f64> = dataset
        .get_column_values(column_name)
        .into_iter()
        .flatten()
        .filter_map(|v| v.as_number())
        .filter(|n| n.is_finite())
        .collect();
    let (mean, std) = if values.is_empty() {
        (0.0, 0.0)
    } else {
        let mean = values.iter().sum::<f64>() / values.len() as f64;
        let var = values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / values.len() as f64;
        (mean, var.sqrt())
    };

    let mut rows = dataset.rows.clone();
    for row in &mut rows {
        let (score, flag) = if std > 0.0 {
            if let Some(v) = row
                .get(column_name)
                .and_then(|v| v.as_number())
                .filter(|n| n.is_finite())
            {
                let z = (v - mean) / std;
                (z, z.abs() > threshold)
            } else {
                (0.0, false)
            }
        } else {
            (0.0, false)
        };
        row.insert("_anomaly".to_string(), Value::Bool(flag));
        row.insert("_anomalyScore".to_string(), Value::Number(score));
    }

    let mut columns = dataset.columns.clone();
    ensure_column(&mut columns, "_anomaly", ColumnType::Categorical);
    ensure_column(&mut columns, "_anomalyScore", ColumnType::Numeric);

    let mut result = dataset.clone_with_rows(rows, "[anomaly:zscore]");
    result.columns = columns;
    result
}

fn ensure_column(columns: &mut Vec<Column>, name: &str, ty: ColumnType) {
    if !columns.iter().any(|c| c.name == name) {
        columns.push(Column::new(name, ty));
    }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/// Small extension trait so the legacy aggregate path can relabel the cloned
/// dataset name without touching `operations::aggregate`.
trait DatasetNameExt {
    fn map_name(self, suffix: &str) -> Self;
}

impl DatasetNameExt for Dataset {
    fn map_name(mut self, suffix: &str) -> Self {
        self.name = format!("{} {}", self.name, suffix);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::column::ColumnType;

    fn sample() -> Dataset {
        let columns = vec![
            Column::new("name", ColumnType::Categorical),
            Column::new("age", ColumnType::Numeric),
            Column::new("team", ColumnType::Categorical),
        ];
        let rows = vec![
            row([("name", "Alice"), ("age", "30"), ("team", "A")]),
            row([("name", "Bob"), ("age", "25"), ("team", "B")]),
            row([("name", "Carol"), ("age", "40"), ("team", "A")]),
            row([("name", "Dave"), ("age", "35"), ("team", "B")]),
        ];
        Dataset::new("people", columns, rows)
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

    fn numeric_dataset(row_count: usize, dimensions: usize) -> Dataset {
        let columns: Vec<Column> = (0..dimensions)
            .map(|d| Column::new(format!("x{d}"), ColumnType::Numeric))
            .collect();
        let rows = (0..row_count)
            .map(|r| {
                (0..dimensions)
                    .map(|d| (format!("x{d}"), Value::Number((r + d) as f64)))
                    .collect::<HashMap<_, _>>()
            })
            .collect();
        Dataset::new("scale-fixture", columns, rows)
    }

    #[test]
    fn predicate_dsl_eq_and_between() {
        let ds = sample();
        let op = r#"{"op":"filter","predicate":{"op":"and","children":[{"op":"eq","column":"team","value":"A"},{"op":"gte","column":"age","value":35}]}}"#;
        let parsed: Operation = serde_json::from_str(op).unwrap();
        let result = apply(&ds, parsed).unwrap();
        assert_eq!(result.row_count(), 1);
        assert_eq!(
            result.rows[0].get("name").and_then(|v| v.as_text()),
            Some("Carol")
        );
    }

    #[test]
    fn predicate_dsl_in_and_not() {
        let ds = sample();
        let op = r#"{"op":"filter","predicate":{"op":"not","child":{"op":"in","column":"team","values":["A","B"]}}}"#;
        let parsed: Operation = serde_json::from_str(op).unwrap();
        let result = apply(&ds, parsed).unwrap();
        assert_eq!(result.row_count(), 0);
    }

    #[test]
    fn legacy_range_filter_still_works() {
        let ds = sample();
        let op = r#"{"op":"filter","column":"age","min":30}"#;
        let parsed: Operation = serde_json::from_str(op).unwrap();
        let result = apply(&ds, parsed).unwrap();
        assert_eq!(result.row_count(), 3);
    }

    #[test]
    fn aggregate_named_aggregators() {
        let ds = sample();
        let op = r#"{"op":"aggregate","group_by":"team","aggregators":[{"column":"age","function":"mean","as":"avgAge"},{"column":"age","function":"max","as":"maxAge"},{"column":"name","function":"count","as":"n"}]}"#;
        let parsed: Operation = serde_json::from_str(op).unwrap();
        let result = apply(&ds, parsed).unwrap();
        assert_eq!(result.row_count(), 2);
        let a = result
            .rows
            .iter()
            .find(|r| r.get("team").and_then(|v| v.as_text()) == Some("A"))
            .unwrap();
        assert!((a.get("avgAge").and_then(|v| v.as_number()).unwrap() - 35.0).abs() < 1e-9);
        assert_eq!(a.get("maxAge").and_then(|v| v.as_number()), Some(40.0));
        assert_eq!(a.get("n").and_then(|v| v.as_number()), Some(2.0));
    }

    #[test]
    fn aggregate_legacy_sum_all_numeric() {
        let ds = sample();
        let op = r#"{"op":"aggregate","group_by":"team"}"#;
        let parsed: Operation = serde_json::from_str(op).unwrap();
        let result = apply(&ds, parsed).unwrap();
        assert_eq!(result.row_count(), 2);
        // Legacy aggregator sums numeric columns (age) per group.
        let a = result
            .rows
            .iter()
            .find(|r| r.get("team").and_then(|v| v.as_text()) == Some("A"))
            .unwrap();
        assert_eq!(a.get("age").and_then(|v| v.as_number()), Some(70.0));
    }

    #[test]
    fn compare_two_groups() {
        let ds = sample();
        let op = r#"{"op":"compare","group_by":"team","group_a":"A","group_b":"B","measures":["age"]}"#;
        let parsed: Operation = serde_json::from_str(op).unwrap();
        let result = apply(&ds, parsed).unwrap();
        assert_eq!(result.row_count(), 1);
        let r = &result.rows[0];
        assert_eq!(r.get("_measure").and_then(|v| v.as_text()), Some("age"));
        assert_eq!(r.get("_meanA").and_then(|v| v.as_number()), Some(35.0));
        assert_eq!(r.get("_meanB").and_then(|v| v.as_number()), Some(30.0));
        assert_eq!(
            r.get("_difference").and_then(|v| v.as_number()),
            Some(5.0)
        );
        assert_eq!(r.get("_countA").and_then(|v| v.as_number()), Some(2.0));
    }

    #[test]
    fn anomaly_zscore_flags_outlier() {
        // 30,30,30,1000: the outlier inflates the population std, so its z-score
        // is ~1.73 — below the default threshold of 3 but above 1.5. Using the
        // `sensitivity` param exercises both the threshold wiring and the flag.
        let columns = vec![Column::new("v", ColumnType::Numeric)];
        let rows = vec![
            row_num("v", 30.0),
            row_num("v", 30.0),
            row_num("v", 30.0),
            row_num("v", 1000.0),
        ];
        let ds = Dataset::new("z", columns, rows);
        let op = r#"{"op":"anomaly_zscore","column":"v","sensitivity":1.5}"#;
        let parsed: Operation = serde_json::from_str(op).unwrap();
        let result = apply(&ds, parsed).unwrap();
        let flags: Vec<bool> = result
            .rows
            .iter()
            .map(|r| {
                r.get("_anomaly")
                    .map(|v| matches!(v, Value::Bool(true)))
                    .unwrap_or(false)
            })
            .collect();
        assert_eq!(flags, vec![false, false, false, true]);
    }

    fn row_num(col: &str, n: f64) -> HashMap<String, Value> {
        let mut r = HashMap::new();
        r.insert(col.to_string(), Value::Number(n));
        r
    }

    #[test]
    fn anomaly_iqr_op_name_matches_types() {
        // The op name must be `anomaly_iqr` (aligned to OperationName), not `anomaly`.
        let ds = sample();
        let op = r#"{"op":"anomaly_iqr","column":"age"}"#;
        let parsed: Operation = serde_json::from_str(op).unwrap();
        let result = apply(&ds, parsed).unwrap();
        assert!(result.get_column("_anomaly").is_some());
    }

    #[test]
    fn scale_preflight_rejects_pathological_hierarchical_work() {
        let ds = numeric_dataset(500, 2);
        let parsed: Operation = serde_json::from_str(
            r#"{"op":"hierarchical","k":2,"linkage":"average"}"#,
        )
        .unwrap();
        let error = apply(&ds, parsed).unwrap_err();
        assert!(error.starts_with("UNSUPPORTED_AT_SCALE:"));
        assert!(error.contains("operation=hierarchical_clustering"));
        assert!(error.contains("reason=EXACT_WORK_BUDGET_EXCEEDED"));
    }

    #[test]
    fn scale_preflight_rejects_dbscan_dense_csr_hazard() {
        let ds = numeric_dataset(5_000, 1);
        let parsed: Operation =
            serde_json::from_str(r#"{"op":"dbscan","eps":1.0,"min_points":3}"#).unwrap();
        let error = apply(&ds, parsed).unwrap_err();
        assert!(error.starts_with("UNSUPPORTED_AT_SCALE:"));
        assert!(error.contains("operation=radius_neighbourhood"));
        assert!(error.contains("reason=TRANSIENT_MEMORY_BUDGET_EXCEEDED"));
    }

    #[test]
    fn scale_preflight_rejects_kmeans_work_before_matrix_allocation() {
        let ds = numeric_dataset(5_000, 16);
        let parsed: Operation =
            serde_json::from_str(r#"{"op":"k_means","k":32}"#).unwrap();
        let error = apply(&ds, parsed).unwrap_err();
        assert!(error.starts_with("UNSUPPORTED_AT_SCALE:"));
        assert!(error.contains("operation=k_means"));
        assert!(error.contains("reason=EXACT_WORK_BUDGET_EXCEEDED"));
    }

    #[test]
    fn scale_preflight_preserves_small_clustering_operations() {
        let ds = numeric_dataset(20, 2);
        for spec in [
            r#"{"op":"k_means","k":2}"#,
            r#"{"op":"hierarchical","k":2,"linkage":"average"}"#,
            r#"{"op":"dbscan","eps":2.0,"min_points":1}"#,
        ] {
            let parsed: Operation = serde_json::from_str(spec).unwrap();
            assert!(apply(&ds, parsed).is_ok(), "small operation must remain admitted: {spec}");
        }
    }
}
