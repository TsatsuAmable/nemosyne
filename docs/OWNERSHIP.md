# Engineering ownership and review map

GitHub ownership is recorded in `.github/CODEOWNERS`. Because the repository currently has one human owner, this document also records the **semantic authority and specialist review role** expected for each subsystem. AI-assisted reviews should use these roles even when the same human ultimately approves the PR.

| Surface | Semantic authority | Required review focus |
| --- | --- | --- |
| `wasm/`, analytical exports | Scientific/analytical kernel | mathematical correctness, measurement semantics, missingness, resource envelopes, deterministic provenance, memory safety |
| `src/atlas/`, `src/investigation/`, `src/session/` | Investigation orchestration and durable identity | state ownership, fingerprints, replay, persistence, evidence ledger, generation/version fences |
| `src/moneta/` | Representation reasoning and embodiment contracts | representation fidelity, bounded evidence consumption, ontology honesty, no shadow analytics |
| `src/vr/` | WebXR runtime and spatial interaction | frame budget, lifecycle/disposal, reachability, comfort, direct manipulation, controller/hand/desktop behavior |
| `src/network/` | Collaboration and signalling | authentication, authorization, replay resistance, protocol identity, resource limits, recovery |
| `src/ui/` ingest paths | User data ingress | hostile input, filename/metadata handling, Rust parser authority, size/shape limits, user-visible failures |
| `docs/study/`, statistical governance | Research protocol | study validity, confounds, measurement, analysis plan, consent and reproducibility |
| `.github/workflows/`, build/test config | Engineering infrastructure | fail-closed gates, least privilege, evidence preservation, CI latency/cost, supply-chain trust |
| canonical docs and ADRs | Project governance | source-of-truth consistency, architectural intent, lifecycle/archive status |

## Ownership rules

1. Owning a surface does not permit it to violate a higher-level authority in `AGENTS.md` or the governing vision.
2. Cross-boundary changes need review from every materially affected semantic role.
3. A production property must be verified through the boundary that actually owns it. Tests of a neighboring helper do not transfer authority.
4. Analytical behavior implemented outside Rust/WASM is an architecture finding unless it is demonstrably bounded orchestration/presentation logic.
5. Security-sensitive code is reviewed from the attacker-controlled entry point inward, not from the new helper outward.
6. Changes to accepted architecture should reference an ADR; changes large enough to alter the decision itself should follow the RFC process first.
