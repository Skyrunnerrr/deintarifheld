export const metadata = {
  title: 'Für Unternehmen',
  robots: { index: false, follow: true },
  alternates: { canonical: 'https://www.deintarifheld.de/unternehmen-neu/' },
}

export default function UnternehmenRedirectPage() {
  return (
    <main style={{ fontFamily: 'Arial, sans-serif', padding: '48px 20px', maxWidth: 640 }}>
      <meta httpEquiv="refresh" content="0; url=/unternehmen-neu/" />
      <h1 style={{ fontSize: 28, marginTop: 0 }}>Für Unternehmen</h1>
      <p>
        Diese Seite ist umgezogen.{' '}
        <a href="/unternehmen-neu/">Weiter zur Unternehmensseite</a>
      </p>
    </main>
  )
}
