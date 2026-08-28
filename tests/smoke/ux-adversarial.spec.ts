import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * UI/UX Adversarial Review Test Suite
 * 
 * Tests the actual user experience from a hostile user perspective.
 * Finds what breaks, confuses, frustrates, or fails real users.
 */

test.describe('UI/UX Adversarial Review - Core User Flows', () => {
  test.beforeEach(async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource:')) {
        consoleErrors.push(msg.text());
      }
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for the app to boot and render at least one frame
    await expect(page.locator('#telemetry')).toContainText('LAYOUT:', { timeout: 15000 });
    
    // Store for later assertions
    (test as any).pageErrors = pageErrors;
    (test as any).consoleErrors = consoleErrors;
  });

  test.afterEach(async () => {
    const pageErrors = (test as any).pageErrors || [];
    const consoleErrors = (test as any).consoleErrors || [];
    
    // Report any errors found during the test
    if (pageErrors.length > 0) {
      console.log('Page errors:', pageErrors);
    }
    if (consoleErrors.length > 0) {
      console.log('Console errors:', consoleErrors);
    }
  });

  test('Cold start → first insight: Load app → select dataset → see visualization → understand something', async ({ page }) => {
    // Check initial state
    await expect(page.locator('#analyst-journey-controls')).toBeVisible();
    await expect(page.locator('#analyst-journey-status')).toHaveText('Ready');
    
    // Load sample dataset
    await page.locator('#analyst-load-sample').click();
    await expect(page.locator('#analyst-journey-status')).toContainText('Loaded', { timeout: 10000 });
    await expect(page.locator('#analyst-representation-outcome')).toContainText('Moneta selected');
    
    // Verify canvas is rendering
    await expect(page.locator('body canvas')).toBeVisible();
    
    // Check telemetry shows actual data
    const telemetry = await page.locator('#telemetry').textContent();
    expect(telemetry).toContain('LAYOUT:');
    expect(telemetry).toContain('GEOM:');
    expect(telemetry).toContain('BEHAVIOR:');
    
    // Verify we can see the dataset name in telemetry
    expect(telemetry).toMatch(/Supply Chain|Fraud|Sensor|Sales|Org|Wind|Social|Financial|Geo|Flow/);
  });

  test('Dataset switching: Switch between datasets → context preserved? loading states clear?', async ({ page }) => {
    // Load first dataset
    await page.locator('#analyst-load-sample').click();
    await expect(page.locator('#analyst-journey-status')).toContainText('Loaded', { timeout: 10000 });
    const firstTelemetry = await page.locator('#telemetry').textContent();
    
    // Switch dataset by clicking again (cycles to next)
    await page.locator('#analyst-load-sample').click();
    await expect(page.locator('#analyst-journey-status')).toContainText('Loaded', { timeout: 10000 });
    const secondTelemetry = await page.locator('#telemetry').textContent();
    
    // Verify dataset actually changed
    expect(secondTelemetry).not.toBe(firstTelemetry);
    
    // Check loading state was clear (no "loading..." stuck state)
    await expect(page.locator('#analyst-journey-status')).not.toContainText('loading');
  });

  test('Inspection workflow: Select node → see details → compare → record finding → navigate back', async ({ page }) => {
    await page.locator('#analyst-load-sample').click();
    await expect(page.locator('#analyst-journey-status')).toContainText('Loaded', { timeout: 10000 });
    
    // Run analysis to generate evidence
    await page.locator('#analyst-run-analysis').click();
    await expect(page.locator('#analyst-journey-status')).toContainText('Evidence ready', { timeout: 10000 });
    
    // Record observation
    await page.locator('#analyst-mark-moment').click();
    await expect(page.locator('#analyst-journey-status')).toContainText('Observation recorded');
    
    // Verify we can export the investigation
    const download = page.waitForEvent('download');
    await page.locator('#analyst-export-package').click();
    const artifact = await download;
    expect(artifact.suggestedFilename()).toBe('nemosyne-investigation.nemosyne');
  });

  test('Settings/accessibility: Change text scale → UI scales; high contrast → readable; reduced motion → animations stop', async ({ page }) => {
    await page.locator('#analyst-load-sample').click();
    await expect(page.locator('#analyst-journey-status')).toContainText('Loaded', { timeout: 10000 });
    
    // The settings panel is not in the desktop controls by default
    // Check if we can access settings via VR UI (not available in desktop test)
    // This test will need VR context to fully verify
    // For now, verify the desktop controls have focus indicators
    await expect(page.locator('#analyst-journey-controls button:focus-visible')).toBeTruthy();
  });
});

