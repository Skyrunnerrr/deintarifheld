/**
 * Synthetic TEST_FIXTURE tariff catalogue definitions.
 * Fictional suppliers only — never live market data.
 */
import { createHash } from 'node:crypto';
import { toMicroEur } from './money.js';

function hashRef(ref) {
  return createHash('sha256').update(String(ref)).digest('hex');
}

/** 0.28 EUR/kWh = 280_000 microEUR/kWh */
const RATE_028 = toMicroEur('0.28');
const RATE_030 = toMicroEur('0.30');
const RATE_025 = toMicroEur('0.25');
const RATE_032 = toMicroEur('0.32');
const RATE_GAS = toMicroEur('0.08');
const BASE_YEAR = toMicroEur('120'); // 120 EUR/year
const BASE_MONTH = toMicroEur('10'); // 10 EUR/month → 120/year
const BONUS_ONE = toMicroEur('50'); // 50 EUR one-time (stored negative for credit)

/**
 * @typedef {object} FixtureTariff
 */

export const SYNTHETIC_SUPPLIERS = Object.freeze([
  { code: 'TESTENERGIE_NORD', name: 'TestEnergie Nord GmbH' },
  { code: 'BEISPIELSTROM_AG', name: 'BeispielStrom AG' },
]);

/**
 * Full synthetic catalogue used by importSyntheticCatalogue.
 * Rates are micro-EUR (absolute) or microEUR/kWh for ENERGY_VARIABLE.
 */
