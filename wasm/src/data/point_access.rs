//! RF-007: shared validity-aware, column-oriented point-access substrate.
//!
//! TDA and sparse-neighbourhood algorithms must agree on both numeric values
//! and whether those values are observations at all. A stored `0.0` in an
//! invalid primitive slot is an ingest sentinel, not a scientific coordinate.
//!
//! # Columnar primitive invariant
//!
//! `ColumnarDataset` constructors guarantee that primitive buffers have one
//! value and one validity byte per source row, all stored values are finite,
//! and `validity[i] == 0` implies `values[i] == 0.0`. Consumers MUST still
//! inspect validity before admitting a row into a metric space.
//!
//! For metric/TDA feature tuples Nemosyne uses complete-case eligibility: a
//! source row participates only when every selected feature is valid. This
//! preserves a single, well-defined Euclidean metric. Imputation remains an
//! explicit analytical transformation rather than an invisible distance rule.

use crate::data::column::Column;
use crate::data::columnar::ColumnarDataset;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PointAccessError {
    MissingColumn(String),
    UnsupportedColumnKind(String),
    InvalidColumnLength(String),
}

impl std::fmt::Display for PointAccessError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::MissingColumn(name) => {
                write!(f, "feature column {name:?} not found in dataset schema")
            }
            Self::UnsupportedColumnKind(name) => write!(
                f,
                "feature column {name:?} is categorical/non-numeric; point access requires numeric or temporal columns"
            ),
            Self::InvalidColumnLength(name) => write!(
                f,
                "feature column {name:?} has inconsistent value/validity length"
            ),
        }
    }
}

impl std::error::Error for PointAccessError {}

/// Borrowed primitive feature buffer with its validity bitmap.
#[derive(Debug, Clone, Copy)]
pub struct PrimitivePointColumn<'a> {
    pub values: &'a [f64],
    pub validity: &'a [u8],
}

impl PrimitivePointColumn<'_> {
    #[inline]
    pub fn is_valid(&self, row: usize) -> bool {
        self.validity.get(row).copied().unwrap_or(0) != 0
    }
}

/// Borrow a named numeric/temporal primitive together with its validity bitmap.
pub fn primitive_column_view<'a>(
    columns: &[Column],
    columnar: &'a ColumnarDataset,
    name: &str,
) -> Result<PrimitivePointColumn<'a>, PointAccessError> {
    let index = columns
        .iter()
        .position(|c| c.name == name)
        .ok_or_else(|| PointAccessError::MissingColumn(name.to_string()))?;
    let primitive = columnar
        .primitive_column(index)
        .ok_or_else(|| PointAccessError::UnsupportedColumnKind(name.to_string()))?;
    if primitive.values.len() != columnar.row_count()
        || primitive.validity.len() != columnar.row_count()
    {
        return Err(PointAccessError::InvalidColumnLength(name.to_string()));
    }
    Ok(PrimitivePointColumn {
        values: primitive.values.as_slice(),
        validity: primitive.validity.as_slice(),
    })
}

/// Compatibility value-only accessor. Analytical metric consumers should use
/// `primitive_column_view`/`borrowed_feature_columns` and honor validity.
pub fn primitive_column_slice<'a>(
    columns: &[Column],
    columnar: &'a ColumnarDataset,
    name: &str,
) -> Result<&'a [f64], PointAccessError> {
    Ok(primitive_column_view(columns, columnar, name)?.values)
}

/// Borrow ordered primitive feature buffers and their validity bitmaps.
pub fn borrowed_feature_columns<'a>(
    columns: &[Column],
    columnar: &'a ColumnarDataset,
    feature_columns: &[&str],
) -> Result<Vec<PrimitivePointColumn<'a>>, PointAccessError> {
    feature_columns
        .iter()
        .map(|name| primitive_column_view(columns, columnar, name))
        .collect()
}

