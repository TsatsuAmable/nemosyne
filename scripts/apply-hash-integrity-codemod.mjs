import fs from 'node:fs';

function edit(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (before === after) throw new Error(`codemod made no change to ${path}`);
  fs.writeFileSync(path, after);
}

edit('src/network/NetworkManager.ts', (text) => text
  .replace(
    "import { BinaryPoseSerializer } from './BinaryPoseSerializer.ts';\n\nfunction djb2Hash(str: string): number {\n  let hash = 5381;\n  for (let i = 0; i < str.length; i++) {\n    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);\n  }\n  return Math.abs(hash) % 0x7fffffff;\n}\n",
    "import { BinaryPoseSerializer } from './BinaryPoseSerializer.ts';\nimport { sha256Uint31 } from '../security/CryptoHash.ts';\n"
  )
  .replace('this._numericPeerId = djb2Hash(this.peerId);', 'this._numericPeerId = sha256Uint31(this.peerId);')
);

edit('src/study/ExperimentRunner.ts', (text) => text
  .replace(
    "import { Counterbalancer } from './Counterbalancer.ts';",
    "import { canonicalSha256Hex } from '../security/CryptoHash.ts';\nimport { Counterbalancer } from './Counterbalancer.ts';"
  )
  .replace(
`    let hash = 0x811c9dc5;
    const str = JSON.stringify(payload);
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    const provenanceHash = \`fnv1a-\${(hash >>> 0).toString(16)}\`;`,
`    const provenanceHash = \`sha256-\${canonicalSha256Hex(payload)}\`;`
  )
);

for (const path of [
  'src/moneta/ConstraintArbiter.ts',
  'src/atlas/AtlasCore.ts',
  'src/moneta/representation/MonetaHypothesisEngine.ts',
]) {
  edit(path, (text) => text
    .replace(/\bfnv1aHex\b/g, 'contentHashHex')
  );
}

edit('wasm/src/lib.rs', (text) => text
  .replace(/data::fingerprint::fnv1a_hex/g, 'data::fingerprint::sha256_hex')
  .replace('Return the canonical FNV-1a fingerprint of a dataset (8 hex chars).', 'Return the canonical SHA-256 fingerprint of a dataset (64 hex chars).')
);
