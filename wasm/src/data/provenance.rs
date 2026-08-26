//! Provenance envelope for the Nemosyne analytical kernel.
//!
//! Every research-relevant analytical transformation must emit a provenance
//! envelope so results are reproducible and attributable to a specific kernel
//! build. The envelope is recorded in a side-channel (`LAST_PROVENANCE`) and
//! read back by the JS host via `kernel_provenance` — this keeps the
//! `(ptr, len)` + integer-handle ABI intact while satisfying the governance
//! rule that the kernel emits provenance on every result.
//!
//! `kernelVersion` is bumped whenever an analytical algorithm changes; saved
//! sessions break across a version bump (pre-alpha pivot, accepted).

use std::cell::RefCell;
use serde::Serialize;

/// Canonical kernel identifier carried on every provenance envelope.
pub const KERNEL_NAME: &str = "nemosyne-wasm";

/// Bumped on any analytical algorithm change. `0.2.0` is the Wave 1 canonical
/// versioned ABI: provenance envelope, canonical FNV-1a fingerprint, full
/// predicate/aggregator parity, exported topology/TDA/arrow/encodings.
pub const KERNEL_VERSION: &str = "0.2.0";

/// Provenance envelope attached to every kernel result.
///
/// Field names are camelCased to match the governance contract in
/// `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` and the JS `RuntimeBridge`
/// consumers, so the JSON crosses the ABI without renaming.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Provenance {
    pub kernel: &'static str,
    pub kernel_version: &'static str,
    pub operation: String,
    pub parameters: serde_json::Value,
    pub input_fingerprint: String,
    pub output_fingerprint: String,
    pub timestamp: f64,
    /// Substrate that produced the result: `"row_major"` or `"columnar_only"`.
    /// Absent on operations that do not distinguish ingest substrates, so the
    /// provenance JSON for every non-TDA envelope is unchanged. TDA ops
    /// (`compute_mapper_graph`, `compute_persistence_intervals`,
    /// `compute_betti0_curve`) always set this so replay can tell which
    /// substrate produced a result.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ingest_mode: Option<String>,
}

thread_local! {
    static LAST_PROVENANCE: RefCell<Option<String>> = const { RefCell::new(None) };
}

/// Record the provenance envelope for the most recent kernel call. The JS host
/// reads it via `kernel_provenance` immediately after a result-bearing call.
pub fn record(
    operation: &str,
    parameters: serde_json::Value,
    input_fingerprint: &str,
    output_fingerprint: &str,
) {
    record_with_ingest(operation, parameters, input_fingerprint, output_fingerprint, None);
}

/// Record a provenance envelope that also names the ingest substrate. TDA
/// exports use this so a row-major and a columnar-only handle that produce the
/// same analytical output still carry distinguishable, replayable provenance.
pub fn record_with_ingest(
    operation: &str,
    parameters: serde_json::Value,
    input_fingerprint: &str,
    output_fingerprint: &str,
    ingest_mode: Option<&str>,
) {
    let envelope = Provenance {
        kernel: KERNEL_NAME,
        kernel_version: KERNEL_VERSION,
        operation: operation.to_string(),
        parameters,
        input_fingerprint: input_fingerprint.to_string(),
        output_fingerprint: output_fingerprint.to_string(),
        timestamp: now_ms(),
        ingest_mode: ingest_mode.map(|s| s.to_string()),
    };
    let json = serde_json::to_string(&envelope).unwrap_or_else(|_| "{}".to_string());
    LAST_PROVENANCE.with(|slot| {
        *slot.borrow_mut() = Some(json);
    });
}

/// Return the last recorded provenance envelope as a JSON string (or `""` if
/// no kernel call has been made yet).
pub fn last_json() -> String {
    LAST_PROVENANCE.with(|slot| {
        slot.borrow().clone().unwrap_or_default()
    })
}

/// Clear the side-channel. Used by tests for deterministic isolation.
pub fn clear() {
    LAST_PROVENANCE.with(|slot| {
        *slot.borrow_mut() = None;
    });
}

// ---------------------------------------------------------------------------
// Timestamp source
// ---------------------------------------------------------------------------
//
// The WASM target has no clock. Per `.claude/plan.md` the imported-function
// surface is limited to logging, timestamps, and telemetry, so the kernel
// imports a single `nemosyneNowMs` global that the JS host
// (`RuntimeBridge.initRuntime`) installs as `globalThis.nemosyneNowMs =
// () => Date.now()` before any analytical call. On the host target `cargo test`
// falls back to `SystemTime` so the same logic is exercised without a WASM
// runner.

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen]
extern "C" {
    /// JS-provided monotonic-ish wall clock in milliseconds. Installed by
    /// `RuntimeBridge.initRuntime`.
    #[wasm_bindgen::prelude::wasm_bindgen(js_name = nemosyneNowMs)]
    fn now_ms_js() -> f64;
}

#[cfg(target_arch = "wasm32")]
pub fn now_ms() -> f64 {
    now_ms_js()
}

#[cfg(not(target_arch = "wasm32"))]
pub fn now_ms() -> f64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs_f64() * 1000.0)
        .unwrap_or(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_is_stable_string() {
        assert!(!KERNEL_VERSION.is_empty());
        assert_eq!(KERNEL_NAME, "nemosyne-wasm");
    }

    #[test]
    fn record_then_read_round_trips_fields() {
        clear();
        record(
            "sort",
            serde_json::json!({"column": "age", "ascending": true}),
            "deadbeef",
            "cafebabe",
        );
        let json = last_json();
        let v: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(v["kernel"], "nemosyne-wasm");
        assert_eq!(v["kernelVersion"], KERNEL_VERSION);
        assert_eq!(v["operation"], "sort");
        assert_eq!(v["inputFingerprint"], "deadbeef");
        assert_eq!(v["outputFingerprint"], "cafebabe");
        assert_eq!(v["parameters"]["column"], "age");
        assert!(v["timestamp"].as_f64().unwrap() > 0.0);
        clear();
    }

    #[test]
    fn clear_empties_side_channel() {
        record("ping", serde_json::Value::Null, "a", "b");
        clear();
        assert_eq!(last_json(), "");
    }
}