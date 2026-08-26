'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '../../../lib/supabase/browser.js';

export default function CommandCenterMfaPage() {
  const [phase, setPhase] = useState('loading');
  const [qr, setQr] = useState('');
  const [factorId, setFactorId] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function init() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.currentLevel === 'aal2' && !aal?.nextLevel) {
          window.location.href = '/command-center/';
          return;
        }
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.find((f) => f.status === 'verified');
        if (totp) {
          const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: totp.id });
          if (chErr) {
            setError('MFA-Herausforderung fehlgeschlagen.');
            setPhase('error');
            return;
          }
          setFactorId(totp.id);
          setChallengeId(challenge.id);
          setPhase('verify');
          return;
        }
        const { data: enroll, error: enErr } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'DTH Staging TOTP',
        });
        if (enErr) {
          setError('MFA-Registrierung fehlgeschlagen.');
          setPhase('error');
          return;
        }
        setFactorId(enroll.id);
        setQr(enroll.totp.qr_code);
        setPhase('enroll');
      } catch {
        setError('MFA nicht verfügbar.');
        setPhase('error');
      }
    }
    init();
  }, []);

  async function verifyEnrollment() {
    setError('');
    const supabase = createSupabaseBrowserClient();
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr) {
      setError('Verifizierung fehlgeschlagen.');
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (vErr) {
      setError('Ungültiger Code.');
      return;
    }
    window.location.href = '/command-center/';
  }

  async function verifyChallenge() {
    setError('');
    const supabase = createSupabaseBrowserClient();
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code,
    });
    if (vErr) {
      setError('Ungültiger Code.');
      return;
    }
    window.location.href = '/command-center/';
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 p-6">
      <div className="w-full max-w-md border border-neutral-800 rounded-lg p-8 bg-neutral-900">
        <h1 className="text-2xl font-semibold mb-2">Zwei-Faktor-Authentifizierung</h1>
        {phase === 'loading' ? <p className="text-neutral-400">Wird geladen…</p> : null}
        {phase === 'enroll' ? (
          <>
            <p className="text-sm text-neutral-400 mb-4">
              Authenticator-App scannen und Code eingeben. Secret wird nicht gespeichert.
            </p>
            {qr ? (
              <div
                className="mb-4 bg-white p-2 rounded inline-block"
                dangerouslySetInnerHTML={{ __html: qr }}
              />
            ) : null}
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-stelliger Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 mb-4"
            />
            <button
              type="button"
              onClick={verifyEnrollment}
              className="w-full rounded bg-emerald-700 hover:bg-emerald-600 px-4 py-2 font-medium"
            >
              TOTP aktivieren
            </button>
          </>
        ) : null}
        {phase === 'verify' ? (
          <>
            <p className="text-sm text-neutral-400 mb-4">Authenticator-Code eingeben.</p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-stelliger Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 mb-4"
            />
            <button
              type="button"
              onClick={verifyChallenge}
              className="w-full rounded bg-emerald-700 hover:bg-emerald-600 px-4 py-2 font-medium"
            >
              Bestätigen
            </button>
          </>
        ) : null}
        {error ? (
          <p className="text-sm text-red-400 mt-4" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
