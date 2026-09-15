'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  CONSENT_CHANGED_EVENT,
  CONSENT_STORAGE_KEY,
  PROVENEXPERT_SCRIPT_URL,
  shouldLoadProvenExpertScript,
} from '@/lib/consent/third-party'
import {
  hasProvenExpertDestroyApi,
  planProvenExpertWithdrawal,
  readWithdrawalReloadFlag,
  stripProvenExpertDom,
  writeWithdrawalReloadFlag,
} from '@/lib/consent/provenexpert-runtime'

/** DTH-04: Preview route — no fixed ProSeal overlay (private + /unternehmen unchanged). */
function isBusinessPreviewRoute(pathname) {
  return pathname === '/unternehmen-neu' || pathname?.startsWith('/unternehmen-neu/')
}

function readProvenExpertConsent() {
  try {
    return shouldLoadProvenExpertScript(window.localStorage.getItem(CONSENT_STORAGE_KEY))
  } catch {
    return false
  }
}

export function ProSealWidget() {
  const pathname = usePathname()
  const wrapperRef = useRef(null)
  const prevAllowedRef = useRef(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [loadExternal, setLoadExternal] = useState(false)
  const disabled = isBusinessPreviewRoute(pathname)

  useEffect(() => {
    if (disabled) return undefined

    const syncConsent = () => setLoadExternal(readProvenExpertConsent())
    syncConsent()
    window.addEventListener(CONSENT_CHANGED_EVENT, syncConsent)
    window.addEventListener('storage', syncConsent)
    return () => {
      window.removeEventListener(CONSENT_CHANGED_EVENT, syncConsent)
      window.removeEventListener('storage', syncConsent)
    }
  }, [disabled])

  useEffect(() => {
    if (disabled) return undefined

    const mediaQuery = window.matchMedia('(max-width: 767px)')

    const syncViewportState = (event) => {
      const mobile = event.matches
      setIsMobile(mobile)
      setIsVisible(true)
    }

    syncViewportState(mediaQuery)
    mediaQuery.addEventListener('change', syncViewportState)

    return () => {
      mediaQuery.removeEventListener('change', syncViewportState)
    }
  }, [disabled])

  useEffect(() => {
    if (disabled) return undefined

    if (!isMobile) {
      setIsVisible(true)
      return undefined
    }

    const timer = window.setTimeout(() => {
      setIsVisible(false)
    }, 10000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [disabled, isMobile])

  useEffect(() => {
    if (disabled) return undefined

    const plan = planProvenExpertWithdrawal({
      previousAllowed: prevAllowedRef.current,
      nextAllowed: loadExternal,
      destroyApiAvailable: hasProvenExpertDestroyApi(window),
      alreadyReloaded: readWithdrawalReloadFlag(window.sessionStorage),
    })

    if (plan.stripDom) {
      stripProvenExpertDom(document)
    }

    if (plan.reload) {
      writeWithdrawalReloadFlag(window.sessionStorage, true)
      window.location.reload()
      return undefined
    }

    if (loadExternal) {
      writeWithdrawalReloadFlag(window.sessionStorage, false)
    }

    prevAllowedRef.current = loadExternal

    if (!plan.loadScript) return undefined

    const script = document.createElement('script')
    script.src = PROVENEXPERT_SCRIPT_URL
    script.setAttribute('data-dth-provenexpert', '1')

    script.onload = () => {
      if (!shouldLoadProvenExpertScript(window.localStorage.getItem(CONSENT_STORAGE_KEY))) {
        stripProvenExpertDom(document)
        return
      }
      if (window.provenExpert?.proSeal) {
        window.provenExpert.proSeal({
          widgetId: '7d208aee-20e0-4753-b215-0e4d90ba848f',
          language: 'de-DE',
          usePageLanguage: false,
          bannerColor: '#444444',
          textColor: '#FFFFFF',
          showBackPage: false,
          showReviews: true,
          hideDate: true,
          hideName: false,
          googleStars: false,
          displayReviewerLastName: false,
          stickyToSide: 'right',
        })
      }
    }

    document.head.appendChild(script)

    const interval = setInterval(() => {
      if (!shouldLoadProvenExpertScript(window.localStorage.getItem(CONSENT_STORAGE_KEY))) {
        stripProvenExpertDom(document)
        return
      }
      const seal = document.querySelector('.pe-pro-seal')
      if (!seal || !wrapperRef.current) return

      if (seal.parentElement !== wrapperRef.current) {
        wrapperRef.current.appendChild(seal)
      }

      seal.style.setProperty('position', 'relative', 'important')
      seal.style.setProperty('right', 'auto', 'important')
      seal.style.setProperty('left', 'auto', 'important')
      seal.style.setProperty('bottom', 'auto', 'important')
      seal.style.setProperty('top', 'auto', 'important')
      seal.classList.remove('pe-pro-seal-position-left')
    }, 100)

    return () => {
      clearInterval(interval)
      script.remove()
      stripProvenExpertDom(document)
    }
  }, [disabled, loadExternal])

  if (disabled) return null

  const wrapperStyle = isMobile
    ? {
        position: 'fixed',
        left: '50%',
        bottom: 'calc(108px + env(safe-area-inset-bottom))',
        top: 'auto',
        right: 'auto',
        transform: 'translateX(-50%)',
        zIndex: 45,
        display: isVisible ? 'block' : 'none',
      }
    : {
        position: 'fixed',
        right: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 70,
        display: 'block',
      }

  return (
    <div ref={wrapperRef} style={wrapperStyle} data-dth-pe-external={loadExternal ? '1' : '0'}>
      {!loadExternal && (
        <a
          href="/datenschutz"
          aria-label="Bewertungssiegel (lokal, ohne externes Script)"
          style={{
            display: 'inline-block',
            background: '#444444',
            color: '#FFFFFF',
            fontSize: 11,
            lineHeight: 1.3,
            padding: '8px 10px',
            textDecoration: 'none',
            maxWidth: 120,
          }}
        >
          ProvenExpert
        </a>
      )}
    </div>
  )
}
