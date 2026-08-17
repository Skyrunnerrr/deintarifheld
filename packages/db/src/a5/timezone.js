/**
 * IANA timezone helpers for A5 (UTC storage authority).
 * No CET/CEST abbreviations as authority.
 */
export function getTimeZoneOffsetMs(dateUtc, timeZone) {
  const d = dateUtc instanceof Date ? dateUtc : new Date(dateUtc);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const map = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - d.getTime();
}

/**
 * Convert local wall time in IANA zone to UTC instant.
 * Returns null for nonexistent local times (DST spring gap).
 * For ambiguous fall times, returns the earlier (DST) occurrence (fold=0).
 */
export function zonedLocalToUtc({ year, month, day, hour, minute = 0, second = 0 }, timeZone, { fold = 0 } = {}) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  let offset = getTimeZoneOffsetMs(guess, timeZone);
  let utc = new Date(guess.getTime() - offset);
  // iterate once for stability
  offset = getTimeZoneOffsetMs(utc, timeZone);
  utc = new Date(guess.getTime() - offset);

  const back = zonedParts(utc, timeZone);
  if (
    back.year !== year ||
    back.month !== month ||
    back.day !== day ||
    back.hour !== hour ||
    back.minute !== minute
  ) {
    // nonexistent local time (spring forward)
    return null;
  }

  // Ambiguous: check if previous hour maps to same local
  const earlier = new Date(utc.getTime() - 60 * 60 * 1000);
  const earlierParts = zonedParts(earlier, timeZone);
  const ambiguous =
    earlierParts.year === year &&
    earlierParts.month === month &&
    earlierParts.day === day &&
    earlierParts.hour === hour &&
    earlierParts.minute === minute;
  if (ambiguous && fold === 1) {
    return new Date(utc.getTime() + 60 * 60 * 1000);
  }
  return utc;
}

export function zonedParts(dateUtc, timeZone) {
  const d = dateUtc instanceof Date ? dateUtc : new Date(dateUtc);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(d);
  const map = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: weekdayMap[map.weekday] ?? null,
  };
}

export function formatInTimeZone(dateUtc, timeZone, opts = {}) {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone,
    dateStyle: opts.dateStyle || 'full',
    timeStyle: opts.timeStyle || 'short',
  }).format(dateUtc instanceof Date ? dateUtc : new Date(dateUtc));
}
