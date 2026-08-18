/**
 * SwitchingPolicyV1 — E2 synthetic defaults. Not production submission autonomy.
 */
import {
  A9_SWITCHING_POLICY_ID,
  A9_SWITCHING_POLICY_VERSION,
  A9_SUBMISSION_POLICY_ID,
  A9_SUBMISSION_POLICY_VERSION,
  A9_TEST_PROVIDER_CODE,
  SwitchType,
  SwitchFieldCode,
} from '@deintarifheld/shared';

export const SwitchingPolicyV1 = Object.freeze({
  id: A9_SWITCHING_POLICY_ID,
  version: A9_SWITCHING_POLICY_VERSION,
  submissionPolicyId: A9_SUBMISSION_POLICY_ID,
  submissionPolicyVersion: A9_SUBMISSION_POLICY_VERSION,
  switchType: SwitchType.SUPPLIER_CHANGE,
  providerCode: A9_TEST_PROVIDER_CODE,
  autoApproveSynthetic: true,
  allowLiveProvider: false,
  requiredFields: Object.freeze([
    SwitchFieldCode.COMPANY_NAME,
    SwitchFieldCode.CONTACT_EMAIL,
    SwitchFieldCode.ENERGY_TYPE,
    SwitchFieldCode.TARIFF_VERSION_ID,
    SwitchFieldCode.MALO_ID,
  ]),
  commercialFields: Object.freeze([
    SwitchFieldCode.CONSUMPTION_KWH,
    SwitchFieldCode.ENERGY_TYPE,
    SwitchFieldCode.TARIFF_VERSION_ID,
  ]),
  multiSupply: 'PRESERVE_SCOPE',
  termination: 'PROVIDER_HANDLES',
});

export function mergeSwitchingPolicy(over = {}) {
  if (over.allowLiveProvider === true) {
    const err = new Error('LIVE_SWITCH_PROVIDER_FORBIDDEN');
    err.code = 'LIVE_SWITCH_PROVIDER_FORBIDDEN';
    throw err;
  }
  return Object.freeze({
    ...SwitchingPolicyV1,
    ...over,
    allowLiveProvider: false,
    providerCode: over.providerCode || A9_TEST_PROVIDER_CODE,
  });
}
