#[cfg(any(target_arch = "wasm32", test))]
use std::collections::HashMap;
#[cfg(any(target_arch = "wasm32", test))]
use std::sync::{Mutex, OnceLock};
use wasm_bindgen::prelude::*;

#[cfg(any(target_arch = "wasm32", test))]
struct HostBuffer {
    bytes: Box<[u8]>,
}

#[cfg(any(target_arch = "wasm32", test))]
impl HostBuffer {
    fn len(&self) -> usize {
        self.bytes.len()
    }
}

#[cfg(any(target_arch = "wasm32", test))]
#[derive(Default)]
struct HostBufferRegistry {
    allocations: HashMap<u32, HostBuffer>,
}

#[cfg(any(target_arch = "wasm32", test))]
impl HostBufferRegistry {
    fn insert(&mut self, ptr: u32, buffer: HostBuffer) -> bool {
        if ptr == 0 || self.allocations.contains_key(&ptr) {
            return false;
        }
        self.allocations.insert(ptr, buffer);
        true
    }

    fn remove_exact(&mut self, ptr: u32, len: u32) -> bool {
        let Some(allocation) = self.allocations.get(&ptr) else {
            return false;
        };
        if allocation.len() != len as usize {
            return false;
        }
        self.allocations.remove(&ptr);
        true
    }

    fn len(&self) -> usize {
        self.allocations.len()
    }
}

#[cfg(any(target_arch = "wasm32", test))]
fn host_buffer_registry() -> &'static Mutex<HostBufferRegistry> {
    static REGISTRY: OnceLock<Mutex<HostBufferRegistry>> = OnceLock::new();
    REGISTRY.get_or_init(|| Mutex::new(HostBufferRegistry::default()))
}

/// Allocate JS-visible bytes through Rust's own allocator and retain ownership
/// until an exact matching `host_buffer_dealloc` call releases them.
///
/// Keeping the `Box<[u8]>` in a Rust-side registry means malformed pointers,
/// mismatched lengths and duplicate frees never reach the global allocator.
/// The JS host receives only a borrowed linear-memory offset into a live Rust
/// allocation.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn host_buffer_alloc(len: u32) -> u32 {
    if len == 0 {
        return 0;
    }

    let mut bytes = vec![0_u8; len as usize].into_boxed_slice();
    let ptr = bytes.as_mut_ptr() as usize as u32;
    let inserted = host_buffer_registry()
        .lock()
        .expect("host buffer registry lock")
        .insert(ptr, HostBuffer { bytes });
    if inserted {
        ptr
    } else {
        0
    }
}

/// Release a buffer allocated by `host_buffer_alloc` only when both pointer and
/// length match the tracked allocation exactly.
///
/// Unknown, stale, duplicate or mismatched frees are deliberately ignored so
/// untrusted ABI input cannot fabricate allocator metadata and trigger undefined
/// behaviour.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn host_buffer_dealloc(ptr: u32, len: u32) {
    if ptr == 0 || len == 0 {
        return;
    }
    let _ = host_buffer_registry()
        .lock()
        .expect("host buffer registry lock")
        .remove_exact(ptr, len);
}

/// Diagnostic count used by resilience tests to prove host-side buffers are not
/// leaked across success and failure paths.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn host_buffer_allocation_count() -> u32 {
    host_buffer_registry()
        .lock()
        .expect("host buffer registry lock")
        .len() as u32
}

/// Borrow the existing contiguous f64 + validity buffers for a
/// numeric/epoch-temporal column.
///
/// The returned addresses point directly into the registered `ColumnarDataset`;
/// no additional stable-view cache or vector clone is created. The pointers are
/// valid until that dataset handle is mutated or destroyed. Both operations take
/// the dataset-registry lock before replacing/dropping the columnar vectors, so
/// `prepare` cannot race with a rebuild while deriving the addresses.
pub fn prepare(handle: u32, column_index: u32) -> Option<(u32, u32, u32)> {
    super::with_columnar_dataset(handle, |columnar| {
        let column = columnar.primitive_column(column_index as usize)?;
        Some((
            column.values.as_ptr() as usize as u32,
            column.validity.as_ptr() as usize as u32,
            column.values.len() as u32,
        ))
    })?
}

/// Element count for a primitive column view, or 0 if the handle/index/type is unsupported.
#[wasm_bindgen]
pub fn dataset_primitive_column_len(handle: u32, column_index: u32) -> u32 {
    prepare(handle, column_index)
        .map(|(_, _, len)| len)
        .unwrap_or(0)
}

/// Pointer to the Rust-owned f64 values buffer. Valid until the dataset handle is mutated or destroyed.
#[wasm_bindgen]
pub fn dataset_primitive_column_values_ptr(handle: u32, column_index: u32) -> u32 {
    prepare(handle, column_index)
        .map(|(values_ptr, _, _)| values_ptr)
        .unwrap_or(0)
}

