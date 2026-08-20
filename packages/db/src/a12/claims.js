/**
 * Deterministic claim extraction + validation. No LLM authority.
 */
import { ClaimType, ClaimState, FORBIDDEN_CLAIM_PATTERNS } from '@deintarifheld/shared';

function findUrls(text) {
  const re = /https?:\/\/[^\s)"']+/gi;
  return [...(String(text || '').match(re) || [])];
}

export function extractClaimsFromText(text, { modeHints = [] } = {}) {
  const body = String(text || '');
  const claims = [];
  for (const pat of FORBIDDEN_CLAIM_PATTERNS) {
    const re = new RegExp(pat.re, 'i');
    const m = body.match(re);
    if (m) {
      claims.push({
        claimType: pat.claimType,
        claimText: m[0],
        claimState: pat.claimState,
        patternId: pat.id,
        riskClass: 'BLOCKED',
      });
    }
  }
  for (const hint of modeHints) {
    if (!claims.some((c) => c.patternId === hint.patternId)) {
      claims.push(hint);
    }
  }
  if (claims.length === 0) {
    claims.push({
      claimType: ClaimType.EDUCATION,
      claimText: body.slice(0, 120) || 'education',
      claimState: ClaimState.SUPPORTED,
      patternId: 'SAFE_EDUCATION_DEFAULT',
      riskClass: 'LOW',
      sourceRef: 'DTH_APPROVED_EDUCATION_V1',
    });
  }
  return claims;
}

export function validateClaimSet(claims, { allowedDomains = [] } = {}) {
  const blocked = [];
  const review = [];
  for (const c of claims) {
    if (c.claimState === ClaimState.PROHIBITED || c.claimState === ClaimState.UNSUPPORTED) {
      blocked.push(c);
    } else if (c.claimState === ClaimState.REVIEW_REQUIRED || c.claimState === ClaimState.UNKNOWN) {
      review.push(c);
    }
  }
  return {
    ok: blocked.length === 0,
    blocked,
    review,
    hasProhibited: blocked.some((c) => c.claimState === ClaimState.PROHIBITED),
  };
}

export function extractAndValidateLinks(text, allowedDomains) {
  const urls = findUrls(text);
  const unapproved = [];
  for (const u of urls) {
    try {
      const host = new URL(u).hostname.toLowerCase();
      if (!allowedDomains.some((d) => host === d || host.endsWith(`.${d}`))) {
        unapproved.push(u);
      }
    } catch {
      unapproved.push(u);
    }
  }
  return { urls, unapproved, ok: unapproved.length === 0 };
}
