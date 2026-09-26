import { Footer } from '@/components/sections/Footer'
import { UnifiedInquiryForm } from '@/components/forms/UnifiedInquiryForm'

export const metadata = {
  title: 'Kontakt',
  description: 'Allgemeine Anfrage, Strom und Gas oder Partnerschaft — eine Anfrage an DeinTarifheld.',
  alternates: { canonical: 'https://www.deintarifheld.de/kontakt/' },
}

export default function KontaktPage() {
  return (
    <main className="bg-bg-base min-h-screen">
      <section className="max-w-xl mx-auto px-4 pt-28 pb-16">
        <h1 className="font-display font-black text-3xl text-text-primary mb-3">Kontakt</h1>
        <p className="font-body text-text-secondary mb-8">
          Wähle, worum es geht. Wir melden uns über die Angaben, die du einträgst.
        </p>
        <div className="rounded-3xl bg-bg-surface border border-white/8 p-7 md:p-10">
          <UnifiedInquiryForm idPrefix="kontakt" />
        </div>
      </section>
      <Footer />
    </main>
  )
}
