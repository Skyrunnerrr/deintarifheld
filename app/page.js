import { Hero }              from '@/components/sections/Hero'
import { TrustBar }          from '@/components/sections/TrustBar'
import { HowItWorks }        from '@/components/sections/HowItWorks'
import { SavingsCalculator } from '@/components/sections/SavingsCalculator'
import { FAQ_ITEMS }         from '@/lib/constants'

export const metadata = {
  title:       'Strom & Gas vergleichen | DeinTarifheld',
  description: 'Strom- und Gastarife kostenlos und unverbindlich prüfen lassen. Persönliche Unterstützung beim Tarifvergleich und auf Wunsch beim Wechsel.',
  alternates:  { canonical: 'https://www.deintarifheld.de/' },
  openGraph: {
    title:       'Strom & Gas vergleichen | DeinTarifheld',
    description: 'Strom- und Gastarife kostenlos prüfen lassen. Persönliche Beratung und Unterstützung beim Anbieterwechsel.',
    url:         'https://www.deintarifheld.de/',
    images:      [{ url: '/images/og-default.png', width: 1200, height: 630, alt: 'Tarifheld – Günstiger Strom & Gas Vergleich' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Strom & Gas vergleichen | DeinTarifheld',
    description: 'Strom- und Gastarife kostenlos und unverbindlich prüfen lassen.',
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
    description:  'Kostenlose und unverbindliche Unterstützung beim Vergleich von Strom- und Gastarifen für Privat- und Gewerbekunden.',
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
      <CareerSection variant="volt" headingLevel="h2" />

      {/* 11. FAQ */}
      <GlowLine color="white" />
      <FAQ />

      {/* 12. Footer */}
      <Footer />
    </>
  )
}
