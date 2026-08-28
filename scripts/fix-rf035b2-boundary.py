from pathlib import Path

path = Path('tests/runtime-bridge-module-boundaries.test.ts')
text = path.read_text()
old = "  'datasetRowCount',\n  'deallocBuffer',\n"
new = "  'datasetRowCount',\n  'datasetRowView',\n  'deallocBuffer',\n"
if text.count(old) != 1:
    raise SystemExit(f'expected one facade export insertion point, found {text.count(old)}')
path.write_text(text.replace(old, new, 1))
Path('.github/workflows/rf035b2-boundary-fix.yml').unlink(missing_ok=True)
Path('scripts/fix-rf035b2-boundary.py').unlink(missing_ok=True)