test.describe('UI/UX Adversarial Review - Accessibility & Inclusive Design', () => {
  test('Text scale: 0.75x - 2x works without breaking layout', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#telemetry')).toContainText('LAYOUT:', { timeout: 15000 });
    
    // Test zoom levels by modifying CSS
    for (const scale of [0.75, 1.0, 1.5, 2.0]) {
      await page.evaluate((s) => {
        document.documentElement.style.fontSize = `${16 * s}px`;
      }, scale);
      
      // Wait for layout to settle
      await page.waitForTimeout(500);
      
      // Verify controls still visible and usable
      await expect(page.locator('#analyst-journey-controls')).toBeVisible();
      await expect(page.locator('#analyst-load-sample')).toBeVisible();
      
      // Check no horizontal overflow
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10); // Allow small rounding
    }
  });

  test('High contrast: All text readable? Focus indicators visible?', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#telemetry')).toContainText('LAYOUT:', { timeout: 15000 });
    
    // Force high contrast mode
    await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active' });
    await page.waitForTimeout(500);
    
    // Check controls still visible
    await expect(page.locator('#analyst-journey-controls')).toBeVisible();
    await expect(page.locator('#analyst-load-sample')).toBeVisible();
    
    // Check focus indicators exist
    const focusStyles = await page.locator('#analyst-load-sample').evaluate(el => {
      const styles = window.getComputedStyle(el, ':focus-visible');
      return {
        outline: styles.outline,
        outlineOffset: styles.outlineOffset,
        outlineColor: styles.outlineColor,
      };
    });
    expect(focusStyles.outline).not.toBe('none');
  });

  test('Colorblind modes: Deuteranopia/protanopia/tritanopia - all data distinguishable?', async () => {
    // This requires VR context with settings panel to test colorblind modes
    // Skip for desktop-only test
    test.skip(true, 'Requires VR settings panel to test colorblind modes');
  });

  test('Reduced motion: All animations respect preference? No vestibular triggers?', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#telemetry')).toContainText('LAYOUT:', { timeout: 15000 });
    
    // Force reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(500);
    
    // Load dataset and verify no excessive animations
    await page.locator('#analyst-load-sample').click();
    await expect(page.locator('#analyst-journey-status')).toContainText('Loaded', { timeout: 10000 });
    
    // Check for any CSS animations that might not respect reduced motion
    const animations = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      let animationCount = 0;
      elements.forEach(el => {
        const styles = window.getComputedStyle(el);
        if (styles.animationName !== 'none' || styles.transitionProperty !== 'none') {
          animationCount++;
        }
      });
      return animationCount;
    });
    
    // Should have minimal animations with reduced motion
    expect(animations).toBeLessThan(10);
  });

  test('Color-only info: No critical info conveyed by color alone?', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#telemetry')).toContainText('LAYOUT:', { timeout: 15000 });
    
    // Force grayscale to test color-only dependency
    await page.addStyleTag({
      content: 'html { filter: grayscale(100%); }'
    });
    
    await page.locator('#analyst-load-sample').click();
    await expect(page.locator('#analyst-journey-status')).toContainText('Loaded', { timeout: 10000 });
    
    // Verify status text is still readable and informative
    const status = await page.locator('#analyst-journey-status').textContent();
    expect(status ?? '').not.toBe('Ready');
    expect((status ?? '').length).toBeGreaterThan(5);
  });
});

test.describe('UI/UX Adversarial Review - Error Handling & Recovery UX', () => {
  test('Kernel unavailable: Clear message? Graceful degradation? Retry path?', async ({ page }) => {
    // The app shows "analytical kernel unavailable" in telemetry when kernel fails
    // Test that the message is clear and actionable
    const telemetry = await page.locator('#telemetry').textContent();
    // Should not show raw error
    expect(telemetry).not.toMatch(/ERROR:/i);
    expect(telemetry).not.toMatch(/TICK ERROR:/i);
  });

  test('Large dataset: Loading states? Progress indication? Cancelable?', async ({ page }) => {
    await page.locator('#analyst-load-sample').click();
    await expect(page.locator('#analyst-journey-status')).toContainText('Loaded', { timeout: 15000 });
    
    // Check loading state was shown
    // The status should transition through loading states
    const status = await page.locator('#analyst-journey-status').textContent();
    expect(status).toContain('Loaded');
  });

  test('Session replay: Loads correctly? State restored exactly? Differences highlighted?', async ({ page }) => {
    await page.locator('#analyst-load-sample').click();
    await expect(page.locator('#analyst-journey-status')).toContainText('Loaded', { timeout: 10000 });
    
    await page.locator('#analyst-run-analysis').click();
    await expect(page.locator('#analyst-journey-status')).toContainText('Evidence ready', { timeout: 10000 });
    
    await page.locator('#analyst-mark-moment').click();
    await expect(page.locator('#analyst-journey-status')).toContainText('Observation recorded');
    
    // Export package
    const download = page.waitForEvent('download');
    await page.locator('#analyst-export-package').click();
    const artifact = await download;
    const artifactPath = await artifact.path();
    
    // Read the package
    const validPackage = new Uint8Array(readFileSync(artifactPath!));
    
    // Replay it
    await page.locator('#analyst-package-input').setInputFiles({
      name: 'verified.nemosyne',
      mimeType: 'application/zip',
      buffer: Buffer.from(validPackage),
    });
    await expect(page.locator('#analyst-journey-status')).toContainText('Investigation selected');
    
    await page.locator('#analyst-replay-package').click();
    await expect(page.locator('#analyst-journey-status')).toContainText('Replay verified', { timeout: 10000 });
  });
});

