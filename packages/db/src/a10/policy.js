/**
 * TEST_LIFECYCLE_POLICY_V1 — synthetic E2 only. Never production defaults.
 */
import {
  A10_TEST_POLICY_MARKER,
  A10_ACTIVATION_POLICY_ID,
  A10_ACTIVATION_POLICY_VERSION,
  A10_RENEWAL_POLICY_ID,
  A10_RENEWAL_POLICY_VERSION,
  A10_EVIDENCE_POLICY_ID,
} from '@deintarifheld/shared';

export const TestLifecyclePolicyV1 = Object.freeze({
  marker: A10_TEST_POLICY_MARKER,
  activationPolicyId: A10_ACTIVATION_POLICY_ID,
  activationPolicyVersion: A10_ACTIVATION_POLICY_VERSION,
  renewalPolicyId: A10_RENEWAL_POLICY_ID,
  renewalPolicyVersion: A10_RENEWAL_POLICY_VERSION,
  evidencePolicyId: A10_EVIDENCE_POLICY_ID,
  allowSyntheticTerms: false,
  syntheticMinTermDays: 14,
  syntheticNoticeDays: 7,
  renewalLeadDays: 3,
  evidenceMaxAgeDays: null,
  allowLiveProvider: false,
});

export function mergeLifecyclePolicy(over = {}) {
  if (over.allowLiveProvider === true) {
    const err = new Error('LIVE_LIFECYCLE_PROVIDER_FORBIDDEN');
    err.code = 'LIVE_LIFECYCLE_PROVIDER_FORBIDDEN';
    throw err;
  }
  return Object.freeze({
    ...TestLifecyclePolicyV1,
    ...over,
    marker: A10_TEST_POLICY_MARKER,
    allowLiveProvider: false,
  });
}
