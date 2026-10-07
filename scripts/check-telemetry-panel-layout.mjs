// Run against a Vite server: node scripts/check-telemetry-panel-layout.mjs [base-url]
// Uses rendered UIKit geometry, not mocked layout or direct handler dispatch.
import { chromium } from 'playwright';
const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5175';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
await page.route(`${baseUrl}/`, (r) =>
  r.fulfill({ contentType: 'text/html', body: '<body style="margin:0"></body>' })
);
await page.goto(`${baseUrl}/`);
try {
  for (const scale of [1, 1.5]) {
    const result = await page.evaluate(async (scale) => {
      const [{ TelemetryPanel }, T, { PointerEventMachine }, { InteractableRegistry }] =
        await Promise.all([
          import('/src/vr/ui/TelemetryPanel.ts'),
          import('/node_modules/.vite/deps/three.js'),
          import('/src/vr/input/PointerEventMachine.ts'),
          import('/src/vr/input/InteractableRegistry.ts'),
        ]);
      const report = {
        enabled: true,
        timestamp: 1,
        session: { durationSeconds: 5, datasetName: 'Demo', datasetTopology: 'grid' },
        frames: {
          count: 10,
          dropped: 1,
          lastMs: 16,
          averageMs: 17,
          histogram: { under16: 2, under33: 7, under50: 1, under100: 0, over100: 0 },
        },
        operations: Object.fromEntries(Array.from({ length: 40 }, (_, i) => ['Operation ' + i, i])),
        gestures: {},
        errors: { count: 0, warnings: 0, unhandledRejections: 0, last: null },
      };
      const scene = new T.Scene(),
        anchor = new T.Group();
      scene.add(anchor);
      const camera = new T.PerspectiveCamera(65, 1, 0.01, 100);
      const renderer = new T.WebGLRenderer();
      renderer.setSize(900, 900);
      renderer.localClippingEnabled = true;
      document.body.replaceChildren(renderer.domElement);
      const panel = new TelemetryPanel(anchor, { telemetry: { getReport: () => report } });
      panel.position.set(0, 0, -1);
      panel.show();
      panel.applyAccessibility({ textScale: scale, highContrast: false });
      for (let i = 0; i < 30; i++) {
        await new Promise(requestAnimationFrame);
        panel.update(0.016);
        renderer.render(scene, camera);
      }
      const scroller = panel._scrollContent;
      scroller.updateWorldMatrix(true, false);
      const inv = panel.matrixWorld.clone().invert();
      panel._exportButton.updateWorldMatrix(true, false);
      const exportCornersInside = [-0.5, 0.5].every(
        (y) =>
          Math.abs(
            new T.Vector3(0, y, 0).applyMatrix4(panel._exportButton.matrixWorld).applyMatrix4(inv).y
          ) <= 0.5
      );
      let scrollChanged = false;
      let dragInfo;
      if (scroller) {
        const registry = new InteractableRegistry();
        registry.panels = [panel];
        const machine = new PointerEventMachine(registry);
        const origin = new T.Vector3();
        const gutterX = 0.5 - 5 / scroller.size.peek()[0];
        const direction = new T.Vector3(gutterX, 0.45, 0)
          .applyMatrix4(scroller.matrixWorld)
          .normalize();
        const pointer = { index: 0, getRay: (r) => r.set(origin, direction) };
        machine.press(pointer);
        dragInfo = {
          captured: machine.capturedPanel === panel,
          down: [...scroller.downPointerMap.values()].map((v) => ({ type: v.type })),
          size: scroller.size.peek(),
          direction: direction.toArray(),
        };
        direction
          .copy(new T.Vector3(gutterX, 0.15, 0).applyMatrix4(scroller.matrixWorld))
          .normalize();
        machine.move(pointer);
        scrollChanged = scroller.scrollPosition.peek()[1] > 0;
        machine.release(pointer);
        dragInfo.released = machine.capturedPanel === null && scroller.downPointerMap.size === 0;
        dragInfo.inRange =
          scroller.scrollPosition.peek()[1] <= scroller.maxScrollPosition.peek()[1];
        renderer.render(scene, camera);
      }
      globalThis.telemetryProbe = { panel, renderer };
      return {
        scale,
        dragInfo,
        scrollRegion: !!scroller,
        maxScroll: scroller?.maxScrollPosition.peek()[1],
        scrollChanged,
        exportInsideCard: exportCornersInside,
        contentHeight: panel._content.size.peek()[1],
      };
    }, scale);
    console.log(JSON.stringify(result));
    if (
      !result.scrollChanged ||
      !result.exportInsideCard ||
      !result.dragInfo?.captured ||
      !result.dragInfo.released ||
      !result.dragInfo.inRange ||
      !result.dragInfo.down.some((d) => d.type === 'scroll-bar')
    )
      throw new Error('Telemetry layout or scrollbar regression');
    await page.evaluate(() => {
      telemetryProbe.panel.dispose();
      telemetryProbe.renderer.dispose();
      telemetryProbe.renderer.forceContextLoss();
    });
  }
} finally {
  await browser.close();
}
