use std::collections::HashMap;

use crate::data::column::ColumnType;
use crate::data::dataset::Dataset;
use crate::data::value::Value;

/// Contiguous primitive column retained beside the compatibility row store.
///
/// Values and validity are split so missing/non-finite cells do not require
/// sentinel floating-point values. Numeric and temporal columns deliberately
/// preserve the existing `Value::as_number()` coercion semantics during the
/// migration; changing analytical semantics belongs in a separate change.
#[derive(Debug, Clone, PartialEq)]
pub struct PrimitiveColumn {
    pub values: Vec<f64>,
    pub validity: Vec<u8>,
}

impl PrimitiveColumn {
    pub fn finite_values(&self) -> impl Iterator<Item = f64> + '_ {
        self.values
            .iter()
            .copied()
            .zip(self.validity.iter().copied())
            .filter_map(|(value, valid)| (valid != 0).then_some(value))
    }
}

/// Dictionary-backed categorical column.
///
/// Row positions store compact dictionary codes plus validity. The dictionary
/// preserves the existing `Value::to_key_string()` category identity contract,
/// so statistics can migrate away from repeated row-map/string traversal without
/// changing cardinality, entropy or top-category semantics.
#[derive(Debug, Clone, PartialEq)]
pub struct CategoricalColumn {
    pub dictionary: Vec<String>,
    pub codes: Vec<u32>,
    pub validity: Vec<u8>,
}

impl CategoricalColumn {
    pub fn valid_codes(&self) -> impl Iterator<Item = u32> + '_ {
        self.codes
            .iter()
            .copied()
            .zip(self.validity.iter().copied())
            .filter_map(|(code, valid)| (valid != 0).then_some(code))
    }
}

/// Transitional columnar representation for dataset-size-dependent hot paths.
///
/// The row-major `Dataset` remains available for compatibility while this
/// sidecar proves parity and performance. It is built once when a dataset handle
/// is registered and rebuilt after mutable dataset operations. Primitive WASM
/// views and categorical statistics consume this representation instead of
/// rescanning row HashMaps.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct ColumnarDataset {
    row_count: usize,
    primitive_columns: HashMap<usize, PrimitiveColumn>,
    categorical_columns: HashMap<usize, CategoricalColumn>,
}

impl ColumnarDataset {
    pub fn from_dataset(dataset: &Dataset) -> Self {
        let mut primitive_columns = HashMap::new();
        let mut categorical_columns = HashMap::new();

        for (column_index, column) in dataset.columns.iter().enumerate() {
            match column.ty {
                ColumnType::Numeric | ColumnType::Temporal => {
                    let mut values = Vec::with_capacity(dataset.rows.len());
                    let mut validity = Vec::with_capacity(dataset.rows.len());
                    for row in &dataset.rows {
                        match row.get(&column.name).and_then(|value| value.as_number()) {
                            Some(value) if value.is_finite() => {
                                values.push(value);
                                validity.push(1);
                            }
                            _ => {
                                values.push(0.0);
                                validity.push(0);
                            }
                        }
                    }
                    primitive_columns.insert(column_index, PrimitiveColumn { values, validity });
                }
                ColumnType::Categorical => {
                    let mut dictionary = Vec::new();
                    let mut dictionary_index: HashMap<String, u32> = HashMap::new();
                    let mut codes = Vec::with_capacity(dataset.rows.len());
                    let mut validity = Vec::with_capacity(dataset.rows.len());

                    for row in &dataset.rows {
                        let key = match row.get(&column.name) {
                            Some(Value::Null) | None => {
                                codes.push(0);
                                validity.push(0);
                                continue;
                            }
                            Some(value) => value.to_key_string(),
                        };

                        let code = if let Some(code) = dictionary_index.get(&key) {
                            *code
                        } else {
                            let code = dictionary.len() as u32;
                            dictionary.push(key.clone());
                            dictionary_index.insert(key, code);
                            code
                        };
                        codes.push(code);
                        validity.push(1);
                    }

                    categorical_columns.insert(
                        column_index,
                        CategoricalColumn {
                            dictionary,
                            codes,
                            validity,
                        },
                    );
                }
                _ => {}
            }
        }

        Self {
            row_count: dataset.rows.len(),
            primitive_columns,
            categorical_columns,
        }
    }

