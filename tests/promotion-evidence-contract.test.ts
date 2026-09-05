import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { validatePromotionEvidence } from '../scripts/lib/promotion-evidence.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';

function standardBody(overrides = ''): string {
  return `
## Adversarial implementation contract

- [ ] **High-risk change:** high
- [x] **Standard-risk change:** standard
- [ ] **Low-risk exemption:** low

## Post-implementation adversarial review

**Exact reviewed head:** \`${SHA}\`
**Disposition:** **PASS**
Production path and falsifier completed.
${overrides}
`;
}

describe('promotion evidence structural contract', () => {
  it('rejects the untouched pull-request template', () => {
    const body = readFileSync('.github/pull_request_template.md', 'utf8');
    const result = validatePromotionEvidence({ body, expectedSha: SHA, changedFiles: 3 });
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/Exactly one risk classification/);
  });

  it('rejects zero-diff PRs even when marker text is present', () => {
    const result = validatePromotionEvidence({
      body: standardBody(),
      expectedSha: SHA,
      changedFiles: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/no changed files/i);
  });

  it('rejects a review that is still active or pending', () => {
    const result = validatePromotionEvidence({
      body: standardBody('IMPLEMENTATION LANDED / REVIEW ACTIVE. Pending exact-head re-read.'),
      expectedSha: SHA,
      changedFiles: 2,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/non-terminal or blocking status/i);
  });

  it('rejects a PASS disposition bound to a stale head', () => {
    const body = standardBody().replace(SHA, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const result = validatePromotionEvidence({ body, expectedSha: SHA, changedFiles: 2 });
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/does not match/);
  });

  it('accepts a completed standard-risk review bound to the exact head', () => {
    const result = validatePromotionEvidence({
      body: standardBody(),
      expectedSha: SHA,
      changedFiles: 2,
    });
    expect(result).toEqual({ ok: true, classification: 'standard-risk', errors: [] });
  });

  it('requires a concrete low-risk exemption reason', () => {
    const body = `
## Adversarial implementation contract
- [ ] **High-risk change:** high
- [ ] **Standard-risk change:** standard
- [x] **Low-risk exemption:** low

**Low-risk exemption reason:** Required when selected; replace this text.
`;
    const result = validatePromotionEvidence({ body, expectedSha: SHA, changedFiles: 1 });
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/concrete non-template reason/);
  });

  it('requires high-risk pre-contract fields to be completed', () => {
    const body = `
## Adversarial implementation contract
- [x] **High-risk change:** high
- [ ] **Standard-risk change:** standard
- [ ] **Low-risk exemption:** low

### High-risk pre-implementation adversarial contract
- **Invariant:** What exact property must be true when the change is correct?
- **Authority / production path:** real path
- **Primary failure modes:** real modes
- **Falsifying evidence:** real tests
- **Non-goals / dependencies:** real exclusions

## Post-implementation adversarial review
**Exact reviewed head:** \`${SHA}\`
**Disposition:** **PASS**
`;
    const result = validatePromotionEvidence({ body, expectedSha: SHA, changedFiles: 1 });
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/Invariant.*template text/);
  });
});
