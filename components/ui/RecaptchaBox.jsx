'use client'

import { useEffect, useRef, useState } from 'react'
import {
  getRecaptchaToken,
  getVisibleRecaptchaSiteKey,
  hasStandardV3SiteKey,
  hasVisibleRecaptchaSiteKey,
  renderVisibleRecaptcha,
} from '@/lib/security'

/**
 * Standard reCAPTCHA only (v2 checkbox or v3 execute).
 * Enterprise is not a supported DTH production variant.
 * `action` is used only to mint a v3 token; the server derives expectedAction
 * from endpoint + page_source and ignores client `_recaptchaAction`.
 */
export function RecaptchaBox({ onToken, theme = 'dark', action = 'submit' }) {
  const containerRef = useRef(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('')

  useEffect(() => {
    let disposed = false
    let refreshTimer = null

    async function setup() {
      onToken('')

      if (hasVisibleRecaptchaSiteKey()) {
        if (!containerRef.current) return
        setMode('visible')

        try {
          await renderVisibleRecaptcha(containerRef.current, {
            theme,
            callback: (token) => {
              if (!disposed) {
                setError('')
                onToken(token || '')
              }
            },
            expiredCallback: () => {
              if (!disposed) {
                onToken('')
                setError('Captcha ist abgelaufen. Bitte erneut bestätigen.')
              }
            },
          })
        } catch {
          if (!disposed) {
            onToken('')
            setError('Captcha konnte nicht geladen werden. Bitte Seite neu laden.')
          }
        }
        return
      }

      if (hasStandardV3SiteKey()) {
        const token = await getRecaptchaToken(action)
        if (!disposed && token) {
          setMode('v3')
          setError('')
          onToken(token)
          refreshTimer = setInterval(async () => {
            const refreshed = await getRecaptchaToken(action)
            if (!disposed) onToken(refreshed || '')
          }, 90_000)
          return
        }
        if (!disposed) {
          setError('Captcha konnte nicht geladen werden. Bitte Seite neu laden.')
        }
        return
      }

      setError('Captcha-Konfiguration fehlt (NEXT_PUBLIC_RECAPTCHA_SITE_KEY oder NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY).')
    }

    setup()
    return () => {
      disposed = true
      if (refreshTimer) clearInterval(refreshTimer)
    }
  }, [onToken, theme, action])

  return (
    <div>
      <div ref={containerRef} />
      {error && <p role="alert" className="text-xs mt-2" style={{ color: '#EF4444' }}>{error}</p>}
      {!error && (mode === 'visible' || mode === 'v3') && (
        <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Geschuetzt durch reCAPTCHA
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
