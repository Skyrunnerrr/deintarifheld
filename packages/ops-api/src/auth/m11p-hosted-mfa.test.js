/**
 * DTH-M11P Hosted TOTP enrollment / recovery flow tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  classifyHostedMfaState,
  MfaUiPhase,
  buildMfaDiagnostics,
  shouldBlockAal1ProtectedAccess,
} from '../../../../lib/command-center/mfa-flow.js';
import {
  resolveTotpQrPresentation,
  hasDangerousQrInnerHtml,
} from '../../../../lib/command-center/totp-qr.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

test('MFA-01 no factors → enrollment state', () => {
  const state = classifyHostedMfaState({
    aal: { currentLevel: 'aal1', nextLevel: 'aal2' },
    factors: { all: [], totp: [] },
  });
  assert.equal(state.phase, MfaUiPhase.NO_FACTOR);
  assert.equal(state.diagnostics.VERIFIED_TOTP_FACTOR_COUNT, 0);
});

test('MFA-02 enrollment returns QR data URL format', () => {
  const qr = 'data:image/svg+xml;base64,PHN2Zy8+';
  const presentation = resolveTotpQrPresentation(qr);
  assert.equal(presentation.kind, 'img');
  assert.equal(presentation.src, qr);
});

test('MFA-03 QR rendered using actual provider format (img src)', () => {
  const mfaClient = readFileSync(join(repoRoot, 'app/command-center/mfa/MfaClient.jsx'), 'utf8');
  assert.match(mfaClient, /<img[\s\S]*src=\{qrSrc\}/);
  assert.doesNotMatch(mfaClient, /dangerouslySetInnerHTML/);
});

test('MFA-04 no dangerous malformed QR rendering', () => {
  const mfaClient = readFileSync(join(repoRoot, 'app/command-center/mfa/MfaClient.jsx'), 'utf8');
  assert.equal(hasDangerousQrInnerHtml(mfaClient), false);
});

test('MFA-05 unverified factor handled explicitly', () => {
  const state = classifyHostedMfaState({
    aal: { currentLevel: 'aal1', nextLevel: 'aal2' },
    factors: {
      all: [{ id: 'f1', factor_type: 'totp', status: 'unverified' }],
      totp: [],
    },
  });
  assert.equal(state.phase, MfaUiPhase.UNVERIFIED_FACTOR);
  assert.equal(state.factorId, 'f1');
});

test('MFA-06 verified factor → challenge', () => {
  const state = classifyHostedMfaState({
    aal: { currentLevel: 'aal1', nextLevel: 'aal2' },
    factors: {
      all: [{ id: 'v1', factor_type: 'totp', status: 'verified' }],
      totp: [{ id: 'v1', factor_type: 'totp', status: 'verified' }],
    },
  });
  assert.equal(state.phase, MfaUiPhase.VERIFIED_FACTOR);
});

test('MFA-07 challenge success → AAL2 classification', () => {
  const state = classifyHostedMfaState({
    aal: { currentLevel: 'aal2', nextLevel: null },
    factors: {
      all: [{ id: 'v1', factor_type: 'totp', status: 'verified' }],
      totp: [{ id: 'v1', status: 'verified' }],
    },
  });
  assert.equal(state.phase, MfaUiPhase.AAL2);
});

test('MFA-08 invalid code handling present in client', () => {
  const mfaClient = readFileSync(join(repoRoot, 'app/command-center/mfa/MfaClient.jsx'), 'utf8');
  assert.match(mfaClient, /Ungültiger Code/);
});

test('MFA-09 interrupted enrollment does not auto-enroll on unverified', () => {
  const mfaClient = readFileSync(join(repoRoot, 'app/command-center/mfa/MfaClient.jsx'), 'utf8');
  assert.match(mfaClient, /UNVERIFIED_FACTOR/);
  assert.match(mfaClient, /restartUnverifiedEnrollment/);
  assert.match(mfaClient, /initStarted/);
});

test('MFA-10 admin-reset factor → next login returns enrollment', () => {
  const afterReset = classifyHostedMfaState({
    aal: { currentLevel: 'aal1', nextLevel: 'aal2' },
    factors: { all: [], totp: [] },
  });
  assert.equal(afterReset.phase, MfaUiPhase.NO_FACTOR);
});

test('MFA-11 lost authenticator does not auto-disable MFA', () => {
  const state = classifyHostedMfaState({
    aal: { currentLevel: 'aal1', nextLevel: 'aal2' },
    factors: {
      all: [{ id: 'v1', factor_type: 'totp', status: 'verified' }],
      totp: [{ id: 'v1', status: 'verified' }],
    },
    lostAuthenticator: true,
  });
  assert.equal(state.phase, MfaUiPhase.RECOVERY_REQUIRED);
  const mfaClient = readFileSync(join(repoRoot, 'app/command-center/mfa/MfaClient.jsx'), 'utf8');
  assert.doesNotMatch(mfaClient, /mfa\.unenroll.*verified/i);
});

test('MFA-12 secret never logged in flow modules', () => {
  for (const rel of ['lib/command-center/mfa-flow.js', 'lib/command-center/totp-qr.js']) {
    const text = readFileSync(join(repoRoot, rel), 'utf8');
    assert.doesNotMatch(text, /console\.(log|info|debug|warn)/);
  }
});

test('MFA-13 QR/secret never persisted in flow modules', () => {
  for (const rel of ['lib/command-center/mfa-flow.js', 'lib/command-center/totp-qr.js']) {
    const text = readFileSync(join(repoRoot, rel), 'utf8');
    assert.doesNotMatch(text, /localStorage|sessionStorage/);
  }
});

test('MFA-14 AAL1 protected access zero', () => {
  const diag = buildMfaDiagnostics({ aal: { currentLevel: 'aal1', nextLevel: 'aal2' }, factors: { all: [] } });
  assert.equal(shouldBlockAal1ProtectedAccess(diag), true);
  const aal2 = buildMfaDiagnostics({ aal: { currentLevel: 'aal2', nextLevel: null }, factors: { all: [] } });
  assert.equal(shouldBlockAal1ProtectedAccess(aal2), false);
});

test('MFA-15 hosted TEST bypass unchanged in m11p suite', () => {
  const text = readFileSync(join(repoRoot, 'packages/ops-api/src/auth/m11p-auth-host.test.js'), 'utf8');
  assert.match(text, /TEST blocked hosted/);
});

test('MFA-16 diagnostics classification safe fields only', () => {
  const diag = buildMfaDiagnostics({
    aal: { currentLevel: 'aal1', nextLevel: 'aal2' },
    factors: {
      all: [
        { id: 'u1', factor_type: 'totp', status: 'unverified' },
        { id: 'v1', factor_type: 'totp', status: 'verified' },
      ],
    },
  });
  assert.deepEqual(Object.keys(diag).sort(), [
    'CURRENT_AAL',
    'NEXT_AAL',
    'TOTP_FACTOR_COUNT',
    'UNVERIFIED_TOTP_FACTOR_COUNT',
    'VERIFIED_TOTP_FACTOR_COUNT',
  ]);
});