export function buildSyntheticCatalogueDefinitions(now = new Date()) {
  const t0 = new Date(now);
  const past = new Date(t0);
  past.setFullYear(past.getFullYear() - 2);
  const pastEnd = new Date(t0);
  pastEnd.setFullYear(pastEnd.getFullYear() - 1);
  const futureStart = new Date(t0);
  futureStart.setFullYear(futureStart.getFullYear() + 1);
  const farFuture = new Date(futureStart);
  farFuture.setFullYear(farFuture.getFullYear() + 2);
  const longEnd = new Date(t0);
  longEnd.setFullYear(longEnd.getFullYear() + 5);

  /** @type {Array<object>} */
  const products = [
    // --- electricity BUSINESS eligible (TestEnergie Nord) ---
    {
      supplierCode: 'TESTENERGIE_NORD',
      productCode: 'TE-E-BIZ-BASIC',
      energyType: 'ELECTRICITY',
      customerSegment: 'BUSINESS',
      versions: [
        {
          version: '2026.1',
          validFrom: past.toISOString(),
          validTo: longEnd.toISOString(),
          status: 'ACTIVE',
          currency: 'EUR',
          priceBasis: 'NET',
          sourceRef: 'fixture:te-e-biz-basic-2026.1',
          components: [
            {
              componentType: 'ENERGY_VARIABLE',
              unit: 'MICRO_EUR_PER_KWH',
              rateMicro: RATE_028,
              frequency: 'PER_KWH',
              perSupplyPoint: false,
              appliesTo: 'both',
              sortOrder: 1,
            },
            {
              componentType: 'BASE_FIXED',
              unit: 'MICRO_EUR',
              rateMicro: BASE_YEAR,
              frequency: 'PER_YEAR',
              perSupplyPoint: true,
              appliesTo: 'both',
              sortOrder: 2,
            },
          ],
          rules: [
            { ruleType: 'ENERGY_TYPE', params: { energyType: 'ELECTRICITY' } },
            { ruleType: 'CUSTOMER_SEGMENT', params: { segment: 'BUSINESS' } },
            { ruleType: 'CONSUMPTION_MIN_KWH', params: { minKwh: 10000 } },
            { ruleType: 'CONSUMPTION_MAX_KWH', params: { maxKwh: 500000 } },
            { ruleType: 'POSTCODE_PREFIX_ALLOWLIST', params: { prefixes: ['80', '81', '82'] } },
          ],
        },
      ],
    },
    // electricity BUSINESS with first-year bonus
    {
      supplierCode: 'TESTENERGIE_NORD',
      productCode: 'TE-E-BIZ-BONUS',
      energyType: 'ELECTRICITY',
      customerSegment: 'BUSINESS',
      versions: [
        {
          version: '2026.1',
          validFrom: past.toISOString(),
          validTo: longEnd.toISOString(),
          status: 'ACTIVE',
          currency: 'EUR',
          priceBasis: 'NET',
          sourceRef: 'fixture:te-e-biz-bonus-2026.1',
          components: [
            {
              componentType: 'ENERGY_VARIABLE',
              unit: 'MICRO_EUR_PER_KWH',
              rateMicro: RATE_030,
              frequency: 'PER_KWH',
              perSupplyPoint: false,
              appliesTo: 'both',
              sortOrder: 1,
            },
            {
              componentType: 'BASE_FIXED',
              unit: 'MICRO_EUR',
              rateMicro: BASE_MONTH,
              frequency: 'PER_MONTH',
              perSupplyPoint: false,
              appliesTo: 'both',
              sortOrder: 2,
            },
            {
              componentType: 'BONUS',
              unit: 'MICRO_EUR',
              rateMicro: -BONUS_ONE, // credit
              frequency: 'ONE_TIME',
              perSupplyPoint: false,
              appliesTo: 'first_year',
              sortOrder: 3,
            },
          ],
          rules: [
            { ruleType: 'ENERGY_TYPE', params: { energyType: 'ELECTRICITY' } },
            { ruleType: 'CUSTOMER_SEGMENT', params: { segment: 'BUSINESS' } },
            { ruleType: 'CONSUMPTION_MIN_KWH', params: { minKwh: 5000 } },
            { ruleType: 'CONSUMPTION_MAX_KWH', params: { maxKwh: 200000 } },
          ],
        },
      ],
    },
    // electricity BUSINESS expensive (for negative savings / ranking)
    {
      supplierCode: 'BEISPIELSTROM_AG',
      productCode: 'BS-E-BIZ-PREMIUM',
      energyType: 'ELECTRICITY',
      customerSegment: 'BUSINESS',
      versions: [
        {
          version: '2026.1',
          validFrom: past.toISOString(),
          validTo: longEnd.toISOString(),
          status: 'ACTIVE',
          currency: 'EUR',
          priceBasis: 'NET',
          sourceRef: 'fixture:bs-e-biz-premium-2026.1',
          components: [
            {
              componentType: 'ENERGY_VARIABLE',
              unit: 'MICRO_EUR_PER_KWH',
              rateMicro: RATE_032,
              frequency: 'PER_KWH',
              perSupplyPoint: false,
              appliesTo: 'both',
              sortOrder: 1,
            },
            {
              componentType: 'BASE_FIXED',
              unit: 'MICRO_EUR',
              rateMicro: BASE_YEAR,
              frequency: 'PER_YEAR',
              perSupplyPoint: false,
              appliesTo: 'both',
              sortOrder: 2,
            },
          ],
          rules: [
            { ruleType: 'ENERGY_TYPE', params: { energyType: 'ELECTRICITY' } },
            { ruleType: 'CUSTOMER_SEGMENT', params: { segment: 'BUSINESS' } },
            { ruleType: 'CONSUMPTION_MIN_KWH', params: { minKwh: 1000 } },
            { ruleType: 'CONSUMPTION_MAX_KWH', params: { maxKwh: 1000000 } },
          ],
        },
      ],
    },
    // electricity BUSINESS high-band only (ineligible for 90k)
    {
      supplierCode: 'BEISPIELSTROM_AG',
      productCode: 'BS-E-BIZ-INDUSTRIAL',
      energyType: 'ELECTRICITY',
      customerSegment: 'BUSINESS',
      versions: [
        {
          version: '2026.1',
          validFrom: past.toISOString(),
          validTo: longEnd.toISOString(),
          status: 'ACTIVE',
          currency: 'EUR',
          priceBasis: 'NET',
          sourceRef: 'fixture:bs-e-biz-industrial-2026.1',
          components: [
            {
              componentType: 'ENERGY_VARIABLE',
              unit: 'MICRO_EUR_PER_KWH',
              rateMicro: RATE_025,
              frequency: 'PER_KWH',
              perSupplyPoint: false,
              appliesTo: 'both',
              sortOrder: 1,
            },
          ],
          rules: [
            { ruleType: 'ENERGY_TYPE', params: { energyType: 'ELECTRICITY' } },
            { ruleType: 'CUSTOMER_SEGMENT', params: { segment: 'BUSINESS' } },
            { ruleType: 'CONSUMPTION_MIN_KWH', params: { minKwh: 200000 } },
            { ruleType: 'CONSUMPTION_MAX_KWH', params: { maxKwh: 5000000 } },
          ],
        },
      ],
    },
    // electricity PRIVATE — must never apply to B2B
    {
      supplierCode: 'BEISPIELSTROM_AG',
      productCode: 'BS-E-PRIVATE',
      energyType: 'ELECTRICITY',
      customerSegment: 'PRIVATE',
      versions: [
        {
          version: '2026.1',
          validFrom: past.toISOString(),
          validTo: longEnd.toISOString(),
          status: 'ACTIVE',
          currency: 'EUR',
          priceBasis: 'GROSS',
          sourceRef: 'fixture:bs-e-private-2026.1',
          components: [
            {
              componentType: 'ENERGY_VARIABLE',
              unit: 'MICRO_EUR_PER_KWH',
              rateMicro: RATE_030,
              frequency: 'PER_KWH',
              perSupplyPoint: false,
              appliesTo: 'both',
              sortOrder: 1,
            },
          ],
          rules: [
            { ruleType: 'ENERGY_TYPE', params: { energyType: 'ELECTRICITY' } },
            { ruleType: 'CUSTOMER_SEGMENT', params: { segment: 'PRIVATE' } },
          ],
        },
      ],
    },
    // electricity GROSS basis (for net/gross mismatch tests when baseline is NET)
    {
      supplierCode: 'TESTENERGIE_NORD',
      productCode: 'TE-E-BIZ-GROSS',
      energyType: 'ELECTRICITY',
      customerSegment: 'BUSINESS',
      versions: [
        {
          version: '2026.1',
          validFrom: past.toISOString(),
          validTo: longEnd.toISOString(),
          status: 'ACTIVE',
          currency: 'EUR',
          priceBasis: 'GROSS',
          sourceRef: 'fixture:te-e-biz-gross-2026.1',
          components: [
            {
              componentType: 'ENERGY_VARIABLE',
              unit: 'MICRO_EUR_PER_KWH',
              rateMicro: RATE_028,
              frequency: 'PER_KWH',
              perSupplyPoint: false,
              appliesTo: 'both',
              sortOrder: 1,
            },
          ],
          rules: [
            { ruleType: 'ENERGY_TYPE', params: { energyType: 'ELECTRICITY' } },
            { ruleType: 'CUSTOMER_SEGMENT', params: { segment: 'BUSINESS' } },
          ],
        },
      ],
    },
    // electricity CHF currency (mismatch)
    {
      supplierCode: 'TESTENERGIE_NORD',
      productCode: 'TE-E-BIZ-CHF',
      energyType: 'ELECTRICITY',
      customerSegment: 'BUSINESS',
      versions: [
        {
          version: '2026.1',
          validFrom: past.toISOString(),
          validTo: longEnd.toISOString(),
          status: 'ACTIVE',
          currency: 'CHF',
          priceBasis: 'NET',
          sourceRef: 'fixture:te-e-biz-chf-2026.1',
          components: [
            {
              componentType: 'ENERGY_VARIABLE',
              unit: 'MICRO_EUR_PER_KWH',
              rateMicro: RATE_028,
              frequency: 'PER_KWH',
              perSupplyPoint: false,
              appliesTo: 'both',
              sortOrder: 1,
            },
          ],
          rules: [
            { ruleType: 'ENERGY_TYPE', params: { energyType: 'ELECTRICITY' } },
            { ruleType: 'CUSTOMER_SEGMENT', params: { segment: 'BUSINESS' } },
          ],
        },
      ],
    },
    // expired electricity
    {
      supplierCode: 'TESTENERGIE_NORD',
      productCode: 'TE-E-BIZ-EXPIRED',
      energyType: 'ELECTRICITY',
      customerSegment: 'BUSINESS',
      versions: [
        {
          version: '2024.1',
          validFrom: past.toISOString(),
          validTo: pastEnd.toISOString(),
          status: 'ACTIVE',
          currency: 'EUR',
          priceBasis: 'NET',
          sourceRef: 'fixture:te-e-biz-expired-2024.1',
          components: [
            {
              componentType: 'ENERGY_VARIABLE',
              unit: 'MICRO_EUR_PER_KWH',
              rateMicro: RATE_025,
              frequency: 'PER_KWH',
              perSupplyPoint: false,
              appliesTo: 'both',
              sortOrder: 1,
            },
          ],
          rules: [
            { ruleType: 'ENERGY_TYPE', params: { energyType: 'ELECTRICITY' } },
            { ruleType: 'CUSTOMER_SEGMENT', params: { segment: 'BUSINESS' } },
          ],
        },
      ],
    },
    // future electricity
    {
      supplierCode: 'TESTENERGIE_NORD',
      productCode: 'TE-E-BIZ-FUTURE',
      energyType: 'ELECTRICITY',
      customerSegment: 'BUSINESS',
      versions: [
        {
          version: '2027.1',
          validFrom: futureStart.toISOString(),
          validTo: farFuture.toISOString(),
          status: 'ACTIVE',
          currency: 'EUR',
          priceBasis: 'NET',
          sourceRef: 'fixture:te-e-biz-future-2027.1',
          components: [
            {
              componentType: 'ENERGY_VARIABLE',
              unit: 'MICRO_EUR_PER_KWH',
              rateMicro: RATE_025,
              frequency: 'PER_KWH',
              perSupplyPoint: false,
              appliesTo: 'both',
              sortOrder: 1,
            },
          ],
          rules: [
            { ruleType: 'ENERGY_TYPE', params: { energyType: 'ELECTRICITY' } },
            { ruleType: 'CUSTOMER_SEGMENT', params: { segment: 'BUSINESS' } },
          ],
        },
      ],
    },
    // inactive electricity
    {
      supplierCode: 'BEISPIELSTROM_AG',
      productCode: 'BS-E-BIZ-INACTIVE',
      energyType: 'ELECTRICITY',
      customerSegment: 'BUSINESS',
      versions: [
        {
          version: '2026.1',
          validFrom: past.toISOString(),
          validTo: longEnd.toISOString(),
          status: 'INACTIVE',
          currency: 'EUR',
          priceBasis: 'NET',
          sourceRef: 'fixture:bs-e-biz-inactive-2026.1',
          components: [
            {
              componentType: 'ENERGY_VARIABLE',
              unit: 'MICRO_EUR_PER_KWH',
              rateMicro: RATE_025,
              frequency: 'PER_KWH',
              perSupplyPoint: false,
              appliesTo: 'both',
              sortOrder: 1,
            },
          ],
          rules: [
            { ruleType: 'ENERGY_TYPE', params: { energyType: 'ELECTRICITY' } },
            { ruleType: 'CUSTOMER_SEGMENT', params: { segment: 'BUSINESS' } },
          ],
        },
      ],
    },
    // gas BUSINESS
    {
      supplierCode: 'TESTENERGIE_NORD',
      productCode: 'TE-G-BIZ-BASIC',
      energyType: 'GAS',
      customerSegment: 'BUSINESS',
      versions: [
        {
          version: '2026.1',
          validFrom: past.toISOString(),
          validTo: longEnd.toISOString(),
          status: 'ACTIVE',
          currency: 'EUR',
          priceBasis: 'NET',
          sourceRef: 'fixture:te-g-biz-basic-2026.1',
          components: [
            {
              componentType: 'ENERGY_VARIABLE',
              unit: 'MICRO_EUR_PER_KWH',
              rateMicro: RATE_GAS,
              frequency: 'PER_KWH',
              perSupplyPoint: false,
              appliesTo: 'both',
              sortOrder: 1,
            },
            {
              componentType: 'BASE_FIXED',
              unit: 'MICRO_EUR',
              rateMicro: BASE_YEAR,
              frequency: 'PER_YEAR',
              perSupplyPoint: true,
              appliesTo: 'both',
              sortOrder: 2,
            },
          ],
          rules: [
            { ruleType: 'ENERGY_TYPE', params: { energyType: 'GAS' } },
            { ruleType: 'CUSTOMER_SEGMENT', params: { segment: 'BUSINESS' } },
            { ruleType: 'CONSUMPTION_MIN_KWH', params: { minKwh: 5000 } },
            { ruleType: 'CONSUMPTION_MAX_KWH', params: { maxKwh: 2000000 } },
          ],
        },
      ],
    },
    // gas PRIVATE (must not apply to B2B gas either for segment)
    {
      supplierCode: 'BEISPIELSTROM_AG',
      productCode: 'BS-G-PRIVATE',
      energyType: 'GAS',
      customerSegment: 'PRIVATE',
      versions: [
        {
          version: '2026.1',
          validFrom: past.toISOString(),
          validTo: longEnd.toISOString(),
          status: 'ACTIVE',
          currency: 'EUR',
          priceBasis: 'NET',
          sourceRef: 'fixture:bs-g-private-2026.1',
          components: [
            {
              componentType: 'ENERGY_VARIABLE',
              unit: 'MICRO_EUR_PER_KWH',
              rateMicro: RATE_GAS,
              frequency: 'PER_KWH',
              perSupplyPoint: false,
              appliesTo: 'both',
              sortOrder: 1,
            },
          ],
          rules: [
            { ruleType: 'ENERGY_TYPE', params: { energyType: 'GAS' } },
            { ruleType: 'CUSTOMER_SEGMENT', params: { segment: 'PRIVATE' } },
          ],
        },
      ],
    },
  ];

  // attach source hashes
  for (const p of products) {
    for (const v of p.versions) {
      v.sourceKind = 'TEST_FIXTURE';
      v.sourceHash = hashRef(v.sourceRef);
    }
  }
  return { suppliers: SYNTHETIC_SUPPLIERS, products };
}

export function fixtureSourceHash(sourceRef) {
  return hashRef(sourceRef);
}
