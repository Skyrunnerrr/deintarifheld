/**
 * Public offer API — token capability only.
 * No Case/Lead/Workflow IDs. Client cannot set price/tariff/savings/approval.
 */
import {
  createLocalOutboxPool,
  getPublicOfferView,
  acceptOffer,
  rejectOffer,
} from '@deintarifheld/db';

export const runtime = 'nodejs';

function getPool() {
  const url = process.env.DTH_A8_DATABASE_URL || process.env.DTH_A1_DATABASE_URL;
  if (!url || !/127\.0\.0\.1|localhost/.test(url)) return null;
  return createLocalOutboxPool(url);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store, private',
      'x-robots-tag': 'noindex, nofollow',
      'referrer-policy': 'no-referrer',
    },
  });
}

const FORBIDDEN_CLIENT_FIELDS = [
  'price', 'savings', 'tariff', 'tariff_id', 'tariffId', 'supplier',
  'approval', 'validity', 'evaluation', 'recipient', 'email',
  'annual_cost', 'control_version', 'offer_revision',
];

export async function GET(req) {
  const pool = getPool();
  if (!pool) return json({ ok: false, code: 'UNAVAILABLE' }, 503);
  const url = new URL(req.url);
  const token = url.searchParams.get('t') || url.searchParams.get('token') || '';
  if (!token || token.length > 200) return json({ ok: false, code: 'INVALID_TOKEN' }, 400);
  const view = await getPublicOfferView(pool, token);
  if (!view.ok) {
    const status = view.code === 'EXPIRED_TOKEN' || view.code === 'SUPERSEDED_TOKEN' ? 410 : 404;
    return json({ ok: false, code: view.code }, status);
  }
  return json(view);
}

export async function POST(req) {
  const pool = getPool();
  if (!pool) return json({ ok: false, code: 'UNAVAILABLE' }, 503);
  const ctype = req.headers.get('content-type') || '';
  if (!ctype.includes('application/json')) {
    return json({ ok: false, code: 'UNSUPPORTED_MEDIA' }, 415);
  }
  let body;
  try {
    const text = await req.text();
    if (text.length > 4096) return json({ ok: false, code: 'PAYLOAD_TOO_LARGE' }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, code: 'INVALID_JSON' }, 400);
  }
  for (const key of FORBIDDEN_CLIENT_FIELDS) {
    if (body[key] != null) return json({ ok: false, code: 'CLIENT_AUTHORITY_REJECTED' }, 400);
  }
  const token = String(body.token || body.t || '');
  const action = String(body.action || 'accept');
  if (action === 'reject') {
    const result = await rejectOffer(pool, { token });
    if (!result.ok) return json({ ok: false, code: result.code }, 409);
    return json({ ok: true, decision: 'REJECT' });
  }
  const optionId = body.option_id || body.optionId || undefined;
  const result = await acceptOffer(pool, { token, optionId });
  if (!result.ok) return json({ ok: false, code: result.code }, 409);
  return json({ ok: true, decision: 'ACCEPT', duplicate: result.duplicate === true });
}
