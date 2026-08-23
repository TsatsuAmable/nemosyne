//! Diagnostic-only ingestion profiling for the JSON compatibility data plane.
//!
//! This module intentionally does not change `data_load_dataset_json`. It adds a
//! separate ABI so scale experiments can measure where ingestion time is spent
//! before Nemosyne commits to a replacement bulk transport.

use std::sync::Mutex;

use serde::Serialize;
use wasm_bindgen::prelude::*;

use crate::{allocator, data};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LoadProfile {
    schema_version: u32,
    input_bytes: usize,
    utf8_validation_ms: f64,
    compatibility_dataset_build_ms: f64,
    columnar_sidecar_build_ms: f64,
    registry_insert_ms: f64,
    total_rust_load_ms: f64,
    row_count: usize,
    column_count: usize,
}

static LAST_LOAD_PROFILE: Mutex<Option<String>> = Mutex::new(None);

fn record(profile: &LoadProfile) {
    let json = serde_json::to_string(profile).unwrap_or_else(|_| "{}".to_string());
    if let Ok(mut slot) = LAST_LOAD_PROFILE.lock() {
        *slot = Some(json);
    }
}

fn record_error(input_bytes: usize) {
    record(&LoadProfile {
        schema_version: 1,
        input_bytes,
        utf8_validation_ms: 0.0,
        compatibility_dataset_build_ms: 0.0,
        columnar_sidecar_build_ms: 0.0,
        registry_insert_ms: 0.0,
        total_rust_load_ms: 0.0,
        row_count: 0,
        column_count: 0,
    });
}

fn last_json() -> String {
    LAST_LOAD_PROFILE
        .lock()
        .ok()
        .and_then(|slot| slot.clone())
        .unwrap_or_default()
}

fn write_str_out(s: &str, out_ptr: u32, out_len: u32) -> u32 {
    let bytes = s.as_bytes();
    if out_len == 0 {
        return bytes.len() as u32;
    }
    let write_len = std::cmp::min(bytes.len(), out_len as usize);
    let slice = unsafe { allocator::view_mut(out_ptr, write_len as u32) };
    slice.copy_from_slice(&bytes[..write_len]);
    write_len as u32
}

/// Diagnostic twin of `data_load_dataset_json` that records phase timings.
/// Production callers should continue using the established loader.
#[wasm_bindgen]
pub fn data_load_dataset_json_profiled(ptr: u32, len: u32) -> u32 {
    let total_started = data::provenance::now_ms();
    let bytes = unsafe { allocator::view(ptr, len) };

    let utf8_started = data::provenance::now_ms();
    let json = match std::str::from_utf8(bytes) {
        Ok(value) => value,
        Err(_) => {
            record_error(len as usize);
            return 0;
        }
    };
    let utf8_validation_ms = data::provenance::now_ms() - utf8_started;

    let dataset_started = data::provenance::now_ms();
    let dataset = match data::dataset::Dataset::from_js_json(json) {
        Ok(value) => value,
        Err(_) => {
            record_error(len as usize);
            return 0;
        }
    };
    let compatibility_dataset_build_ms = data::provenance::now_ms() - dataset_started;
    let row_count = dataset.row_count();
    let column_count = dataset.column_count();

    let (handle, columnar_sidecar_build_ms, registry_insert_ms) =
        data::register_dataset_profiled(dataset);
    let total_rust_load_ms = data::provenance::now_ms() - total_started;

    record(&LoadProfile {
        schema_version: 1,
        input_bytes: len as usize,
        utf8_validation_ms,
        compatibility_dataset_build_ms,
        columnar_sidecar_build_ms,
        registry_insert_ms,
        total_rust_load_ms,
        row_count,
        column_count,
    });
    handle
}

/// Return the most recent diagnostic ingestion profile as JSON using the
/// standard two-call output-buffer convention.
#[wasm_bindgen]
pub fn data_last_load_profile(out_ptr: u32, out_len: u32) -> u32 {
    write_str_out(&last_json(), out_ptr, out_len)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_json_uses_stable_schema() {
        let profile = LoadProfile {
            schema_version: 1,
            input_bytes: 10,
            utf8_validation_ms: 1.0,
            compatibility_dataset_build_ms: 2.0,
            columnar_sidecar_build_ms: 3.0,
            registry_insert_ms: 4.0,
            total_rust_load_ms: 10.0,
            row_count: 2,
            column_count: 1,
        };
        let json = serde_json::to_value(profile).expect("profile serializes");
        assert_eq!(json["schemaVersion"], 1);
        assert_eq!(json["compatibilityDatasetBuildMs"], 2.0);
        assert_eq!(json["columnarSidecarBuildMs"], 3.0);
    }
}
