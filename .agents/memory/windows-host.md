# Windows host notes

- Windows sandbox first-time setup requires an elevated helper (UAC). Check state with `muse sandbox windows check`; repair with `muse sandbox windows setup` from a visible interactive terminal where the UAC prompt can be approved.
- Known failure (Oct 2026, Muse Code 1.4.2): elevated setup exits code 125 after rotating `muse-sbx-*` passwords but before writing `C:\ProgramData\muse\windows-elevated-sandbox\setup_marker.json`. Do not hand-create the marker or delete the sandbox users; retry setup instead.
- Temporary unblock for trusted checkouts only: `muse --disable-sandbox` (keeps approval, drops filesystem confinement, forces full network egress). Never `--yolo` on this workstation or on unreviewed forks.
