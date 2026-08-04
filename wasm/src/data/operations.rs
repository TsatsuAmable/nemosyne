use std::collections::HashMap;

use crate::data::column::{Column, ColumnType};
use crate::data::dataset::Dataset;
use crate::data::value::Value;

/// Filter rows by a predicate on `Value`.
pub fn filter(dataset: &Dataset, predicate: impl Fn(&HashMap<String, Value>) -> bool) -> Dataset {
    let rows: Vec<HashMap<String, Value>> = dataset.rows.iter().filter(|r| predicate(r)).cloned().collect();
    dataset.clone_with_rows(rows, "[filtered]")
}

/// Sort rows by a column value.
pub fn sort(dataset: &Dataset, column_name: &str, ascending: bool) -> Dataset {
    let mut rows = dataset.rows.clone();
    rows.sort_by(|a, b| {
        let av = a.get(column_name);
        let bv = b.get(column_name);
        if av.is_none() {
            return std::cmp::Ordering::Greater;
        }
        if bv.is_none() {
            return std::cmp::Ordering::Less;
        }
        let av = av.unwrap();
        let bv = bv.unwrap();
        let ord = compare_values(av, bv);
        if ascending { ord } else { ord.reverse() }
    });
    dataset.clone_with_rows(rows, &format!("[sorted: {}]", column_name))
}

fn compare_values(a: &Value, b: &Value) -> std::cmp::Ordering {
    match (a.as_number(), b.as_number()) {
        (Some(an), Some(bn)) => an.partial_cmp(&bn).unwrap_or(std::cmp::Ordering::Equal),
        _ => a.to_key_string().cmp(&b.to_key_string()),
    }
}

/// Aggregate rows by a categorical column using a per-group aggregator.
pub fn aggregate(
    dataset: &Dataset,
    group_by: &str,
    aggregator: impl Fn(&[&HashMap<String, Value>]) -> HashMap<String, Value>,
) -> Dataset {
    use std::collections::BTreeMap;
    let mut groups: BTreeMap<String, Vec<&HashMap<String, Value>>> = BTreeMap::new();
    for row in &dataset.rows {
        let key = row
            .get(group_by)
            .map(|v| v.to_key_string())
            .unwrap_or_default();
        groups.entry(key).or_default().push(row);
    }
    let rows: Vec<HashMap<String, Value>> = groups.values().map(|g| aggregator(g)).collect();
    dataset.clone_with_rows(rows, &format!("[aggregated by {}]", group_by))
}

/// Slice rows by index range `[start, end)`.
pub fn slice(dataset: &Dataset, start: usize, end: usize) -> Dataset {
    let rows = dataset.rows[start.min(dataset.rows.len())..end.min(dataset.rows.len())].to_vec();
    dataset.clone_with_rows(rows, &format!("[slice {}-{}]", start, end))
}

/// Default numeric aggregator: sum all numeric columns, keep group key.
pub fn default_sum_aggregator(group_by: &str, group_rows: &[&HashMap<String, Value>]) -> HashMap<String, Value> {
    let mut result = HashMap::new();
    if let Some(first) = group_rows.first() {
        if let Some(key) = first.get(group_by) {
            result.insert(group_by.to_string(), key.clone());
        }
    }
    for row in group_rows {
        for (k, v) in *row {
            if k == group_by {
                continue;
            }
            if let Some(n) = v.as_number() {
                let entry = result.entry(k.clone()).or_insert_with(|| Value::Number(0.0));
                if let Value::Number(acc) = entry {
                    *acc += n;
                }
            }
        }
    }
    result
}

/// Detect anomalies in a numeric column using IQR.
pub fn anomaly_iqr(dataset: &Dataset, column_name: &str, sensitivity: f64) -> Dataset {
    let values: Vec<f64> = dataset
        .get_column_values(column_name)
        .into_iter()
        .filter_map(|v| v.and_then(|val| val.as_number()))
        .collect();

    let mut sorted = values.clone();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let q1 = percentile(&sorted, 0.25);
    let q3 = percentile(&sorted, 0.75);
    let iqr = q3 - q1;
    let lower = q1 - sensitivity * iqr;
    let upper = q3 + sensitivity * iqr;

    let mut rows = dataset.rows.clone();
    for row in &mut rows {
        let score = if let Some(v) = row.get(column_name).and_then(|v| v.as_number()) {
            if v < lower {
                (lower - v) / iqr.abs().max(1e-9)
            } else if v > upper {
                (v - upper) / iqr.abs().max(1e-9)
            } else {
                0.0
            }
        } else {
            0.0
        };
        let flag = score > 0.0;
        row.insert("_anomaly".to_string(), Value::Bool(flag));
        row.insert("_anomalyScore".to_string(), Value::Number(score));
    }

    let mut columns = dataset.columns.clone();
    ensure_column(&mut columns,
        "_anomaly",
        ColumnType::Categorical,
    );
    ensure_column(&mut columns,
        "_anomalyScore",
        ColumnType::Numeric,
    );

    let mut result = dataset.clone_with_rows(rows, "[anomaly:iqr]");
    result.columns = columns;
    result
}

fn percentile(sorted: &[f64], p: f64) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    let idx = p * (sorted.len() - 1) as f64;
    let low = idx.floor() as usize;
    let high = idx.ceil() as usize;
    if low == high {
        sorted[low]
    } else {
        let t = idx - low as f64;
        sorted[low] * (1.0 - t) + sorted[high] * t
    }
}

fn ensure_column(columns: &mut Vec<Column>, name: &str, ty: ColumnType) {
    if !columns.iter().any(|c| c.name == name) {
        columns.push(Column::new(name, ty));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::column::ColumnType;
    use crate::data::dataset::Dataset;
    use crate::data::value::Value;

    fn sample_dataset() -> Dataset {
        let columns = vec![
            Column::new("name", ColumnType::Categorical),
            Column::new("age", ColumnType::Numeric),
        ];
        let rows = vec![
            {
                let mut r = HashMap::new();
                r.insert("name".to_string(), Value::Text("Alice".to_string()));
                r.insert("age".to_string(), Value::Number(30.0));
                r
            },
            {
                let mut r = HashMap::new();
                r.insert("name".to_string(), Value::Text("Bob".to_string()));
                r.insert("age".to_string(), Value::Number(25.0));
                r
            },
        ];
        Dataset::new("sample", columns, rows)
    }

    #[test]
    fn filter_keeps_matching_rows() {
        let ds = sample_dataset();
        let filtered = filter(&ds, |r| {
            r.get("age").and_then(|v| v.as_number()).map(|a| a > 26.0).unwrap_or(false)
        });
        assert_eq!(filtered.row_count(), 1);
    }

    #[test]
    fn sort_orders_by_column() {
        let ds = sample_dataset();
        let sorted = sort(&ds, "age", true);
        let ages: Vec<f64> = sorted
            .get_column_values("age")
            .into_iter()
            .filter_map(|v| v.and_then(|val| val.as_number()))
            .collect();
        assert_eq!(ages, vec![25.0, 30.0]);
    }

    #[test]
    fn aggregate_sums_numeric_columns() {
        let ds = sample_dataset();
        let aggregated = aggregate(&ds, "name", |group| default_sum_aggregator("name", group));
        assert_eq!(aggregated.row_count(), 2);
    }

    #[test]
    fn slice_returns_subrange() {
        let ds = sample_dataset();
        let sliced = slice(&ds, 0, 1);
        assert_eq!(sliced.row_count(), 1);
    }
}
