from pathlib import Path
import re

path = Path('docs/ROADMAP.md')
text = path.read_text()


def sub_one(pattern: str, replacement: str, label: str, flags=0):
    global text
    text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')


snapshot = """**Current remote main at roadmap branch cut:** `4808040` (#483 merged). Since the prior snapshot, #479 corrected #478's worker-registration defect by removing automatic row-backed → typed substitution from the shared operation-complete Worker path: row-backed datasets remain canonical JSON and explicitly typed sources retain governed NTC1. #480 landed RF-035A, allowing same-generation Worker mutation outputs to remain resident so Atlas can skip a redundant `Dataset.toJSON()` registration snapshot before the next operation. #481 added merged-state adversarial evidence for dataset-replacement residency revocation. #483 landed RF-035B0, removing the second `Dataset.fromJSON()` performed by `DataOperationController` after Atlas had already committed the authoritative result. RF-035 remains **IMPLEMENTATION PARTIAL / REVIEW ACTIVE** because the Worker still returns full `DatasetJSON` to the main thread and durable result/history/session surfaces still materialise repeated row payloads. #478's title did **not** implement the P1-U6 IceVault/archive/portal tranche; P1-U6 remains partial. Static resource limits remain kernel safety guards, not Quest qualification and not evidence of generic 10M-row support."""
sub_one(r'\*\*Current remote main at roadmap branch cut:\*\*.*?(?=\n\n\*\*Latest adversarial/security validation review:\*\*)', snapshot, 'snapshot', re.S)

critical = """**Reprioritised Stream-B critical path:** (1) **CURRENT: RF-029/RF-030/RF-031/RF-035/RF-051 complete resource, memory and mutation-residency envelope**, with #479 worker-registration correctness, #480 same-generation Worker residency reuse and #483 controller-copy removal landed; next is RF-035B1 canonical dataset-version state/materialise-on-demand foundations before attacking the remaining Worker → JS full-result transfer; (2) RF-001/RF-002/RF-036 representation/evidence authority review on top of the landed RF-045 truth contract; (3) **RF-050** and remaining P1-U convergence/device work in the parallel UI stream, with RF-049 code-level repair landed in #465 but physical qualification still pending; (4) RF-015/RF-033 production evidence and **RF-052** governance truthfulness; (5) physical Quest 3S qualification; (6) **post-UI P1-W production wiring** under RF-053 through RF-056; (7) private-preview hardening. RF-046/RF-047 are implementation-landed/review-active foundations rather than current implementation targets. Stream C continues in parallel on RF-037 through RF-043 plus RF-057/RF-058. The dependency rule remains: **preserved source data → truthful analytical evidence → reproducible identity/replay → bounded computation → faithful representation → coherent investigator UX → physical XR proof → production wiring → private preview.**"""
sub_one(r'\*\*Reprioritised Stream-B critical path:\*\*.*?(?=\n\n\*\*Current interpretation:\*\*)', critical, 'critical path', re.S)

interpretation = """**Current interpretation:** P1-A, P1-B, P1-C, P1-D, P1-E and P1-F contain material implementation advances but remain **IMPLEMENTATION LANDED / REVIEW ACTIVE**, not `VERIFIED COMPLETE`. RF-044, RF-045, RF-046, RF-047 and RF-048 have implementation landed but remain review-monitored; RF-051 has landed several bounded fix-forward tranches, including #479/#480/#483, but still depends on RF-029/RF-035 and measured whole-pipeline evidence. RF-035A and RF-035B0 are landed bounded reductions of avoidable main-thread/transfer work, not closure of RF-035: Worker → JS full-result materialisation and repeated durable row snapshots remain. P1-U remains **IMPLEMENTATION PARTIAL / REVIEW ACTIVE**; #478 did not implement P1-U6 despite its title. Dominant risks are memory/transfer/materialisation cliffs, representation/evidence authority gaps, collaboration/security authority gaps including RF-057, off-path security/privacy controls, production wiring and product/device evidence gaps. Stream A may continue only where these defects are not dependencies; Stream B fixes correctness/evidence foundations; Stream C independently hardens security/privacy-sensitive live boundaries."""
sub_one(r'\*\*Current interpretation:\*\*.*?(?=\n\n\*\*Physical promotion blocker:\*\*)', interpretation, 'current interpretation', re.S)

rf035 = "| RF-035 | P1-B/P1-A / large mutation transport | High | #417 fixed Worker input registration and output identity, but the merged architecture still materialises a full `DatasetJSON` Worker result on the main thread and durable result/history/session surfaces can retain repeated row payloads. | **IMPLEMENTATION PARTIAL / REVIEW ACTIVE:** #480/RF-035A keeps successful same-generation mutation outputs Worker-resident and prevents Atlas from constructing a redundant O(N) registration snapshot before the next operation; #481 adds dataset-replacement residency-revocation evidence; #483/RF-035B0 makes `DataOperationController` reuse Atlas's already committed `Dataset` instead of deserialising the same result a second time. Next: RF-035B1 establishes canonical dataset-version state/fingerprint references and materialise-on-demand boundaries without changing replay/provenance semantics; only then should the Worker → JS full-result envelope be reduced. Measure transfer/heap/GC costs under RF-029/RF-051. |"
sub_one(r'^\| RF-035 \|.*$', rf035, 'RF-035 row', re.M)

