/**
 * P4-H0b4 failure diagnostic — hashed fingerprints only.
 * Process-local salt/id; never logs raw sub/sid/token/claims.
 */
import { createHash, randomBytes } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';

const PROCESS_INSTANCE_ID = randomBytes(8).toString('hex');
const DIAGNOSTIC_SALT = randomBytes(32);
let eventSequence = 0;

const EVIDENCE_DIR =
  '/tmp/dth-phase-4-security-hardening-implementation/p4-h0b4-failure-diagnostic';
const EVENTS_PATH = `${EVIDENCE_DIR}/live-events.ndjson`;

function fingerprint(value) {
  if (value == null || value === '') return null;
  return createHash('sha256')
    .update(DIAGNOSTIC_SALT)
    .update('\0')
    .update(String(value))
    .digest('hex')
    .slice(0, 12);
}

export function getValidatorProcessInstanceId() {
  return PROCESS_INSTANCE_ID;
}

export function fingerprintSubject(sub) {
  return fingerprint(sub);
}

export function fingerprintSession(sid) {
  return fingerprint(sid);
}

/**
 * Build and optionally persist a sanitized diagnostic event.
 * @param {object} fields
 */
export function emitSanitizedDiagnosticEvent(fields) {
  eventSequence += 1;
  const event = Object.freeze({
    EVENT_SEQUENCE: eventSequence,
    VALIDATOR_PROCESS_INSTANCE_ID: PROCESS_INSTANCE_ID,
    SUBJECT_FINGERPRINT: fields.subjectFingerprint || null,
    SESSION_FINGERPRINT: fields.sessionFingerprint || null,
    REGISTRY_SIZE_BEFORE: Number(fields.registrySizeBefore || 0),
    PRIOR_ACTIVE_SESSION_PRESENT: Boolean(fields.priorActiveSessionPresent),
    PRIOR_SESSION_FINGERPRINT: fields.priorSessionFingerprint || null,
    NEW_SESSION_DIFFERENT_FROM_PRIOR: Boolean(fields.newSessionDifferentFromPrior),
    PRIOR_SESSION_MARKED_REVOKED: Boolean(fields.priorSessionMarkedRevoked),
    REGISTRY_SIZE_AFTER: Number(fields.registrySizeAfter || 0),
    CURRENT_ACTIVE_SESSION_FINGERPRINT: fields.currentActiveSessionFingerprint || null,
    VALIDATION_DECISION: fields.validationDecision || null,
    DENIAL_REASON: fields.denialReason || null,
    H0B4_CONTROLLER_REACHED: Boolean(fields.h0b4ControllerReached),
    RAW_TOKEN_PRESENT_IN_LOG: 'NO',
    RAW_CLAIMS_PRESENT_IN_LOG: 'NO',
  });

  try {
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    appendFileSync(EVENTS_PATH, `${JSON.stringify(event)}\n`, { mode: 0o600 });
  } catch {
    // Evidence write failure must not alter validation outcome.
  }

  return event;
}