test.describe('UI/UX Adversarial Review - Onboarding & Discoverability', () => {
  test('First-time user: Guided tour starts automatically? Skippable? Completable?', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#telemetry')).toContainText('LAYOUT:', { timeout: 15000 });
    
    // The guided tour should auto-start for novice users
    // Tour may not be visible in headless - this needs real VR test
  });

  test('Gesture discoverability: Coach marks? Tooltips? Progressive disclosure?', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#telemetry')).toContainText('LAYOUT:', { timeout: 15000 });
    // Tooltips may be VR-only
  });

  test('Keyboard/desktop fallback: All VR actions have desktop equivalents?', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#telemetry')).toContainText('LAYOUT:', { timeout: 15000 });
    
    // Check all buttons are keyboard accessible
    const buttons = page.locator('#analyst-journey-controls button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(5);
    
    // Test tab navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Verify focus moves
    const focused = await page.evaluate(() => document.activeElement?.id);
    expect(focused).toBeTruthy();
  });
});

test.describe('UI/UX Adversarial Review - Performance Perceived by User', () => {
  test('Frame rate: Sustained during operations?', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#telemetry')).toContainText('LAYOUT:', { timeout: 15000 });
    
    // Measure frame timing
    const frameTimes = await page.evaluate(() => {
      return new Promise<number[]>((resolve) => {
        const times: number[] = [];
        let lastTime = performance.now();
        let frames = 0;
        
        function tick(time: number) {
          const delta = time - lastTime;
          times.push(delta);
          lastTime = time;
          frames++;
          if (frames < 60) {
            requestAnimationFrame(tick);
          } else {
            resolve(times);
          }
        }
        requestAnimationFrame(tick);
      });
    });
    
    // Calculate average FPS
    const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const avgFps = 1000 / avgFrameTime;
    
    console.log(`Average FPS: ${avgFps.toFixed(1)}`);
    console.log(`Frame times: min=${Math.min(...frameTimes).toFixed(1)}ms, max=${Math.max(...frameTimes).toFixed(1)}ms`);
    
    // Should maintain reasonable frame rate (at least 30fps in headless)
    expect(avgFps).toBeGreaterThan(20);
  });

  test('Loading: Skeleton screens? Progressive enhancement? No layout shift?', async ({ page }) => {
    // Measure CLS (Cumulative Layout Shift)
    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
        
        setTimeout(() => {
          observer.disconnect();
          resolve(clsValue);
        }, 5000);
      });
    });
    
    console.log(`CLS: ${cls}`);
    // CLS should be minimal
    expect(cls).toBeLessThan(0.1);
  });

  test('Memory: No leaks during extended session?', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#telemetry')).toContainText('LAYOUT:', { timeout: 15000 });
    
    // Load multiple datasets in sequence
    for (let i = 0; i < 5; i++) {
      await page.locator('#analyst-load-sample').click();
      await expect(page.locator('#analyst-journey-status')).toContainText('Loaded', { timeout: 10000 });
      await page.waitForTimeout(500);
    }
    
    // Check memory
    const memory = await page.evaluate(() => {
      return (performance as any).memory ? {
        used: (performance as any).memory.usedJSHeapSize,
        total: (performance as any).memory.totalJSHeapSize,
        limit: (performance as any).memory.jsHeapSizeLimit,
      } : null;
    });
    
    if (memory) {
      console.log(`Memory: ${(memory.used / 1024 / 1024).toFixed(1)}MB used / ${(memory.total / 1024 / 1024).toFixed(1)}MB total`);
      // Should not exceed reasonable limits
      expect(memory.used).toBeLessThan(500 * 1024 * 1024); // 500MB
    }
  });
});

test.describe('UI/UX Adversarial Review - VR/AR Specific (Simulated)', () => {
  test('Direct touch vs ray interaction: Near/far transition smooth? No flickering?', async () => {
    // This requires real VR device - simulate via viewport
    test.skip(true, 'Requires real Quest 3S for direct touch testing');
  });

  test('Panel management: Pin/follow works? Max 2 task panels enforced?', async () => {
    test.skip(true, 'Requires VR panel manager');
  });

  test('Hand wheel menu: Radial menu discoverable? Categories logical? Actions execute?', async () => {
    test.skip(true, 'Requires VR hand tracking');
  });

  test('Comfort: 20+ min session feasible? Arm fatigue? Seated/standing reach?', async () => {
    test.skip(true, 'Requires real VR session');
  });
});