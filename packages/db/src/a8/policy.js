/**
 * DTH-A8 OfferPolicyV1 — E2 local synthetic defaults only.
 * Not a production commercial approval. Owner flags remain unresolved.
 */
import {
  A8_OFFER_POLICY_ID,
  A8_OFFER_POLICY_VERSION,
  A8_APPROVAL_POLICY_ID,
  A8_APPROVAL_POLICY_VERSION,
  A8_TEMPLATE_ID,
  A8_TEMPLATE_VERSION,
  OfferEnvironment,
  OfferSelectionMode,
  OfferCustomerLiveMarker,
  SavingsUnknownPresentation,
  NegativeSavingsPresentation,
  FirstYearVsOngoing,
  SYNTHETIC_OFFER_LEGAL_TEXT_DE,
} from '@deintarifheld/shared';

export const OfferPolicyV1 = Object.freeze({
  id: A8_OFFER_POLICY_ID,
  version: A8_OFFER_POLICY_VERSION,
  approvalPolicyId: A8_APPROVAL_POLICY_ID,
  approvalPolicyVersion: A8_APPROVAL_POLICY_VERSION,
  environment: OfferEnvironment.E2_LOCAL_SYNTHETIC,
  offerableReadiness: 'READY_FOR_OFFER',
  maxOptions: 1,
  selectionMode: OfferSelectionMode.TEST_AUTO_SELECT_RANK_1,
  validityMs: 10 * 60 * 1000,
  autoApproveSynthetic: true,
  allowLiveCustomerDelivery: false,
  allowSyntheticLiveSend: false,
  maxFollowups: 1,
  followupDelayMs: 50,
  templateId: A8_TEMPLATE_ID,
  templateVersion: A8_TEMPLATE_VERSION,
  legalText: SYNTHETIC_OFFER_LEGAL_TEXT_DE,
  savingsUnknownPresentation: SavingsUnknownPresentation.OMIT,
  negativeSavingsPresentation: NegativeSavingsPresentation.HONEST_ADDITIONAL_COST,
  firstYearVsOngoing: FirstYearVsOngoing.SEPARATE_DISPLAY,
  customerLiveMarker: OfferCustomerLiveMarker.NOT_CUSTOMER_DELIVERABLE_LIVE,
});

/**
 * Merge explicit test overrides. Live-customer delivery cannot be enabled in E2.
 * Callers that pass allowLiveCustomerDelivery/allowSyntheticLiveSend true get a
 * fail-closed code rather than a silently enabled live path.
 */
export function mergeOfferPolicy(over = {}) {
  if (over && (over.allowLiveCustomerDelivery === true || over.allowSyntheticLiveSend === true)) {
    const err = new Error('SYNTHETIC_LIVE_DELIVERY_FORBIDDEN');
    err.code = 'SYNTHETIC_LIVE_DELIVERY_FORBIDDEN';
    throw err;
  }
  return Object.freeze({
    ...OfferPolicyV1,
    ...(over || {}),
    allowLiveCustomerDelivery: false,
    allowSyntheticLiveSend: false,
    customerLiveMarker: OfferCustomerLiveMarker.NOT_CUSTOMER_DELIVERABLE_LIVE,
    environment: OfferEnvironment.E2_LOCAL_SYNTHETIC,
  });
}

export function tryMergeOfferPolicy(over = {}) {
  try {
    return { ok: true, policy: mergeOfferPolicy(over) };
  } catch (err) {
    return { ok: false, code: err.code || 'SYNTHETIC_LIVE_DELIVERY_FORBIDDEN' };
  }
}
