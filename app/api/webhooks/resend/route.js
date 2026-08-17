/**
 * Resend inbound/delivery webhook — thin verify + durable accept.
 * Uses raw body for signature verification (Resend/Svix requirement).
 * No live provider registration in A4 E2.
 */
import { createLocalOutboxPool, acceptInboundWebhook, createMockEmailProvider } from '@deintarifheld/db';

export const runtime = 'nodejs';

function getPool() {
  const url = process.env.DTH_A4_DATABASE_URL || process.env.DTH_A1_DATABASE_URL;
  if (!url || !/127\.0\.0\.1|localhost/.test(url)) {
    return null;
  }
  return createLocalOutboxPool(url);
}

export async function POST(req) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return new Response(JSON.stringify({ ok: false, code: 'WEBHOOK_SECRET_MISSING' }), { status: 503 });
  }

  const rawBody = await req.text();
  if (rawBody.length > 256_000) {
    return new Response(JSON.stringify({ ok: false, code: 'PAYLOAD_TOO_LARGE' }), { status: 413 });
  }

  const headers = {
    id: req.headers.get('svix-id'),
    timestamp: req.headers.get('svix-timestamp'),
    signature: req.headers.get('svix-signature'),
    'svix-id': req.headers.get('svix-id'),
    'svix-timestamp': req.headers.get('svix-timestamp'),
    'svix-signature': req.headers.get('svix-signature'),
  };

  const pool = getPool();
  if (!pool) {
    return new Response(JSON.stringify({ ok: false, code: 'DB_UNAVAILABLE' }), { status: 503 });
  }

  try {
    const result = await acceptInboundWebhook(pool, {
      rawBody,
      headers,
      webhookSecret: secret,
      emailProvider: createMockEmailProvider(),
    });
    return new Response(JSON.stringify({ ok: result.ok, code: result.code || 'ACCEPTED' }), {
      status: result.httpStatus || (result.ok ? 200 : 400),
      headers: { 'content-type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, code: 'WEBHOOK_ERROR' }), { status: 500 });
  }
}
