'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '../../../lib/supabase/browser.js';

function isSafeReturnTo(returnTo) {
  if (returnTo == null || returnTo === '') return true;
  if (typeof returnTo !== 'string') return false;
  if (!returnTo.startsWith('/')) return false;
  if (returnTo.startsWith('//')) return false;
  if (returnTo.includes('://')) return false;
  return true;
}

export default function CommandCenterLoginPage() {
  const searchParams = useSearchParams();
  const rawReturn = searchParams.get('returnTo') || '/command-center/';
  const returnTo = isSafeReturnTo(rawReturn) ? rawReturn : '/command-center/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError('Anmeldung fehlgeschlagen. Zugangsdaten prüfen.');
        return;
      }
      const { data: aalData, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) {
        setError('Authentifizierung konnte nicht abgeschlossen werden.');
        return;
      }
      const nextLevel = aalData?.nextLevel;
      const currentLevel = aalData?.currentLevel;
      if (currentLevel === 'aal2' && !nextLevel) {
        window.location.href = returnTo;
        return;
      }
      window.location.href = '/command-center/mfa/';
    } catch {
      setError('Authentifizierung derzeit nicht verfügbar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 p-6">
      <div className="w-full max-w-md border border-neutral-800 rounded-lg p-8 bg-neutral-900">
        <h1 className="text-2xl font-semibold mb-2">Command Center</h1>
        <p className="text-sm text-neutral-400 mb-6">Staging · Invite-only Operator-Zugang</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm mb-1">
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm mb-1">
              Passwort
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2"
            />
          </div>
          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 px-4 py-2 font-medium"
          >
            {loading ? 'Wird angemeldet…' : 'Anmelden'}
          </button>
        </form>
      </div>
    </main>
  );
}
