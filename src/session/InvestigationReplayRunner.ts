/**
 * InvestigationReplayRunner — Headless clean-room deterministic replay & verification.
 */

import {
  GOVERNED_NEMOSYNE_PACKAGE_FORMAT_VERSION,
  FORMA_PACKAGE_FORMAT_VERSION,
  LEGACY_NEMOSYNE_PACKAGE_FORMAT_VERSION,
  NEMOSYNE_PACKAGE_FORMAT_VERSION,
  NemosynePackageManager,
  createHistoricalInspectionCapability,
  type HistoricalInspectionCapability,
  type NemosynePackageManifest,
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
  GOVERNED_INVESTIGATION_DIGEST_ALGORITHM,
  INVESTIGATION_DIGEST_ALGORITHM,
  NoFeasibleRepresentationStore,
  canonicalJsonStringify,
  type DiscoveryEpisodeStoreSnapshot,
  type NoFeasibleRepresentationStoreSnapshot,
} from '../investigation/index.ts';
import {
  parsePersistedEvidenceReceiptsV1,
  type PersistedEvidenceReceiptsV1,
} from '../data/evidence/PersistedEvidenceReceipts.ts';
import {
  bindConsumerUsesV1,
  type ConsumerBindingRefusalV1,
} from '../data/evidence/ConsumerPolicy.ts';
import { governedConsumerPolicyV1 } from '../data/evidence/ConsumerPolicyRegistry.ts';
import { sha256Hex } from '../security/CryptoHash.ts';
import { fnv1aHex } from '../atlas/DatasetSpace.ts';
import { strFromU8 } from 'fflate';

/**
 * RFC 0009: typed refusal for a well-formed package whose governed evidence this
 * replay run cannot resolve. Distinct from a malformed *manifest or envelope*,
 * which rejects under `integrity: 'not-established'`, and distinct again from a
 * damaged *payload* (unparseable dataset or command-log bytes), which fails with
 * a verified envelope and a discrepancy naming the damaged part.
 *
 * These are the answers an analyst acts on differently, which is why they are
 * separate codes rather than one. The two consumer-policy codes are limits of
 * *this build's policy*, and they are distinguished because one lifts on its own
 * and the other does not. `CONSUMER_NOT_GOVERNED` means the archive and the
 * authority-owned policy disagree about *which* consumers are governed — the
 * archive names one the policy does not govern, or the policy governs one the
 * archive's uses never mention. Like the code it replaces, a build limit that
 * lifts when the registry gains that entry.
 * `CONSUMER_POLICY_REFUSED` means the policy *does* govern the consumer but the
 * recorded use cannot be bound or resolved under it: a disagreement between the
 * archive and the policy, which no future build resolves. The three `*_MISMATCH`
 * codes are disagreements between the archive's commitment and what the replay
 * reconstructed, and no future tranche resolves them — the archive or the
 * runtime has to be corrected.
 */
export type ReplayEvidenceRefusalCode =
  | 'CONSUMER_NOT_GOVERNED'
  | 'CONSUMER_POLICY_REFUSED'
  | 'DATASET_MISMATCH'
  | 'KERNEL_MISMATCH'
  | 'INVESTIGATION_DIGEST_MISMATCH';

/**
 * How a policy refusal is classified for the analyst.
 *
 * Written as an exhaustive map rather than a comparison so a status added to
 * `bindConsumerUsesV1` later is a compile error here instead of a silently
 * reused classification. The split follows the paragraph above: both ways the
 * archive and the policy can disagree about *which* consumers are governed are
 * `CONSUMER_NOT_GOVERNED`, and both ways a governed consumer's recorded profile
 * can fail under the policy are `CONSUMER_POLICY_REFUSED`.
 */
const POLICY_REFUSAL_CODE: Record<
  ConsumerBindingRefusalV1['status'],
  ReplayEvidenceRefusalCode
> = {
  UNKNOWN_CONSUMER: 'CONSUMER_NOT_GOVERNED',
  MISSING_USE: 'CONSUMER_NOT_GOVERNED',
  PROFILE_MISMATCH: 'CONSUMER_POLICY_REFUSED',
  UNKNOWN_REQUIREMENT_PROFILE: 'CONSUMER_POLICY_REFUSED',
};