    pub fn row_count(&self) -> usize {
        self.row_count
    }

    pub fn primitive_column(&self, column_index: usize) -> Option<&PrimitiveColumn> {
        self.primitive_columns.get(&column_index)
    }

    pub fn primitive_column_count(&self) -> usize {
        self.primitive_columns.len()
    }

    pub fn categorical_column(&self, column_index: usize) -> Option<&CategoricalColumn> {
        self.categorical_columns.get(&column_index)
    }

    pub fn categorical_column_count(&self) -> usize {
        self.categorical_columns.len()
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::data::column::{Column, ColumnType};
    use crate::data::dataset::Dataset;
    use crate::data::value::Value;

    use super::ColumnarDataset;

    #[test]
    fn numeric_temporal_and_categorical_columns_are_materialized_columnarly() {
        let dataset = Dataset::new(
            "columnar",
            vec![
                Column::new("value", ColumnType::Numeric),
                Column::new("time", ColumnType::Temporal),
                Column::new("label", ColumnType::Categorical),
            ],
            vec![
                HashMap::from([
                    ("value".to_string(), Value::Number(1.5)),
                    ("time".to_string(), Value::Number(10.0)),
                    ("label".to_string(), Value::Text("a".to_string())),
                ]),
                HashMap::from([
                    ("value".to_string(), Value::Null),
                    ("time".to_string(), Value::Text("20".to_string())),
                    ("label".to_string(), Value::Text("b".to_string())),
                ]),
                HashMap::from([
                    ("value".to_string(), Value::Number(3.0)),
                    ("time".to_string(), Value::Number(30.0)),
                    ("label".to_string(), Value::Text("a".to_string())),
                ]),
            ],
        );

        let columnar = ColumnarDataset::from_dataset(&dataset);
        assert_eq!(columnar.row_count(), 3);
        assert_eq!(columnar.primitive_column_count(), 2);
        assert_eq!(columnar.categorical_column_count(), 1);

        let numeric = columnar.primitive_column(0).expect("numeric column");
        assert_eq!(numeric.values, vec![1.5, 0.0, 3.0]);
        assert_eq!(numeric.validity, vec![1, 0, 1]);

        let temporal = columnar.primitive_column(1).expect("temporal column");
        assert_eq!(temporal.values, vec![10.0, 20.0, 30.0]);
        assert_eq!(temporal.validity, vec![1, 1, 1]);

        let categorical = columnar.categorical_column(2).expect("categorical column");
        assert_eq!(categorical.dictionary, vec!["a".to_string(), "b".to_string()]);
        assert_eq!(categorical.codes, vec![0, 1, 0]);
        assert_eq!(categorical.validity, vec![1, 1, 1]);
    }

    #[test]
    fn categorical_dictionary_preserves_missingness_without_sentinel_category() {
        let dataset = Dataset::new(
            "categorical-missing",
            vec![Column::new("label", ColumnType::Categorical)],
            vec![
                HashMap::from([("label".to_string(), Value::Text("a".to_string()))]),
                HashMap::from([("label".to_string(), Value::Null)]),
                HashMap::new(),
                HashMap::from([("label".to_string(), Value::Text("a".to_string()))]),
            ],
        );
        let columnar = ColumnarDataset::from_dataset(&dataset);
        let categorical = columnar.categorical_column(0).expect("categorical column");
        assert_eq!(categorical.dictionary, vec!["a".to_string()]);
        assert_eq!(categorical.validity, vec![1, 0, 0, 1]);
        assert_eq!(categorical.valid_codes().collect::<Vec<_>>(), vec![0, 0]);
    }

    #[test]
    fn finite_value_iteration_respects_validity() {
        let dataset = Dataset::new(
            "finite",
            vec![Column::new("value", ColumnType::Numeric)],
            vec![
                HashMap::from([("value".to_string(), Value::Number(1.0))]),
                HashMap::from([("value".to_string(), Value::Null)]),
                HashMap::from([("value".to_string(), Value::Number(3.0))]),
            ],
        );
        let columnar = ColumnarDataset::from_dataset(&dataset);
        let values: Vec<f64> = columnar
            .primitive_column(0)
            .expect("numeric column")
            .finite_values()
            .collect();
        assert_eq!(values, vec![1.0, 3.0]);
    }
}
