import * as THREE from 'three';
import { InputRouter } from '../../src/vr/InputRouter.ts';
import {
  SimulatorScenarioRunner,
  WebXRSimulatorAdapter,
  scenarioById,
  type XREvaluationEpisode,
} from '../xr-simulator/index.ts';
import { SeededFaultController, type FaultInjectionSummary } from './FaultInjection.ts';
import { expandExperimentMatrix, type ExperimentCell } from './ExperimentalProfiles.ts';

export type FindingClassification = 'DEFECT' | 'MISSING_EVIDENCE' | 'HYPOTHESIS';
export type IterationPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type DatasetBindingKind = 'metadata-only' | 'rust-moneta-semantic';

export interface CampaignTargetBinding {
  target: THREE.Object3D;
  datasetBinding: DatasetBindingKind;
  datasetEvidence?: Record<string, unknown>;
}

export interface CampaignRunResult {
  evidenceRef: string;
  cellId: string;
  scenarioId: string;
  deviceId: string;
  faultId: string;
  datasetId: string;
  repetition: number;
  outcome: XREvaluationEpisode['outcome'];
  errors: string[];
  episode: XREvaluationEpisode;
  faultSummary: FaultInjectionSummary;
  datasetBinding: DatasetBindingKind;
  datasetEvidence?: Record<string, unknown>;
}

export interface IterationWorkPacket {
  id: string;
  priority: IterationPriority;
  classification: FindingClassification;
  title: string;
  objective: string;
  evidenceRefs: string[];
  falsifier: string;
  allowedScope: string[];
  authorityConstraints: string[];
  roadmapDisposition: 'TRIAGE_REQUIRED';
  mayInterruptActiveRoadmap: false;
}

export interface AdversarialCampaignReport {
  schemaVersion: '1';
  campaignId: string;
  buildHash: string;
  seed: string;
  createdAt: string;
  matrix: { cells: number; scenarios: string[] };
  summary: {
    runs: number;
    passed: number;
    failed: number;
    incomplete: number;
    unsupported: number;
    injectedFaultEvents: number;
  };
  coverage: {
    datasetBinding: DatasetBindingKind | 'mixed';
    configuredFaultDimensions: string[];
    exercisedFaultDimensions: string[];
    unexercisedFaultDimensions: string[];
  };
  results: CampaignRunResult[];
  proposedIterations: IterationWorkPacket[];
  nextIteration: IterationWorkPacket | null;
}

export interface AdversarialCampaignInput {
  campaignId: string;
  buildHash: string;
  seed: string;
  devices: string[];
  faults: string[];
  datasets: string[];
  repetitions: number;
  scenarioIds: string[];
  faultDelayScale?: number;
  targetFactory?: (
    cell: ExperimentCell,
    scene: THREE.Scene
  ) => Promise<CampaignTargetBinding> | CampaignTargetBinding;
}

function makeRouter(adapter: WebXRSimulatorAdapter): {
  router: InputRouter;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
} {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer();
  const engine = {
    renderer: { xr: { getSession: () => adapter.session } },
    camera: new THREE.PerspectiveCamera(75, 1, 0.05, 200),
    cameraGroup: new THREE.Group(),
  };
  return { router: new InputRouter(engine as never), renderer, scene };
}

