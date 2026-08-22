use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

use crate::data::column::ColumnType;

#[derive(Debug)]
pub struct PrimitiveColumnView {
    pub values: Vec<f64>,
    pub validity: Vec<u8>,
}

static COLUMN_VIEWS: LazyLock<Mutex<HashMap<(u32, u32), PrimitiveColumnView>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// Prepare a contiguous f64 + validity buffer for a numeric column.
///
/// This is deliberately a migration prototype: the canonical Dataset remains
/// row-major for now, and the contiguous buffer is cached per dataset handle.
/// The ABI removes JSON materialization for primitive column consumers while we
/// benchmark whether making this representation canonical is worthwhile.
pub fn prepare(handle: u32, column_index: u32) -> Option<(u32, u32, u32)> {
    let key = (handle, column_index);

    {
        let views = COLUMN_VIEWS.lock().expect("column view registry poisoned");
        if let Some(view) = views.get(&key) {
            return Some((
                view.values.as_ptr() as usize as u32,
                view.validity.as_ptr() as usize as u32,
                view.values.len() as u32,
            ));
        }
    }

    let view = super::with_dataset(handle, |dataset| {
        let column = dataset.columns.get(column_index as usize)?;
        if !matches!(column.ty, ColumnType::Numeric | ColumnType::Temporal) {
            return None;
        }

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
        Some(PrimitiveColumnView { values, validity })
    })??;

    let mut views = COLUMN_VIEWS.lock().expect("column view registry poisoned");
    let view = views.entry(key).or_insert(view);
    Some((
        view.values.as_ptr() as usize as u32,
        view.validity.as_ptr() as usize as u32,
        view.values.len() as u32,
    ))
}

/// Release cached column views when the owning dataset handle is destroyed.
pub fn release_dataset(handle: u32) {
    let mut views = COLUMN_VIEWS.lock().expect("column view registry poisoned");
    views.retain(|(dataset_handle, _), _| *dataset_handle != handle);
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::data::column::{Column, ColumnType};
    use crate::data::dataset::Dataset;
    use crate::data::value::Value;

    #[test]
    fn primitive_view_preserves_missingness_separately_from_values() {
        let columns = vec![Column::new("value", ColumnType::Numeric)];
        let rows = vec![
            HashMap::from([("value".to_string(), Value::Number(1.5))]),
            HashMap::from([("value".to_string(), Value::Null)]),
            HashMap::from([("value".to_string(), Value::Number(3.5))]),
        ];
        let handle = super::super::register_dataset(Dataset::new("view", columns, rows));
        let (values_ptr, validity_ptr, len) = super::prepare(handle, 0).expect("view");

        assert_ne!(values_ptr, 0);
        assert_ne!(validity_ptr, 0);
        assert_eq!(len, 3);

        super::release_dataset(handle);
        super::super::destroy_dataset(handle);
    }

    #[test]
    fn categorical_columns_are_not_exposed_as_f64_views() {
        let columns = vec![Column::new("category", ColumnType::Categorical)];
        let rows = vec![HashMap::from([(
            "category".to_string(),
            Value::Text("a".to_string()),
        )])];
        let handle = super::super::register_dataset(Dataset::new("view", columns, rows));
        assert!(super::prepare(handle, 0).is_none());
        super::super::destroy_dataset(handle);
    }
}