/**
 * RFC 0009: what persisted governed evidence this replay run actually stands on.
 *
 * This exists because an empty `uses` array — the only shape this build can mint
 * — makes "a governed envelope was present, structurally verified, and enforces
 * nothing" indistinguishable from "no envelope exists at all" under a bare
 * `success: true`. Callers that render "verified" must read this, not `success`.
 *
 * `integrity` is an *envelope-level* claim, and it means one thing: the reserved
 * entry's byte digest matched, the closed envelope parsed, and its bundle
 * identity agreed with the analytical manifest. It is deliberately *not* a claim
 * that the replay reproduced the committed investigation — that is reported by
 * `refusal` (plus `success: false`), because a reconstruction disagreement needs
 * a different remediation from a corrupt archive and the two must stay
 * distinguishable. It is also not a claim that the payload is otherwise intact:
 * a damaged dataset or command-log entry reaches a failure with a verified
 * envelope and a discrepancy naming the damaged part.
 *
 * So `integrity` must be read together with `success` — reading it alone as
 * "this archive is sound" is wrong whenever `success` is false, whether the
 * reason appears as a `refusal` or only as a discrepancy.
 *
 * `envelope` and `integrity` are independent axes so `enforcement` can never
 * contradict the tag. `enforcement` reports whether this run actually applied
 * the authority-owned consumer policy (RFC 0009 tranche 3 slice 2): since the
 * registry's first entry landed, a verifying run over governed bytes binds the
 * persisted uses and reports `'consumer-policy'`; a build whose authority still
 * governs no consumer would report `'none'`, which remains representable so a
 * policy-shaped build can never be confused with none. The union is deliberately
 * exhaustive-with-widening rather than defaulted: the slice-1 falsifier pinned
 * `'none'` against an empty registry, so landing the first entry forced this
 * change to reopen instead of letting the meaning drift under a silent widen.
 *
 * It says `'none'` on a *refusal* attestation even when the policy decides the
 * refusal, and that is not the same claim as "no policy was consulted": what
 * `enforcement` asserts is that some consumer's requirements were *enforced*
 * for a run that completed. A refused run trivially enforced nothing. Scoping
 * it as "this run enforced nothing" rather than "this build consulted nothing"
 * is what keeps it true on both variants.
 */
export type ReplayEvidenceAttestation =
  | { readonly envelope: 'absent' }
  | {
      readonly envelope: 'present';
      readonly integrity: 'verified';
      readonly enforcement: 'none' | 'consumer-policy';
      readonly refusal?: { readonly code: ReplayEvidenceRefusalCode };
    }
  | { readonly envelope: 'present'; readonly integrity: 'not-established' };

/**
 * RFC 0009: the only governed-integrity attestation this build may report.
 *
 * A named constructor rather than an inline literal at each site, because the
 * `enforcement` value is the single claim here that is a statement about *this
 * build* rather than about the archive. Since the first registry entry landed,
 * a *successful* run binds persisted uses under the authority-owned consumer
 * policy, so it reports `'consumer-policy'`; a refused run reports `'none'`
 * because it enforced no consumer's requirements. Reading the live registry
 * (rather than hard-coding a value) keeps this constructor honest for a build
 * whose authority governs no consumer at all.
 */
function verifiedEvidence(
  refusal?: ReplayEvidenceRefusalCode,
): ReplayEvidenceAttestation {
  return {
    envelope: 'present',
    integrity: 'verified',
    enforcement:
      refusal === undefined && governedConsumerPolicyV1().size > 0
        ? 'consumer-policy'
        : 'none',
    ...(refusal === undefined ? {} : { refusal: { code: refusal } }),
  };
}

