pub mod column;
pub mod column_view;
pub mod columnar;
pub mod columnar_fingerprint;
pub mod compatibility;
pub mod dataset;
pub mod encodings;
pub mod evidence;
pub mod fingerprint;
pub mod load_profile;
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
pub mod typed_ingest;
pub mod value;

pub use dataset::{Dataset, Edge};

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use column::Column;
use columnar::ColumnarDataset;

static DATASET_REGISTRY: LazyLock<Mutex<DatasetRegistry>> =
    LazyLock::new(|| Mutex::new(DatasetRegistry::new()));
static ROW_MATERIALISATIONS: AtomicU64 = AtomicU64::new(0);

/// Keep the high bit permanently outside the dataset-handle capability space.
/// This preserves the established `0xffff_ffff` invalid-handle sentinel and
/// avoids signed/unsigned surprises at host boundaries while still allowing
/// more than two billion monotonically issued handles per runtime lifetime.
const MAX_DATASET_HANDLE: u32 = i32::MAX as u32;

struct RegisteredDataset {
    dataset: Option<Dataset>,
    name: String,
    columns: Vec<Column>,
    columnar: Arc<ColumnarDataset>,
    fingerprint: Option<String>,
    structure_profile_json: Option<String>,
}

impl RegisteredDataset {
    fn new(dataset: Dataset) -> Self {
        let name = dataset.name.clone();
        let columns = dataset.columns.clone();
        let columnar = Arc::new(ColumnarDataset::from_dataset(&dataset));
        Self {
            dataset: Some(dataset),
            name,
            columns,
            columnar,
            fingerprint: None,
            structure_profile_json: None,
        }
    }

    fn columnar_only(name: String, columns: Vec<Column>, columnar: ColumnarDataset) -> Self {
        Self {
            dataset: None,
            name,
            columns,
            columnar: Arc::new(columnar),
            fingerprint: None,
            structure_profile_json: None,
        }
    }

    fn rebuild_columnar(&mut self) {
        if let Some(dataset) = &self.dataset {
            self.name = dataset.name.clone();
            self.columns = dataset.columns.clone();
            self.columnar = Arc::new(ColumnarDataset::from_dataset(dataset));
            self.fingerprint = None;
            self.structure_profile_json = None;
        }
    }
}

/// Dataset handles remain monotonic, never-reused capabilities for one WASM
/// runtime lifetime. Unlike the tombstone vector, only live datasets consume
/// registry storage: destroying a dataset drops its registry entry while the
/// independent `next_handle` counter preserves stale-handle invalidity.
pub struct DatasetRegistry {
    entries: HashMap<u32, RegisteredDataset>,
    next_handle: u32,
}

impl DatasetRegistry {
    pub fn new() -> Self {
        Self {
            entries: HashMap::new(),
            next_handle: 1,
        }
    }

    #[cfg(test)]
    fn with_next_handle(next_handle: u32) -> Self {
        Self {
            entries: HashMap::new(),
            next_handle,
        }
    }

    fn take_next_handle(&mut self) -> Option<u32> {
        let handle = self.next_handle;
        if handle == 0 || handle > MAX_DATASET_HANDLE {
            return None;
        }
        self.next_handle = handle + 1;
        Some(handle)
    }

    fn insert_registered(&mut self, registered: RegisteredDataset) -> u32 {
        let Some(handle) = self.take_next_handle() else {
            return 0;
        };
        if self.entries.contains_key(&handle) {
            return 0;
        }
        self.entries.insert(handle, registered);
        handle
    }

    pub fn insert(&mut self, dataset: Dataset) -> u32 {
        self.insert_registered(RegisteredDataset::new(dataset))
    }

    pub fn insert_columnar(&mut self, name: String, columns: Vec<Column>, columnar: ColumnarDataset) -> u32 {
        self.insert_registered(RegisteredDataset::columnar_only(name, columns, columnar))
    }

    pub fn get(&self, handle: u32) -> Option<&Dataset> {
        self.get_registered(handle)?.dataset.as_ref()
    }

    fn get_registered(&self, handle: u32) -> Option<&RegisteredDataset> {
        if handle == 0 || handle > MAX_DATASET_HANDLE {
            return None;
        }
        self.entries.get(&handle)
    }

    fn get_registered_mut(&mut self, handle: u32) -> Option<&mut RegisteredDataset> {
        if handle == 0 || handle > MAX_DATASET_HANDLE {
            return None;
        }
        self.entries.get_mut(&handle)
    }

