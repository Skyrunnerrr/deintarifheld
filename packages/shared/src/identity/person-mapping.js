/**
 * External identity → DTH person mapping interface + in-memory adapter.
 * No SQL, no persistence, no email auto-map, no auto-create.
 */
import { IdentityProvider, LinkStatus } from './h0a-constants.js';
import { TokenErrorCode, fail } from './token-errors.js';

function mappingKey(provider, issuer, subject) {
  return `${provider}\0${issuer}\0${subject}`;
}

/**
 * Deterministic in-memory adapter for tests / local foundation only.
 */
export function createInMemoryPersonMappingAdapter(initialRows = []) {
  /** @type {Map<string, { dthPersonId: string, linkStatus: string, provider: string, issuer: string, subject: string }[]>} */
  const store = new Map();

  function put(row) {
    const key = mappingKey(row.provider, row.issuer, row.subject);
    const list = store.get(key) || [];
    list.push({ ...row });
    store.set(key, list);
  }

  for (const row of initialRows) {
    put(row);
  }

  return {
    kind: 'IN_MEMORY_PERSON_MAPPING',
    persistent: false,
    resolve({ provider, issuer, subject }) {
      if (provider !== IdentityProvider.CLERK) {
        return fail(TokenErrorCode.IDENTITY_PROVIDER_MISMATCH);
      }
      if (!issuer || !subject) {
        return fail(TokenErrorCode.IDENTITY_MAPPING_NOT_FOUND);
      }
      const list = store.get(mappingKey(provider, issuer, subject)) || [];
      if (list.length === 0) {
        return fail(TokenErrorCode.IDENTITY_MAPPING_NOT_FOUND);
      }
      const active = list.filter((r) => r.linkStatus === LinkStatus.ACTIVE);
      if (active.length > 1) {
        return fail(TokenErrorCode.IDENTITY_MAPPING_AMBIGUOUS);
      }
      if (active.length === 1) {
        const personIds = new Set(active.map((r) => r.dthPersonId));
        if (personIds.size !== 1) {
          return fail(TokenErrorCode.IDENTITY_MAPPING_AMBIGUOUS);
        }
        return {
          ok: true,
          dthPersonId: active[0].dthPersonId,
          linkStatus: LinkStatus.ACTIVE,
        };
      }
      // Only disabled (or non-active) rows
      if (list.every((r) => r.linkStatus === LinkStatus.DISABLED)) {
        return fail(TokenErrorCode.IDENTITY_MAPPING_DISABLED);
      }
      return fail(TokenErrorCode.IDENTITY_MAPPING_NOT_FOUND);
    },
    /** Test helper — not an auto-create-from-token path. */
    seed(row) {
      put(row);
    },
  };
}

/** Explicitly reject email-based mapping attempts. */
export function rejectEmailBasedAutoMapping() {
  return fail(TokenErrorCode.IDENTITY_MAPPING_NOT_FOUND, 'EMAIL_BASED_AUTO_MAPPING_FORBIDDEN');
}

/** Explicitly reject automatic person creation from a valid token. */
export function rejectAutomaticPersonCreation() {
  return fail(TokenErrorCode.IDENTITY_MAPPING_NOT_FOUND, 'AUTOMATIC_PERSON_CREATION_FORBIDDEN');
}
