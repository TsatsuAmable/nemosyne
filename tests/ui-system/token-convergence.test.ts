import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COLOR_TOKENS,
  CSS_VARIABLES,
  TOKEN_SET_VERSION,
  injectCssVariables,
} from '../../src/vr/ui-system/tokens.ts';

const repoRoot = path.resolve(__dirname, '../..');
const srcDir = path.join(repoRoot, 'src');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function walkTypeScript(dir: string, visit: (file: string, source: string) => void): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTypeScript(fullPath, visit);
    } else if (entry.name.endsWith('.ts')) {
      visit(fullPath, fs.readFileSync(fullPath, 'utf8'));
    }
  }
}

describe('B-V1 canonical token authority', () => {
  it('exports a versioned semantic token set and DOM variables', () => {
    expect(TOKEN_SET_VERSION).toMatch(/^\d{8}\.\d+$/);
    expect(COLOR_TOKENS.interaction.focus).toBeDefined();
    expect(COLOR_TOKENS.epistemic.uncertain).toBeDefined();
    expect(COLOR_TOKENS.danger.destructive).toBeDefined();
    expect(CSS_VARIABLES['--nms-color-interaction-focus']).toBe('#59d6ff');
    expect(CSS_VARIABLES['--nms-color-surface-border']).toBe('#263544');

    const root = document.createElement('div');
    injectCssVariables(root);
    expect(root.style.getPropertyValue('--nms-color-void')).toBe('#05070b');
    expect(root.style.getPropertyValue('--nms-color-interaction-focus')).toBe('#59d6ff');
  });

  it('has no production imports from the deprecated palette alias', () => {
    const violations: string[] = [];
    const importPalette = /from\s+['"][^'"]*palette(?:\.ts)?['"]/;
    walkTypeScript(srcDir, (file, source) => {
      if (file.endsWith(`${path.sep}vr${path.sep}palette.ts`)) return;
      if (importPalette.test(source)) violations.push(path.relative(srcDir, file));
    });
    expect(violations).toEqual([]);
  });

  it('does not track machine-local dependency or generated-WASM paths', () => {
    const tracked = execFileSync(
      'git',
      ['ls-files', '--stage', 'node_modules', 'wasm/pkg'],
      { cwd: repoRoot, encoding: 'utf8' }
    ).trim();
    expect(tracked).toBe('');
  });
});

describe('B-V1 functional convergence', () => {
  it('retains the hidden advanced VRMenu until curated live-source selection has a replacement', () => {
    const menu = read('src/vr/ui/VRMenu.ts');
    const manager = read('src/vr/coordinators/WorldUIManager.ts');
    expect(menu).toContain('OPEN_DATA_SOURCES');
    expect(menu).toContain('onSelectLiveSource?.(btn.source.key)');
    expect(manager).toContain('new VRMenu');
    expect(manager).toContain('onSelectLiveSource: callbacks.onSelectLiveSource');
    expect(manager).toContain('this.vrMenu.hide()');
  });

  it('removes decorative SpatialAssetRegistry plumbing without deleting HandWheel behavior', () => {
    expect(fs.existsSync(path.join(repoRoot, 'src/vr/ui/SpatialAssetRegistry.ts'))).toBe(false);
    const handWheel = read('src/vr/ui/HandWheelMenu.ts');
    expect(handWheel).not.toContain('SpatialAssetRegistry');
    expect(handWheel).toContain('COLOR_TOKENS.interaction.focus');
    expect(handWheel).not.toContain('0x00ffcc');
    expect(handWheel).not.toContain('0xff00cc');
  });

  it('migrates the previously escaping Vault and Recommendation surfaces', () => {
    const vault = read('src/vr/ui/VaultPanel.ts');
    const recommendation = read('src/vr/ui/RecommendationPanel.ts');
    expect(vault).toContain("from '../ui-system/tokens.ts'");
    expect(vault).not.toContain("from '../palette.ts'");
    expect(vault).not.toContain('#00ffcc');
    expect(vault).not.toContain('#ff5577');
    expect(recommendation).toContain("from '../ui-system/tokens.ts'");
    expect(recommendation).not.toContain('#00ffff');
    expect(recommendation).not.toContain('#00ff66');
  });
});

describe('B-V1 atmosphere and DOM cleanup', () => {
  it('keeps the world calm by default', () => {
    const theme = read('src/vr/WorldTheme.ts');
    const datum = read('src/vr/artifacts/DatumPlane.ts');
    expect(theme).not.toContain('_createParticles');
    expect(theme).not.toContain('this.particles');
    expect(theme).not.toContain('setParticleColor');
    expect(datum).not.toContain('Math.sin');
    expect(datum).toContain('COLOR_TOKENS.surface.border');
    expect(datum).toContain('COLOR_TOKENS.space.void');
  });

  it('uses canonical CSS variables on the DOM terminal', () => {
    const html = read('index.html');
    expect(html).toContain('--nms-color-void');
    expect(html).toContain('--nms-color-interaction-focus');
    expect(html).toContain('--nms-color-surface-border');
    expect(html).not.toContain('#00ffcc');
    expect(html).not.toContain('#ff77aa');
  });
});
