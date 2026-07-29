'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

/** DTH-04: Preview route — no fixed ProSeal overlay (private + /unternehmen unchanged). */
function isBusinessPreviewRoute(pathname) {
  return pathname === '/unternehmen-neu' || pathname?.startsWith('/unternehmen-neu/')
}

export function ProSealWidget() {
  const pathname = usePathname()
  const wrapperRef = useRef(null)
  const [isMobile, setIsMobile] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const disabled = isBusinessPreviewRoute(pathname)

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

    const script = document.createElement('script')
    script.src = 'https://s.provenexpert.net/seals/proseal-v2.js'

    script.onload = () => {
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

    // Strategy: Let ProSeal render normally, then kidnap its DOM element
    // into our own fixed container. Keep forcing position:relative so
    // ProSeal's Svelte re-renders can't escape our container.
    const interval = setInterval(() => {
      const seal = document.querySelector('.pe-pro-seal')
      if (!seal || !wrapperRef.current) return

      // Move into our container if not already there
      if (seal.parentElement !== wrapperRef.current) {
        wrapperRef.current.appendChild(seal)
      }

      // Kill ProSeal's own fixed positioning — we handle it
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
    }
  }, [disabled])

  if (disabled) return null

  // OUR container — WE control the position. ProSeal lives inside this.
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
    <div
      ref={wrapperRef}
      style={wrapperStyle}
    />
  )
}
