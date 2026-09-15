# RFC 0006 — Moneta stability certificates and scientific abstention

**Status:** accepted

## Context

PR #747 closed two concrete Moneta authority gaps:

- fresh `p >= n` arbitration now fails closed with typed `stability-evidence-required` near misses instead of promoting a representation without certified stability evidence;
- grouped aggregate intent is explicit in `RepresentationRequirements` rather than inferred from presentation encodings.

At that intermediate #747 integration point, the resulting system was intentionally conservative: Moneta could rank high-dimensional candidates, but could not promote them because no authority-bearing stability-certificate path existed. #749 subsequently implemented the accepted certificate-verification and explicit `ABSTAIN` design recorded below. It deliberately did not add a promotable scientific policy or a Rust/WASM candidate-specific effective-dimensionality receipt, so `p >= n` remains non-promotable at the current integration base.

The pre-implementation adversarial review for #749 found that a safe certificate could not be introduced as an ordinary local fix. It changed scientific-admissibility semantics and created a new trust boundary. Three authorities absent at that point had to be defined together:

1. who may issue or verify a certificate, including key/trust lifecycle;
2. which Rust-owned evidence establishes effective dimensionality and perturbation/replay identity;
3. which explicit governing policy may convert verified evidence into promotion eligibility.

Without defining these authorities, any certificate-shaped object or caller-supplied acceptance policy would recreate the self-certification bug closed in #747.

The same review found that scientific abstention was then encoded indirectly through `NoFeasibleRepresentationError` / `INFEASIBLE` plus a typed trace. Structural infeasibility and scientific non-admissibility therefore shared a transport even though they meant different things. #749 corrected that transport as recorded in ADR-0006.

## Decision

The accepted decision adopts a two-part authority model:

1. **Signed Stability Certificate V1**
   - a closed, versioned envelope whose content is canonically hashed and signed;
   - verification is performed only by a trusted authority configured outside candidate/caller control;
   - the certificate binds the exact dataset, candidate, effective feature authority, perturbation protocol, governing policy, model/runtime identities, run evidence, provenance, and replay context;
   - structural validity and cryptographic validity are necessary but not sufficient for promotion;
   - promotion requires an explicit authority-owned acceptance policy referenced by immutable identity.

2. **First-class scientific `ABSTAIN` disposition**
   - distinguishes “scientifically non-admissible under current evidence” from “structurally infeasible”;
   - preserves ranked near-miss evidence and typed reasons;
   - does not reinterpret every historical NIL/INFEASIBLE result as ABSTAIN;
   - stored historical decisions are not retroactively upgraded or certified.

### Proposed certificate content

The minimal certificate payload should bind:

- `schemaVersion`
- `certificateId`
- `issuedAt`
- `issuerKeyId`
- `datasetFingerprint`
- `candidateId`
- `representationFamily`
- `effectiveFeatureAuthority`
  - authority type/version
  - ordered effective feature identifiers
  - effective feature count
  - derivation artifact/reference owned by Rust/WASM authority
- `perturbationProtocol`
  - protocol id/version
  - deterministic configuration digest
  - seed-set/run-set digest
  - run count
- `stabilityEvidence`
  - metric id/version
  - evidence digest/reference
  - observed value(s)
  - missingness/refusal state when relevant
- `governingPolicy`
  - policy id/version
  - immutable artifact digest
- `runtimeIdentity`
  - analytical kernel version
  - Moneta/bootstrap version
  - learned model version/artifact hash when applicable
- `replayBinding`
  - investigation/session identity when the claim is session-scoped
  - evidence generation timestamp/version
  - replay compatibility version
- `certificateDigest`
- `signature`

The schema must be closed. Unknown fields, malformed identities, digest mismatches, unsigned envelopes, unknown signing keys, stale policies, or replay-binding mismatches fail closed.

### Effective dimensionality

Candidate-specific `p` may be used only when it is supplied by an explicit authority-bearing artifact produced by the analytical side of the Rust/WASM boundary. TypeScript candidate type, selected UI fields, presentation encodings, or inferred dataset-column subsets are not dimensionality authority.

Until such an artifact exists and verifies, dataset-wide `columnCount` remains the conservative `p`.

### Verification and promotion semantics

Certificate evaluation is split into four stages:

1. **Structure validation** — exact schema, valid identifiers, positive counts, closed enums, digest shapes.
2. **Cryptographic verification** — certificate digest and signature verify against a trusted key not supplied by the candidate/caller.
3. **Context binding** — dataset fingerprint, candidate, feature authority, runtime/model versions, perturbation protocol, and replay scope match the current arbitration context exactly.
4. **Policy adjudication** — the referenced authority-owned policy determines whether the verified evidence is promotion-eligible.

A certificate that passes stages 1–3 but references no available governing criterion remains **verified but non-promotable** and yields ABSTAIN. No universal stability threshold is introduced by this RFC.

### ABSTAIN semantics

Moneta gains an explicit scientific-admissibility disposition distinct from structural infeasibility.

- **ELIGIBLE** — structurally feasible and scientifically admissible under verified governing criteria.
- **ABSTAIN** — structurally feasible, but current evidence/authority is insufficient for promotion.
- **INFEASIBLE** — violates structural/resource/representation hard constraints.
- **INVALID** — malformed, contradictory, tampered, or otherwise unusable evidence/certificate.
- Existing human-dependent states remain governed by their current human-validation rules.

Ranked candidates and near-miss score components remain inspectable under ABSTAIN. A caller must not be able to turn ABSTAIN into ELIGIBLE by passing a verifier, policy, or certificate object directly.

