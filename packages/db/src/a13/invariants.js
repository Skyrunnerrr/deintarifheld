/**
 * A13 critical invariant counters. Expected all 0 at close.
 */
import { A13_CRITICAL_INVARIANT_KEYS, A13_CRITICAL_INVARIANT_EXPECTED } from '@deintarifheld/shared';

const counters = Object.fromEntries(A13_CRITICAL_INVARIANT_KEYS.map((k) => [k, 0]));

export function resetA13InvariantCounters() {
  for (const k of A13_CRITICAL_INVARIANT_KEYS) counters[k] = 0;
}

export function bumpA13Invariant(key, n = 1) {
  if (!Object.prototype.hasOwnProperty.call(counters, key)) {
    throw new Error(`UNKNOWN_A13_INVARIANT:${key}`);
  }
  counters[key] += n;
  return counters[key];
}

export function getA13InvariantCounters() {
  return { ...counters };
}

export function assertA13CriticalInvariantsZero() {
  const bad = [];
  for (const k of A13_CRITICAL_INVARIANT_KEYS) {
    const expected = A13_CRITICAL_INVARIANT_EXPECTED[k] ?? 0;
    if (counters[k] !== expected) bad.push({ key: k, value: counters[k], expected });
  }
  return { ok: bad.length === 0, bad, counters: getA13InvariantCounters() };
}
