import { describe, expect, it } from 'vitest';
import type { ImmutableReferenceV1 } from '../src/governance/GovernedEventContracts.ts';
import {
  TrustedEd25519KeyRegistryV1,
} from '../src/security/TrustedEd25519Keys.ts';
import {
  StabilityPolicyRegistryV1,
  TrustedStabilityCertificateVerifierV1,
  signStabilityCertificateV1,
  type StabilityCertificateContentV1,
  type StabilityVerificationContextV1,
  type VerifiedStabilityAdmissionClaimV1,
} from '../src/moneta/representation/StabilityCertificate.ts';
import { MonetaHypothesisEngine } from '../src/moneta/representation/MonetaHypothesisEngine.ts';
import { minimalDatasetSignature } from '../src/moneta/representation/DatasetSignature.ts';
import { RepresentationState } from '../src/atlas/domain/RepresentationState.ts';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';
import { representationDecisionToGraph } from '../src/moneta/representation/RepresentationGraphAdapter.ts';
import { applyPinnedLearnedFitnessRuntime } from '../src/moneta/representation/LearnedMonetaRuntime.ts';

const digest = (character: string) => ({ algorithm: 'SHA256' as const, value: character.repeat(64) });

function reference(id: string, character: string): ImmutableReferenceV1 {
  return { schemaVersion: '1', id, version: '1.0.0', digest: digest(character) };
}

const policy = reference('policy:bounded-perturbation-observation', 'a');
const featureArtifact = reference('rust:effective-feature-authority', 'b');
const evidenceArtifact = reference('rust:perturbation-evidence', 'c');

function content(): StabilityCertificateContentV1 {
  return {
    schemaVersion: '1',
    certificateId: 'certificate-1',
    issuedAt: '2026-09-14T10:00:00.000Z',
    issuerKeyId: 'moneta-authority-1',
    datasetFingerprint: 'd'.repeat(64),
    candidateId: 'POINT_SET',
    representationFamily: 'POINT',
    effectiveFeatureAuthority: {
      schemaVersion: '1',
      authorityKind: 'RUST_WASM_EFFECTIVE_FEATURE_REFERENCE',
      authorityVersion: '1.0.0',
      orderedFeatureIds: ['feature:x', 'feature:y'],
      effectiveFeatureCount: 2,
      artifact: featureArtifact,
    },
    perturbationProtocol: {
      protocolId: 'bounded-resampling',
      protocolVersion: '1.0.0',
      configurationDigest: digest('e'),
      runSetDigest: digest('f'),
      runCount: 32,
    },
    stabilityEvidence: {
      metricId: 'candidate-rank-stability',
      metricVersion: '1.0.0',
      evidenceArtifact,
      evidenceRunCount: 32,
      observedValues: [0.91],
      refusal: null,
    },
    governingPolicy: policy,
    runtimeIdentity: {
      analyticalKernelVersion: 'kernel-1.0.0',
      monetaVersion: '2.1.3-v5-bootstrap',
      fitnessModelVersion: 'bootstrap-fitness-v5',
      fitnessModelArtifactDigest: null,
    },
    replayBinding: {
      scope: 'SESSION',
      sessionId: 'session-1',
      evidenceGeneratedAt: '2026-09-14T09:00:00.000Z',
      compatibilityVersion: '1.0.0',
    },
  };
}

function context(): StabilityVerificationContextV1 {
  const certificate = content();
  return {
    datasetFingerprint: certificate.datasetFingerprint,
    candidateId: certificate.candidateId,
    representationFamily: certificate.representationFamily,
    analyticalAuthority: {
      status: 'REFERENCE_ONLY',
      effectiveFeatureAuthority: certificate.effectiveFeatureAuthority,
      perturbationProtocol: certificate.perturbationProtocol,
      stabilityMetricId: certificate.stabilityEvidence.metricId,
      stabilityMetricVersion: certificate.stabilityEvidence.metricVersion,
      perturbationEvidenceArtifact: certificate.stabilityEvidence.evidenceArtifact,
      perturbationEvidenceRunCount: certificate.stabilityEvidence.evidenceRunCount,
    },
    governingPolicy: certificate.governingPolicy,
    runtimeIdentity: certificate.runtimeIdentity,
    replayBinding: certificate.replayBinding,
  };
}

