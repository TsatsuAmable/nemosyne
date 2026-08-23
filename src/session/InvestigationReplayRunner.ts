/**
 * InvestigationReplayRunner — Headless clean-room deterministic replay & verification.
 */

import { NemosynePackageManager, type NemosynePackagePayload } from './NemosynePackage.ts';
import { AtlasCore, type WasmRuntimeBridgeFull } from '../atlas/AtlasCore.ts';
import { Dataset } from '../data/Dataset.ts';
import type { Provenance } from '../data/types.ts';
import type { AnalysisSpec, ResearchEvent } from '../atlas/types.ts';
import type { RepresentationDecision } from '../moneta/representation/RepresentationDecision.ts';
import {
  DiscoveryEpisodeStore,
  NoFeasibleRepresentationStore,
  canonicalJsonStringify,
  type DiscoveryEpisodeStoreSnapshot,
  type NoFeasibleRepresentationStoreSnapshot,
} from '../investigation/index.ts';
import { fnv1aHex } from '../atlas/DatasetSpace.ts';
import { strFromU8 } from 'fflate';

export interface ReplayVerificationResult {
  success: boolean;
  sessionId: string;
  datasetName: string;
  datasetFingerprint: string;
  commandsReplayed: number;
  eventsMatched: number;
  provenanceEventsVerified: number;
  representationProvenanceVerified: boolean;
  discoveryProvenanceVerified: number;
  nilProvenanceVerified: number;
  finalOutputHash: string;
  investigationDigest: string;
  evidenceCount: {
    observations: number;
    findings: number;
    annotations: number;
  };
  discrepancies: string[];
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

function compareProvenance(expected: Provenance, actual: Provenance | null): string[] {
  if (!actual) return ['replay kernel emitted no provenance'];
  const discrepancies: string[] = [];
  const fields: Array<keyof Pick<Provenance, 'kernel' | 'kernelVersion' | 'operation' | 'inputFingerprint' | 'outputFingerprint'>> = [
    'kernel', 'kernelVersion', 'operation', 'inputFingerprint', 'outputFingerprint',
  ];
  for (const field of fields) {
    if (actual[field] !== expected[field]) {
      discrepancies.push(`${field} expected '${expected[field]}', replay produced '${actual[field]}'`);
    }
  }
  if (stableJson(actual.parameters) !== stableJson(expected.parameters)) {
    discrepancies.push(`parameters expected ${stableJson(expected.parameters)}, replay produced ${stableJson(actual.parameters)}`);
  }
  if (!(expected.timestamp > 0)) discrepancies.push('recorded provenance timestamp is invalid');
  if (!(actual.timestamp > 0)) discrepancies.push('replay provenance timestamp is invalid');
  return discrepancies;
}

function parseRepresentationDecision(bytes: Uint8Array): RepresentationDecision {
  const parsed: unknown = JSON.parse(strFromU8(bytes));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('representation state must be a JSON object');
  }
  const candidate = parsed as Partial<RepresentationDecision>;
  if (typeof candidate.utilityScore !== 'number') throw new Error('representation state is missing numeric utilityScore');
  if (!candidate.provenance || typeof candidate.provenance !== 'object') throw new Error('representation state is missing provenance');
  if (!candidate.embodiment || typeof candidate.embodiment !== 'object') throw new Error('representation state is missing embodiment');
  if (!candidate.embodiment.spatialStrategy || typeof candidate.embodiment.spatialStrategy !== 'object') {
    throw new Error('representation state is missing embodied spatial strategy');
  }
  return parsed as RepresentationDecision;
}

