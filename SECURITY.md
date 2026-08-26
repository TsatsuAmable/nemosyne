# Security Policy

Nemosyne is currently a pre-release research instrument. Security work targets the current `main` branch and the current private-preview lineage; historical snapshots are not maintained as supported releases unless explicitly tagged otherwise.

## Reporting a vulnerability

Please do not publish exploit details, sensitive datasets, credentials, or reproduction material in a public issue.

If GitHub shows a **Report a vulnerability** option for this repository, use GitHub Private Vulnerability Reporting. Otherwise, contact the repository owner privately through an already established private channel and include enough information to reproduce and assess the issue safely.

A useful report includes:

- affected commit/version and environment;
- the production entry point or trust boundary involved;
- minimal reproduction steps or proof-of-concept input;
- impact and required attacker capabilities;
- whether credentials, personal data, or investigation data may have been exposed.

## Security model

Treat these as untrusted boundaries unless a narrower contract is explicitly documented:

- CSV, JSON, binary/typed datasets, and `.nemosyne` investigation files;
- collaboration tickets, signalling messages, peer metadata, and network payloads;
- URLs, filenames, imported metadata, and developer trace-ingest fields;
- browser storage and persisted investigation state loaded from prior versions.

Security-sensitive behavior must fail closed for malformed, ambiguous, stale, replayed, unauthorized, or unsupported input. A security control is not considered landed solely because an isolated hardening helper exists; evidence must exercise the real production entry point and authoritative call path.

## Security engineering

The active security assurance programme is documented in `docs/STREAM_C_SECURITY_ASSURANCE.md`. CodeQL is configured as a zero-finding JavaScript/TypeScript gate for its current query set, but static analysis is only one layer of assurance.

Changes to authentication, authorization, cryptographic protocol semantics, persistence of sensitive data, CI permissions, dependency trust, or public network formats should follow `docs/RFC_PROCESS.md` and receive security-focused review.

Do not commit secrets, access tokens, private keys, production credentials, or sensitive research data to the repository.
