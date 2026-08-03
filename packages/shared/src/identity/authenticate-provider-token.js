/**
 * H0a production-shaped local path:
 * token → validate → mapping → passkey policy → session policy → Person Principal
 */
import { createPersonPrincipal, createServicePrincipal, createBreakGlassPrincipal } from '../principal.js';
import { rejectSharedSecretAsCcSession } from '../session.js';
import { validateProviderToken } from './token-validator.js';
import { evaluateSessionPolicy } from './session-policy.js';
import { evaluateOperationalPasskeyAssurance } from './passkey-policy.js';
import { TokenErrorCode, fail } from './token-errors.js';
import { LinkStatus } from './h0a-constants.js';

/**
 * Reject principal confusion paths explicitly.
 */
export function rejectNonPersonAsPersonSession(kind) {
  if (kind === 'SERVICE') {
    createServicePrincipal({ serviceId: 'svc_probe' });
    return fail(TokenErrorCode.PRINCIPAL_TYPE_REJECTED, 'SERVICE_PRINCIPAL_AS_PERSON');
  }
  if (kind === 'BREAK_GLASS') {
    createBreakGlassPrincipal();
    return fail(TokenErrorCode.PRINCIPAL_TYPE_REJECTED, 'BREAK_GLASS_AS_NORMAL_PERSON');
  }
  if (kind === 'SHARED_SECRET') {
    const r = rejectSharedSecretAsCcSession();
    return fail(TokenErrorCode.PRINCIPAL_TYPE_REJECTED, r.code);
  }
  return fail(TokenErrorCode.PRINCIPAL_TYPE_REJECTED);
}

/**
 * @param {object} opts
 * @param {string} opts.token
 * @param {object} opts.jwksAdapter
 * @param {object} opts.mappingAdapter
 * @param {string} opts.expectedIssuer
 * @param {string} opts.expectedAudience
 * @param {string} [opts.expectedAuthorizedParty]
 * @param {object} [opts.activeSessionAdapter]
 * @param {number} [opts.sessionStartedAtSeconds]
 * @param {number} [opts.lastActivityAtSeconds]
 * @param {() => number} [opts.nowSeconds]
 * @param {boolean} [opts.requirePasskeyAssurance=true]
 */
export async function authenticateProviderTokenToPersonPrincipal({
  token,
  jwksAdapter,
  mappingAdapter,
  expectedIssuer,
  expectedAudience,
  expectedAuthorizedParty,
  activeSessionAdapter,
  sessionStartedAtSeconds,
  lastActivityAtSeconds,
  nowSeconds = () => Math.floor(Date.now() / 1000),
  requirePasskeyAssurance = true,
}) {
  const validated = await validateProviderToken({
    token,
    jwksAdapter,
    expectedIssuer,
    expectedAudience,
    expectedAuthorizedParty,
    nowSeconds,
  });
  if (!validated.ok) return validated;

  const { identity } = validated;
  const mapped = mappingAdapter.resolve({
    provider: identity.provider,
    issuer: identity.issuer,
    subject: identity.subject,
  });
  if (!mapped.ok) return mapped;

  if (requirePasskeyAssurance) {
    const passkey = evaluateOperationalPasskeyAssurance(identity.authenticationEvidence);
    if (!passkey.ok) return passkey;
  }

  const started = sessionStartedAtSeconds ?? identity.issuedAt;
  const lastAct = lastActivityAtSeconds ?? nowSeconds();
  const sessionEval = evaluateSessionPolicy({
    sessionId: identity.sessionId,
    dthPersonId: mapped.dthPersonId,
    sessionStartedAtSeconds: started,
    lastActivityAtSeconds: lastAct,
    tokenExpiresAtSeconds: identity.expiresAt,
    linkStatus: mapped.linkStatus || LinkStatus.ACTIVE,
    activeSessionAdapter,
    nowSeconds,
  });
  if (!sessionEval.ok) return sessionEval;

  const principal = createPersonPrincipal({
    personId: mapped.dthPersonId,
    displayLabel: 'provider-mapped-person',
  });

  return {
    ok: true,
    principal,
    identity,
    dthPersonId: mapped.dthPersonId,
    sessionPolicy: sessionEval.policy,
    STRONG_AUTHZ_COMPLETE: false,
    PRODUCTION_IDP_READY: false,
    PASSKEY_POLICY_LIVE_VALIDATED: false,
  };
}
