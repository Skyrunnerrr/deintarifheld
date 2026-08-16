/**
 * Bounded server-side capability registry — no dynamic import from job payload.
 */
import { SyntheticCapability, WorkflowErrorClass } from '@deintarifheld/shared';

const HANDLERS = new Map();

export function registerCapability(jobType, handler) {
  if (typeof jobType !== 'string' || !jobType) throw new Error('JOB_TYPE_REQUIRED');
  if (typeof handler !== 'function') throw new Error('HANDLER_REQUIRED');
  HANDLERS.set(jobType, handler);
}

export function getCapabilityHandler(jobType) {
  return HANDLERS.get(jobType) || null;
}

export function listRegisteredCapabilities() {
  return Object.freeze([...HANDLERS.keys()]);
}

export function clearCapabilityRegistryForTests() {
  HANDLERS.clear();
}

/**
 * Resolve handler or permanent unknown-capability failure descriptor.
 * Never evaluates payload as code; never dynamic-imports from DB strings.
 */
export function resolveCapabilityOrFail(jobType) {
  if (jobType && typeof jobType === 'string' && /[\\/;]|(\.\.)/.test(jobType)) {
    return {
      ok: false,
      errorClass: WorkflowErrorClass.UNKNOWN_CAPABILITY,
      errorCode: 'CAPABILITY_PATH_REJECTED',
    };
  }
  const handler = getCapabilityHandler(jobType);
  if (!handler) {
    return {
      ok: false,
      errorClass: WorkflowErrorClass.UNKNOWN_CAPABILITY,
      errorCode: 'UNKNOWN_CAPABILITY',
    };
  }
  return { ok: true, handler };
}

export function installDefaultSyntheticCapabilities(handlers) {
  for (const [type, fn] of Object.entries(handlers)) {
    registerCapability(type, fn);
  }
  // Ensure all frozen synthetic names exist if provided
  for (const type of Object.values(SyntheticCapability)) {
    if (!HANDLERS.has(type) && handlers[type]) {
      registerCapability(type, handlers[type]);
    }
  }
}
