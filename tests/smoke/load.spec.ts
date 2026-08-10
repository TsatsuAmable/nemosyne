import { test, expect } from '@playwright/test';

/**
 * Real-WebGL load smoke test.
 *
 * Runs against the production bundle (`npm run build`) served by `vite preview`
 * in real headless Chromium, which provides a real WebGL2 context via
 * SwiftShader. This is the counterpart to the jsdom render-loop tripwire
 * (F16): where F16 proves the render pipeline runs end-to-end through the real
 * three.js `render` path against a no-op mock, this test proves the *built app*
 * actually boots and renders a frame against a real GL implementation.
 *
 * Informational / non-required: this does not block the owner auto-merge flow.
 * See tests/smoke/README.md.
 */
test('boots and renders a frame in real headless Chromium (WebGL2 via SwiftShader)', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  // Track HTTP 404s by URL so we can assert the ONLY missing resources are the
  // expected ones (see assertion 7). Chromium also emits a console error-level
  // message ("Failed to load resource: … 404") for each — we filter that
  // browser-generated text out of the application console.error gate below so a
  // real console.error is not buried, while the URL check still catches a
  // genuinely broken asset.
  const notFoundUrls: string[] = [];
  page.on('response', (response) => {
    if (response.status() === 404) notFoundUrls.push(response.url());
  });

  // Application console.error gate. The expected WASM-unavailable path emits a
  // console.warn (not error) — see World.start()'s catch around
  // _initWasmRuntime — so it never reaches this listener. Browser-generated
  // resource-404 text is dropped here (the underlying URLs are asserted in
  // assertion 7); any remaining console.error is a regression.
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (text.startsWith('Failed to load resource: the server responded with a status of')) return;
    consoleErrors.push(text);
  });

  await page.goto('/');

  // (1) The renderer appended its <canvas> to the body (Engine constructor).
  await expect(page.locator('body canvas')).toBeVisible();

  // (2) A real WebGL2 context initialized — not just canvas presence. Return a
  //     plain object (host GL objects are not serializable across the Playwright
  //     boundary) carrying the real vendor/renderer/version strings, which also
  //     confirms SwiftShader is the GL backend.
  const glInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return null;
    const gl = canvas.getContext('webgl2');
    if (!gl) return null;
    return {
      isWebGL2: true,
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER),
      version: gl.getParameter(gl.VERSION),
    };
  });
  expect(glInfo, 'canvas.getContext("webgl2") returned a context').not.toBeNull();
  expect(glInfo?.isWebGL2).toBe(true);
  expect(typeof glInfo?.vendor).toBe('string');
  expect(glInfo?.version).toMatch(/WebGL 2\.0/);

  // (3) The VR button was created by NemosyneVRButton. On headless Chromium
  //     without navigator.xr it reads "VR NOT SUPPORTED" and is disabled —
  //     acceptable for a load smoke (we only assert it attached, not that VR
  //     is available).
  await expect(page.locator('#nemosyne-vr-button')).toBeAttached();

  // (4) Boot-done + frame-rendered. main.ts sets #telemetry to
  //     "ready — point and select to inspect" once world.start() resolves, but
  //     the animation loop's first tick overwrites it within a frame with the
  //     per-telemetry form written by World._updateTelemetry() on every tick:
  //       "<name>  |  POS: [...]  |  LAYOUT: <layout>  GEOM: <geom>  BEHAVIOR: <behavior>"
  //     That per-frame form is stable and persistent (rewritten each tick), so
  //     polling for "LAYOUT:" proves BOTH that world.start() resolved past init
  //     (boot completed) AND that the render loop ticked at least once through
  //     the real three.js pipeline (a frame rendered). The transient "ready"
  //     string is deliberately not asserted — it is visible for <1 frame.
  const telemetry = page.locator('#telemetry');
  await expect
    .poll(async () => (await telemetry.textContent()) ?? '', {
      timeout: 15_000,
      message: '#telemetry reached the per-frame form (boot + first render tick)',
    })
    .toContain('LAYOUT:');

  const telemetryText = (await telemetry.textContent()) ?? '';
  // The per-frame form always carries all three spec channels (with '-' when
  // no spec is resolved yet), so their presence confirms a complete tick.
  expect(telemetryText).toContain('GEOM:');
  expect(telemetryText).toContain('BEHAVIOR:');
  // No startup error marker surfaced (main.ts logStartupError / Engine tick
  // guard would write "ERROR: …" / "TICK ERROR: …" instead).
  expect(telemetryText.startsWith('ERROR:'), `telemetry was: ${telemetryText}`).toBe(false);
  expect(telemetryText.startsWith('TICK ERROR:'), `telemetry was: ${telemetryText}`).toBe(false);
  // Boot has progressed past the static "initializing…" placeholder.
  expect(telemetryText.trim()).not.toBe('initializing…');

  // (5) No uncaught exceptions during boot/render.
  expect(pageErrors, `uncaught page errors: ${pageErrors.join(' | ')}`).toEqual([]);

  // (6) No application console.error. The WASM-unavailable fallback is a
  //     console.warn (excluded by the type filter); browser resource-404 text
  //     is filtered above and asserted by URL next.
  expect(consoleErrors, `unexpected console.error: ${consoleErrors.join(' | ')}`).toEqual([]);

  // (7) The only 404s are resources intentionally absent in the smoke env:
  //       - /wasm/pkg/nemosyne_wasm.js — `npm run build` runs no wasm-pack, so
  //         RuntimeBridge's HEAD probe 404s and the app falls back to JS.
  //       - /__remote-logs — RemoteDebugStreamer POSTs to a Vite dev-only
  //         middleware (remoteLogsPlugin uses configureServer, not preview),
  //         which is absent under `vite preview`.
  //     Any other 404 is a broken asset / real regression.
  const expected404 = (url: string): boolean =>
    url.endsWith('/wasm/pkg/nemosyne_wasm.js') || url.endsWith('/__remote-logs');
  const unexpected404 = notFoundUrls.filter((url) => !expected404(url));
  expect(unexpected404, `unexpected 404 responses: ${unexpected404.join(' | ')}`).toEqual([]);
});