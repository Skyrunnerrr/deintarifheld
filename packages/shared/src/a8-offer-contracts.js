/**
 * DTH-A8 Offer Engine contracts.
 * Commercial numbers are copied from A7 — A8 is not pricing authority.
 * Kill maps to KillDomain.AUTOMATION_ENGINE (no 9th KillDomain).
 * Mail maps to KillDomain.INTERNAL_MAIL via A4.
 * LIVE_AI_CALLS_A8=0 LIVE_EMAIL_SENDS=0 (A4 mock) LIVE_TARIFF=0 LIVE_SUPPLIER=0.
 */

import { OFFER_PREPARE_HANDOFF } from './a7-tariff-contracts.js';

/** Reuse A7 handoff string — do not duplicate a different value. */
export const OFFER_PREPARE_CAPABILITY = OFFER_PREPARE_HANDOFF;

export const OFFER_APPROVAL_REQUEST_CAPABILITY = 'OFFER_APPROVAL_REQUEST';
export const OFFER_DELIVER_CAPABILITY = 'OFFER_DELIVER';
export const OFFER_FOLLOWUP_DUE_CAPABILITY = 'OFFER_FOLLOWUP_DUE';
export const OFFER_EXPIRE_CAPABILITY = 'OFFER_EXPIRE';
export const OFFER_ACCEPT_CAPABILITY = 'OFFER_ACCEPT';
export const OFFER_REJECT_CAPABILITY = 'OFFER_REJECT';
export const OFFER_RECONCILE_CAPABILITY = 'OFFER_RECONCILE';
export const SWITCH_PREPARATION_CAPABILITY = 'SWITCH_PREPARATION';

export const A8_OFFER_POLICY_ID = 'OfferPolicyV1';
export const A8_OFFER_POLICY_VERSION = 1;
export const A8_APPROVAL_POLICY_ID = 'OfferApprovalPolicyV1';
export const A8_APPROVAL_POLICY_VERSION = 1;
export const A8_TEMPLATE_ID = 'DTH_A8_OFFER_DE_V1';
export const A8_TEMPLATE_VERSION = 1;

export const LIVE_AI_CALLS_A8 = 0;
export const LIVE_EMAIL_SENDS_A8 = 0;
export const LIVE_TARIFF_PROVIDER_CALLS_A8 = 0;
export const LIVE_SUPPLIER_API_CALLS_A8 = 0;
export const SUPPLIER_SWITCH_ACTIONS = 0;

export const OfferEnvironment = Object.freeze({
  E2_LOCAL_SYNTHETIC: 'E2_LOCAL_SYNTHETIC',
});

export const OfferSelectionMode = Object.freeze({
  TEST_AUTO_SELECT_RANK_1: 'TEST_AUTO_SELECT_RANK_1',
});

export const OfferSourceKind = Object.freeze({
  TEST_FIXTURE: 'TEST_FIXTURE',
});

export const OfferEnvironmentMarker = Object.freeze({
  TEST_ONLY: 'TEST_ONLY',
});

export const OfferCustomerLiveMarker = Object.freeze({
  NOT_CUSTOMER_DELIVERABLE_LIVE: 'NOT_CUSTOMER_DELIVERABLE_LIVE',
});

export const SavingsUnknownPresentation = Object.freeze({
  OMIT: 'OMIT',
});

export const NegativeSavingsPresentation = Object.freeze({
  HONEST_ADDITIONAL_COST: 'HONEST_ADDITIONAL_COST',
});

export const FirstYearVsOngoing = Object.freeze({
  SEPARATE_DISPLAY: 'SEPARATE_DISPLAY',
});

export const OfferState = Object.freeze({
  DRAFT: 'DRAFT',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  APPROVED: 'APPROVED',
  READY: 'READY',
  SENT: 'SENT',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  SUPERSEDED: 'SUPERSEDED',
  CANCELLED: 'CANCELLED',
  INVALIDATED: 'INVALIDATED',
});

export const OfferApprovalDecision = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

export const OfferApprovalActorType = Object.freeze({
  SYSTEM_TEST: 'SYSTEM_TEST',
  HUMAN: 'HUMAN',
});

export const OfferCustomerDecision = Object.freeze({
  ACCEPT: 'ACCEPT',
  REJECT: 'REJECT',
});

export const OfferDecisionChannel = Object.freeze({
  OFFER_PAGE_TOKEN: 'OFFER_PAGE_TOKEN',
});

export const SwitchPreparationStatus = Object.freeze({
  READY: 'READY',
});

/** Owner decisions unresolved — keep true. Do not close A6/A7 OWNER_* here. */
export const OWNER_OFFER_SELECTION_POLICY_REQUIRED = true;
export const OWNER_OFFER_APPROVAL_POLICY_REQUIRED = true;
export const OWNER_OFFER_FOLLOWUP_POLICY_REQUIRED = true;
export const OWNER_OFFER_LEGAL_TEXT_REQUIRED = true;
export const OFFER_RETENTION_POLICY_REQUIRED = true;

/** Documented kill mapping — not a 9th domain. */
export const OfferKillDomain = 'AUTOMATION_ENGINE';

export const SYNTHETIC_OFFER_LEGAL_TEXT_DE =
  'Dieses Testangebot ist unverbindlich und kein rechtsgültiger Vertrag. ' +
  'Alle Tarif- und Preisangaben sind SYNTHETISCH (TEST_ONLY) und nicht kundenlivetauglich.';
