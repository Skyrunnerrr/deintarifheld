/**
 * acceptLeadWithAcquisition: acceptBusinessLeadAtomic FIRST, then soft attribute.
 * Forged ref → lead OK, no credit. Client cannot set attribution/budget/account.
 * Never creates Cases directly.
 */
import { LeadType } from '@deintarifheld/shared';
import { acceptBusinessLeadAtomic } from '../a2/atomic-intake.js';
import { recordTouchpoint } from './tracking.js';
import { attributeLeadPrimary } from './attribution.js';
import { TouchpointType } from '@deintarifheld/shared';

export async function acceptLeadWithAcquisition(pool, {
  email,
  firma = null,
  payload = {},
  consentAt = null,
  sourcePage = null,
  idempotencyKey,
  correlationId = null,
  pageSource = 'unternehmen',
  // tracking — server resolves; client campaign/attribution fields ignored
  acqRef = null,
  clientCampaignId = null,
  clientAttribution = null,
  clientBudget = null,
  clientProvider = null,
  clientAccount = null,
  failureInjector = null,
} = {}) {
  // Strip client authority attempts — ignored, never adopted as attribution/budget/provider.
  void clientCampaignId;
  void clientAttribution;
  void clientBudget;
  void clientProvider;
  void clientAccount;

  const accepted = await acceptBusinessLeadAtomic(pool, {
    pageSource,
    email,
    firma,
    payload,
    consentAt,
    sourcePage,
    idempotencyKey,
    correlationId,
    leadType: LeadType.BUSINESS_ENERGY,
    failureInjector: failureInjector?.lead || null,
  });

  if (!accepted.ok) {
    return { ...accepted, attribution: null, caseCreatedByAcquisition: false };
  }

  // Direct Case creation by A13 is forbidden — only A2 handoff creates cases.
  const caseCreatedByAcquisition = false;

  let touchpoint = null;
  let attribution = null;
  try {
    if (acqRef) {
      touchpoint = await recordTouchpoint(pool, {
        acqRef,
        touchpointType: TouchpointType.FORM_SUBMITTED,
        leadId: accepted.leadId,
        meta: { intake: 'public_b2b' },
      });
    }
    await recordTouchpoint(pool, {
      acqRef: acqRef || null,
      touchpointType: TouchpointType.LEAD_ACCEPTED,
      leadId: accepted.leadId,
      meta: { lead_ref: accepted.leadRef },
    });

    attribution = await attributeLeadPrimary(pool, {
      leadId: accepted.leadId,
      acqRef: acqRef || null,
      failureInjector: failureInjector?.attribution || null,
    });
  } catch (err) {
    // Attribution/touchpoint failure must NOT lose the valid lead.
    attribution = {
      ok: true,
      softFail: true,
      leadPreserved: true,
      code: 'ATTRIBUTION_SOFT_FAIL',
      error: String(err?.message || err).slice(0, 200),
    };
  }

  return {
    ...accepted,
    touchpoint,
    attribution,
    caseCreatedByAcquisition,
    acquisitionDirectCaseCreations: 0,
  };
}
