import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('RF-062H dev/research evidence isolation', () => {
  it('keeps optional load-test and Quest ownership out of World and WorldUIManager', () => {
    const world = source('src/vr/World.ts');
    const ui = source('src/vr/coordinators/WorldUIManager.ts');

    for (const forbidden of [
      'LoadTestDriver',
      'QuestBoundaryProbe',
      'LoadTestPanel',
      'runLoadTest(',
      'runQuestBoundaryProbe(',
      '_toggleLoadTestPanel',
    ]) {
      expect(world, forbidden).not.toContain(forbidden);
    }

    for (const forbidden of [
      'LoadTestDriver',
      'QuestBoundaryProbe',
      'LoadTestPanel',
      'getOrCreateLoadTestPanel',
      'loadTestPanel',
    ]) {
      expect(ui, forbidden).not.toContain(forbidden);
    }

    expect(ui).not.toMatch(/panelRolesManager\.registerPanel\(\s*['"]loadTest['"]/);
  });

  it('reaches the installer only through the DEV-gated dynamic bootstrap seam', () => {
    const bootstrap = source('src/app/bootstrap.ts');

    expect(bootstrap).not.toMatch(/^import .*devEvidence/m);
    expect(bootstrap).toMatch(
      /if \(import\.meta\.env\.DEV\) \{[\s\S]*await import\('\.\/devEvidence\.ts'\)/
    );
    expect(bootstrap).toContain('world.registerExtensionDisposer(() => devEvidence.dispose())');
  });

  it('keeps World out of the installer dependency graph', () => {
    const installer = source('src/app/devEvidence.ts');

    expect(installer).not.toMatch(/from ['"].*\/World\.ts['"]/);
    expect(installer).toContain('export function installDevEvidence');
    expect(installer).toMatch(
      /panelRolesManager\.registerPanel\(\s*['"]loadTest['"],[\s\S]*?['"]diagnostic['"]\s*\)/
    );
    expect(installer).toContain("panelRolesManager.unregisterPanel('loadTest')");
    expect(installer).toContain('engine.removeUpdatable(loadTestDriver)');
    expect(installer).toContain('engine.removeUpdatable(questBoundaryProbe)');
    expect(installer).toContain("validationContext ? 'Device Validation' : 'Load Test Panel'");
  });

  it('routes Dev Lab controls through optional engine extension callbacks', () => {
    const wheel = source('src/vr/coordinators/WheelMenuBuilder.ts');

    expect(wheel).toContain('world.engine.onToggleLoadTestPanel?.()');
    expect(wheel).toContain('world.engine.onStartLoadTest?.()');
    expect(wheel).toContain('world.engine.onStopLoadTest?.()');
    expect(wheel).not.toMatch(/world\.(?:runLoadTest|stopLoadTest|_toggleLoadTestPanel)\b/);
  });
});
