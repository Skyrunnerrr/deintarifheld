/**
 * Synthetic no-op test handler — domain mutations forbidden.
 */

import { SYNTHETIC_NOOP_EVENT_TYPE, isAuthorizedSyntheticNoopEvent } from '@deintarifheld/shared';

let invocationCount = 0;
const invocationsById = new Map();

export function resetNoopHandlerStats() {
  invocationCount = 0;
  invocationsById.clear();
}

export function getNoopHandlerStats() {
  return {
    totalInvocations: invocationCount,
    byId: Object.fromEntries(invocationsById.entries()),
  };
}

export async function runSyntheticNoopHandler(row, { effectAdapter } = {}) {
  if (!row || !isAuthorizedSyntheticNoopEvent(row.event_type)) {
    return { ok: false, code: 'UNAUTHORIZED_EVENT' };
  }
  if (row.event_type !== SYNTHETIC_NOOP_EVENT_TYPE) {
    return { ok: false, code: 'UNAUTHORIZED_EVENT' };
  }
  // Handler must not invoke effect adapters; presence of non-DENY adapter is rejected.
  if (effectAdapter && effectAdapter.kind && effectAdapter.kind !== 'DENY_ALL') {
    return { ok: false, code: 'EXTERNAL_EFFECT_NOT_DENIED' };
  }
  invocationCount += 1;
  invocationsById.set(row.id, (invocationsById.get(row.id) || 0) + 1);
  return {
    ok: true,
    operation: 'NOOP',
    domainMutations: 0,
    externalEffects: 0,
  };
}
