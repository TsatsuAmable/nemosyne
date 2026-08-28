from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if text.count(old) != 1:
        raise SystemExit(f'{path}: expected one match, found {text.count(old)}')
    p.write_text(text.replace(old, new, 1))

replace_once(
    'wasm/src/lib.rs',
    '            "name": dataset.name,\n            "rowIds": dataset.row_ids,\n',
    '            "name": dataset.name.as_str(),\n            "rowIds": &dataset.row_ids,\n',
)

replace_once(
    'src/wasm/runtime/DatasetHandleBridge.ts',
    '''      !Number.isSafeInteger(value.rowCount) ||\n      (value.rowCount ?? -1) < 0 ||\n      !Number.isSafeInteger(value.columnCount) ||\n      (value.columnCount ?? -1) < 0 ||\n''',
    '''      typeof value.rowCount !== 'number' ||\n      !Number.isSafeInteger(value.rowCount) ||\n      value.rowCount < 0 ||\n      typeof value.columnCount !== 'number' ||\n      !Number.isSafeInteger(value.columnCount) ||\n      value.columnCount < 0 ||\n''',
)

Path('.github/workflows/rf035b2-compile-fix.yml').unlink(missing_ok=True)
Path('scripts/fix-rf035b2-compile.py').unlink(missing_ok=True)
