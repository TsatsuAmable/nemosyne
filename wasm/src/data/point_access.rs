//! RF-007: shared validity-aware, column-oriented point-access substrate.
//!
//! Both TDA (`FeatureSpace`) and the sparse neighbourhood algorithms
//! (`PointCloud`) need to read numeric feature columns out of the resident
//! `ColumnarDataset`. Before this module they each re-implemented the lookup
//! and cloned the primitive buffers, so a large-N dataset paid for the same
//! column copy twice and the two paths drifted in how they treated validity.
//!
//! This module exposes a single borrowed accessor and codifies the
//! columnar primitive invariant that lets the accessor borrow instead of
//! clone.
//!
//! # Columnar primitive invariant (the validity contract)
//!
//! For every `PrimitiveColumn` produced by `ColumnarDataset::from_dataset` or
//! `ColumnarDataset::from_parts`:
//!
//! 1. every stored `values[i]` is finite; and
//! 2. `validity[i] == 0` implies `values[i] == 0.0`.
//!
//! The two constructors enforce this at ingest (non-finite ⇒ `0.0` with
//! `validity = 0`). Because the invariant is constructor-enforced and the
//! struct fields are private, callers of `primitive_column_slice` may borrow
//! the raw `f64` buffer directly and treat `validity[i] == 0` slots as the
//! numeric zero the row-major path already yields via `unwrap_or(0.0)` — no
//! per-element re-normalization, no per-column clone.

use crate::data::column::Column;
use crate::data::columnar::ColumnarDataset;

/// Error raised by the shared point-access substrate. Mirrors the surface of
/// `ColumnarTdaError` / `PointCloudError` so each caller can map to its own
/// typed error without losing the cause.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PointAccessError {
    /// The requested feature column is not present in the dataset schema.
    MissingColumn(String),
    /// The requested feature column is categorical/dictionary-encoded; TDA and
    /// sparse neighbourhood require numeric or temporal primitives.
    UnsupportedColumnKind(String),
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
        }
    }
}

impl std::error::Error for PointAccessError {}

/// Borrow the raw `f64` buffer of a named numeric feature column directly from
/// the resident `ColumnarDataset`, with no clone and no row-map traversal.
///
/// Returns `UnsupportedColumnKind` for categorical/dictionary columns and
/// `MissingColumn` when the name is absent. The returned slice obeys the
/// columnar primitive invariant (see the module docs): invalid slots are
/// already numeric zero, so callers may consume the buffer verbatim.
pub fn primitive_column_slice<'a>(
    columns: &[Column],
    columnar: &'a ColumnarDataset,
    name: &str,
) -> Result<&'a [f64], PointAccessError> {
    let index = columns
        .iter()
        .position(|c| c.name == name)
        .ok_or_else(|| PointAccessError::MissingColumn(name.to_string()))?;
    match columnar.primitive_column(index) {
        Some(primitive) => Ok(primitive.values.as_slice()),
        None => Err(PointAccessError::UnsupportedColumnKind(name.to_string())),
    }
}

/// Collect the raw borrowed `f64` buffers for an ordered list of feature
/// columns. The outer `Vec` holds one borrowed slice per feature dimension;
/// the row-major transpose (`points[i]`) is left to the caller so that
/// algorithm bodies stay byte-identical.
///
/// This is the single shared substrate both `FeatureSpace::from_columnar` and
/// `PointCloud::from_columnar` consume: one lookup, one invariant, no
/// duplicate per-column clones.
pub fn borrowed_feature_columns<'a>(
    columns: &[Column],
    columnar: &'a ColumnarDataset,
    feature_columns: &[&str],
) -> Result<Vec<&'a [f64]>, PointAccessError> {
    let mut out = Vec::with_capacity(feature_columns.len());
    for name in feature_columns {
        out.push(primitive_column_slice(columns, columnar, name)?);
    }
    Ok(out)
}

