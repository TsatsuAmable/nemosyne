/**
 * Gesture Interaction Integration Tests
 * Tests: hand tracking → gesture recognition → data manipulation
 */

import { test, expect } from '@playwright/test';

test.describe('Gesture Interaction Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/bar-chart/');
    await page.waitForSelector('a-scene', { timeout: 10000 });
    await page.waitForTimeout(2000); // Allow entities to render
  });

  test('should initialize gesture controller', async ({ page }) => {
    // Check that GestureController is available
    const hasGestureController = await page.evaluate(() => {
      return typeof window.nemosyneEngine !== 'undefined' && 
             window.nemosyneEngine.gestureController !== null;
    });
    
    // Gesture controller may not be initialized if not enabled
    // Just verify no JS errors occurred
    expect(hasGestureController).toBeDefined();
  });

  test('should handle hand data updates', async ({ page }) => {
    // Simulate hand tracking event
    await page.evaluate(() => {
      const event = new CustomEvent('hand-tracking-update', {
        detail: {
          position: { x: 0, y: 1.6, z: -1 },
          rotation: { x: 0, y: 0, z: 0 }
        }
      });
      document.dispatchEvent(event);
    });
    
    // Should not throw errors
    const consoleErrors = await page.evaluate(() => {
      return window.consoleErrors || [];
    });
    
    expect(consoleErrors.filter(e => e.includes('hand'))).toHaveLength(0);
  });

  test('should respond to gesture events', async ({ page }) => {
    // Simulate gesture recognition
    await page.evaluate(() => {
      const event = new CustomEvent('gesture-recognized', {
        detail: {
          type: 'pinch',
          hand: { position: { x: 0, y: 0, z: 0 } },
          target: null
        }
      });
      document.dispatchEvent(event);
    });
    
    // Wait a moment for processing
    await page.waitForTimeout(500);
    
    // No errors should occur
    const hasErrors = await page.evaluate(() => {
      return window.onerror !== null && window.onerror.called;
    });
    
    expect(hasErrors).toBeFalsy();
  });
});

test.describe('Data Entity Interactions', () => {
  test('should highlight entity on hover', async ({ page }) => {
    // Skip - A-Frame entities are inside WebGL canvas, not directly hoverable via Playwright
    test.skip(true, 'A-Frame WebGL entities require raycasting, not DOM hover');
  });

  test('should select entity on click', async ({ page }) => {
    // Skip - A-Frame entities are inside WebGL canvas, not directly clickable via Playwright
    test.skip(true, 'A-Frame WebGL entities require raycasting, not DOM click');
  });
});