    fn get_columnar(&self, handle: u32) -> Option<&ColumnarDataset> {
        self.get_registered(handle)
            .map(|registered| registered.columnar.as_ref())
    }

    pub fn remove(&mut self, handle: u32) {
        if handle == 0 || handle > MAX_DATASET_HANDLE {
            return;
        }
        self.entries.remove(&handle);
    }

    #[cfg(test)]
    fn live_len(&self) -> usize {
        self.entries.len()
    }
}

pub fn register_dataset(dataset: Dataset) -> u32 {
    DATASET_REGISTRY.lock().expect("dataset registry poisoned").insert(dataset)
}

pub fn register_columnar_dataset(name: String, columns: Vec<Column>, columnar: ColumnarDataset) -> u32 {
    DATASET_REGISTRY.lock().expect("dataset registry poisoned").insert_columnar(name, columns, columnar)
}

pub fn register_dataset_profiled(dataset: Dataset) -> (u32, f64, f64) {
    let build_started = provenance::now_ms();
    let columnar = Arc::new(ColumnarDataset::from_dataset(&dataset));
    let columnar_build_ms = provenance::now_ms() - build_started;
    let insert_started = provenance::now_ms();
    let name = dataset.name.clone();
    let columns = dataset.columns.clone();
    let mut reg = DATASET_REGISTRY.lock().expect("dataset registry poisoned");
    let handle = reg.insert_registered(RegisteredDataset {
        dataset: Some(dataset),
        name,
        columns,
        columnar,
        fingerprint: None,
        structure_profile_json: None,
    });
    let registry_insert_ms = provenance::now_ms() - insert_started;
    (handle, columnar_build_ms, registry_insert_ms)
}

pub fn with_dataset<T>(handle: u32, f: impl FnOnce(&Dataset) -> T) -> Option<T> {
    DATASET_REGISTRY.lock().expect("dataset registry poisoned").get(handle).map(f)
}

pub fn with_columnar_dataset<T>(handle: u32, f: impl FnOnce(&ColumnarDataset) -> T) -> Option<T> {
    DATASET_REGISTRY.lock().expect("dataset registry poisoned").get_columnar(handle).map(f)
}

pub fn with_columnar_metadata<T>(handle: u32, f: impl FnOnce(&str, &[Column], &ColumnarDataset) -> T) -> Option<T> {
    let reg = DATASET_REGISTRY.lock().expect("dataset registry poisoned");
    let registered = reg.get_registered(handle)?;
    Some(f(&registered.name, &registered.columns, registered.columnar.as_ref()))
}

pub fn columnar_snapshot(handle: u32) -> Option<(String, Vec<Column>, Arc<ColumnarDataset>)> {
    let reg = DATASET_REGISTRY.lock().expect("dataset registry poisoned");
    let registered = reg.get_registered(handle)?;
    Some((
        registered.name.clone(),
        registered.columns.clone(),
        Arc::clone(&registered.columnar),
    ))
}

pub fn cached_structure_profile_json(handle: u32) -> Option<String> {
    let reg = DATASET_REGISTRY.lock().expect("dataset registry poisoned");
    reg.get_registered(handle)?.structure_profile_json.clone()
}

pub fn cached_fingerprint(handle: u32) -> Option<String> {
    let reg = DATASET_REGISTRY.lock().expect("dataset registry poisoned");
    reg.get_registered(handle)?.fingerprint.clone()
}

pub fn cache_fingerprint(
    handle: u32,
    expected_generation: &Arc<ColumnarDataset>,
    fingerprint: String,
) -> bool {
    let mut reg = DATASET_REGISTRY.lock().expect("dataset registry poisoned");
    let Some(registered) = reg.get_registered_mut(handle) else {
        return false;
    };
    if !Arc::ptr_eq(&registered.columnar, expected_generation) {
        return false;
    }
    registered.fingerprint = Some(fingerprint);
    true
}

pub fn cache_structure_profile_json(
    handle: u32,
    expected_generation: &Arc<ColumnarDataset>,
    json: String,
) -> bool {
    let mut reg = DATASET_REGISTRY.lock().expect("dataset registry poisoned");
    let Some(registered) = reg.get_registered_mut(handle) else {
        return false;
    };
    if !Arc::ptr_eq(&registered.columnar, expected_generation) {
        return false;
    }
    registered.structure_profile_json = Some(json);
    true
}

