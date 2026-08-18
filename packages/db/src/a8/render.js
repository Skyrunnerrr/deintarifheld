/**
 * Deterministic German A8 offer templates (HTML + text).
 * Escape supplier/tariff/company. No XSS. No invented legal clauses.
 */
import { createHash } from 'node:crypto';
import {
  A8_TEMPLATE_ID,
  A8_TEMPLATE_VERSION,
  MessagePurpose,
  SYNTHETIC_OFFER_LEGAL_TEXT_DE,
} from '@deintarifheld/shared';
import { formatMicroEurDe, escapeHtml, priceBasisLabelDe } from './format.js';

const BANNER = 'TEST_ONLY / SYNTHETISCH / nicht kundenlivetauglich';

function microToBigInt(v) {
  if (v == null || v === '') return null;
  return typeof v === 'bigint' ? v : BigInt(v);
}

function savingsBlock(opt) {
  const ongoing = microToBigInt(opt.savings_ongoing_micro ?? opt.savingsOngoingMicro);
  const first = microToBigInt(opt.savings_first_year_micro ?? opt.savingsFirstYearMicro);
  const lines = [];
  if (ongoing == null) {
    lines.push('kein belastbarer Kostenvergleich (laufend)');
  } else if (ongoing < 0n) {
    lines.push(`Zusätzliche Kosten (laufend): ${formatMicroEurDe(-ongoing)}`);
  } else {
    lines.push(`Differenz zu bisher (laufend): ${formatMicroEurDe(ongoing)}`);
  }
  if (first == null) {
    // omit first-year comparison when unknown
  } else if (first < 0n) {
    lines.push(`Zusätzliche Kosten (erstes Jahr): ${formatMicroEurDe(-first)}`);
  } else if (first !== ongoing) {
    lines.push(`Differenz zu bisher (erstes Jahr): ${formatMicroEurDe(first)}`);
  }
  return lines;
}

function optionLines(opt, { html = false } = {}) {
  const supplier = html ? escapeHtml(opt.supplier_name || opt.supplierName) : String(opt.supplier_name || opt.supplierName || '');
  const tariff = html ? escapeHtml(opt.product_code || opt.tariff_name || opt.productCode) : String(opt.product_code || opt.tariff_name || opt.productCode || '');
  const energy = html ? escapeHtml(opt.energy_type || opt.energyType) : String(opt.energy_type || opt.energyType || '');
  const basis = priceBasisLabelDe(opt.price_basis || opt.priceBasis);
  const ongoing = microToBigInt(opt.ongoing_annual_micro ?? opt.ongoingAnnualMicro);
  const firstYear = microToBigInt(opt.first_year_annual_micro ?? opt.firstYearAnnualMicro);
  const lines = [
    `Anbieter: ${supplier}`,
    `Tarif: ${tariff}`,
    `Energieart: ${energy}`,
    ongoing != null ? `Jahreskosten laufend (${basis}): ${formatMicroEurDe(ongoing)}` : null,
  ];
  if (firstYear != null && ongoing != null && firstYear !== ongoing) {
    lines.push(`Jahreskosten erstes Jahr (${basis}): ${formatMicroEurDe(firstYear)}`);
    lines.push('Das erste Jahr ist nicht der dauerhafte Preis.');
  }
  lines.push(...savingsBlock(opt));
  return lines.filter(Boolean);
}

export function buildPublicOfferViewModel({ revision, options, validUntil, legalText } = {}) {
  const opts = (options || []).map((o) => {
    const ongoing = microToBigInt(o.ongoing_annual_micro);
    const firstYear = microToBigInt(o.first_year_annual_micro);
    const savingsOngoing = microToBigInt(o.savings_ongoing_micro);
    return {
      optionId: o.id,
      supplierName: o.supplier_name,
      tariffName: o.product_code,
      energyType: o.energy_type,
      priceBasis: o.price_basis,
      priceBasisLabel: priceBasisLabelDe(o.price_basis),
      ongoingAnnualFormatted: ongoing != null ? formatMicroEurDe(ongoing) : null,
      firstYearAnnualFormatted: firstYear != null ? formatMicroEurDe(firstYear) : null,
      firstYearDiffers: firstYear != null && ongoing != null && firstYear !== ongoing,
      savingsUnknown: savingsOngoing == null,
      additionalCostOngoingFormatted:
        savingsOngoing != null && savingsOngoing < 0n ? formatMicroEurDe(-savingsOngoing) : null,
      comparisonOngoingFormatted:
        savingsOngoing != null && savingsOngoing >= 0n ? formatMicroEurDe(savingsOngoing) : null,
    };
  });
  return {
    banner: BANNER,
    legalText: legalText || SYNTHETIC_OFFER_LEGAL_TEXT_DE,
    validUntil: validUntil || revision?.valid_until || null,
    synthetic: true,
    environmentMarker: 'TEST_ONLY',
    customerDeliverableLive: false,
    options: opts,
  };
}

