/**
 * Hosted MFA state machine — server-safe classification helpers.
 */

export const MfaUiPhase = Object.freeze({
  LOADING: 'LOADING',
  AAL2: 'AAL2',
  NO_FACTOR: 'NO_FACTOR',
  UNVERIFIED_FACTOR: 'UNVERIFIED_FACTOR',
  VERIFIED_FACTOR: 'VERIFIED_FACTOR',
  RECOVERY_REQUIRED: 'RECOVERY_REQUIRED',
  ERROR: 'ERROR',
});

function totpFactors(all = []) {
  return all.filter((f) => f?.factor_type === 'totp' || f?.type === 'totp');
}

export function buildMfaDiagnostics({ aal, factors } = {}) {
  const all = factors?.all ?? [];
  const totp = totpFactors(all);
  const verified = totp.filter((f) => f.status === 'verified');
  const unverified = totp.filter((f) => f.status !== 'verified');
  return {
    CURRENT_AAL: aal?.currentLevel ?? null,
    NEXT_AAL: aal?.nextLevel ?? null,
    TOTP_FACTOR_COUNT: totp.length,
    VERIFIED_TOTP_FACTOR_COUNT: verified.length,
    UNVERIFIED_TOTP_FACTOR_COUNT: unverified.length,
  };
}

/**
 * @returns {{ phase: string, factorId?: string, diagnostics: object, recoveryReason?: string }}
 */
export function classifyHostedMfaState({ aal, factors, enrollError = null, lostAuthenticator = false } = {}) {
  const diagnostics = buildMfaDiagnostics({ aal, factors });

  if (enrollError) {
    return { phase: MfaUiPhase.ERROR, diagnostics, errorCode: 'MFA_INIT_FAILED' };
  }

  const current = aal?.currentLevel ?? null;
  const next = aal?.nextLevel ?? null;

  if (current === 'aal2' && !next) {
    return { phase: MfaUiPhase.AAL2, diagnostics };
  }

  const all = factors?.all ?? [];
  const totp = totpFactors(all);
  const verified = totp.filter((f) => f.status === 'verified');
  const unverified = totp.filter((f) => f.status !== 'verified');

  if (verified.length > 0) {
    if (lostAuthenticator) {
      return {
        phase: MfaUiPhase.RECOVERY_REQUIRED,
        factorId: verified[0].id,
        diagnostics,
        recoveryReason: 'VERIFIED_FACTOR_LOST_AUTHENTICATOR',
      };
    }
    return {
      phase: MfaUiPhase.VERIFIED_FACTOR,
      factorId: verified[0].id,
      diagnostics,
    };
  }

  if (unverified.length > 0) {
    return {
      phase: MfaUiPhase.UNVERIFIED_FACTOR,
      factorId: unverified[0].id,
      unverifiedFactorIds: unverified.map((f) => f.id),
      diagnostics,
    };
  }

  return { phase: MfaUiPhase.NO_FACTOR, diagnostics };
}

export function shouldBlockAal1ProtectedAccess(diagnostics) {
  return diagnostics?.CURRENT_AAL !== 'aal2';
}
