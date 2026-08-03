/**
 * Browser passkey gate client — Clerk browser runtime via FAPI CDN (no npm SDK).
 * Never displays, copies, or logs session tokens.
 */
(function () {
  const cfg = window.__DTH_PASSKEY_GATE__ || {};
  const statusEl = document.getElementById('dth-gate-status');
  const msgEl = document.getElementById('dth-gate-message');
  const actionsEl = document.getElementById('dth-gate-actions');
  const shellEl = document.getElementById('dth-local-shell');

  /**
   * Gate completion for this Clerk session.
   * In-memory for the current document; sessionStorage only mirrors the same
   * Clerk session.id so /auth/entry survives a same-tab navigation (not a
   * standalone trust flag — still requires live clerk.session + passkey).
   */
  let explicitPasskeyVerificationComplete = false;
  let clerk = null;

  function gateStorageKey(sessionId) {
    return 'dth_pk_gate_' + String(sessionId || '');
  }

  function rememberPasskeyGate(sessionId) {
    explicitPasskeyVerificationComplete = true;
    try {
      if (sessionId) sessionStorage.setItem(gateStorageKey(sessionId), '1');
    } catch {
      /* ignore quota / private mode */
    }
  }

  function restorePasskeyGate(sessionId) {
    if (explicitPasskeyVerificationComplete) return true;
    try {
      if (sessionId && sessionStorage.getItem(gateStorageKey(sessionId)) === '1') {
        explicitPasskeyVerificationComplete = true;
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  function clearPasskeyGate(sessionId) {
    explicitPasskeyVerificationComplete = false;
    try {
      if (sessionId) sessionStorage.removeItem(gateStorageKey(sessionId));
    } catch {
      /* ignore */
    }
  }

  function setStatus(text, tone) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.dataset.tone = tone || 'deny';
  }

  /** Surface Clerk/WebAuthn errors without tokens/secrets. */
  function formatClerkError(err) {
    if (!err) return 'UNKNOWN';
    const parts = [];
    if (err.name) parts.push(String(err.name));
    if (err.code != null && String(err.code) !== String(err.name)) {
      parts.push(String(err.code));
    }
    const clerkCode = err.errors && err.errors[0] && err.errors[0].code;
    if (clerkCode) parts.push(String(clerkCode));
    const msg = err.longMessage || err.message;
    if (msg && !/eyJ|Bearer\s|pk_|sk_/i.test(String(msg))) {
      parts.push(String(msg).slice(0, 160));
    }
    // Legacy DOMException: 23 = TIMEOUT_ERR
    if (String(err.code) === '23' || /timeout/i.test(String(msg || '')) || err.name === 'TimeoutError') {
      parts.push('HINT=WEBAUTHN_TIMEOUT_OR_DISMISSED');
    }
    return parts.filter(Boolean).join(' | ') || 'UNKNOWN';
  }

  function setMessage(html) {
    if (msgEl) msgEl.innerHTML = html;
  }

  function clearActions() {
    if (actionsEl) actionsEl.innerHTML = '';
  }

  function addButton(label, onClick, { primary = false, disabled = false } = {}) {
    if (!actionsEl) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    if (primary) btn.className = 'primary';
    btn.disabled = disabled;
    btn.addEventListener('click', () => {
      Promise.resolve(onClick()).catch((err) => {
        setStatus('Fehler: ' + formatClerkError(err), 'deny');
      });
    });
    actionsEl.appendChild(btn);
  }

  function addLink(label, href, { primary = false } = {}) {
    if (!actionsEl) return;
    const a = document.createElement('a');
    a.href = href;
    a.className = primary ? 'btn primary' : 'btn';
    a.textContent = label;
    actionsEl.appendChild(a);
  }

  function evaluateGate({ signedIn, passkeyEnrolledCount }) {
    if (!signedIn) {
      return { state: 'UNAUTHENTICATED', allowLocalNonOperationalShell: false };
    }
    if (!(passkeyEnrolledCount > 0)) {
      return { state: 'AUTHENTICATED_NO_PASSKEY', allowLocalNonOperationalShell: false };
    }
    if (!explicitPasskeyVerificationComplete) {
      return {
        state: 'AUTHENTICATED_PASSKEY_NOT_VERIFIED',
        allowLocalNonOperationalShell: false,
      };
    }
    return { state: 'PASSKEY_VERIFIED_LOCAL_SHELL', allowLocalNonOperationalShell: true };
  }

  function showShell(visible) {
    if (shellEl) shellEl.dataset.visible = visible ? 'true' : 'false';
  }

  function passkeyCount(user) {
    if (!user) return 0;
    const list = user.passkeys;
    return Array.isArray(list) ? list.length : 0;
  }

  async function verifyPasskey() {
    if (!clerk?.session) {
      setStatus('VERIFY_SESSION_MISSING', 'deny');
      return;
    }
    setStatus('PASSKEY_VERIFICATION_IN_PROGRESS', 'deny');

    // Clerk step-up requires startVerification first. After a fresh passkey
    // sign-in, Clerk rejects this with invalid_action_for_session_reverification.
    if (typeof clerk.session.startVerification === 'function') {
      try {
        await clerk.session.startVerification({ level: 'first_factor' });
      } catch (err) {
        const code =
          (err && err.errors && err.errors[0] && err.errors[0].code) || err.code || '';
        if (String(code) === 'invalid_action_for_session_reverification') {
          // Only accept if this session already completed passkey sign-in
          // (remembered for this Clerk session.id). Email-OTP sessions stay denied.
          if (restorePasskeyGate(clerk.session.id)) {
            await render();
            return;
          }
          setStatus('PASSKEY_SIGNIN_REQUIRED_FOR_GATE', 'deny');
          setMessage(
            '<p class="deny-note">Schritt ist frisch, aber nicht über Passkey-Sign-in. Bitte abmelden und unter /auth/signin mit Passkey anmelden.</p>',
          );
          clearActions();
          addLink('Zur Passkey-Anmeldung', '/auth/signin', { primary: true });
          addButton('Abmelden', () => signOut());
          return;
        }
        throw err;
      }
    }

    if (typeof clerk.session.verifyWithPasskey !== 'function') {
      setStatus('VERIFY_WITH_PASSKEY_UNAVAILABLE', 'deny');
      setMessage(
        '<p class="deny-note">Clerk Session.verifyWithPasskey ist in dieser Runtime nicht verfügbar.</p>',
      );
      return;
    }

    const result = await clerk.session.verifyWithPasskey();
    const status = result && result.status ? String(result.status) : '';
    if (status === 'complete' || status === 'verified' || result?.verified === true || !status) {
      rememberPasskeyGate(clerk.session.id);
      await render();
      return;
    }
    setStatus('PASSKEY_VERIFICATION_INCOMPLETE', 'deny');
    setMessage(
      '<p class="deny-note">Passkey-Verifikation nicht abgeschlossen (status=' +
        status +
        ').</p>',
    );
  }

  function isReverificationRequired(err) {
    if (!err) return false;
    const code = String(err.code || '');
    const clerkCode = err.errors && err.errors[0] && String(err.errors[0].code || '');
    const msg = String(err.message || err.longMessage || '');
    return (
      code === 'session_reverification_required' ||
      clerkCode === 'session_reverification_required' ||
      /session_reverification_required/i.test(msg) ||
      /additional verification/i.test(msg)
    );
  }

  async function completeEnrollmentCreatePasskey() {
    // Do not pass rpId: Clerk derives it from the current hostname (localhost in Dev).
    // Never force production RP ID (cc.deintarifheld.de) or an IP (127.0.0.1).
    await clerk.user.createPasskey();
    if (typeof clerk.user.reload === 'function') await clerk.user.reload();
    setStatus('PASSKEY_ENROLLMENT_COMPLETE', 'ok');
    setMessage(
      '<p>Passkey-Registrierung abgeschlossen. Als Nächstes: abmelden, dann Passkey-Anmeldung.</p>',
    );
    clearActions();
    addButton('Abmelden', () => signOut(), { primary: true });
    addLink('Zur Passkey-Anmeldung', '/auth/signin');
  }

  async function startEnrollmentReverification() {
    if (!clerk?.session?.startVerification) {
      setStatus('REVERIFICATION_API_UNAVAILABLE', 'deny');
      setMessage(
        '<p class="deny-note">Clerk session.startVerification ist nicht verfügbar.</p>',
      );
      return;
    }
    setStatus('SESSION_REVERIFICATION_REQUIRED', 'deny');
    setMessage(
      '<p class="deny-note">Clerk verlangt zusätzliche Verifikation vor dem Passkey (nur Enrollment, kein operativer Login). Code privat eingeben — nicht in den Chat.</p>',
    );
    const verification = await clerk.session.startVerification({ level: 'first_factor' });
    const emailFactor = (verification?.supportedFirstFactors || []).find(
      (f) => f && f.strategy === 'email_code',
    );
    if (!emailFactor || !emailFactor.emailAddressId) {
      setStatus('REVERIFICATION_EMAIL_FACTOR_UNAVAILABLE', 'deny');
      setMessage(
        '<p class="deny-note">Kein Email-OTP-Faktor für Reverification verfügbar.</p>',
      );
      return;
    }
    await clerk.session.prepareFirstFactorVerification({
      strategy: 'email_code',
      emailAddressId: emailFactor.emailAddressId,
    });
    clearActions();
    // Do not render full email — safeIdentifier may be partially masked by Clerk.
    setMessage(
      '<p class="deny-note">Reverification-Code wurde gesendet (Enrollment only). Code privat eintragen.</p><p><input id="dth-reverify-code" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="Code" style="width:12rem;padding:.5rem;font:inherit" /></p>',
    );
    addButton(
      'Reverification abschließen und Passkey anlegen',
      async () => {
        const input = document.getElementById('dth-reverify-code');
        const code = input && input.value ? String(input.value).trim() : '';
        if (!code) {
          setStatus('REVERIFICATION_CODE_REQUIRED', 'deny');
          return;
        }
        // Never log or transmit the code outside Clerk APIs.
        setStatus('REVERIFICATION_IN_PROGRESS', 'deny');
        await clerk.session.attemptFirstFactorVerification({
          strategy: 'email_code',
          code,
        });
        if (input) input.value = '';
        setStatus('PASSKEY_ENROLLMENT_IN_PROGRESS', 'deny');
        await completeEnrollmentCreatePasskey();
      },
      { primary: true },
    );
    addButton('Abmelden', () => signOut());
  }

  async function enrollPasskey() {
    if (!clerk?.user) {
      setStatus('SIGN_IN_REQUIRED_FOR_ENROLLMENT', 'deny');
      return;
    }
    if (passkeyCount(clerk.user) >= 1) {
      setStatus('SINGLE_PASSKEY_ONLY', 'deny');
      setMessage(
        '<p class="deny-note">Es ist bereits ein Passkey vorhanden. Kein zweiter Passkey.</p>',
      );
      await render();
      return;
    }
    if (typeof clerk.user.createPasskey !== 'function') {
      setStatus('CREATE_PASSKEY_UNAVAILABLE', 'deny');
      return;
    }
    setStatus('PASSKEY_ENROLLMENT_IN_PROGRESS', 'deny');
    try {
      await completeEnrollmentCreatePasskey();
    } catch (err) {
      if (isReverificationRequired(err)) {
        await startEnrollmentReverification();
        return;
      }
      throw err;
    }
  }

  async function startEnrollmentSession() {
    if (!clerk) return;
    setStatus('ENROLLMENT_SESSION_IN_PROGRESS', 'deny');
    if (typeof clerk.openSignIn === 'function') {
      await clerk.openSignIn({
        afterSignInUrl: '/auth/enroll',
        signUpUrl: undefined,
      });
      await render();
      return;
    }
    if (typeof clerk.redirectToSignIn === 'function') {
      await clerk.redirectToSignIn({ redirectUrl: '/auth/enroll' });
      return;
    }
    if (typeof clerk.mountSignIn === 'function') {
      clearActions();
      setMessage('<p>Enrollment-Sitzung: bitte im Formular anmelden (nur für Passkey-Registrierung).</p>');
      const host = document.createElement('div');
      host.id = 'dth-clerk-signin-host';
      if (msgEl) msgEl.appendChild(host);
      clerk.mountSignIn(host);
      return;
    }
    setStatus('ENROLLMENT_SESSION_UI_UNAVAILABLE', 'deny');
    setMessage(
      '<p class="deny-note">Clerk Sign-in UI nicht verfügbar. Enrollment-Sitzung kann lokal nicht gestartet werden.</p>',
    );
  }

  async function activateSignInSession(signIn) {
    if (!signIn) return false;
    const status = String(signIn.status || '');
    if (status && status !== 'complete') {
      setStatus('PASSKEY_SIGNIN_INCOMPLETE', 'deny');
      setMessage(
        '<p class="deny-note">Passkey-Anmeldung nicht abgeschlossen (status=' +
          status +
          '). Bitte in Safari erneut versuchen.</p>',
      );
      return false;
    }
    // Clerk v6+: finalize activates the browser session without raw token handling.
    if (typeof signIn.finalize === 'function') {
      await signIn.finalize({
        navigate: async () => {
          /* stay on local gate pages; no external redirect */
        },
      });
      return true;
    }
    // Older clerk-js: setActive with createdSessionId.
    if (signIn.createdSessionId && typeof clerk.setActive === 'function') {
      await clerk.setActive({ session: signIn.createdSessionId });
      return true;
    }
    // Some builds mutate clerk.session during authenticateWithPasskey itself.
    return Boolean(clerk.session && clerk.user);
  }

  async function signInWithPasskey() {
    if (!clerk) return;
    setStatus('PASSKEY_SIGNIN_IN_PROGRESS', 'deny');
    const signIn = clerk.client?.signIn;
    let used = null;
    if (signIn && typeof signIn.passkey === 'function') {
      used = signIn;
      await signIn.passkey({ flow: 'discoverable' });
    } else if (signIn && typeof signIn.authenticateWithPasskey === 'function') {
      used = signIn;
      await signIn.authenticateWithPasskey({ flow: 'discoverable' });
    } else if (typeof clerk.authenticateWithPasskey === 'function') {
      await clerk.authenticateWithPasskey({ flow: 'discoverable' });
      used = clerk.client?.signIn || null;
    } else {
      setStatus('PASSKEY_SIGNIN_API_UNAVAILABLE', 'deny');
      setMessage(
        '<p class="deny-note">Passkey-Sign-in API in dieser Clerk-Runtime nicht gefunden.</p>',
      );
      return;
    }
    const activated = await activateSignInSession(used);
    if (!activated && !(clerk.session && clerk.user)) {
      setStatus('PASSKEY_SIGNIN_SESSION_NOT_ACTIVE', 'deny');
      setMessage(
        '<p class="deny-note">Passkey-Zeremonie lief, aber keine aktive Clerk-Session. Bitte in Safari erneut versuchen.</p>',
      );
      return;
    }
    // Passkey sign-in itself is the explicit passkey assurance for this gate level.
    rememberPasskeyGate(clerk.session && clerk.session.id);
    setStatus('PASSKEY_SIGNIN_SESSION_ACTIVE', 'ok');
    setMessage(
      '<p>Passkey-Anmeldung aktiv. Lokaler nicht-operativer CC-Eingang ist freigeschaltet.</p>',
    );
    await render();
    clearActions();
    addLink('Zum lokalen CC-Eingang', '/auth/entry', { primary: true });
    addButton('Abmelden', () => signOut());
  }

  async function signOut() {
    clearPasskeyGate(clerk && clerk.session && clerk.session.id);
    if (clerk) await clerk.signOut();
    await render();
  }

  async function render() {
    clearActions();
    showShell(false);

    if (!cfg.publishableKeyConfigured) {
      setStatus('CLERK_PUBLISHABLE_KEY_MISSING', 'deny');
      setMessage(
        '<p class="deny-note">Lokale Runtime-Konfiguration fehlt. Setze DTH_CLERK_PUBLISHABLE_KEY privat in der Umgebung (Wert nicht im Chat).</p>',
      );
      return;
    }

    if (!clerk) {
      setStatus('CLERK_LOADING', 'deny');
      setMessage('<p>Clerk Browser-Runtime wird geladen…</p>');
      return;
    }

    const signedIn = Boolean(clerk.session && clerk.user);
    const enrolled = passkeyCount(clerk.user);
    if (signedIn && clerk.session) restorePasskeyGate(clerk.session.id);
    const gate = evaluateGate({ signedIn, passkeyEnrolledCount: enrolled });

    if (gate.state === 'UNAUTHENTICATED') {
      setStatus('UNAUTHENTICATED_CC_ENTRY_DENIED', 'deny');
      setMessage(
        '<p class="deny-note">Nicht angemeldet. Operativer CC-Inhalt und lokaler Shell sind gesperrt.</p>',
      );
      if (cfg.mode === 'signin') {
        addButton('Mit Passkey anmelden', () => signInWithPasskey(), { primary: true });
      } else if (cfg.mode === 'enroll') {
        setMessage(
          '<p class="deny-note">Für die Passkey-Registrierung ist eine bestehende Development-Sitzung nötig. Email-OTP darf nur zur Enrollment-Sitzung genutzt werden — nicht als operativer CC-Login.</p>',
        );
        addButton('Enrollment-Sitzung starten', () => startEnrollmentSession(), {
          primary: true,
        });
      } else {
        addLink('Zur Passkey-Anmeldung', '/auth/signin', { primary: true });
        addLink('Passkey registrieren', '/auth/enroll');
      }
      return;
    }

    if (gate.state === 'AUTHENTICATED_NO_PASSKEY') {
      setStatus('PRE_PASSKEY_CC_ENTRY_DENIED', 'deny');
      setMessage(
        '<p class="deny-note">Sitzung vorhanden, aber kein Passkey. CC-Eingang gesperrt. Email-OTP gilt nicht als operativer Zugang.</p>',
      );
      if (cfg.mode === 'enroll') {
        addButton('Passkey jetzt registrieren', () => enrollPasskey(), { primary: true });
      } else {
        addLink('Passkey registrieren', '/auth/enroll', { primary: true });
      }
      addButton('Abmelden', () => signOut());
      return;
    }

    if (gate.state === 'AUTHENTICATED_PASSKEY_NOT_VERIFIED') {
      setStatus('PASSKEY_VERIFICATION_REQUIRED', 'deny');
      setMessage(
        '<p class="deny-note">Passkey vorhanden. Explizite Passkey-Verifikation ist vor dem lokalen CC-Shell erforderlich.</p>',
      );
      addButton('Passkey verifizieren', () => verifyPasskey(), { primary: true });
      addButton('Abmelden', () => signOut());
      if (cfg.mode === 'hub') addLink('CC-Eingang', '/auth/entry');
      return;
    }

    setStatus('POST_PASSKEY_LOCAL_SHELL_ALLOWED', 'ok');
    setMessage(
      '<p>Explizite Passkey-Verifikation abgeschlossen. Operative API-/Schreibzugriffe bleiben verweigert.</p>',
    );
    showShell(true);
    addButton('Live JWKS-Validierung (H0b2b)', () => runLiveJwksValidation(), { primary: true });
    addButton('Abmelden', () => signOut());
    if (cfg.mode === 'hub') addLink('CC-Eingang', '/auth/entry', { primary: true });
  }

  async function runLiveJwksValidation() {
    if (!clerk?.session?.getToken) {
      setStatus('LIVE_SESSION_GETTOKEN_UNAVAILABLE', 'deny');
      return;
    }
    setStatus('LIVE_JWKS_VALIDATION_IN_PROGRESS', 'deny');
    setMessage('<p>Transient Session-Token → lokaler Validator (Token wird nicht angezeigt).</p>');
    let token = null;
    try {
      token = await clerk.session.getToken();
      if (!token) {
        setStatus('LIVE_SESSION_TOKEN_UNAVAILABLE', 'deny');
        setMessage('<p class="deny-note">Keine Session-Token von Clerk erhalten.</p>');
        return;
      }
      const res = await fetch('/auth/validate-provider-session', {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + token,
          accept: 'application/json',
        },
      });
      // Drop local token reference immediately after request start/completion.
      token = null;
      const body = await res.json();
      if (body && body.liveProviderAuthentication === 'PASS' && body.dthAuthorization === 'DENIED_EXPECTED') {
        setStatus('LIVE_PROVIDER_AUTHENTICATION=PASS · DTH_AUTHORIZATION=DENIED_EXPECTED', 'ok');
        setMessage(
          '<p>Live JWKS/Claims gültig. Unknown subject rejected. Operativer Zugriff verweigert (erwartet).</p>' +
            '<p class="status" data-tone="ok">remoteJwks=' +
            String(body.remoteDevelopmentJwksUsed) +
            ' · mapping=' +
            String(body.realSubjectHasDthPersonMapping) +
            ' · unknownRejected=' +
            String(body.unknownRealSubjectRejected) +
            '</p>',
        );
      } else {
        setStatus(
          'LIVE_PROVIDER_AUTHENTICATION=' +
            String(body && body.liveProviderAuthentication) +
            ' · CODE=' +
            String(body && body.code),
          'deny',
        );
        setMessage(
          '<p class="deny-note">Validierung nicht im erwarteten AuthN-PASS / Mapping-Deny-Zustand.</p>',
        );
      }
    } catch (err) {
      token = null;
      setStatus('LIVE_JWKS_VALIDATION_FAILED', 'deny');
      setMessage(
        '<p class="deny-note">Validator-Request fehlgeschlagen (' +
          formatClerkError(err) +
          ').</p>',
      );
    } finally {
      token = null;
    }
  }

  function waitForClerkGlobal(timeoutMs) {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        if (window.Clerk) {
          resolve(window.Clerk);
          return;
        }
        if (Date.now() - started > timeoutMs) {
          reject(new Error('CLERK_GLOBAL_MISSING'));
          return;
        }
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  async function boot() {
    if (!cfg.publishableKeyConfigured) {
      await render();
      return;
    }
    try {
      setStatus('CLERK_LOADING', 'deny');
      clerk = await waitForClerkGlobal(20000);
      const loadOpts = {};
      if (window.__internal_ClerkUICtor) {
        loadOpts.ui = { ClerkUI: window.__internal_ClerkUICtor };
      }
      if (typeof clerk.load === 'function') {
        await clerk.load(loadOpts);
      }
      await render();
    } catch (err) {
      const code = err && err.message ? String(err.message) : 'CLERK_BOOT_FAILED';
      setStatus(code, 'deny');
      setMessage('<p class="deny-note">Clerk konnte nicht geladen werden.</p>');
    }
  }

  boot();
})();
