export const metadata = {
  title: 'Gewerbestrom & Gas prüfen – Energiekosten Unternehmen | DeinTarifheld',
  description:
    'Kleine Preisunterschiede können bei gewerblichen Verbräuchen die jährlichen Energiekosten spürbar beeinflussen. Unverbindliche Prüfung von Strom- und Gasangeboten für Unternehmen und mehrere Standorte — Vermittlung über ausgewählte Energiepartner, ohne Ersparnisgarantie.',
  keywords:
    'Gewerbestrom prüfen, Energiekosten Unternehmen, Stromvertrag Gewerbe, Gasvertrag Unternehmen, Mehrstandort Energie, Unternehmensanfrage Energie, Tarifvermittlung Gewerbe, Gewerbe Strom, Gewerbe Gas',
  alternates: { canonical: 'https://www.deintarifheld.de/unternehmen-neu/' },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'Gewerbestrom & Gas prüfen – Energiekosten Unternehmen | DeinTarifheld',
    description:
      'Warum kleine Preisunterschiede bei hohen Verbräuchen relevant sein können — und wie wir Ihre Versorgungssituation unverbindlich prüfen. Vermittlung über ausgewählte Energiepartner.',
    url: 'https://www.deintarifheld.de/unternehmen-neu/',
    images: [{ url: '/images/tari-nobg.png', width: 1200, height: 630, alt: 'DeinTarifheld Unternehmen' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gewerbestrom & Gas prüfen – Energiekosten Unternehmen',
    description:
      'Unverbindliche Prüfung von Strom- und Gasangeboten für Gewerbe und mehrere Standorte. Keine Ersparnisgarantie — klare Vermittlerrolle.',
    images: ['/images/tari-nobg.png'],
  },
}

export default function UnternehmenNeuLayout({ children }) {
  return children
}
