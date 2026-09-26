/** Public GET bodies. Must not include mail mode, secrets, or infra details. */
export function publicLeadsHealth() {
  return {
    ok: true,
    service: 'dth-leads',
    phase: 'B',
    supported: ['inquiry', 'unternehmen', 'privat', 'hero-funnel', 'main_funnel'],
    careerEndpoint: '/api/careers',
  }
}

export function publicCareersHealth() {
  return {
    ok: true,
    service: 'dth-careers',
    phase: 'B',
    supported: ['career'],
    fileUploads: false,
  }
}
