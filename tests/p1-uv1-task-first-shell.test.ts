import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TASK_FIRST_PRIMARY_ACTION_IDS } from '../src/app/AnalystJourneyControls.ts';
import {
  nextDatasetCycleIndex,
  resolveDatasetCycleCursor,
} from '../src/app/dataset/DatasetCycleCursor.ts';
import { allSampleDatasets } from '../src/data/SampleDatasets.ts';

describe('P1-UV1 task-first investigator shell', () => {
  it('keeps the primary desktop choice set bounded to investigator tasks', () => {
    expect(TASK_FIRST_PRIMARY_ACTION_IDS).toEqual([
      'analyst-load-sample',
      'analyst-run-analysis',
      'analyst-mark-moment',
    ]);
  });

  it('demotes normal-mode diagnostics at the composition root', () => {
    const source = readFileSync('src/app/bootstrap.ts', 'utf8');

    expect(source).toContain('function applyNormalAnalystShell(world: World)');
    expect(source).toContain("panelRolesManager.uiMode === 'DEVELOPER'");
    expect(source).toContain('hidePanel(world.uiManager.telemetryPanel)');
    expect(source).toContain('hidePanel(world.uiManager.vrConsole)');
    expect(source).toContain('world.uiManager.dashboard.wallGroup.visible = false');
    expect(source).toContain('world.uiManager.peerPresenceHUD.setEnabled(false)');
    expect(source).toContain("telemetry.hidden = import.meta.env.VITE_NEMOSYNE_DIAGNOSTICS !== '1'");
    expect(source).toContain('bootOverlay.hidden = true');
    expect(source).toContain('world.loader.hide()');
  });

  it('keeps semantic dataset cycling aligned with the active sample identity', () => {
    const source = readFileSync('src/app/bootstrap.ts', 'utf8');

    expect(source).toContain('function synchronizeDatasetCycleCursor(world: World, step: number)');
    expect(source).toContain('resolveDatasetCycleCursor(');
    expect(source).toContain('datasetName: world.currentEntry?.dataset?.name ?? world.atlas.dataset?.name ?? null');
    expect(source).toContain('synchronizeDatasetCycleCursor(world, step);');
    expect(source).toContain('world._cycleDataset(step);');
  });

  it('advances from the staged default sample even when only its label survives', () => {
    expect(
      nextDatasetCycleIndex(
        allSampleDatasets,
        { label: 'Supply Chain Hierarchy' },
        1,
      ),
    ).toBe(1);
    expect(allSampleDatasets[1]?.key).toBe('fraud-graph');
  });

  it('matches the underlying dataset name and wraps in both directions', () => {
    const last = allSampleDatasets.length - 1;

    expect(
      resolveDatasetCycleCursor(
        allSampleDatasets,
        { datasetName: allSampleDatasets[last].dataset.name },
        1,
      ),
    ).toBe(last);
    expect(
      nextDatasetCycleIndex(
        allSampleDatasets,
        { datasetName: allSampleDatasets[last].dataset.name },
        1,
      ),
    ).toBe(0);
    expect(
      nextDatasetCycleIndex(allSampleDatasets, { name: 'Imported investigation data' }, -1),
    ).toBe(last);
  });

  it('keeps the Moneta constraint HUD hidden normally and preserves the explicit diagnostic build route', () => {
    const source = readFileSync('src/vr/ui/MonetaDiagnosticHUD.ts', 'utf8');
    const constructor = source.slice(source.indexOf('  constructor('), source.indexOf('  get dracoNode'));
    expect(constructor).toContain('this.render();');
    expect(constructor).toContain("import.meta.env.VITE_NEMOSYNE_DIAGNOSTICS !== '1'");
    expect(constructor).toContain('this.hide();');
  });

  it('presents task vocabulary before advanced implementation controls', () => {
    const source = readFileSync('src/app/AnalystJourneyControls.ts', 'utf8');

    expect(source).toContain("root.dataset.shell = 'task-first'");
    expect(source).toContain("primaryHeading.textContent = 'What do you want to do?'");
    expect(source).toContain("'Explore another dataset'");
    expect(source).toContain("'Find anomalies'");
    expect(source).toContain("'Record observation'");
    expect(source).toContain("tools.id = 'analyst-investigation-tools'");
    expect(source.indexOf("primaryHeading.textContent = 'What do you want to do?'")).toBeLessThan(
      source.indexOf("tools.id = 'analyst-investigation-tools'"),
    );
  });
});
