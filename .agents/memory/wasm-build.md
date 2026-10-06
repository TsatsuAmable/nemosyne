# Rust/WASM build

Rust/WASM owns analytical data, statistics, topology, clustering, and scale-sensitive reductions. TypeScript owns orchestration, interaction, persistence adapters, and rendering. No shadow analytical implementation or silent JS fallback.

- Dev build: `npm run wasm:dev` (uses project-pinned `wasm-pack` from devDependencies).
- Release build: `npm run wasm` (also runs as part of `npm run build`).
- Toolchain is pinned in `rust-toolchain.toml`; the `wasm32-unknown-unknown` target is required (`rustup target add wasm32-unknown-unknown`).
- WASM handles are runtime-local capabilities, not durable identities; never persist a handle across runtimes.
