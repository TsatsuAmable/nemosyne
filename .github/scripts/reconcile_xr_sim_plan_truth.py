from pathlib import Path
import re

p = Path('docs/ROADMAP.md')
t = p.read_text()

def regex_once(pattern: str, replacement: str, label: str) -> None:
    global t
    t2, n = re.subn(pattern, replacement, t, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f'{label}: expected one match, got {n}')
    t = t2

old_prod = """**Production-wiring audit:** the 26 August audit of `main@3aa5b6e` found that source-level construction is not equivalent to a deployable capability. The mandatory WASM kernel is generated under `wasm/pkg` while Netlify publishes only `dist`; the active Vite build externalises `/wasm/pkg/nemosyne_wasm.js` but does not copy that package into the published tree. Collaboration and the default demo live stream point to same-origin `/__signal` and `/__demo-stream` endpoints that exist only in Vite dev/preview middleware, and several security/maintainability abstractions remain off-path or barrel-exported without a product consumer. RF-053 through RF-056 and the post-UI P1-W tranche below own this work. Per the requested sequencing, P1-W starts after P1-U converges and must close before private-preview promotion."""
new_prod = """**Production-wiring audit:** the 26 August audit at `main@3aa5b6e` identified real source-vs-deployment risks, but one specific claim is now stale on `main@22ce66b`: the active `wasmServePlugin` copies generated `wasm/pkg` files into `dist/wasm/pkg`, and `npm run build` builds WASM before Vite. RF-053 therefore requires a **clean-artifact re-verification**, not continued assertion that the copy path is absent: prove the exact runtime URLs, MIME/hash/manifest expectations, real kernel initialization and one authoritative operation from the clean production artifact, then close or narrow RF-053 from evidence. Collaboration and the default demo live stream still target same-origin `/__signal` and `/__demo-stream` dev/preview middleware and remain active RF-054/live-service work. RF-053 through RF-056 and the post-UI P1-W tranche still own production qualification; P1-W starts after P1-U convergence and must close before private-preview promotion."""
if old_prod not in t:
    raise SystemExit('production audit paragraph not found')
t = t.replace(old_prod, new_prod, 1)

regex_once(
    r"\*\*Current interpretation:\*\*.*?\n\n\*\*XR evidence ladder:\*\*",
    """**Current interpretation:** P1-A, P1-B, P1-C, P1-D, P1-E and P1-F contain material implementation advances but remain **IMPLEMENTATION LANDED / REVIEW ACTIVE**, not `VERIFIED COMPLETE`. RF-044, RF-045, RF-046, RF-047 and RF-048 have implementation landed but remain review-monitored; RF-051 has landed several bounded fix-forward tranches and still depends on RF-029/RF-035 plus measured whole-pipeline evidence. RF-035A, RF-035B0, RF-035B1, RF-035B2A and #488 RF-035B2B are landed bounded reductions of avoidable main-thread/transfer/history/durable-result work, not closure of RF-035: graph/derived Worker results, session/package materialisation, handle-only/typed state and measured browser/WASM/device evidence remain. P1-U remains **IMPLEMENTATION PARTIAL / REVIEW ACTIVE**; P1-USIM is a planned evidence enabler, not a product feature or physical qualification substitute. Dominant risks are measured memory/transfer/materialisation cliffs, representation/evidence authority gaps, collaboration/security authority gaps including RF-057, off-path security/privacy controls, production qualification and product/device evidence gaps. Stream A may continue only where these defects are not dependencies; Stream B fixes correctness/evidence foundations; Stream C independently hardens security/privacy-sensitive live boundaries.

**XR evidence ladder:**""",
    'current interpretation',
)

old_rf053 = """| RF-053 | P1-W / production WASM deployment | **Blocker for preview** | `npm run build` generates `wasm/pkg`, Netlify publishes only `dist`, and the active Vite configuration externalises `/wasm/pkg/nemosyne_wasm.js` without copying the generated JS/WASM package into the published tree. The dormant `vite-wasm-pack-plugin.js` is not registered and copies to `dist/wasm`, which still disagrees with the runtime's `/wasm/pkg/...` URLs. A clean production artifact can therefore boot without its mandatory analytical authority. | Establish one production artifact topology and make the build fail closed unless the generated glue and `.wasm` binary are present at the exact runtime URLs. Remove or repair the dormant plugin, add manifest/hash/MIME checks, serve the clean `dist` artifact in CI, and prove real kernel initialization plus one authoritative analytical operation without a JS substitute. |"""
new_rf053 = """| RF-053 | P1-W / production WASM deployment | **Blocker for preview / RE-VERIFY** | The 26 August audit found the generated WASM package absent from the published topology, but current `main@22ce66b` now runs `npm run wasm` before Vite and the active `wasmServePlugin` copies `wasm/pkg` into `dist/wasm/pkg`. The old missing-copy finding is therefore stale; deployment correctness is still unverified until the clean production artifact is exercised at the exact runtime URLs. | Re-run the production-wiring falsifier against a clean build/preview/Netlify-equivalent artifact. Verify JS glue + `.wasm` presence, exact `/wasm/pkg/...` URLs, MIME/hash/manifest expectations, kernel initialization and one authoritative analytical operation with no JS substitute. If those pass, close or narrow RF-053 rather than preserving the superseded defect claim; retain any concrete remaining deployment failure as the new finding. |"""
if old_rf053 not in t:
    raise SystemExit('RF-053 row not found')
t = t.replace(old_rf053, new_rf053, 1)

p.write_text(t)

review = Path('docs/review-plans/XR_SIMULATOR_STREAM_INTEGRATION_REVIEW_2026-08-28.md')
r = review.read_text()
marker = "**Scope:** determine where XR simulation materially improves Nemosyne engineering quality and place only those uses into the existing Stream A/B/C and P1-U evidence programme.\n"
insert = marker + "\n**Planning integration:** applied to `ROADMAP.md`, `AI_XR_AGENT_HARNESS_SPEC.md`, and `STREAM_A_IMPLEMENTATION_QUALITY_CONTRACT.md` on this branch. During verification, the old RF-053 missing-WASM-copy claim was found stale on current main and was narrowed to clean-artifact re-verification rather than repeated as fact.\n"
if marker not in r:
    raise SystemExit('review marker not found')
r = r.replace(marker, insert, 1)
review.write_text(r)

print('reconciled planning truth')
