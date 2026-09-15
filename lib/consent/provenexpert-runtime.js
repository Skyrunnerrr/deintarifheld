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
