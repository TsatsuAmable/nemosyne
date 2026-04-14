/**
 * Unit tests for Nemosyne CLI
 * Tests command parsing, file generation, and validation logic
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, rmSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_PATH = path.resolve(__dirname, '../../bin/nemosyne-cli.js');
const TEST_DIR = path.resolve(__dirname, '../../.tmp-cli-test');

describe('Nemosyne CLI', () => {
  const runCli = (args) => {
    try {
      const output = execSync(`node ${CLI_PATH} ${args}`, {
        encoding: 'utf-8',
        cwd: TEST_DIR,
        env: { ...process.env, FORCE_COLOR: '0' }
      });
      return { success: true, output, code: 0 };
    } catch (error) {
      // Capture both stdout and stderr
      const output = (error.stdout || '') + (error.stderr || '');
      return { success: false, output, code: error.status };
    }
  };

  beforeEach(() => {
    // Clean and create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('Command: --version', () => {
    it('should display version', () => {
      const result = runCli('--version');
      expect(result.success).toBe(true);
      expect(result.output).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('Command: --help', () => {
    it('should display help information', () => {
      const result = runCli('--help');
      expect(result.success).toBe(true);
      expect(result.output).toContain('Usage:');
      expect(result.output).toContain('Commands:');
      expect(result.output).toContain('init');
      expect(result.output).toContain('serve');
      expect(result.output).toContain('build');
      expect(result.output).toContain('validate');
      expect(result.output).toContain('template');
    });
  });

  describe('Command: init', () => {
    it('should create a basic project', () => {
      const result = runCli('init test-project');
      expect(result.success).toBe(true);
      expect(result.output).toContain('Creating Nemosyne Project');
      expect(result.output).toContain('test-project');

      // Verify files created
      const projectPath = path.join(TEST_DIR, 'test-project');
      expect(existsSync(projectPath)).toBe(true);
      expect(existsSync(path.join(projectPath, 'index.html'))).toBe(true);
      expect(existsSync(path.join(projectPath, 'package.json'))).toBe(true);
      expect(existsSync(path.join(projectPath, 'data.json'))).toBe(true);
      expect(existsSync(path.join(projectPath, 'README.md'))).toBe(true);
    });

    it('should create a network project with -t network', () => {
      const result = runCli('init network-project -t network');
      expect(result.success).toBe(true);

      const projectPath = path.join(TEST_DIR, 'network-project');
      expect(existsSync(projectPath)).toBe(true);

      // Check for network-specific content
      const indexHtml = execSync(`cat ${path.join(projectPath, 'index.html')}`, { encoding: 'utf-8' });
      expect(indexHtml).toContain('Network Graph');
    });

    it('should create a timeline project with -t timeline', () => {
      const result = runCli('init timeline-project -t timeline');
      expect(result.success).toBe(true);

      const projectPath = path.join(TEST_DIR, 'timeline-project');
      expect(existsSync(projectPath)).toBe(true);

      const indexHtml = execSync(`cat ${path.join(projectPath, 'index.html')}`, { encoding: 'utf-8' });
      expect(indexHtml).toContain('Timeline');
    });

    it('should fail if directory already exists', () => {
      // Create directory first
      mkdirSync(path.join(TEST_DIR, 'existing-project'));

      const result = runCli('init existing-project');
      expect(result.success).toBe(false);
      expect(result.output).toContain('already exists');
    });

    it('should overwrite with --force flag', () => {
      // Create directory first
      mkdirSync(path.join(TEST_DIR, 'force-project'));
      execSync('echo "old" > ' + path.join(TEST_DIR, 'force-project', 'old.txt'));

      const result = runCli('init force-project --force');
      expect(result.success).toBe(true);
      expect(result.output).toContain('Overwriting');

      // Should have new files
      const projectPath = path.join(TEST_DIR, 'force-project');
      expect(existsSync(path.join(projectPath, 'index.html'))).toBe(true);
    });

    it('should fail for unknown template', () => {
      const result = runCli('init bad-project -t nonexistent');
      expect(result.success).toBe(false);
      expect(result.output).toContain('Unknown template');
    });
  });

  describe('Command: template', () => {
    it('should list available templates', () => {
      const result = runCli('template');
      expect(result.success).toBe(true);
      expect(result.output).toContain('basic');
      expect(result.output).toContain('network');
      expect(result.output).toContain('timeline');
      expect(result.output).toContain('Basic Visualization');
      expect(result.output).toContain('Network Graph');
    });
  });

  describe('Command: validate', () => {
    it('should validate a valid project', () => {
      // Create a valid project first
      runCli('init valid-project');

      const result = runCli('validate valid-project');
      expect(result.success).toBe(true);
      expect(result.output).toContain('Project structure is valid');
    });

    it('should fail for missing index.html', () => {
      // Create empty directory
      mkdirSync(path.join(TEST_DIR, 'empty-project'));

      const result = runCli('validate empty-project');
      expect(result.success).toBe(false);
      expect(result.output).toContain('Missing required file');
    });

    it('should warn about min.js instead of iife.js', () => {
      runCli('init warn-project');

      // Replace iife.js with min.js
      const indexPath = path.join(TEST_DIR, 'warn-project', 'index.html');
      const content = execSync(`cat ${indexPath}`, { encoding: 'utf-8' });
      const badContent = content.replace('nemosyne.iife.js', 'nemosyne.min.js');
      execSync(`echo '${badContent.replace(/'/g, "'\''")}' > ${indexPath}`);

      const result = runCli('validate warn-project');
      expect(result.output).toContain('stub');
      expect(result.output).toContain('iife.js');
    });

    it('should detect invalid JSON in data.json', () => {
      runCli('init bad-json-project');

      // Corrupt the JSON
      const dataPath = path.join(TEST_DIR, 'bad-json-project', 'data.json');
      execSync(`echo 'not valid json' > ${dataPath}`);

      const result = runCli('validate bad-json-project');
      expect(result.success).toBe(false);
      expect(result.output).toContain('invalid JSON');
    });
  });

  describe('Generated project files', () => {
    it('should use correct nemosyne.iife.js in basic template', () => {
      runCli('init basic-check -t basic');

      const indexPath = path.join(TEST_DIR, 'basic-check', 'index.html');
      const content = execSync(`cat ${indexPath}`, { encoding: 'utf-8' });

      expect(content).toContain('unpkg.com/nemosyne');
      expect(content).toContain('nemosyne.iife.js');
      expect(content).not.toContain('nemosyne.min.js');
    });

    it('should have working npm scripts', () => {
      runCli('init script-check');

      const pkgPath = path.join(TEST_DIR, 'script-check', 'package.json');
      const pkg = JSON.parse(execSync(`cat ${pkgPath}`, { encoding: 'utf-8' }));

      expect(pkg.scripts.dev).toBe('nemosyne serve');
      expect(pkg.scripts.build).toBe('nemosyne build');
      expect(pkg.scripts.validate).toBe('nemosyne validate');
    });

    it('should include proper A-Frame and Nemosyne dependencies', () => {
      runCli('init deps-check');

      const pkgPath = path.join(TEST_DIR, 'deps-check', 'package.json');
      const pkg = JSON.parse(execSync(`cat ${pkgPath}`, { encoding: 'utf-8' }));

      expect(pkg.dependencies.nemosyne).toMatch(/^\^\d+\.\d+/);
      expect(pkg.dependencies.aframe).toMatch(/^\^\d+\.\d+/);
    });
  });
});
