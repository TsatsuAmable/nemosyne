use std::collections::HashMap;

use crate::data::column::ColumnType;
use crate::data::dataset::Dataset;
use crate::data::value::Value;

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

    /// Construct resident columnar storage directly from typed buffers.
    /// This is the seam used by the bulk data-plane experiment: callers must
    /// provide buffers with one entry per row, and categorical codes must refer
    /// to the supplied dictionary whenever the validity byte is non-zero.
    pub fn from_parts(
        row_count: usize,
        primitive_columns: HashMap<usize, PrimitiveColumn>,
        categorical_columns: HashMap<usize, CategoricalColumn>,
    ) -> Result<Self, String> {
        for (index, column) in &primitive_columns {
            if column.values.len() != row_count || column.validity.len() != row_count {
                return Err(format!("primitive column {index} length does not match row count"));
            }
        }
        for (index, column) in &categorical_columns {
            if column.codes.len() != row_count || column.validity.len() != row_count {
                return Err(format!("categorical column {index} length does not match row count"));
            }
            for (code, valid) in column.codes.iter().zip(&column.validity) {
                if *valid != 0 && (*code as usize) >= column.dictionary.len() {
                    return Err(format!("categorical column {index} contains out-of-range code"));
                }
            }
        }
        Ok(Self { row_count, primitive_columns, categorical_columns })
    }

    pub fn row_count(&self) -> usize { self.row_count }
    pub fn primitive_column(&self, column_index: usize) -> Option<&PrimitiveColumn> { self.primitive_columns.get(&column_index) }
    pub fn primitive_column_count(&self) -> usize { self.primitive_columns.len() }
    pub fn categorical_column(&self, column_index: usize) -> Option<&CategoricalColumn> { self.categorical_columns.get(&column_index) }
    pub fn categorical_column_count(&self) -> usize { self.categorical_columns.len() }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use crate::data::column::{Column, ColumnType};
    use crate::data::dataset::Dataset;
    use crate::data::value::Value;
    use super::{CategoricalColumn, ColumnarDataset, PrimitiveColumn};

    #[test]
    fn numeric_temporal_and_categorical_columns_are_materialized_columnarly() {
        let dataset = Dataset::new(
            "columnar",
            vec![Column::new("value", ColumnType::Numeric), Column::new("time", ColumnType::Temporal), Column::new("label", ColumnType::Categorical)],
            vec![
                HashMap::from([("value".to_string(), Value::Number(1.5)), ("time".to_string(), Value::Number(10.0)), ("label".to_string(), Value::Text("a".to_string()))]),
                HashMap::from([("value".to_string(), Value::Null), ("time".to_string(), Value::Text("20".to_string())), ("label".to_string(), Value::Text("b".to_string()))]),
                HashMap::from([("value".to_string(), Value::Number(3.0)), ("time".to_string(), Value::Number(30.0)), ("label".to_string(), Value::Text("a".to_string()))]),
            ],
        );
        let columnar = ColumnarDataset::from_dataset(&dataset);
        assert_eq!(columnar.row_count(), 3);
        assert_eq!(columnar.primitive_column(0).unwrap().values, vec![1.5, 0.0, 3.0]);
        assert_eq!(columnar.categorical_column(2).unwrap().dictionary, vec!["a", "b"]);
    }

    #[test]
    fn direct_parts_validate_lengths_and_codes() {
        let primitive = HashMap::from([(0, PrimitiveColumn { values: vec![1.0, 2.0], validity: vec![1, 1] })]);
        let categorical = HashMap::from([(1, CategoricalColumn { dictionary: vec!["a".into()], codes: vec![0, 0], validity: vec![1, 1] })]);
        let dataset = ColumnarDataset::from_parts(2, primitive, categorical).expect("valid direct columns");
        assert_eq!(dataset.row_count(), 2);

        let bad = HashMap::from([(0, PrimitiveColumn { values: vec![1.0], validity: vec![1] })]);
        assert!(ColumnarDataset::from_parts(2, bad, HashMap::new()).is_err());
    }

    #[test]
    fn finite_value_iteration_respects_validity() {
        let primitive = HashMap::from([(0, PrimitiveColumn { values: vec![1.0, 0.0, 3.0], validity: vec![1, 0, 1] })]);
        let dataset = ColumnarDataset::from_parts(3, primitive, HashMap::new()).unwrap();
        assert_eq!(dataset.primitive_column(0).unwrap().finite_values().collect::<Vec<_>>(), vec![1.0, 3.0]);
    }
}
