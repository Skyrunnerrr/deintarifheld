'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '../../../lib/supabase/browser.js';
import {
  HOSTED_PASSWORD_MIN_LENGTH,
  HostedAuthFlowType,
  MFA_PATH,
} from '../../../lib/command-center/invite-flow.js';

export default function SetPasswordClient() {
  const [flowType, setFlowType] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          window.location.href = '/command-center/login/?error=session';
          return;
        }
        const res = await fetch('/api/command-center/auth/flow-state', { credentials: 'include' });
        if (!res.ok) {
          window.location.href = '/command-center/login/?error=session';
          return;
        }
        const body = await res.json();
        if (!cancelled) {
          if (body.state === 'PASSWORD_SET') {
            window.location.href = MFA_PATH + '/';
            return;
          }
          if (body.state !== 'INITIAL_PASSWORD_REQUIRED') {
            window.location.href = '/command-center/login/';
            return;
          }
          setFlowType(body.flowType || HostedAuthFlowType.INVITE);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Passwort-Setup derzeit nicht verfügbar.');
          setLoading(false);
        }
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }
    if (password.length < HOSTED_PASSWORD_MIN_LENGTH) {
      setError(`Passwort muss mindestens ${HOSTED_PASSWORD_MIN_LENGTH} Zeichen haben.`);
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError('Passwort wurde abgelehnt. Mindestlänge und Stärke laut Supabase-Richtlinie prüfen.');
        return;
      }
      const completeRes = await fetch('/api/command-center/auth/complete-password-setup', {
        method: 'POST',
        credentials: 'include',
      });
      if (!completeRes.ok) {
        setError('Passwort gespeichert, aber Setup konnte nicht abgeschlossen werden. Erneut anmelden.');
        return;
      }
      window.location.href = MFA_PATH + '/';
    } catch {
      setError('Passwort konnte nicht gespeichert werden.');
    } finally {
      setSubmitting(false);
    }
  }

  const title =
    flowType === HostedAuthFlowType.RECOVERY
      ? 'Neues Passwort festlegen'
      : 'Passwort festlegen';

  const hint =
    flowType === HostedAuthFlowType.RECOVERY
      ? 'Recovery: Neues Passwort setzen, danach Authenticator-Code eingeben.'
      : 'Einladung bestätigt. Bitte ein sicheres Passwort festlegen, danach folgt die MFA-Einrichtung.';

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 p-6">
      <div className="w-full max-w-md border border-neutral-800 rounded-lg p-8 bg-neutral-900">
        <h1 className="text-2xl font-semibold mb-2">{title}</h1>
        <p className="text-sm text-neutral-400 mb-6">{hint}</p>

        {loading ? (
          <p className="text-neutral-400">Wird geladen…</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm mb-1">
                Neues Passwort
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={HOSTED_PASSWORD_MIN_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm mb-1">
                Passwort bestätigen
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={HOSTED_PASSWORD_MIN_LENGTH}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2"
              />
            </div>
            <p className="text-xs text-neutral-500">
              Mindestens {HOSTED_PASSWORD_MIN_LENGTH} Zeichen. Supabase prüft zusätzlich Leaked-Password-Schutz.
            </p>
            {error ? (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 px-4 py-2 font-medium"
            >
              {submitting ? 'Wird gespeichert…' : 'Passwort speichern'}
            </button>
          </form>
        )}

        <p className="text-xs text-neutral-500 mt-6">
          <Link href="/command-center/login/" className="underline">
            Zur Anmeldung
          </Link>
        </p>
      </div>
    </main>
  );
}
