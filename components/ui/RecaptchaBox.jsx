'use client'

import { useEffect, useRef, useState } from 'react'
import {
  getRecaptchaEnterpriseToken,
  getVisibleRecaptchaSiteKey,
  hasRecaptchaEnterpriseSiteKey,
  hasVisibleRecaptchaSiteKey,
  renderVisibleRecaptcha,
} from '@/lib/security'

export function RecaptchaBox({ onToken, theme = 'dark', action = 'submit' }) {
  const containerRef = useRef(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('')

  useEffect(() => {
    let disposed = false
    let refreshTimer = null

    async function setup() {
      onToken('')

      if (hasRecaptchaEnterpriseSiteKey()) {
        const token = await getRecaptchaEnterpriseToken(action)
        if (!disposed && token) {
          setMode('enterprise')
          setError('')
          onToken(token)

          // Enterprise tokens expire quickly; refresh proactively.
          refreshTimer = setInterval(async () => {
            const refreshed = await getRecaptchaEnterpriseToken(action)
            if (!disposed) onToken(refreshed || '')
          }, 90_000)
          return
        }
      }

      if (!hasVisibleRecaptchaSiteKey()) {
        setError('Captcha-Konfiguration fehlt (NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY oder NEXT_PUBLIC_RECAPTCHA_SITE_KEY).')
        return
      }

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
      } catch (err) {
        if (!disposed) {
          onToken('')
          setError('Captcha konnte nicht geladen werden. Bitte Seite neu laden.')
        }
      }
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
      {!error && mode === 'enterprise' && (
        <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Geschuetzt durch reCAPTCHA Enterprise
        </p>
      )}
      {!error && mode === 'visible' && hasVisibleRecaptchaSiteKey() && (
        <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Geschuetzt durch reCAPTCHA
        </p>
      )}
      {!hasVisibleRecaptchaSiteKey() && (
        <p role="alert" className="text-xs mt-2" style={{ color: '#EF4444' }}>
          Bitte in .env.local NEXT_PUBLIC_RECAPTCHA_SITE_KEY oder NEXT_PUBLIC_RECAPTCHA_PUBLIC_KEY setzen.
        </p>
      )}
      <input type="hidden" value={getVisibleRecaptchaSiteKey()} readOnly aria-hidden="true" />
    </div>
  )
}
