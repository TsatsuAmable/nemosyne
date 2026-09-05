# PR #674 post-merge adversarial remediation

Date: 2026-09-05

## Disposition

PR #674's production transport boundary was sound, but its explicit-consent and validation-correlation claims were not fully falsified. This remediation narrows the application composition boundary so production UX tracing is fail-closed and governed validation identity remains atomic.

## Defects found after merge

1. `UXTraceRecorder` event-bus handlers could build spatial context and push `gesture` / `interaction` records while the recorder's explicit enabled flag was false because those constructor-installed callbacks bypassed the public `record*` guards.
2. Production recorder construction briefly inherited the recorder's historical default-enabled behavior before bootstrap applied persisted consent.
3. `World._prodTraceManifest()` read validation label/id as independent non-empty strings rather than consuming the repository's canonical validation-session identity contract.
4. Bootstrap described development tracing as always-on, but a later production setting change could call `setEnabled(false)` and disable dev validation evidence.

## Remediation contract

- Production composition starts disabled unless an explicit enabled state is supplied.
- Event-bus delivery is gated before recorder handlers execute, so disabled tracing does not build head/gaze/hand/UI spatial context.
- Validation label/id are stripped and reintroduced only when `readValidationSessionEnv()` accepts them as one valid pair.
- Development composition pins the recorder enabled; production remains controlled by `prodTraceEnabled`.
- Production network transport remains replaced by the local fail-closed sink introduced in #674.

## Falsifiers

`tests/prod-trace-consent-policy.test.ts` proves:

- no implicit production enablement;
- no event capture or spatial-context computation before consent;
- no event capture or spatial-context computation after consent withdrawal;
- capture resumes after consent is enabled;
- malformed/partial validation correlation is omitted;
- a valid validation label/id pair survives export;
- governed development tracing cannot be disabled through the production flag.

The existing `tests/prod-trace-local-only.test.ts` remains the transport falsifier proving a supplied network transport is unreachable in production composition.

## Residual boundary

The base `UXTraceRecorder` remains a trace-mechanics component. Application privacy and validation policy is intentionally enforced by `setupDevTraceRecorder`, the sole application composition path. Any future production recorder construction must go through that composition function or carry an equivalent reviewed policy boundary.
