import { CareerSection } from '@/components/sections/CareerSection'
import { Footer } from '@/components/sections/Footer'

export const metadata = {
  title: 'Selbstständiger Energieberater / Vertriebspartner – Partneranfrage',
  description:
    'Interesse an einer selbstständigen Tätigkeit als Energieberater oder Vertriebspartner? Unverbindliche Partneranfrage bei DeinTarifheld. Kein Arbeitsverhältnis, flexible Zusammenarbeit, Schulungen und Provision.',
  keywords:
    'selbstständiger Energieberater, Vertriebspartner Energie, Partneranfrage, Handelsvertreter Energie, Quereinsteiger Vertrieb, selbstständige Tätigkeit Energiemarkt',
  alternates: { canonical: 'https://www.deintarifheld.de/karriere/' },
  openGraph: {
    title: 'Partner werden – selbstständiger Energieberater',
    description:
      'Unverbindliche Partneranfrage für eine selbstständige Tätigkeit als Energieberater oder Vertriebspartner. Kein Arbeitsverhältnis.',
    url: 'https://www.deintarifheld.de/karriere/',
    images: [{ url: '/images/og-default.png', width: 1200, height: 630, alt: 'Partner werden bei DeinTarifheld' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Partner werden – DeinTarifheld',
    description: 'Selbstständige Tätigkeit als Energieberater oder Vertriebspartner. Unverbindliche Partneranfrage.',
    images: ['/images/og-default.png'],
  },
}

const PARTNER_OPPORTUNITY_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Partneranfrage – selbstständige Tätigkeit als Energieberater oder Vertriebspartner',
  description:
    'Unverbindliche Interessen- und Partneranfrage für eine selbstständige Zusammenarbeit als Energieberater oder Vertriebspartner. Es wird kein Arbeitsverhältnis angeboten.',
  url: 'https://www.deintarifheld.de/karriere/',
  isPartOf: {
    '@type': 'WebSite',
    name: 'Dein Tarifheld',
    url: 'https://www.deintarifheld.de',
  },
}

const BREADCRUMB_LD = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Startseite', item: 'https://www.deintarifheld.de/' },
    { '@type': 'ListItem', position: 2, name: 'Partner werden', item: 'https://www.deintarifheld.de/karriere/' },
  ],
}

export default function KarrierePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(PARTNER_OPPORTUNITY_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <CareerSection />
      <Footer />
    </>
  )
}
