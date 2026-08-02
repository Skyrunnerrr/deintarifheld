/**
 * Local/dev in-memory audit sink for kill-switch state changes.
 * No secrets. No durable production claim.
 */

export function createInMemoryKillAuditLog() {
  const events = [];

  return {
    append(event) {
      const frozen = Object.freeze({ ...event });
      events.push(frozen);
      return frozen;
    },
    list() {
      return [...events];
    },
    clear() {
      events.length = 0;
    },
  };
}
