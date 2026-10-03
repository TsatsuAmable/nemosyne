# RF-043 Rust Parser and WASM ABI Hostile-Input Fuzz Evidence — Closure Record

Date: 3 October 2026
Base: `main@a0c726030ba46b5a614c1f1b98c1cc5a8956765b`
Finding: RF-043 (High assurance gap) — Rust parser/WASM ABI hostile-input fuzz evidence gap
Status: VERIFIED COMPLETE

## Invariant

Exported WebAssembly ABI boundaries, analytical parsers, and typed binary ingest entry points must fail closed (returning 0 or safe refusal) for all malformed, truncated, out-of-bounds, non-finite, pathological Unicode, and shape-mismatched payloads.

Host allocations and memory view capabilities are tracked deterministically and released on error/refusal, ensuring zero memory leaks or unhandled traps across repeated allocations, operations, and reinitialization cycles.

## Production Boundary & Authority

1. **Rust/WASM Parser Authority**:
   - `wasm/src/data/parsers.rs`: `parse_csv`, `parse_json`, `parse_arrow` with governed resource bounds (`DEFAULT_MAX_ROWS = 100_000`, `DEFAULT_MAX_COLUMNS = 1_000`).
   - `wasm/src/data/typed_ingest.rs`: `data_load_typed_columns`, `data_load_typed_columns_named` with `NTC1` magic validation, checked buffer strides, categorical code space bounds, and UTF-8 verification.
   - `wasm/src/lib.rs`: Exported WebAssembly ABI functions backed by `allocator::try_view`, `allocator::try_view_mut`, and atomic two-call buffer sizing contracts.
2. **TypeScript Runtime Production Path**:
   - `src/wasm/RuntimeBridge.ts`: Authoritative runtime coordinator managing host buffer allocations, memory views, dataset lifecycle, and analytical operation calls across WASM boundaries.

## Hostile-Input Campaign Targets & Evidence

The six required fuzz and property campaign targets are systematically covered across both Rust native unit/property tests and live WebAssembly integration tests:

1. **Malformed and truncated CSV/JSON**:
   - Tested in Rust (`wasm/src/data/parsers.rs`: `truncated_and_mutated_csv_and_json_property_campaign`, `malformed_input_corpus_never_panics_and_stays_bounded`).
   - Tested in live WASM (`tests/wasm-abi-hardening.test.ts`: `survives systematic malformed and truncated CSV/JSON property fuzz campaign without leaking host buffers`).
   - Slices valid CSV and JSON payloads at every single byte offset, and performs mutational fuzzing (byte flips, boundary injection, null byte injection) ensuring clean refusal with zero host buffer leaks.
2. **Pathological Unicode and deeply nested structures**:
   - Tested in Rust (`wasm/src/data/parsers.rs`: `pathological_unicode_and_deeply_nested_structures_fail_or_bound_cleanly`).
   - Tested in live WASM (`tests/wasm-abi-hardening.test.ts`: `survives pathological Unicode and deeply nested structures without trapping`).
   - Exercises bidirectional text (RTL overrides `\u202E`), zero-width joiner emoji sequences (`👨‍👩‍👧‍👦`), non-characters (`\uFFFF`, `\uFFFE`), byte order marks (`\uFEFF`), and embedded nulls/control bytes.
   - Deeply nested structures (up to 50 levels of nesting) are parsed safely without stack overflow or traps.
3. **NaN, infinities, extreme magnitudes, extreme dimensions, and degenerate datasets**:
   - Tested in Rust (`wasm/src/data/parsers.rs`: `extreme_numerics_and_degenerate_datasets_handle_without_trapping`, `wasm/src/lib.rs`: `abi_extreme_numerics_roundtrip_and_safety`).
   - Tested in live WASM (`tests/wasm-abi-hardening.test.ts`: `handles extreme floating-point magnitudes, non-finites, and degenerate datasets safely`).
   - Covers `NaN`, `+Infinity`, `-Infinity`, subnormals (`1e-324`), extreme exponents (`1e308`, `-1e308`), `Number.MAX_VALUE`, `Number.MIN_VALUE`, `Number.EPSILON`.
   - Normalizes non-finite floats safely to `null` during serialization and JSON conversion; structure profiling and compatibility JSON export complete without trapping.
   - Degenerate datasets (0 rows, 0 columns, 1 row 1 col with null) are handled without panicking.
4. **Typed-buffer metadata, validity vectors, offsets, lengths, and mismatched shapes**:
   - Tested in Rust (`wasm/src/data/typed_ingest.rs`: `rejects_invalid_magic_and_truncated_headers`, `rejects_validity_vector_and_code_mismatches`, `rejects_unsupported_column_kinds`, `typed_ingest_survives_fuzzed_payload_mutations`).
   - Tested in live WASM (`tests/wasm-abi-hardening.test.ts`: `rejects corrupted typed-column metadata, validity vectors, and mismatched shapes`).
   - Rejects invalid magic (`XXXX`), truncated headers (<12 bytes), row count mismatches (declared row count exceeding supplied buffer stride), truncated validity vectors, out-of-bounds categorical codes (`code >= dictionary.len()`), and invalid UTF-8 strings.
5. **Stale, foreign, zero, overflowing, and boundary pointer/length pairs**:
   - Tested in Rust (`wasm/src/lib.rs`: `abi_exported_entries_reject_hostile_pointers_and_lengths`, `abi_byte_ingest_rejects_unbacked_ranges_with_zero_sentinel`).
   - Tested in live WASM (`tests/wasm-abi-hardening.test.ts`: `survives a bounded malformed-pointer corpus without leaking or trapping`, `rejects zero and maximal dataset handles without leaking host buffers`).
   - Tested across all primary exported ABIs: `data_load_csv`, `data_load_json`, `data_load_dataset_json`, `data_load_sample`, `data_load_typed_columns`, `data_load_typed_columns_named`, `data_operation`, `data_compute_structure_profile`, `compatibility_dataset_to_json`, `kernel_version`, `fill_pattern`.
6. **Allocation exhaustion and repeated allocate/deallocate/reinitialization sequences**:
   - Tested in Rust (`wasm/src/lib.rs`: `alloc_returns_increasing_offsets`).
   - Tested in live WASM (`tests/wasm-abi-hardening.test.ts`: `survives allocation exhaustion and repeated allocate/deallocate/reinit stress cycles`, `survives repeated allocation/free cycles without retaining host buffers`, `revokes all prior host-buffer capabilities when init starts a new generation`).
   - Proves exact restoration of `bridge.hostBufferAllocationCount() === baseline` across varied buffer sizes (1B to 64KB), interleaved allocations, and full runtime reinitialization.

## Verification Summary

- Rust test suite: `node scripts/cargo-test.mjs` (406 passed, 0 failed).
- TypeScript real-WASM boundary suite: `npm run test:wasm -- tests/wasm-abi-hardening.test.ts` (19 passed, 0 failed).
- Type checking: `npm run typecheck` (clean, 0 errors).
- Linting: `npm run lint` (clean, 0 errors).
