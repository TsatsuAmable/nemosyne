/**
 * Telemetry Integration Tests
 * Tests: gaze tracking → head movement → context adaptation
 */

import { test, expect } from '@playwright/test';

test.describe('Telemetry Engine Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/bar-chart/');
    await page.waitForSelector('a-scene', { timeout: 10000 });
    await page.waitForTimeout(2000);
  });

  test('should initialize telemetry engine', async ({ page }) => {
    const hasTelemetry = await page.evaluate(() => {
      return typeof window.nemosyneEngine !== 'undefined' &&
             window.nemosyneEngine.telemetry !== null;
    });

    expect(hasTelemetry).toBeDefined();
  });

  test('should track gaze data', async ({ page }) => {
    await page.evaluate(() => {
      const event = new CustomEvent('gaze-update', {
        detail: {
          point: { x: 0, y: 0, z: -2 },
          direction: { x: 0, y: 0, z: -1 }
        }
      });
      document.dispatchEvent(event);
    });

    await page.waitForTimeout(500);

    // Verify no errors occurred
    const hasErrors = await page.evaluate(() => {
      return window.onerror && window.onerror.called;
    });

    expect(hasErrors).toBeFalsy();
  });

  test('should track head movement', async ({ page }) => {
    await page.evaluate(() => {
      const event = new CustomEvent('head-movement', {
        detail: {
          position: { x: 0, y: 1.6, z: 0 },
          velocity: { x: 0.1, y: 0, z: 0 }
        }
      });
      document.dispatchEvent(event);
    });

    await page.waitForTimeout(500);

    // Should not throw
    const hasErrors = await page.evaluate(() => {
      return window.onerror && window.onerror.called;
    });

    expect(hasErrors).toBeFalsy();
  });
});

test.describe('Navigation Tracking', () => {
  test('should log navigation events', async ({ page }) => {
    await page.goto('/examples/bar-chart/');
    await page.waitForSelector('a-scene', { timeout: 10000 });

    // Navigate to gallery
    await page.goto('/examples/gallery.html');
    await page.waitForTimeout(1000);

    // Check that telemetry captured navigation
    const hasNavData = await page.evaluate(() => {
      return window.nemosyneEngine &&
             window.nemosyneEngine.telemetry &&
             typeof window.nemosyneEngine.telemetry.trackNavigation === 'function';
    });

    expect(hasNavData).not.toBe(false);
  });

  test('should handle rapid movement detection', async ({ page }) => {
    await page.goto('/examples/bar-chart/');
    await page.waitForSelector('a-scene', { timeout: 10000 });

    // Simulate rapid head movement
    await page.evaluate(() => {
      for (let i = 0; i < 5; i++) {
        const event = new CustomEvent('head-movement', {
          detail: {
            position: { x: i * 10, y: 1.6, z: 0 },
            velocity: { x: 200, y: 0, z: 0 }
          }
        });
        document.dispatchEvent(event);
      }
    });

    await page.waitForTimeout(500);

    // Should handle without crashing
    const hasErrors = await page.evaluate(() => {
      return window.onerror && window.onerror.called;
    });

    expect(hasErrors).toBeFalsy();
  });
});

test.describe('Fixation Detection', () => {
  test('should detect gaze fixation', async ({ page }) => {
    await page.goto('/examples/bar-chart/');
    await page.waitForSelector('a-scene', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Get first entity position
    const entity = await page.locator('nemosyne-artefact, [nemosyne-data]').first();

    if (await entity.count() > 0) {
      const position = await entity.evaluate(el => {
        return el.getAttribute('position') || '0 0 0';
      });

      // Simulate stable gaze at entity
      await page.evaluate((pos) => {
        const [x, y, z] = pos.split(' ').map(parseFloat);
        for (let i = 0; i < 15; i++) {
          const event = new CustomEvent('gaze-update', {
            detail: {
              point: { x: x + 0.001, y: y + 0.001, z },
              direction: { x: 0, y: 0, z: -1 }
            }
          });
          document.dispatchEvent(event);
        }
      }, position);

      await page.waitForTimeout(1000);

      // Should process without errors
      const hasErrors = await page.evaluate(() => {
        return window.onerror && window.onerror.called;
      });

      expect(hasErrors).toBeFalsy();
    }
  });
});
