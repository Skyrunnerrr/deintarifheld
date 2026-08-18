/**
 * ContractDatePolicyV1 — civil calendar DATE arithmetic. No JS local Date overflow.
 */
import { A10_DATE_POLICY_ID, A10_DATE_POLICY_VERSION } from '@deintarifheld/shared';

export const ContractDatePolicyV1 = Object.freeze({
  id: A10_DATE_POLICY_ID,
  version: A10_DATE_POLICY_VERSION,
  monthEndRule: 'CLAMP_TO_LAST_DAY',
});

export function parseIsoDate(value) {
  const s = String(value || '').slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) {
    const err = new Error('INVALID_DATE');
    err.code = 'INVALID_DATE';
    throw err;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) {
    const err = new Error('INVALID_DATE');
    err.code = 'INVALID_DATE';
    throw err;
  }
  return { y, m: mo, d };
}

export function formatIsoDate({ y, m, d }) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addCalendarMonths(iso, months) {
  const { y, m, d } = parseIsoDate(iso);
  const idx = y * 12 + (m - 1) + Number(months);
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  const nd = Math.min(d, daysInMonth(ny, nm));
  return formatIsoDate({ y: ny, m: nm, d: nd });
}

export function addCalendarDays(iso, days) {
  const { y, m, d } = parseIsoDate(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + Number(days)));
  return formatIsoDate({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() });
}

export function compareIsoDate(a, b) {
  const left = String(a).slice(0, 10);
  const right = String(b).slice(0, 10);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function todayIso(now = new Date()) {
  return formatIsoDate({
    y: now.getUTCFullYear(),
    m: now.getUTCMonth() + 1,
    d: now.getUTCDate(),
  });
}
