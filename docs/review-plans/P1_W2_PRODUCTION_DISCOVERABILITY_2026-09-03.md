# P1-W2 production discoverability reconciliation — 2026-09-03

**Base:** `main@87614c20dfdca09537090f9e123213da24262a77`  
**Scope:** RF-055/P1-W2 capability-to-entry-point reconciliation, tranche 1.

## Invariant

Except for a deliberately small, explicit development/research exception set, a subsystem may be described or exported as a production capability only when it has:

1. a real production runtime entry point;
2. a user/service discovery marker on that runtime path; and
3. product-path evidence that exercises the capability through that path.

A barrel export, isolated helper, unit test or architectural import check is not production-wiring evidence.

## Changes

- Added `governance/production-capabilities.json` as the machine-readable capability inventory.
- Added a fast-lane invariant test that validates production entrypoints, discovery markers and evidence paths.
- Reclassified the study harness, dormant multimodal perception engine, Rust scene command buffer, learned-fitness training machinery and several legacy prototypes as explicit development-only exceptions.
- Removed misleading production-barrel exports for:
  - `CommandApplier` / command-buffer ABI;
  - `CollaborativeStateSync`;
  - the legacy network `SharedAnnotationManager`;
  - `ShareableSessionURL`;
  - standalone `ColorPaletteEngine`;
  - the hand-rolled `FlatBuffersSerializer` API.
- Stopped `architectural-invariants.test.ts` from treating study/perception barrel availability as proof that those subsystems are production-working.

The source files remain where legacy tests still exercise them; removal from production authority is intentionally separate from later deletion.

## Adversarial checks

- Do not delete a prototype merely because it is off-path if tests or migration evidence still need it; quarantine first.
- Do not wire a dormant implementation only to make a reachability test green.
- Do not classify client-side collaboration composition as deployed signalling-service qualification.
- Do not classify the bundled demo stream as a deployed live-source service.
- Do not let a declaration-only registry become sufficient evidence: production classifications require runtime markers and evidence files, and future tranches should strengthen these toward executable journey checks.

## Remaining P1-W work

1. RF-054 service topology: bind collaboration and live ingest to governed production endpoints or capability-gate their unconfigured affordances.
2. Expand the registry to any newly discovered subsystem/export and keep it mechanically checked.
3. Delete or rename quarantined legacy prototypes once migration/test dependencies are removed.
4. Add the clean production release journey required by RF-053/RF-056 and close only from real artifact/service evidence.

**Disposition:** implementation landed on branch; exact-head CI and post-implementation review required before promotion.
