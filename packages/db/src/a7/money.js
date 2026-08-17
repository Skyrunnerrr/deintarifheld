/**
 * A7 commercial money — integer micro-EUR only (no binary float authority).
 * 1 EUR = MICRO_EUR_SCALE micro.
 */
import { MICRO_EUR_SCALE } from '@deintarifheld/shared';

/**
 * @param {string|number|bigint} eurExact — exact EUR amount as integer EUR or decimal string with up to 6 fractional digits
 * @returns {bigint}
 */
export function toMicroEur(eurExact) {
  if (typeof eurExact === 'bigint') return eurExact;
  if (typeof eurExact === 'number') {
    if (!Number.isFinite(eurExact)) throw new Error('INVALID_MONEY');
    if (!Number.isInteger(eurExact)) {
      throw new Error('FLOAT_EUR_FORBIDDEN_USE_STRING_OR_MICRO');
    }
    return BigInt(eurExact) * BigInt(MICRO_EUR_SCALE);
  }
  const s = String(eurExact ?? '').trim();
  if (!s) throw new Error('EMPTY_MONEY');
  const neg = s.startsWith('-');
  const raw = neg ? s.slice(1) : s;
  if (!/^\d+(\.\d{1,6})?$/.test(raw)) throw new Error('INVALID_MONEY_FORMAT');
  const [whole, frac = ''] = raw.split('.');
  const padded = (frac + '000000').slice(0, 6);
  const micro = BigInt(whole) * BigInt(MICRO_EUR_SCALE) + BigInt(padded);
  return neg ? -micro : micro;
}

/** Display helper only — not commercial authority. */
export function fromMicroEurDisplay(micro) {
  const v = BigInt(micro);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const whole = abs / BigInt(MICRO_EUR_SCALE);
  const frac = abs % BigInt(MICRO_EUR_SCALE);
  const fracStr = frac.toString().padStart(6, '0');
  return `${neg ? '-' : ''}${whole}.${fracStr}`;
}

/**
 * Exact: consumption_kwh * rate_micro_per_kwh → micro-EUR annual variable.
 * Both operands must be integers (BigInt-compatible).
 */
export function mulConsumptionRate(consumptionKwh, rateMicroPerKwh) {
  const c = BigInt(consumptionKwh);
  const r = BigInt(rateMicroPerKwh);
  if (c < 0n) throw new Error('NEGATIVE_CONSUMPTION');
  return c * r;
}

/**
 * Annualize a fixed component rate already in micro-EUR for its frequency unit.
 */
export function annualizeFixed(rateMicro, frequency) {
  const r = BigInt(rateMicro);
  switch (frequency) {
    case 'PER_YEAR':
    case 'ONE_TIME':
      return r;
    case 'PER_MONTH':
      return r * 12n;
    case 'PER_DAY':
      return r * 365n;
    default:
      throw new Error(`UNSUPPORTED_FREQUENCY:${frequency}`);
  }
}

/**
 * TariffCalculationPolicyV1: round ONLY final annual totals to integer micro-EUR.
 * Intermediate component math stays exact BigInt; if already integer micro, identity.
 * Policy documents that we never use Math.round on commercial paths — banker's not needed
 * because micro is already the atomic unit; residual fractional micro is impossible with
 * integer inputs. Kept for policy hook / future scale-up.
 */
export function roundFinal(policy, microAmount) {
  const version = policy?.version ?? 1;
  if (version !== 1) throw new Error(`UNKNOWN_CALCULATION_POLICY:${version}`);
  const v = BigInt(microAmount);
  // Already integer micro-EUR — identity (no float rounding).
  return v;
}

export function assertNoFloatAuthority(value, label = 'value') {
  if (typeof value === 'number' && !Number.isInteger(value)) {
    throw new Error(`BINARY_FLOAT_FORBIDDEN:${label}`);
  }
}
