/**
 * A8 display-only German EUR formatting from integer micro-EUR.
 * NEVER Number(bigint)/1e6 — commercial display splits BigInt by MICRO_EUR_SCALE.
 */
import { MICRO_EUR_SCALE } from '@deintarifheld/shared';
import { fromMicroEurDisplay } from '../a7/money.js';

function groupThousandsDe(wholeDigits) {
  const s = String(wholeDigits || '0');
  let out = '';
  let n = 0;
  for (let i = s.length - 1; i >= 0; i -= 1) {
    if (n > 0 && n % 3 === 0) out = `.${out}`;
    out = `${s[i]}${out}`;
    n += 1;
  }
  return out || '0';
}

/**
 * @param {bigint|string|number} microBigint
 * @returns {string} e.g. "25.200,12 €"
 */
export function formatMicroEurDe(microBigint) {
  const v = typeof microBigint === 'bigint' ? microBigint : BigInt(microBigint);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const scale = BigInt(MICRO_EUR_SCALE);
  const whole = abs / scale;
  const frac = abs % scale;
  const frac2 = frac.toString().padStart(6, '0').slice(0, 2);
  const formatted = `${groupThousandsDe(whole.toString())},${frac2} €`;
  return neg ? `−${formatted}` : formatted;
}

export function formatMicroEurDePlain(microBigint) {
  return fromMicroEurDisplay(microBigint);
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function priceBasisLabelDe(priceBasis) {
  if (priceBasis === 'GROSS') return 'brutto';
  return 'netto';
}
