import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('governed validation operator reachability', () => {
  it('auto-shows the governed panel after the handle is fully wired', () => {
    const installer = source('src/app/devEvidence.ts');
    const handleIndex = installer.indexOf('const handle: DevEvidenceHandle = {');
    const autoShowIndex = installer.indexOf(
      "if (validationContext) {\n    uiManager.showPanel(getOrCreateValidationPanel());\n  }"
    );
    const returnIndex = installer.indexOf('return handle;', autoShowIndex);

    expect(handleIndex).toBeGreaterThanOrEqual(0);
    expect(autoShowIndex).toBeGreaterThan(handleIndex);
    expect(returnIndex).toBeGreaterThan(autoShowIndex);
  });

  it('does not auto-start performance or 10M evidence when exposing the panel', () => {
    const installer = source('src/app/devEvidence.ts');
    const marker = '// A governed physical-validation launch must expose its confirmation surface';
    const start = installer.indexOf(marker);
    const end = installer.indexOf('return handle;', start);
    const block = installer.slice(start, end);

    expect(block).toContain('uiManager.showPanel(getOrCreateValidationPanel())');
    expect(block).not.toContain('handle.runLoadTest');
    expect(block).not.toContain('handle.runQuestBoundaryProbe');
  });

  it('keeps the dev-evidence installer behind the DEV composition boundary', () => {
    const bootstrap = source('src/app/bootstrap.ts');
    expect(bootstrap).toMatch(
      /if \(import\.meta\.env\.DEV\) \{[\s\S]*await import\('\.\/devEvidence\.ts'\)/
    );
  });
});
