from pathlib import Path

files = [
    Path('docs/ROADMAP.md'),
    Path('docs/review-plans/P1Q_ENGINEERING_QUALITY_CADENCE_2026-08-28.md'),
]

for path in files:
    text = path.read_text()

    text = text.replace(
        "- [ ] make failing browser/IWER product-path jobs retain a reproducible evidence bundle: Playwright trace, screenshot/video, console/page errors, relevant network failures, scene snapshot, simulator scenario/profile, Worker/runtime state and exact source/bundle/WASM identity;\n- [ ] evaluate isolated Chrome DevTools Protocol/MCP-style agent diagnostics for console/network/performance/heap inspection without exposing normal user browser profiles or secrets.",
        "- [ ] make failing browser/IWER product-path jobs retain a reproducible evidence bundle: Playwright trace, screenshot/video, console/page errors, relevant network failures, scene snapshot, simulator scenario/profile, Worker/runtime state and exact source/bundle/WASM identity;\n- [ ] make diagnostic retention dataset-safe: synthetic/CI fixtures by default; sanitize network/console/scene artifacts before retention; treat heap snapshots as potentially containing scientific data, tokens or secrets and never upload them from production/user investigations without an explicit governed policy;\n- [ ] evaluate isolated Chrome DevTools Protocol/MCP-style agent diagnostics for console/network/performance/heap inspection without exposing normal user browser profiles or secrets."
    )

    text = text.replace(
        "Evaluate Toxiproxy or an equivalent deterministic TCP/network fault injector for deployed/contract-faithful signalling and other external service paths.",
        "Evaluate Toxiproxy or an equivalent deterministic TCP/network fault injector for deployed/contract-faithful signalling, WebSocket and ordinary service paths. Do **not** treat it as a faithful WebRTC data-channel impairment tool: WebRTC media/data may use ICE/UDP/DTLS paths that bypass a TCP proxy. Evaluate `tc/netem`-class lower-level network emulation or a proven WebRTC-specific harness separately before making data-channel loss/jitter claims."
    )

    text = text.replace(
        "Use IWER/multi-browser clients to drive embodied collaboration while the proxy perturbs the real network path. The security/correctness claim remains owned by the signalling/WebRTC/session authorities, not the proxy.",
        "Use IWER/multi-browser clients to drive embodied collaboration while the selected fault injector perturbs the boundary it actually controls. Toxiproxy may exercise signalling/service recovery; a lower-level or WebRTC-specific harness must own peer data-channel impairment. The security/correctness claim remains owned by the signalling/WebRTC/session authorities, not the fault injector."
    )

    text = text.replace(
        "- [ ] after RF-037/RF-038/RF-057 and a contract-faithful/deployed service path exist, evaluate Toxiproxy or equivalent for latency/jitter, stalls, partitions, service disappearance and reconnect storms;\n- [ ] use real multi-browser/IWER clients where useful, but keep security/correctness authority in the signalling/WebRTC/session implementation.",
        "- [ ] after RF-037/RF-038/RF-057 and a contract-faithful/deployed service path exist, evaluate Toxiproxy or equivalent for signalling/WebSocket/service latency, stalls, disappearance and reconnect behavior;\n- [ ] evaluate `tc/netem`-class or a proven WebRTC-specific impairment harness before claiming peer data-channel loss/jitter/partition evidence; do not infer WebRTC data-plane coverage from a TCP proxy;\n- [ ] use real multi-browser/IWER clients where useful, but keep security/correctness authority in the signalling/WebRTC/session implementation."
    )

    path.write_text(text)

print('P1-Q plan refinements applied')
