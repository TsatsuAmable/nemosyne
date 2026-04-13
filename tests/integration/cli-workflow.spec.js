/**
 * Integration tests for CLI-generated projects
 * Tests: CLI scaffolding → build → runtime
 */

import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

test.describe('CLI Workflow', () => {
  const testDir = join(tmpdir(), 'nemosyne-cli-test-' + Date.now());

  test.beforeAll(() => {
    // Create test directory using CLI
    if (!existsSync(testDir)) {
      execSync(`node bin/nemosyne-cli.js init ${testDir} --template basic`, {
        cwd: process.cwd(),
        stdio: 'pipe'
      });
    }
  });

  test.afterAll(() => {
    // Cleanup test directory
    try {
      execSync(`rm -rf ${testDir}`);
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  test('CLI should generate project files', () => {
    expect(existsSync(join(testDir, 'index.html'))).toBe(true);
    expect(existsSync(join(testDir, 'package.json'))).toBe(true);
    // src directory not created in basic template
  });

  test('generated HTML should be valid', () => {
    const html = execSync(`cat ${join(testDir, 'index.html')}`, { encoding: 'utf8' });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('a-scene');
    expect(html).toContain('nemosyne');
  });
});
