import { CareerSection } from '@/components/sections/CareerSection'
import { Footer } from '@/components/sections/Footer'

export const metadata = {
  title: 'Karriere als Energieberater (m/w/d) – Jetzt bewerben | Tarifheld',
  description: 'Starte als selbständiger Energieberater bei Tarifheld. Quereinsteiger willkommen, flexible Zeiteinteilung, 1.400– 5.500 €/Monat möglich. Kostenlose Ausbildung, Remote & vor Ort deutschlandweit.',
  keywords: 'Energieberater werden, Karriere Energie, Nebenjob Energieberatung, selbständiger Berater, Quereinsteiger Vertrieb, Energiebranche Jobs, Provision Energ ieberater, Remote Jobs Deutschland',
  alternates: { canonical: 'https://www.deintarifheld.de/karriere/' },
  openGraph: {
    title:       'Karriere als Energieberater – Tarifheld',
    description: 'Quereinsteiger willkommen! 1.400–5.500 €/Monat möglich, flexible Zeiten, kostenlose Vollausbildung.',
    url:         'https://www.deintarifheld.de/karriere/',
    images:      [{ url: '/images/og-default.png', width: 1200, height: 630, alt: 'Karriere als Energieberater bei Tarifheld' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Jetzt Energieberater werden – Tarifheld',
    description: 'Quereinsteiger willkommen. Flexible Zeiten, attraktive Provision.',
    images:      ['/images/og-default.png'],
  },
}

const JOB_POSTING_LD = {
  '@context': 'https://schema.org',
  '@type':    'JobPosting',
  title:      'Energieberater/in (m/w/d) – Haupt- oder Nebenjob',
  description: 'Werde Teil von Tarifheld als selbständige/r Energieberater/in. Kein Vorwissen nötig — wir schulen dich vollumfänglich. Flexible Zeiteinteilung, attraktive Provision von 1.400–5.500 €/Monat möglich. Quereinsteiger ausdrücklich willkommen.',
  identifier: { '@type': 'PropertyValue', name: 'Tarifheld', value: 'energieberater-karriere' },
  datePosted:   '2026-04-01',
  validThrough: '2026-12-31',
  employmentType: ['FULL_TIME', 'PART_TIME', 'CONTRACTOR'],
  hiringOrganization: {
    '@type':  'Organization',
    name:     'Dein Tarifheld',
    sameAs:   'https://www.deintarifheld.de',
    logo:     'https://www.deintarifheld.de/images/logo.png',
  },
  jobLocation: {
    '@type':   'Place',
    address: { '@type': 'PostalAddress', addressCountry: 'DE' },
  },
  jobLocationType: 'TELECOMMUTE',
  applicantLocationRequirements: { '@type': 'Country', name: 'Germany' },
  baseSalary: {
    '@type':    'MonetaryAmount',
    currency:   'EUR',
    value: { '@type': 'QuantitativeValue', minValue: 1400, maxValue: 5500, unitText: 'MONTH' },
  },
  qualifications:         'Keine Vorkenntnisse erforderlich',
  educationRequirements:  'Keine spezifischen Bildungsvoraussetzungen',
  experienceRequirements: 'Quereinsteiger willkommen',
  responsibilities:       'Beratung und Vermittlung von Strom- und Gastarifen für Privat- und Gewerbekunden',
  skills:                 'Kommunikation, Motivation, Kundenorientierung',
  workHours:              'Flexibel, Teil- oder Vollzeit',
}

const BREADCRUMB_LD = {
  '@context': 'https://schema.org',
  '@type':    'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Startseite', item: 'https://www.deintarifheld.de/' },
    { '@type': 'ListItem', position: 2, name: 'Karriere',   item: 'https://www.deintarifheld.de/karriere/' },
  ],
}

export default function KarrierePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JOB_POSTING_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <CareerSection />
      <Footer />
    </>
  )
}
