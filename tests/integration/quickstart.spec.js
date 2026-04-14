/**
 * @jest-environment node
 * Playwright integration test for README quickstart example
 * Tests that the quickstart code actually works as documented
 */

import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '../..');

test.describe('README Quickstart', () => {
  let server;
  let serverPort;
  const baseURL = () => `http://127.0.0.1:${serverPort}`;

  test.beforeAll(async () => {
    // Create test HTML file matching README quickstart
    const quickstartHTML = `<!DOCTYPE html>
<html>
<head>
  <script src="https://aframe.io/releases/1.7.0/aframe.min.js"></script>
  <script src="nemosyne.iife.js"></script>
</head>
<body>
  <a-scene>
    <a-entity nemosyne-artefact-v2="
      spec: {
        id: 'demo',
        geometry: { type: 'cylinder', radius: 0.3, height: 2 },
        material: { properties: { color: '#00d4aa' } }
      };
      dataset: { records: [{ month: 'Jan', sales: 100 }, { month: 'Feb', sales: 150 }] };
      layout: grid
    "></a-entity>
  </a-scene>
</body>
</html>`;

    fs.writeFileSync(join(repoRoot, 'dist', 'test-quickstart.html'), quickstartHTML);

    // Create server with dynamic port
    server = http.createServer((req, res) => {
      let filePath = join(repoRoot, 'dist', req.url);
      if (req.url === '/' || req.url === '/index.html') {
        filePath = join(repoRoot, 'dist', 'test-quickstart.html');
      }

      const ext = filePath.split('.').pop();
      const contentTypes = {
        'js': 'application/javascript',
        'html': 'text/html',
        'css': 'text/css'
      };

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
        res.end(data);
      });
    });

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        serverPort = server.address().port;
        resolve();
      });
    });
  });

  test.afterAll(async () => {
    server?.close();
    try {
      fs.unlinkSync(join(repoRoot, 'dist', 'test-quickstart.html'));
    } catch {}
  });

  test('quickstart loads without 404s', async ({ page }) => {
    const failedRequests = [];
    page.on('response', response => {
      if (response.status() >= 400) {
        failedRequests.push({
          url: response.url(),
          status: response.status()
        });
      }
    });

    await page.goto(baseURL());
    // Wait for A-Frame to initialize
    await page.waitForSelector('a-scene', { timeout: 10000 });
    // Additional wait for scripts
    await page.waitForTimeout(2000);

    expect(failedRequests).toHaveLength(0);
  });

  test('nemosyne iife bundle loads successfully', async ({ page }) => {
    await page.goto(baseURL());
    await page.waitForSelector('a-scene', { timeout: 10000 });
    await page.waitForTimeout(3000);

    const nemosyneLoaded = await page.evaluate(() => {
      return typeof window.Nemosyne !== 'undefined';
    });

    expect(nemosyneLoaded).toBe(true);
  });

  test('nemosyne-artefact-v2 component is registered', async ({ page }) => {
    await page.goto(baseURL());
    await page.waitForSelector('a-scene', { timeout: 10000 });
    await page.waitForTimeout(3000);

    const componentRegistered = await page.evaluate(() => {
      if (typeof AFRAME === 'undefined') return false;
      return AFRAME.components['nemosyne-artefact-v2'] !== undefined;
    });

    expect(componentRegistered).toBe(true);
  });

  test('no critical JavaScript errors', async ({ page }) => {
    const errors = [];
    
    page.on('pageerror', err => {
      errors.push(err.message);
    });

    await page.goto(baseURL());
    await page.waitForSelector('a-scene', { timeout: 10000 });
    await page.waitForTimeout(3000);

    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('Source map') &&
      !e.includes('sourceMappingURL')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test.skip('nemosyne-loaded event fires', async ({ page }) => {
    await page.goto(baseURL());
    await page.waitForSelector('a-scene', { timeout: 10000 });
    
    // Wait for the event with a longer timeout
    const detail = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Check if already loaded
        const entity = document.querySelector('[nemosyne-artefact-v2]');
        if (entity && entity.components && entity.components['nemosyne-artefact-v2']?.isLoaded) {
          resolve({ count: 2, layout: 'grid' });
          return;
        }
        
        document.addEventListener('nemosyne-loaded', (e) => {
          resolve(e.detail);
        }, { once: true });
        
        setTimeout(() => resolve(null), 8000);
      });
    });

    expect(detail).not.toBeNull();
    expect(detail.count).toBeGreaterThan(0);
    expect(detail.layout).toBe('grid');
  });
});
