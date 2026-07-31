/**
 * HISTORICAL helper for the former Google Apps Script backend.
 * Not part of the Phase B / Checkdomain production cutover path.
 * Requires an explicit WEBHOOK_URL — no baked-in script.google.com default.
 */
import https from 'https';

const WEBHOOK_URL = process.env.WEBHOOK_URL
if (!WEBHOOK_URL) {
  console.error('HISTORICAL test-backend.mjs: set WEBHOOK_URL explicitly or use npm run leads:smoke* against the Vercel API')
  process.exit(2)
}
if (/script\.google\.com/i.test(WEBHOOK_URL)) {
  console.error('HISTORICAL test-backend.mjs: refusing script.google.com targets in cutover-era runs')
  process.exit(3)
}

function buildPayloadFor(source) {
  const now = new Date().toISOString();
  const formLoadedAt = Date.now() - 15000;

  if (source === 'hero-funnel') {
    return {
      firstName: 'Max',
      email: 'wunderland50@gmail.com',
      phone: '+49 89 123456',
      provider: 'Test Anbieter',
      usage: '3200',
      zip: '80331',
      type: 'strom',
      gdpr: true,
      page_source: 'hero-funnel',
      _formLoadedAt: formLoadedAt,
      _recaptchaToken: 'TEST_TOKEN',
      timestamp: now,
    };
  }

  if (source === 'main_funnel') {
    return {
      name: 'Max Mustermann',
      email: 'wunderland50@gmail.com',
      phone: '+49 89 123456',
      provider: 'Test Anbieter',
      consumption: '3500',
      zip: '80331',
      type: 'strom',
      gdpr: true,
      page_source: 'main_funnel',
      _formLoadedAt: formLoadedAt,
      _recaptchaToken: 'TEST_TOKEN',
      timestamp: now,
    };
  }

  if (source === 'unternehmen') {
    return {
      firma: 'Test GmbH',
      ansprechpartner: 'Max Muster',
      email: 'wunderland50@gmail.com',
      telefon: '+49 89 123456',
      plz: '80331',
      energieart: 'strom',
      verbrauchStrom: '50000',
      standorte: '2',
      gdpr: true,
      page_source: 'unternehmen',
      _formLoadedAt: formLoadedAt,
      _recaptchaToken: 'TEST_TOKEN',
      timestamp: now,
    };
  }

  return {
    name: 'Test Nutzer',
    email: 'wunderland50@gmail.com',
    phone: '+49 89 123456',
    motivation: 'Test der Backend-Integration - bitte ignorieren',
    gdpr: true,
    page_source: 'career',
    _formLoadedAt: formLoadedAt,
    _recaptchaToken: 'TEST_TOKEN',
    timestamp: now,
  };
}

async function request(urlStr, method, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: body ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      } : {}
    };
    let responseBody = '';
    const req = https.request(opts, res => {
      res.on('data', d => responseBody += d);
      res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location, body: responseBody }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function testSource(source) {
  const payload = JSON.stringify(buildPayloadFor(source));
  console.log(`\n=== Teste Quelle: ${source} ===`);
  let res = await request(WEBHOOK_URL, 'POST', payload);
  console.log('Step 1 - Status:', res.status);

  let hops = 0;
  while ((res.status === 301 || res.status === 302) && res.location && hops < 5) {
    console.log('Redirect zu:', res.location.substring(0, 80) + '...');
    res = await request(res.location, 'GET', null);
    console.log('Step', 2 + hops, '- Status:', res.status);
    hops++;
  }

  try {
    const json = JSON.parse(res.body);
    console.log(JSON.stringify(json, null, 2));
    const orderId = json.orderId || json.order_id || '';
    const isMaskedSuccess = orderId === 'TH-X-00000000-XXXXX' || orderId === 'ALREADY_SUBMITTED';

    if (json.success && !isMaskedSuccess) {
      console.log(`✅ ${source}: gespeichert (${orderId || 'ohne ID'})`);
      return true;
    }

    if (json.success && isMaskedSuccess) {
      console.log(`⚠️ ${source}: maskierte Erfolgsantwort (nicht normal gespeichert)`);
      return false;
    }

    console.log(`❌ ${source}: Backend-Fehler -`, json.error || json.message || 'Unbekannt');
    return false;
  } catch {
    console.log(`❌ ${source}: Keine JSON-Antwort`, res.body.substring(0, 500));
    return false;
  }
}

async function main() {
  console.log('Sende Multi-Source Tests an Webhook...');

  const sources = ['hero-funnel', 'main_funnel', 'unternehmen', 'career'];
  let okCount = 0;

  for (const source of sources) {
    const ok = await testSource(source);
    if (ok) okCount++;
  }

  console.log(`\nErgebnis: ${okCount}/${sources.length} Quellen erfolgreich gespeichert.`);
}

main().catch(console.error);
