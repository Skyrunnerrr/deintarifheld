export const metadata = {
  title: 'Strom- und Gasangebote für Unternehmen prüfen – DeinTarifheld',
  description:
    'DeinTarifheld unterstützt Gewerbebetriebe, Filialunternehmen und Unternehmen mit mehreren Standorten bei der Prüfung und Vermittlung geeigneter Strom- und Gasangebote über ausgewählte Energiepartner. Der Liefervertrag kommt mit dem jeweiligen Energieversorger zustande.',
  keywords:
    'Energie Unternehmen, Gewerbe Strom, Gewerbe Gas, Mehrstandort Energie, Unternehmensanfrage Energie, Tarifvermittlung Gewerbe',
  alternates: { canonical: 'https://www.deintarifheld.de/unternehmen-neu/' },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'Strom- und Gasangebote für Unternehmen prüfen – DeinTarifheld',
    description:
      'Wir prüfen Ihre Versorgungssituation und vermitteln geeignete Strom- und Gasangebote über ausgewählte Energiepartner — ohne selbst zu liefern.',
    url: 'https://www.deintarifheld.de/unternehmen-neu/',
    images: [{ url: '/images/tari-nobg.png', width: 1200, height: 630, alt: 'DeinTarifheld Unternehmen' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Strom- und Gasangebote für Unternehmen prüfen – DeinTarifheld',
    description:
      'Prüfung und Vermittlung geeigneter Strom- und Gasangebote für Gewerbe und mehrere Standorte.',
    images: ['/images/tari-nobg.png'],
  },
}

export default function UnternehmenNeuLayout({ children }) {
  return children
}