async function keyPair(): Promise<CryptoKeyPair> {
  return await globalThis.crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']) as CryptoKeyPair;
}

function verifier(publicKey: CryptoKey, status: 'ACTIVE' | 'RETIRED' = 'ACTIVE') {
  return new TrustedStabilityCertificateVerifierV1(
    new TrustedEd25519KeyRegistryV1([
      { keyId: 'moneta-authority-1', status, publicKey },
    ]),
    new StabilityPolicyRegistryV1([
      { policy, disposition: 'VERIFIED_NON_PROMOTABLE' },
    ]),
  );
}

describe('RFC 0006 signed stability certificates', () => {
  it('verifies an exact-context certificate but cannot promote without a scientific policy or Rust authority', async () => {
    const keys = await keyPair();
    const signed = await signStabilityCertificateV1(content(), keys.privateKey);
    const result = await verifier(keys.publicKey).verify(signed, context());

    expect(result.disposition).toBe('VERIFIED_NON_PROMOTABLE');
    expect(result.claim).not.toBeNull();
    expect(result.claim?.promotionDisposition).toBe('VERIFIED_NON_PROMOTABLE');
    expect(result.issues.map((issue) => issue.code)).toContain('EFFECTIVE_FEATURE_AUTHORITY_REFERENCE_ONLY');
  });

  it.each([
    ['datasetFingerprint', 'CROSS_DATASET_REPLAY'],
    ['candidateId', 'CROSS_CANDIDATE_REPLAY'],
    ['representationFamily', 'CROSS_CANDIDATE_REPLAY'],
    ['governingPolicy', 'POLICY_CONTEXT_MISMATCH'],
    ['runtimeIdentity', 'RUNTIME_CONTEXT_MISMATCH'],
    ['replayBinding', 'REPLAY_CONTEXT_MISMATCH'],
  ] as const)('rejects a mismatched %s context', async (field, issueCode) => {
    const keys = await keyPair();
    const signed = await signStabilityCertificateV1(content(), keys.privateKey);
    const mismatched = structuredClone(context()) as any;
    if (field === 'datasetFingerprint') mismatched.datasetFingerprint = '9'.repeat(64);
    if (field === 'candidateId') mismatched.candidateId = 'DENSITY_FIELD';
    if (field === 'representationFamily') mismatched.representationFamily = 'DISTRIBUTION';
    if (field === 'governingPolicy') mismatched.governingPolicy = reference('policy:other', '1');
    if (field === 'runtimeIdentity') mismatched.runtimeIdentity = { ...mismatched.runtimeIdentity, analyticalKernelVersion: 'kernel-2.0.0' };
    if (field === 'replayBinding') mismatched.replayBinding = { ...mismatched.replayBinding, sessionId: 'session-2' };

    const result = await verifier(keys.publicKey).verify(signed, mismatched);
    expect(result.disposition).toBe('INVALID');
    expect(result.claim).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain(issueCode);
  });

  it('rejects forged effective-feature identities even when the attacker re-signs them', async () => {
    const keys = await keyPair();
    const forged = content() as any;
    forged.effectiveFeatureAuthority = {
      ...forged.effectiveFeatureAuthority,
      orderedFeatureIds: ['feature:forged'],
      effectiveFeatureCount: 1,
    };
    const signed = await signStabilityCertificateV1(forged, keys.privateKey);
    const result = await verifier(keys.publicKey).verify(signed, context());

    expect(result.disposition).toBe('INVALID');
    expect(result.issues.map((issue) => issue.code)).toContain('EFFECTIVE_FEATURE_CONTEXT_MISMATCH');
  });

  it('rejects protocol/evidence substitution and run-count disagreement', async () => {
    const keys = await keyPair();
    const signed = await signStabilityCertificateV1(content(), keys.privateKey);

    const substituted = structuredClone(context()) as any;
    substituted.analyticalAuthority.perturbationEvidenceArtifact = reference('rust:substitute', '8');
    const substitutionResult = await verifier(keys.publicKey).verify(signed, substituted);
    expect(substitutionResult.issues.map((issue) => issue.code)).toContain('PERTURBATION_EVIDENCE_MISMATCH');

    const protocolSubstitution = structuredClone(context()) as any;
    protocolSubstitution.analyticalAuthority.perturbationProtocol.runSetDigest = digest('7');
    const protocolResult = await verifier(keys.publicKey).verify(signed, protocolSubstitution);
    expect(protocolResult.issues.map((issue) => issue.code)).toContain('PERTURBATION_PROTOCOL_MISMATCH');

    const inflated = structuredClone(context()) as any;
    inflated.analyticalAuthority.perturbationEvidenceRunCount = 31;
    const inflatedResult = await verifier(keys.publicKey).verify(signed, inflated);
    expect(inflatedResult.issues.map((issue) => issue.code)).toContain('PERTURBATION_RUN_COUNT_MISMATCH');
  });

  it('rejects digest tampering, unknown keys, and retired keys', async () => {
    const keys = await keyPair();
    const signed = await signStabilityCertificateV1(content(), keys.privateKey);
    const tampered = structuredClone(signed) as any;
    tampered.stabilityEvidence.observedValues = [1];

    const tamperResult = await verifier(keys.publicKey).verify(tampered, context());
    expect(tamperResult.issues.map((issue) => issue.code)).toContain('CERTIFICATE_DIGEST_MISMATCH');

    const unknownResult = await new TrustedStabilityCertificateVerifierV1(
      new TrustedEd25519KeyRegistryV1([]),
      new StabilityPolicyRegistryV1([]),
    ).verify(signed, context());
    expect(unknownResult.issues.map((issue) => issue.code)).toContain('UNTRUSTED_ISSUER_KEY');

    const retiredResult = await verifier(keys.publicKey, 'RETIRED').verify(signed, context());
    expect(retiredResult.issues.map((issue) => issue.code)).toContain('RETIRED_ISSUER_KEY');

    const wrongKeys = await keyPair();
    const wrongKeyResult = await verifier(wrongKeys.publicKey).verify(signed, context());
    expect(wrongKeyResult.issues.map((issue) => issue.code)).toContain('INVALID_SIGNATURE');
  });

  it('rejects unknown certificate fields and caller-invented promotable policies', async () => {
    const keys = await keyPair();
    const withUnknownField = { ...content(), threshold: 0 } as any;
    await expect(signStabilityCertificateV1(withUnknownField, keys.privateKey)).rejects.toThrow(
      'exact closed V1 schema',
    );
    expect(() => new StabilityPolicyRegistryV1([
      { policy, disposition: 'PROMOTABLE' } as any,
    ])).toThrow('non-promotable');
  });

  it('preserves verified abstention when the referenced policy disappears', async () => {
    const keys = await keyPair();
    const signed = await signStabilityCertificateV1(content(), keys.privateKey);
    const result = await new TrustedStabilityCertificateVerifierV1(
      new TrustedEd25519KeyRegistryV1([{ keyId: 'moneta-authority-1', status: 'ACTIVE', publicKey: keys.publicKey }]),
      new StabilityPolicyRegistryV1([]),
    ).verify(signed, context());

    expect(result.disposition).toBe('VERIFIED_NON_PROMOTABLE');
    expect(result.claim).not.toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('GOVERNING_POLICY_UNAVAILABLE');
  });

  it('does not admit a caller-forged or cross-context cached claim', async () => {
    const keys = await keyPair();
    const signed = await signStabilityCertificateV1(content(), keys.privateKey);
    const result = await verifier(keys.publicKey).verify(signed, context());
    const authenticClaim = result.claim!;
    const forgedClaim = structuredClone(authenticClaim) as VerifiedStabilityAdmissionClaimV1;
    const signature = minimalDatasetSignature(2, 3, 0, 0, content().datasetFingerprint, 0);
    signature.provenance.kernelVersion = content().runtimeIdentity.analyticalKernelVersion;

    const forgedDecision = new MonetaHypothesisEngine().arbitrate(
      signature, undefined, undefined, undefined, undefined, forgedClaim,
    );
    expect(forgedDecision.decisionStatus).toBe('ABSTAIN');

    const otherDataset = structuredClone(signature);
    otherDataset.provenance.datasetFingerprint = '7'.repeat(64);
    const cachedDecision = new MonetaHypothesisEngine().arbitrate(
      otherDataset, undefined, undefined, undefined, undefined, authenticClaim,
    );
    expect(cachedDecision.decisionStatus).toBe('ABSTAIN');
  });

  it('records an authentic exact-runtime claim while preserving non-promotion', async () => {
    const keys = await keyPair();
    const signed = await signStabilityCertificateV1(content(), keys.privateKey);
    const result = await verifier(keys.publicKey).verify(signed, context());
    const signature = minimalDatasetSignature(2, 3, 0, 0, content().datasetFingerprint, 0);
    signature.provenance.kernelVersion = content().runtimeIdentity.analyticalKernelVersion;

    const decision = new MonetaHypothesisEngine().arbitrate(
      signature, undefined, undefined, undefined, undefined, result.claim!,
    );
    expect(decision.decisionStatus).toBe('ABSTAIN');
    expect(decision.provenance.stabilityCertificateDigest).toBe(signed.certificateDigest.value);
    expect(decision.provenance.stabilityAdmissionDisposition).toBe('VERIFIED_NON_PROMOTABLE');
    expect(decision.rulesEvaluated?.some((trace) => trace.reason.includes('3 features, 2 observations'))).toBe(true);
  });
});

