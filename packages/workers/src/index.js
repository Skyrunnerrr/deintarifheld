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
