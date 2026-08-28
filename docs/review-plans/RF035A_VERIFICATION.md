# RF-035A verification

Run on the exact PR head:

```bash
npx vitest run tests/rf035-worker-resident-registration.test.ts tests/atlas-async-execution.test.ts
npm run typecheck
npm run lint
npm run docs:check
npm run build
```

CI coverage shards and the existing Chromium production smoke remain required merge evidence. The focused residency test must prove both the no-second-REGISTER property and the absence of pre-registration `Dataset.toJSON()` work while the current output fingerprint is resident.

This tranche does not constitute browser Worker transfer/GC measurement or Quest qualification.