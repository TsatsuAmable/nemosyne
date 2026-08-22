pub mod column;
pub mod column_view;
pub mod columnar;
pub mod dataset;
pub mod encodings;
pub mod evidence;
pub mod fingerprint;
pub mod measurement;
pub mod measurement_inference;
pub mod missingness;
pub mod operations;
pub mod operations_bridge;
pub mod parsers;
pub mod profile;
pub mod provenance;
pub mod spectral;
pub mod statistics;
pub mod statistics_columnar;
pub mod statistics_evidence;
pub mod structure_discovery;
pub mod support;
pub mod synthetic;
pub mod topology;
pub mod value;

pub use dataset::{Dataset, Edge};

use std::sync::Mutex;

use columnar::ColumnarDataset;

/// Global dataset handle registry.
///
/// Handles are 1-indexed `u32` values; `0` is reserved for "invalid".
/// A deleted slot is left as `None` so re-use is safe for stale JS references.
static DATASET_REGISTRY: Mutex<DatasetRegistry> = Mutex::new(DatasetRegistry::new());

struct RegisteredDataset {
    dataset: Dataset,
    columnar: ColumnarDataset,
}

impl RegisteredDataset {
    fn new(dataset: Dataset) -> Self {
        let columnar = ColumnarDataset::from_dataset(&dataset);
        Self { dataset, columnar }
    }

    fn rebuild_columnar(&mut self) {
        self.columnar = ColumnarDataset::from_dataset(&self.dataset);
    }
}

pub struct DatasetRegistry {
    slots: Vec<Option<RegisteredDataset>>,
    free: Vec<u32>,
}

impl DatasetRegistry {
    pub const fn new() -> Self {
        Self {
            slots: Vec::new(),
            free: Vec::new(),
        }
    }

    pub fn insert(&mut self, dataset: Dataset) -> u32 {
        let registered = RegisteredDataset::new(dataset);
        if let Some(handle) = self.free.pop() {
            let idx = (handle - 1) as usize;
            self.slots[idx] = Some(registered);
            return handle;
        }
        let handle = self.slots.len() as u32 + 1;
        self.slots.push(Some(registered));
        handle
    }

    pub fn get(&self, handle: u32) -> Option<&Dataset> {
        let idx = (handle.wrapping_sub(1)) as usize;
        self.slots
            .get(idx)
            .and_then(|slot| slot.as_ref())
            .map(|registered| &registered.dataset)
    }

    fn get_registered(&self, handle: u32) -> Option<&RegisteredDataset> {
        let idx = (handle.wrapping_sub(1)) as usize;
        self.slots.get(idx).and_then(|slot| slot.as_ref())
    }

    fn get_registered_mut(&mut self, handle: u32) -> Option<&mut RegisteredDataset> {
        let idx = (handle.wrapping_sub(1)) as usize;
        self.slots.get_mut(idx).and_then(|slot| slot.as_mut())
    }

    fn get_columnar(&self, handle: u32) -> Option<&ColumnarDataset> {
        self.get_registered(handle).map(|registered| &registered.columnar)
    }

    pub fn remove(&mut self, handle: u32) {
        let idx = (handle.wrapping_sub(1)) as usize;
        if let Some(slot) = self.slots.get_mut(idx) {
            if slot.is_some() {
                *slot = None;
                self.free.push(handle);
            }
        }
    }
}

/// Insert a dataset into the global registry and return a handle.
///
/// Registration also constructs the transitional primitive columnar sidecar so
/// dataset-size-dependent consumers do not need to repeatedly rescan row maps.
pub fn register_dataset(dataset: Dataset) -> u32 {
    let mut reg = DATASET_REGISTRY.lock().expect("dataset registry poisoned");
    reg.insert(dataset)
}

/// Look up a dataset by handle.
pub fn with_dataset<T>(handle: u32, f: impl FnOnce(&Dataset) -> T) -> Option<T> {
    let reg = DATASET_REGISTRY.lock().expect("dataset registry poisoned");
    reg.get(handle).map(f)
}

/// Look up the synchronized primitive columnar sidecar by dataset handle.
pub fn with_columnar_dataset<T>(
    handle: u32,
    f: impl FnOnce(&ColumnarDataset) -> T,
) -> Option<T> {
    let reg = DATASET_REGISTRY.lock().expect("dataset registry poisoned");
    reg.get_columnar(handle).map(f)
}