export interface ReplayVerificationResult {
  success: boolean;
  /**
   * RFC 0009: required, never optional. An optional member would make "not
   * populated" and "no envelope exists" the same observable — reproducing at
   * this level the absence-reads-as-legacy encoding that already lets a V3
   * package which lost its envelope pass for a V2 one.
   */
  evidence: ReplayEvidenceAttestation;
  sessionId: string;
  datasetName: string;
  datasetFingerprint: string;
  commandsReplayed: number;
  eventsMatched: number;
  provenanceEventsVerified: number;
  representationProvenanceVerified: boolean;
  discoveryProvenanceVerified: number;
  nilProvenanceVerified: number;
  remediationEventsVerified: number;
  refusalEventsVerified: number;
  finalOutputHash: string;
  investigationDigest: string;
  evidenceCount: {
    observations: number;
    findings: number;
    annotations: number;
  };
  discrepancies: string[];
  historicalInspectionCapability?: HistoricalInspectionCapability | null;
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

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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
  if (stableJson(actual.spec) !== stableJson(expected.spec)) {
    discrepancies.push(`analysis spec expected ${stableJson(expected.spec)}, replay produced ${stableJson(actual.spec)}`);
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
  if (candidate.decisionStatus !== undefined && ![
    'DECISIVE', 'AMBIGUOUS', 'ABSTAIN', 'INFEASIBLE', 'UNDERDETERMINED',
  ].includes(candidate.decisionStatus)) {
    throw new Error('representation state has an unknown historical decisionStatus');
  }
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

function compareRemediationEvent(
  expected: ResearchEvent,
  actual: ResearchEvent,
  index: number,
): string[] {
  const discrepancies: string[] = [];
  const exp = expected.remediationEvent;
  const act = actual.remediationEvent;
  if (!exp || !act) {
    discrepancies.push(`Remediation event at #${index}: missing remediationEvent in expected or actual`);
    return discrepancies;
  }
  const fields: Array<keyof typeof exp> = [
    'remediationId', 'kind', 'constraintCode', 'category',
    'scientificPermissibility', 'deviceFeasibility', 'datasetFingerprint',
    'oldRequirementsHash', 'newRequirementsHash', 'requirementPatch',
    'resultingDecisionId', 'timestamp',
  ];
  for (const field of fields) {
    if (stableJson(exp[field]) !== stableJson(act[field])) {
      discrepancies.push(`Remediation ${field} at #${index} expected '${stableJson(exp[field])}', replay produced '${stableJson(act[field])}'`);
    }
  }
  return discrepancies;
}

function compareRefusalEvent(
  expected: ResearchEvent,
  actual: ResearchEvent,
  index: number,
): string[] {
  const discrepancies: string[] = [];
  const exp = expected.refusalEvent;
  const act = actual.refusalEvent;
  if (!exp || !act) {
    discrepancies.push(`Refusal event at #${index}: missing refusalEvent in expected or actual`);
    return discrepancies;
  }
  const fields: Array<keyof typeof exp> = [
    'operation', 'parameters', 'inputFingerprint', 'provenance',
    'preflight', 'timestamp', 'datasetFingerprint', 'datasetVersion',
  ];
  for (const field of fields) {
    if (stableJson(exp[field]) !== stableJson(act[field])) {
      discrepancies.push(`Refusal ${field} at #${index} expected '${stableJson(exp[field])}', replay produced '${stableJson(act[field])}'`);
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
      evidenceReceiptBytes,
    } = payload;
    const isLegacyV1 = manifest.formatVersion === LEGACY_NEMOSYNE_PACKAGE_FORMAT_VERSION;
    const isV2 = manifest.formatVersion === NEMOSYNE_PACKAGE_FORMAT_VERSION;
    const isV3 = manifest.formatVersion === GOVERNED_NEMOSYNE_PACKAGE_FORMAT_VERSION;
    const isV4 = manifest.formatVersion === FORMA_PACKAGE_FORMAT_VERSION;

    // RFC 0009 step 1: dispatch on the exact package/digest version before
    // parsing datasets, constructing Atlas, or executing any kernel operation.
    // A package that never declared V3 carries no governed envelope, so its
    // failures attest `absent` rather than `not-established`.
    if (!isLegacyV1 && !isV2 && !isV3 && !isV4) {
      return this._failedResult(manifest,
        [`Unsupported replay package formatVersion '${String(manifest.formatVersion)}'`],
        { envelope: 'absent' });
    }
    if (isLegacyV1) {
      if (manifest.investigationDigestAlgorithm) {
        return this._failedResult(manifest,
          ['Format-v1 package cannot declare an investigation digest algorithm'],
          { envelope: 'absent' });
      }
    } else if (isV2) {
      if (manifest.investigationDigestAlgorithm != null &&
          manifest.investigationDigestAlgorithm !== INVESTIGATION_DIGEST_ALGORITHM) {
        return this._failedResult(manifest,
          ['Unsupported investigation digest algorithm for a format-v2 package'],
          { envelope: 'absent' });
      }
    } else if (manifest.investigationDigestAlgorithm !== GOVERNED_INVESTIGATION_DIGEST_ALGORITHM) {
      // A V3/V4 declaration without the governed digest contract is malformed input.
      return this._failedResult(manifest,
        [`Governed format-v${manifest.formatVersion} package requires its investigation digest algorithm`],
        { envelope: 'present', integrity: 'not-established' });
    } else if (typeof manifest.investigationDigest !== 'string' || manifest.investigationDigest === '') {
      return this._failedResult(manifest,
        [`Governed format-v${manifest.formatVersion} package is missing its investigation digest`],
        { envelope: 'present', integrity: 'not-established' });
    } else if (!/^[0-9a-f]{64}$/.test(manifest.investigationDigest)) {
      return this._failedResult(manifest,
        [`Governed format-v${manifest.formatVersion} package requires its investigation digest as a lowercase SHA-256 digest`],
        { envelope: 'present', integrity: 'not-established' });
    }

    // RFC 0009 step 2: verify the reserved entry's byte digest and parse the
    // closed envelope. `replayPayload` is public and may be handed a payload
    // that never passed through `unpack`, so the loader re-runs this itself
    // instead of assuming transport validation already happened.
    let envelope: PersistedEvidenceReceiptsV1 | null = null;
    let receiptSnapshot: Uint8Array | null = null;
    let historicalInspectionCapability: HistoricalInspectionCapability | null = null;
    if (isV3 || isV4) {
      if (!evidenceReceiptBytes) {
        return this._failedResult(manifest,
          [`Format-v${manifest.formatVersion} package is missing evidence receipts`],
          { envelope: 'present', integrity: 'not-established' });
      }
      // One owned copy of the verbatim bytes: the commitment below is over
      // these bytes, never over a re-serialization of the parsed envelope.
      receiptSnapshot = new Uint8Array(evidenceReceiptBytes);
      try {
        if (sha256Hex(receiptSnapshot) !== manifest.evidenceReceiptDigest) {
          throw new Error('Evidence receipt entry digest mismatch');
        }
        envelope = parsePersistedEvidenceReceiptsV1(
          JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(receiptSnapshot)));
        if (envelope.bundle.datasetFingerprint !== manifest.analyticalDatasetFingerprint ||
            envelope.bundle.kernelVersion !== manifest.analyticalKernelVersion) {
          throw new Error('Evidence receipt bundle identity does not match analytical manifest identity');
        }
      } catch (e) {
        return this._failedResult(manifest,
          [`Governed evidence integrity failure: ${(e as Error).message}`],
          { envelope: 'present', integrity: 'not-established' });
      }

      if (isV4) {
        if (!payload.formaInvestigationBytes) {
          return this._failedResult(manifest,
            ['Format-v4 package is missing forma investigation data'],
            { envelope: 'present', integrity: 'not-established' });
        }
        const formaSnapshot = new Uint8Array(payload.formaInvestigationBytes);
        try {
          if (sha256Hex(formaSnapshot) !== manifest.formaDigest) {
            throw new Error('Forma investigation entry digest mismatch');
          }
          const formaJson = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(formaSnapshot));
          const capture = formaJson.staticCapture;
          const isConjectural = capture?.status === 'CAPTURED' && capture.isConjectural === true;
          historicalInspectionCapability = createHistoricalInspectionCapability(
            manifest.formaDigest!,
            isConjectural
          );
        } catch (e) {
          return this._failedResult(manifest,
            [`Governed forma integrity failure: ${(e as Error).message}`],
            { envelope: 'present', integrity: 'not-established' });
        }
      }
      // RFC 0009 tranche 3: the loader no longer answers this from the envelope's
      // shape. It asks the authority-owned policy, so it is the policy — not a
      // claim about what this build can read — that decides. Binding is data-only
      // and consults no kernel, so it stays here, before reconstruction and before
      // any bridge access, which is what keeps a refusal from touching the runtime
      // at all rather than merely declining to use it.
      //
      // The predicate is deliberately wider than "not BOUND". `bindConsumerUsesV1`
      // returns `BOUND` as soon as the consumer and profile *identities* agree —
      // even when the receipt is absent from the bundle or its assumptions are
      // violated, which it reports in `resolution` instead. Accepting a use on
      // identity agreement alone would open an archive whose required evidence does
      // not actually resolve, so a bound-but-unresolved use refuses here too.
      const policyBindings = bindConsumerUsesV1({
        envelope,
        requiredConsumers: governedConsumerPolicyV1(),
      });
      const unresolvedBinding = policyBindings.find(
        (binding) =>
          binding.status !== 'BOUND' || binding.resolution.status !== 'RESOLVED',
      );
      if (unresolvedBinding !== undefined) {
        // A policy limit or a policy disagreement, never an archive defect, so it
        // reports as typed *unavailable* carrying the verbatim envelope's verified
        // integrity rather than as a discrepancy. Folding it into `discrepancies`
        // would make it indistinguishable from a corrupt package, and — more
        // importantly — would hide the day this build's policy governs the
        // consumer and the same archive silently becomes openable with nobody
        // re-examining the classification.
        return this._failedResult(
          manifest,
          [],
          verifiedEvidence(
            unresolvedBinding.status === 'BOUND'
              // Bound, so the consumer *is* governed and the identities agreed —
              // what refuses is the receipt under the recorded profile.
              ? 'CONSUMER_POLICY_REFUSED'
              : POLICY_REFUSAL_CODE[unresolvedBinding.status],
          ),
        );
      }
    }

    const isLegacyV1Identity =
      isLegacyV1 &&
      !manifest.datasetIdentityAlgorithm &&
      /^\d+$/.test(manifest.datasetFingerprint);
    // V3 commits the semantic digest; V2 commits it only when the package
    // actually declares the V2 algorithm. The guard is deliberately keyed on the
    // *declared algorithm* rather than on the format version, because
    // pre-RF-046 format-v2 packages carry no algorithm label and were digested
    // with the legacy schema-v1 contract — routing them through the semantic
    // digest breaks every historical package that still opens today.
    //
    // The previous expression tested only the V2 algorithm, so a V3 package fell
    // to the legacy path: no command-count check, legacy analysis-spec
    // extraction, re-executed mutating operations and no ledger restore — a
    // silent downgrade to weaker verification. Adding `isV3` fixes that without
    // disturbing either V2 case.
    const usesSemanticDigest =
      manifest.investigationDigestAlgorithm === INVESTIGATION_DIGEST_ALGORITHM || isV3;
    // Past step 2 the envelope question is already settled: for V3 it verified,
    // and for anything else there is none to verify. A later failure is a
    // *damaged payload* — unparseable dataset bytes, a command log that is not
    // an array — which is a discrepancy about the replay, not a claim that the
    // evidence envelope was never established. Reporting `not-established` here
    // would give `integrity` a second meaning ("the run got as far as step 2")
    // and classify a perfectly verified envelope as corrupt, which is precisely
    // the misreading the axis exists to prevent. Legacy/V2 still report `absent`
    // so the difference between "nothing to enforce" and "governed evidence
    // verified" survives.
    const postEnvelopeEvidence: ReplayEvidenceAttestation = isV3
      ? verifiedEvidence()
      : { envelope: 'absent' };

    let dataset: Dataset;
    try {
      dataset = Dataset.fromJSON(JSON.parse(strFromU8(datasetBytes)));
    } catch (e) {
      discrepancies.push(`Failed to parse dataset from package: ${(e as Error).message}`);
      return this._failedResult(manifest, discrepancies, postEnvelopeEvidence);
    }
    const computedPackageFingerprint = isLegacyV1Identity ? String(dataset.seedHash) : dataset.fingerprint;
    if (computedPackageFingerprint !== String(manifest.datasetFingerprint)) {
      discrepancies.push(`Dataset fingerprint mismatch: package manifest has '${manifest.datasetFingerprint}', dataset computed '${computedPackageFingerprint}'`);
    }

    let loggedEvents: (AnalysisSpec | ResearchEvent)[] = [];
    try {
      const parsed: unknown = JSON.parse(strFromU8(commandLogBytes));
      if (!Array.isArray(parsed)) {
        discrepancies.push('Failed to parse command log: top-level value must be an array');
        return this._failedResult(manifest, discrepancies, postEnvelopeEvidence);
      }
      loggedEvents = parsed as (AnalysisSpec | ResearchEvent)[];
    } catch (e) {
      discrepancies.push(`Failed to parse command log: ${(e as Error).message}`);
      return this._failedResult(manifest, discrepancies, postEnvelopeEvidence);
    }
    if (usesSemanticDigest && loggedEvents.length !== manifest.commandCount) {
      discrepancies.push(`Semantic-v2 command count mismatch: manifest expected ${manifest.commandCount}, log contains ${loggedEvents.length}`);
    }

    let representationDecision: RepresentationDecision | null = null;
    if (representationDecisionBytes) {
      try {
        representationDecision = parseRepresentationDecision(representationDecisionBytes);
      } catch (e) {
        discrepancies.push(`Failed to parse representation state from package: ${(e as Error).message}`);
        return this._failedResult(manifest, discrepancies, postEnvelopeEvidence);
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
      (item): item is ResearchEvent => isObjectRecord(item) && 'kind' in item && item.kind === 'load',
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

    // RFC 0009 step 3: compare the persisted bundle identity against the state
    // this replay actually reconstructed, never against the manifest strings
    // that transport validation already compared. Sourcing these from the
    // manifest would make the two refusals below unreachable dead code. The
    // reconstructable identity is the *transformed analytical* fingerprint, so
    // it is deliberately not the manifest's portable datasetFingerprint.
    if (envelope) {
      const reconstructedAnalyticalFingerprint = atlas.datasetFingerprint;
      if (envelope.bundle.datasetFingerprint !== reconstructedAnalyticalFingerprint) {
        discrepancies.push(
          'Governed evidence dataset identity does not match the reconstructed analytical dataset: ' +
          `bundle claims '${envelope.bundle.datasetFingerprint}', replay reconstructed '${String(reconstructedAnalyticalFingerprint)}'`);
        return this._failedResult(
          manifest,
          discrepancies,
          verifiedEvidence('DATASET_MISMATCH'),
        );
      }
      if (envelope.bundle.kernelVersion !== replayKernelVersion) {
        discrepancies.push(
          'Governed evidence kernel identity does not match the replay kernel: ' +
          `bundle claims '${envelope.bundle.kernelVersion}', replay kernel is '${String(replayKernelVersion)}'`);
        return this._failedResult(
          manifest,
          discrepancies,
          verifiedEvidence('KERNEL_MISMATCH'),
        );
      }
    }

    let commandsReplayed = 0;
    let eventsMatched = 0;
    let provenanceEventsVerified = 0;
    let representationProvenanceVerified = false;
    let remediationEventsVerified = 0;
    let refusalEventsVerified = 0;

    for (let i = 0; i < loggedEvents.length; i++) {
      const item = loggedEvents[i];
      if (isObjectRecord(item) && 'kind' in item) {
        const event = item as unknown as ResearchEvent;
        switch (event.kind) {
          case 'load':
            eventsMatched += 1;
            break;
          case 'analysis': {
            if (!event.result) {
              if (usesSemanticDigest) {
                if (typeof event.intervention === 'string' && event.intervention.length > 0) eventsMatched += 1;
                else discrepancies.push(`Malformed semantic-v2 analysis event at #${i}: missing result and intervention`);
                break;
              }
            }
            const spec = usesSemanticDigest ? eventAnalysisSpec(event) : (event.command as AnalysisSpec);
            if (!spec) {
              discrepancies.push(`Malformed analysis event at #${i}: missing executable AnalysisSpec`);
              break;
            }
            try {
              const res = atlas.applyAnalysis(spec);
              commandsReplayed += 1;
              let eventMatches = true;
              if (event.result) {
                if (usesSemanticDigest) {
                  const resultDiscrepancies = compareAnalysisResult(event.result, res);
                  if (resultDiscrepancies.length === 0 && event.result.provenance) provenanceEventsVerified += 1;
                  if (resultDiscrepancies.length > 0) {
                    eventMatches = false;
                    for (const entry of resultDiscrepancies) {
                      discrepancies.push(`Analysis drift at event #${i} (${spec.label ?? spec.operation.op}): ${entry}`);
                    }
                  }
                } else {
                  if (event.result.outputHash && res.outputHash !== event.result.outputHash) {
                    discrepancies.push(`Output hash drift at event #${i} (${spec.label ?? spec.operation.op}): expected ${event.result.outputHash}, computed ${res.outputHash}`);
                    eventMatches = false;
                  }
                  if (event.result.provenance) {
                    const provenanceDiscrepancies = compareProvenance(event.result.provenance, res.provenance);
                    if (provenanceDiscrepancies.length === 0) provenanceEventsVerified += 1;
                    else {
                      eventMatches = false;
                      for (const entry of provenanceDiscrepancies) {
                        discrepancies.push(`Provenance drift at event #${i} (${spec.label ?? spec.operation.op}): ${entry}`);
                      }
                    }
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
              if (!usesSemanticDigest) atlas.recordObservation(event.observationEntity);
              eventsMatched += 1;
            } else discrepancies.push(`Malformed observation event at #${i}: missing observationEntity`);
            break;
          case 'finding':
            if (event.findingEntity) {
              if (!usesSemanticDigest) atlas.recordFinding(event.findingEntity);
              eventsMatched += 1;
            } else discrepancies.push(`Malformed finding event at #${i}: missing findingEntity`);
            break;
          case 'annotation':
            if (event.annotationEntity) {
              if (!usesSemanticDigest) atlas.recordAnnotation(event.annotationEntity);
              eventsMatched += 1;
            } else discrepancies.push(`Malformed annotation event at #${i}: missing annotationEntity`);
            break;
          case 'structure':
            if (event.structureSet) {
              if (!usesSemanticDigest) atlas.evidenceLedger.recordStructure(event.structureSet, manifest.sessionId, event.timestamp);
              eventsMatched += 1;
            } else discrepancies.push(`Malformed structure event at #${i}: missing structureSet`);
            break;
          case 'recommendation':
            if (event.recommendationDecision) {
              if (!usesSemanticDigest) {
                const { eventId: _eventId, sessionId: _sessionId, ...replayEvent } = event;
                atlas.evidenceLedger.appendEvent(replayEvent, manifest.sessionId);
              }
              eventsMatched += 1;
            } else discrepancies.push(`Malformed recommendation event at #${i}: missing recommendationDecision`);
            break;
          case 'embodiment':
            if (event.embodimentCommand) {
              if (!usesSemanticDigest) atlas.recordEmbodimentCommand(event.embodimentCommand);
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
            if (usesSemanticDigest && !event.remediationEvent) {
              discrepancies.push(`Malformed remediation event at #${i}: missing remediationEvent`);
            } else eventsMatched += 1;
            break;
          case 'refusal':
            if (usesSemanticDigest && !event.refusalEvent) {
              discrepancies.push(`Malformed refusal event at #${i}: missing refusalEvent`);
            } else eventsMatched += 1;
            break;
          default:
            discrepancies.push(`Unsupported or unrecognized event kind at #${i}: '${String(event.kind)}'`);
        }
      } else if (usesSemanticDigest) {
        discrepancies.push(`Semantic-v2 command log entry #${i} is missing a research-event kind`);
      } else if (!isObjectRecord(item)) {
        discrepancies.push(`Legacy command log entry #${i} must be an object`);
      } else {
        try {
          atlas.applyAnalysis(item as unknown as AnalysisSpec);
          commandsReplayed += 1;
          eventsMatched += 1;
        } catch (err) {
          discrepancies.push(`Replay execution failure for spec #${i}: ${(err as Error).message}`);
        }
      }
    }

    if (usesSemanticDigest) {
      // RF-047: after authoritative mutating operations have been independently
      // re-executed and verified, the persisted semantic ledger is the authority
      // for durable IDs, attribution and non-mutating provenance. Restore it
      // exactly rather than re-generating equivalent-looking events with fresh
      // counters/timestamps. This also rebuilds structures/observations/findings/
      // annotations from the authoritative ledger.
      const semanticEvents = loggedEvents.filter(
        (item): item is ResearchEvent => isObjectRecord(item) && 'kind' in item,
      );
      const recordedResults = semanticEvents
        .filter((event) => event.kind === 'analysis' && event.result)
        .map((event) => event.result as AnalysisResult);
      atlas.evidenceLedger.restore(recordedResults, semanticEvents);

      // RF-047: verify that remediation and refusal events are reconstructed
      // in the replay ledger with identical provenance (event order, payload).
      const replayRemediations = atlas.remediationEvents();
      const originalRemediations = semanticEvents.filter((e) => e.kind === 'remediation');
      if (replayRemediations.length !== originalRemediations.length) {
        discrepancies.push(`Remediation event count mismatch: expected ${originalRemediations.length}, replay ledger has ${replayRemediations.length}`);
      } else {
        for (let i = 0; i < originalRemediations.length; i++) {
          const origEvent = originalRemediations[i];
          const replayEvent = atlas.evidenceLedger.ledger.find((e) => e.kind === 'remediation' && e.remediationEvent?.remediationId === origEvent.remediationEvent?.remediationId);
          if (!replayEvent) {
            discrepancies.push(`Remediation event ${origEvent.remediationEvent?.remediationId} at index ${i} not found in replay ledger`);
          } else {
            const disc = compareRemediationEvent(origEvent, replayEvent, i);
            if (disc.length > 0) discrepancies.push(...disc);
            else remediationEventsVerified += 1;
          }
        }
      }

      const replayRefusals = atlas.evidenceLedger.refusalEvents();
      const originalRefusals = semanticEvents.filter((e) => e.kind === 'refusal');
      if (replayRefusals.length !== originalRefusals.length) {
        discrepancies.push(`Refusal event count mismatch: expected ${originalRefusals.length}, replay ledger has ${replayRefusals.length}`);
      } else {
        for (let i = 0; i < originalRefusals.length; i++) {
          const origEvent = originalRefusals[i];
          const replayEvent = atlas.evidenceLedger.ledger.find((e) => e.kind === 'refusal' && e.refusalEvent?.provenance?.operation === origEvent.refusalEvent?.provenance?.operation);
          if (!replayEvent) {
            discrepancies.push(`Refusal event at index ${i} not found in replay ledger`);
          } else {
            const disc = compareRefusalEvent(origEvent, replayEvent, i);
            if (disc.length > 0) discrepancies.push(...disc);
            else refusalEventsVerified += 1;
          }
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
    let investigationDigest: string;
    if (usesSemanticDigest) {
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
      const digestOptions = {
        nilOutcomes: nilOutcomes?.outcomes ?? [],
        researchContext: context,
      };
      // RFC 0009 step 4: recompute the V3 investigation digest over the restored
      // semantic state *and* the exact evidence envelope bytes — a member
      // checksum alone is not investigation integrity. The kernel identity is
      // the persisted bundle's own, which step 3 has already proven equal to the
      // reconstructed replay kernel. Committing the verbatim snapshot (never a
      // re-serialization) is what binds the digest to the delivered bytes.
      investigationDigest = envelope && receiptSnapshot
        ? await atlas.aggregate.computeDigest(envelope.bundle.kernelVersion, {
            ...digestOptions,
            evidenceReceiptBytes: receiptSnapshot,
          })
        : await atlas.aggregate.computeDigest(manifest.kernelVersion || 'unknown', digestOptions);
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

    // RFC 0009: the attestation must not overclaim. `integrity` is an
    // *envelope-level* property, and it means exactly one thing — the reserved
    // entry's byte digest matched, the closed envelope parsed, and its bundle
    // identity agreed with the analytical manifest. It does not, by itself,
    // assert that the replay reproduced the committed investigation: a
    // reconstruction disagreement is reported by a typed refusal code (with
    // `success: false`), because the envelope genuinely is intact and the
    // remediation is different from that of a corrupt archive. Keeping the two
    // channels distinct is the point; collapsing a reconstruction disagreement
    // into `not-established` would blame the archive's bytes for it.
    //
    // A digest disagreement is one of those reconstruction disagreements, so it
    // reports as a typed refusal rather than as a broken envelope.
    const governedCommitmentEstablished =
      !isV3 || manifest.investigationDigest === investigationDigest;
    const resultEvidence: ReplayEvidenceAttestation = !isV3
      ? { envelope: 'absent' }
      : governedCommitmentEstablished
        ? verifiedEvidence()
        : verifiedEvidence('INVESTIGATION_DIGEST_MISMATCH');

    return {
      // `success` is the field every pre-existing caller branches on, so a V3
      // run may only report it when its governed commitment was actually
      // established. This is defence in depth rather than a live fix: the
      // mismatch above also records a discrepancy, so `success` would be false
      // anyway. It is stated here because "V3 success implies a verified
      // commitment" is the invariant the attestation stands on, and leaving it
      // to the agreement of two separate guards is what let the missing-digest
      // case report success in the first place.
      success: discrepancies.length === 0 && governedCommitmentEstablished,
      evidence: resultEvidence,
      sessionId: manifest.sessionId,
      datasetName: manifest.datasetName,
      datasetFingerprint: manifest.datasetFingerprint,
      commandsReplayed,
      eventsMatched,
      provenanceEventsVerified,
      representationProvenanceVerified,
      discoveryProvenanceVerified,
      nilProvenanceVerified,
      remediationEventsVerified,
      refusalEventsVerified,
      finalOutputHash,
      investigationDigest,
      evidenceCount: {
        observations: atlas.evidenceLedger.observations.length,
        findings: atlas.evidenceLedger.findings.length,
        annotations: atlas.evidenceLedger.annotations.length,
      },
      discrepancies,
      historicalInspectionCapability,
    };
  }

  private _failedResult(
    manifest: NemosynePackageManifest,
    discrepancies: string[],
    evidence: ReplayEvidenceAttestation,
  ): ReplayVerificationResult {
    return {
      success: false,
      evidence,
      sessionId: manifest.sessionId,
      datasetName: manifest.datasetName,
      datasetFingerprint: manifest.datasetFingerprint,
      commandsReplayed: 0,
      eventsMatched: 0,
      provenanceEventsVerified: 0,
      representationProvenanceVerified: false,
      discoveryProvenanceVerified: 0,
      nilProvenanceVerified: 0,
      remediationEventsVerified: 0,
      refusalEventsVerified: 0,
      finalOutputHash: '',
      investigationDigest: '',
      evidenceCount: { observations: 0, findings: 0, annotations: 0 },
      discrepancies,
      historicalInspectionCapability: null,
    };
  }
}
