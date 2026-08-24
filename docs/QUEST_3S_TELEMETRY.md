# Meta Quest 3S Telemetry Collection

## Scope

The Quest qualification run collects bounded performance aggregates inside the real WebXR animation loop. It is intended to qualify physical Quest Browser behavior after the desktop and hosted Rust/JS boundary envelopes are green. It does not infer device readiness from desktop hardware.

Quest Browser does not expose headset temperature. The report therefore records `sustainedPerformance` as a frame-cadence/render-duration drift proxy and always sets `temperatureSensorAvailable: false`.

## Start the render and LOD run

1. Build the current Rust/WASM package with `npm run wasm:dev`.
2. Generate the local HTTPS certificates described in `AGENTS.md` if they are absent.
3. Start the LAN-reachable dev server with a build identifier:

   ```bash
   VITE_NEMOSYNE_BUILD_ID=<commit-sha> npm run dev
   ```

4. In Quest Browser, open the HTTPS LAN URL with an investigator run label and the headset firmware recorded from Settings:

   ```text
   https://<developer-host>:5173/?questRun=q3s-cold-01&questFirmware=<firmware-version>
   ```

5. Enter immersive VR, open the Load Test panel and select `QUEST 3S`.
6. Keep the session visible and follow the same posture, interaction and cooling protocol for every repeated run.

The declared Quest profile runs 1K and 8K baselines, 65K scale characterization, a five-minute 100K sustained-performance soak and a 250K stretch step. With settle intervals it takes approximately eight minutes.

## Start the 10M Rust boundary run

The separate `QUEST 10M` control measures the actual typed-column Rust/WASM boundary. It does not ask `World.loadDataset` to construct or render 10M JavaScript rows. Use the same HTTPS build, immersive session, build identifier, firmware declaration and run-label discipline as the render run, then select `QUEST 10M` in the Load Test panel.

The probe builds the fixed NTC1 synthetic fixture incrementally across XR frames before executing the synchronous boundary phases. It records the resulting frame gaps around the host copy, Rust ingest, canonical fingerprint, authoritative structure profile and cold/warm borrowed scans. The 10M fixture is approximately 320 MB before Rust ingestion and the desktop baseline retained more than 1 GB of WASM linear memory, so Quest Browser may reject the allocation or terminate the tab. That failure is evidence and must not be replaced with a smaller run labelled as 10M.

The probe requires an active immersive-XR session and a ready Rust/WASM kernel. It fails closed otherwise. `STOP` is honored between phases, but a synchronous Rust phase cannot be interrupted once it has started.

## Collected fields

The version 2 render/LOD report contains:

- investigator-declared device target, run label, firmware and build identity;
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

## Retrieve and analyze

On completion the headset posts the report to the same-origin development endpoint `/__loadtest-results`. The developer machine appends one JSON object per line to:

```text
logs/loadtest-results.jsonl
```

If the endpoint is unavailable, use `DOWNLOAD` in the Load Test panel and transfer the JSON file from the headset.

Analyze one JSON/JSONL file or a set of repeated files with:

```bash
npm run analyze:quest-telemetry -- logs/loadtest-results.jsonl
npm run analyze:quest-telemetry -- run-cold.json run-warm.json run-repeat.json
```

The command rejects non-XR, wrong-device or structurally incomplete render and boundary reports. Valid runs are grouped by declared device, build, firmware, refresh rate and browser identity. Render groups summarize cadence, dropped frames, peak memory, sustained drift, visibility interruptions and actual LOD/reduction output. Boundary groups separately summarize completion/failure phases, phase timings, peak/retained memory, maximum XR frame gap and row-free evidence integrity.

## Qualification discipline

Collect at least three completed render runs and three boundary attempts against the same build and firmware. Preserve successful, failed and aborted raw JSON reports with the analysis output. A run with missing JS heap remains useful for cadence, WASM memory and renderer evidence, but cannot support a JS-heap claim. A thermal claim is never permitted; only the explicitly labelled sustained-performance proxy may be reported. Do not promote the device or reopen P1 until the separately selected audit programme is complete.
