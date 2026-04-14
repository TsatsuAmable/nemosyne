/**
 * @jest-environment node
 * Integration tests for Nemosyne CLI
 * Tests that generated projects actually work
 */

import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_PATH = path.resolve(__dirname, '../../bin/nemosyne-cli.js');
const TEMP_DIR = path.resolve(__dirname, '../../.tmp-cli-integration');

test.describe('Nemosyne CLI Integration', () => {
  let server;
  let serverPort;

  test.beforeAll(() => {
    // Clean and create temp directory
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true });
    }
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  });

  test.afterAll(() => {
    // Cleanup
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true });
    }
    if (server) {
      server.close();
    }
  });

  const createProject = (name, template = 'basic') => {
    const output = execSync(`node ${CLI_PATH} init ${name} -t ${template}`, {
      encoding: 'utf-8',
      cwd: TEMP_DIR
    });
    return { path: path.join(TEMP_DIR, name), output };
  };

  const startServer = (projectPath, port) => {
    return new Promise((resolve, reject) => {
      server = http.createServer((req, res) => {
        let filePath = path.join(projectPath, req.url === '/' ? 'index.html' : req.url);
        try {
          const content = fs.readFileSync(filePath);
          const ext = path.extname(filePath);
          const contentType = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.json': 'application/json'
          }[ext] || 'text/plain';
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content);
        } catch {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      server.listen(port, '127.0.0.1', () => {
        serverPort = port;
        resolve();
      });
    });
  };

  test('CLI creates valid basic project', () => {
    const project = createProject('basic-test', 'basic');

    expect(fs.existsSync(project.path)).toBe(true);
    expect(fs.existsSync(path.join(project.path, 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(project.path, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(project.path, 'data.json'))).toBe(true);
    expect(fs.existsSync(path.join(project.path, 'README.md'))).toBe(true);
  });

  test('CLI creates valid network project', () => {
    const project = createProject('network-test', 'network');

    const indexPath = path.join(project.path, 'index.html');
    const content = fs.readFileSync(indexPath, 'utf-8');

    expect(content).toContain('Network Graph');
    expect(content).toContain('nemosyne-artefact-v2');
  });

  test('CLI creates valid timeline project', () => {
    const project = createProject('timeline-test', 'timeline');

    const indexPath = path.join(project.path, 'index.html');
    const content = fs.readFileSync(indexPath, 'utf-8');

    expect(content).toContain('Timeline');
    expect(content).toContain('layout: spiral');
  });

  test('Generated project uses correct CDN path', () => {
    const project = createProject('cdn-test');

    const indexPath = path.join(project.path, 'index.html');
    const content = fs.readFileSync(indexPath, 'utf-8');

    expect(content).toContain('unpkg.com/nemosyne');
    expect(content).toContain('nemosyne.iife.js');
  });

  test('Generated project loads without 404s', async ({ page }) => {
    const project = createProject('load-test');

    const failedRequests = [];
    page.on('response', response => {
      if (response.status() >= 400) {
        failedRequests.push({ url: response.url(), status: response.status() });
      }
    });

    await startServer(project.path, 8765);
    await page.goto('http://127.0.0.1:8765/');
    await page.waitForTimeout(3000);

    expect(failedRequests).toHaveLength(0);
  });

  test('Generated project has no critical JS errors', async ({ page }) => {
    const project = createProject('error-test');

    const errors = [];
    page.on('pageerror', err => {
      if (!err.message.includes('favicon') && !err.message.includes('sourceMappingURL')) {
        errors.push(err.message);
      }
    });

    await startServer(project.path, 8766);
    await page.goto('http://127.0.0.1:8766/');
    await page.waitForTimeout(3000);

    expect(errors).toHaveLength(0);
  });

  test('Generated project contains nemosyne component', async ({ page }) => {
    const project = createProject('component-test');

    await startServer(project.path, 8767);
    await page.goto('http://127.0.0.1:8767/');
    await page.waitForTimeout(3000);

    const hasComponent = await page.evaluate(() => {
      return document.querySelector('[nemosyne-artefact-v2]') !== null;
    });

    expect(hasComponent).toBe(true);
  });

  test('CLI validate detects valid project', () => {
    const project = createProject('valid-project');

    const output = execSync(`node ${CLI_PATH} validate valid-project`, {
      encoding: 'utf-8',
      cwd: TEMP_DIR
    });

    expect(output).toContain('Project structure is valid');
  });

  test('CLI validate detects missing index.html', () => {
    fs.mkdirSync(path.join(TEMP_DIR, 'invalid-project'), { recursive: true });

    try {
      execSync(`node ${CLI_PATH} validate invalid-project`, {
        encoding: 'utf-8',
        cwd: TEMP_DIR
      });
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error.stdout).toContain('Missing required file');
    }
  });

  test('CLI validate detects wrong bundle', () => {
    const project = createProject('warn-project');

    // Replace iife.js with min.js
    const indexPath = path.join(project.path, 'index.html');
    let content = fs.readFileSync(indexPath, 'utf-8');
    content = content.replace('nemosyne.iife.js', 'nemosyne.min.js');
    fs.writeFileSync(indexPath, content);

    const output = execSync(`node ${CLI_PATH} validate warn-project`, {
      encoding: 'utf-8',
      cwd: TEMP_DIR
    });

    expect(output).toContain('stub');
    expect(output).toContain('iife.js');
  });

  test('Generated project has valid data.json', () => {
    const project = createProject('data-test');

    const dataPath = path.join(project.path, 'data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    expect(data).toHaveProperty('records');
    expect(Array.isArray(data.records)).toBe(true);
    expect(data.records.length).toBeGreaterThan(0);
  });

  test('CLI build creates dist directory', () => {
    const project = createProject('build-test');

    execSync(`node ${CLI_PATH} build build-test -o dist`, {
      encoding: 'utf-8',
      cwd: TEMP_DIR
    });

    const distPath = path.join(project.path, 'dist');
    expect(fs.existsSync(distPath)).toBe(true);
    expect(fs.existsSync(path.join(distPath, 'index.html'))).toBe(true);
  });
});