/// Borrow the compatibility dataset and synchronized columnar sidecar under a
/// single registry lock. Analytical hot paths use this accessor so they cannot
/// accidentally observe mismatched generations during the transitional dual
/// representation phase.
pub fn with_dataset_and_columnar<T>(
    handle: u32,
    f: impl FnOnce(&Dataset, &ColumnarDataset) -> T,
) -> Option<T> {
    let reg = DATASET_REGISTRY.lock().expect("dataset registry poisoned");
    let registered = reg.get_registered(handle)?;
    Some(f(&registered.dataset, &registered.columnar))
}

/// Mutably access a dataset by handle.
///
/// Any mutation invalidates borrowed primitive-column caches and rebuilds the
/// columnar sidecar before the registry lock is released. This keeps the two
/// transitional representations in parity while callers migrate away from the
/// row-major compatibility store.
pub fn with_dataset_mut<T>(handle: u32, f: impl FnOnce(&mut Dataset) -> T) -> Option<T> {
    let mut reg = DATASET_REGISTRY.lock().expect("dataset registry poisoned");
    let registered = reg.get_registered_mut(handle)?;
    let result = f(&mut registered.dataset);
    registered.rebuild_columnar();
    column_view::release_dataset(handle);
    Some(result)
}

/// Release a dataset handle and any cached borrowed-column buffers derived from it.
pub fn destroy_dataset(handle: u32) {
    column_view::release_dataset(handle);
    let mut reg = DATASET_REGISTRY.lock().expect("dataset registry poisoned");
    reg.remove(handle);
}

#[cfg(test)]
mod columnar_registry_tests {
    use std::collections::HashMap;

    use crate::data::column::{Column, ColumnType};
    use crate::data::dataset::RowUpdateMode;
    use crate::data::value::Value;

    use super::*;

    fn row(value: Value) -> HashMap<String, Value> {
        HashMap::from([("value".to_string(), value)])
    }

    #[test]
    fn registration_builds_primitive_columnar_sidecar() {
        let handle = register_dataset(Dataset::new(
            "columnar-registry",
            vec![Column::new("value", ColumnType::Numeric)],
            vec![row(Value::Number(1.0)), row(Value::Null)],
        ));

        let snapshot = with_columnar_dataset(handle, |columnar| {
            let column = columnar.primitive_column(0).expect("numeric column");
            (column.values.clone(), column.validity.clone())
        })
        .expect("registered columnar dataset");

        assert_eq!(snapshot.0, vec![1.0, 0.0]);
        assert_eq!(snapshot.1, vec![1, 0]);
        destroy_dataset(handle);
    }

    #[test]
    fn paired_accessor_observes_matching_dataset_and_columnar_generation() {
        let handle = register_dataset(Dataset::new(
            "columnar-paired",
            vec![Column::new("value", ColumnType::Numeric)],
            vec![row(Value::Number(1.0)), row(Value::Number(2.0))],
        ));

        let snapshot = with_dataset_and_columnar(handle, |dataset, columnar| {
            (
                dataset.row_count(),
                columnar.row_count(),
                columnar
                    .primitive_column(0)
                    .expect("numeric column")
                    .values
                    .clone(),
            )
        })
        .expect("paired registry access");

        assert_eq!(snapshot.0, snapshot.1);
        assert_eq!(snapshot.2, vec![1.0, 2.0]);
        destroy_dataset(handle);
    }

    #[test]
    fn mutable_dataset_operations_rebuild_columnar_sidecar() {
        let handle = register_dataset(Dataset::new(
            "columnar-update",
            vec![Column::new("value", ColumnType::Numeric)],
            vec![row(Value::Number(1.0))],
        ));

        with_dataset_mut(handle, |dataset| {
            dataset.update_rows(
                vec![row(Value::Number(2.0))],
                RowUpdateMode::Append,
                None,
            );
        })
        .expect("dataset mutation");

        let snapshot = with_columnar_dataset(handle, |columnar| {
            columnar
                .primitive_column(0)
                .expect("numeric column")
                .values
                .clone()
        })
        .expect("registered columnar dataset");
        assert_eq!(snapshot, vec![1.0, 2.0]);
        destroy_dataset(handle);
    }
}
