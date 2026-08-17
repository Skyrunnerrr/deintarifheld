/**
 * Build Case energy profile from A6 getCaseEnergyEvidence + lead payload baseline.
 * Conflicts / ambiguous consumption → no pricing readiness.
 */
import { createHash } from 'node:crypto';
import {
  DocumentFactCode,
  DocumentFactsReadiness,
  ProfileReadiness,
  BaselineSource,
  CanonicalEnergyType,
  EligibilityReasonCode,
} from '@deintarifheld/shared';
import { getCaseEnergyEvidence } from '../a6/process.js';
import { toMicroEur } from './money.js';

function factMap(facts) {
  const m = new Map();
  for (const f of facts) {
    if (!m.has(f.factCode)) m.set(f.factCode, f);
  }
  return m;
}

function parseKwh(value) {
  if (value == null || value === '') return null;
  const n = String(value).replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(n)) return null;
  // annual kWh stored as integer kWh (truncate fractional for commercial band checks)
  return BigInt(Math.trunc(Number(n)));
}

function mapEnergy(value) {
  const v = String(value || '').toUpperCase();
  if (v === 'ELECTRICITY' || v === 'STROM' || v === CanonicalEnergyType.ELECTRICITY) {
    return CanonicalEnergyType.ELECTRICITY;
  }
  if (v === 'GAS' || v === CanonicalEnergyType.GAS) return CanonicalEnergyType.GAS;
  return null;
}

