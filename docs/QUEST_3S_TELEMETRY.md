# Meta Quest 3S Telemetry Collection

## Scope

The Quest qualification run collects bounded performance aggregates inside the real WebXR animation loop. It is intended to qualify physical Quest Browser behavior after the desktop and hosted Rust/JS boundary envelopes are green. It does not infer device readiness from desktop hardware.

Quest Browser does not expose headset temperature. The report therefore records `sustainedPerformance` as a frame-cadence/render-duration drift proxy and always sets `temperatureSensorAvailable: false`.

The governed physical-validation path is the `dev:quest:*` launcher family. The launcher owns exact Git/build attribution, clean/dirty worktree state, validation mode, session identity and machine-captured ADB device identity. The headset UI projects that existing truth; it does not invent a second device or promotion authority.

## Start a governed render and LOD run

1. Generate the local HTTPS certificates described in `AGENTS.md` if they are absent.
2. Attach and authorize the target Quest through ADB. Governed physical evidence requires machine-captured device/build identity; manual declarations remain exploratory fallback only.
3. Start the governed performance lane:

   ```bash
   npm run dev:quest:perf
   ```

   The launcher resolves the exact Git HEAD, records worktree state, captures Quest model/build identity, creates `logs/validation/<session>/manifest.json`, builds the required Rust/WASM development kernel and starts the LAN-reachable Vite session with validation identity attached.

   The LAN development endpoints are not authenticated production services. Use this mode only on a trusted, controlled network for the duration of the headset run, never on public/untrusted Wi-Fi or an Internet-routed host, then stop the server when the run is complete.

4. In Quest Browser, open the HTTPS LAN URL printed by Vite. Do **not** hand-type run label, build SHA or firmware into the URL for governed evidence; those values come from the launcher/ADB validation manifest.
5. Enter immersive VR and open **Device Validation**. Confirm that the panel shows the expected session, build, Quest model/build, identity basis and evidence eligibility. Governed start remains locked until the same-origin evidence sink confirms the exact launcher-written manifest.
6. Select `ARM PERF`, review the workload/session identity, then select `CONFIRM PERF` within the confirmation window. The old one-click developer start path is not the governed start surface.
7. Keep the session visible and follow the same posture, interaction and cooling protocol for every repeated run.

The declared Quest profile runs 1K and 8K baselines, 65K scale characterization, a five-minute 100K sustained-performance soak and a 250K stretch step. With settle intervals it takes approximately eight minutes.

### Exploratory/manual fallback

For non-governed exploratory work, `npm run dev:lan` may still be used. Legacy `?questRun=` and `?questFirmware=` query parameters are retained only as investigator-declared fallback metadata when no governed machine identity is active. They do not override ADB identity and do not make an exploratory run promotion-eligible.

## Start the 10M Rust boundary run

Use a separate governed session:

```bash
npm run dev:quest:10m
```

Open **Device Validation**, wait for exact manifest confirmation, select `ARM 10M`, review the large-allocation warning and then select `CONFIRM 10M` within the confirmation window.

The `QUEST 10M` path measures the actual typed-column Rust/WASM boundary. It does not ask `World.loadDataset` to construct or render 10M JavaScript rows. The probe builds the fixed NTC1 synthetic fixture incrementally across XR frames before executing the synchronous boundary phases. It records the resulting frame gaps around the host copy, Rust ingest, canonical fingerprint, authoritative structure profile and cold/warm borrowed scans.

The 10M fixture is approximately 320 MB before Rust ingestion and the desktop baseline retained more than 1 GB of WASM linear memory, so Quest Browser may reject the allocation or terminate the tab. That failure is evidence and must not be replaced with a smaller run labelled as 10M.

The probe requires an active immersive-XR session and a ready Rust/WASM kernel. It fails closed otherwise. `STOP` is honored between phases, but a synchronous Rust phase cannot be interrupted once it has started.

## Guided physical UX validation

Use:

```bash
npm run dev:quest:ux
```

After the evidence sink confirms the exact launcher manifest, **Device Validation** presents the QV5 governed task vocabulary. Record each task as `PASS`, `FAIL` or `NOT RUN`, explicitly select controller or hand modality, and record the bounded comfort outcome before submitting.

