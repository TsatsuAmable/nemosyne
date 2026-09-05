# Validation evidence publication

Physical Quest validation writes raw evidence and QV4 adjudication artifacts to the git-ignored `logs/validation/` store. A terminal governed run is automatically finalized by the development server into an evidence inventory, analysis, gate disposition, custody record and local Markdown report.

The custody record binds the raw evidence digest to the exact session, source build, launch-time worktree state, runtime/evidence class, machine-captured device build fingerprint and the hashes of the derived QV4 artifacts. Once finalized, the active dev server write-locks that session. Custody verification fails if raw or derived evidence changes later.

Terminal evidence is semantic, not filename-based. In particular, the `quest-ux` launch placeholders remain open and cannot be finalized until a schema-valid, identity-matched guided UX submission and comfort observation have actually been captured. Restart recovery therefore finishes persisted terminal evidence but never freezes a not-run launch placeholder.

`P1-U9` also fails closed when its project prerequisite state has not been explicitly captured. Record a reviewed preflight attestation before terminal UX evidence is submitted with:

```bash
npm run dev:quest:prerequisite -- <session-label> P1-U9 satisfied "<reviewed prerequisite basis>"
```

Use `blocked` instead of `satisfied` when the prerequisite is not met. The command only writes to an open session, only for a gate owned by that session, and refuses to mutate a session after `custody.json` exists. The attestation becomes raw evidence and is hashed into custody during finalization; the harness does not infer roadmap/governance state on its own.

Tracked documentation is deliberately a second, post-campaign step. Writing tracked files during a repeated physical qualification campaign would dirty the source tree and make later governed runs promotion-ineligible. After all required headset runs are complete, publish the already-frozen evidence with:

```bash
node scripts/publish-validation-docs.mjs
```

The command verifies every finalized candidate before generating `docs/validation/generated/INDEX.md`, `ledger.json`, and one session page per finalized bundle. If any finalized candidate is tampered, malformed, or identity-inconsistent, the **entire publication is refused** and the existing generated output is left untouched. Generated validation documentation never edits `docs/ROADMAP.md`, GitHub state or promotion state; those remain separate governance decisions.
