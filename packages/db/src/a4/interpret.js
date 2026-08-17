/**
 * Bounded deterministic reply extraction. A3 remains normalization authority.
 * LIVE_AI_CALLS=0 — AI adapter contract only (not implemented).
 */
import { FieldCode, OBSERVATION_FIELD_ALLOWLIST } from '@deintarifheld/shared';

const LABEL_PATTERNS = [
  { re: /(?:stromverbrauch|jahresverbrauch\s*strom|verbrauch\s*strom)\s*[:=]\s*([^\n\r]+)/i, field: FieldCode.VERBRAUCH_STROM },
  { re: /(?:gasverbrauch|jahresverbrauch\s*gas|verbrauch\s*gas)\s*[:=]\s*([^\n\r]+)/i, field: FieldCode.VERBRAUCH_GAS },
  { re: /(?:standorte|anzahl\s*(?:der\s*)?standorte)\s*[:=]\s*([^\n\r]+)/i, field: FieldCode.STANDORTE },
  { re: /(?:energieart)\s*[:=]\s*([^\n\r]+)/i, field: FieldCode.ENERGIEART },
];

function stripQuotedHistory(text) {
  const lines = String(text || '').split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    if (/^>/.test(line)) break;
    if (/^Am .+ schrieb /.test(line)) break;
    if (/^On .+ wrote:/.test(line)) break;
    if (/^-{2,}\s*Original Message/.test(line)) break;
    if (/^Von: .+Gesendet:/i.test(line)) break;
    out.push(line);
  }
  return out.join('\n').trim();
}

function isAutomated({ headers = {}, subject = '', text = '' }) {
  const auto = String(headers['auto-submitted'] || headers['Auto-Submitted'] || '').toLowerCase();
  if (auto && auto !== 'no') return true;
  if (/^mailer-daemon@/i.test(headers.from || '')) return true;
  if (/out of office|abwesenheitsnotiz|automatic reply/i.test(subject + ' ' + text)) return true;
  return false;
}

/**
 * @param {{ text: string, headers?: object, subject?: string, expectedFields: string[] }} input
 */
export function interpretMissingInfoReply(input) {
  const expected = new Set((input.expectedFields || []).filter((f) => OBSERVATION_FIELD_ALLOWLIST.includes(f)));
  const text = stripQuotedHistory(input.text || '');
  if (isAutomated(input)) {
    return { candidates: [], unresolved: [...expected], requiresHumanReview: false, automatedReply: true };
  }

  const candidates = [];
  const found = new Set();

  for (const { re, field } of LABEL_PATTERNS) {
    if (!expected.has(field)) continue;
    const m = text.match(re);
    if (m) {
      candidates.push({
        fieldCode: field,
        rawCandidateValue: m[1].trim().slice(0, 80),
        confidence: 'HIGH',
        evidenceSpan: m[0].slice(0, 120),
      });
      found.add(field);
    }
  }

  // Single expected consumption field + bare number body
  if (candidates.length === 0 && expected.size === 1) {
    const only = [...expected][0];
    const bare = text.trim();
    if (
      (only === FieldCode.VERBRAUCH_STROM || only === FieldCode.VERBRAUCH_GAS) &&
      /^\d+\s*(kwh)?$/i.test(bare)
    ) {
      candidates.push({
        fieldCode: only,
        rawCandidateValue: bare.replace(/\s*kwh$/i, '').trim(),
        confidence: 'HIGH',
        evidenceSpan: bare.slice(0, 40),
      });
      found.add(only);
    }
    if (only === FieldCode.STANDORTE && /^(1|2–5|2-5|6\+)$/.test(bare)) {
      candidates.push({
        fieldCode: only,
        rawCandidateValue: bare === '2-5' ? '2–5' : bare,
        confidence: 'HIGH',
        evidenceSpan: bare,
      });
      found.add(only);
    }
  }

  const unresolved = [...expected].filter((f) => !found.has(f));
  const injectionAttempt = /ignore (all )?previous|disable safeguards|send all (customer )?data|run this sql/i.test(text);
  const requiresHumanReview = unresolved.length === expected.size && text.length > 0 && candidates.length === 0;

  return {
    candidates,
    unresolved,
    requiresHumanReview,
    automatedReply: false,
    injectionAttempt,
    // Future AI adapter: interpretMissingInfoReplyAi — NOT USED in E2
  };
}

/** Future AI boundary — contract only, never called in A4 E2. */
export function interpretMissingInfoReplyAi() {
  throw new Error('AI_REPLY_INTERPRETATION_NOT_IMPLEMENTED');
}
