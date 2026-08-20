/**
 * A14 dependency matrix — honest statuses. No autonomy actions performed here.
 */
import { A14HandoffCategory } from '@deintarifheld/shared';

const E2 = A14HandoffCategory.E2_LOCAL;
const OWNER = A14HandoffCategory.OWNER_DECISION_REQUIRED;
const PROVIDER = A14HandoffCategory.PROVIDER_REQUIRED;
const SECURITY = A14HandoffCategory.SECURITY_GATE_REQUIRED;
const STAGING = A14HandoffCategory.STAGING_REQUIRED;
const PROD_RB = A14HandoffCategory.PRODUCTION_READBACK_REQUIRED;

export function buildA14AcquisitionHandoff() {
  const matrix = [
    { id: 'A4_MAIL', status: PROVIDER, note: 'Live mail provider not proven' },
    { id: 'A5_CALENDAR', status: OWNER, note: 'OWNER_CALENDAR_PROVIDER_DECISION_REQUIRED' },
    { id: 'A6_DOCUMENT_STORAGE_OCR', status: OWNER, note: 'Storage/OCR owner decision open' },
    { id: 'A7_TARIFF_SOURCE', status: OWNER, note: 'Live tariff source required for production' },
    { id: 'A8_COMMERCIAL_POLICY', status: OWNER, note: 'Offer legal/approval policy owner decision' },
    { id: 'A9_SWITCH_PROVIDER', status: PROVIDER, note: 'Live switch provider not proven' },
    { id: 'A10_LIFECYCLE', status: OWNER, note: 'Renewal/lifecycle provider policies open' },
    { id: 'A11_AUTH_M11', status: SECURITY, note: 'Real AuthN/AuthZ + M11 gates required' },
    { id: 'A12_CONTENT_AI_PUBLISHER', status: PROVIDER, note: 'Live AI/publisher staging pending' },
    { id: 'A13_ACQUISITION_PROVIDER', status: PROVIDER, note: 'Live ad provider/account not configured' },
    { id: 'A13_BUDGET_POLICY', status: OWNER, note: 'OWNER_ACQUISITION_BUDGET_POLICY_REQUIRED' },
    { id: 'A13_TRACKING_CONSENT', status: OWNER, note: 'OWNER_ACQUISITION_TRACKING_POLICY_REQUIRED' },
    { id: 'A13_ATTRIBUTION_POLICY', status: OWNER, note: 'OWNER_ACQUISITION_ATTRIBUTION_POLICY_REQUIRED' },
    { id: 'STAGING_ROLLOUT', status: STAGING, note: 'Staging autonomy not ready' },
    { id: 'PRODUCTION_READBACK', status: PROD_RB, note: 'Production readback not proven' },
    { id: 'E2_LOCAL_ACQUISITION_LOOP', status: E2, note: 'Synthetic organic+paid path proven locally' },
  ];

  return {
    ok: true,
    autonomyActionsPerformed: 0,
    liveAdSpendEur: 0,
    liveAdProviderCalls: 0,
    matrix,
    categories: Object.values(A14HandoffCategory),
    nextTranche: 'DTH-A14_AUTONOMY_ROLLOUT',
  };
}
