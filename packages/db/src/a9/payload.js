/**
 * Deterministic A9 provider payload. Copies accepted A8 + sourced facts only.
 * Never maps meter_number → malo_id. Never invents dates.
 */
import { createHash } from 'node:crypto';
import { A9_PAYLOAD_VERSION, SwitchFieldCode } from '@deintarifheld/shared';

function latestFact(facts, code) {
  const rows = (facts || []).filter((f) => f.field_code === code || f.fieldCode === code);
  return rows.length ? rows[0] : null;
}

export function buildSwitchPayload({ accepted, facts, policy }) {
  const malo = latestFact(facts, SwitchFieldCode.MALO_ID);
  const meter = latestFact(facts, SwitchFieldCode.METER_NUMBER);
  const company = latestFact(facts, SwitchFieldCode.COMPANY_NAME);
  const email = latestFact(facts, SwitchFieldCode.CONTACT_EMAIL);
  const energy = latestFact(facts, SwitchFieldCode.ENERGY_TYPE);
  const tariff = latestFact(facts, SwitchFieldCode.TARIFF_VERSION_ID);
  const product = latestFact(facts, SwitchFieldCode.PRODUCT_CODE);
  const supplier = latestFact(facts, SwitchFieldCode.SUPPLIER_NAME);
  const spc = latestFact(facts, SwitchFieldCode.SUPPLY_POINT_COUNT);
  const start = latestFact(facts, SwitchFieldCode.REQUESTED_START);

  const sources = {};
  const set = (key, fact, fallbackValue, fallbackSource) => {
    if (fact) {
      sources[key] = fact.source || fact.fact_source;
      return fact.value_text || fact.valueText;
    }
    if (fallbackValue != null && fallbackSource) {
      sources[key] = fallbackSource;
      return fallbackValue;
    }
    return null;
  };

  const payload = {
    schema: 'A9SwitchPayloadV1',
    payload_version: policy?.payloadVersion || A9_PAYLOAD_VERSION,
    provider_code: policy?.providerCode,
    company_name: set('company_name', company, accepted.companyName, 'A2_INTAKE'),
    contact_email: set('contact_email', email, accepted.contactEmail, 'A2_INTAKE'),
    energy_type: set('energy_type', energy, accepted.energyType, 'A8_ACCEPTED_OFFER'),
    tariff_version_id: set('tariff_version_id', tariff, accepted.tariffVersionId, 'A8_ACCEPTED_OFFER'),
    product_code: set('product_code', product, accepted.productCode, 'A8_ACCEPTED_OFFER'),
    supplier_name: set('supplier_name', supplier, accepted.supplierName, 'A8_ACCEPTED_OFFER'),
    malo_id: set('malo_id', malo, null, null),
    meter_number: meter ? (meter.value_text || meter.valueText) : null,
    supply_point_count: Number(set('supply_point_count', spc, accepted.supplyPointCount || 1, 'A8_ACCEPTED_OFFER')),
    requested_start: set('requested_start', start, null, null),
    sources,
  };

  if (payload.meter_number && payload.malo_id && payload.meter_number === payload.malo_id) {
    const err = new Error('IDENTIFIER_TYPE_COLLAPSE');
    err.code = 'IDENTIFIER_TYPE_COLLAPSE';
    throw err;
  }
  return payload;
}

export function hashSwitchPayload(payload) {
  const { sources, ...rest } = payload;
  const canonical = JSON.stringify({
    ...rest,
    sources: sources || {},
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export function validateSwitchPayload(payload, requiredFields = []) {
  const missing = [];
  const map = {
    COMPANY_NAME: payload.company_name,
    CONTACT_EMAIL: payload.contact_email,
    ENERGY_TYPE: payload.energy_type,
    TARIFF_VERSION_ID: payload.tariff_version_id,
    MALO_ID: payload.malo_id,
  };
  for (const f of requiredFields) {
    if (!map[f]) missing.push(f);
  }
  if (!payload.sources || typeof payload.sources !== 'object') {
    return { ok: false, code: 'MISSING_PROVENANCE', missing };
  }
  const provenKeys = ['company_name', 'contact_email', 'energy_type', 'tariff_version_id'];
  for (const k of provenKeys) {
    if (payload[k] && !payload.sources[k]) {
      return { ok: false, code: 'MISSING_PROVENANCE', field: k, missing };
    }
  }
  if (payload.malo_id && !payload.sources.malo_id) {
    return { ok: false, code: 'MISSING_PROVENANCE', field: 'malo_id', missing };
  }
  if (missing.length) return { ok: false, code: 'MISSING_REQUIRED', missing };
  return { ok: true };
}
