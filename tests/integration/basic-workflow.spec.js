/**
 * Integration tests for basic Nemosyne workflow
 * Tests: ingest → layout → render pipeline
 */

import { test, expect } from '@playwright/test';

test.describe('Basic Nemosyne Workflow', () => {
  test('should load a basic example', async ({ page }) => {
    // Load a simple example that doesn't require WebXR
    await page.goto('/examples/bar-chart/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check that the page loaded
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('should render a-scene element', async ({ page }) => {
    await page.goto('/examples/bar-chart/');
    
    // Wait for A-Frame scene to load
    await page.waitForSelector('a-scene', { timeout: 10000 });
    
    const scene = await page.locator('a-scene');
    await expect(scene).toBeVisible();
  });

  test('should render data entities', async ({ page }) => {
    await page.goto('/examples/bar-chart/');
    
    // Wait for scene and entities
    await page.waitForSelector('a-scene', { timeout: 10000 });
    
    // Wait for entities to be created (custom timeout for rendering)
    await page.waitForTimeout(2000);
    
    // Check for data entities (nemosyne-artefact or nemosyne-data)
    const entities = await page.locator('nemosyne-artefact, [nemosyne-data], [nemosyne-artefact-v2]').count();
    expect(entities).toBeGreaterThan(0);
  });
});

test.describe('Nemosyne Gallery Demo', () => {
  test('should load gallery page', async ({ page }) => {
    await page.goto('/examples/gallery.html');
    
    await page.waitForLoadState('networkidle');
    
    const title = await page.title();
    expect(title).toContain('Nemosyne');
  });

  test('should contain interactive elements', async ({ page }) => {
    await page.goto('/examples/gallery.html');
    
    // Wait for content
    await page.waitForTimeout(1000);
    
    // Gallery should have links or buttons
    const links = await page.locator('a').count();
    const buttons = await page.locator('button').count();
    
    expect(links + buttons).toBeGreaterThan(0);
  });
});
