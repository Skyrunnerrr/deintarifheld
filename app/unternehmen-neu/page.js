'use client'

import { BusinessThemeShell } from '@/components/business/BusinessThemeShell'
import { BusinessHeader } from '@/components/business/BusinessHeader'
import { BusinessHero } from '@/components/business/BusinessHero'
import { BusinessCase } from '@/components/business/BusinessCase'
import { BusinessAudience } from '@/components/business/BusinessAudience'
import { BusinessServices } from '@/components/business/BusinessServices'
import { BusinessProcess } from '@/components/business/BusinessProcess'
import { BusinessRoleNotice } from '@/components/business/BusinessRoleNotice'
import { BusinessForm } from '@/components/business/BusinessForm'
import { BusinessFAQ } from '@/components/business/BusinessFAQ'
import { BusinessFinalCTA } from '@/components/business/BusinessFinalCTA'
import { BusinessFooter } from '@/components/business/BusinessFooter'

function BusinessDivider() {
  return <div className="dth-biz-divider" aria-hidden="true" />
}

/**
 * DTH-04 Foundation Preview + DTH-06 Business visual revision.
 * Isoliert unter /unternehmen-neu — vorbereitet für spätere Subdomain, ohne Aktivierung.
 */
export default function UnternehmenNeuPage() {
  return (
    <BusinessThemeShell>
      <BusinessHeader />
      <BusinessHero />
      <BusinessDivider />
      <BusinessCase />
      <BusinessDivider />
      <BusinessAudience />
      <BusinessDivider />
      <BusinessServices />
      <BusinessDivider />
      <BusinessProcess />
      <BusinessDivider />
      <BusinessRoleNotice />
      <BusinessDivider />
      <BusinessForm />
      <BusinessDivider />
      <BusinessFAQ />
      <BusinessDivider />
      <BusinessFinalCTA />
      <BusinessFooter />
    </BusinessThemeShell>
  )
}