function compareRepresentationProvenance(
  decision: RepresentationDecision,
  manifestModel: NemosynePackagePayload['manifest']['representationModel'],
): string[] {
  const discrepancies: string[] = [];
  const strategyProvenance = decision.embodiment.spatialStrategy.provenance;
  const versionCopies = [
    ['decision', decision.fitnessModelVersion],
    ['decision provenance', decision.provenance.fitnessModelVersion],
    ['spatial strategy provenance', strategyProvenance?.fitnessModelVersion],
  ] as const;
  const artifactCopies = [
    ['decision', decision.fitnessModelArtifactHash],
    ['decision provenance', decision.provenance.fitnessModelArtifactHash],
    ['spatial strategy provenance', strategyProvenance?.fitnessModelArtifactHash],
  ] as const;
  const expectedVersion = manifestModel?.fitnessModelVersion ?? versionCopies.find(([, value]) => typeof value === 'string' && value.length > 0)?.[1];
  const expectedArtifact = manifestModel
    ? (manifestModel.fitnessModelArtifactHash ?? null)
    : (artifactCopies.find(([, value]) => value !== undefined)?.[1] ?? null);

  if (manifestModel && !expectedVersion) discrepancies.push('manifest representation model is missing fitnessModelVersion');
  if (expectedVersion) {
    for (const [source, version] of versionCopies) {
      if (version !== expectedVersion) {
        discrepancies.push(`${source} fitnessModelVersion expected '${expectedVersion}', found '${String(version)}'`);
      }
    }
  }
  for (const [source, artifactHash] of artifactCopies) {
    if ((artifactHash ?? null) !== expectedArtifact) {
      discrepancies.push(`${source} fitnessModelArtifactHash expected '${String(expectedArtifact)}', found '${String(artifactHash ?? null)}'`);
    }
  }
  return discrepancies;
}

function parseDiscoveries(bytes: Uint8Array): DiscoveryEpisodeStoreSnapshot {
  const parsed = JSON.parse(strFromU8(bytes)) as DiscoveryEpisodeStoreSnapshot;
  const validated = new DiscoveryEpisodeStore();
  validated.restore(parsed);
  return validated.toJSON();
}

function compareDiscoveryProvenance(
  snapshot: DiscoveryEpisodeStoreSnapshot,
  manifest: NemosynePackagePayload['manifest'],
  decision: RepresentationDecision | null,
): string[] {
  const discrepancies: string[] = [];
  if (snapshot.episodes.length !== (manifest.discoveryCount ?? snapshot.episodes.length)) {
    discrepancies.push(`discovery count expected ${String(manifest.discoveryCount)}, found ${snapshot.episodes.length}`);
  }
  for (const episode of snapshot.episodes) {
    const prefix = `Discovery ${episode.discoveryId}`;
    if (episode.provenance.datasetFingerprint !== manifest.datasetFingerprint) {
      discrepancies.push(`${prefix} dataset fingerprint expected '${manifest.datasetFingerprint}', found '${episode.provenance.datasetFingerprint}'`);
    }
    if (episode.provenance.kernelVersion !== manifest.kernelVersion) {
      discrepancies.push(`${prefix} kernel version expected '${manifest.kernelVersion}', found '${episode.provenance.kernelVersion}'`);
    }
    const ctx = episode.representationContext;
    if (ctx.representationDecisionId) {
      if (!decision) {
        discrepancies.push(`${prefix} references representation decision '${ctx.representationDecisionId}' but package has none`);
      } else if (decision.id !== ctx.representationDecisionId) {
        discrepancies.push(`${prefix} representation decision expected '${String(decision.id)}', found '${ctx.representationDecisionId}'`);
      }
    }
    if (decision && ctx.fitnessModelVersion && ctx.fitnessModelVersion !== decision.fitnessModelVersion) {
      discrepancies.push(`${prefix} fitness model version expected '${String(decision.fitnessModelVersion)}', found '${ctx.fitnessModelVersion}'`);
    }
    if (decision && ctx.fitnessModelArtifactHash !== undefined && (ctx.fitnessModelArtifactHash ?? null) !== (decision.fitnessModelArtifactHash ?? null)) {
      discrepancies.push(`${prefix} fitness model artifact expected '${String(decision.fitnessModelArtifactHash ?? null)}', found '${String(ctx.fitnessModelArtifactHash ?? null)}'`);
    }
    if (decision && ctx.decisionDatasetFingerprint && ctx.decisionDatasetFingerprint !== decision.provenance.datasetFingerprint) {
      discrepancies.push(`${prefix} decision dataset fingerprint expected '${decision.provenance.datasetFingerprint}', found '${ctx.decisionDatasetFingerprint}'`);
    }
  }
  return discrepancies;
}

function parseNilOutcomes(bytes: Uint8Array): NoFeasibleRepresentationStoreSnapshot {
  const parsed = JSON.parse(strFromU8(bytes)) as NoFeasibleRepresentationStoreSnapshot;
  const validated = new NoFeasibleRepresentationStore();
  validated.restore(parsed);
  return validated.toJSON();
}