describe('RFC 0006 Moneta admission semantics', () => {
  it('leaves p<n arbitration unchanged', () => {
    const decision = MonetaHypothesisEngine.arbitrate(
      minimalDatasetSignature(10, 2, 0, 0, '1'.repeat(64), 0),
    );
    expect(decision.decisionStatus).not.toBe('ABSTAIN');
    expect(decision.chosenCandidateId).toBeDefined();
  });

  it.each([[2, 2], [2, 3]])('returns inspectable ABSTAIN for n=%i, p=%i without admission', (rowCount, columnCount) => {
    const decision = MonetaHypothesisEngine.arbitrate(
      minimalDatasetSignature(rowCount, columnCount, 0, 0, '2'.repeat(64), 0),
    );
    expect(decision.decisionStatus).toBe('ABSTAIN');
    expect(decision.chosenCandidateId).toBeUndefined();
    expect(decision.rankedCandidates?.length).toBeGreaterThan(0);
    expect(decision.rankedCandidates?.some((candidate) => candidate.disqualificationCode === 'stability-evidence-required')).toBe(true);
    expect(() => representationDecisionToGraph(decision)).toThrow('ABSTAIN has no promoted candidate');
    expect(applyPinnedLearnedFitnessRuntime(decision, {} as any).decisionStatus).toBe('ABSTAIN');
  });

  it('keeps structural failure INFEASIBLE rather than rewriting it as scientific abstention', () => {
    const engine = new MonetaHypothesisEngine();
    const outcome = engine.diagnose(
      minimalDatasetSignature(10, 2, 0, 0, '3'.repeat(64), 0),
      {
        task: 'individual-inspection',
        requiredStructures: [],
        preservationGoals: [],
        acceptableLoss: {
          allowIdentityLoss: false,
          allowExactMetricLoss: false,
          allowClusterLoss: false,
          maxFrustumExclusionTolerance: 0,
        },
        scale: 'SMALL',
        hardwareConstraints: { maxElements: 1, targetFps: 90 },
        maxFrustumExclusionTolerance: 0,
        interactionBudget: 'LOW',
      },
    );
    expect(outcome.state).toBe('INFEASIBLE');
  });

  it('restores a historical disposition verbatim and never activates an abstained preview', () => {
    const historical = MonetaHypothesisEngine.arbitrate(
      minimalDatasetSignature(10, 2, 0, 0, '4'.repeat(64), 0),
    );
    historical.decisionStatus = 'INFEASIBLE';
    const sourceAtlas = new AtlasCore({ sessionId: 'historical-session' });
    sourceAtlas.aggregate.representation.restoreDecision(historical);
    const snapshot = new NemosyneSession({ atlas: sourceAtlas }).serialize();
    const restoredAtlas = new AtlasCore({ sessionId: 'restored-session' });
    NemosyneSession.deserialize(snapshot, restoredAtlas);
    expect(restoredAtlas.activeRepresentationDecision?.decisionStatus).toBe('INFEASIBLE');

    const abstention = MonetaHypothesisEngine.arbitrate(
      minimalDatasetSignature(2, 2, 0, 0, '5'.repeat(64), 0),
    );
    const state = new RepresentationState();
    state.restoreDecision(abstention);
    expect(state.activeDecision?.decisionStatus).toBe('ABSTAIN');
    expect(state.activeStrategy).toBeNull();
  });
});
