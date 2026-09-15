/**
 * ProvenExpert widget runtime helpers. No legal-basis claims.
 * Withdrawal always: persist consent, strip script/DOM, one controlled reload.
 */

export const PE_SEAL_SELECTOR = '.pe-pro-seal'
export const PE_SCRIPT_ATTR = 'data-dth-provenexpert'
export const PE_WITHDRAWAL_RELOAD_FLAG = 'dth_pe_withdraw_reload'
export const PE_PROVIDER_DOM_SELECTOR = '.pe-pro-seal, [class*="pe-pro-seal"], iframe[src*="provenexpert"]'

export function stripProvenExpertDom(root) {
  if (!root?.querySelectorAll) return { removed: 0 }
  const nodes = [...root.querySelectorAll(PE_PROVIDER_DOM_SELECTOR)]
  for (const el of nodes) el.remove()
  const scripts = [...root.querySelectorAll(`script[${PE_SCRIPT_ATTR}], script[src*="provenexpert"]`)]
  for (const el of scripts) el.remove()
  return { removed: nodes.length + scripts.length }
}

/**
 * @param {{ previousAllowed: boolean, nextAllowed: boolean, alreadyReloaded: boolean }} ctx
 */
export function planProvenExpertWithdrawal({
  previousAllowed,
  nextAllowed,
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
      reload: alreadyReloaded !== true,
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

export function applyProvenExpertConsentStep(state, nextAllowed) {
  const plan = planProvenExpertWithdrawal({
    previousAllowed: state.consent === true,
    nextAllowed,
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

/** false → true → false. After withdrawal: no script, no seal, local badge, consent false, reload. */
export function simulateProvenExpertFalseTrueFalse() {
  const off = applyProvenExpertConsentStep(
    {
      consent: false,
      scriptPresent: false,
      sealPresent: false,
      localFallback: true,
      reload: false,
      alreadyReloaded: false,
    },
    false,
  )
  const on = applyProvenExpertConsentStep(off, true)
  const withdrawn = applyProvenExpertConsentStep(on, false)
  return { off, on, withdrawn }
}