pub fn fingerprint_for_handle(handle: u32) -> Option<Result<String, String>> {
    let reg = DATASET_REGISTRY.lock().expect("dataset registry poisoned");
    let registered = reg.get_registered(handle)?;
    if let Some(dataset) = &registered.dataset {
        Some(Ok(dataset.fingerprint()))
    } else {
        Some(columnar_fingerprint::columnar_dataset_fingerprint(
            &registered.name,
            &registered.columns,
            registered.columnar.as_ref(),
        ))
    }
}

/// Explicitly build and cache the row-major compatibility representation.
/// Returns `Ok(false)` when rows were already resident and `Ok(true)` when a
/// materialisation occurred. Normal columnar accessors never call this.
///
/// The expensive O(rows × columns) build runs outside the global registry lock.
/// `Arc::ptr_eq` acts as a generation token: if the handle is destroyed or its
/// canonical columnar generation changes while materialisation is running, the
/// result is discarded rather than installed into the wrong dataset.
pub fn materialize_rows(handle: u32) -> Result<bool, String> {
    let (name, columns, columnar) = {
        let reg = DATASET_REGISTRY.lock().expect("dataset registry poisoned");
        let registered = reg.get_registered(handle).ok_or("invalid dataset handle")?;
        if registered.dataset.is_some() {
            return Ok(false);
        }
        (registered.name.clone(), registered.columns.clone(), Arc::clone(&registered.columnar))
    };

    let dataset = compatibility::materialize_dataset(&name, &columns, columnar.as_ref())?;

    let mut reg = DATASET_REGISTRY.lock().expect("dataset registry poisoned");
    let registered = reg.get_registered_mut(handle).ok_or("dataset handle was destroyed during materialisation")?;
    if registered.dataset.is_some() {
        return Ok(false);
    }
    if !Arc::ptr_eq(&registered.columnar, &columnar) {
        return Err("dataset generation changed during materialisation".into());
    }
    registered.dataset = Some(dataset);
    ROW_MATERIALISATIONS.fetch_add(1, Ordering::Relaxed);
    Ok(true)
}

pub fn row_materialisation_count() -> u64 {
    ROW_MATERIALISATIONS.load(Ordering::Relaxed)
}

pub fn with_dataset_and_columnar<T>(handle: u32, f: impl FnOnce(&Dataset, &ColumnarDataset) -> T) -> Option<T> {
    let reg = DATASET_REGISTRY.lock().expect("dataset registry poisoned");
    let registered = reg.get_registered(handle)?;
    Some(f(registered.dataset.as_ref()?, registered.columnar.as_ref()))
}

pub fn with_dataset_mut<T>(handle: u32, f: impl FnOnce(&mut Dataset) -> T) -> Option<T> {
    let mut reg = DATASET_REGISTRY.lock().expect("dataset registry poisoned");
    let registered = reg.get_registered_mut(handle)?;
    let result = f(registered.dataset.as_mut()?);
    column_view::release_dataset(handle);
    registered.rebuild_columnar();
    Some(result)
}

