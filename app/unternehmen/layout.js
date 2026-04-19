// Restored after APFS sparse-file corruption
export const metadata = {
  title: 'Energieberatung für Unternehmen – B2B Strom & Gas optimieren',
  description: 'Tarifheld optimiert Strom- und Gastarife für Unternehmen, Gastronomie und Gewerbe. Kostenlose B2B-Analyse, mehrere Standorte möglich, schnelle Abwicklung. Jetzt kostenlos anfragen.',
  keywords: 'B2B Energieberatung, Gewerbe Strom sparen, Unternehmen Gas optimieren, Mehrstandort Energieoptimierung, Gastronomie Stromtarif, Gewerbetarif Strom Vergleich',
  alternates: { canonical: 'https://www.deintarifheld.de/unternehmen/' },
  openGraph: {
    title:       'B2B Energieberatung für Unternehmen – Tarifheld',
    description: 'Kostenlose Strom- & Gasoptimierung für Gewerbe und Unternehmen. Keine Kosten, keine Verpflichtungen.',
    url:         'https://www.deintarifheld.de/unternehmen/',
    images:      [{ url: '/images/tari-nobg.png', width: 1200, height: 630, alt: 'Tarifheld – B2B Energieberatung' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'B2B Energieberatung – Tarifheld',
    description: 'Strom- & Gasoptimierung für Unternehmen. Kostenlos, unverbindlich.',
    images:      ['/images/tari-nobg.png'],
  },
}

export default function UnternehmenLayout({ children }) {
  return children
}
