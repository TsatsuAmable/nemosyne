# Validation evidence publication

Physical Quest validation writes raw evidence and QV4 adjudication artifacts to the git-ignored `logs/validation/` store. A terminal governed run is automatically finalized by the development server into an evidence inventory, analysis, gate disposition, custody record and local Markdown report.

The custody record binds the raw evidence digest to the exact session, source build, launch-time worktree state, runtime/evidence class, machine-captured device build fingerprint and the hashes of the derived QV4 artifacts. Once finalized, the active dev server write-locks that session. Custody verification fails if raw or derived evidence changes later.

Tracked documentation is deliberately a second, post-campaign step. Writing tracked files during a repeated physical qualification campaign would dirty the source tree and make later governed runs promotion-ineligible. After all required headset runs are complete, publish the already-frozen evidence with:

```bash
node scripts/publish-validation-docs.mjs
```

The command verifies every custody bundle before generating `docs/validation/generated/INDEX.md`, `ledger.json`, and one session page per finalized bundle. It refuses to publish a tampered bundle. Generated validation documentation never edits `docs/ROADMAP.md`, GitHub state or promotion state; those remain separate governance decisions.