/// Collect owned `Vec<f64>` copies of the feature columns, for callers (such
/// as `PointCloud`) that must own their column-major storage. The values are
/// borrowed from the resident `ColumnarDataset` and then cloned once into the
/// caller's buffer — there is no second intermediate clone and no per-element
/// re-normalization, because the columnar primitive invariant already
/// guarantees `validity 0 ⇒ 0.0` and all-finite values.
pub fn owned_feature_columns(
    columns: &[Column],
    columnar: &ColumnarDataset,
    feature_columns: &[&str],
) -> Result<Vec<Vec<f64>>, PointAccessError> {
    let borrowed = borrowed_feature_columns(columns, columnar, feature_columns)?;
    Ok(borrowed.into_iter().map(|slice| slice.to_vec()).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::column::{Column, ColumnType};
    use crate::data::columnar::ColumnarDataset;
    use crate::data::dataset::Dataset;
    use crate::data::value::Value;

    fn dataset_with_missing() -> Dataset {
        // rows: a = [1.0, missing, 3.0]; b = [10.0, 20.0, NaN-as-string? no: numeric]
        let mut rows = Vec::new();
        let mut r0 = std::collections::HashMap::new();
        r0.insert("a".to_string(), Value::Number(1.0));
        r0.insert("b".to_string(), Value::Number(10.0));
        rows.push(r0);
        let mut r1 = std::collections::HashMap::new();
        r1.insert("a".to_string(), Value::Null);
        r1.insert("b".to_string(), Value::Number(20.0));
        rows.push(r1);
        let mut r2 = std::collections::HashMap::new();
        r2.insert("a".to_string(), Value::Number(3.0));
        r2.insert("b".to_string(), Value::Number(30.0));
        rows.push(r2);
        Dataset::new(
            "ds",
            vec![
                Column::new("a".to_string(), ColumnType::Numeric),
                Column::new("b".to_string(), ColumnType::Numeric),
            ],
            rows,
        )
    }

    /// The columnar primitive invariant: validity 0 ⇒ values 0.0, all finite.
    #[test]
    fn columnar_primitive_invariant_holds_after_ingest() {
        let ds = dataset_with_missing();
        let columnar = ColumnarDataset::from_dataset(&ds);
        assert_eq!(columnar.primitive_column_count(), 2);
        let a = columnar.primitive_column(0).unwrap();
        assert_eq!(a.values.len(), 3);
        // Row 1 was missing ⇒ validity 0 and value 0.0.
        assert_eq!(a.validity, vec![1, 0, 1]);
        assert_eq!(a.values[1], 0.0);
        // All stored values are finite (the invariant).
        assert!(a.values.iter().all(|v| v.is_finite()));
        // validity 0 ⇒ values 0.0 across every primitive column.
        for i in 0..columnar.primitive_column_count() {
            let col = columnar.primitive_column(i).unwrap();
            for (v, valid) in col.values.iter().zip(col.validity.iter()) {
                if *valid == 0 {
                    assert_eq!(*v, 0.0);
                }
            }
        }
    }

    /// The shared accessor borrows the buffer with no clone and sees the
    /// normalized zero for invalid slots.
    #[test]
    fn primitive_column_slice_borrows_and_sees_normalized_zero() {
        let ds = dataset_with_missing();
        let columnar = ColumnarDataset::from_dataset(&ds);
        let columns = vec![
            Column::new("a".to_string(), ColumnType::Numeric),
            Column::new("b".to_string(), ColumnType::Numeric),
        ];
        let slice = primitive_column_slice(&columns, &columnar, "a").unwrap();
        assert_eq!(slice, &[1.0, 0.0, 3.0]);
    }

    #[test]
    fn missing_column_maps_to_typed_error() {
        let ds = dataset_with_missing();
        let columnar = ColumnarDataset::from_dataset(&ds);
        let columns = vec![Column::new("a".to_string(), ColumnType::Numeric)];
        let err = primitive_column_slice(&columns, &columnar, "nope").unwrap_err();
        assert_eq!(err, PointAccessError::MissingColumn("nope".to_string()));
    }

    #[test]
    fn categorical_column_is_unsupported() {
        // A dataset whose only column is categorical must surface
        // UnsupportedColumnKind (categoricals are stored as dictionary codes,
        // not primitive f64 buffers).
        let rows = vec![std::collections::HashMap::from([
            ("cat".to_string(), Value::Text("a".to_string())),
        ])];
        let ds = Dataset::new(
            "ds",
            vec![Column::new("cat".to_string(), ColumnType::Categorical)],
            rows,
        );
        let columnar = ColumnarDataset::from_dataset(&ds);
        let columns = vec![Column::new("cat".to_string(), ColumnType::Categorical)];
        let err = primitive_column_slice(&columns, &columnar, "cat").unwrap_err();
        assert_eq!(err, PointAccessError::UnsupportedColumnKind("cat".to_string()));
    }
}