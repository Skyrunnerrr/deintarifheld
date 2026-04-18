import Link from 'next/link'

export const metadata = {
  title: 'Seite nicht gefunden – Tarifheld',
  description: 'Diese Seite existiert nicht. Zurück zur Startseite von Tarifheld.',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#090B0F',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{
          fontSize: '6rem',
          fontWeight: 900,
          background: 'linear-gradient(135deg, #D4FF3E, #FF6B2B)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1,
          marginBottom: '1rem',
        }}>
          404
        </div>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#F2F4F8',
          marginBottom: '0.75rem',
        }}>
          Seite nicht gefunden
        </h1>
        <p style={{
          color: '#8E97A8',
          fontSize: '1rem',
          lineHeight: 1.6,
          marginBottom: '2rem',
        }}>
          Die Seite, die du suchst, existiert leider nicht oder wurde verschoben.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            background: '#D4FF3E',
            color: '#090B0F',
            fontWeight: 800,
            fontSize: '0.9375rem',
            padding: '14px 32px',
            borderRadius: 999,
            textDecoration: 'none',
          }}
        >
          Zur Startseite →
        </Link>
      </div>
    </div>
  )
}