function compareNilProvenance(
  snapshot: NoFeasibleRepresentationStoreSnapshot,
  manifest: NemosynePackagePayload['manifest'],
  decision: RepresentationDecision | null,
): string[] {
  const discrepancies: string[] = [];
  if (snapshot.outcomes.length !== (manifest.nilOutcomeCount ?? snapshot.outcomes.length)) {
    discrepancies.push(`NIL outcome count expected ${String(manifest.nilOutcomeCount)}, found ${snapshot.outcomes.length}`);
  }
  for (const outcome of snapshot.outcomes) {
    const prefix = `NIL ${outcome.nilId}`;
    const provenance = outcome.provenance;
    if (provenance.datasetFingerprint !== manifest.datasetFingerprint) {
      discrepancies.push(`${prefix} dataset fingerprint expected '${manifest.datasetFingerprint}', found '${provenance.datasetFingerprint}'`);
    }
    if (provenance.kernelVersion !== manifest.kernelVersion) {
      discrepancies.push(`${prefix} kernel version expected '${manifest.kernelVersion}', found '${provenance.kernelVersion}'`);
    }
    if (provenance.sourceDecisionId) {
      if (!decision) {
        discrepancies.push(`${prefix} references source decision '${provenance.sourceDecisionId}' but package has none`);
      } else if (decision.id !== provenance.sourceDecisionId) {
        discrepancies.push(`${prefix} source decision expected '${String(decision.id)}', found '${provenance.sourceDecisionId}'`);
      }
    }
    if (decision && provenance.fitnessModelVersion && provenance.fitnessModelVersion !== decision.fitnessModelVersion) {
      discrepancies.push(`${prefix} fitness model version expected '${String(decision.fitnessModelVersion)}', found '${provenance.fitnessModelVersion}'`);
    }
    if (decision && provenance.fitnessModelArtifactHash !== undefined && (provenance.fitnessModelArtifactHash ?? null) !== (decision.fitnessModelArtifactHash ?? null)) {
      discrepancies.push(`${prefix} fitness model artifact expected '${String(decision.fitnessModelArtifactHash ?? null)}', found '${String(provenance.fitnessModelArtifactHash ?? null)}'`);
    }
    if (decision && provenance.sourceDecisionEvidenceHash) {
      const actualHash = fnv1aHex(canonicalJsonStringify(decision.evidence));
      if (actualHash !== provenance.sourceDecisionEvidenceHash) {
        discrepancies.push(`${prefix} source decision evidence hash expected '${actualHash}', found '${provenance.sourceDecisionEvidenceHash}'`);
      }
    }
  }
  return discrepancies;
}

export class InvestigationReplayRunner {
  constructor(private _bridge: WasmRuntimeBridgeFull) {}

  async replayArchive(archiveBytes: Uint8Array): Promise<ReplayVerificationResult> {
    return this.replayPayload(NemosynePackageManager.unpack(archiveBytes));
  }

