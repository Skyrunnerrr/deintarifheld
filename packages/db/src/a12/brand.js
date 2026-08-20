/**
 * BrandPolicyV1 checks — deterministic, candidate-only.
 */
import { BrandPolicyV1 } from '@deintarifheld/shared';

export function validateBrand({ headline, bodyText, cta, hashtags = [] }, policy = BrandPolicyV1) {
  const text = `${headline || ''}\n${bodyText || ''}\n${cta || ''}`;
  const failures = [];
  for (const bad of policy.forbiddenNamePatterns || []) {
    if (text.includes(bad)) failures.push({ code: 'FORBIDDEN_BRAND_NAME', detail: bad });
  }
  for (const bad of policy.forbiddenCtaPatterns || []) {
    if ((cta || '').includes(bad) || text.includes(bad)) {
      failures.push({ code: 'FORBIDDEN_CTA', detail: bad });
    }
  }
  if ((hashtags || []).length > (policy.maxHashtags ?? 3)) {
    failures.push({ code: 'HASHTAG_LIMIT', detail: String(hashtags.length) });
  }
  if (/<script|javascript:|onerror=/i.test(text)) {
    failures.push({ code: 'XSS_PAYLOAD', detail: 'html_or_script' });
  }
  return { ok: failures.length === 0, failures, policyId: policy.id, policyVersion: policy.version };
}

export function escapePlaintext(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
