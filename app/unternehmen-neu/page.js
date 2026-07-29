'use client'

import { GlowLine } from '@/components/ui/Background'
import { Footer } from '@/components/sections/Footer'
import { BusinessHero } from '@/components/business/BusinessHero'
import { BusinessAudience } from '@/components/business/BusinessAudience'
import { BusinessServices } from '@/components/business/BusinessServices'
import { BusinessProcess } from '@/components/business/BusinessProcess'
import { BusinessRoleNotice } from '@/components/business/BusinessRoleNotice'
import { BusinessForm } from '@/components/business/BusinessForm'
import { BusinessFAQ } from '@/components/business/BusinessFAQ'
import { BusinessFinalCTA } from '@/components/business/BusinessFinalCTA'

/**
 * DTH-04 Foundation Preview Route
 * Isoliert unter /unternehmen-neu — bestehende /unternehmen bleibt unverändert.
 */
export default function UnternehmenNeuPage() {
  return (
    <>
      <BusinessHero />
      <GlowLine color="energy" />
      <BusinessAudience />
      <GlowLine color="energy" />
      <BusinessServices />
      <GlowLine color="white" />
      <BusinessProcess />
      <GlowLine color="energy" />
      <BusinessRoleNotice />
      <GlowLine color="white" />
      <BusinessForm />
      <GlowLine color="energy" />
      <BusinessFAQ />
      <GlowLine color="white" />
      <BusinessFinalCTA />
      <Footer />
    </>
  )
}
