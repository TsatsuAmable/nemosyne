import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COLOR_TOKENS,
  CSS_VARIABLES,
  TOKEN_SET_VERSION,
  contrastRatio,
  injectCssVariables,
} from '../../src/vr/ui-system/tokens.ts';
import { HIGH_CONTRAST_THEME } from '../../src/vr/ui-system/theme.ts';

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

describe('B-V1 executable contrast evidence (WCAG)', () => {
  it('measures WCAG 2.x luminance/contrast with boundary pins and clears AA on rendered token pairs', () => {
    // Math anchors: the ratio range is 1..21 and the thresholds are 4.5 / 3.0.
    expect(contrastRatio(0xffffff, 0x000000)).toBeCloseTo(21, 1);
    expect(contrastRatio(0x777777, 0xffffff)).toBeCloseTo(4.5, 1);
    expect(contrastRatio(0x595959, 0x000000)).toBeCloseTo(3.0, 1);
    expect(contrastRatio(0x111a24, 0xf2f6fa)).toBe(contrastRatio(0xf2f6fa, 0x111a24));

    // Rendered text token pairs clear AA normal text (4.5:1) on both panel surfaces.
    expect(contrastRatio(COLOR_TOKENS.text.primary, COLOR_TOKENS.surface.base)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(COLOR_TOKENS.text.primary, COLOR_TOKENS.surface.raised)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(COLOR_TOKENS.text.secondary, COLOR_TOKENS.surface.base)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(COLOR_TOKENS.text.secondary, COLOR_TOKENS.surface.raised)).toBeGreaterThanOrEqual(4.5);

    // High-contrast theme pairs clear AA on their deep-black background.
    expect(contrastRatio(HIGH_CONTRAST_THEME.textPrimary, HIGH_CONTRAST_THEME.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(HIGH_CONTRAST_THEME.textSecondary, HIGH_CONTRAST_THEME.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(HIGH_CONTRAST_THEME.textMuted, HIGH_CONTRAST_THEME.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(HIGH_CONTRAST_THEME.accentColor, HIGH_CONTRAST_THEME.backgroundColor)).toBeGreaterThanOrEqual(3.0);
    expect(contrastRatio(HIGH_CONTRAST_THEME.dangerColor, HIGH_CONTRAST_THEME.backgroundColor)).toBeGreaterThanOrEqual(3.0);

    // Interaction/epistemic accents are at least large-text/graphics scale (3:1) on panel surfaces.
    expect(contrastRatio(COLOR_TOKENS.interaction.focus, COLOR_TOKENS.surface.base)).toBeGreaterThanOrEqual(3.0);
    expect(contrastRatio(COLOR_TOKENS.danger.destructive, COLOR_TOKENS.surface.base)).toBeGreaterThanOrEqual(3.0);
    expect(contrastRatio(COLOR_TOKENS.epistemic.uncertain, COLOR_TOKENS.surface.base)).toBeGreaterThanOrEqual(3.0);
    expect(contrastRatio(COLOR_TOKENS.epistemic.contradiction, COLOR_TOKENS.surface.base)).toBeGreaterThanOrEqual(3.0);
  });
});

describe('B-V1 functional convergence', () => {
  it('retires VRMenu only after its unique data-source capabilities have a focused replacement', () => {
    const panel = read('src/vr/ui/DataSourcePanel.ts');
    const manager = read('src/vr/coordinators/WorldUIManager.ts');
    expect(fs.existsSync(path.join(repoRoot, 'src/vr/ui/VRMenu.ts'))).toBe(false);
    expect(panel).toContain('OPEN_DATA_SOURCES');
    expect(panel).toContain('xrDatasetLibraryBridge');
    expect(panel).toContain('allSampleDatasets');
    expect(manager).toContain('new DataSourcePanel');
    expect(manager).toContain('onSelectLiveSource: callbacks.onSelectLiveSource');
    expect(manager).toContain("this.workspaceSurfaces.registerPanel('data-sources', this.dataSourcePanel)");
    expect(manager).toContain("this.workspaceSurfaces.hide('data-sources')");
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
