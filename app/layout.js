import './globals.css'
import { Navbar } from '@/components/ui/Navbar'
import { CookieBanner } from '@/components/ui/CookieBanner'
import { ProSealWidget } from '@/components/ui/ProSealWidget'
import { StickyMobileCta } from '@/components/ui/StickyMobileCta'

export const metadata = {
  title: {
    default:  'Günstiger Strom & Gas – Bis zu 40 % sparen | Tarifheld Vergleich 2026',
    template: '%s | Tarifheld – Günstiger Strom & Gas',
  },
  description: 'Günstiger Strom & Gas gesucht? Tarifheld vergleicht kostenlos über 1.000 Tarife — Ø 480 € Ersparnis. Persönliche Beratung, kein Papierkram. In 2 Minuten zum günstigsten Tarif.',
  keywords: 'günstiger Strom, Strom günstig, Stromanbieter wechseln, Strompreisvergleich, Strom vergleichen, günstiger Gasanbieter, Gas vergleichen, Stromtarif wechseln, billiger Strom, Strom sparen, günstige Stromtarife, Gasanbieter wechseln, Energiekosten senken, kostenloser Tarifvergleich, Energieberater, B2B Energieberatung, Stromvergleich 2026, Gastarif optimieren, Strom Anbieter Vergleich, Energiekosten Unternehmen',
  authors:    [{ name: 'Dein Tarifheld', url: 'https://www.deintarifheld.de' }],
  metadataBase: new URL('https://www.deintarifheld.de'),
  category: 'Energie & Utilities',
  openGraph: {
    title:       'Günstiger Strom & Gas – Tarifheld | Bis zu 40 % sparen',
    description: 'Günstigen Strom & Gas finden: Kostenloser Tarifvergleich, persönliche Beratung, Ø 480 € Ersparnis. In 2 Min. zum besten Tarif.',
    url:         'https://www.deintarifheld.de',
    siteName:    'Dein Tarifheld',
    locale:      'de_DE',
    type:        'website',
    images: [{ url: '/images/og-default.png', width: 1200, height: 630, alt: 'Tarifheld – Strom & Gas optimieren' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Günstiger Strom & Gas – Tarifheld | Bis zu 40 % sparen',
    description: 'Günstigen Strom & Gas finden: Kostenloser Vergleich, Ø 480 € Ersparnis. Jetzt in 2 Min. prüfen.',
    images:      ['/images/og-default.png'],
  },
  robots: {
    index:  true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  alternates: { canonical: 'https://www.deintarifheld.de' },
}

export const viewport = {
  themeColor: '#0A5ADB',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

const JSON_LD_LOCAL_BUSINESS = {
  '@context':  'https://schema.org',
  '@type':     ['LocalBusiness', 'ProfessionalService'],
  name:        'Dein Tarifheld',
  description: 'Günstiger Strom und Gas: Kostenloser Tarifvergleich und Optimierung für Privat- und Gewerbekunden. Persönliche Beratung, Ø 480 € Ersparnis, 100 % unverbindlich.',
  url:         'https://www.deintarifheld.de',
  email:       'kontakt@deintarifheld.de',
  telephone:   '+49 6221 8688877',
  address: {
    '@type':           'PostalAddress',
    streetAddress:     'Lochheimer Str. 37',
    addressLocality:   'Heidelberg',
    addressRegion:     'Baden-Württemberg',
    postalCode:        '69124',
    addressCountry:    'DE',
  },
  geo: {
    '@type':     'GeoCoordinates',
    latitude:    49.3845,
    longitude:   8.6725,
  },
  openingHoursSpecification: [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday'], opens: '09:00', closes: '18:00' },
  ],
  areaServed:  { '@type': 'Country', name: 'Germany' },
  serviceType: ['Energieberatung', 'Tarifoptimierung', 'Stromanbieter Vergleich', 'Gasanbieter Vergleich', 'B2B Energieberatung', 'Strompreisvergleich', 'Günstiger Strom'],
  priceRange:  'Kostenlos',
  knowsAbout:  ['Strom', 'Erdgas', 'Energie', 'Tarifwechsel', 'Kostenoptimierung', 'Energieberatung', 'günstiger Strom', 'Strompreisvergleich', 'Stromanbieter wechseln', 'Gasanbieter wechseln'],
  aggregateRating: {
    '@type':       'AggregateRating',
    ratingValue:   '4.9',
    bestRating:    '5',
    ratingCount:   '127',
    reviewCount:   '127',
  },
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Energieberatung & Tarifvergleich',
    itemListElement: [
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Kostenloser Stromtarif-Vergleich' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Kostenloser Gastarif-Vergleich' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'B2B Energieoptimierung für Unternehmen' } },
    ],
  },
  sameAs: [
    'https://www.provenexpert.com/deintarifheld/',
  ],
}

const JSON_LD_WEBSITE = {
  '@context': 'https://schema.org',
  '@type':    'WebSite',
  name:       'Dein Tarifheld',
  url:        'https://www.deintarifheld.de',
  description: 'Günstiger Strom & Gas: Kostenloser Tarifvergleich für Privat- und Gewerbekunden in Deutschland. Ø 480 € Ersparnis.',
  inLanguage: 'de-DE',
  publisher: {
    '@type': 'Organization',
    name:    'Dein Tarifheld',
    url:     'https://www.deintarifheld.de',
    logo: {
      '@type':  'ImageObject',
      url:      'https://www.deintarifheld.de/images/logo.png',
      width:    200,
      height:   60,
    },
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="de" className="scroll-smooth">
      <head>
        <meta name="facebook-domain-verification" content="swkqibx6lgsb20q0hxa4n9yrh8fflr" />
        <link rel="icon" href="/images/icon-192.png" type="image/png" />
        <link rel="apple-touch-icon" href="/images/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_LOCAL_BUSINESS) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_WEBSITE) }} />
      </head>
      <body className={`font-body bg-bg-base text-text-primary antialiased`}>
        {/* Cookie-Banner — erstes Element nach body (Step 2) */}
        <CookieBanner />

        {/* Skip-Navigation für Screenreader (Accessibility) */}
        <a href="#main-content" className="skip-link">
          Zum Inhalt springen
        </a>
        <Navbar />
        <main id="main-content">
          {children}
        </main>

        {/* ProvenExpert ProSeal Widget – fixed bottom-right (disabled on /unternehmen-neu) */}
        <ProSealWidget />

        {/* Sticky Mobile CTA (Step 11) — nur auf Mobile via CSS; #formular on business preview */}
        <StickyMobileCta />
      </body>
    </html>
  )
}

