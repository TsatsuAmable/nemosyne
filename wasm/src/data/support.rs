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
}
