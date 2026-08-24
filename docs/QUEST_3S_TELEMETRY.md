# Meta Quest 3S Telemetry Collection

## Scope

The Quest qualification run collects bounded performance aggregates inside the real WebXR animation loop. It is intended to qualify physical Quest Browser behavior after the desktop and hosted Rust/JS boundary envelopes are green. It does not infer device readiness from desktop hardware.

Quest Browser does not expose headset temperature. The report therefore records `sustainedPerformance` as a frame-cadence/render-duration drift proxy and always sets `temperatureSensorAvailable: false`.

## Start a run

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

## Collected fields

The version 2 report contains:

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

The command rejects non-XR, wrong-device or incomplete version 2 Quest qualification reports. Valid runs are grouped by declared device, build, firmware, refresh rate and browser identity, then summarized for worst cadence, dropped frames, peak memory, sustained drift, visibility interruptions and actual LOD/reduction output.

## Qualification discipline

Collect at least three completed runs against the same build and firmware. Preserve the raw JSON reports with the analysis output. A run with missing JS heap remains useful for cadence, WASM memory and renderer evidence, but cannot support a JS-heap claim. A thermal claim is never permitted; only the explicitly labelled sustained-performance proxy may be reported.
