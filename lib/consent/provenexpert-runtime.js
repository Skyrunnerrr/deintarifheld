/**
 * ProvenExpert widget runtime helpers. No legal-basis claims.
 * Script removal alone is not a withdrawal after the widget has run.
 */

export const PE_SEAL_SELECTOR = '.pe-pro-seal'
export const PE_SCRIPT_ATTR = 'data-dth-provenexpert'
export const PE_WITHDRAWAL_RELOAD_FLAG = 'dth_pe_withdraw_reload'
export const PE_PROVIDER_DOM_SELECTOR = '.pe-pro-seal, [class*="pe-pro-seal"], iframe[src*="provenexpert"]'

export function hasProvenExpertDestroyApi(win) {
  const pe = win?.provenExpert
  if (!pe || typeof pe !== 'object') return false
  if (typeof pe.destroy === 'function') return true
  if (typeof pe.proSeal?.destroy === 'function') return true
  return false
}

export function stripProvenExpertDom(root) {
  if (!root?.querySelectorAll) return { removed: 0 }
  const nodes = [...root.querySelectorAll(PE_PROVIDER_DOM_SELECTOR)]
  for (const el of nodes) el.remove()
  const scripts = [...root.querySelectorAll(`script[${PE_SCRIPT_ATTR}], script[src*="provenexpert"]`)]
  for (const el of scripts) el.remove()
  return { removed: nodes.length + scripts.length }
}

/**
 * @param {{ previousAllowed: boolean, nextAllowed: boolean, destroyApiAvailable: boolean, alreadyReloaded: boolean }} ctx
 */
export function planProvenExpertWithdrawal({
  previousAllowed,
  nextAllowed,
  destroyApiAvailable,
  alreadyReloaded,
} = {}) {
  if (nextAllowed === true) {
    return {
      loadScript: true,
      stripDom: false,
      showLocalBadge: false,
      reload: false,
      allowFurtherRequests: true,
    }
  }

  if (previousAllowed === true && nextAllowed === false) {
    return {
      loadScript: false,
      stripDom: true,
      showLocalBadge: true,
      reload: !destroyApiAvailable && !alreadyReloaded,
      allowFurtherRequests: false,
    }
  }

  return {
    loadScript: false,
    stripDom: false,
    showLocalBadge: true,
    reload: false,
    allowFurtherRequests: false,
  }
}

export function readWithdrawalReloadFlag(storage) {
  try {
    return storage?.getItem?.(PE_WITHDRAWAL_RELOAD_FLAG) === '1'
  } catch {
    return false
  }
}

export function writeWithdrawalReloadFlag(storage, value) {
  try {
    if (value) storage?.setItem?.(PE_WITHDRAWAL_RELOAD_FLAG, '1')
    else storage?.removeItem?.(PE_WITHDRAWAL_RELOAD_FLAG)
  } catch {
    /* ignore */
  }
}

/**
 * Deterministic consent cycle for tests. Models script / seal / local badge
 * without loading the real ProvenExpert network script.
 */
export function applyProvenExpertConsentStep(state, nextAllowed, { destroyApiAvailable = false } = {}) {
  const plan = planProvenExpertWithdrawal({
    previousAllowed: state.consent === true,
    nextAllowed,
    destroyApiAvailable,
    alreadyReloaded: state.alreadyReloaded === true,
  })
  const next = {
    consent: nextAllowed === true,
    scriptPresent: plan.loadScript === true,
    sealPresent: plan.loadScript === true,
    localFallback: plan.showLocalBadge === true,
    reload: plan.reload === true,
    alreadyReloaded: plan.reload ? true : state.alreadyReloaded === true,
  }
  if (plan.stripDom) {
    next.scriptPresent = false
    next.sealPresent = false
  }
  return next
}

/** false → true → false. After withdrawal: no script, no seal, local badge, consent false. */
export function simulateProvenExpertFalseTrueFalse(opts) {
  let state = {
    consent: false,
    scriptPresent: false,
    sealPresent: false,
    localFallback: true,
    reload: false,
    alreadyReloaded: false,
  }
  const off = applyProvenExpertConsentStep(state, false, opts)
  const on = applyProvenExpertConsentStep(off, true, opts)
  const withdrawn = applyProvenExpertConsentStep(on, false, opts)
  return { off, on, withdrawn }
}