async function runCellScenario(
  cell: ExperimentCell,
  scenarioId: string,
  input: AdversarialCampaignInput
): Promise<CampaignRunResult | null> {
  const scenario = scenarioById(scenarioId);
  if (!scenario) throw new Error(`unknown simulator scenario: ${scenarioId}`);
  if (!cell.device.iwerConfig || !cell.device.inputTopologies.includes(scenario.mode)) return null;

  const seed = `${input.seed}:${cell.id}:${scenarioId}`;
  const faultController = new SeededFaultController(cell.fault, seed);
  const adapter = new WebXRSimulatorAdapter(cell.device.iwerConfig);
  adapter.install();
  try {
    await adapter.startSession();
    const { router, renderer, scene } = makeRouter(adapter);
    const runner = new SimulatorScenarioRunner(adapter, router, scene, renderer, {
      buildHash: input.buildHash,
      faultController,
      faultDelayScale: input.faultDelayScale ?? 0.02,
      environment: {
        device: cell.device.id,
        xrRuntime: `iwer:${cell.device.vendorFamily}`,
        refreshRateHz: cell.device.nominalRefreshRateHz,
      },
    });
    const binding = input.targetFactory
      ? await input.targetFactory(cell, scene)
      : (() => {
          const target = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
          );
          target.position.set(0, 1.4, -2);
          scene.add(target);
          return { target, datasetBinding: 'metadata-only' as const, datasetEvidence: undefined };
        })();
    const target = binding.target;
    scene.updateMatrixWorld(true);
    let registered = false;
    const result = await runner.run(scenario, target, (mesh) => {
      if (!registered) {
        router.addInteractable(mesh, { onSelect: () => {} });
        registered = true;
      }
    });
    return {
      evidenceRef: result.episode.evaluationId,
      cellId: cell.id,
      scenarioId,
      deviceId: cell.device.id,
      faultId: cell.fault.id,
      datasetId: cell.dataset.id,
      repetition: cell.repetition,
      outcome: result.episode.outcome,
      errors: [...result.errors],
      episode: result.episode,
      faultSummary: faultController.summary(),
      datasetBinding: binding.datasetBinding,
      datasetEvidence: binding.datasetEvidence,
    };
  } finally {
    await adapter.endSession();
    adapter.uninstall();
  }
}

function priorityRank(priority: IterationPriority): number {
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[priority];
}

function makePacket(
  input: Omit<IterationWorkPacket, 'id' | 'roadmapDisposition' | 'mayInterruptActiveRoadmap'>
): IterationWorkPacket {
  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return {
    ...input,
    id: `xr-iteration-${slug}`,
    roadmapDisposition: 'TRIAGE_REQUIRED',
    mayInterruptActiveRoadmap: false,
  };
}