function fingerprintPayload(parts) {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

/**
 * Persist current energy profile for case (revision++ on change).
 */
export async function buildEnergyProfile(pool, caseId, { at = new Date() } = {}) {
  if (!caseId) return { ok: false, code: 'CASE_ID_REQUIRED' };

  const evidence = await getCaseEnergyEvidence(pool, caseId);
  const { rows: caseRows } = await pool.query(
    `SELECT c.id, l.payload, l.firma
     FROM public.cases c
     JOIN public.leads l ON l.id = c.source_lead_id
     WHERE c.id = $1 AND c.deleted_at IS NULL`,
    [caseId],
  );
  if (!caseRows[0]) return { ok: false, code: 'CASE_NOT_FOUND' };
  const payload = caseRows[0].payload && typeof caseRows[0].payload === 'object' ? caseRows[0].payload : {};

  const reasonCodes = [];
  if (evidence.unresolvedConflicts?.length) {
    return persistProfile(pool, {
      caseId,
      energyType: null,
      annualConsumptionKwh: null,
      supplyPointCount: 1,
      postcode: null,
      meteringType: null,
      currentSupplier: null,
      baselineAnnualMicro: null,
      baselineBasis: null,
      baselineCurrency: null,
      baselineSource: BaselineSource.NONE,
      readiness: ProfileReadiness.CONFLICT_REVIEW_REQUIRED,
      reasonCodes: [EligibilityReasonCode.INPUT_CONFLICT],
      evidence,
    });
  }

  if (
    evidence.readiness === DocumentFactsReadiness.DOCUMENT_REVIEW_REQUIRED ||
    evidence.missingEvidence?.includes('AMBIGUOUS_FACTS')
  ) {
    return persistProfile(pool, {
      caseId,
      energyType: null,
      annualConsumptionKwh: null,
      supplyPointCount: Number(payload.standorte) > 0 ? Number(payload.standorte) : 1,
      postcode: payload.plz || null,
      meteringType: null,
      currentSupplier: null,
      baselineAnnualMicro: null,
      baselineBasis: null,
      baselineCurrency: null,
      baselineSource: BaselineSource.NONE,
      readiness: ProfileReadiness.HUMAN_REVIEW,
      reasonCodes: [EligibilityReasonCode.INPUT_CONFLICT],
      evidence,
    });
  }

  const facts = factMap(evidence.facts || []);
  const energyFact = facts.get(DocumentFactCode.ENERGY_TYPE);
  const consumptionFact = facts.get(DocumentFactCode.ANNUAL_CONSUMPTION_KWH);
  const plzFact = facts.get(DocumentFactCode.PLZ);
  const supplierFact = facts.get(DocumentFactCode.SUPPLIER_NAME);

  let energyType = energyFact ? mapEnergy(energyFact.value) : mapEnergy(payload.energieart);
  let annualConsumptionKwh = consumptionFact ? parseKwh(consumptionFact.value) : null;
  if (annualConsumptionKwh == null) {
    if (energyType === CanonicalEnergyType.ELECTRICITY && payload.verbrauchStrom) {
      annualConsumptionKwh = parseKwh(payload.verbrauchStrom);
    } else if (energyType === CanonicalEnergyType.GAS && payload.verbrauchGas) {
      annualConsumptionKwh = parseKwh(payload.verbrauchGas);
    }
  }

  const postcode = plzFact?.value ? String(plzFact.value) : payload.plz ? String(payload.plz) : null;
  const supplyPointCount = Math.max(1, Number(payload.standorte) || 1);
  const currentSupplier = supplierFact?.value
    ? String(supplierFact.value)
    : payload.versorger
      ? String(payload.versorger)
      : null;

  // Baseline: only from ACCEPTED lead-stated annual cost fields if present — never invent.
  // Supported synthetic test fields: payload.jahreskostenNetto / jahreskosten (EUR string)
  let baselineAnnualMicro = null;
  let baselineBasis = null;
  let baselineCurrency = null;
  let baselineSource = BaselineSource.NONE;
  if (payload.jahreskostenNetto != null && payload.jahreskostenNetto !== '') {
    try {
      baselineAnnualMicro = toMicroEur(String(payload.jahreskostenNetto));
      baselineBasis = 'NET';
      baselineCurrency = 'EUR';
      baselineSource = BaselineSource.LEAD_PAYLOAD;
    } catch {
      reasonCodes.push('BASELINE_PARSE_FAILED');
    }
  } else if (payload.jahreskostenBrutto != null && payload.jahreskostenBrutto !== '') {
    try {
      baselineAnnualMicro = toMicroEur(String(payload.jahreskostenBrutto));
      baselineBasis = 'GROSS';
      baselineCurrency = 'EUR';
      baselineSource = BaselineSource.LEAD_PAYLOAD;
    } catch {
      reasonCodes.push('BASELINE_PARSE_FAILED');
    }
  }

  let readiness = ProfileReadiness.READY;
  if (!energyType || annualConsumptionKwh == null) {
    readiness = ProfileReadiness.INPUT_REQUIRED;
    reasonCodes.push(EligibilityReasonCode.MISSING_REQUIRED_FACT);
  } else if (evidence.readiness === DocumentFactsReadiness.DOCUMENT_FACTS_PARTIAL) {
    readiness = ProfileReadiness.PARTIAL;
  }

  return persistProfile(pool, {
    caseId,
    energyType,
    annualConsumptionKwh,
    supplyPointCount,
    postcode,
    meteringType: null,
    currentSupplier,
    baselineAnnualMicro,
    baselineBasis,
    baselineCurrency,
    baselineSource,
    readiness,
    reasonCodes,
    evidence,
    at,
  });
}

async function persistProfile(pool, p) {
  const fp = fingerprintPayload({
    caseId: p.caseId,
    energyType: p.energyType,
    annualConsumptionKwh: p.annualConsumptionKwh != null ? String(p.annualConsumptionKwh) : null,
    supplyPointCount: p.supplyPointCount,
    postcode: p.postcode,
    meteringType: p.meteringType,
    currentSupplier: p.currentSupplier,
    baselineAnnualMicro: p.baselineAnnualMicro != null ? String(p.baselineAnnualMicro) : null,
    baselineBasis: p.baselineBasis,
    baselineCurrency: p.baselineCurrency,
    baselineSource: p.baselineSource,
    readiness: p.readiness,
  });

  const { rows: cur } = await pool.query(
    `SELECT * FROM ops.energy_profiles WHERE case_id = $1 AND is_current = true`,
    [p.caseId],
  );
  if (cur[0] && cur[0].fingerprint === fp) {
    return {
      ok: true,
      profile: rowToProfile(cur[0]),
      reused: true,
      reasonCodes: p.reasonCodes || [],
      evidence: p.evidence,
    };
  }

  const nextRev = cur[0] ? Number(cur[0].revision) + 1 : 1;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (cur[0]) {
      await client.query(
        `UPDATE ops.energy_profiles SET is_current = false WHERE id = $1`,
        [cur[0].id],
      );
    }
    const { rows } = await client.query(
      `INSERT INTO ops.energy_profiles
        (case_id, revision, fingerprint, energy_type, annual_consumption_kwh, supply_point_count,
         postcode, metering_type, current_supplier, baseline_annual_micro, baseline_basis,
         baseline_currency, baseline_source, readiness, is_current)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true)
       RETURNING *`,
      [
        p.caseId,
        nextRev,
        fp,
        p.energyType,
        p.annualConsumptionKwh != null ? String(p.annualConsumptionKwh) : null,
        p.supplyPointCount,
        p.postcode,
        p.meteringType,
        p.currentSupplier,
        p.baselineAnnualMicro != null ? String(p.baselineAnnualMicro) : null,
        p.baselineBasis,
        p.baselineCurrency,
        p.baselineSource,
        p.readiness,
      ],
    );
    await client.query('COMMIT');
    return {
      ok: true,
      profile: rowToProfile(rows[0]),
      reused: false,
      reasonCodes: p.reasonCodes || [],
      evidence: p.evidence,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function rowToProfile(row) {
  return {
    id: row.id,
    caseId: row.case_id,
    revision: row.revision,
    fingerprint: row.fingerprint,
    energyType: row.energy_type,
    annualConsumptionKwh: row.annual_consumption_kwh != null ? BigInt(row.annual_consumption_kwh) : null,
    supplyPointCount: row.supply_point_count,
    postcode: row.postcode,
    meteringType: row.metering_type,
    currentSupplier: row.current_supplier,
    baselineAnnualMicro: row.baseline_annual_micro != null ? BigInt(row.baseline_annual_micro) : null,
    baselineBasis: row.baseline_basis,
    baselineCurrency: row.baseline_currency,
    baselineSource: row.baseline_source,
    readiness: row.readiness,
    isCurrent: row.is_current,
    createdAt: row.created_at,
  };
}

export async function getCurrentEnergyProfile(pool, caseId) {
  const { rows } = await pool.query(
    `SELECT * FROM ops.energy_profiles WHERE case_id = $1 AND is_current = true`,
    [caseId],
  );
  return rows[0] ? rowToProfile(rows[0]) : null;
}
