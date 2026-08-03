/**
 * Minimal RS256 JWT helpers using Node built-in crypto only.
 * No third-party JWT packages. Private keys must stay ephemeral in tests.
 */
import { createSign, createVerify, createPublicKey } from 'node:crypto';

export function base64UrlEncode(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return b.toString('base64url');
}

export function base64UrlDecodeToBuffer(str) {
  return Buffer.from(str, 'base64url');
}

export function base64UrlDecodeToString(str) {
  return base64UrlDecodeToBuffer(str).toString('utf8');
}

export function encodeJwtPart(obj) {
  return base64UrlEncode(Buffer.from(JSON.stringify(obj), 'utf8'));
}

/**
 * Sign a JWT with RS256. privateKeyPem must not be logged or committed.
 */
export function signRs256Jwt({ header, payload, privateKeyPem }) {
  const h = encodeJwtPart(header);
  const p = encodeJwtPart(payload);
  const data = `${h}.${p}`;
  const signer = createSign('RSA-SHA256');
  signer.update(data);
  signer.end();
  const sig = signer.sign(privateKeyPem);
  return `${data}.${base64UrlEncode(sig)}`;
}

export function parseJwtUnverified(token) {
  if (typeof token !== 'string' || !token) {
    return { ok: false, reason: 'empty' };
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { ok: false, reason: 'parts' };
  }
  const [hB64, pB64, sB64] = parts;
  if (!hB64 || !pB64) {
    return { ok: false, reason: 'empty_part' };
  }
  try {
    const header = JSON.parse(base64UrlDecodeToString(hB64));
    const payload = JSON.parse(base64UrlDecodeToString(pB64));
    return {
      ok: true,
      header,
      payload,
      signingInput: `${hB64}.${pB64}`,
      signatureB64: sB64 || '',
      parts,
    };
  } catch {
    return { ok: false, reason: 'json' };
  }
}

export function verifyRs256Signature({ signingInput, signatureB64, publicKeyPem }) {
  if (!signatureB64) return false;
  const verifier = createVerify('RSA-SHA256');
  verifier.update(signingInput);
  verifier.end();
  try {
    return verifier.verify(publicKeyPem, base64UrlDecodeToBuffer(signatureB64));
  } catch {
    return false;
  }
}

/** Export JWK-like public key material from SPKI PEM (n/e for RSA). */
export function publicKeyPemToJwk(publicKeyPem, kid, alg = 'RS256') {
  const key = createPublicKey(publicKeyPem);
  const jwk = key.export({ format: 'jwk' });
  return {
    kty: jwk.kty,
    kid,
    use: 'sig',
    alg,
    n: jwk.n,
    e: jwk.e,
  };
}

export function jwkToPublicKeyPem(jwk) {
  const key = createPublicKey({ key: jwk, format: 'jwk' });
  return key.export({ type: 'spki', format: 'pem' });
}
