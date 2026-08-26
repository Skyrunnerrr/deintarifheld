/**
 * Supabase TOTP enroll QR presentation — official format is data-URL for <img src>.
 * Never use dangerouslySetInnerHTML for qr_code.
 */

export function resolveTotpQrPresentation(qrCode) {
  if (qrCode == null || qrCode === '') {
    return { kind: 'missing' };
  }
  const value = String(qrCode).trim();
  if (value.startsWith('data:image/')) {
    return { kind: 'img', src: value };
  }
  if (value.startsWith('otpauth://')) {
    return { kind: 'uri-only', uri: value };
  }
  if (value.startsWith('<svg') || value.startsWith('<?xml')) {
    const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`;
    return { kind: 'img', src: encoded };
  }
  return { kind: 'img', src: value };
}

export function hasDangerousQrInnerHtml(html) {
  return /dangerouslySetInnerHTML/.test(String(html || ''));
}
