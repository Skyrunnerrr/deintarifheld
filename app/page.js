import { Hero }              from '@/components/sections/Hero'
import { TrustBar }          from '@/components/sections/TrustBar'
import { TrustLogos }        from '@/components/sections/TrustLogos'
import { HowItWorks }        from '@/components/sections/HowItWorks'
import { SavingsCalculator } from '@/components/sections/SavingsCalculator'
import { FAQ_ITEMS }         from '@/lib/constants'

export const metadata = {
  title:       'Günstiger Strom & Gas 2026 – Bis 40 % sparen | Tarifheld Vergleich',
  description: 'Günstiger Strom gesucht? Tarifheld findet den besten Tarif — kostenlos, persönlich, Ø 480 € Ersparnis. Stromanbieter wechseln in 2 Minuten. Jetzt Tarif prüfen!',
  alternates:  { canonical: 'https://www.deintarifheld.de/' },
  openGraph: {
    title:       'Günstiger Strom & Gas – Tarifheld | Bis zu 40 % sparen',
    description: 'Günstigen Strom finden: Kostenloser Vergleich, Ø 480 € Ersparnis. Stromanbieter wechseln ohne Papierkram.',
    url:         'https://www.deintarifheld.de/',
    images:      [{ url: '/images/og-default.png', width: 1200, height: 630, alt: 'Tarifheld – Günstiger Strom & Gas Vergleich' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Günstiger Strom & Gas – Tarifheld | Bis zu 40 % sparen',
    description: 'Günstigen Strom finden: Ø 480 € sparen. Jetzt kostenlos Tarif prüfen!',
    images:      ['/images/og-default.png'],
  },
}
import { B2BSection }        from '@/components/sections/B2BSection'
import { CareerSection }     from '@/components/sections/CareerSection'
import { FAQ }               from '@/components/sections/FAQ'
import { FunnelSection }     from '@/components/sections/FunnelSection'
import { Footer }            from '@/components/sections/Footer'
import { GlowLine }          from '@/components/ui/Background'

export default function Home() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }

  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type':    'Service',
    name:       'Kostenloser Strompreisvergleich & Gastarif-Vergleich',
    provider: { '@type': 'LocalBusiness', name: 'Dein Tarifheld', url: 'https://www.deintarifheld.de' },
    serviceType:  'Energieberatung und Tarifvergleich',
    description:  'Günstiger Strom & Gas: Kostenloser Vergleich von über 1.000 Strom- und Gastarifen für Privat- und Gewerbekunden. Persönliche Beratung, Ø 480 € Ersparnis.',
    areaServed:   { '@type': 'Country', name: 'Germany' },
    offers: {
      '@type':        'Offer',
      price:          '0',
      priceCurrency:  'EUR',
      description:    'Kostenloser Tarifvergleich und persönliche Beratung',
      availability:   'https://schema.org/InStock',
    },
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Startseite', item: 'https://www.deintarifheld.de/' },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      {/* 1. Hero */}
      <Hero />

      {/* 2. Trust Bar */}
      <TrustBar />

      {/* 4. How It Works */}
      <GlowLine color="white" />
      <HowItWorks />

      {/* 4. Savings Calculator */}
      <GlowLine color="volt" />
      <SavingsCalculator />

      {/* 7. 2-Step Funnel */}
      <GlowLine color="volt" />
      <FunnelSection />

      {/* 8. B2B Section */}
      <GlowLine color="volt" />
      <B2BSection />

      {/* 10. Career Section */}
      <GlowLine color="volt" />
      <CareerSection variant="volt" />

      {/* 11. FAQ */}
      <GlowLine color="white" />
      <FAQ />

      {/* 12. Footer */}
      <Footer />
    </>
  )
}
