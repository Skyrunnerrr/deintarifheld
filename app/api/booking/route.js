/**
 * Public booking API — token capability only.
 * No Case/Lead/Workflow IDs exposed. No client calendar/time authority.
 * Booking job execution happens via A1 worker (not inline business processing).
 */
import {
  createLocalOutboxPool,
  getPublicBookingView,
  submitSlotSelection,
} from '@deintarifheld/db';

export const runtime = 'nodejs';

function getPool() {
  const url = process.env.DTH_A5_DATABASE_URL || process.env.DTH_A1_DATABASE_URL;
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

export async function GET(req) {
  const pool = getPool();
  if (!pool) return json({ ok: false, code: 'UNAVAILABLE' }, 503);
  const url = new URL(req.url);
  const token = url.searchParams.get('t') || url.searchParams.get('token') || '';
  if (!token || token.length > 200) return json({ ok: false, code: 'INVALID_TOKEN' }, 400);
  const view = await getPublicBookingView(pool, token);
  if (!view.ok) {
    const status = view.code === 'EXPIRED_TOKEN' || view.code === 'SUPERSEDED_TOKEN' ? 410 : 404;
    return json({ ok: false, code: view.code }, status);
  }
  return json({
    ok: true,
    status: view.status,
    bookingRef: view.bookingRef,
    purpose: view.purpose,
    timezone: view.timezone,
    slots: view.slots || [],
  });
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

  if (
    body.start_at || body.end_at || body.calendar_id || body.calendarId ||
    body.duration || body.provider || body.attendee || body.timezone ||
    body.returnUrl || body.redirect
  ) {
    return json({ ok: false, code: 'CLIENT_AUTHORITY_REJECTED' }, 400);
  }

  const token = String(body.token || body.t || '');
  const slotId = String(body.slot_id || body.slotId || '');
  if (!token || !slotId || token.length > 200 || slotId.length > 80) {
    return json({ ok: false, code: 'INVALID_INPUT' }, 400);
  }

  const sel = await submitSlotSelection(pool, { token, slotId });
  if (!sel.ok && !sel.duplicate) {
    const status = ['EXPIRED_TOKEN', 'SUPERSEDED_TOKEN', 'INVALID_TOKEN'].includes(sel.code) ? 410 : 409;
    return json({ ok: false, code: sel.code }, status);
  }

  return json({
    ok: true,
    status: sel.alreadyBooked ? 'BOOKED' : 'BOOKING_ACCEPTED',
  });
}
