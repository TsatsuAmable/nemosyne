# New-machine setup

Shared skills, memory, and hooks arrive via git. Three per-machine steps remain; everything Muse keeps per-machine lives outside the repo by design and must not be copied between machines (`auth.json` never moves).

1. Pull the repo, then trust the workspace once (accept the first-run prompt, or `muse --trust-workspace`).
2. Enable the project skills for this machine's repo path:
   `muse skills enable nemosyne-runtime-review --scope project --workspace <repo-path> --trust-workspace`
   `muse skills enable vr-accessibility --scope project --workspace <repo-path> --trust-workspace`
   `muse skills enable github-hygiene --scope project --workspace <repo-path> --trust-workspace`
3. Verify: `muse skills list --source project --workspace <repo-path>` shows all three `on`, and one local run shows no hooks warnings.

Do not copy `~/.config/muse/settings.json` or `auth.json` from another machine. Re-entering model choice and login there is expected.