/// Return source-row indices that are valid for every selected feature.
///
/// With no selected features every source row is eligible, preserving the
/// historical empty-feature contract for callers that handle it explicitly.
pub fn complete_case_row_indices(
    feature_columns: &[PrimitivePointColumn<'_>],
    row_count: usize,
) -> Vec<usize> {
    (0..row_count)
        .filter(|&row| feature_columns.iter().all(|column| column.is_valid(row)))
        .collect()
}

/// Owned value copies retained for non-metric compatibility callers. This does
/// not encode row eligibility; metric consumers must use the borrowed views.
pub fn owned_feature_columns(
    columns: &[Column],
    columnar: &ColumnarDataset,
    feature_columns: &[&str],
) -> Result<Vec<Vec<f64>>, PointAccessError> {
    let borrowed = borrowed_feature_columns(columns, columnar, feature_columns)?;
    Ok(borrowed
        .into_iter()
        .map(|column| column.values.to_vec())
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::column::{Column, ColumnType};
    use crate::data::columnar::ColumnarDataset;
    use crate::data::dataset::Dataset;
    use crate::data::value::Value;

    fn dataset_with_missing() -> Dataset {
        let rows = vec![
            std::collections::HashMap::from([
                ("a".to_string(), Value::Number(0.0)),
                ("b".to_string(), Value::Number(10.0)),
            ]),
            std::collections::HashMap::from([
                ("a".to_string(), Value::Null),
                ("b".to_string(), Value::Number(20.0)),
            ]),
            std::collections::HashMap::from([
                ("a".to_string(), Value::Number(3.0)),
                ("b".to_string(), Value::Number(30.0)),
            ]),
        ];
        Dataset::new(
            "ds",
            vec![
                Column::new("a".to_string(), ColumnType::Numeric),
                Column::new("b".to_string(), ColumnType::Numeric),
            ],
            rows,
        )
    }

    #[test]
    fn columnar_primitive_invariant_holds_after_ingest() {
        let ds = dataset_with_missing();
        let columnar = ColumnarDataset::from_dataset(&ds);
        let a = columnar.primitive_column(0).unwrap();
        assert_eq!(a.validity, vec![1, 0, 1]);
        assert_eq!(a.values, vec![0.0, 0.0, 3.0]);
        assert!(a.values.iter().all(|v| v.is_finite()));
        for i in 0..columnar.primitive_column_count() {
            let col = columnar.primitive_column(i).unwrap();
            for (value, valid) in col.values.iter().zip(&col.validity) {
                if *valid == 0 {
                    assert_eq!(*value, 0.0);
                }
            }
        }
    }

    #[test]
    fn primitive_view_preserves_validity_distinct_from_real_zero() {
        let ds = dataset_with_missing();
        let columnar = ColumnarDataset::from_dataset(&ds);
        let view = primitive_column_view(&ds.columns, &columnar, "a").unwrap();
        assert_eq!(view.values, &[0.0, 0.0, 3.0]);
        assert_eq!(view.validity, &[1, 0, 1]);
        assert!(view.is_valid(0), "real numeric zero is a valid observation");
        assert!(!view.is_valid(1), "missing sentinel zero is not an observation");
    }

    #[test]
    fn complete_case_excludes_missing_but_keeps_real_zero() {
        let ds = dataset_with_missing();
        let columnar = ColumnarDataset::from_dataset(&ds);
        let views = borrowed_feature_columns(&ds.columns, &columnar, &["a", "b"]).unwrap();
        assert_eq!(complete_case_row_indices(&views, columnar.row_count()), vec![0, 2]);
    }

    #[test]
    fn missing_column_maps_to_typed_error() {
        let ds = dataset_with_missing();
        let columnar = ColumnarDataset::from_dataset(&ds);
        let err = primitive_column_view(&ds.columns, &columnar, "nope").unwrap_err();
        assert_eq!(err, PointAccessError::MissingColumn("nope".to_string()));
    }

    #[test]
    fn categorical_column_is_unsupported() {
        let rows = vec![std::collections::HashMap::from([(
            "cat".to_string(),
            Value::Text("a".to_string()),
        )])];
        let ds = Dataset::new(
            "ds",
            vec![Column::new("cat".to_string(), ColumnType::Categorical)],
            rows,
        );
        let columnar = ColumnarDataset::from_dataset(&ds);
        let err = primitive_column_view(&ds.columns, &columnar, "cat").unwrap_err();
        assert_eq!(
            err,
            PointAccessError::UnsupportedColumnKind("cat".to_string())
        );
    }
}