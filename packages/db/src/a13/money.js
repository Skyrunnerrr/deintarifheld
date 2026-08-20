/**
 * A13 money — wrap A7 exact micro-EUR. No float authority.
 */
import { toMicroEur, fromMicroEurDisplay, assertNoFloatAuthority } from '../a7/money.js';
import { bumpA13Invariant } from './invariants.js';

export { toMicroEur, fromMicroEurDisplay };

export function assertAcquisitionMoneyExact(value, label = 'budget') {
  try {
    assertNoFloatAuthority(value, label);
  } catch (err) {
    bumpA13Invariant('BINARY_FLOAT_AD_SPEND_AUTHORITY_USES');
    throw err;
  }
}

export function parseBudgetMicroEur(eurExact) {
  assertAcquisitionMoneyExact(eurExact, 'budget');
  const micro = toMicroEur(eurExact);
  if (micro < 0n) throw new Error('NEGATIVE_BUDGET_FORBIDDEN');
  return micro;
}

export function budgetHashParts({
  totalBudgetMicroEur,
  dailyBudgetMicroEur,
  providerCode,
  providerAccountRef,
}) {
  return [
    String(totalBudgetMicroEur),
    String(dailyBudgetMicroEur),
    String(providerCode || ''),
    String(providerAccountRef || ''),
  ].join('|');
}
