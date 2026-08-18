# Nemosyne — Centralized System Error Register

**Status:** Authoritative Error Catalog  
**Source Code:** [`src/types/ErrorRegistry.ts`](file:///Users/tsatsuamable/Documents/nemosyne/src/types/ErrorRegistry.ts)

This register catalogs all standardized error codes, domains, severity levels, diagnostic descriptions, and recovery procedures across Nemosyne.

---

## Error Domains Overview

| Domain Code | Subsystem | Scope & Ownership |
|---|---|---|
| `01xx` | `WASM_KERNEL` | Rust WebAssembly analytical execution, buffer ABI, memory bounds. |
| `02xx` | `DATASET_PARSER` | CSV, JSON, ArrayBuffer ingestion, schema inference, content hashing. |
| `03xx` | `DRACO_SOLVER` | Constraint engine, representation search, layout weight solver. |
| `04xx` | `SPATIAL_RUNTIME` | WebGL context, Three.js scene graph, GPU memory, frame budgets. |
| `05xx` | `INTERACTION_FSM` | Hand tracking, gesture recognition, both-pinch ownership, raycasting. |
| `06xx` | `COLLABORATION_NET`| WebRTC mesh, signalling server, token authorization, room quotas. |
| `07xx` | `SESSION_STORE` | IndexedDB persistence, session restore, state schema validation. |
| `08xx` | `RESEARCH_HARNESS`| Study protocol enforcement, frozen treatments, trial telemetry. |

---

## Catalog of System Errors

### 01xx — WASM Kernel

- **`ERR_0101_KERNEL_UNAVAILABLE`** (`CRITICAL`)
  - *Title:* Rust/WASM Analytical Kernel Unavailable
  - *Description:* WebAssembly analytical module failed to initialize or memory allocation failed.
  - *Recovery:* Check browser WebAssembly support or build status in `wasm/pkg/`.

- **`ERR_0102_ABI_BUFFER_OVERFLOW`** (`ERROR`)
  - *Title:* WASM ABI Buffer Length Overflow
  - *Description:* Shared memory buffer exceeded declared maximum size bounds.
  - *Recovery:* Reduce batch slice size or downsample input dataset.

---

### 02xx — Dataset & Ingestion

- **`ERR_0201_PARSER_MALFORMED_CSV`** (`ERROR`)
  - *Title:* Malformed CSV File Format
  - *Description:* Unclosed quotes, inconsistent column counts, or unescaped delimiter encountered.
  - *Recovery:* Verify CSV delimiter and ensure text fields containing commas are enclosed in quotes.

- **`ERR_0202_EMPTY_DATASET`** (`WARNING`)
  - *Title:* Dataset Contains Zero Rows
  - *Description:* Parsed data input contains a valid schema but zero rows of data.
  - *Recovery:* Load a non-empty dataset or verify stream ingestion status.

---

### 03xx — Draco Solver & Recommender

- **`ERR_0301_NO_VALID_DRACO_SPEC`** (`WARNING`)
  - *Title:* No Valid Draco Representation Satisfies Constraints
  - *Description:* Hard constraints excluded all 3,168 candidate specifications for the active dataset.
  - *Recovery:* Relax topology constraints or switch to fallback 3D grid layout.

---

### 04xx — Spatial Runtime & Graphics

- **`ERR_0401_WEBGL_CONTEXT_LOST`** (`CRITICAL`)
  - *Title:* WebGL GPU Context Lost
  - *Description:* GPU hardware reset or out-of-memory error triggered context loss.
  - *Recovery:* Reload page or decrease dataset LOD rendering scale.

- **`ERR_0402_FRAME_BUDGET_BREACH`** (`WARNING`)
  - *Title:* Spatial Frame-Time Budget Exceeded
  - *Description:* Rendering frame time exceeded 13.88ms threshold on Quest standalone headset.
  - *Recovery:* Adaptive governor automatically reduces instance density and point sizes.

---

### 05xx — Interaction & Input

- **`ERR_0501_HAND_TRACKING_LOST`** (`WARNING`)
  - *Title:* Hand Tracking Lost
  - *Description:* Headset camera lost visibility of active hand joints.
  - *Recovery:* Return hands to headset field-of-view or switch to VR controllers.

---

### 06xx — Collaboration & Network

- **`ERR_0601_SIGNALLING_AUTH_FAILED`** (`ERROR`)
  - *Title:* Signalling Server Authentication Denied
  - *Description:* Provided room access token is invalid, expired, or unauthorized.
  - *Recovery:* Verify `NEMOSYNE_SIGNAL_TOKEN` or obtain an updated participant token.

---

### 07xx — Session & Persistence

- **`ERR_0701_INDEXEDDB_UNAVAILABLE`** (`WARNING`)
  - *Title:* IndexedDB Storage Inaccessible
  - *Description:* Browser in private/incognito mode or local storage quota exhausted.
  - *Recovery:* Session runs in in-memory mode; export manual JSON story files to save work.

---

### 08xx — Research Harness

- **`ERR_0801_FROZEN_TREATMENT_MUTATION_BLOCKED`** (`ERROR`)
  - *Title:* Attempted Mutation of Frozen Study Treatment Variable
  - *Description:* Action blocked because active study protocol locks representations during trial.
  - *Recovery:* Complete active trial before modifying layout or assistant settings.
