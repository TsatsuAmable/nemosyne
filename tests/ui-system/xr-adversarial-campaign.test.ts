// @vitest-environment jsdom
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runAdversarialCampaign } from '../../dev/xr-lab/AdversarialCampaign.ts';
import { SeededFaultController } from '../../dev/xr-lab/FaultInjection.ts';
import { FAULT_ENVELOPES } from '../../dev/xr-lab/ExperimentalProfiles.ts';
import { scenarioById } from '../../dev/xr-simulator/ScenarioFixtures.ts';

const operational = process.env.NEMOSYNE_XR_CAMPAIGN_MODE === 'operational';
const outputPath = process.env.NEMOSYNE_XR_CAMPAIGN_OUTPUT;
const buildHash = process.env.NEMOSYNE_XR_CAMPAIGN_BUILD ?? 'test-build';

describe('XR adversarial closed loop', () => {
  it('injects the same fault sequence for the same seed', () => {
    const scenario = scenarioById('usim-0-controller-select')!;
    const a = new SeededFaultController(FAULT_ENVELOPES.hostile, 'repeatable-seed');
    const b = new SeededFaultController(FAULT_ENVELOPES.hostile, 'repeatable-seed');
    const effectsA = scenario.steps.map((step, index) => a.effectForStep(step, index));
    const effectsB = scenario.steps.map((step, index) => b.effectForStep(step, index));
    expect(effectsA).toEqual(effectsB);
    expect(a.summary()).toEqual(b.summary());
  });

  it(
    'runs production-path simulator episodes and emits governed iteration proposals',
    async () => {
      const report = await runAdversarialCampaign({
        campaignId: operational ? `xr-operational-${Date.now()}` : 'xr-test-campaign',
        buildHash,
        seed: operational ? 'nemosyne-operational-v1' : 'nemosyne-test-v1',
        devices: operational
          ? ['quest3-class', 'quest2-class', 'constrained-standalone']
          : ['quest3-class'],
        faults: operational
          ? ['clean', 'noisy', 'hostile', 'falsifier-input-loss', 'falsifier-frame-spike']
          : ['clean', 'hostile', 'falsifier-input-loss', 'falsifier-frame-spike'],
        datasets: operational ? ['tiny', 'dense-low-structure'] : ['tiny'],
        repetitions: 1,
        scenarioIds: operational
          ? ['usim-0-controller-select', 'usim-0-hand-pinch-select']
          : ['usim-0-controller-select'],
        faultDelayScale: operational ? 0.01 : 0,
      });
      expect(report.summary.runs).toBeGreaterThan(0);
      if (report.summary.failed > 0) {
        console.log(
          'XR_CAMPAIGN_FAILURES',
          JSON.stringify(
            report.results
              .filter((result) => result.outcome === 'FAILED')
              .map((result) => ({
                cellId: result.cellId,
                scenarioId: result.scenarioId,
                errors: result.errors,
                faultSummary: result.faultSummary,
              })),
            null,
            2
          )
        );
      }
      expect(report.summary.failed).toBe(0);
      expect(report.summary.incomplete).toBe(0);
      expect(
        report.results.every((result) => result.episode.environment.mode === 'desktop-simulator')
      ).toBe(true);
      expect(report.results.every((result) => result.episode.buildHash === buildHash)).toBe(true);
      expect(report.proposedIterations.length).toBeGreaterThan(0);
      expect(
        report.proposedIterations.every(
          (iteration) => iteration.roadmapDisposition === 'TRIAGE_REQUIRED'
        )
      ).toBe(true);
      expect(
        report.proposedIterations.every(
          (iteration) => iteration.mayInterruptActiveRoadmap === false
        )
      ).toBe(true);
      expect(
        report.proposedIterations.some((iteration) => iteration.title.includes('Moneta benchmark'))
      ).toBe(true);
      if (outputPath) {
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      }
    },
    operational ? 30000 : 15000
  );
});
