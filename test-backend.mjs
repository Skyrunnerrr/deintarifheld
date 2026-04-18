import https from 'https';

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbxHMmnt2xOqaezXHzJTEo2uABRuWoT4J1xpi4Ui_lh7v_18udKMZQ3PfhxcG6ZqnsA6/exec';

const payload = JSON.stringify({
  name: 'Test Nutzer',
  email: 'wunderland50@gmail.com',
  phone: '+49 89 123456',
  motivation: 'Test der Backend-Integration - bitte ignorieren',
  gdpr: true,
  page_source: 'career',
  timestamp: new Date().toISOString()
});

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

async function main() {
  console.log('Sende POST an Webhook...');
  let res = await request(WEBHOOK_URL, 'POST', payload);
  console.log('Step 1 - Status:', res.status);

  // Follow redirects – bei GAS muss der Redirect als GET gefolgt werden
  // Die POST-Daten wurden serverseitig bereits verarbeitet
  let hops = 0;
  while ((res.status === 301 || res.status === 302) && res.location && hops < 5) {
    console.log('Redirect zu:', res.location.substring(0, 80) + '...');
    res = await request(res.location, 'GET', null);
    console.log('Step', 2 + hops, '- Status:', res.status);
    hops++;
  }

  console.log('\nFinale Antwort:');
  try {
    const json = JSON.parse(res.body);
    console.log(JSON.stringify(json, null, 2));
    if (json.success) {
      console.log('\n✅ Backend funktioniert! Order ID:', json.orderId || json.order_id || '–');
      console.log('✅ E-Mail wurde an wunderland50@gmail.com gesendet.');
    } else {
      console.log('\n❌ Backend-Fehler:', json.error || json.message || 'Unbekannt');
    }
  } catch {
    console.log(res.body.substring(0, 500));
  }
}

main().catch(console.error);
