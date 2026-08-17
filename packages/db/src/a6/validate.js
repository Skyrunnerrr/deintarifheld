/**
 * A6 file validation — magic bytes authority; extension is metadata only.
 */
import { TEST_MAX_DOCUMENT_BYTES } from '@deintarifheld/shared';

const PDF_MAGIC = Buffer.from('%PDF-');
const MZ_MAGIC = Buffer.from([0x4d, 0x5a]); // PE/DOS executable
const ELF_MAGIC = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);

export function detectPdfMagic(bytes) {
  if (!bytes || bytes.length < 5) return false;
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return buf.subarray(0, 5).equals(PDF_MAGIC);
}

export function sanitizeFilename(raw) {
  const s = String(raw || 'document.pdf')
    .replace(/\0/g, '')
    .replace(/[/\\]/g, '_')
    .replace(/\.\.+/g, '.')
    .trim()
    .slice(0, 180);
  if (!s || s === '.' || s === '..') return 'document.pdf';
  if (s.includes('..')) return 'document.pdf';
  return s;
}

export function assertNoPathTraversal(filename) {
  const s = String(filename || '');
  if (s.includes('\0') || s.includes('..') || s.includes('/') || s.includes('\\') || /^[a-zA-Z]:/.test(s)) {
    const err = new Error('PATH_TRAVERSAL_REJECTED');
    err.code = 'PATH_TRAVERSAL_REJECTED';
    throw err;
  }
  return true;
}

/**
 * Validate inbound bytes before storage.
 * @returns {{ ok: true, contentType: string, filenameSanitized: string } | { ok: false, code: string }}
 */
export function validateDocumentBytes({ bytes, filename, contentType, maxBytes = TEST_MAX_DOCUMENT_BYTES }) {
  try {
    assertNoPathTraversal(filename);
  } catch (err) {
    return { ok: false, code: err.code || 'PATH_TRAVERSAL_REJECTED' };
  }

  if (!bytes || !(bytes.length > 0)) {
    return { ok: false, code: 'EMPTY_FILE' };
  }
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buf.length === 0) return { ok: false, code: 'EMPTY_FILE' };
  if (buf.length > maxBytes) return { ok: false, code: 'SIZE_LIMIT_EXCEEDED' };

  // Executable signatures — never accept
  if (buf.length >= 2 && buf.subarray(0, 2).equals(MZ_MAGIC)) {
    return { ok: false, code: 'EXECUTABLE_REJECTED' };
  }
  if (buf.length >= 4 && buf.subarray(0, 4).equals(ELF_MAGIC)) {
    return { ok: false, code: 'EXECUTABLE_REJECTED' };
  }

  const isPdf = detectPdfMagic(buf);
  const claimedPdf =
    /\.pdf$/i.test(String(filename || '')) ||
    String(contentType || '').toLowerCase().includes('pdf');

  // Extension/content-type claim without magic → reject (extension not authority)
  if (claimedPdf && !isPdf) {
    return { ok: false, code: 'MAGIC_MISMATCH' };
  }
  if (!isPdf) {
    return { ok: false, code: 'UNSUPPORTED_FILE_TYPE' };
  }

  return {
    ok: true,
    contentType: 'application/pdf',
    filenameSanitized: sanitizeFilename(filename),
    byteSize: buf.length,
  };
}
