# Lightweight RFC process

RFCs are an airlock for changes that alter Nemosyne's durable architecture or public contracts. They are deliberately **not** required for ordinary fixes, small refactors, bounded roadmap implementation, tests, or documentation corrections.

## RFC required when a proposal materially changes

- analytical authority or Rust/WASM versus TypeScript ownership;
- canonical dataset ownership, memory model, or cross-runtime identity;
- `.nemosyne` persistence/replay format or compatibility contract;
- statistical/scientific semantics or the meaning of investigator-facing evidence;
- authentication, authorization, cryptographic protocol, privacy lifecycle, or another trust boundary;
- public collaboration/network protocol;
- WebXR interaction grammar or a foundational spatial navigation/manipulation model;
- a major runtime/toolchain/platform migration with broad architectural consequences;
- an accepted ADR rather than merely implementing it.

## Format

Create `docs/rfcs/NNNN-short-title.md` with:

1. **Status:** proposed, accepted, rejected, or superseded.
2. **Context:** the concrete problem and evidence.
3. **Decision requested:** the smallest durable choice that needs agreement.
4. **Options considered:** include meaningful alternatives and why they lose.
5. **Consequences:** migration, compatibility, security, scientific, UX, performance, and operational effects that actually apply.
6. **Verification plan:** what evidence would demonstrate the choice is fit for purpose.
7. **Resulting ADR:** once accepted and implemented as architecture, link the immutable ADR that records the decision.

RFCs should be short enough to review. A large implementation plan is not automatically an RFC, and an RFC is not authorization to bypass the roadmap or quality gates.
