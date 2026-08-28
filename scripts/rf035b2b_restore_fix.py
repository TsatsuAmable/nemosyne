from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / 'src/atlas/domain/InvestigationAggregate.ts'
text = path.read_text()
old = '''    this.ledger.restore(\n      state.analysisResults ?? [],\n      state.eventLedger ?? [],\n      state.structures,\n      state.observations,\n      state.findings,\n      state.annotations\n    );\n    this.decisions.restore(state.activeRecommendation ?? null, state.decisionHistory ?? []);\n'''
new = '''    this.ledger.restore(\n      state.analysisResults ?? [],\n      state.eventLedger ?? [],\n      state.structures,\n      state.observations,\n      state.findings,\n      state.annotations\n    );\n    // RF-035B2B: persisted results repopulate their own full version entries,\n    // but a valid schema-v2 snapshot may contain zero results. Re-register the\n    // restored original as the borrowed baseline so the first subsequently\n    // verified row-view mutation has a source without allocating another row\n    // snapshot. Fingerprint fallback handles reset/seek versions of this same\n    // canonical content while logical version identity remains distinct.\n    const loadEvent = (state.eventLedger ?? []).find(\n      (event) => event.kind === 'load' && Boolean(event.datasetFingerprint)\n    );\n    const baselineFingerprint =\n      loadEvent?.datasetFingerprint ??\n      ((state.analysisResults?.length ?? 0) === 0 ? state.datasetFingerprint : null);\n    if (original && baselineFingerprint) {\n      this.ledger.registerDatasetVersion(\n        {\n          datasetVersion: loadEvent?.datasetVersion ?? 1,\n          datasetFingerprint: baselineFingerprint,\n        },\n        original\n      );\n    }\n    this.decisions.restore(state.activeRecommendation ?? null, state.decisionHistory ?? []);\n'''
if old not in text:
    raise SystemExit('restore block not found')
path.write_text(text.replace(old, new, 1))
(root / 'scripts/rf035b2b_restore_fix.py').unlink(missing_ok=True)
(root / '.github/workflows/rf035b2b-restore-fix.yml').unlink(missing_ok=True)
