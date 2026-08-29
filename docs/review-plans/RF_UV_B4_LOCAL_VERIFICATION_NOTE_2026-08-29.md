# B4 local verification note

The B4 implementation environment could not establish an outbound clone of the public GitHub repository because DNS resolution for `github.com` was unavailable in the execution container. No local test result is therefore claimed.

Exact-head GitHub CI is the executable verification authority for B4. The branch includes focused Vitest policy/runtime falsifiers and a production Playwright task-first-shell smoke; B4 remains `IMPLEMENTATION LANDED / REVIEW ACTIVE` until those and the normal required repository gates pass on the exact PR head.
