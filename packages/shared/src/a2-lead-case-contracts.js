/**
 * DTH-A2 Lead → Case contracts.
 */

export const BUSINESS_LEAD_ACCEPTED_EVENT = 'BUSINESS_LEAD_ACCEPTED';
export const BUSINESS_LEAD_ACCEPTED_SCHEMA_VERSION = 1;

export const B2B_INBOUND_WORKFLOW_TYPE = 'B2B_INBOUND_CUSTOMER';
export const B2B_INBOUND_WORKFLOW_VERSION = 1;

export const B2B_QUALIFICATION_START_CAPABILITY = 'B2B_QUALIFICATION_START';

export const LeadType = Object.freeze({
  BUSINESS_ENERGY: 'business_energy',
  PRIVATE_ENERGY: 'private_energy',
});

export const SOURCE_LEAD_STATUS_AFTER_ACCEPT = 'new';
export const CASE_INITIAL_STATUS = 'open';
export const WORKFLOW_INITIAL_STATE = 'LEAD_ACCEPTED_HANDOFF';
export const FIRST_JOB_TYPE = B2B_QUALIFICATION_START_CAPABILITY;

/** Minimal outbox routing metadata — no full PII dump. */
export function buildBusinessLeadAcceptedPayload({ leadId, leadRef, leadType, schemaVersion }) {
  return {
    schema_version: schemaVersion ?? BUSINESS_LEAD_ACCEPTED_SCHEMA_VERSION,
    lead_ref: leadRef ?? null,
    lead_type: leadType,
    // identifier only — authoritative payload lives on public.leads
    lead_id: String(leadId),
  };
}

export function isBusinessEnergyLeadType(leadType) {
  return leadType === LeadType.BUSINESS_ENERGY;
}
