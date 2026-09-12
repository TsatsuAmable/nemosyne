import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runAdversarialCampaign } from '../dev/xr-lab/AdversarialCampaign.ts';
import {
  createKnownStructureXRBinding,
  type KnownStructureXRBinding,
} from '../dev/xr-lab/MonetaXRBenchmarkBinding.ts';

const outputPath = process.env.NEMOSYNE_XR_MONETA_CAMPAIGN_OUTPUT;
const buildHash = process.env.NEMOSYNE_XR_CAMPAIGN_BUILD ?? 'test-build';
let binding: KnownStructureXRBinding;

describe('Rust/Moneta semantic embodiment through XR adversarial loop', () => {
  beforeAll(async () => {
    binding = await createKnownStructureXRBinding({ seed: 20260912, pointsPerCluster: 48 });
  });

  afterAll(() => binding?.dispose());

  it('interacts with the bounded Rust-owned semantic artifact under XR faults', async () => {
    const report = await runAdversarialCampaign({
      campaignId: `xr-moneta-semantic-${Date.now()}`,
      buildHash,
      seed: 'nemosyne-moneta-semantic-v1',
      devices: ['quest3-class'],
      faults: [
        'clean',
        'noisy',
        'hostile',
        'falsifier-input-loss',
        'falsifier-frame-spike',
        'falsifier-pose-loss-freeze',
      ],
      datasets: ['tiny'],
      repetitions: 1,
      scenarioIds: ['usim-0-controller-select', 'usim-0-hand-pinch-select'],
      faultDelayScale: 0.01,
      targetFactory: (_cell, scene) => binding.createTarget(scene),
    });

    expect(report.summary.runs).toBe(12);
    expect(report.summary.failed).toBe(0);
    expect(report.summary.incomplete).toBe(0);
    expect(report.coverage.datasetBinding).toBe('rust-moneta-semantic');
    expect(report.results.every((result) => result.datasetBinding === 'rust-moneta-semantic')).toBe(
      true
    );
    expect(
      report.results.every(
        (result) => result.datasetEvidence?.chosenCandidateId === 'DENSITY_FIELD'
      )
    ).toBe(true);
    expect(
      report.results.every((result) => result.datasetEvidence?.decisionStatus === 'DECISIVE')
    ).toBe(true);
    expect(
      report.results.every(
        (result) => result.datasetEvidence?.semanticPayloadKind === 'BINNED_DENSITY'
      )
    ).toBe(true);
    expect(
      report.results.every((result) => Number(result.datasetEvidence?.sourceRowCount) === 144)
    ).toBe(true);
    expect(
      report.results.every((result) => Number(result.datasetEvidence?.elementCount) <= 100)
    ).toBe(true);
    expect(
      report.proposedIterations.some((iteration) =>
        iteration.title.includes('Moneta benchmark datasets')
      )
    ).toBe(false);

    if (outputPath) {
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }
  }, 30000);
});
