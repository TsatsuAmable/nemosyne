# Nemosyne — Centralized System Error Register

**Status:** Authoritative Error Catalog  
**Source Code:** [`src/types/ErrorRegistry.ts`](../src/types/ErrorRegistry.ts)

This register catalogs all standardized error codes, domains, severity levels, diagnostic descriptions, and recovery procedures across Nemosyne.

---

## Error Domains Overview

| Domain Code | Subsystem           | Scope & Ownership                                                           |
| ----------- | ------------------- | --------------------------------------------------------------------------- |
| `01xx`      | `WASM_KERNEL`       | Rust WebAssembly analytical execution, buffer ABI, memory bounds.           |
| `02xx`      | `DATASET_PARSER`    | CSV, JSON, ArrayBuffer ingestion, schema inference, content hashing.        |
| `03xx`      | `DRACO_SOLVER`      | Compatibility error domain for the Moneta constraint/representation engine. |
| `04xx`      | `SPATIAL_RUNTIME`   | WebGL context, Three.js scene graph, GPU memory, frame budgets.             |
| `05xx`      | `INTERACTION_FSM`   | Hand tracking, gesture recognition, both-pinch ownership, raycasting.       |
| `06xx`      | `COLLABORATION_NET` | WebRTC mesh, signalling server, token authorization, room quotas.           |
| `07xx`      | `SESSION_STORE`     | IndexedDB persistence, session restore, state schema validation.            |
| `08xx`      | `RESEARCH_HARNESS`  | Study protocol enforcement, frozen treatments, trial telemetry.             |

---

## Catalog of System Errors

### 01xx — WASM Kernel

- **`ERR_0101_KERNEL_UNAVAILABLE`** (`CRITICAL`)
  - _Title:_ Rust/WASM Analytical Kernel Unavailable
  - _Description:_ WebAssembly analytical module failed to initialize or memory allocation failed.
  - _Recovery:_ Check browser WebAssembly support or build status in `wasm/pkg/`.

- **`ERR_0102_ABI_BUFFER_OVERFLOW`** (`ERROR`)
  - _Title:_ WASM ABI Buffer Length Overflow
  - _Description:_ Shared memory buffer exceeded declared maximum size bounds.
  - _Recovery:_ Reduce batch slice size or downsample input dataset.

---

### 02xx — Dataset & Ingestion

- **`ERR_0201_PARSER_MALFORMED_CSV`** (`ERROR`)
  - _Title:_ Malformed CSV File Format
  - _Description:_ Unclosed quotes, inconsistent column counts, or unescaped delimiter encountered.
  - _Recovery:_ Verify CSV delimiter and ensure text fields containing commas are enclosed in quotes.

- **`ERR_0202_EMPTY_DATASET`** (`WARNING`)
  - _Title:_ Dataset Contains Zero Rows
  - _Description:_ Parsed data input contains a valid schema but zero rows of data.
  - _Recovery:_ Load a non-empty dataset or verify stream ingestion status.

---

### 03xx — Moneta solver and recommender (compatibility codes)

- **`ERR_0301_NO_VALID_DRACO_SPEC`** (`WARNING`, retained compatibility identifier)
  - _Title:_ No valid Moneta representation satisfies constraints
  - _Description:_ Hard constraints excluded all 3,168 candidate specifications for the active dataset.
  - _Recovery:_ Relax topology constraints or switch to fallback 3D grid layout.

---

### 04xx — Spatial Runtime & Graphics

- **`ERR_0401_WEBGL_CONTEXT_LOST`** (`CRITICAL`)
  - _Title:_ WebGL GPU Context Lost
  - _Description:_ GPU hardware reset or out-of-memory error triggered context loss.
  - _Recovery:_ Reload page or decrease dataset LOD rendering scale.

- **`ERR_0402_FRAME_BUDGET_BREACH`** (`WARNING`)
  - _Title:_ Spatial Frame-Time Budget Exceeded
  - _Description:_ Rendering frame time exceeded 13.88ms threshold on Quest standalone headset.
  - _Recovery:_ Adaptive governor automatically reduces instance density and point sizes.

---

### 05xx — Interaction & Input

- **`ERR_0501_HAND_TRACKING_LOST`** (`WARNING`)
  - _Title:_ Hand Tracking Lost
  - _Description:_ Headset camera lost visibility of active hand joints.
  - _Recovery:_ Return hands to headset field-of-view or switch to VR controllers.

---

### 06xx — Collaboration & Network

- **`ERR_0601_SIGNALLING_AUTH_FAILED`** (`ERROR`)
  - _Title:_ Signalling Server Authentication Denied
  - _Description:_ Provided room access token is invalid, expired, or unauthorized.
  - _Recovery:_ Verify `NEMOSYNE_SIGNAL_TOKEN` or obtain an updated participant token.

---

### 07xx — Session & Persistence

- **`ERR_0701_INDEXEDDB_UNAVAILABLE`** (`WARNING`)
  - _Title:_ IndexedDB Storage Inaccessible
  - _Description:_ Browser in private/incognito mode or local storage quota exhausted.
  - _Recovery:_ Session runs in in-memory mode; export manual JSON story files to save work.

---

### 08xx — Research Harness

- **`ERR_0801_FROZEN_TREATMENT_MUTATION_BLOCKED`** (`ERROR`)
  - _Title:_ Attempted Mutation of Frozen Study Treatment Variable
  - _Description:_ Action blocked because active study protocol locks representations during trial.
  - _Recovery:_ Complete active trial before modifying layout or assistant settings.
