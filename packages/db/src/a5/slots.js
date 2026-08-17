/**
 * Deterministic availability / slot generation (no AI).
 */
import { TEST_APPOINTMENT_POLICY_V1 } from '@deintarifheld/shared';
import { zonedLocalToUtc, zonedParts } from './timezone.js';

function parseHm(hm) {
  const [h, m] = String(hm).split(':').map(Number);
  return { hour: h, minute: m || 0 };
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export function generateCandidateSlots({
  policy = TEST_APPOINTMENT_POLICY_V1,
  now = new Date(),
  busyPeriods = [],
  dthAppointments = [],
} = {}) {
  const tz = policy.timezone;
  const durationMs = policy.durationMinutes * 60 * 1000;
  const intervalMs = policy.slotIntervalMinutes * 60 * 1000;
  const rangeStart = new Date(now.getTime() + (policy.minLeadTimeMs || 0));
  const rangeEnd = new Date(now.getTime() + (policy.bookingHorizonMs || 0));
  const blockers = [
    ...busyPeriods.map((b) => ({
      start: new Date(b.startUtc).getTime() - (policy.bufferBeforeMs || 0),
      end: new Date(b.endUtc).getTime() + (policy.bufferAfterMs || 0),
    })),
    ...dthAppointments.map((a) => ({
      start: new Date(a.start_at_utc || a.startUtc).getTime() - (policy.bufferBeforeMs || 0),
      end: new Date(a.end_at_utc || a.endUtc).getTime() + (policy.bufferAfterMs || 0),
    })),
  ];

  const slots = [];
  // walk day by day in timezone
  let cursorLocal = zonedParts(rangeStart, tz);
  const endLocal = zonedParts(rangeEnd, tz);
  const maxDays = 14;
  for (let dayOffset = 0; dayOffset < maxDays; dayOffset += 1) {
    const probe = new Date(Date.UTC(cursorLocal.year, cursorLocal.month - 1, cursorLocal.day + dayOffset, 12, 0, 0));
    const parts = zonedParts(probe, tz);
    if (!policy.workingDays.includes(parts.weekday)) continue;
    if (
      parts.year > endLocal.year ||
      (parts.year === endLocal.year && parts.month > endLocal.month) ||
      (parts.year === endLocal.year && parts.month === endLocal.month && parts.day > endLocal.day)
    ) {
      break;
    }

    for (const win of policy.workingWindows) {
      const startHm = parseHm(win.start);
      const endHm = parseHm(win.end);
      let minuteCursor = startHm.hour * 60 + startHm.minute;
      const minuteEnd = endHm.hour * 60 + endHm.minute;
      while (minuteCursor + policy.durationMinutes <= minuteEnd) {
        const hour = Math.floor(minuteCursor / 60);
        const minute = minuteCursor % 60;
        const startUtc = zonedLocalToUtc(
          { year: parts.year, month: parts.month, day: parts.day, hour, minute },
          tz,
        );
        if (!startUtc) {
          minuteCursor += policy.slotIntervalMinutes;
          continue; // DST gap
        }
        const endUtc = new Date(startUtc.getTime() + durationMs);
        if (startUtc < rangeStart || endUtc > rangeEnd) {
          minuteCursor += policy.slotIntervalMinutes;
          continue;
        }
        const blocked = blockers.some((b) => overlaps(startUtc.getTime(), endUtc.getTime(), b.start, b.end));
        if (!blocked) {
          slots.push({
            startAtUtc: startUtc.toISOString(),
            endAtUtc: endUtc.toISOString(),
            timezone: tz,
          });
        }
        minuteCursor += policy.slotIntervalMinutes;
        if (slots.length >= (policy.maxSlotsOffered || 5) * 3) break;
      }
    }
    if (slots.length >= (policy.maxSlotsOffered || 5) * 3) break;
  }

  slots.sort((a, b) => a.startAtUtc.localeCompare(b.startAtUtc));
  return slots.slice(0, policy.maxSlotsOffered || 5);
}
