/**
 * P3-F5 reserved synthetic local test event — not a domain automation.
 * event_type is free text in transactional_outbox (no enum constraint).
 */

export const SYNTHETIC_NOOP_EVENT_TYPE = 'DTH_LOCAL_TEST_NOOP';

export const SYNTHETIC_NOOP_PAYLOAD = Object.freeze({
  test: true,
  operation: 'NOOP',
});

export function isAuthorizedSyntheticNoopEvent(eventType) {
  return eventType === SYNTHETIC_NOOP_EVENT_TYPE;
}
