# RF-047 parser fix-forward

## Invariant

Portable replay must fail closed on malformed command-log entries without throwing, executing attacker-controlled non-object values, or silently omitting them from semantic-v2 restoration.

## Production path

`.nemosyne` command log bytes -> `InvestigationReplayRunner.replayPayload()` -> command-log validation -> replay verification/discrepancy result.

## Failure mode

The merged RF-047 replay loop used JavaScript's `in` operator directly on JSON-decoded entries. Values such as `null`, strings, numbers, booleans, or arrays could therefore bypass the intended object contract, with `null` causing a TypeError before a controlled verification result was returned.

## Falsifying tests

`tests/investigation-replay-malformed-log.test.ts` requires both semantic-v2 and legacy packages containing `[null]` to return `success: false`, execute zero commands, and report an explicit discrepancy rather than throw.

## Non-goals

No replay-schema redesign, UI work, analytical behavior change, or package-format bump. This is a bounded RF-047 post-merge hardening fix.
