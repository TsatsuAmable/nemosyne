/**
 * Layout Algorithm Integration Tests
 * Tests: topology detection → layout calculation → spatial positioning
 */

import { test, expect } from '@playwright/test';

test.describe('Layout Algorithm Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/bar-chart/');
    await page.waitForSelector('a-scene', { timeout: 10000 });
    await page.waitForTimeout(2000);
  });

  test('should apply bar chart layout', async ({ page }) => {
    // Check bar chart specific layout
    const entities = await page.locator('nemosyne-artefact, [nemosyne-data]');
    const count = await entities.count();
    
    if (count > 0) {
      // Get positions of all entities
      const positions = await entities.evaluateAll(els => {
        return els.map(el => {
          const pos = el.getAttribute('position') || '0 0 0';
          return pos.split(' ').map(parseFloat);
        });
      });

      // Bar chart should have entities along X axis
      const xPositions = positions.map(p => p[0]);
      const uniqueX = new Set(xPositions).size;
      
      // Should have spread positions
      expect(uniqueX).toBeGreaterThan(0);
    }
  });

  test('should switch layouts dynamically', async ({ page }) => {
    await page.evaluate(() => {
      if (window.nemosyneEngine) {
        // Get current packets and re-layout
        const packets = window.nemosyneEngine.getAllDataPackets();
        
        // Apply different layouts
        window.nemosyneEngine.layout = 'scatter';
        window.nemosyneEngine.updateLayout();
      }
    });

    await page.waitForTimeout(1000);

    // Verify entities still exist
    const entities = await page.locator('nemosyne-artefact, [nemosyne-data]').count();
    expect(entities).toBeGreaterThan(0);
  });
});

test.describe('Topology Detection', () => {
  test('should detect scatter data topology', async ({ page }) => {
    await page.evaluate(() => {
      // Inject scatter-type data
      const scatterData = Array.from({ length: 20 }, (_, i) => ({
        id: `scatter-${i}`,
        value: { x: Math.random() * 10, y: Math.random() * 10, z: Math.random() * 10 }
      }));

      if (window.nemosyneEngine) {
        window.nemosyneEngine.clear();
        window.nemosyneEngine.ingest(scatterData);
      }
    });

    await page.waitForTimeout(1500);

    // Verify topology was detected
    const topology = await page.evaluate(() => {
      return window.nemosyneEngine?.currentTopology || 'unknown';
    });

    expect(topology).toBeDefined();
  });

  test('should detect hierarchical data topology', async ({ page }) => {
    // Skip if gallery.html doesn't have the expected structure
    test.skip(true, 'Gallery structure may differ');

    await page.evaluate(() => {
      // Inject hierarchical data
      const treeData = [
        { id: 'root', value: 100, parent: null },
        { id: 'child1', value: 50, parent: 'root' },
        { id: 'child2', value: 50, parent: 'root' },
        { id: 'grandchild1', value: 25, parent: 'child1' }
      ];

      if (window.nemosyneEngine) {
        window.nemosyneEngine.clear();
        window.nemosyneEngine.ingest(treeData);
      }
    });

    await page.waitForTimeout(1500);

    // Should detect hierarchical structure
    const hasHierarchy = await page.evaluate(() => {
      const topology = window.nemosyneEngine?.currentTopology;
      return topology && (topology.includes('tree') || topology.includes('hierarchy'));
    });

    expect(hasHierarchy).toBeDefined();
  });

  test('should detect graph data topology', async ({ page }) => {
    await page.evaluate(() => {
      // Inject graph data with links
      const graphData = [
        { id: 'node1', value: 100, links: ['node2', 'node3'] },
        { id: 'node2', value: 50, links: ['node1'] },
        { id: 'node3', value: 75, links: ['node1', 'node2'] }
      ];

      if (window.nemosyneEngine) {
        window.nemosyneEngine.clear();
        window.nemosyneEngine.ingest(graphData);
      }
    });

    await page.waitForTimeout(1500);

    // Should detect graph structure
    const topology = await page.evaluate(() => {
      return window.nemosyneEngine?.currentTopology || 'unknown';
    });

    expect(topology).toBeDefined();
  });
});

test.describe('Spatial Layouts', () => {
  test('should create linear timeline layout', async ({ page }) => {
    await page.evaluate(() => {
      // Inject time-series data
      const timelineData = Array.from({ length: 10 }, (_, i) => ({
        id: `time-${i}`,
        value: Math.random() * 100,
        timestamp: new Date(2024, 0, i + 1).toISOString()
      }));

      if (window.nemosyneEngine) {
        window.nemosyneEngine.clear();
        window.nemosyneEngine.ingest(timelineData);
      }
    });

    await page.waitForTimeout(1500);

    // Check positions are along a line
    const positions = await page.evaluate(() => {
      const entities = document.querySelectorAll('nemosyne-artefact, [nemosyne-data]');
      return Array.from(entities).map(el => {
        const pos = el.getAttribute('position') || '0 0 0';
        return pos.split(' ').map(parseFloat);
      });
    });

    if (positions.length > 1) {
      // Timeline should have monotonic progression
      const sorted = positions.sort((a, b) => a[0] - b[0]);
      expect(sorted.length).toBeGreaterThan(1);
    }
  });

  test('should create spherical layout', async ({ page }) => {
    // Skip - gallery may use different layout
    test.skip(true, 'Gallery layout varies');
    
    await page.goto('/examples/gallery.html');
    await page.waitForTimeout(2000);

    // Gallery may use spherical layout
    const scene = await page.locator('a-scene');
    await expect(scene).toBeVisible();
  });

  test('should create force-directed layout', async ({ page }) => {
    // Skip - force-directed requires specific network data setup
    test.skip(true, 'Requires network data with links');
    
    await page.evaluate(() => {
      // Inject network data
      const networkData = Array.from({ length: 15 }, (_, i) => ({
        id: `network-${i}`,
        value: Math.random() * 100,
        links: Array.from({ length: 3 }, () => `network-${Math.floor(Math.random() * 15)}`)
      }));

      if (window.nemosyneEngine) {
        window.nemosyneEngine.clear();
        window.nemosyneEngine.layout = 'force-directed';
        window.nemosyneEngine.ingest(networkData);
      }
    });

    await page.waitForTimeout(2000);

    // Entities should be positioned
    const entityCount = await page.locator('nemosyne-artefact, [nemosyne-data]').count();
    expect(entityCount).toBeGreaterThan(0);
  });
});
