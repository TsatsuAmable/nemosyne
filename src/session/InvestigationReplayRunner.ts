/**
 * InvestigationReplayRunner — Headless clean-room deterministic replay & verification.
 *
 * Replays an investigation from an immutable dataset and command log in a clean
 * environment (zero Three.js / WebGL / DOM dependencies) against the Rust/WASM kernel,
 * asserting bit-for-bit analytical parity and reconstructing the evidence graph.
 */

import { NemosynePackageManager, type NemosynePackagePayload } from './NemosynePackage.ts';
import { AtlasCore, type WasmRuntimeBridgeFull } from '../atlas/AtlasCore.ts';
import { Dataset } from '../data/Dataset.ts';
import type { AnalysisSpec, ResearchEvent } from '../atlas/types.ts';
import { strFromU8 } from 'fflate';

export interface ReplayVerificationResult {
  success: boolean;
  sessionId: string;
  datasetName: string;
  datasetFingerprint: string;
  commandsReplayed: number;
  eventsMatched: number;
  finalOutputHash: string;
  evidenceCount: {
    observations: number;
    findings: number;
    annotations: number;
  };
  discrepancies: string[];
}

export class InvestigationReplayRunner {
  private _bridge: WasmRuntimeBridgeFull;

  constructor(bridge: WasmRuntimeBridgeFull) {
    this._bridge = bridge;
  }

  /**
   * Replay an investigation from raw .nemosyne package archive bytes.
   */
  async replayArchive(archiveBytes: Uint8Array): Promise<ReplayVerificationResult> {
    const payload = NemosynePackageManager.unpack(archiveBytes);
    return this.replayPayload(payload);
  }

  /**
   * Replay an investigation from an unpacked package payload.
   */
  async replayPayload(payload: NemosynePackagePayload): Promise<ReplayVerificationResult> {
    const discrepancies: string[] = [];
    const { manifest, datasetBytes, commandLogBytes } = payload;

    // 1. Parse dataset
    let dataset: Dataset;
    try {
      const rawText = strFromU8(datasetBytes);
      const parsedJson = JSON.parse(rawText);
      dataset = Dataset.fromJSON(parsedJson);
    } catch (e) {
      discrepancies.push(`Failed to parse dataset from package: ${(e as Error).message}`);
      return this._failedResult(manifest.sessionId, manifest.datasetName, manifest.datasetFingerprint, discrepancies);
    }

    if (String(dataset.fingerprint) !== String(manifest.datasetFingerprint)) {
      discrepancies.push(
        `Dataset fingerprint mismatch: package manifest has '${manifest.datasetFingerprint}', dataset computed '${dataset.fingerprint}'`
      );
    }

    // 2. Parse command / event log
    let loggedEvents: (AnalysisSpec | ResearchEvent)[] = [];
    try {
      const logText = strFromU8(commandLogBytes);
      loggedEvents = JSON.parse(logText);
    } catch (e) {
      discrepancies.push(`Failed to parse command log: ${(e as Error).message}`);
      return this._failedResult(manifest.sessionId, manifest.datasetName, manifest.datasetFingerprint, discrepancies);
    }

    // 3. Initialize clean-room AtlasCore
    const atlas = new AtlasCore({ kernel: this._bridge });
    atlas.loadDataset(dataset);

    let commandsReplayed = 0;
    let eventsMatched = 0;

    for (let i = 0; i < loggedEvents.length; i++) {
      const item = loggedEvents[i];

      // Handle ResearchEvent or raw AnalysisSpec
      if ('kind' in item) {
        const event = item as ResearchEvent;
        switch (event.kind) {
          case 'analysis': {
            const spec = event.command as AnalysisSpec;
            try {
              const res = atlas.applyAnalysis(spec);
              commandsReplayed += 1;
              if (event.result?.outputHash && res.outputHash !== event.result.outputHash) {
                discrepancies.push(
                  `Output hash drift at event #${i} (${spec.label ?? spec.operation.op}): expected ${event.result.outputHash}, computed ${res.outputHash}`
                );
              } else {
                eventsMatched += 1;
              }
            } catch (err) {
              discrepancies.push(`Replay execution failure at event #${i}: ${(err as Error).message}`);
            }
            break;
          }
          case 'observation': {
            if (event.observationEntity) {
              atlas.recordObservation(event.observationEntity);
              eventsMatched += 1;
            }
            break;
          }
          case 'finding': {
            if (event.findingEntity) {
              atlas.recordFinding(event.findingEntity);
              eventsMatched += 1;
            }
            break;
          }
          case 'annotation': {
            if (event.annotationEntity) {
              atlas.recordAnnotation(event.annotationEntity);
              eventsMatched += 1;
            }
            break;
          }
          case 'undo':
            atlas.undo();
            eventsMatched += 1;
            break;
          case 'redo':
            atlas.redo();
            eventsMatched += 1;
            break;
          case 'reset':
            atlas.resetAnalysis();
            eventsMatched += 1;
            break;
          default:
            eventsMatched += 1;
            break;
        }
      } else {
        // Direct AnalysisSpec
        const spec = item as AnalysisSpec;
        try {
          atlas.applyAnalysis(spec);
          commandsReplayed += 1;
          eventsMatched += 1;
        } catch (err) {
          discrepancies.push(`Replay execution failure for spec #${i}: ${(err as Error).message}`);
        }
      }
    }

    const finalOutputHash = atlas.datasetSpace?.fingerprint ?? atlas.datasetFingerprint ?? '';

    return {
      success: discrepancies.length === 0,
      sessionId: manifest.sessionId,
      datasetName: manifest.datasetName,
      datasetFingerprint: manifest.datasetFingerprint,
      commandsReplayed,
      eventsMatched,
      finalOutputHash,
      evidenceCount: {
        observations: atlas.evidenceLedger.observations.length,
        findings: atlas.evidenceLedger.findings.length,
        annotations: atlas.evidenceLedger.annotations.length,
      },
      discrepancies,
    };
  }

  private _failedResult(
    sessionId: string,
    datasetName: string,
    datasetFingerprint: string,
    discrepancies: string[]
  ): ReplayVerificationResult {
    return {
      success: false,
      sessionId,
      datasetName,
      datasetFingerprint,
      commandsReplayed: 0,
      eventsMatched: 0,
      finalOutputHash: '',
      evidenceCount: { observations: 0, findings: 0, annotations: 0 },
      discrepancies,
    };
  }
}
