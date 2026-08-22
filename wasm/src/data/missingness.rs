use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::data::dataset::Dataset;
use crate::data::evidence::{ExclusionReasonCount, SampleSupport, SupportPolicy};
use crate::data::value::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MissingnessMechanism {
    Unknown,
    McAr,
    Mar,
    MnAr,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MissingnessMechanismSource {
    Unknown,
    Declared,
    ModelBased,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingnessMechanismAssessment {
    pub mechanism: MissingnessMechanism,
    pub source: MissingnessMechanismSource,
    pub rationale: String,
}

impl MissingnessMechanismAssessment {
    pub fn unknown() -> Self {
        Self {
            mechanism: MissingnessMechanism::Unknown,
            source: MissingnessMechanismSource::Unknown,
            rationale: "missingness mechanism cannot be identified from missing-value counts alone"
                .to_string(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnMissingnessEvidence {
    pub column: String,
    pub total_rows: usize,
    pub observed_rows: usize,
    pub missing_rows: usize,
    pub missing_fraction: f64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingnessPattern {
    pub missing_columns: Vec<String>,
    pub row_count: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingnessEvidence {
    pub total_rows: usize,
    pub total_cells: usize,
    pub total_missing_cells: usize,
    pub missing_fraction: f64,
    pub columns: Vec<ColumnMissingnessEvidence>,
    pub patterns: Vec<MissingnessPattern>,
    pub mechanism: MissingnessMechanismAssessment,
}

fn is_missing(row: &std::collections::HashMap<String, Value>, column: &str) -> bool {
    matches!(row.get(column), None | Some(Value::Null))
}

pub fn complete_case_support(dataset: &Dataset, columns: &[String]) -> SampleSupport {
    let rows_used = dataset
        .rows
        .iter()
        .filter(|row| columns.iter().all(|column| !is_missing(row, column)))
        .count();
    let rows_excluded = dataset.row_count().saturating_sub(rows_used);
    let reasons = if rows_excluded == 0 {
        Vec::new()
    } else {
        vec![ExclusionReasonCount {
            reason: "missing one or more requested columns".to_string(),
            row_count: rows_excluded,
        }]
    };

    SampleSupport::new(
        dataset.row_count(),
        rows_used,
        columns.to_vec(),
        SupportPolicy::CompleteCase,
        reasons,
    )
    .expect("complete-case support is derived from dataset row counts")
}

pub fn compute_missingness_evidence(dataset: &Dataset) -> MissingnessEvidence {
    let total_rows = dataset.row_count();
    let total_cells = total_rows.saturating_mul(dataset.column_count());
    let mut total_missing_cells = 0usize;
    let mut columns = Vec::with_capacity(dataset.column_count());
    let mut pattern_counts: BTreeMap<Vec<String>, usize> = BTreeMap::new();

    for column in &dataset.columns {
        let missing_rows = dataset
            .rows
            .iter()
            .filter(|row| is_missing(row, &column.name))
            .count();
        total_missing_cells += missing_rows;
        let observed_rows = total_rows.saturating_sub(missing_rows);
        let missing_fraction = if total_rows == 0 {
            0.0
        } else {
            missing_rows as f64 / total_rows as f64
        };
        columns.push(ColumnMissingnessEvidence {
            column: column.name.clone(),
            total_rows,
            observed_rows,
            missing_rows,
            missing_fraction,
        });
    }

    for row in &dataset.rows {
        let mut missing_columns: Vec<String> = dataset
            .columns
            .iter()
            .filter(|column| is_missing(row, &column.name))
            .map(|column| column.name.clone())
            .collect();
        missing_columns.sort();
        *pattern_counts.entry(missing_columns).or_insert(0) += 1;
    }

    let patterns = pattern_counts
        .into_iter()
        .map(|(missing_columns, row_count)| MissingnessPattern {
            missing_columns,
            row_count,
        })
        .collect();

    let missing_fraction = if total_cells == 0 {
        0.0
    } else {
        total_missing_cells as f64 / total_cells as f64
    };

    MissingnessEvidence {
        total_rows,
        total_cells,
        total_missing_cells,
        missing_fraction,
        columns,
        patterns,
        mechanism: MissingnessMechanismAssessment::unknown(),
    }
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

    fn fixture() -> Dataset {
        Dataset::new(
            "fixture",
            vec![
                Column::new("x", ColumnType::Numeric),
                Column::new("group", ColumnType::Categorical),
            ],
            vec![
                row(&[("x", Value::Number(1.0)), ("group", Value::String("a".into()))]),
                row(&[("x", Value::Null), ("group", Value::String("a".into()))]),
                row(&[("x", Value::Number(3.0)), ("group", Value::Null)]),
            ],
        )
    }

    #[test]
    fn counts_missing_cells_and_patterns_without_inferring_mechanism() {
        let evidence = compute_missingness_evidence(&fixture());
        assert_eq!(evidence.total_missing_cells, 2);
        assert_eq!(evidence.mechanism.mechanism, MissingnessMechanism::Unknown);
        assert_eq!(evidence.mechanism.source, MissingnessMechanismSource::Unknown);
        assert_eq!(evidence.columns[0].observed_rows, 2);
        assert_eq!(evidence.patterns.iter().map(|p| p.row_count).sum::<usize>(), 3);
    }

    #[test]
    fn complete_case_support_is_scoped_to_requested_columns() {
        let dataset = fixture();
        let x_only = complete_case_support(&dataset, &["x".to_string()]);
        let both = complete_case_support(&dataset, &["x".to_string(), "group".to_string()]);

        assert_eq!(x_only.rows_used, 2);
        assert_eq!(x_only.rows_excluded, 1);
        assert_eq!(both.rows_used, 1);
        assert_eq!(both.rows_excluded, 2);
        assert_eq!(both.policy, SupportPolicy::CompleteCase);
    }

    #[test]
    fn empty_dataset_has_zero_fraction_not_nan() {
        let dataset = Dataset::new(
            "empty",
            vec![Column::new("x", ColumnType::Numeric)],
            vec![],
        );
        let evidence = compute_missingness_evidence(&dataset);
        assert_eq!(evidence.missing_fraction, 0.0);
        assert_eq!(evidence.total_missing_cells, 0);
    }
}
