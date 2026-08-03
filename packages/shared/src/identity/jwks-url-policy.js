/**
 * P4-H0b2a — exact Development JWKS URL policy (SSRF / redirect boundary).
 * No arbitrary discovery. No request-derived hosts.
 */

/**
 * @param {string} frontendApiUrl — exact Clerk Development Frontend API origin/URL
 * @returns {{ ok: true, frontendApiOrigin: string, issuer: string, jwksUrl: string } | { ok: false, code: string, detail?: string }}
 */
export function deriveDevelopmentJwksEndpoints(frontendApiUrl) {
  if (typeof frontendApiUrl !== 'string' || !frontendApiUrl.trim()) {
    return { ok: false, code: 'JWKS_FRONTEND_API_MISSING' };
  }
  let parsed;
  try {
    parsed = new URL(frontendApiUrl.trim());
  } catch {
    return { ok: false, code: 'JWKS_FRONTEND_API_INVALID' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, code: 'JWKS_URL_NON_HTTPS' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, code: 'JWKS_URL_EMBEDDED_CREDENTIALS' };
  }
  if (parsed.search || parsed.hash) {
    return { ok: false, code: 'JWKS_URL_QUERY_OR_FRAGMENT' };
  }
  if (isIpLiteralHost(parsed.hostname)) {
    return { ok: false, code: 'JWKS_URL_IP_LITERAL_HOST' };
  }
  if (parsed.pathname && parsed.pathname !== '/' && parsed.pathname !== '') {
    return { ok: false, code: 'JWKS_FRONTEND_API_UNEXPECTED_PATH' };
  }

  const origin = `https://${parsed.host}`;
  const jwksUrl = `${origin}/.well-known/jwks.json`;
  return {
    ok: true,
    frontendApiOrigin: origin,
    issuer: origin,
    jwksUrl,
  };
}

/**
 * Validate a JWKS URL against the exact approved Frontend API host.
 * @param {string} jwksUrl
 * @param {string} approvedFrontendApiOrigin — https://host (no path)
 */
export function validateExactDevelopmentJwksUrl(jwksUrl, approvedFrontendApiOrigin) {
  if (typeof jwksUrl !== 'string' || typeof approvedFrontendApiOrigin !== 'string') {
    return { ok: false, code: 'JWKS_URL_INVALID' };
  }
  let jwks;
  let approved;
  try {
    jwks = new URL(jwksUrl);
    approved = new URL(approvedFrontendApiOrigin);
  } catch {
    return { ok: false, code: 'JWKS_URL_INVALID' };
  }
  if (jwks.protocol !== 'https:' || approved.protocol !== 'https:') {
    return { ok: false, code: 'JWKS_URL_NON_HTTPS' };
  }
  if (jwks.username || jwks.password || approved.username || approved.password) {
    return { ok: false, code: 'JWKS_URL_EMBEDDED_CREDENTIALS' };
  }
  if (jwks.search || jwks.hash) {
    return { ok: false, code: 'JWKS_URL_QUERY_OR_FRAGMENT' };
  }
  if (isIpLiteralHost(jwks.hostname) || isIpLiteralHost(approved.hostname)) {
    return { ok: false, code: 'JWKS_URL_IP_LITERAL_HOST' };
  }
  if (jwks.host !== approved.host) {
    return { ok: false, code: 'JWKS_URL_HOST_MISMATCH' };
  }
  if (jwks.pathname !== '/.well-known/jwks.json') {
    return { ok: false, code: 'JWKS_URL_PATH_MISMATCH' };
  }
  return { ok: true, jwksUrl: `https://${jwks.host}/.well-known/jwks.json` };
}

function isIpLiteralHost(hostname) {
  if (!hostname) return true;
  if (hostname === 'localhost') return true;
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true;
  // IPv6 in URL hostname comes without brackets in URL.hostname
  if (hostname.includes(':')) return true;
  return false;
}
