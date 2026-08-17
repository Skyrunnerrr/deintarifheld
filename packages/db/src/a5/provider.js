/**
 * Deterministic test calendar provider. No network.
 * LIVE_CALENDAR_PROVIDER_CALLS must remain 0 in E2.
 */
import { randomUUID } from 'node:crypto';
import { A5_PROVIDER_TEST } from '@deintarifheld/shared';

const store = {
  busy: [], // { resourceId, startUtc, endUtc }
  events: new Map(), // providerEventId -> event
  mode: 'ACCEPT', // ACCEPT | CONFLICT | TIMEOUT_UNKNOWN | FAIL | CONFERENCE_DELAYED | EVENT_DELETED
  liveCalls: 0,
};

export function resetCalendarProviderTestStore() {
  store.busy = [];
  store.events.clear();
  store.mode = 'ACCEPT';
  store.liveCalls = 0;
}

export function setCalendarProviderTestMode(mode) {
  store.mode = mode;
}

export function getCalendarLiveCallCount() {
  return store.liveCalls;
}

export function seedBusyPeriod({ resourceId, startUtc, endUtc }) {
  store.busy.push({
    resourceId,
    startUtc: new Date(startUtc).toISOString(),
    endUtc: new Date(endUtc).toISOString(),
  });
}

export function seedProviderEvent(event) {
  store.events.set(event.providerEventId, { ...event });
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

export function createTestCalendarProvider() {
  return {
    name: A5_PROVIDER_TEST,
    async getAvailability({ resourceId, rangeStartUtc, rangeEndUtc }) {
      const busy = store.busy
        .filter((b) => b.resourceId === resourceId)
        .filter((b) => overlaps(b.startUtc, b.endUtc, rangeStartUtc, rangeEndUtc))
        .map((b) => ({ startUtc: b.startUtc, endUtc: b.endUtc }));
      // also treat existing events as busy
      for (const ev of store.events.values()) {
        if (ev.resourceId !== resourceId || ev.deleted) continue;
        if (overlaps(ev.startUtc, ev.endUtc, rangeStartUtc, rangeEndUtc)) {
          busy.push({ startUtc: ev.startUtc, endUtc: ev.endUtc });
        }
      }
      return { ok: true, busyPeriods: busy };
    },

    async createAppointment({
      resourceId,
      startUtc,
      endUtc,
      title,
      idempotencyKey,
      attendeeEmailHash,
    }) {
      if (store.mode === 'TIMEOUT_UNKNOWN') {
        return { ok: false, class: 'OUTCOME_UNKNOWN', code: 'TIMEOUT_UNKNOWN' };
      }
      if (store.mode === 'FAIL') {
        return { ok: false, class: 'PERMANENT_FAILURE', code: 'CREATE_PERMANENT_FAIL' };
      }
      if (store.mode === 'CONFLICT') {
        return { ok: false, class: 'CONFLICT', code: 'CREATE_CONFLICT' };
      }

      // conflict with busy / existing
      for (const b of store.busy) {
        if (b.resourceId === resourceId && overlaps(b.startUtc, b.endUtc, startUtc, endUtc)) {
          return { ok: false, class: 'CONFLICT', code: 'CREATE_CONFLICT' };
        }
      }
      for (const ev of store.events.values()) {
        if (ev.deleted || ev.resourceId !== resourceId) continue;
        if (ev.idempotencyKey && ev.idempotencyKey === idempotencyKey) {
          return {
            ok: true,
            class: 'PROVIDER_ACCEPTED',
            providerEventId: ev.providerEventId,
            conferenceUrl: ev.conferenceUrl,
            conferenceStatus: ev.conferenceStatus,
            duplicate: true,
          };
        }
        if (overlaps(ev.startUtc, ev.endUtc, startUtc, endUtc)) {
          return { ok: false, class: 'CONFLICT', code: 'CREATE_CONFLICT' };
        }
      }

      const providerEventId = `cal_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
      const delayed = store.mode === 'CONFERENCE_DELAYED';
      const conferenceUrl = delayed
        ? null
        : `https://meeting.example.invalid/${providerEventId}`;
      const conferenceStatus = delayed ? 'DELAYED' : 'READY';
      const event = {
        providerEventId,
        resourceId,
        startUtc: new Date(startUtc).toISOString(),
        endUtc: new Date(endUtc).toISOString(),
        title: title || 'DeinTarifheld Beratung',
        idempotencyKey,
        attendeeEmailHash: attendeeEmailHash || null,
        conferenceUrl,
        conferenceStatus,
        deleted: false,
      };
      store.events.set(providerEventId, event);
      return {
        ok: true,
        class: 'PROVIDER_ACCEPTED',
        providerEventId,
        conferenceUrl,
        conferenceStatus,
      };
    },

    async getAppointment({ providerEventId }) {
      if (store.mode === 'EVENT_DELETED') {
        return { ok: true, found: false, code: 'READBACK_ABSENT' };
      }
      const ev = store.events.get(providerEventId);
      if (!ev || ev.deleted) return { ok: true, found: false, code: 'READBACK_ABSENT' };
      return {
        ok: true,
        found: true,
        code: 'READBACK_FOUND',
        event: { ...ev },
      };
    },

    async cancelAppointment({ providerEventId }) {
      const ev = store.events.get(providerEventId);
      if (!ev) return { ok: false, code: 'CANCEL_FAIL_MISSING' };
      if (store.mode === 'CANCEL_FAIL') return { ok: false, code: 'CANCEL_FAIL' };
      ev.deleted = true;
      store.events.set(providerEventId, ev);
      return { ok: true, code: 'CANCEL_SUCCESS' };
    },

    async updateAppointment({ providerEventId, startUtc, endUtc }) {
      const ev = store.events.get(providerEventId);
      if (!ev || ev.deleted) return { ok: false, code: 'UPDATE_FAIL' };
      if (startUtc) ev.startUtc = new Date(startUtc).toISOString();
      if (endUtc) ev.endUtc = new Date(endUtc).toISOString();
      store.events.set(providerEventId, ev);
      return { ok: true, code: 'UPDATE_SUCCESS', event: { ...ev } };
    },

    /** Test helper: mutate stored event externally */
    __mutateEvent(providerEventId, patch) {
      const ev = store.events.get(providerEventId);
      if (!ev) return null;
      Object.assign(ev, patch);
      store.events.set(providerEventId, ev);
      return ev;
    },
  };
}
