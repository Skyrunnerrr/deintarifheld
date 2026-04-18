// Restored after APFS sparse-file corruption
'use client'

import { useState, useEffect } from 'react'

/**
 * Renders an obfuscated email link that's only assembled client-side.
 * Bots reading the HTML source won't find a plain mailto: link.
 */
export function ObfuscatedEmail({ user = 'kontakt', domain = 'deintarifheld.de', style }) {
  const [email, setEmail] = useState(null)

  useEffect(() => {
    setEmail(`${user}@${domain}`)
  }, [user, domain])

  if (!email) {
    return <span style={style}>[E-Mail wird geladen]</span>
  }

  return (
    <a href={`mailto:${email}`} style={style}>
      {email}
    </a>
  )
}