rf051 = "| RF-051 | P1-A/P1-B / JavaScript scale cliffs | High | Even with Rust owning analytical work, browser preprocessing/registration/export paths can still create N-dependent copies, serialisation and transfer peaks before or after Rust's resource envelope. | **IMPLEMENTATION LANDED / REVIEW ACTIVE, NOT COMPLETE:** #472 removed spread/argument-count cliffs; #473 bound live DatasetSpace identity/ranges/lineage to authoritative metadata; #476 removed the duplicate live DatasetSpace row snapshot and eager post-mutation range scan; #479 corrected #478 by removing automatic row-backed → typed substitution from the shared Worker registration path, keeping row-backed operation-complete JSON while preserving explicit governed NTC1 inputs; #480 avoids redundant same-generation JS → Worker registration snapshots for resident mutation outputs; #483 removes the controller's second deserialisation of Atlas's committed result. Remaining: RF-035B canonical dataset-version/materialise-on-demand state, Worker → JS full-result reduction, handle-only/typed DatasetSpace projection, mixed/graph transfer without row-major JSON where justified, full resident+transient Rust+Worker+JS accounting, refusal-before-expensive-JS where possible, and measured browser/WASM/transfer/GC/device evidence. |"
sub_one(r'^\| RF-051 \|.*$', rf051, 'RF-051 row', re.M)

ar6_audit = '- [/] audit Dataset/DatasetSpace/worker registration/session/package paths for full-row cloning, `map`/`Array.from`, JSON serialization and hash work that scales with N on the main thread; #473/#476 removed live DatasetSpace re-derivation/duplication, #479 restored operation-complete Worker registration semantics, #480 removed the redundant same-generation JS → Worker registration snapshot, and #483 removed the controller result reparse; Worker → JS result materialisation plus history/session/package duplication remain open;'
sub_one(r'^- \[/\] audit Dataset/DatasetSpace/worker registration/session/package paths.*$', ar6_audit, 'AR-6 audit bullet', re.M)

old_bound = '- [ ] bound or explicitly export large transformed data rather than Worker→JS→Worker rematerialising it by default;'
if old_bound not in text:
    raise SystemExit('AR-6 bound bullet: expected exact old text')
ar6_replacement = """- [x] prevent same-generation resident mutation outputs from boomeranging through an O(N) JS → Worker registration snapshot (#480/#481);
- [x] make production operation coordinators reuse Atlas's committed mutation Dataset instead of independently deserialising the same result (#483);
- [ ] establish canonical dataset-version state so analysis results, history and session/replay surfaces can reference authoritative identity rather than requiring repeated row payloads by construction;
- [ ] bound or explicitly export large transformed data rather than returning/materialising full Worker → JS `DatasetJSON` by default;"""
text = text.replace(old_bound, ar6_replacement, 1)

p1b = re.search(r'(### P1-B Asynchronous analytical runtime.*?)(?=\n### P1-C Sparse topology scalability)', text, re.S)
if not p1b:
    raise SystemExit('P1-B section not found')
section = p1b.group(1)
old_line = '- [ ] **RF-035/RF-051:** remove or explicitly bound full mutation Worker→JS→Worker rematerialisation and other JS-side large-N materialisation for supported transformed datasets;'
if old_line not in section:
    raise SystemExit('P1-B RF-035 review-exit line not found')
new_line = '- [/] **RF-035/RF-051:** #480/#481 land RF-035A same-generation Worker-resident reuse and revocation evidence; #483 lands RF-035B0 controller reuse of the Atlas-committed Dataset. RF-035B1 canonical dataset-version state and later Worker → JS identity-first/materialise-on-demand transfer remain required before review exit;'
section = section.replace(old_line, new_line, 1)
text = text[:p1b.start(1)] + section + text[p1b.end(1):]

old_stream_b = '1. **CURRENT: RF-029 + RF-030 + RF-031 + RF-035 + RF-051 — analytical resource/residency envelope.** Preserve kernel-inline refusal, correct #478 worker registration at the real NTC1 boundary, remove/bound Worker -> JS -> Worker mutation rematerialisation, and finish measured whole-pipeline qualification.'
if old_stream_b not in text:
    raise SystemExit('near-term Stream B item not found')
new_stream_b = '1. **CURRENT: RF-029 + RF-030 + RF-031 + RF-035 + RF-051 — analytical resource/residency envelope.** Preserve kernel-inline refusal and #479 operation-complete worker-registration correctness; #480/#481 land same-generation Worker residency reuse and revocation evidence, and #483 removes the duplicate controller result parse. Next implement RF-035B1 canonical dataset-version/materialise-on-demand state, then reduce the remaining Worker → JS full-result transfer and finish measured whole-pipeline qualification.'
text = text.replace(old_stream_b, new_stream_b, 1)

path.write_text(text)