The runner records semantic outcome evidence only. It does not add raw pose histories, raw gesture trajectories, biometrics, dataset rows or unrestricted interaction traces. `NOT RUN` remains explicit and is never interpreted as a pass. The existence of the runner does not itself complete UX-03, P1-U9 or any other physical UX gate; the captured evidence remains subject to later adjudication and human interpretation.

Successful QV5 submission writes bounded artifacts under the active session:

```text
logs/validation/<session>/ux-results.json
logs/validation/<session>/comfort-observation.json
```

## Collected fields

The version 2 render/LOD report contains:

- governed session/build identity when launched through `dev:quest:*`, otherwise explicitly investigator-declared fallback identity;
- Quest Browser user agent, coarse CPU/device-memory hints when exposed, WebGL vendor/renderer, XR blend/interaction modes, framebuffer size and nominal/supported refresh rates;
- synchronous dataset/representation load latency per step;
- render-duration and XR frame-callback cadence p50/p95/p99, dropped rate and long-frame spikes;
- draw calls, triangles, points, lines, geometry and texture counts;
- JS heap start/peak/end when `performance.memory` is exposed;
- Rust/WASM linear-memory start/peak/end from the authoritative runtime;
- actual rendered instance count, source-to-rendered fraction, representation geometry/layout, minimum/final governor LOD scale and throttle count;
- first-versus-last sustained frame-time windows and their drift classification;
- XR visibility interruption count and duration.

The report explicitly states that raw frame traces, dataset rows and camera poses are absent. Missing browser metrics remain `null`; they are never replaced with synthetic values.

The version 1 `quest-3s-rust-boundary-10m` report additionally contains:

- the exact synthetic scenario shape and payload size;
- payload-build, host-copy, Rust-ingest, fingerprint, profile and borrowed-scan timings;
- JS heap when exposed and WASM memory before allocation, after ingest and after destroy;
- compact fingerprint/profile transfer sizes, authoritative profile row count, row-materialisation count and scan checksum parity;
- aggregate XR frame cadence and the maximum observed frame gap;
- completed, failed or aborted outcome with the exact failure phase;
- an explicit pre-P1 audit gate.

It always records `deviceQualifiedAt10m: false`. Successful measurement means only that the 10M evidence path was observed on the declared device/build; qualification is a later governed decision after repeated evidence and audits.

## Evidence delivery and confirmation

Governed completion POSTs the report to `/__loadtest-results` with the active validation session identity and requests a versioned receipt. The developer machine stores the report in:

```text
logs/validation/<session>/loadtest-results.jsonl
```

The headset does not treat a completed measurement as captured evidence until the sink returns a matching receipt. **Device Validation** displays the delivery state and receipt timestamp. `FLUSH` retries the last completed summary.

`DOWNLOAD` remains a fallback. A successful browser download request is shown as a fallback download request, not as proof that the JSON has been transferred off the headset or admitted to the governed session.

For ordinary non-governed development, the existing generic sink remains:

```text
logs/loadtest-results.jsonl
```

Analyze one JSON/JSONL file or a set of repeated files with:

```bash
npm run analyze:quest-telemetry -- logs/validation/<session>/loadtest-results.jsonl
npm run analyze:quest-telemetry -- run-cold.json run-warm.json run-repeat.json
```

The command rejects non-XR, wrong-device or structurally incomplete render and boundary reports. Valid runs are grouped by declared device, build, firmware, refresh rate and browser identity. Render groups summarize cadence, dropped frames, peak memory, sustained drift, visibility interruptions and actual LOD/reduction output. Boundary groups separately summarize completion/failure phases, phase timings, peak/retained memory, maximum XR frame gap and row-free evidence integrity.

## Qualification discipline

Collect at least three completed render runs and three boundary attempts against the same exact source build and machine-captured device build/fingerprint. Preserve successful, failed and aborted raw JSON reports with the analysis output.

The Device Validation progress counters are computed from evidence already written under validation sessions that match that exact build/device identity. The browser does not increment a local “3/3” counter merely because a run was started or completed on-screen.

A run with missing JS heap remains useful for cadence, WASM memory and renderer evidence, but cannot support a JS-heap claim. A thermal claim is never permitted; only the explicitly labelled sustained-performance proxy may be reported. Simulator/IWER evidence never substitutes for physical-device evidence, and Vite development evidence does not become clean-production qualification merely because it is well attributed.

Do not promote the device or reopen P1 until the separately selected audit/adjudication programme and any clean-production prerequisites are complete.
