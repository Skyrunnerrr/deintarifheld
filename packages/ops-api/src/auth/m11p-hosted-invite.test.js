/**
 * DTH-M11P Hosted invite acceptance + initial password setup tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  classifyAuthCallbackFlow,
  resolveSafeHostedRedirect,
  resolvePostCallbackRedirect,
  requiresInitialPasswordSetup,
  passwordSetCookieMatchesUser,
  validatePasswordSetupInput,
  HostedAuthFlowType,
  HOSTED_AUTH_FLOW_COOKIE,
  HOSTED_PASSWORD_SET_COOKIE,
  SET_PASSWORD_PATH,
  MFA_PATH,
} from '../../../../lib/command-center/invite-flow.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

function mockCookies(values = {}) {
  return {
    get(name) {
      const value = values[name];
      return value == null ? undefined : { value };
    },
  };
}

test('INVITE-01 valid invite → password setup redirect', () => {
  const flow = classifyAuthCallbackFlow({ typeParam: 'invite', user: { id: 'u1' } });
  assert.equal(flow, HostedAuthFlowType.INVITE);
  const path = resolvePostCallbackRedirect({
    flowType: flow,
    next: '/command-center/',
    userId: 'u1',
    cookies: mockCookies(),
  });
  assert.equal(path, SET_PASSWORD_PATH);
});

test('INVITE-02 invite does not jump directly to MFA', () => {
  const callback = readFileSync(join(repoRoot, 'app/auth/callback/route.js'), 'utf8');
  const middleware = readFileSync(join(repoRoot, 'middleware.js'), 'utf8');
  assert.match(callback, /resolvePostCallbackRedirect/);
  assert.match(callback, /set-password/);
  assert.match(middleware, /pendingPassword/);
  assert.match(middleware, /SET_PASSWORD_PATH/);
  assert.match(middleware, /normalized === mfaPath/);
});

test('INVITE-03 password setup requires authenticated session', () => {
  const setPassword = readFileSync(join(repoRoot, 'app/command-center/set-password/SetPasswordClient.jsx'), 'utf8');
  const flowState = readFileSync(join(repoRoot, 'app/api/command-center/auth/flow-state/route.js'), 'utf8');
  assert.match(setPassword, /getUser\(\)/);
  assert.match(setPassword, /flow-state/);
  assert.match(flowState, /UNAUTHENTICATED.*401/s);
});

test('INVITE-04 mismatched passwords deny', () => {
  const result = validatePasswordSetupInput({ password: 'abcdefghijkl', confirmPassword: 'abcdefghijkm' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'PASSWORD_MISMATCH');
});

test('INVITE-05 provider-rejected weak password deny path present', () => {
  const setPassword = readFileSync(join(repoRoot, 'app/command-center/set-password/SetPasswordClient.jsx'), 'utf8');
  assert.match(setPassword, /updateUser\(\{ password \}\)/);
  assert.match(setPassword, /updateError/);
  assert.match(setPassword, /abgelehnt/i);
});

test('INVITE-06 successful password update → MFA', () => {
  const setPassword = readFileSync(join(repoRoot, 'app/command-center/set-password/SetPasswordClient.jsx'), 'utf8');
  assert.match(setPassword, /complete-password-setup/);
  assert.match(setPassword, /MFA_PATH/);
});

test('INVITE-07 password never logged in invite flow modules', () => {
  const paths = [
    join(repoRoot, 'lib/command-center/invite-flow.js'),
    join(repoRoot, 'app/command-center/set-password/SetPasswordClient.jsx'),
    join(repoRoot, 'app/api/command-center/auth/complete-password-setup/route.js'),
    join(repoRoot, 'app/auth/callback/route.js'),
  ];
  for (const p of paths) {
    const text = readFileSync(p, 'utf8');
    assert.doesNotMatch(text, /console\.(log|info|debug|warn|error)\([^)]*password/i);
  }
});

test('INVITE-08 password never persisted in DTH', () => {
  const paths = [
    join(repoRoot, 'app/command-center/set-password/SetPasswordClient.jsx'),
    join(repoRoot, 'app/api/command-center/auth/complete-password-setup/route.js'),
  ];
  for (const p of paths) {
    const text = readFileSync(p, 'utf8');
    assert.doesNotMatch(text, /INSERT INTO|UPDATE\s+\w+\s+SET.*password/i);
    assert.doesNotMatch(text, /dth_ops|from ['"]ops\./i);
    assert.doesNotMatch(text, /localStorage/);
  }
});

test('INVITE-09 arbitrary next URL denied', () => {
  assert.equal(resolveSafeHostedRedirect('https://evil.example'), '/command-center/');
  assert.equal(resolveSafeHostedRedirect('//evil.example'), '/command-center/');
  assert.equal(resolveSafeHostedRedirect('/admin'), '/command-center/');
  assert.equal(resolveSafeHostedRedirect('/command-center/inbox/'), '/command-center/inbox/');
});

test('INVITE-10 normal existing login skips initial password page', () => {
  const login = readFileSync(join(repoRoot, 'app/command-center/login/LoginClient.jsx'), 'utf8');
  assert.doesNotMatch(login, /set-password/);
  assert.match(login, /signInWithPassword/);
  const cookies = mockCookies();
  assert.equal(requiresInitialPasswordSetup(cookies, 'existing-user'), false);
});

test('INVITE-11 recovery flow remains separated from invite', () => {
  assert.equal(classifyAuthCallbackFlow({ typeParam: 'recovery' }), HostedAuthFlowType.RECOVERY);
  assert.equal(classifyAuthCallbackFlow({ typeParam: 'invite' }), HostedAuthFlowType.INVITE);
  const setPassword = readFileSync(join(repoRoot, 'app/command-center/set-password/SetPasswordClient.jsx'), 'utf8');
  assert.match(setPassword, /HostedAuthFlowType\.RECOVERY/);
  assert.match(setPassword, /Recovery:/);
});

test('INVITE-12 AAL2 unprovisioned user remains denied (M11H gate unchanged)', () => {
  const sessionGate = readFileSync(join(repoRoot, 'lib/command-center/session-gate.js'), 'utf8');
  assert.match(sessionGate, /gateHostedOpsRequest/);
  assert.match(sessionGate, /verifyHostedSupabaseSession/);
});

test('INVITE-13 TEST_* hosted bypass zero in invite modules', () => {
  const inviteFlow = readFileSync(join(repoRoot, 'lib/command-center/invite-flow.js'), 'utf8');
  assert.doesNotMatch(inviteFlow, /TEST_OWNER|TEST_/);
});

test('INVITE-14 malformed/expired invite fails closed', () => {
  const callback = readFileSync(join(repoRoot, 'app/auth/callback/route.js'), 'utf8');
  assert.match(callback, /if \(!code\)/);
  assert.match(callback, /error=callback/);
  assert.match(callback, /if \(error\)/);
});

test('INVITE-15 password-set cookie clears pending invite flow', () => {
  const cookies = mockCookies({
    [HOSTED_AUTH_FLOW_COOKIE]: HostedAuthFlowType.INVITE,
    [HOSTED_PASSWORD_SET_COOKIE]: 'user-abc',
  });
  assert.equal(passwordSetCookieMatchesUser(cookies, 'user-abc'), true);
  assert.equal(requiresInitialPasswordSetup(cookies, 'user-abc'), false);
});

test('INVITE-16 MFA client blocks before password setup', () => {
  const mfaClient = readFileSync(join(repoRoot, 'app/command-center/mfa/MfaClient.jsx'), 'utf8');
  assert.match(mfaClient, /flow-state/);
  assert.match(mfaClient, /INITIAL_PASSWORD_REQUIRED/);
  assert.match(mfaClient, /set-password/);
});
