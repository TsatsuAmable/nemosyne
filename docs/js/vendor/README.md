# Three.js preview vendor

These files originate from the repository's installed three@0.186.0 package:

- three.module.min.js
- three.core.min.js

They are used only by the static nemosyne.world Datasphere preview so that the page does not depend on a renderer CDN.

three.core.min.js carries a narrow Nemosyne hardening patch for this static preview: upstream non-seeded Math.random() calls are routed through Web Crypto, and the UUID helper uses globalThis.crypto.randomUUID(). Seeded deterministic helpers remain unchanged. This preserves the relevant utility semantics while satisfying the repository's zero-CodeQL-finding policy. The upstream MIT license header is retained.
