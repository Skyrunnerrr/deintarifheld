import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalCcServer } from './create-local-cc-server.js';
import { renderPasskeyGatePage } from './render-passkey-gate.js';

test('passkey gate page never embeds operational mutation controls', () => {
  const html = renderPasskeyGatePage({
    mode: 'entry',
    fapiUrl: 'https://sterling-husky-22.clerk.accounts.dev',
    publishableKeyConfigured: false,
  });
  assert.match(html, /Dein<span>Tarif<\/span>Held/);
  assert.match(html, /Nicht-operativer lokaler CC-Shell/);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /dth_cc_local_token/);
});

test('with passkey gate enabled, protected CC routes deny operational shell HTML', async () => {
  const srv = createLocalCcServer({
    host: '127.0.0.1',
    port: 0,
    env: {
      NODE_ENV: 'test',
      DTH_CC_LOCAL_UI_ENABLED: 'true',
      DTH_CC_PASSKEY_GATE_ENABLED: 'true',
    },
  });
  await new Promise((resolve, reject) => {
    srv.server.listen(0, '127.0.0.1', resolve);
    srv.server.once('error', reject);
  });
  const { port } = srv.server.address();
  try {
    const unauth = await fetch(`http://127.0.0.1:${port}/inbox`);
    assert.equal(unauth.status, 200);
    assert.equal(unauth.headers.get('x-dth-passkey-gate'), 'required');
    const html = await unauth.text();
    assert.match(html, /passkey-gate-client\.js/);
    assert.doesNotMatch(html, /Synthetische lokale Owner-Person/);
    assert.doesNotMatch(html, /opsBaseUrl/);
    assert.doesNotMatch(html, /dth_cc_local_token/);
    // Without publishable key in test env, Clerk CDN tags are omitted.
    assert.doesNotMatch(html, /data-clerk-publishable-key="/);

    const entry = await fetch(`http://127.0.0.1:${port}/auth/entry`);
    assert.equal(entry.status, 200);
    const entryHtml = await entry.text();
    assert.match(entryHtml, /Lokaler CC-Eingang/);

    const health = await fetch(`http://127.0.0.1:${port}/health`);
    const body = await health.json();
    assert.equal(body.passkeyGateEnabled, true);
    assert.equal(body.OPERATIONAL_WRITES, false);
    assert.equal(body.publishableKeyConfigured, false);
  } finally {
    await srv.close();
  }
});

test('auth routes available even when gate flag off (enrollment path)', async () => {
  const srv = createLocalCcServer({
    host: '127.0.0.1',
    port: 0,
    env: {
      NODE_ENV: 'test',
      DTH_CC_LOCAL_UI_ENABLED: 'true',
      DTH_CC_PASSKEY_GATE_ENABLED: 'false',
    },
  });
  await new Promise((resolve, reject) => {
    srv.server.listen(0, '127.0.0.1', resolve);
    srv.server.once('error', reject);
  });
  const { port } = srv.server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/auth/signin`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Mit Passkey anmelden/);
  } finally {
    await srv.close();
  }
});

test('H0b2b validate-provider-session rejects missing auth and never echoes token fields', async () => {
  const srv = createLocalCcServer({
    host: '127.0.0.1',
    port: 0,
    env: {
      NODE_ENV: 'test',
      DTH_CC_LOCAL_UI_ENABLED: 'true',
      DTH_CC_PASSKEY_GATE_ENABLED: 'true',
    },
  });
  await new Promise((resolve, reject) => {
    srv.server.listen(0, '127.0.0.1', resolve);
    srv.server.once('error', reject);
  });
  const { port } = srv.server.address();
  try {
    const getRes = await fetch(`http://127.0.0.1:${port}/auth/validate-provider-session`);
    assert.equal(getRes.status, 405);

    const missing = await fetch(`http://127.0.0.1:${port}/auth/validate-provider-session`, {
      method: 'POST',
    });
    assert.equal(missing.status, 401);
    const body = await missing.json();
    assert.equal(body.liveProviderAuthentication, 'FAIL');
    assert.equal(body.code, 'MISSING_AUTHORIZATION');
    assert.equal(body.dthAuthorization, 'DENIED');
    assert.equal(body.operationalApiAccessAllowed, false);
    assert.equal(body.tokenBodyPresent, false);
    assert.equal(body.rawClaimsPresent, false);
    assert.equal('token' in body, false);
    assert.equal('authorization' in body, false);
    assert.equal('claims' in body, false);
  } finally {
    await srv.close();
  }
});
