# Adversarial Shadow Review

The shadow reviewer is a non-authoritative detector. Findings become implementation obligations only after independent validation or governing-authority acceptance.

## Finding record

Append one JSON object per line to `findings.jsonl`.

Required fields:
- `id`: `SHADOW-NNNN`
- `observedAt`: UTC ISO-8601
- `severity`: `CRITICAL|HIGH|NORMAL`
- `confidence`: `HIGH|MEDIUM|LOW`
- `artifact`: PR, commit, path, test, or other durable referent
- `invariant`: exact claim or boundary under review
- `observation`: evidence only
- `hypothesis`: causal interpretation, or null
- `reproducer`: cheapest independent check
- `suggestedOwner`: worker/lane or `UNROUTED`
- `status`: initially `CANDIDATE`

Allowed lifecycle states are `CANDIDATE`, `VALIDATED`, `ABSTAIN`, `REJECTED`, `IN_PROGRESS`, `VERIFIED_FIXED`, and `SUPERSEDED`.

A shadow reviewer may append `CANDIDATE` records but may not promote its own record to `VALIDATED` or certify `VERIFIED_FIXED`. Validation and post-fix verification must be independent.

Workers read open `VALIDATED` records assigned to their lane before ordinary roadmap selection. Corrective PRs reference the finding id and validation artifact.
