/** Shared hash scroll helper for business preview CTAs (functional only). */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function scrollToAnchor(id) {
  if (typeof document === 'undefined' || !id) return
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  if (typeof history !== 'undefined' && history.replaceState) {
    history.replaceState(null, '', `#${id}`)
  }
}
