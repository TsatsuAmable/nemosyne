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

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use column::Column;
use columnar::ColumnarDataset;

static DATASET_REGISTRY: Mutex<DatasetRegistry> = Mutex::new(DatasetRegistry::new());
static ROW_MATERIALISATIONS: AtomicU64 = AtomicU64::new(0);

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

/// Convert the current slot count into the next one-based public handle without
/// permitting `u32` wraparound into the invalid `0` sentinel.
fn handle_for_slot_count(slot_count: usize) -> Option<u32> {
    let one_based = slot_count.checked_add(1)?;
    u32::try_from(one_based).ok()
}

/// Dataset handles are monotonic capabilities for the lifetime of a WASM
/// runtime. Destroyed slots remain tombstones and are deliberately not reused:
/// otherwise a stale JS handle could silently become authority over a different
/// dataset with unrelated provenance.
pub struct DatasetRegistry {
    slots: Vec<Option<RegisteredDataset>>,
}

impl DatasetRegistry {
    pub const fn new() -> Self { Self { slots: Vec::new() } }

    fn insert_registered(&mut self, registered: RegisteredDataset) -> u32 {
        let Some(handle) = handle_for_slot_count(self.slots.len()) else {
            return 0;
        };
        self.slots.push(Some(registered));
        handle
    }

    pub fn insert(&mut self, dataset: Dataset) -> u32 {
        self.insert_registered(RegisteredDataset::new(dataset))
    }

    pub fn insert_columnar(&mut self, name: String, columns: Vec<Column>, columnar: ColumnarDataset) -> u32 {
        self.insert_registered(RegisteredDataset::columnar_only(name, columns, columnar))
    }

    pub fn get(&self, handle: u32) -> Option<&Dataset> {
        self.slots
            .get(handle.wrapping_sub(1) as usize)
            .and_then(|slot| slot.as_ref())
            .and_then(|registered| registered.dataset.as_ref())
    }

    fn get_registered(&self, handle: u32) -> Option<&RegisteredDataset> {
        self.slots
            .get(handle.wrapping_sub(1) as usize)
            .and_then(|slot| slot.as_ref())
    }

    fn get_registered_mut(&mut self, handle: u32) -> Option<&mut RegisteredDataset> {
        self.slots
            .get_mut(handle.wrapping_sub(1) as usize)
            .and_then(|slot| slot.as_mut())
    }

    fn get_columnar(&self, handle: u32) -> Option<&ColumnarDataset> {
        self.get_registered(handle)
            .map(|registered| registered.columnar.as_ref())
    }

    pub fn remove(&mut self, handle: u32) {
        let idx = handle.wrapping_sub(1) as usize;
        if let Some(slot) = self.slots.get_mut(idx) {
            *slot = None;
        }
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

    #[test]
    fn handle_conversion_is_checked_and_never_wraps_to_zero() {
        assert_eq!(handle_for_slot_count(0), Some(1));
        assert_eq!(handle_for_slot_count((u32::MAX - 1) as usize), Some(u32::MAX));
        if usize::BITS > 32 {
            assert_eq!(handle_for_slot_count(u32::MAX as usize), None);
        }
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
