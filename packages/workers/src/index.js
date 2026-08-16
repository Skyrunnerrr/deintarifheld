/** @deintarifheld/workers — P3-F5 fail-closed local one-shot worker stub */
export const DTH_PACKAGE_SKELETON = Object.freeze({
  name: '@deintarifheld/workers',
  tranche: 'P3-F5',
  skeletonOnly: true,
  productiveLogic: false,
  activationAuthorized: false,
  automationActivationDefault: 'NO',
});

export { createDenyAllEffectAdapter } from './deny-effects.js';
export {
  runSyntheticNoopHandler,
  resetNoopHandlerStats,
  getNoopHandlerStats,
} from './noop-handler.js';
export { runOneShotLocalWorker } from './one-shot-runner.js';

/* DTH-A1 durable workflow runtime */
export {
  runDurableWorkflowWorker,
  drainDueJobs,
  createWorkerInstanceId,
} from './runtime/continuous-runner.js';
export {
  registerCapability,
  getCapabilityHandler,
  listRegisteredCapabilities,
  resolveCapabilityOrFail,
} from './runtime/capability-registry.js';
export {
  registerAllSyntheticHandlers,
  resetSyntheticHandlerState,
} from './runtime/handlers.js';
export { executeLeasedJob, createIdempotentEffectTracker } from './runtime/execute-job.js';
