/**
 * P3-F1 audit actor contract — actor id must be person id for CC person sessions.
 */
import { randomUUID } from 'node:crypto';
import { PrincipalType } from './principal.js';

export function auditActorFromCcSession(session) {
  if (!session || session.ccSession !== true || !session.personId) {
    throw new Error('CC_PERSON_SESSION_REQUIRED_FOR_AUDIT_ACTOR');
  }
  return Object.freeze({
    ACTOR_TYPE: PrincipalType.PERSON,
    ACTOR_ID: session.personId,
    SESSION_ID: session.sessionId,
    AUTHENTICATION_METHOD: session.authenticationMethod,
    CORRELATION_ID: randomUUID(),
  });
}
