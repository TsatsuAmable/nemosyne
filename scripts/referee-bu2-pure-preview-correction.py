from pathlib import Path

path = Path(__file__).resolve().parent / 'referee-bu2-pure-preview.py'
text = path.read_text(encoding='utf-8')
old = """replace_once(\n    'src/vr/World.ts',\n    '      const previewDecision = this.atlas.arbitrateRepresentation(newReq);',\n    '      const previewDecision = this.atlas.previewRepresentation(newReq);',\n)\n"""
new = """world_path = ROOT / 'src/vr/World.ts'\nworld = world_path.read_text(encoding='utf-8')\nmutating_preview = '      const previewDecision = this.atlas.arbitrateRepresentation(newReq);'\npure_preview = '      const previewDecision = this.atlas.previewRepresentation(newReq);'\nif mutating_preview in world:\n    world_path.write_text(world.replace(mutating_preview, pure_preview, 1), encoding='utf-8')\nelif pure_preview not in world:\n    raise RuntimeError('src/vr/World.ts: neither mutating nor pure preview call found')\n"""
if old not in text:
    raise RuntimeError('pure-preview staging replacement seam not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Pure-preview staging made idempotent')
