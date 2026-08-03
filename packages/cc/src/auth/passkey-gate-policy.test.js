import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateLocalPasskeyGate,
  PasskeyGateState,
  PasskeyGateContract,
} from './passkey-gate-policy.js';

test('unauthenticated browser is denied local shell and operational access', () => {
  const r = evaluateLocalPasskeyGate({
    clerkLoaded: true,
    signedIn: false,
    passkeyEnrolledCount: 0,
    explicitPasskeyVerificationComplete: false,
  });
  assert.equal(r.state, PasskeyGateState.UNAUTHENTICATED);
  assert.equal(r.allowLocalNonOperationalShell, false);
  assert.equal(r.allowOperationalApiAccess, false);
  assert.equal(r.allowOperationalWrites, false);
});

test('authenticated account without passkey is denied CC shell', () => {
  const r = evaluateLocalPasskeyGate({
    clerkLoaded: true,
    signedIn: true,
    passkeyEnrolledCount: 0,
    explicitPasskeyVerificationComplete: false,
  });
  assert.equal(r.state, PasskeyGateState.AUTHENTICATED_NO_PASSKEY);
  assert.equal(r.allowLocalNonOperationalShell, false);
  assert.equal(r.allowOperationalApiAccess, false);
});

test('passkey enrolled but without explicit verification is denied', () => {
  const r = evaluateLocalPasskeyGate({
    clerkLoaded: true,
    signedIn: true,
    passkeyEnrolledCount: 1,
    explicitPasskeyVerificationComplete: false,
  });
  assert.equal(r.state, PasskeyGateState.AUTHENTICATED_PASSKEY_NOT_VERIFIED);
  assert.equal(r.allowLocalNonOperationalShell, false);
  assert.equal(r.allowOperationalApiAccess, false);
});

test('explicit passkey verification allows only non-operational local shell', () => {
  const r = evaluateLocalPasskeyGate({
    clerkLoaded: true,
    signedIn: true,
    passkeyEnrolledCount: 1,
    explicitPasskeyVerificationComplete: true,
  });
  assert.equal(r.state, PasskeyGateState.PASSKEY_VERIFIED_LOCAL_SHELL);
  assert.equal(r.allowLocalNonOperationalShell, true);
  assert.equal(r.allowOperationalApiAccess, false);
  assert.equal(r.allowOperationalWrites, false);
  assert.equal(r.strongAuthzComplete, false);
});

test('gate contract forbids strong authz and person mapping', () => {
  assert.equal(PasskeyGateContract.STRONG_BACKEND_AUTHZ_COMPLETE, false);
  assert.equal(PasskeyGateContract.TEMPORARY_PERSON_MAPPING_AUTHORIZED, false);
  assert.equal(PasskeyGateContract.OPERATIONAL_API_AFTER_PASSKEY, false);
  assert.equal(PasskeyGateContract.CLERK_NPM_SDK_INITIALIZED, false);
  assert.equal(
    PasskeyGateContract.ENFORCEMENT_METHOD,
    'EXPLICIT_PASSKEY_VERIFICATION_BEFORE_LOCAL_CC_ENTRY',
  );
});