export function renderOfferText({
  purpose = MessagePurpose.OFFER_DELIVERY,
  ansprechpartner,
  firma,
  offerUrl,
  snapshot,
  options,
  validUntil,
  legalText,
} = {}) {
  const name = String(ansprechpartner || 'Interessent').replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
  const company = String(firma || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
  const opts = options || snapshot?.options || [];
  const intro = purpose === MessagePurpose.OFFER_FOLLOWUP
    ? 'kurze Erinnerung an Ihr Testangebot:'
    : purpose === MessagePurpose.OFFER_ACCEPTANCE_CONFIRMATION
      ? 'wir haben Ihre Annahme des Testangebots registriert.'
      : 'anbei Ihr Testangebot (unverbindlich):';
  const bodyLines = [
    `Guten Tag ${name}${company ? ` (${company})` : ''},`,
    '',
    intro,
    '',
    BANNER,
    '',
  ];
  opts.forEach((opt, i) => {
    bodyLines.push(`Option ${i + 1}`);
    bodyLines.push(...optionLines(opt, { html: false }));
    bodyLines.push('');
  });
  if (validUntil) {
    bodyLines.push(`Gültig bis: ${new Date(validUntil).toISOString()}`);
  }
  if (offerUrl && purpose !== MessagePurpose.OFFER_ACCEPTANCE_CONFIRMATION) {
    bodyLines.push('');
    bodyLines.push('Angebot ansehen / annehmen:');
    bodyLines.push(offerUrl);
  }
  bodyLines.push('');
  bodyLines.push(legalText || SYNTHETIC_OFFER_LEGAL_TEXT_DE);
  bodyLines.push('');
  bodyLines.push('Freundliche Grüße');
  bodyLines.push('Ihr DeinTarifheld-Team (TEST)');
  const bodyText = bodyLines.join('\n');
  const subject = purpose === MessagePurpose.OFFER_FOLLOWUP
    ? 'Erinnerung: Testangebot — DeinTarifheld [TEST_ONLY]'
    : purpose === MessagePurpose.OFFER_ACCEPTANCE_CONFIRMATION
      ? 'Testangebot angenommen — DeinTarifheld [TEST_ONLY]'
      : 'Ihr Testangebot — DeinTarifheld [TEST_ONLY]';
  return {
    templateId: A8_TEMPLATE_ID,
    templateVersion: A8_TEMPLATE_VERSION,
    subject,
    bodyText,
    contentHash: createHash('sha256').update(`${subject}\n${bodyText}`).digest('hex'),
  };
}

export function renderOfferHtml({ snapshot, options, legalText, validUntil } = {}) {
  const opts = options || snapshot?.options || [];
  const blocks = opts.map((opt, i) => {
    const lines = optionLines(opt, { html: true });
    return `<section><h2>Option ${i + 1}</h2><p>${lines.map((l) => escapeHtml(l).replace(/&lt;\/?.*?&gt;/g, '') ? l : l).join('<br/>')}</p></section>`;
  });
  // optionLines already escaped when html:true — join as HTML breaks
  const htmlBlocks = opts.map((opt, i) => {
    const lines = optionLines(opt, { html: true });
    return `<section><h2>Option ${escapeHtml(String(i + 1))}</h2><p>${lines.join('<br/>')}</p></section>`;
  });
  void blocks;
  const until = validUntil ? escapeHtml(String(validUntil)) : '';
  return [
    '<article>',
    `<p><strong>${escapeHtml(BANNER)}</strong></p>`,
    htmlBlocks.join('\n'),
    until ? `<p>Gültig bis: ${until}</p>` : '',
    `<p>${escapeHtml(legalText || SYNTHETIC_OFFER_LEGAL_TEXT_DE)}</p>`,
    '</article>',
  ].filter(Boolean).join('\n');
}
