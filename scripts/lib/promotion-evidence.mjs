const CLASSIFICATIONS = [
  ['high-risk', 'High-risk change'],
  ['standard-risk', 'Standard-risk change'],
  ['low-risk', 'Low-risk exemption'],
];

const TEMPLATE_PLACEHOLDERS = [
  /what exact property must be true/i,
  /which canonical owner/i,
  /how could this design silently corrupt/i,
  /which tests\/checks would disprove/i,
  /what is deliberately out of scope/i,
  /required when selected/i,
  /replace this text/i,
  /which blocker findings were fixed/i,
];

function section(body, heading) {
  const headingRe = new RegExp(`^#{1,6}\\s*${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'im');
  const match = headingRe.exec(body);
  if (!match) return null;
  const start = match.index + match[0].length;
  const rest = body.slice(start);
  const nextHeading = /^#{1,6}\s+.+$/m.exec(rest);
  return (nextHeading ? rest.slice(0, nextHeading.index) : rest).trim();
}

function selectedClassification(body) {
  const selected = [];
  for (const [id, label] of CLASSIFICATIONS) {
    const re = new RegExp(`^- \\[[xX]\\]\\s+\\*\\*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`, 'm');
    if (re.test(body)) selected.push(id);
  }
  return selected;
}

function lineValue(body, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^\\s*(?:[-*]\\s*)?(?:\\*\\*)?${escaped}:(?:\\*\\*)?\\s*(.+?)\\s*$`, 'im').exec(body);
  return match?.[1]?.trim() ?? '';
}

function usefulValue(value) {
  if (!value) return false;
  return !TEMPLATE_PLACEHOLDERS.some((pattern) => pattern.test(value));
}

export function validatePromotionEvidence({ body = '', expectedSha, changedFiles }) {
  const errors = [];
  const selected = selectedClassification(body);
  const classification = selected.length === 1 ? selected[0] : null;

  if (!Number.isInteger(changedFiles) || changedFiles <= 0) {
    errors.push('PR has no changed files; zero-diff PRs are not promotable.');
  }

  if (selected.length !== 1) {
    errors.push(`Exactly one risk classification must be checked; found ${selected.length}.`);
  }

  if (classification === 'low-risk') {
    const reason = lineValue(body, 'Low-risk exemption reason');
    if (!usefulValue(reason)) {
      errors.push('Low-risk exemption requires a concrete non-template reason.');
    }
  }

  if (classification === 'high-risk') {
    const pre = section(body, 'High-risk pre-implementation adversarial contract');
    if (!pre) {
      errors.push('High-risk change requires a pre-implementation adversarial contract.');
    } else {
      for (const label of [
        'Invariant',
        'Authority / production path',
        'Primary failure modes',
        'Falsifying evidence',
        'Non-goals / dependencies',
      ]) {
        if (!usefulValue(lineValue(pre, label))) {
          errors.push(`High-risk contract field '${label}' is missing or still template text.`);
        }
      }
    }
  }

  if (classification === 'high-risk' || classification === 'standard-risk') {
    const review = section(body, 'Post-implementation adversarial review');
    if (!review) {
      errors.push('High/standard-risk change requires a post-implementation adversarial review section.');
    } else {
      const reviewedHead = lineValue(review, 'Exact reviewed head').replace(/`/g, '');
      if (reviewedHead !== expectedSha) {
        errors.push(`Post-review exact head '${reviewedHead || '(missing)'}' does not match ${expectedSha}.`);
      }

      const disposition = lineValue(review, 'Disposition').replace(/\*/g, '').trim();
      if (!/^PASS(?:\s|$)/i.test(disposition)) {
        errors.push('Post-review disposition must explicitly be PASS.');
      }
      if (/review active|implementation partial|pending|changes required|do not merge|blocked/i.test(review)) {
        errors.push('Post-review section still contains a non-terminal or blocking status.');
      }
    }
  }

  return {
    ok: errors.length === 0,
    classification,
    errors,
  };
}
