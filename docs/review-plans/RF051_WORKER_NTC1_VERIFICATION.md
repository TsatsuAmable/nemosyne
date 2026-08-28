# RF-051 worker registration verification

Run on the exact PR head:

```bash
npm ci
npm run typecheck
npx vitest run tests/rf051-worker-registration-ntc1.test.ts tests/atlas-async-execution.test.ts tests/dataset-space-authority.test.ts
npm run docs:check
```

The repository CI/coverage/Rust/build/browser/CodeQL gates remain the integration evidence. The focused real-WASM test is the primary falsifier for the #478 registration defect.
