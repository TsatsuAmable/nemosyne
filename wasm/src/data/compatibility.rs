//! Explicit compatibility materialisation for columnar-first datasets.
//!
//! Columnar storage remains authoritative. Row-major `Dataset` values are built
//! only when a compatibility consumer explicitly requests them.

use std::collections::HashMap;

use crate::data::column::{Column, ColumnType};
use crate::data::columnar::ColumnarDataset;
use crate::data::dataset::Dataset;
use crate::data::value::Value;

pub fn materialize_dataset(
    name: &str,
    columns: &[Column],
    columnar: &ColumnarDataset,
) -> Result<Dataset, String> {
    let mut rows = Vec::with_capacity(columnar.row_count());
    for row_index in 0..columnar.row_count() {
        let mut row = HashMap::with_capacity(columns.len());
        for (column_index, column) in columns.iter().enumerate() {
            let value = match column.ty {
                ColumnType::Numeric | ColumnType::Temporal => {
                    let primitive = columnar
                        .primitive_column(column_index)
                        .ok_or_else(|| format!("missing primitive column {column_index}"))?;
                    if primitive.validity.get(row_index).copied().unwrap_or(0) == 0 {
                        Value::Null
                    } else {
                        Value::Number(*primitive.values.get(row_index).ok_or_else(|| {
                            format!("primitive column {column_index} is shorter than row count")
                        })?)
                    }
                }
                ColumnType::Categorical => {
                    let categorical = columnar
                        .categorical_column(column_index)
                        .ok_or_else(|| format!("missing categorical column {column_index}"))?;
                    if categorical.validity.get(row_index).copied().unwrap_or(0) == 0 {
                        Value::Null
                    } else {
                        let code = *categorical.codes.get(row_index).ok_or_else(|| {
                            format!("categorical column {column_index} is shorter than row count")
                        })? as usize;
                        Value::Text(
                            categorical
                                .dictionary
                                .get(code)
                                .ok_or_else(|| {
                                    format!("categorical column {column_index} contains out-of-range code")
                                })?
                                .clone(),
                        )
                    }
                }
                other => {
                    return Err(format!(
                        "compatibility materialisation does not yet support {other:?}"
                    ));
                }
            };
            row.insert(column.name.clone(), value);
        }
        rows.push(row);
    }
    Ok(Dataset::new(name.to_string(), columns.to_vec(), rows))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::columnar::{CategoricalColumn, PrimitiveColumn};

    #[test]
    fn materialises_typed_scalar_contract_without_changing_values() {
        let columns = vec![
            Column::new("x", ColumnType::Numeric),
            Column::new("cohort", ColumnType::Categorical),
        ];
        let columnar = ColumnarDataset::from_parts(
            2,
            HashMap::from([(
                0,
                PrimitiveColumn {
                    values: vec![1.5, 0.0],
                    validity: vec![1, 0],
                },
            )]),
            HashMap::from([(
                1,
                CategoricalColumn {
                    dictionary: vec!["a".into(), "b".into()],
                    codes: vec![0, 1],
                    validity: vec![1, 1],
                },
            )]),
        )
        .unwrap();
        let dataset = materialize_dataset("compat", &columns, &columnar).unwrap();
        assert_eq!(dataset.rows[0]["x"], Value::Number(1.5));
        assert_eq!(dataset.rows[1]["x"], Value::Null);
        assert_eq!(dataset.rows[1]["cohort"], Value::Text("b".into()));
    }
}
