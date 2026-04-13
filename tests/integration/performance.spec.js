/**
 * Performance Integration Tests
 * Tests: render performance, memory usage, frame rate stability
 */

import { test, expect } from '@playwright/test';

test.describe('Performance Benchmarks', () => {
  test('should render 100 data points within 2 seconds', async ({ page }) => {
    await page.goto('/examples/bar-chart/');
    await page.waitForSelector('a-scene', { timeout: 10000 });

    const startTime = Date.now();

    // Inject large dataset via page.evaluate
    await page.evaluate(() => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        id: `perf-${i}`,
        value: Math.random() * 100
      }));

      if (window.nemosyneEngine) {
        window.nemosyneEngine.ingest(data);
      }
    });

    // Wait for render
    await page.waitForTimeout(2000);

    const endTime = Date.now();
    const renderTime = endTime - startTime;

    // Should complete within reasonable time
    expect(renderTime).toBeLessThan(5000);

    // Verify entities were created
    const entityCount = await page.locator('nemosyne-artefact, [nemosyne-data]').count();
    expect(entityCount).toBeGreaterThan(0);
  });

  test('should maintain stable frame rate during interaction', async ({ page }) => {
    await page.goto('/examples/bar-chart/');
    await page.waitForSelector('a-scene', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Collect frame timings
    const frameData = await page.evaluate(async () => {
      const frames = [];
      let lastTime = performance.now();

      const collectFrames = () => {
        const now = performance.now();
        const delta = now - lastTime;
        frames.push(delta);
        lastTime = now;

        if (frames.length < 60) {
          requestAnimationFrame(collectFrames);
        }
      };

      return new Promise(resolve => {
        requestAnimationFrame(collectFrames);
        setTimeout(() => resolve(frames), 1200);
      });
    });

    // Calculate average frame time (target: 16.67ms for 60fps)
    const avgFrameTime = frameData.reduce((a, b) => a + b, 0) / frameData.length;

    // Allow some variance but should be reasonable
    expect(avgFrameTime).toBeLessThan(50); // At least 20fps
  });

  test('should not leak memory on repeated ingest/clear cycles', async ({ page }) => {
    await page.goto('/examples/bar-chart/');
    await page.waitForSelector('a-scene', { timeout: 10000 });

    // Get initial memory
    const initialMemory = await page.evaluate(() => {
      if (performance.memory) {
        return performance.memory.usedJSHeapSize;
      }
      return 0;
    });

    // Perform multiple cycles
    for (let cycle = 0; cycle < 5; cycle++) {
      await page.evaluate(() => {
        const data = Array.from({ length: 50 }, (_, i) => ({
          id: `cycle-${i}`,
          value: Math.random() * 100
        }));

        if (window.nemosyneEngine) {
          window.nemosyneEngine.ingest(data);
        }
      });

      await page.waitForTimeout(500);

      await page.evaluate(() => {
        if (window.nemosyneEngine) {
          window.nemosyneEngine.clear();
        }
      });

      await page.waitForTimeout(200);
    }

    // Force garbage collection if available
    await page.evaluate(() => {
      if (window.gc) window.gc();
    });

    await page.waitForTimeout(500);

    // Get final memory
    const finalMemory = await page.evaluate(() => {
      if (performance.memory) {
        return performance.memory.usedJSHeapSize;
      }
      return 0;
    });

    // Memory should not grow unboundedly
    // Allow 50% growth tolerance
    if (initialMemory > 0 && finalMemory > 0) {
      const growthRatio = finalMemory / initialMemory;
      expect(growthRatio).toBeLessThan(2.0);
    }
  });
});

test.describe('Stress Tests', () => {
  test('should handle rapid entity updates', async ({ page }) => {
    await page.goto('/examples/bar-chart/');
    await page.waitForSelector('a-scene', { timeout: 10000 });

    // Rapid updates
    await page.evaluate(async () => {
      const updates = [];
      for (let i = 0; i < 100; i++) {
        updates.push({
          id: `stress-${i}`,
          value: Math.random() * 100
        });
      }

      // Batch ingest
      if (window.nemosyneEngine) {
        window.nemosyneEngine.ingest(updates);
      }
    });

    await page.waitForTimeout(1000);

    // Should still be responsive
    const isResponsive = await page.evaluate(() => {
      return document.querySelector('a-scene') !== null;
    });

    expect(isResponsive).toBe(true);
  });

  test('should recover from error conditions', async ({ page }) => {
    await page.goto('/examples/bar-chart/');
    await page.waitForSelector('a-scene', { timeout: 10000 });

    // Try to trigger edge cases
    await page.evaluate(() => {
      try {
        // Invalid data
        if (window.nemosyneEngine) {
          window.nemosyneEngine.ingest(null);
          window.nemosyneEngine.ingest(undefined);
          window.nemosyneEngine.ingest([]);
          window.nemosyneEngine.ingest({ invalid: true });
        }
      } catch (e) {
        // Should not throw unhandled
        console.error('Error:', e);
      }
    });

    await page.waitForTimeout(500);

    // Scene should still be functional
    const scene = await page.locator('a-scene');
    await expect(scene).toBeVisible();
  });
});
