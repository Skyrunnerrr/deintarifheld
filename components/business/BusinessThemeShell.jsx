'use client'

import { useEffect } from 'react'
import { BUSINESS_VISUAL_CSS } from '@/components/business/businessVisualTokens'

/**
 * DTH-06 — mounts route-local light business theme for /unternehmen-neu only.
 * Restores body/html classes on unmount so private + /unternehmen stay unchanged.
 */
export function BusinessThemeShell({ children }) {
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    html.classList.add('dth-biz-root')
    body.classList.add('dth-biz')
    const prevBg = body.style.backgroundColor
    const prevColor = body.style.color
    body.style.backgroundColor = '#F5F4F1'
    body.style.color = '#152033'
    return () => {
      html.classList.remove('dth-biz-root')
      body.classList.remove('dth-biz')
      body.style.backgroundColor = prevBg
      body.style.color = prevColor
    }
  }, [])

  return (
    <div className="dth-biz min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: BUSINESS_VISUAL_CSS }} />
      {children}
    </div>
  )
}

export default BusinessThemeShell
