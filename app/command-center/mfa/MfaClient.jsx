'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '../../../lib/supabase/browser.js';
import { classifyHostedMfaState, MfaUiPhase, buildMfaDiagnostics } from '../../../lib/command-center/mfa-flow.js';
import { resolveTotpQrPresentation } from '../../../lib/command-center/totp-qr.js';

export default function MfaClient() {
  const initStarted = useRef(false);
  const [phase, setPhase] = useState(MfaUiPhase.LOADING);
  const [factorId, setFactorId] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [qrSrc, setQrSrc] = useState('');
  const [manualSecret, setManualSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [diagnostics, setDiagnostics] = useState(null);
  const [lostAuthenticator, setLostAuthenticator] = useState(false);
  const [busy, setBusy] = useState(false);

  const redirectToCc = useCallback(() => {
    window.location.href = '/command-center/';
  }, []);

  const beginChallenge = useCallback(async (supabase, id) => {
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: id });
    if (chErr) throw chErr;
    setFactorId(id);
    setChallengeId(challenge.id);
    setPhase(MfaUiPhase.VERIFIED_FACTOR);
  }, []);

  const beginEnrollment = useCallback(async (supabase) => {
    const { data: enroll, error: enErr } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'DTH Staging TOTP',
    });
    if (enErr) throw enErr;
    const presentation = resolveTotpQrPresentation(enroll?.totp?.qr_code);
    setFactorId(enroll.id);
    setManualSecret(enroll?.totp?.secret || '');
    if (presentation.kind === 'img') {
      setQrSrc(presentation.src);
    } else {
      setQrSrc('');
    }
    setPhase(MfaUiPhase.NO_FACTOR);
  }, []);

  const cleanupUnverifiedFactors = useCallback(async (supabase, ids = []) => {
    for (const id of ids) {
      const { error: unErr } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (unErr) throw unErr;
    }
  }, []);

  const bootstrap = useCallback(async () => {
    if (initStarted.current) return;
    initStarted.current = true;
    setError('');
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: aal, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalErr) throw aalErr;

      const { data: factors, error: facErr } = await supabase.auth.mfa.listFactors();
      if (facErr) throw facErr;

      const classified = classifyHostedMfaState({
        aal,
        factors,
        lostAuthenticator,
      });
      setDiagnostics(classified.diagnostics);

      if (classified.phase === MfaUiPhase.AAL2) {
        redirectToCc();
        return;
      }

      if (classified.phase === MfaUiPhase.RECOVERY_REQUIRED) {
        setFactorId(classified.factorId || '');
        setPhase(MfaUiPhase.RECOVERY_REQUIRED);
        return;
      }

      if (classified.phase === MfaUiPhase.VERIFIED_FACTOR) {
        await beginChallenge(supabase, classified.factorId);
        return;
      }

      if (classified.phase === MfaUiPhase.UNVERIFIED_FACTOR) {
        setFactorId(classified.factorId || '');
        setPhase(MfaUiPhase.UNVERIFIED_FACTOR);
        return;
      }

      await beginEnrollment(supabase);
    } catch {
      setError('MFA-Initialisierung fehlgeschlagen.');
      setPhase(MfaUiPhase.ERROR);
    } finally {
      setBusy(false);
    }
  }, [beginChallenge, beginEnrollment, lostAuthenticator, redirectToCc]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  async function restartUnverifiedEnrollment() {
    setError('');
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const classified = classifyHostedMfaState({ factors });
      const ids = classified.unverifiedFactorIds || (classified.factorId ? [classified.factorId] : []);
      await cleanupUnverifiedFactors(supabase, ids);
      setQrSrc('');
      setManualSecret('');
      setCode('');
      initStarted.current = false;
      await beginEnrollment(supabase);
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const { data: refreshed } = await supabase.auth.mfa.listFactors();
      setDiagnostics(buildMfaDiagnostics({ aal, factors: refreshed }));
    } catch {
      setError('TOTP-Registrierung konnte nicht neu gestartet werden.');
      setPhase(MfaUiPhase.ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function verifyEnrollment() {
    setError('');
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (vErr) {
        setError('Ungültiger Code.');
        return;
      }
      redirectToCc();
    } catch {
      setError('Verifizierung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyChallenge() {
    setError('');
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code: code.trim(),
      });
      if (vErr) {
        setError('Ungültiger Code.');
        return;
      }
      redirectToCc();
    } catch {
      setError('Verifizierung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  const diagLine = diagnostics
    ? `AAL ${diagnostics.CURRENT_AAL || '—'} → ${diagnostics.NEXT_AAL || '—'} · TOTP ${diagnostics.VERIFIED_TOTP_FACTOR_COUNT}v/${diagnostics.UNVERIFIED_TOTP_FACTOR_COUNT}u`
    : null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 p-6">
      <div className="w-full max-w-md border border-neutral-800 rounded-lg p-8 bg-neutral-900">
        <h1 className="text-2xl font-semibold mb-2">Zwei-Faktor-Authentifizierung</h1>

        {phase === MfaUiPhase.LOADING ? (
          <p className="text-neutral-400">Wird geladen…</p>
        ) : null}

        {phase === MfaUiPhase.NO_FACTOR ? (
          <>
            <p className="text-sm text-neutral-400 mb-4">
              Authenticator-App scannen oder Secret manuell eingeben, dann den 6-stelligen Code bestätigen.
            </p>
            {qrSrc ? (
              <img
                src={qrSrc}
                alt="TOTP QR-Code für Authenticator-App"
                className="mb-4 bg-white p-2 rounded max-w-[220px]"
              />
            ) : (
              <p className="text-sm text-amber-400 mb-4">QR-Code nicht verfügbar — Secret manuell verwenden.</p>
            )}
            {manualSecret ? (
              <p className="text-xs font-mono break-all text-neutral-300 mb-4 p-2 border border-neutral-700 rounded">
                Manuelles Secret (nur während Setup anzeigen): {manualSecret}
              </p>
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
              disabled={busy}
              className="w-full rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 px-4 py-2 font-medium"
            >
              TOTP aktivieren
            </button>
          </>
        ) : null}

        {phase === MfaUiPhase.UNVERIFIED_FACTOR ? (
          <>
            <p className="text-sm text-neutral-400 mb-4">
              Eine TOTP-Registrierung wurde begonnen, aber nicht abgeschlossen. Der QR-Code ist nicht mehr
              verfügbar — bitte Registrierung sicher neu starten.
            </p>
            <button
              type="button"
              onClick={restartUnverifiedEnrollment}
              disabled={busy}
              className="w-full rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 px-4 py-2 font-medium mb-3"
            >
              TOTP-Registrierung neu starten
            </button>
          </>
        ) : null}

        {phase === MfaUiPhase.VERIFIED_FACTOR ? (
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
              disabled={busy}
              className="w-full rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 px-4 py-2 font-medium mb-3"
            >
              Bestätigen
            </button>
            <button
              type="button"
              onClick={() => {
                setLostAuthenticator(true);
                initStarted.current = false;
                setPhase(MfaUiPhase.LOADING);
                bootstrap();
              }}
              className="w-full text-sm text-neutral-400 underline"
            >
              Kein Zugriff auf den eingerichteten Authenticator?
            </button>
          </>
        ) : null}

        {phase === MfaUiPhase.RECOVERY_REQUIRED ? (
          <>
            <p className="text-sm text-neutral-400 mb-4">
              Für dieses Konto ist bereits ein verifizierter TOTP-Faktor hinterlegt. Ein automatischer Reset ist
              aus Sicherheitsgründen nicht möglich.
            </p>
            <p className="text-sm text-neutral-300 mb-4">
              Staging-Recovery: Supabase Dashboard → Authentication → Users → MFA-Faktoren für diesen Benutzer
              entfernen, danach erneut anmelden. Es erscheint dann ein neuer QR-Code.
            </p>
            <Link href="/command-center/login/" className="text-sm text-emerald-400 underline">
              Zurück zur Anmeldung
            </Link>
          </>
        ) : null}

        {phase === MfaUiPhase.ERROR ? (
          <p className="text-sm text-red-400">MFA nicht verfügbar. Bitte erneut anmelden.</p>
        ) : null}

        {error ? (
          <p className="text-sm text-red-400 mt-4" role="alert">
            {error}
          </p>
        ) : null}

        {diagLine ? (
          <p className="text-xs text-neutral-500 mt-6" aria-live="polite">
            {diagLine}
          </p>
        ) : null}
      </div>
    </main>
  );
}
