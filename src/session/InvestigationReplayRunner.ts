/**
 * InvestigationReplayRunner — Headless clean-room deterministic replay & verification.
 */

import {
  LEGACY_NEMOSYNE_PACKAGE_FORMAT_VERSION,
  NemosynePackageManager,
  type NemosynePackagePayload,
} from './NemosynePackage.ts';
import { AtlasCore, type WasmRuntimeBridgeFull } from '../atlas/AtlasCore.ts';
import { Dataset } from '../data/Dataset.ts';
import { canonicalDatasetIdentityHex } from '../data/DatasetIdentity.ts';
import type { Provenance } from '../data/types.ts';
import type { AnalysisResult, AnalysisSpec, ResearchEvent } from '../atlas/types.ts';
import type { RepresentationDecision } from '../moneta/representation/RepresentationDecision.ts';
import {
  DiscoveryEpisodeStore,
  INVESTIGATION_DIGEST_ALGORITHM,
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

function compareAnalysisResult(expected: AnalysisResult, actual: AnalysisResult): string[] {
  const discrepancies: string[] = [];
  if (actual.resultId !== expected.resultId) {
    discrepancies.push(`resultId expected '${expected.resultId}', replay produced '${actual.resultId}'`);
  }
  if (actual.outputHash !== expected.outputHash) {
    discrepancies.push(`outputHash expected '${expected.outputHash}', replay produced '${actual.outputHash}'`);
  }
  if (actual.datasetFingerprint !== expected.datasetFingerprint) {
    discrepancies.push(`datasetFingerprint expected '${expected.datasetFingerprint}', replay produced '${actual.datasetFingerprint}'`);
  }
  if (actual.datasetVersion !== expected.datasetVersion) {
    discrepancies.push(`datasetVersion expected '${expected.datasetVersion}', replay produced '${actual.datasetVersion}'`);
  }
  const expectedDatasetIdentity = canonicalDatasetIdentityHex(expected.dataset);
  const actualDatasetIdentity = canonicalDatasetIdentityHex(actual.dataset);
  if (actualDatasetIdentity !== expectedDatasetIdentity) {
    discrepancies.push(`output dataset identity expected '${expectedDatasetIdentity}', replay produced '${actualDatasetIdentity}'`);
  }
  if (actual.implementationVersion !== expected.implementationVersion) {
    discrepancies.push(`implementationVersion expected '${expected.implementationVersion}', replay produced '${actual.implementationVersion}'`);
  }
  if (expected.provenance) discrepancies.push(...compareProvenance(expected.provenance, actual.provenance));
  return discrepancies;
}

function eventAnalysisSpec(event: ResearchEvent): AnalysisSpec | null {
  const command = event.command as Partial<AnalysisSpec> | null;
  if (!command || typeof command !== 'object') return null;
  if (!command.operation || typeof command.operation !== 'object') return null;
  if (typeof command.algorithmVersion !== 'string') return null;
  if (typeof command.datasetFingerprint !== 'string') return null;
  if (typeof command.datasetVersion !== 'number') return null;
  return command as AnalysisSpec;
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
  const expectedDatasetFingerprint = manifest.analyticalDatasetFingerprint ?? manifest.datasetFingerprint;
  const expectedKernelVersion = manifest.analyticalKernelVersion ?? manifest.kernelVersion;
  if (snapshot.episodes.length !== (manifest.discoveryCount ?? snapshot.episodes.length)) {
    discrepancies.push(`discovery count expected ${String(manifest.discoveryCount)}, found ${snapshot.episodes.length}`);
  }
  for (const episode of snapshot.episodes) {
    const prefix = `Discovery ${episode.discoveryId}`;
    if (episode.provenance.datasetFingerprint !== expectedDatasetFingerprint) {
      discrepancies.push(`${prefix} dataset fingerprint expected '${expectedDatasetFingerprint}', found '${episode.provenance.datasetFingerprint}'`);
    }
    if (episode.provenance.kernelVersion !== expectedKernelVersion) {
      discrepancies.push(`${prefix} kernel version expected '${expectedKernelVersion}', found '${episode.provenance.kernelVersion}'`);
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
  const expectedDatasetFingerprint = manifest.analyticalDatasetFingerprint ?? manifest.datasetFingerprint;
  const expectedKernelVersion = manifest.analyticalKernelVersion ?? manifest.kernelVersion;
  if (snapshot.outcomes.length !== (manifest.nilOutcomeCount ?? snapshot.outcomes.length)) {
    discrepancies.push(`NIL outcome count expected ${String(manifest.nilOutcomeCount)}, found ${snapshot.outcomes.length}`);
  }
  for (const outcome of snapshot.outcomes) {
    const prefix = `NIL ${outcome.nilId}`;
    const provenance = outcome.provenance;
    if (provenance.datasetFingerprint !== expectedDatasetFingerprint) {
      discrepancies.push(`${prefix} dataset fingerprint expected '${expectedDatasetFingerprint}', found '${provenance.datasetFingerprint}'`);
    }
    if (provenance.kernelVersion !== expectedKernelVersion) {
      discrepancies.push(`${prefix} kernel version expected '${expectedKernelVersion}', found '${provenance.kernelVersion}'`);
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
    const isLegacyV1Identity =
      manifest.formatVersion === LEGACY_NEMOSYNE_PACKAGE_FORMAT_VERSION &&
      !manifest.datasetIdentityAlgorithm &&
      /^\d+$/.test(manifest.datasetFingerprint);
    const usesSemanticDigestV2 = manifest.investigationDigestAlgorithm === INVESTIGATION_DIGEST_ALGORITHM;

    let dataset: Dataset;
    try {
      dataset = Dataset.fromJSON(JSON.parse(strFromU8(datasetBytes)));
    } catch (e) {
      discrepancies.push(`Failed to parse dataset from package: ${(e as Error).message}`);
      return this._failedResult(manifest.sessionId, manifest.datasetName, manifest.datasetFingerprint, discrepancies);
    }
    const computedPackageFingerprint = isLegacyV1Identity ? String(dataset.seedHash) : dataset.fingerprint;
    if (computedPackageFingerprint !== String(manifest.datasetFingerprint)) {
      discrepancies.push(`Dataset fingerprint mismatch: package manifest has '${manifest.datasetFingerprint}', dataset computed '${computedPackageFingerprint}'`);
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
    const recordedLoad = loggedEvents.find(
      (item): item is ResearchEvent => 'kind' in item && item.kind === 'load',
    );
    if (recordedLoad && recordedLoad.datasetVersion !== atlas.datasetVersion) {
      const replayState = atlas.toState();
      atlas.restoreState({
        ...replayState,
        datasetVersion: recordedLoad.datasetVersion,
        eventLedger: replayState.eventLedger.map((event) =>
          event.kind === 'load' ? { ...event, datasetVersion: recordedLoad.datasetVersion } : event,
        ),
      });
    }
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
          case 'load':
            eventsMatched += 1;
            break;
          case 'analysis': {
            if (!event.result) {
              if (usesSemanticDigestV2) {
                if (typeof event.intervention === 'string' && event.intervention.length > 0) eventsMatched += 1;
                else discrepancies.push(`Malformed semantic-v2 analysis event at #${i}: missing result and intervention`);
                break;
              }
            }
            const spec = usesSemanticDigestV2 ? eventAnalysisSpec(event) : (event.command as AnalysisSpec);
            if (!spec) {
              discrepancies.push(`Malformed analysis event at #${i}: missing executable AnalysisSpec`);
              break;
            }
            try {
              const res = atlas.applyAnalysis(spec);
              commandsReplayed += 1;
              let eventMatches = true;
              if (event.result) {
                const resultDiscrepancies = compareAnalysisResult(event.result, res);
                if (resultDiscrepancies.length === 0 && event.result.provenance) provenanceEventsVerified += 1;
                if (resultDiscrepancies.length > 0) {
                  eventMatches = false;
                  for (const entry of resultDiscrepancies) {
                    discrepancies.push(`Analysis drift at event #${i} (${spec.label ?? spec.operation.op}): ${entry}`);
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
            if (event.observationEntity) {
              if (!usesSemanticDigestV2) atlas.recordObservation(event.observationEntity);
              eventsMatched += 1;
            } else discrepancies.push(`Malformed observation event at #${i}: missing observationEntity`);
            break;
          case 'finding':
            if (event.findingEntity) {
              if (!usesSemanticDigestV2) atlas.recordFinding(event.findingEntity);
              eventsMatched += 1;
            } else discrepancies.push(`Malformed finding event at #${i}: missing findingEntity`);
            break;
          case 'annotation':
            if (event.annotationEntity) {
              if (!usesSemanticDigestV2) atlas.recordAnnotation(event.annotationEntity);
              eventsMatched += 1;
            } else discrepancies.push(`Malformed annotation event at #${i}: missing annotationEntity`);
            break;
          case 'structure':
            if (event.structureSet) {
              if (!usesSemanticDigestV2) atlas.evidenceLedger.recordStructure(event.structureSet, manifest.sessionId, event.timestamp);
              eventsMatched += 1;
            } else discrepancies.push(`Malformed structure event at #${i}: missing structureSet`);
            break;
          case 'recommendation':
            if (event.recommendationDecision) {
              if (!usesSemanticDigestV2) {
                const { eventId: _eventId, sessionId: _sessionId, ...replayEvent } = event;
                atlas.evidenceLedger.appendEvent(replayEvent, manifest.sessionId);
              }
              eventsMatched += 1;
            } else discrepancies.push(`Malformed recommendation event at #${i}: missing recommendationDecision`);
            break;
          case 'embodiment':
            if (event.embodimentCommand) {
              if (!usesSemanticDigestV2) atlas.recordEmbodimentCommand(event.embodimentCommand);
              eventsMatched += 1;
            } else discrepancies.push(`Malformed embodiment event at #${i}: missing embodimentCommand`);
            break;
          case 'undo':
            atlas.undo();
            eventsMatched += 1;
            break;
          case 'redo':
            atlas.redo();
            eventsMatched += 1;
            break;
          case 'seek': {
            const idx = (event.command as { index?: number })?.index;
            if (idx !== undefined) {
              atlas.seekHistory(idx);
              eventsMatched += 1;
            } else discrepancies.push(`Malformed seek event at #${i}: missing history index`);
            break;
          }
          case 'reset':
            atlas.resetAnalysis();
            eventsMatched += 1;
            break;
          case 'remediation':
            if (usesSemanticDigestV2 && !event.remediationEvent) {
              discrepancies.push(`Malformed remediation event at #${i}: missing remediationEvent`);
            } else eventsMatched += 1;
            break;
          case 'refusal':
            if (usesSemanticDigestV2 && !event.refusalEvent) {
              discrepancies.push(`Malformed refusal event at #${i}: missing refusalEvent`);
            } else eventsMatched += 1;
            break;
          default:
            discrepancies.push(`Unsupported or unrecognized event kind at #${i}: '${(event as { kind: string }).kind}'`);
        }
      } else if (usesSemanticDigestV2) {
        discrepancies.push(`Semantic-v2 command log entry #${i} is missing a research-event kind`);
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

    if (usesSemanticDigestV2) {
      // RF-047: after authoritative mutating operations have been independently
      // re-executed and verified, the persisted semantic ledger is the authority
      // for durable IDs, attribution and non-mutating provenance. Restore it
      // exactly rather than re-generating equivalent-looking events with fresh
      // counters/timestamps. This also rebuilds structures/observations/findings/
      // annotations from the authoritative ledger.
      const semanticEvents = loggedEvents.filter((item): item is ResearchEvent => 'kind' in item);
      const recordedResults = semanticEvents
        .filter((event) => event.kind === 'analysis' && event.result)
        .map((event) => event.result as AnalysisResult);
      atlas.evidenceLedger.restore(recordedResults, semanticEvents);
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
    let investigationDigest: string;
    if (usesSemanticDigestV2) {
      const context = manifest.researchContext
        ? {
            studyId: manifest.researchContext.studyId ?? undefined,
            researchQuestion: manifest.researchContext.researchQuestion ?? undefined,
            hypothesis: manifest.researchContext.hypothesis ?? undefined,
            variablesOfInterest: manifest.researchContext.variablesOfInterest ?? undefined,
            currentTask: manifest.researchContext.currentTask ?? undefined,
            observerMode: manifest.researchContext.observerMode ?? undefined,
          }
        : undefined;
      investigationDigest = await atlas.aggregate.computeDigest(manifest.kernelVersion || 'unknown', {
        nilOutcomes: nilOutcomes?.outcomes ?? [],
        researchContext: context,
      });
    } else {
      investigationDigest = await atlas.aggregate.computeDigest(
        replayKernelVersion ?? manifest.kernelVersion ?? 'unknown',
        {
          legacyDigestSchemaV1: true,
          legacyImmutableDatasetSeedHash: isLegacyV1Identity,
        },
      );
    }
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
