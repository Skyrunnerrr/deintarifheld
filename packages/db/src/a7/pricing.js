/**
 * Pure tariff cost calculation — integer micro-EUR only.
 * FIRST_YEAR vs ONGOING separated; ONE_TIME bonus only in first_year.
 */
import { ComponentType } from '@deintarifheld/shared';
import { mulConsumptionRate, annualizeFixed, roundFinal } from './money.js';
import { TariffCalculationPolicyV1 } from './policy.js';

const KNOWN_COMPONENTS = new Set(Object.values(ComponentType));

function applies(appliesTo, view) {
  if (appliesTo === 'both') return true;
  if (view === 'first_year') return appliesTo === 'first_year' || appliesTo === 'both';
  if (view === 'ongoing') return appliesTo === 'ongoing' || appliesTo === 'both';
  return false;
}

/**
 * @returns {{ ok: boolean, code?: string, ongoingAnnualMicro?: bigint, firstYearAnnualMicro?: bigint, componentTrace?: object[] }}
 */
export function calculateTariffCost(profile, tariff, policy = TariffCalculationPolicyV1) {
  if (profile.annualConsumptionKwh == null) {
    return { ok: false, code: 'MISSING_CONSUMPTION' };
  }
  const consumption = BigInt(profile.annualConsumptionKwh);
  const supplyPoints = BigInt(profile.supplyPointCount || 1);

  for (const c of tariff.components || []) {
    if (!KNOWN_COMPONENTS.has(c.componentType)) {
      return { ok: false, code: 'UNKNOWN_COMPONENT_TYPE' };
    }
  }

  function calcView(view) {
    const trace = [];
    let total = 0n;
    for (const c of tariff.components || []) {
      if (!applies(c.appliesTo, view)) continue;
      let amount = 0n;
      if (c.componentType === ComponentType.ENERGY_VARIABLE || c.frequency === 'PER_KWH') {
        amount = mulConsumptionRate(consumption, c.rateMicro);
      } else if (
        c.componentType === ComponentType.BONUS ||
        c.frequency === 'ONE_TIME'
      ) {
        // ONE_TIME only meaningful for first_year (filtered by applies_to)
        amount = BigInt(c.rateMicro);
        if (c.perSupplyPoint) amount *= supplyPoints;
      } else {
        amount = annualizeFixed(c.rateMicro, c.frequency);
        if (c.perSupplyPoint) amount *= supplyPoints;
      }
      trace.push({
        componentType: c.componentType,
        appliesTo: c.appliesTo,
        view,
        rateMicro: String(c.rateMicro),
        frequency: c.frequency,
        perSupplyPoint: c.perSupplyPoint,
        amountMicro: String(amount),
      });
      total += amount;
    }
    return { total: roundFinal(policy, total), trace };
  }

  const ongoing = calcView('ongoing');
  const firstYear = calcView('first_year');

  return {
    ok: true,
    ongoingAnnualMicro: ongoing.total,
    firstYearAnnualMicro: firstYear.total,
    componentTrace: [...ongoing.trace, ...firstYear.trace],
    currency: tariff.currency,
    priceBasis: tariff.priceBasis,
  };
}
