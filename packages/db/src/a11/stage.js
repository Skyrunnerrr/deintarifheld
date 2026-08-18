/**
 * StageProjectionPolicyV1 — deterministic, no AI.
 * Priority: critical exception > takeover > waiting provider > approval >
 * renewal > active > switch > offer > tariff > documents > appointment >
 * waiting customer > qualifying > open.
 */
import { CaseStage, WaitingOn, ExceptionSeverity } from '@deintarifheld/shared';

export const StageProjectionPolicyV1 = Object.freeze({
  id: 'A11_STAGE_PROJECTION_POLICY_V1',
  version: 1,
});

export function severityRank(severity) {
  return {
    [ExceptionSeverity.CRITICAL]: 4,
    [ExceptionSeverity.HIGH]: 3,
    [ExceptionSeverity.ACTION_REQUIRED]: 2,
    [ExceptionSeverity.INFO]: 1,
  }[severity] || 0;
}

export function deriveCaseStage(signals = {}) {
  if (signals.criticalException) return CaseStage.EXCEPTION;
  if (signals.takeoverActive) return CaseStage.EXCEPTION;
  if (signals.providerUnknown) return CaseStage.EXCEPTION;
  if (signals.deadLetter) return CaseStage.EXCEPTION;
  if (signals.renewalDue) return CaseStage.RENEWAL_DUE;
  if (signals.lifecycleActive) return CaseStage.ACTIVE;
  if (signals.switchPending) return CaseStage.SWITCH_PENDING;
  if (signals.approvalRequired || signals.offerPending) return CaseStage.OFFER_PENDING;
  if (signals.tariffPending) return CaseStage.TARIFF_EVALUATION;
  if (signals.documentReview) return CaseStage.DOCUMENT_REVIEW;
  if (signals.appointmentPending) return CaseStage.APPOINTMENT;
  if (signals.waitingCustomer) return CaseStage.WAITING_CUSTOMER;
  if (signals.qualifying) return CaseStage.QUALIFYING;
  return CaseStage.OPEN;
}

export function deriveWaitingOn(signals = {}) {
  if (signals.approvalRequired) return WaitingOn.HUMAN_APPROVAL;
  if (signals.takeoverActive) return WaitingOn.HUMAN_APPROVAL;
  if (signals.providerUnknown || signals.waitingProvider) return WaitingOn.PROVIDER;
  if (signals.waitingCustomer) return WaitingOn.CUSTOMER;
  if (signals.scheduled) return WaitingOn.SCHEDULED_TIME;
  if (signals.automationProgressing) return WaitingOn.AUTOMATION;
  return WaitingOn.NONE;
}

export function inboxSeverity({ providerUnknown, deadLetter, takeover, approval, customer, config } = {}) {
  if (providerUnknown || deadLetter) return ExceptionSeverity.CRITICAL;
  if (takeover || approval) return ExceptionSeverity.HIGH;
  if (customer || config) return ExceptionSeverity.ACTION_REQUIRED;
  return ExceptionSeverity.INFO;
}