  async replayPayload(payload: NemosynePackagePayload): Promise<ReplayVerificationResult> {
    const discrepancies: string[] = [];
    const {
      manifest,
      datasetBytes,
      commandLogBytes,
      representationDecisionBytes,
      discoveryEpisodesBytes,
      nilOutcomesBytes,
    } = payload;

    let dataset: Dataset;
    try {
      dataset = Dataset.fromJSON(JSON.parse(strFromU8(datasetBytes)));
    } catch (e) {
      discrepancies.push(`Failed to parse dataset from package: ${(e as Error).message}`);
      return this._failedResult(manifest.sessionId, manifest.datasetName, manifest.datasetFingerprint, discrepancies);
    }
    if (String(dataset.fingerprint) !== String(manifest.datasetFingerprint)) {
      discrepancies.push(`Dataset fingerprint mismatch: package manifest has '${manifest.datasetFingerprint}', dataset computed '${dataset.fingerprint}'`);
    }

    let loggedEvents: (AnalysisSpec | ResearchEvent)[] = [];
    try {
      loggedEvents = JSON.parse(strFromU8(commandLogBytes));
    } catch (e) {
      discrepancies.push(`Failed to parse command log: ${(e as Error).message}`);
      return this._failedResult(manifest.sessionId, manifest.datasetName, manifest.datasetFingerprint, discrepancies);
    }

    let representationDecision: RepresentationDecision | null = null;
    if (representationDecisionBytes) {
      try {
        representationDecision = parseRepresentationDecision(representationDecisionBytes);
      } catch (e) {
        discrepancies.push(`Failed to parse representation state from package: ${(e as Error).message}`);
        return this._failedResult(manifest.sessionId, manifest.datasetName, manifest.datasetFingerprint, discrepancies);
      }
    } else if (manifest.representationModel) {
      discrepancies.push('Manifest declares representation model provenance but no persisted representation decision was provided');
    }

    let discoveries: DiscoveryEpisodeStoreSnapshot | null = null;
    if (discoveryEpisodesBytes) {
      try {
        discoveries = parseDiscoveries(discoveryEpisodesBytes);
      } catch (e) {
        discrepancies.push(`Failed to parse discovery state from package: ${(e as Error).message}`);
      }
    }

    let nilOutcomes: NoFeasibleRepresentationStoreSnapshot | null = null;
    if (nilOutcomesBytes) {
      try {
        nilOutcomes = parseNilOutcomes(nilOutcomesBytes);
      } catch (e) {
        discrepancies.push(`Failed to parse NIL state from package: ${(e as Error).message}`);
      }
    }

    const atlas = new AtlasCore({ kernel: this._bridge, sessionId: manifest.sessionId });
    atlas.loadDataset(dataset);
    const replayKernelVersion = atlas.kernelVersion();
    if (replayKernelVersion && manifest.kernelVersion && replayKernelVersion !== manifest.kernelVersion) {
      discrepancies.push(`Kernel version mismatch: package manifest has '${manifest.kernelVersion}', replay kernel is '${replayKernelVersion}'`);
    }

    let commandsReplayed = 0;
    let eventsMatched = 0;
    let provenanceEventsVerified = 0;
    let representationProvenanceVerified = false;

    for (let i = 0; i < loggedEvents.length; i++) {
      const item = loggedEvents[i];
      if ('kind' in item) {
        const event = item as ResearchEvent;
        switch (event.kind) {
          case 'load': eventsMatched += 1; break;
          case 'analysis': {
            const spec = event.command as AnalysisSpec;
            try {
              const res = atlas.applyAnalysis(spec);
              commandsReplayed += 1;
              let eventMatches = true;
              if (event.result?.outputHash && res.outputHash !== event.result.outputHash) {
                discrepancies.push(`Output hash drift at event #${i} (${spec.label ?? spec.operation.op}): expected ${event.result.outputHash}, computed ${res.outputHash}`);
                eventMatches = false;
              }
              if (event.result?.provenance) {
                const provenanceDiscrepancies = compareProvenance(event.result.provenance, res.provenance);
                if (provenanceDiscrepancies.length === 0) provenanceEventsVerified += 1;
                else {
                  eventMatches = false;
                  for (const entry of provenanceDiscrepancies) {
                    discrepancies.push(`Provenance drift at event #${i} (${spec.label ?? spec.operation.op}): ${entry}`);
                  }
                }
              }
              if (eventMatches) eventsMatched += 1;
            } catch (err) {
              discrepancies.push(`Replay execution failure at event #${i}: ${(err as Error).message}`);
            }
            break;
          }
          case 'observation':
            if (event.observationEntity) { atlas.recordObservation(event.observationEntity); eventsMatched += 1; }
            else discrepancies.push(`Malformed observation event at #${i}: missing observationEntity`);
            break;
          case 'finding':
            if (event.findingEntity) { atlas.recordFinding(event.findingEntity); eventsMatched += 1; }
            else discrepancies.push(`Malformed finding event at #${i}: missing findingEntity`);
            break;
          case 'annotation':
            if (event.annotationEntity) { atlas.recordAnnotation(event.annotationEntity); eventsMatched += 1; }
            else discrepancies.push(`Malformed annotation event at #${i}: missing annotationEntity`);
            break;
          case 'structure':
            if (event.structureSet) { atlas.evidenceLedger.recordStructure(event.structureSet, manifest.sessionId, event.timestamp); eventsMatched += 1; }
            break;
          case 'recommendation':
            if (event.recommendationDecision) { atlas.recordDecision(event.recommendationDecision); eventsMatched += 1; }
            break;
          case 'embodiment':
            if (event.embodimentCommand) { atlas.recordEmbodimentCommand(event.embodimentCommand); eventsMatched += 1; }
            break;
          case 'undo': atlas.undo(); eventsMatched += 1; break;
          case 'redo': atlas.redo(); eventsMatched += 1; break;
          case 'seek': {
            const idx = (event.command as { index?: number })?.index;
            if (idx !== undefined) { atlas.seekHistory(idx); eventsMatched += 1; }
            break;
          }
          case 'reset': atlas.resetAnalysis(); eventsMatched += 1; break;
          default: discrepancies.push(`Unsupported or unrecognized event kind at #${i}: '${(event as { kind: string }).kind}'`);
        }
      } else {
        try {
          atlas.applyAnalysis(item as AnalysisSpec);
          commandsReplayed += 1;
          eventsMatched += 1;
        } catch (err) {
          discrepancies.push(`Replay execution failure for spec #${i}: ${(err as Error).message}`);
        }
      }
    }

    if (representationDecision) {
      const repDiscrepancies = compareRepresentationProvenance(representationDecision, manifest.representationModel);
      if (repDiscrepancies.length === 0) representationProvenanceVerified = true;
      else for (const entry of repDiscrepancies) discrepancies.push(`Representation provenance drift: ${entry}`);
      atlas.aggregate.representation.restoreDecision(representationDecision);
    }

    let discoveryProvenanceVerified = 0;
    if (discoveries) {
      const discoveryDiscrepancies = compareDiscoveryProvenance(discoveries, manifest, representationDecision);
      if (discoveryDiscrepancies.length === 0) {
        atlas.aggregate.discoveries.restore(discoveries);
        discoveryProvenanceVerified = discoveries.episodes.length;
      } else {
        for (const entry of discoveryDiscrepancies) discrepancies.push(`Discovery provenance drift: ${entry}`);
      }
    }

    let nilProvenanceVerified = 0;
    if (nilOutcomes) {
      const nilDiscrepancies = compareNilProvenance(nilOutcomes, manifest, representationDecision);
      if (nilDiscrepancies.length === 0) nilProvenanceVerified = nilOutcomes.outcomes.length;
      else for (const entry of nilDiscrepancies) discrepancies.push(`NIL provenance drift: ${entry}`);
    }

    const finalOutputHash = atlas.datasetSpace?.fingerprint ?? atlas.datasetFingerprint ?? '';
    const investigationDigest = await atlas.computeDigest();
    if (manifest.investigationDigest && manifest.investigationDigest !== investigationDigest) {
      discrepancies.push(`Investigation digest mismatch: package manifest has '${manifest.investigationDigest}', replayed digest is '${investigationDigest}'`);
    }

    if (manifest.evidenceSummary) {
      if (atlas.evidenceLedger.observations.length !== manifest.evidenceSummary.observationsCount) discrepancies.push(`Observations count mismatch: manifest expected ${manifest.evidenceSummary.observationsCount}, replay produced ${atlas.evidenceLedger.observations.length}`);
      if (atlas.evidenceLedger.findings.length !== manifest.evidenceSummary.findingsCount) discrepancies.push(`Findings count mismatch: manifest expected ${manifest.evidenceSummary.findingsCount}, replay produced ${atlas.evidenceLedger.findings.length}`);
      if (atlas.evidenceLedger.annotations.length !== manifest.evidenceSummary.annotationsCount) discrepancies.push(`Annotations count mismatch: manifest expected ${manifest.evidenceSummary.annotationsCount}, replay produced ${atlas.evidenceLedger.annotations.length}`);
    }

    return {
      success: discrepancies.length === 0,
      sessionId: manifest.sessionId,
      datasetName: manifest.datasetName,
      datasetFingerprint: manifest.datasetFingerprint,
      commandsReplayed,
      eventsMatched,
      provenanceEventsVerified,
      representationProvenanceVerified,
      discoveryProvenanceVerified,
      nilProvenanceVerified,
      finalOutputHash,
      investigationDigest,
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
    discrepancies: string[],
  ): ReplayVerificationResult {
    return {
      success: false,
      sessionId,
      datasetName,
      datasetFingerprint,
      commandsReplayed: 0,
      eventsMatched: 0,
      provenanceEventsVerified: 0,
      representationProvenanceVerified: false,
      discoveryProvenanceVerified: 0,
      nilProvenanceVerified: 0,
      finalOutputHash: '',
      investigationDigest: '',
      evidenceCount: { observations: 0, findings: 0, annotations: 0 },
      discrepancies,
    };
  }
}
