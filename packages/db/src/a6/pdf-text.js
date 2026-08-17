/**
 * Minimal synthetic PDF text-stream extractor.
 * Supports (literal) Tj and simple TJ arrays. No pdf-parse dependency.
 */
import { TEST_MAX_EXTRACTED_TEXT_CHARS } from '@deintarifheld/shared';

/**
 * @param {Buffer|Uint8Array} bytes
 * @returns {{ ok: true, text: string, textExtracted: boolean, ocrStatus: string } | { ok: false, code: string }}
 */
export function extractTextFromPdfBytes(bytes) {
  if (!bytes || bytes.length < 5) {
    return { ok: false, code: 'MALFORMED_PDF' };
  }
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (!buf.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    return { ok: false, code: 'NOT_PDF' };
  }

  let raw;
  try {
    raw = buf.toString('latin1');
  } catch {
    return { ok: false, code: 'MALFORMED_PDF' };
  }

  const parts = [];

  // (text) Tj  — handle escaped parens \( \) \\
  const tjRe = /\(((?:\\.|[^\\)])*)\)\s*Tj/g;
  let m;
  while ((m = tjRe.exec(raw)) !== null) {
    parts.push(unescapePdfString(m[1]));
  }

  // TJ arrays: [(text) ...] TJ
  const tjArrRe = /\[([^\]]*)\]\s*TJ/g;
  while ((m = tjArrRe.exec(raw)) !== null) {
    const inner = m[1];
    const litRe = /\(((?:\\.|[^\\)])*)\)/g;
    let lm;
    while ((lm = litRe.exec(inner)) !== null) {
      parts.push(unescapePdfString(lm[1]));
    }
  }

  const text = parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, TEST_MAX_EXTRACTED_TEXT_CHARS);

  if (!text) {
    return {
      ok: true,
      text: '',
      textExtracted: false,
      ocrStatus: 'REQUIRED',
      code: 'OCR_REQUIRED',
    };
  }

  return {
    ok: true,
    text,
    textExtracted: true,
    ocrStatus: 'NOT_REQUIRED',
  };
}

function unescapePdfString(s) {
  return String(s || '')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}
