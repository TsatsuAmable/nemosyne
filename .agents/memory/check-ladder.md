# Verification ladder

Run the smallest ownership-aligned checks first; escalate only as risk demands. Commands are authoritative in `package.json` — do not copy versions or thresholds here.

1. `npm run typecheck` and `npm run lint` scoped to touched files while iterating.
2. Smallest owning suite: `npm run test:fast`, or a single targeted test file.
3. Production-path evidence for the claimed property: `test:ui` / `test:integration` / `test:wasm` / `test:smoke` as the risk surface requires. A unit test alone never proves a shipped property.
4. Gate only: `npm run test:all`, `npm run test:coverage`, `npm run build`, `npm run docs:check`, `npm run audit:hygiene`.

High-risk work derives its checks from the pre-implementation adversarial contract. Standard-risk targets the changed behavior plus its nearest production path. Never weaken tests, coverage, or assertions to get green.
