from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

world_path = ROOT / 'src/vr/World.ts'
world = world_path.read_text(encoding='utf-8')
needle = "      getOriginalDataset: () => this._originalDataset,\n      getAtlas: () => this.atlas,"
replacement = "      getOriginalDataset: () => this._originalDataset,\n      getDracoNode: () => this.dracoNode,\n      getAtlas: () => this.atlas,"
if needle not in world:
    raise RuntimeError('World renderer lifecycle insertion seam not found')
world_path.write_text(world.replace(needle, replacement, 1), encoding='utf-8')

test_path = ROOT / 'tests/bu2-post-merge-truthfulness.test.ts'
test = test_path.read_text(encoding='utf-8')
test = test.replace(
    "import { Dataset } from '../src/data/Dataset.ts';",
    "import { ColumnType, Dataset } from '../src/data/Dataset.ts';",
)
test = test.replace("{ name: 'value', type: 'number' }", "{ name: 'value', type: ColumnType.NUMERIC }")
test_path.write_text(test, encoding='utf-8')

print('B-U2 referee corrections applied')
