# Playwright load smoke

A single end-to-end smoke test that verifies the **production bundle** boots and
renders a frame in **real headless Chromium** (WebGL2 via SwiftShader). This is
the real-WebGL counterpart to the jsdom render-loop tripwire
(`tests/e2e/tier1_feature_coverage/f16_render_loop_gl_introspection.spec.ts`):

- **F16 (jsdom)** proves the render pipeline runs end-to-end through the *real*
  three.js `render` path against a no-op GL mock — fast, ms-scale, no browser.
- **This smoke (real Chromium)** proves the *built app* actually initializes a
  real WebGL2 context and ticks a frame against a real GL implementation —
  slow (~10–20s + browser download), but it is the only check that exercises
  real GL semantics.

## Run locally

One-time setup — download the Chromium binary Playwright drives:

```bash
npx playwright install chromium
```

Then run the smoke (it builds `dist/` and serves it via `vite preview` on
port 4173 automatically):

```bash
npm run test:smoke
```

To install the browser **and** system deps in one step (CI uses this):

```bash
npm run test:smoke:install
```

## What it asserts

1. The renderer appended a `<canvas>` to the body (`Engine` constructor).
2. `canvas.getContext('webgl2')` returns a **real** WebGL2 context (not just
   canvas presence) — with real vendor/renderer/version strings from SwiftShader.
3. The `#nemosyne-vr-button` was created by `NemosyneVRButton`. On headless
   Chromium without `navigator.xr` it reads "VR NOT SUPPORTED" and is disabled;
   we only assert it attached, not that VR is available.
4. `#telemetry` reaches the per-frame form (`… | LAYOUT: … GEOM: … BEHAVIOR: …`)
   written by `World._updateTelemetry()` on every animation tick. Its presence
   proves **both** that `world.start()` resolved past init (boot completed)
   **and** that the render loop ticked at least once through the real pipeline
   (a frame rendered). The transient `"ready — point and select to inspect"`
   string `main.ts` writes is visible for <1 frame and is deliberately not
   asserted.
5. No uncaught `pageerror` and no `console.error` during boot/render.

## WASM-unavailable whitelist

`npm run build` does **not** run `wasm-pack`, so `dist/` contains no WASM
binary. At boot, `World._initWasmRuntime()` HEAD-checks `/wasm/pkg/nemosyne_wasm.js`,
gets a 404, and throws — which `World.start()` catches and reports as:

```
[World] WASM runtime unavailable, using JS fallbacks: …
```

This is a **`console.warn`**, not a `console.error`, so the smoke's
`console.error` gate naturally excludes it — no whitelist entry is needed. The
app degrades gracefully to the JS data layer, which is what the smoke exercises.
If real-wasm-in-production is ever required, wiring `wasm-pack` into the build
is a separate task (not this one).

## CI

The `playwright-smoke` job in `.github/workflows/ci.yml` runs this smoke on
every PR (Node 20, ubuntu-latest). It is **informational / non-required**: it is
**not** in the GitHub branch ruleset (`id=20623327`) and cannot block the owner
auto-merge flow. Promote it to a required check separately, once it is stable.

## Why HTTP, not HTTPS

The webServer forces plain HTTP via `NEMOSYNE_FORCE_HTTP=1` (see
`vite.config.js` `httpsOptions`), so `vite preview` is HTTP in every
environment — headless Chromium needs no TLS, and CI has no dev certs. Local
dev certs in `certs/` (gitignored) would otherwise make `vite preview` HTTPS
and break the fixed `http://localhost:4173` baseURL.