'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/**
 * Static cutover: public /rechner/ must not 500.
 * Canonical product calculator lives on the homepage (#rechner).
 */
export default function RechnerRedirectPage() {
  useEffect(() => {
    window.location.replace('/#rechner')
  }, [])

  return (
    <main
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        background: '#090B0F',
        color: '#F2F4F8',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <p style={{ marginBottom: '1rem' }}>Weiterleitung zum Tarifrechner…</p>
        <Link href="/#rechner" style={{ color: '#D4FF3E', fontWeight: 700 }}>
          Zum Rechner auf der Startseite
        </Link>
      </div>
    </main>
  )
}