/// Pointer to the Rust-owned u8 validity buffer (1 = valid, 0 = missing/non-finite).
#[wasm_bindgen]
pub fn dataset_primitive_column_validity_ptr(handle: u32, column_index: u32) -> u32 {
    prepare(handle, column_index)
        .map(|(_, validity_ptr, _)| validity_ptr)
        .unwrap_or(0)
}

/// Compatibility hook retained for mutation/destruction call sites.
///
/// Primitive views are now direct borrows into `ColumnarDataset`, so there is no
/// auxiliary cache to release. Mutation still rebuilds the sidecar before the
/// registry lock is released, which naturally invalidates previously returned
/// addresses at the documented lifetime boundary.
pub fn release_dataset(_handle: u32) {}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::data::column::{Column, ColumnType};
    use crate::data::dataset::{Dataset, RowUpdateMode};
    use crate::data::value::Value;

    use super::{HostBuffer, HostBufferRegistry};

    #[test]
    fn host_buffer_registry_rejects_mismatched_and_duplicate_frees() {
        let mut registry = HostBufferRegistry::default();
        assert!(registry.insert(
            64,
            HostBuffer {
                bytes: vec![0_u8; 16].into_boxed_slice(),
            }
        ));
        assert_eq!(registry.len(), 1);

        assert!(!registry.remove_exact(64, 8));
        assert_eq!(registry.len(), 1);
        assert!(!registry.remove_exact(65, 16));
        assert_eq!(registry.len(), 1);

        assert!(registry.remove_exact(64, 16));
        assert_eq!(registry.len(), 0);
        assert!(!registry.remove_exact(64, 16));
    }

    #[test]
    fn host_buffer_registry_rejects_zero_and_duplicate_pointers() {
        let mut registry = HostBufferRegistry::default();
        assert!(!registry.insert(
            0,
            HostBuffer {
                bytes: vec![0_u8; 8].into_boxed_slice(),
            }
        ));
        assert!(registry.insert(
            32,
            HostBuffer {
                bytes: vec![0_u8; 8].into_boxed_slice(),
            }
        ));
        assert!(!registry.insert(
            32,
            HostBuffer {
                bytes: vec![0_u8; 8].into_boxed_slice(),
            }
        ));
        assert_eq!(registry.len(), 1);
    }

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
        assert_eq!(super::dataset_primitive_column_len(handle, 0), 3);

        super::super::destroy_dataset(handle);
    }

    #[test]
    fn primitive_view_points_directly_at_registered_columnar_storage() {
        let columns = vec![Column::new("value", ColumnType::Numeric)];
        let rows = vec![
            HashMap::from([("value".to_string(), Value::Number(1.0))]),
            HashMap::from([("value".to_string(), Value::Number(2.0))]),
        ];
        let handle = super::super::register_dataset(Dataset::new("direct-view", columns, rows));
        let prepared = super::prepare(handle, 0).expect("view");
        let source = super::super::with_columnar_dataset(handle, |columnar| {
            let column = columnar.primitive_column(0).expect("numeric column");
            (
                column.values.as_ptr() as usize as u32,
                column.validity.as_ptr() as usize as u32,
                column.values.len() as u32,
            )
        })
        .expect("columnar dataset");

        assert_eq!(prepared, source);
        assert_eq!(super::prepare(handle, 0), Some(source));
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
        assert_eq!(super::dataset_primitive_column_len(handle, 0), 0);
        super::super::destroy_dataset(handle);
    }

    #[test]
    fn mutation_rebuilds_direct_primitive_view_source() {
        let columns = vec![Column::new("value", ColumnType::Numeric)];
        let rows = vec![HashMap::from([("value".to_string(), Value::Number(1.0))])];
        let handle = super::super::register_dataset(Dataset::new("view", columns, rows));
        assert_eq!(super::dataset_primitive_column_len(handle, 0), 1);

        super::super::with_dataset_mut(handle, |dataset| {
            dataset.update_rows(
                vec![HashMap::from([("value".to_string(), Value::Number(2.0))])],
                RowUpdateMode::Append,
                None,
            );
        })
        .expect("dataset mutation");

        let (_, _, len) = super::prepare(handle, 0).expect("rebuilt view");
        assert_eq!(len, 2);
        let values = super::super::with_columnar_dataset(handle, |columnar| {
            columnar
                .primitive_column(0)
                .expect("numeric column")
                .values
                .clone()
        })
        .expect("columnar dataset");
        assert_eq!(values, vec![1.0, 2.0]);
        super::super::destroy_dataset(handle);
    }
}