pub fn destroy_dataset(handle: u32) {
    column_view::release_dataset(handle);
    DATASET_REGISTRY.lock().expect("dataset registry poisoned").remove(handle);
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

    fn local_dataset(name: &str) -> Dataset {
        Dataset::new(name, Vec::new(), Vec::new())
    }

    #[test]
    fn handle_allocation_is_checked_and_reserves_high_bit() {
        let mut registry = DatasetRegistry::with_next_handle(MAX_DATASET_HANDLE);
        let final_handle = registry.insert(local_dataset("final"));
        assert_eq!(final_handle, MAX_DATASET_HANDLE);
        assert_eq!(registry.insert(local_dataset("exhausted")), 0);
        assert!(registry.get(u32::MAX).is_none());
        assert!(registry.get(1 << 31).is_none());
        assert_eq!(registry.get(final_handle).map(|dataset| dataset.name.as_str()), Some("final"));
    }

    #[test]
    fn destroyed_handle_releases_registry_storage_without_becoming_reusable() {
        let mut registry = DatasetRegistry::new();
        let first = registry.insert(local_dataset("first"));
        assert_eq!(registry.live_len(), 1);
        registry.remove(first);
        assert_eq!(registry.live_len(), 0);
        assert!(registry.get(first).is_none());

        let second = registry.insert(local_dataset("second"));
        assert!(second > first);
        assert_ne!(second, first);
        assert_eq!(registry.live_len(), 1);
        assert!(registry.get(first).is_none());
        assert_eq!(registry.get(second).map(|dataset| dataset.name.as_str()), Some("second"));
    }

    #[test]
    fn exhaustion_does_not_disturb_the_last_live_handle() {
        let mut registry = DatasetRegistry::with_next_handle(MAX_DATASET_HANDLE);
        let final_handle = registry.insert(local_dataset("live"));
        assert_eq!(registry.insert(local_dataset("rejected")), 0);
        assert_eq!(registry.live_len(), 1);
        assert_eq!(registry.get(final_handle).map(|dataset| dataset.name.as_str()), Some("live"));
    }

    #[test]
    fn destroyed_handle_is_never_reused_or_revalidated() {
        let first = register_dataset(Dataset::new(
            "first",
            vec![Column::new("value", ColumnType::Numeric)],
            vec![row(Value::Number(1.0))],
        ));
        assert!(first > 0);
        destroy_dataset(first);
        assert!(with_dataset(first, |_| ()).is_none());
        assert!(with_columnar_dataset(first, |_| ()).is_none());

        let second = register_dataset(Dataset::new(
            "second",
            vec![Column::new("value", ColumnType::Numeric)],
            vec![row(Value::Number(2.0))],
        ));
        assert!(second > first);
        assert_ne!(second, first);
        assert!(with_dataset(first, |_| ()).is_none());
        assert_eq!(with_dataset(second, |dataset| dataset.name.clone()), Some("second".into()));
        destroy_dataset(second);
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
        }).expect("registered columnar dataset");
        assert_eq!(snapshot.0, vec![1.0, 0.0]);
        assert_eq!(snapshot.1, vec![1, 0]);
        destroy_dataset(handle);
    }

    #[test]
    fn explicit_materialisation_is_cached_and_identity_stable() {
        let columns = vec![Column::new("value", ColumnType::Numeric)];
        let columnar = ColumnarDataset::from_parts(
            2,
            HashMap::from([(0, crate::data::columnar::PrimitiveColumn { values: vec![1.0, 2.0], validity: vec![1, 1] })]),
            HashMap::new(),
        ).expect("columnar data");
        let handle = register_columnar_dataset("typed".into(), columns, columnar);
        let before = fingerprint_for_handle(handle).unwrap().unwrap();
        assert_eq!(materialize_rows(handle), Ok(true));
        assert_eq!(materialize_rows(handle), Ok(false));
        assert!(with_dataset(handle, |_| ()).is_some());
        assert_eq!(fingerprint_for_handle(handle).unwrap().unwrap(), before);
        destroy_dataset(handle);
    }

    #[test]
    fn columnar_only_registration_uses_normal_handles_without_row_storage() {
        let columns = vec![Column::new("value", ColumnType::Numeric)];
        let columnar = ColumnarDataset::from_parts(
            2,
            HashMap::from([(0, crate::data::columnar::PrimitiveColumn { values: vec![1.0, 2.0], validity: vec![1, 1] })]),
            HashMap::new(),
        ).expect("columnar data");
        let handle = register_columnar_dataset("typed".into(), columns, columnar);
        assert!(with_dataset(handle, |_| ()).is_none());
        assert_eq!(
            with_columnar_metadata(handle, |name, columns, data| {
                (name.to_string(), columns.len(), data.row_count())
            }),
            Some(("typed".into(), 1, 2))
        );
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
                columnar.primitive_column(0).expect("numeric column").values.clone(),
            )
        }).expect("paired registry access");
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
        let (_, _, generation) = columnar_snapshot(handle).expect("columnar generation");
        assert!(cache_fingerprint(handle, &generation, "cached-fingerprint".into()));
        assert!(cache_structure_profile_json(handle, &generation, "{}".into()));
        with_dataset_mut(handle, |dataset| {
            dataset.update_rows(
                vec![row(Value::Number(2.0))],
                RowUpdateMode::Append,
                None,
            );
        }).expect("dataset mutation");
        let snapshot = with_columnar_dataset(handle, |columnar| {
            columnar.primitive_column(0).expect("numeric column").values.clone()
        }).expect("registered columnar dataset");
        assert_eq!(snapshot, vec![1.0, 2.0]);
        assert!(cached_fingerprint(handle).is_none());
        assert!(cached_structure_profile_json(handle).is_none());
        destroy_dataset(handle);
    }
}
