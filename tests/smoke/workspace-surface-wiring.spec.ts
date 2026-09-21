import { test, expect } from '@playwright/test';
import type { NemosyneUv0TestHandle } from '../../src/app/uv0TestHandle.ts';

test.skip(
  process.env.NEMOSYNE_UV0_EVIDENCE !== '1',
  'Workspace-surface production-browser falsifier requires the UV0 instrumented build'
);

async function handle(page: import('@playwright/test').Page): Promise<NemosyneUv0TestHandle> {
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            typeof (window as unknown as { __NEMOSYNE_UV0__?: unknown }).__NEMOSYNE_UV0__
        ),
      { timeout: 15_000 }
    )
    .toBe('object');
  return page.evaluateHandle(
    () =>
      (window as unknown as { __NEMOSYNE_UV0__?: NemosyneUv0TestHandle }).__NEMOSYNE_UV0__!
  ) as unknown as Promise<NemosyneUv0TestHandle>;
}

test.describe('workspace-surface production wiring', () => {
  test('production wheel panel actions open real reachable input-registered surfaces', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/?nemosyne-uv0=1');
    await expect(page.locator('#investigation-shell')).toBeVisible({ timeout: 15_000 });
    await handle(page);

    const cases = [
      ['DATA', 'data-sources', 'data-sources'],
      ['STUDY', 'coach', 'coach'],
      ['STUDY', 'timeline', 'timeline'],
      ['STUDY', 'guidance', 'guidance'],
      ['STUDY', 'vault', 'vault'],
      ['COLLABORATE', 'network-panel', 'network'],
      ['SYSTEM', 'settings', 'settings'],
      ['SYSTEM', 'operation-log', 'operation-log'],
      ['SYSTEM', 'console', 'vr-console'],
      ['SYSTEM', 'perf', 'performance'],
      ['SYSTEM', 'telemetry', 'telemetry'],
      ['GUIDE', 'what-can-i-do', 'capability-guide'],
      ['SUPERUSER', 'su-schema-mapping', 'schema-map'],
      ['SUPERUSER', 'su-gesture-confidence', 'gesture-confidence'],
    ] as const;

    for (const [categoryId, itemId, surfaceId] of cases) {
      const invoked = await page.evaluate(
        ({ categoryId, itemId }) => {
          const hook = (window as unknown as { __NEMOSYNE_UV0__?: NemosyneUv0TestHandle })
            .__NEMOSYNE_UV0__;
          return hook?.invokeWheelItem(categoryId, itemId) ?? false;
        },
        { categoryId, itemId }
      );
      expect(invoked, `${categoryId}/${itemId} exists on production wheel`).toBe(true);

      await expect
        .poll(
          () =>
            page.evaluate((surfaceId) => {
              const hook = (window as unknown as { __NEMOSYNE_UV0__?: NemosyneUv0TestHandle })
                .__NEMOSYNE_UV0__;
              return hook?.workspaceSurface(surfaceId) ?? null;
            }, surfaceId),
          { timeout: 10_000, message: `${surfaceId} opened through production wheel` }
        )
        .not.toBeNull();

      const probe = await page.evaluate((surfaceId) => {
        const hook = (window as unknown as { __NEMOSYNE_UV0__?: NemosyneUv0TestHandle })
          .__NEMOSYNE_UV0__;
        return hook?.workspaceSurface(surfaceId) ?? null;
      }, surfaceId);
      expect(probe).not.toBeNull();
      expect(probe!.visible, `${surfaceId} is visible`).toBe(true);
      expect(probe!.inputRegistered, `${surfaceId} is routed for input`).toBe(true);
      expect(probe!.distanceToViewer, `${surfaceId} remains reachable`).toBeGreaterThanOrEqual(0.35);
      expect(probe!.distanceToViewer, `${surfaceId} remains reachable`).toBeLessThanOrEqual(2.5);
      expect(probe!.viewDot, `${surfaceId} remains in the viewer hemisphere`).toBeGreaterThan(-0.05);

      await page.evaluate(
        ({ categoryId, itemId }) => {
          const hook = (window as unknown as { __NEMOSYNE_UV0__?: NemosyneUv0TestHandle })
            .__NEMOSYNE_UV0__;
          hook?.invokeWheelItem(categoryId, itemId);
        },
        { categoryId, itemId }
      );
    }
  });

  test('opening a stale behind-view surface recovers it into the governed view envelope', async ({ page }) => {
    await page.goto('/?nemosyne-uv0=1');
    await handle(page);

    const mutated = await page.evaluate(() => {
      const hook = (window as unknown as { __NEMOSYNE_UV0__?: NemosyneUv0TestHandle })
        .__NEMOSYNE_UV0__;
      return hook?.moveWorkspaceSurface('data-sources', [0, 0, 8]) ?? false;
    });
    expect(mutated).toBe(true);

    const invoked = await page.evaluate(() => {
      const hook = (window as unknown as { __NEMOSYNE_UV0__?: NemosyneUv0TestHandle })
        .__NEMOSYNE_UV0__;
      return hook?.invokeWheelItem('DATA', 'data-sources') ?? false;
    });
    expect(invoked).toBe(true);

    const probe = await page.evaluate(() => {
      const hook = (window as unknown as { __NEMOSYNE_UV0__?: NemosyneUv0TestHandle })
        .__NEMOSYNE_UV0__;
      return hook?.workspaceSurface('data-sources') ?? null;
    });
    expect(probe).not.toBeNull();
    expect(probe!.visible).toBe(true);
    expect(probe!.distanceToViewer).toBeLessThanOrEqual(2.5);
    expect(probe!.viewDot).toBeGreaterThan(0);
  });
});
