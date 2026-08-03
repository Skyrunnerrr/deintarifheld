import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInMemoryProviderSessionRegistry,
  applyProviderSessionLifecycle,
} from './provider-session-lifecycle.js';
import { CONCURRENT_SESSION_POLICY } from './session-policy.js';
import { IdentityProvider } from './h0a-constants.js';

const FIXED_NOW = 1_700_000_000;

function identity(sessionId, issuedAt = FIXED_NOW) {
  return {
    provider: IdentityProvider.CLERK,
    issuer: 'https://example.clerk.accounts.dev',
    subject: 'user_test_subject',
    sessionId,
    issuedAt,
    expiresAt: FIXED_NOW + 3600,
  };
}

describe('P4-H0b4 provider session lifecycle', () => {
  it('CONCURRENT_SESSION_POLICY is REVOKE_OLD_ALLOW_NEW', () => {
    assert.equal(CONCURRENT_SESSION_POLICY, 'REVOKE_OLD_ALLOW_NEW');
  });

  it('first session accepted; second revokes first; first then rejected', () => {
    const registry = createInMemoryProviderSessionRegistry();
    const a = applyProviderSessionLifecycle({
      identity: identity('sess_a'),
      registry,
      nowSeconds: () => FIXED_NOW,
    });
    assert.equal(a.ok, true);
    assert.equal(a.activeSessionCount, 1);
    assert.deepEqual(a.revokedSessionIds, []);

    const b = applyProviderSessionLifecycle({
      identity: identity('sess_b', FIXED_NOW + 10),
      registry,
      nowSeconds: () => FIXED_NOW + 10,
    });
    assert.equal(b.ok, true);
    assert.deepEqual(b.revokedSessionIds, ['sess_a']);
    assert.equal(b.activeSessionCount, 1);

    const aAgain = applyProviderSessionLifecycle({
      identity: identity('sess_a'),
      registry,
      nowSeconds: () => FIXED_NOW + 20,
    });
    assert.equal(aAgain.ok, false);
    assert.equal(aAgain.code, 'SESSION_REVOKED');
  });

  it('inactivity at 30 minutes rejected', () => {
    const registry = createInMemoryProviderSessionRegistry();
    assert.equal(
      applyProviderSessionLifecycle({
        identity: identity('sess_a'),
        registry,
        nowSeconds: () => FIXED_NOW,
      }).ok,
      true,
    );
    const r = applyProviderSessionLifecycle({
      identity: identity('sess_a'),
      registry,
      nowSeconds: () => FIXED_NOW + 30 * 60,
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'SESSION_INACTIVITY_EXCEEDED');
  });

  it('absolute max at 12 hours rejected', () => {
    const registry = createInMemoryProviderSessionRegistry();
    assert.equal(
      applyProviderSessionLifecycle({
        identity: identity('sess_a', FIXED_NOW),
        registry,
        nowSeconds: () => FIXED_NOW,
      }).ok,
      true,
    );
    const r = applyProviderSessionLifecycle({
      identity: identity('sess_a', FIXED_NOW),
      registry,
      nowSeconds: () => FIXED_NOW + 12 * 3600,
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'SESSION_MAX_LIFETIME_EXCEEDED');
  });
});
