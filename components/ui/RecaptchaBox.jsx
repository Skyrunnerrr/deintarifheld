'use client'

import { useEffect, useRef, useState } from 'react'
import {
  getVisibleRecaptchaSiteKey,
  hasStandardV3SiteKey,
  hasVisibleRecaptchaSiteKey,
  isRecaptchaV3RuntimeReady,
  loadRecaptcha,
  renderVisibleRecaptcha,
} from '@/lib/security'

/**
 * Production: Enterprise v3 execute via loadRecaptcha() (fresh token on submit).
 * Visible v2 checkbox remains available only when NEXT_PUBLIC_RECAPTCHA_SITE_KEY
 * is set (must stay unset in production).
 * `action` is informational; the server derives expectedAction from
 * endpoint + page_source and ignores client `_recaptchaAction`.
 */
export function RecaptchaBox({ onToken, theme = 'dark', action = 'submit' }) {
  const containerRef = useRef(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('')

  useEffect(() => {
    let disposed = false

    async function setup() {
      if (hasVisibleRecaptchaSiteKey()) {
        if (!containerRef.current) return
        setMode('visible')
        if (typeof onToken === 'function') onToken('')

        try {
          await renderVisibleRecaptcha(containerRef.current, {
            theme,
            callback: (token) => {
              if (!disposed && typeof onToken === 'function') {
                setError('')
                onToken(token || '')
              }
            },
            expiredCallback: () => {
              if (!disposed && typeof onToken === 'function') {
                onToken('')
                setError('Captcha ist abgelaufen. Bitte erneut bestätigen.')
              }
            },
          })
        } catch {
          if (!disposed) {
            if (typeof onToken === 'function') onToken('')
            setError('Captcha konnte nicht geladen werden. Bitte Seite neu laden.')
          }
        }
        return
      }

      if (hasStandardV3SiteKey()) {
        try {
          await loadRecaptcha()
          if (!disposed && isRecaptchaV3RuntimeReady()) {
            setMode('v3')
            setError('')
          } else if (!disposed) {
            setMode('')
            setError('Captcha konnte nicht geladen werden. Bitte Seite neu laden.')
          }
        } catch {
          if (!disposed) {
            setMode('')
            setError('Captcha konnte nicht geladen werden. Bitte Seite neu laden.')
          }
        }
        return
      }

      setError('Captcha-Konfiguration fehlt (NEXT_PUBLIC_RECAPTCHA_SITE_KEY oder NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY).')
    }

    setup()
    return () => {
      disposed = true
    }
  }, [onToken, theme, action])

  return (
    <div data-recaptcha-action={action}>
      <div ref={containerRef} />
      {error && <p role="alert" className="text-xs mt-2" style={{ color: '#EF4444' }}>{error}</p>}
      {!error && (mode === 'visible' || mode === 'v3') && (
        <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Geschützt durch reCAPTCHA
        </p>
      )}
      {!hasVisibleRecaptchaSiteKey() && !hasStandardV3SiteKey() && (
        <p role="alert" className="text-xs mt-2" style={{ color: '#EF4444' }}>
          Bitte in .env.local NEXT_PUBLIC_RECAPTCHA_SITE_KEY oder NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY setzen.
        </p>
      )}
      <input type="hidden" value={getVisibleRecaptchaSiteKey()} readOnly aria-hidden="true" />
    </div>
  )
}
