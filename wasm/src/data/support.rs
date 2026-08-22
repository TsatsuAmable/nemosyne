use crate::data::dataset::Dataset;
use crate::data::evidence::{ExclusionReasonCount, SampleSupport, SupportPolicy};
use crate::data::value::Value;

fn is_missing(row: &std::collections::HashMap<String, Value>, column: &str) -> bool {
    matches!(row.get(column), None | Some(Value::Null))
}

/// Exact row support for analyses that require all requested columns to be
/// finite numeric values. Rows are counted once, with missingness taking
/// precedence over invalid/non-finite numeric content when both occur.
pub fn finite_numeric_support(dataset: &Dataset, columns: &[String]) -> SampleSupport {
    let mut rows_used = 0usize;
    let mut missing_rows = 0usize;
    let mut invalid_numeric_rows = 0usize;

    for row in &dataset.rows {
        if columns.iter().any(|column| is_missing(row, column)) {
            missing_rows += 1;
            continue;
        }

        let all_finite_numeric = columns.iter().all(|column| {
            row.get(column)
                .and_then(|value| value.as_number())
                .is_some_and(f64::is_finite)
        });

        if all_finite_numeric {
            rows_used += 1;
        } else {
            invalid_numeric_rows += 1;
        }
    }

    let mut reasons = Vec::new();
    if missing_rows > 0 {
        reasons.push(ExclusionReasonCount {
            reason: "missing one or more requested numeric columns".to_string(),
            row_count: missing_rows,
        });
    }
    if invalid_numeric_rows > 0 {
        reasons.push(ExclusionReasonCount {
            reason: "non-numeric or non-finite value in requested numeric columns".to_string(),
            row_count: invalid_numeric_rows,
        });
    }

    SampleSupport::new(
        dataset.row_count(),
        rows_used,
        columns.to_vec(),
        SupportPolicy::CompleteCase,
        reasons,
    )
    .expect("numeric support is derived from a partition of dataset rows")
}

/// Exact row support for categorical summaries, which consume every non-null
/// value in the requested categorical column and perform no further filtering.
pub fn observed_value_support(dataset: &Dataset, column: &str) -> SampleSupport {
    let rows_used = dataset
        .rows
        .iter()
        .filter(|row| !is_missing(row, column))
        .count();
    let rows_excluded = dataset.row_count().saturating_sub(rows_used);
    let reasons = if rows_excluded == 0 {
        Vec::new()
    } else {
        vec![ExclusionReasonCount {
            reason: "missing categorical value".to_string(),
            row_count: rows_excluded,
        }]
    };

    SampleSupport::new(
        dataset.row_count(),
        rows_used,
        vec![column.to_string()],
        SupportPolicy::CompleteCase,
        reasons,
    )
    .expect("categorical support is derived from dataset rows")
}

/// Exact support for the current legacy temporal heuristic. The implementation
/// requires a present temporal key and a finite numeric value. A present
/// `Value::Null` temporal key is still consumed by the legacy ordering path;
/// this function mirrors that behaviour rather than silently tightening it.
pub fn legacy_temporal_support(
    dataset: &Dataset,
    time_column: &str,
    value_column: &str,
) -> SampleSupport {
    let mut rows_used = 0usize;
    let mut missing_time_key = 0usize;
    let mut missing_value = 0usize;
    let mut invalid_value = 0usize;

    for row in &dataset.rows {
        if row.get(time_column).is_none() {
            missing_time_key += 1;
            continue;
        }
        match row.get(value_column) {
            None | Some(Value::Null) => missing_value += 1,
            Some(value) => match value.as_number() {
                Some(number) if number.is_finite() => rows_used += 1,
                _ => invalid_value += 1,
            },
        }
    }

    let mut reasons = Vec::new();
    if missing_time_key > 0 {
        reasons.push(ExclusionReasonCount {
            reason: "temporal key absent".to_string(),
            row_count: missing_time_key,
        });
    }
    if missing_value > 0 {
        reasons.push(ExclusionReasonCount {
            reason: "numeric value missing".to_string(),
            row_count: missing_value,
        });
    }
    if invalid_value > 0 {
        reasons.push(ExclusionReasonCount {
            reason: "numeric value non-numeric or non-finite".to_string(),
            row_count: invalid_value,
        });
    }

    SampleSupport::new(
        dataset.row_count(),
        rows_used,
        vec![time_column.to_string(), value_column.to_string()],
        SupportPolicy::CompleteCase,
        reasons,
    )
    .expect("temporal support is derived from a partition of dataset rows")
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::data::column::{Column, ColumnType};

    use super::*;

    fn row(values: &[(&str, Value)]) -> HashMap<String, Value> {
        values
            .iter()
            .map(|(key, value)| ((*key).to_string(), value.clone()))
            .collect()
    }

    #[test]
    fn finite_numeric_support_matches_analyzer_row_eligibility() {
        let dataset = Dataset::new(
            "support-fixture",
            vec![
                Column::new("x", ColumnType::Numeric),
                Column::new("y", ColumnType::Numeric),
            ],
            vec![
                row(&[("x", Value::Number(1.0)), ("y", Value::Number(2.0))]),
                row(&[("x", Value::Null), ("y", Value::Number(3.0))]),
                row(&[("x", Value::Text("not-a-number".into())), ("y", Value::Number(4.0))]),
                row(&[("x", Value::Number(5.0)), ("y", Value::Number(f64::INFINITY))]),
            ],
        );

        let support = finite_numeric_support(&dataset, &["x".into(), "y".into()]);
        assert_eq!(support.rows_used, 1);
        assert_eq!(support.rows_excluded, 3);
        assert_eq!(support.exclusion_reasons.len(), 2);
        assert_eq!(support.exclusion_reasons[0].row_count, 1);
        assert_eq!(support.exclusion_reasons[1].row_count, 2);
    }

    #[test]
    fn observed_value_support_matches_categorical_analyzer() {
        let dataset = Dataset::new(
            "categorical-support",
            vec![Column::new("group", ColumnType::Categorical)],
            vec![
                row(&[("group", Value::Text("a".into()))]),
                row(&[("group", Value::Null)]),
                HashMap::new(),
            ],
        );
        let support = observed_value_support(&dataset, "group");
        assert_eq!(support.rows_used, 1);
        assert_eq!(support.rows_excluded, 2);
    }

    #[test]
    fn legacy_temporal_support_mirrors_current_row_eligibility() {
        let dataset = Dataset::new(
            "temporal-support",
            vec![
                Column::new("t", ColumnType::Temporal),
                Column::new("x", ColumnType::Numeric),
            ],
            vec![
                row(&[("t", Value::Text("2026-01-01".into())), ("x", Value::Number(1.0))]),
                row(&[("t", Value::Null), ("x", Value::Number(2.0))]),
                row(&[("x", Value::Number(3.0))]),
                row(&[("t", Value::Text("2026-01-04".into())), ("x", Value::Null)]),
            ],
        );
        let support = legacy_temporal_support(&dataset, "t", "x");
        assert_eq!(support.rows_used, 2);
        assert_eq!(support.rows_excluded, 2);
    }
}