## Threat model and adversarial attacks

The design must survive at least these attacks:

1. **Cross-dataset replay:** reuse a valid certificate on a different dataset with similar schema. Must fail fingerprint/context binding.
2. **Cross-candidate reuse:** reuse a certificate for another representation candidate or family. Must fail candidate binding.
3. **Forged effective feature set:** alter feature IDs/count while preserving other evidence. Must fail digest/signature or authority-artifact binding.
4. **Stale policy/model identity:** replay a certificate under a newer policy, Moneta runtime, kernel, or learned model. Must fail context compatibility unless explicitly allowed by a versioned compatibility rule.
5. **Caller-supplied authority:** pass a public key, verifier, acceptance policy, or permissive threshold from the call site. Must have no promotion authority.
6. **Perturbation substitution:** swap metric/protocol/run evidence while retaining a signed outer shape. Must fail digest/signature and evidence-reference binding.
7. **Run-count inflation:** claim more runs than the evidence artifact contains. Must fail evidence digest/reference verification.
8. **Session replay upgrade:** load a historical uncertified decision alongside a new valid certificate and silently promote it. Must not happen; replay restoration preserves historical state unless a new explicit re-adjudication operation is invoked.
9. **Signature/key confusion:** use a valid signature from an untrusted or retired key. Must fail trust-store/key-status verification.
10. **Policy disappearance:** certificate remains structurally/cryptographically valid but referenced policy is unavailable. Must ABSTAIN, not fall back to another policy.

## Production call path

The intended authority flow is:

`Rust analytical evidence -> authority-owned effective-feature / perturbation artifact -> signed stability certificate -> trusted certificate verifier -> Moneta scientific-admission gate -> utility ranking / RepresentationDecision`

The verifier may expose a compact verified claim to synchronous arbitration, but asynchronous cryptographic verification must happen before the claim enters the promotion path. The existing signed deployment-manifest infrastructure is prior art for canonical hashing, Ed25519 verification, key identity, and immutable references; it must not be copied into a competing trust system without shared ownership.

## Options considered

### A. Keep fail-closed `p >= n` forever

**Pros:** simplest and safest.

**Cons:** prevents scientifically justified high-dimensional representations even when robust evidence eventually exists; blocks PT9 goals.

**Decision:** retain as the default fallback, but not the end state.

### B. Caller-supplied policy + perturbation object

**Pros:** trivial to implement.

**Cons:** already falsified in #747 review; callers can self-certify arbitrary evidence.

**Decision:** reject.

### C. Unsigned certificate-shaped object

**Pros:** easy serialization and testing.

**Cons:** provenance is descriptive, not authoritative; replay/tampering cannot be distinguished.

**Decision:** reject for promotion authority.

### D. Hard-code one universal threshold in Moneta

**Pros:** synchronous and simple.

**Cons:** scientifically unjustified across benchmark families/tasks; conflates governing criteria with implementation constants.

**Decision:** reject.

### E. Signed certificate + trusted policy registry + explicit ABSTAIN

**Pros:** separates evidence, verification, policy, and ranking; replayable and auditable; fail-closed; compatible with existing signed-manifest patterns.

**Cons:** adds key/policy lifecycle and asynchronous verification complexity.

**Decision:** accepted and implemented by ADR-0006.

## Consequences

### Scientific

- High-dimensional promotion becomes possible only when evidence and governing criteria are both explicit.
- “Certificate exists” never becomes equivalent to “candidate is good.”
- Unknown policy or missing criteria preserve abstention.

### Security / trust

- Introduces a certificate trust boundary and therefore requires explicit key ownership, rotation/revocation, and trusted-key distribution.
- Certificate verification must reuse or deliberately integrate with existing cryptographic infrastructure rather than create an unmanaged parallel trust store.

### Persistence / replay

- Historical decisions remain historical facts.
- Re-adjudication is a separate explicit action and records new provenance.
- If certificates become portable-package content, package schema/version compatibility must be handled explicitly in the implementation tranche; this RFC does not silently change the current package format.

### Runtime

- Asynchronous signature verification must occur before a synchronous verified-admission claim is consumed by arbitration.
- Cached verification is permitted only when cache identity includes certificate digest, trusted-key status/version, policy identity, and relevant runtime context.

### UX

- Investigators may eventually see a distinct “scientifically abstained” state instead of a generic infeasible result.
- UI wording must not imply that an abstained candidate is incorrect; it means evidence is insufficient under current criteria.

## Verification plan

Implementation is fit for purpose only if tests prove:

- `p<n` remains unaffected;
- `p=n` and `p>n` without a verified promotable certificate return ABSTAIN;
- a structurally valid but unsigned/untrusted certificate cannot promote;
- dataset, candidate, effective-feature, policy/model/runtime, protocol, or evidence tampering prevents promotion;
- a trusted signature without an available governing criterion yields ABSTAIN;
- only an explicit authority-owned policy may produce ELIGIBLE;
- caller-supplied verifier/policy/public key cannot self-certify;
- replay of historical uncertified decisions never silently upgrades them;
- certificate reuse across datasets/candidates fails;
- mutation tests demonstrate that removing context-binding or trust checks breaks tests;
- real WASM/Rust authority paths remain the source of analytical/effective-feature evidence;
- exact-head full integration, typecheck, lint, WASM build, and relevant Rust/WASM suites remain green.

## Resulting ADR

Accepted implementation authority is recorded in
[ADR-0006: Moneta stability-certificate authority and scientific abstention](../architecture/decisions/0006-moneta-stability-certificate-authority-and-abstention.md).