export function planIterations(results: CampaignRunResult[]): IterationWorkPacket[] {
  const packets: IterationWorkPacket[] = [];
  const failures = results.filter((result) => result.outcome === 'FAILED');
  const cleanFailures = failures.filter((result) => result.faultId === 'clean');
  if (cleanFailures.length > 0) {
    packets.push(
      makePacket({
        priority: 'P0',
        classification: 'DEFECT',
        title: 'Restore clean simulator interaction invariants',
        objective: `Resolve ${cleanFailures.length} failure(s) that reproduce without injected faults before interpreting resilience results.`,
        evidenceRefs: cleanFailures.map((result) => result.evidenceRef),
        falsifier:
          'The same scenario/device combinations pass on at least three deterministic clean seeds with no weaker assertions.',
        allowedScope: [
          'dev/xr-simulator',
          'src/vr interaction production path',
          'focused regression tests',
        ],
        authorityConstraints: [
          'Do not weaken scenario assertions',
          'Do not infer physical XR fitness from simulator evidence',
        ],
      })
    );
  }

  const resilienceFailures = failures.filter((result) => result.faultId !== 'clean');
  if (resilienceFailures.length > 0) {
    packets.push(
      makePacket({
        priority: cleanFailures.length > 0 ? 'P2' : 'P1',
        classification: 'HYPOTHESIS',
        title: 'Harden interaction paths against injected XR faults',
        objective: `Investigate ${resilienceFailures.length} injected-fault failure(s), preserving clean-path semantics and identifying the smallest production-path resilience change.`,
        evidenceRefs: resilienceFailures.map((result) => result.evidenceRef),
        falsifier:
          'Failures disappear under the same seeds while clean episodes remain unchanged and fault injection remains active.',
        allowedScope: [
          'src/vr interaction recovery',
          'dev/xr-simulator fault harness',
          'targeted resilience tests',
        ],
        authorityConstraints: [
          'Simulator failures are hypotheses until production-path evidence confirms them',
          'No new analytical authority in TypeScript',
        ],
      })
    );
  }

  if (results.length > 0 && results.every((result) => result.datasetBinding === 'metadata-only')) {
    packets.push(
      makePacket({
        priority: 'P1',
        classification: 'MISSING_EVIDENCE',
        title: 'Bind adversarial campaigns to real Moneta benchmark datasets',
        objective:
          'Replace metadata-only dataset envelopes with governed benchmark fixtures flowing through the actual Moneta/Rust analytical path, so source cardinality and semantic structure can affect the production representation under test.',
        evidenceRefs: results.slice(0, 8).map((result) => result.evidenceRef),
        falsifier:
          'At least one exact-generative benchmark is loaded through the production data/Moneta path and its known structure is checked independently of render primitive count.',
        allowedScope: [
          'dev/xr-lab benchmark adapters',
          'existing production data ingestion seam',
          'Rust/WASM analytical outputs',
          'tests',
        ],
        authorityConstraints: [
          'Rust/WASM remains analytical authority',
          'Do not synthesize analytical truth in the simulator',
          'Human-preference corpora remain human-gated',
        ],
      })
    );
  }

  const globallyConfigured = new Set(
    results.flatMap((result) => result.faultSummary.configuredDimensions)
  );
  const globallyExercised = new Set(
    results.flatMap((result) => Object.keys(result.faultSummary.injected))
  );
  const unexercised = new Set(
    [...globallyConfigured].filter((dimension) => !globallyExercised.has(dimension))
  );
  if (unexercised.size > 0) {
    packets.push(
      makePacket({
        priority: 'P2',
        classification: 'MISSING_EVIDENCE',
        title: 'Close adversarial fault coverage gaps',
        objective: `Ensure configured fault dimensions are actually exercised or explicitly retired: ${[...unexercised].sort().join(', ')}.`,
        evidenceRefs: results
          .filter((result) =>
            result.faultSummary.configuredDimensions.some((dimension) => unexercised.has(dimension))
          )
          .map((result) => result.evidenceRef),
        falsifier:
          'A deterministic campaign records at least one event for every configured fault dimension without changing its declared envelope semantics.',
        allowedScope: ['dev/xr-lab fault scheduling', 'scenario soak/repetition profiles', 'tests'],
        authorityConstraints: [
          'Do not force probabilistic faults while claiming sampled probabilities',
          'Record deterministic falsifier profiles separately',
        ],
      })
    );
  }
  return packets.sort(
    (a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.id.localeCompare(b.id)
  );
}

export async function runAdversarialCampaign(
  input: AdversarialCampaignInput
): Promise<AdversarialCampaignReport> {
  const cells = expandExperimentMatrix(input);
  const results: CampaignRunResult[] = [];
  for (const cell of cells) {
    for (const scenarioId of input.scenarioIds) {
      const result = await runCellScenario(cell, scenarioId, input);
      if (result) results.push(result);
    }
  }
  const configured = new Set(results.flatMap((result) => result.faultSummary.configuredDimensions));
  const exercised = new Set(results.flatMap((result) => Object.keys(result.faultSummary.injected)));
  const proposedIterations = planIterations(results);
  const count = (outcome: XREvaluationEpisode['outcome']) =>
    results.filter((result) => result.outcome === outcome).length;
  return {
    schemaVersion: '1',
    campaignId: input.campaignId,
    buildHash: input.buildHash,
    seed: input.seed,
    createdAt: new Date().toISOString(),
    matrix: { cells: cells.length, scenarios: [...input.scenarioIds] },
    summary: {
      runs: results.length,
      passed: count('PASSED'),
      failed: count('FAILED'),
      incomplete: count('INCOMPLETE'),
      unsupported: count('UNSUPPORTED'),
      injectedFaultEvents: results.reduce(
        (sum, result) =>
          sum + Object.values(result.faultSummary.injected).reduce((a, b) => a + b, 0),
        0
      ),
    },
    coverage: {
      datasetBinding:
        new Set(results.map((result) => result.datasetBinding)).size === 1
          ? (results[0]?.datasetBinding ?? 'metadata-only')
          : 'mixed',
      configuredFaultDimensions: [...configured].sort(),
      exercisedFaultDimensions: [...exercised].sort(),
      unexercisedFaultDimensions: [...configured]
        .filter((dimension) => !exercised.has(dimension))
        .sort(),
    },
    results,
    proposedIterations,
    nextIteration: proposedIterations[0] ?? null,
  };
}
