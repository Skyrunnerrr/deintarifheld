/**
 * Fail-closed external effect adapter — DENY_ALL.
 * No mail, HTTP, webhooks, or provider calls.
 */

export function createDenyAllEffectAdapter() {
  const attempts = {
    mail: 0,
    http: 0,
    webhook: 0,
    provider: 0,
  };

  function deny(kind) {
    attempts[kind] += 1;
    return {
      ok: false,
      code: 'EXTERNAL_EFFECT_DENIED',
      kind,
    };
  }

  return {
    kind: 'DENY_ALL',
    sendMail: () => deny('mail'),
    httpRequest: () => deny('http'),
    webhook: () => deny('webhook'),
    providerCall: () => deny('provider'),
    getAttempts: () => ({ ...attempts }),
    totals: () =>
      attempts.mail + attempts.http + attempts.webhook + attempts.provider,
  };
}
