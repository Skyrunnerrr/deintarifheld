/**
 * deintarifheld.de - Lead Backend (Google Apps Script)
 * Version 4.0 - Clean + Secure + DSGVO-ready
 *
 * Ziel:
 * - Neue Leads in die richtigen 4 Tabs schreiben
 * - Je Formularbereich farbige Kundenmails senden
 * - reCAPTCHA, Consent, Sanitizing, Rate-Limit, Duplicate-Check
 */

const CFG = {
  SPREADSHEET_ID: '1UhK-UxZkqgscQLCCGjRV4diFQMxgrdFtYL8VWmEphk4',

  SENDER_EMAIL: 'kontakt@deintarifheld.de',
  SENDER_NAME: 'deintarifheld',
  ADMIN_EMAIL: 'kontakt@deintarifheld.de',

  RECAPTCHA_MIN_SCORE: 0.5,
  RECAPTCHA_ALLOWED_HOSTNAMES: ['deintarifheld.de', 'www.deintarifheld.de'],
  RECAPTCHA_ALLOWED_ACTIONS: [],
  // hard: reCAPTCHA-Fehler blockieren den Lead (Produktiv-Default)
  // soft: nur als Notfallmodus, wenn Leads trotz reCAPTCHA-Ausfall gespeichert werden sollen
  RECAPTCHA_MODE: 'hard',

  RETENTION_DAYS: 90,
  CAREER_RETENTION_MONTHS: 6,
  DELETE_HOUR: 3,

  SHEETS: {
    HERO: '⚡ Hero-Funnel',
    MAIN: '🔥 Main-Funnel',
    UNTERNEHMEN: '🏢 Unternehmen B2B',
    CAREER: '🎯 Karriere-Bewerber',
    DSGVO_LOG: '🛡 DSGVO-Protokoll',
  },

  DESIGN: {
    'hero-funnel': {
      label: 'Energievergleich',
      primary: '#D4FF3E',
      secondary: '#8AAA20',
      bg: '#F7FFF0',
      textColor: '#090B0F',
      subjectPrefix: 'Deine Tarifanfrage',
    },
    'main_funnel': {
      label: 'Tarifvergleich',
      primary: '#D4FF3E',
      secondary: '#8AAA20',
      bg: '#F7FFF0',
      textColor: '#090B0F',
      subjectPrefix: 'Deine Tarifanfrage',
    },
    'unternehmen': {
      label: 'Unternehmensanfrage',
      primary: '#FF6B2B',
      secondary: '#CC5522',
      bg: '#FFF8F5',
      textColor: '#FFFFFF',
      subjectPrefix: 'Deine B2B-Anfrage',
    },
    'career': {
      label: 'Karriere-Bewerbung',
      primary: '#0A5ADB',
      secondary: '#084BB8',
      bg: '#F5F8FF',
      textColor: '#FFFFFF',
      subjectPrefix: 'Deine Bewerbung',
    },
  },
};

const SECURITY = {
  RATE_LIMIT_MAX: 5,
  RATE_LIMIT_WINDOW_SEC: 60,

  MAX_PAYLOAD_BYTES: 10240,
  MAX_FIELD_LENGTH: 2000,
  MAX_FIELDS: 30,

  MIN_FORM_TIME_SEC: 3,
  MAX_FORM_TIME_SEC: 7200,
  HONEYPOT_FIELDS: ['website_url', 'company_fax'],

  DUPLICATE_WINDOW_SEC: 60,
};

const ALLOWED_FIELDS = {
  'hero-funnel': [
    'firstName', 'name', 'phone', 'email', 'provider', 'usage', 'zip', 'type',
    'gdpr', 'dsgvo', 'consent',
    'page_source', 'brand_theme', 'brand_color', 'form_version', 'timestamp',
    '_formLoadedAt', '_recaptchaToken', '_ip', 'page',
  ],
  'main_funnel': [
    'name', 'firstName', 'email', 'phone', 'provider', 'consumption', 'usage', 'zip', 'type',
    'gdpr', 'dsgvo', 'consent',
    'page_source', 'brand_theme', 'brand_color', 'form_version', 'timestamp',
    '_formLoadedAt', '_recaptchaToken', '_ip',
  ],
  'unternehmen': [
    'firma', 'ansprechpartner', 'email', 'telefon', 'phone', 'plz', 'zip',
    'energieart', 'verbrauchStrom', 'verbrauchGas', 'standorte', 'versorger',
    'vertragslaufzeit', 'nachricht',
    'gdpr', 'dsgvo', 'consent',
    'page_source', 'brand_theme', 'brand_color', 'form_version', 'timestamp',
    '_formLoadedAt', '_recaptchaToken', '_ip',
  ],
  'career': [
    'name', 'email', 'phone', 'motivation',
    'gdpr', 'dsgvo', 'consent',
    'page_source', 'form_version', 'timestamp',
    '_formLoadedAt', '_recaptchaToken', '_ip',
  ],
};

function doGet() {
  return jsonOut({
    status: 'ok',
    service: 'deintarifheld Lead API v4.0',
    time: new Date().toISOString(),
  });
}

function doPost(e) {
  try {
    const rawContents = e && e.postData && e.postData.contents ? e.postData.contents : '';
    if (rawContents.length > SECURITY.MAX_PAYLOAD_BYTES) {
      logDsgvo('REJECTED_PAYLOAD_TOO_LARGE', 'unknown', rawContents.length + ' bytes');
      return jsonOut({ success: false, error: 'Anfrage zu gross.' });
    }

    const raw = parseRequest(e);

    if (Object.keys(raw).length > SECURITY.MAX_FIELDS) {
      logDsgvo('REJECTED_TOO_MANY_FIELDS', raw.page_source || 'unknown', Object.keys(raw).length + ' fields');
      return jsonOut({ success: false, error: 'Zu viele Felder.' });
    }

    const honeypot = checkHoneypot(raw);
    if (honeypot.isBot) {
      logDsgvo('REJECTED_HONEYPOT', raw.page_source || 'unknown', honeypot.field);
      return jsonOut({ success: true, orderId: 'TH-X-00000000-XXXXX', message: 'Vielen Dank!' });
    }

    const timing = checkTiming(raw);
    if (!timing.ok) {
      logDsgvo('REJECTED_TIMING_' + timing.reason, raw.page_source || 'unknown', timing.detail);
      return jsonOut({ success: true, orderId: 'TH-X-00000000-XXXXX', message: 'Vielen Dank!' });
    }

    if (!hasConsent(raw)) {
      logDsgvo('REJECTED_NO_CONSENT', raw.page_source || 'unknown', '');
      return jsonOut({ success: false, error: 'Keine DSGVO-Einwilligung erteilt.' });
    }

    const recaptcha = verifyRecaptchaToken(raw._recaptchaToken);
    var recaptchaSoftFail = !recaptcha.success && shouldSoftAcceptRecaptcha(recaptcha);

    if (!recaptcha.success && !recaptchaSoftFail) {
      logDsgvo('REJECTED_RECAPTCHA', raw.page_source || 'unknown', recaptcha.reason);
      return jsonOut({ success: true, orderId: 'TH-X-00000000-XXXXX', message: 'Vielen Dank!' });
    }

    if (recaptchaSoftFail) {
      logDsgvo(
        'RECAPTCHA_SOFT_FAIL',
        raw.page_source || 'unknown',
        (recaptcha.code || 'UNKNOWN') + ' | ' + recaptcha.reason
      );
    }

    const rateLimit = checkServerRateLimit(raw);
    if (!rateLimit.allowed) {
      logDsgvo('REJECTED_RATE_LIMIT', raw.page_source || 'unknown', rateLimit.detail);
      return jsonOut({ success: false, error: 'Zu viele Anfragen. Bitte warte kurz.' });
    }

    const validation = validate(raw);
    if (!validation.ok) {
      return jsonOut({ success: false, error: validation.msg });
    }

    const stripped = stripUnknownFields(raw);
    const data = sanitize(stripped);
    if (recaptchaSoftFail) {
      data._recaptchaSoftFailReason = (recaptcha.code || 'UNKNOWN') + ': ' + recaptcha.reason;
    }

    const dup = checkDuplicate(data);
    if (dup.isDuplicate) {
      logDsgvo('REJECTED_DUPLICATE', data.page_source || 'unknown', dup.fingerprint);
      return jsonOut({ success: true, orderId: 'ALREADY_SUBMITTED', message: 'Bereits erhalten. Vielen Dank!' });
    }

    const orderId = generateOrderId(data.page_source);
    data._orderId = orderId;

    saveToSheet(data);
    logDsgvo('LEAD_SAVED', data.page_source, orderId);

    try {
      sendConfirmationMail(data, orderId);
      logDsgvo('CONFIRMATION_SENT', data.page_source, orderId + ' -> ' + (data.email || ''));
    } catch (mailErr) {
      Logger.log('FEHLER sendConfirmationMail: ' + mailErr.toString());
      logDsgvo('CONFIRMATION_FAILED', data.page_source, orderId + ' -> ' + mailErr.toString());
    }

    try {
      sendAdminNotification(data, orderId);
    } catch (adminErr) {
      Logger.log('FEHLER sendAdminNotification: ' + adminErr.toString());
    }

    return jsonOut({ success: true, orderId: orderId, message: 'Vielen Dank! Wir melden uns schnellstmoeglich.' });
  } catch (err) {
    Logger.log('FEHLER doPost: ' + err.toString() + '\n' + (err.stack || ''));
    return jsonOut({ success: false, error: 'Interner Fehler. Bitte spaeter erneut versuchen.' });
  }
}

function parseRequest(e) {
  if (e && e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (_) {
      return {};
    }
  }
  return (e && e.parameter) ? e.parameter : {};
}

function checkHoneypot(data) {
  for (var i = 0; i < SECURITY.HONEYPOT_FIELDS.length; i++) {
    var field = SECURITY.HONEYPOT_FIELDS[i];
    if (data[field] && String(data[field]).trim().length > 0) {
      return { isBot: true, field: field };
    }
  }
  return { isBot: false, field: '' };
}

function checkTiming(data) {
  var loadedAt = data._formLoadedAt;
  if (!loadedAt) return { ok: true, reason: '', detail: '' };

  var loadTime = Number(loadedAt);
  if (isNaN(loadTime) || loadTime <= 0) {
    return { ok: false, reason: 'INVALID', detail: 'Invalid _formLoadedAt: ' + loadedAt };
  }

  var elapsedSec = (Date.now() - loadTime) / 1000;
  if (elapsedSec < SECURITY.MIN_FORM_TIME_SEC) {
    return { ok: false, reason: 'TOO_FAST', detail: elapsedSec.toFixed(1) + 's' };
  }
  if (elapsedSec > SECURITY.MAX_FORM_TIME_SEC) {
    return { ok: false, reason: 'TOO_OLD', detail: elapsedSec.toFixed(0) + 's' };
  }

  return { ok: true, reason: '', detail: '' };
}

function verifyRecaptchaToken(token) {
  if (!token || token === 'null' || token === '') {
    return { success: false, code: 'TOKEN_MISSING', reason: 'reCAPTCHA token missing' };
  }

  var recaptchaSecret = getRecaptchaSecretKey();
  if (!recaptchaSecret || recaptchaSecret === 'DEINE_SECRET_KEY_HIER') {
    return { success: false, code: 'NOT_CONFIGURED', reason: 'reCAPTCHA nicht konfiguriert' };
  }

  try {
    var response = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'post',
      payload: {
        secret: recaptchaSecret,
        response: token,
      },
      muteHttpExceptions: true,
    });

    var result = JSON.parse(response.getContentText());

    if (!result.success) {
      var errors = (result.error_codes || []).join(', ');
      return { success: false, code: 'GOOGLE_VALIDATION_FAILED', reason: 'reCAPTCHA validation failed: ' + errors };
    }

    var hostname = String(result.hostname || '').toLowerCase().trim();
    var allowedHosts = (CFG.RECAPTCHA_ALLOWED_HOSTNAMES || []).map(function(h) {
      return String(h || '').toLowerCase().trim();
    }).filter(function(h) { return h.length > 0; });

    if (allowedHosts.length > 0 && allowedHosts.indexOf(hostname) === -1) {
      return { success: false, code: 'HOSTNAME_INVALID', reason: 'Ungueltiger reCAPTCHA Hostname: ' + hostname };
    }

    var allowedActions = (CFG.RECAPTCHA_ALLOWED_ACTIONS || []).map(function(a) {
      return String(a || '').toLowerCase().trim();
    }).filter(function(a) { return a.length > 0; });

    var action = String(result.action || '').toLowerCase().trim();
    if (allowedActions.length > 0 && allowedActions.indexOf(action) === -1) {
      return { success: false, code: 'ACTION_INVALID', reason: 'Ungueltige reCAPTCHA Action: ' + action };
    }

    var hasScore = typeof result.score === 'number';
    if (hasScore) {
      var score = Number(result.score) || 0;
      if (score < CFG.RECAPTCHA_MIN_SCORE) {
        return {
          success: false,
          code: 'SCORE_TOO_LOW',
          reason: 'Score zu niedrig: ' + score.toFixed(2) + ' (threshold: ' + CFG.RECAPTCHA_MIN_SCORE + ')',
        };
      }
      return { success: true, code: 'OK', score: score };
    }

    return { success: true, code: 'OK' };
  } catch (e) {
    return { success: false, code: 'VALIDATION_ERROR', reason: 'reCAPTCHA validation error: ' + e.toString() };
  }
}

function shouldSoftAcceptRecaptcha(recaptcha) {
  var mode = String(CFG.RECAPTCHA_MODE || 'hard').toLowerCase().trim();
  if (mode === 'soft') return true;
  return false;
}

function getRecaptchaSecretKey() {
  try {
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty('RECAPTCHA_SECRET_KEY');
    if (secret && String(secret).trim()) return String(secret).trim();
  } catch (e) {
    Logger.log('ScriptProperties FEHLER: ' + e.toString());
  }
  return '';
}

function hasConsent(data) {
  var v = data.gdpr || data.dsgvo || data.consent;
  if (v === true || v === 1) return true;
  var normalized = String(v || '').toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'ja' || normalized === 'on';
}

function validate(data) {
  var src = String(data.page_source || '').toLowerCase().trim();

  var checks = {
    'hero-funnel': [
      [data.firstName || data.name, 'Vorname fehlt'],
      [data.phone, 'Telefonnummer fehlt'],
      [data.email, 'E-Mail fehlt'],
      [data.provider, 'Aktueller Anbieter fehlt'],
      [data.usage, 'Verbrauch fehlt'],
      [data.zip, 'PLZ fehlt'],
    ],
    'main_funnel': [
      [data.name, 'Name fehlt'],
      [data.phone, 'Telefon fehlt'],
      [data.email, 'E-Mail fehlt'],
      [data.provider, 'Anbieter fehlt'],
      [data.consumption || data.usage, 'Verbrauch fehlt'],
      [data.zip, 'PLZ fehlt'],
    ],
    'unternehmen': [
      [data.firma, 'Firmenname fehlt'],
      [data.ansprechpartner, 'Ansprechpartner fehlt'],
      [data.email, 'E-Mail fehlt'],
      [data.energieart, 'Energieart fehlt'],
      [data.standorte, 'Standortanzahl fehlt'],
      [data.plz || data.zip, 'PLZ fehlt'],
    ],
    'career': [
      [data.name, 'Name fehlt'],
      [data.email, 'E-Mail fehlt'],
      [data.phone, 'Telefon fehlt'],
      [data.motivation, 'Motivation fehlt'],
    ],
  };

  if (!checks[src]) return { ok: false, msg: 'Unbekannte Formularquelle: ' + src };

  for (var i = 0; i < checks[src].length; i++) {
    var val = checks[src][i][0];
    var msg = checks[src][i][1];
    if (!val || String(val).trim().length < 1) return { ok: false, msg: msg };
  }

  var email = String(data.email || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, msg: 'Ungueltige E-Mail-Adresse.' };
  }

  var plz = String(data.zip || data.plz || '').trim();
  if (plz && !/^\d{5}$/.test(plz)) {
    return { ok: false, msg: 'PLZ muss 5-stellig sein.' };
  }

  return { ok: true };
}

function stripUnknownFields(data) {
  var src = String(data.page_source || '').toLowerCase().trim();
  var allowed = ALLOWED_FIELDS[src];
  if (!allowed) return data;

  var cleaned = {};
  for (var i = 0; i < allowed.length; i++) {
    var field = allowed[i];
    if (Object.prototype.hasOwnProperty.call(data, field)) cleaned[field] = data[field];
  }
  return cleaned;
}

function sanitize(raw) {
  var d = {};
  for (var key in raw) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    if (key.startsWith('_') && key !== '_ip') continue;

    var val = raw[key];
    if (typeof val === 'boolean' || typeof val === 'number') {
      d[key] = val;
      continue;
    }

    d[key] = String(val)
      .replace(/[<>"'`;\\]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/expression\s*\(/gi, '')
      .replace(/url\s*\(/gi, '')
      .trim()
      .substring(0, SECURITY.MAX_FIELD_LENGTH);
  }

  if (Object.prototype.hasOwnProperty.call(raw, '_ip')) {
    d._ip = String(raw._ip || '').trim().substring(0, 128);
  }

  return d;
}

function hashForCache(input) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    input + 'th_cache_v4',
    Utilities.Charset.UTF_8
  );
  return bytes.slice(0, 8).map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

function hashIp(ip) {
  if (!ip || ip === 'unknown') return 'N/A';
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    ip + 'th_ip_salt_v4',
    Utilities.Charset.UTF_8
  );
  return 'H' + bytes.slice(0, 6).map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('').toUpperCase();
}

function checkServerRateLimit(data) {
  try {
    var cache = CacheService.getScriptCache();
    var email = String(data.email || '').toLowerCase().trim();
    var src = String(data.page_source || '').toLowerCase().trim();
    if (!email) return { allowed: true, detail: '' };

    var key = 'rl_' + hashForCache(email + '|' + src);
    var current = cache.get(key);
    var count = current ? parseInt(current, 10) : 0;

    if (count >= SECURITY.RATE_LIMIT_MAX) {
      return {
        allowed: false,
        detail: email + ' | ' + count + '/' + SECURITY.RATE_LIMIT_MAX + ' in ' + SECURITY.RATE_LIMIT_WINDOW_SEC + 's',
      };
    }

    cache.put(key, String(count + 1), SECURITY.RATE_LIMIT_WINDOW_SEC);
    return { allowed: true, detail: '' };
  } catch (e) {
    Logger.log('Rate-Limit FEHLER: ' + e.toString());
    return { allowed: true, detail: '' };
  }
}

function checkDuplicate(data) {
  try {
    var cache = CacheService.getScriptCache();
    var email = String(data.email || '').toLowerCase().trim();
    var src = String(data.page_source || '').toLowerCase().trim();
    var phone = String(data.phone || data.telefon || '').trim();

    var fingerprint = hashForCache(email + '|' + src + '|' + phone);
    var key = 'dup_' + fingerprint;

    if (cache.get(key)) {
      return { isDuplicate: true, fingerprint: fingerprint };
    }

    cache.put(key, '1', SECURITY.DUPLICATE_WINDOW_SEC);
    return { isDuplicate: false, fingerprint: fingerprint };
  } catch (e) {
    Logger.log('Duplicate FEHLER: ' + e.toString());
    return { isDuplicate: false, fingerprint: '' };
  }
}

function generateOrderId(pageSource) {
  var prefixes = {
    'hero-funnel': 'TH-E',
    'main_funnel': 'TH-T',
    'unternehmen': 'TH-B',
    'career': 'TH-K',
  };

  var prefix = prefixes[pageSource] || 'TH-X';
  var datePart = Utilities.formatDate(new Date(), 'Europe/Berlin', 'yyyyMMdd');
  var randPart = Math.random().toString(36).substr(2, 5).toUpperCase();
  return prefix + '-' + datePart + '-' + randPart;
}

function getSpreadsheet() {
  if (!CFG.SPREADSHEET_ID) throw new Error('SPREADSHEET_ID fehlt.');
  return SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
}

function getOrCreateSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (sheet) return sheet;

  sheet = ss.insertSheet(sheetName);
  applySheetHeader(sheet, sheetName);
  return sheet;
}

function applySheetHeader(sheet, sheetName) {
  var headers;
  var bgColor;

  if (sheetName === CFG.SHEETS.HERO || sheetName === CFG.SHEETS.MAIN) {
    headers = [
      'Auftrags-Nr.', 'Eingang (DE)', 'Uhrzeit', 'Zeitstempel ISO',
      'Vorname / Name', 'Telefon', 'E-Mail', 'Aktueller Anbieter', 'Verbrauch kWh',
      'PLZ', 'Energieart', 'DSGVO-Einwilligung', 'DSGVO-Timestamp', 'IP-Hash', 'Status', 'Notiz',
    ];
    bgColor = '#D4FF3E';
  } else if (sheetName === CFG.SHEETS.UNTERNEHMEN) {
    headers = [
      'Auftrags-Nr.', 'Eingang (DE)', 'Uhrzeit', 'Zeitstempel ISO',
      'Firma', 'Ansprechpartner', 'E-Mail', 'Telefon', 'PLZ', 'Energieart',
      'Verbrauch Strom kWh', 'Verbrauch Gas kWh', 'Standorte', 'Akt. Versorger',
      'Vertragslaufzeit', 'Nachricht', 'DSGVO-Einwilligung', 'DSGVO-Timestamp', 'IP-Hash', 'Status', 'Notiz',
    ];
    bgColor = '#FF6B2B';
  } else if (sheetName === CFG.SHEETS.CAREER) {
    headers = [
      'Auftrags-Nr.', 'Eingang (DE)', 'Uhrzeit', 'Zeitstempel ISO',
      'Name', 'E-Mail', 'Telefon', 'Motivation', 'DSGVO-Einwilligung', 'DSGVO-Timestamp', 'IP-Hash', 'Status', 'Notiz',
    ];
    bgColor = '#0A5ADB';
  } else if (sheetName === CFG.SHEETS.DSGVO_LOG) {
    headers = ['Zeitstempel ISO', 'Datum', 'Uhrzeit', 'Aktion', 'Formularquelle', 'Referenz', 'System'];
    bgColor = '#1E2533';
  }

  if (!headers) return;

  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground(bgColor);
  headerRange.setFontColor((sheetName === CFG.SHEETS.HERO || sheetName === CFG.SHEETS.MAIN) ? '#090B0F' : '#FFFFFF');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 110);
  sheet.setColumnWidth(3, 80);
  sheet.setColumnWidth(4, 180);
}

function setupSheets() {
  var ss = getSpreadsheet();
  var allSheets = [
    CFG.SHEETS.HERO,
    CFG.SHEETS.MAIN,
    CFG.SHEETS.UNTERNEHMEN,
    CFG.SHEETS.CAREER,
    CFG.SHEETS.DSGVO_LOG,
  ];

  for (var i = 0; i < allSheets.length; i++) {
    var name = allSheets[i];
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    applySheetHeader(sheet, name);
  }

  logDsgvo('SETUP_SHEETS', 'SYSTEM', 'Alle Sheets bereit');
}

function saveToSheet(data) {
  var ss = getSpreadsheet();
  var src = String(data.page_source || '').toLowerCase().trim();
  var now = new Date();
  var tsIso = now.toISOString();
  var date = Utilities.formatDate(now, 'Europe/Berlin', 'dd.MM.yyyy');
  var time = Utilities.formatDate(now, 'Europe/Berlin', 'HH:mm:ss');
  var ipHash = hashIp(data._ip || '');
  var orderId = data._orderId;
  var status = data._recaptchaSoftFailReason ? 'Neu (Captcha Soft-Fail)' : 'Neu';

  var sheetName = '';
  var row = [];

  if (src === 'hero-funnel') {
    sheetName = CFG.SHEETS.HERO;
    row = [
      orderId, date, time, tsIso,
      data.firstName || data.name || '',
      data.phone || '',
      data.email || '',
      data.provider || '',
      data.usage || '',
      data.zip || '',
      data.type || '',
      'Ja', date + ' ' + time, ipHash, status, '',
    ];
  } else if (src === 'main_funnel') {
    sheetName = CFG.SHEETS.MAIN;
    row = [
      orderId, date, time, tsIso,
      data.name || '',
      data.phone || '',
      data.email || '',
      data.provider || '',
      data.consumption || data.usage || '',
      data.zip || '',
      data.type || '',
      'Ja', date + ' ' + time, ipHash, status, '',
    ];
  } else if (src === 'unternehmen') {
    sheetName = CFG.SHEETS.UNTERNEHMEN;
    row = [
      orderId, date, time, tsIso,
      data.firma || '',
      data.ansprechpartner || '',
      data.email || '',
      data.telefon || data.phone || '',
      data.plz || data.zip || '',
      data.energieart || '',
      data.verbrauchStrom || '',
      data.verbrauchGas || '',
      data.standorte || '',
      data.versorger || '',
      data.vertragslaufzeit || '',
      data.nachricht || '',
      'Ja', date + ' ' + time, ipHash, status, '',
    ];
  } else if (src === 'career') {
    sheetName = CFG.SHEETS.CAREER;
    row = [
      orderId, date, time, tsIso,
      data.name || '',
      data.email || '',
      data.phone || '',
      data.motivation || '',
      'Ja', date + ' ' + time, ipHash, status, '',
    ];
  } else {
    throw new Error('Unbekannte Quelle: ' + src);
  }

  var sheet = getOrCreateSheet(ss, sheetName);
  sheet.appendRow(row);
}

function sendConfirmationMail(data, orderId) {
  var src = String(data.page_source || '').toLowerCase().trim();
  var design = CFG.DESIGN[src] || CFG.DESIGN['hero-funnel'];
  var email = String(data.email || '').trim();
  if (!email) return;

  var recipientName = getRecipientName(data, src);
  var subject = design.subjectPrefix + ' - Auftragsnr. ' + orderId + ' | ' + CFG.SENDER_NAME;
  var bodyRows = buildMailBody(data, src);
  var htmlBody = buildHtmlMail(recipientName, orderId, bodyRows, design, src);

  GmailApp.sendEmail(email, subject, stripHtml(htmlBody), {
    htmlBody: htmlBody,
    name: CFG.SENDER_NAME,
    replyTo: CFG.SENDER_EMAIL,
  });
}

function sendAdminNotification(data, orderId) {
  var src = String(data.page_source || '').toLowerCase().trim();
  var design = CFG.DESIGN[src] || CFG.DESIGN['hero-funnel'];
  var now = Utilities.formatDate(new Date(), 'Europe/Berlin', 'dd.MM.yyyy HH:mm:ss');
  var subject = 'Neuer Lead [' + orderId + '] - ' + design.label + ' | deintarifheld';

  var bodyRows = buildMailBody(data, src);

  var html = '' +
    '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">' +
    '<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">' +
    '<div style="background:' + design.primary + ';padding:18px 22px;color:' + design.textColor + ';font-weight:700;">Neuer Lead eingegangen</div>' +
    '<div style="background:' + design.secondary + ';padding:10px 22px;color:#fff;font-family:monospace;font-size:16px;">' + escHtml(orderId) + '</div>' +
    '<div style="padding:14px 22px;color:#666;font-size:12px;">' + escHtml(now) + ' Uhr</div>' +
    '<div style="padding:0 22px 18px;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;">' + bodyRows + '</table></div>' +
    '</div></body></html>';

  GmailApp.sendEmail(CFG.ADMIN_EMAIL, subject, 'Neuer Lead: ' + orderId, {
    htmlBody: html,
    name: CFG.SENDER_NAME,
    replyTo: CFG.SENDER_EMAIL,
  });
}

function getRecipientName(data, src) {
  if (src === 'hero-funnel') return data.firstName || data.name || 'dort';
  if (src === 'main_funnel') return data.name || 'dort';
  if (src === 'unternehmen') return data.ansprechpartner || data.firma || 'dort';
  if (src === 'career') return data.name || 'dort';
  return 'dort';
}

function buildMailBody(data, src) {
  var rows = [];

  function row(label, value) {
    if (!value || String(value).trim() === '') return '';
    return '<tr>' +
      '<td style="padding:10px 14px;font-weight:600;background:#f9f9f9;border-bottom:1px solid #eee;width:190px;">' + escHtml(label) + '</td>' +
      '<td style="padding:10px 14px;border-bottom:1px solid #eee;">' + escHtml(String(value)) + '</td>' +
      '</tr>';
  }

  if (src === 'hero-funnel') {
    rows.push(row('Vorname', data.firstName || data.name));
    rows.push(row('Telefon', data.phone));
    rows.push(row('E-Mail', data.email));
    rows.push(row('Aktueller Anbieter', data.provider));
    rows.push(row('Jahresverbrauch', data.usage ? data.usage + ' kWh' : ''));
    rows.push(row('Postleitzahl', data.zip));
    rows.push(row('Energieart', data.type));
  } else if (src === 'main_funnel') {
    rows.push(row('Name', data.name));
    rows.push(row('Telefon', data.phone));
    rows.push(row('E-Mail', data.email));
    rows.push(row('Aktueller Anbieter', data.provider));
    rows.push(row('Jahresverbrauch', (data.consumption || data.usage) ? (data.consumption || data.usage) + ' kWh' : ''));
    rows.push(row('Postleitzahl', data.zip));
    rows.push(row('Energieart', data.type));
  } else if (src === 'unternehmen') {
    rows.push(row('Firma', data.firma));
    rows.push(row('Ansprechpartner', data.ansprechpartner));
    rows.push(row('E-Mail', data.email));
    rows.push(row('Telefon', data.telefon || data.phone));
    rows.push(row('PLZ', data.plz || data.zip));
    rows.push(row('Energieart', data.energieart));
    rows.push(row('Verbrauch Strom', data.verbrauchStrom ? data.verbrauchStrom + ' kWh' : ''));
    rows.push(row('Verbrauch Gas', data.verbrauchGas ? data.verbrauchGas + ' kWh' : ''));
    rows.push(row('Standorte', data.standorte));
    rows.push(row('Aktueller Versorger', data.versorger));
    rows.push(row('Vertragslaufzeit', data.vertragslaufzeit));
    rows.push(row('Nachricht', data.nachricht));
  } else if (src === 'career') {
    rows.push(row('Name', data.name));
    rows.push(row('E-Mail', data.email));
    rows.push(row('Telefon', data.phone));
    rows.push(row('Motivation', data.motivation));
  }

  return rows.join('');
}

function buildHtmlMail(recipientName, orderId, bodyRows, design, src) {
  var now = Utilities.formatDate(new Date(), 'Europe/Berlin', 'dd.MM.yyyy HH:mm');

  var intro = 'Vielen Dank fuer deine Anfrage.';
  if (src === 'unternehmen') {
    intro = 'Vielen Dank fuer Ihre Unternehmensanfrage. Wir melden uns schnellstmoeglich mit einem passenden Angebot.';
  } else if (src === 'career') {
    intro = 'Vielen Dank fuer deine Bewerbung. Wir melden uns schnellstmoeglich bei dir zurueck.';
  } else {
    intro = 'Vielen Dank fuer deine Tarifanfrage. Wir melden uns schnellstmoeglich bei dir.';
  }

  return '' +
    '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;color:#333;">' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">' +
    '<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#fff;">' +
    '<tr><td style="background:' + design.primary + ';padding:22px 24px;color:' + design.textColor + ';font-size:22px;font-weight:700;">deintarifheld</td></tr>' +
    '<tr><td style="background:' + design.secondary + ';padding:12px 24px;color:#fff;font-size:17px;font-weight:700;">' + escHtml(design.label) + ' - Eingang bestaetigt</td></tr>' +
    '<tr><td style="padding:16px 24px;">' +
    '<div style="background:' + design.bg + ';padding:12px 14px;border-left:4px solid ' + design.primary + ';">' +
    '<div style="font-size:11px;color:#888;text-transform:uppercase;">Auftragsnummer</div>' +
    '<div style="font-size:18px;font-weight:700;font-family:monospace;">' + escHtml(orderId) + '</div>' +
    '<div style="font-size:11px;color:#888;">' + escHtml(now) + ' Uhr</div>' +
    '</div></td></tr>' +
    '<tr><td style="padding:0 24px 12px;font-size:15px;line-height:1.6;">Hallo <strong>' + escHtml(firstToken(recipientName)) + '</strong>,<br><br>' + escHtml(intro) + '</td></tr>' +
    '<tr><td style="padding:0 24px;"><div style="border-top:2px solid ' + design.primary + ';"></div></td></tr>' +
    '<tr><td style="padding:16px 24px 20px;">' +
    '<div style="margin-bottom:8px;font-size:12px;font-weight:700;color:' + design.secondary + ';text-transform:uppercase;">Deine Angaben</div>' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;">' + bodyRows + '</table>' +
    '</td></tr>' +
    '<tr><td style="padding:0 24px 22px;text-align:center;">' +
    '<a href="https://calendar.app.google/uum1t3Whpstgxsa49" style="display:inline-block;background:' + design.primary + ';color:' + design.textColor + ';font-weight:700;text-decoration:none;padding:12px 26px;border-radius:4px;">Buche jetzt deinen Termin</a>' +
    '</td></tr>' +
    '<tr><td style="background:#f9f9f9;padding:14px 24px;border-top:1px solid #e5e5e5;font-size:11px;color:#888;line-height:1.5;">' +
    'deintarifheld.de | <a href="https://deintarifheld.de/datenschutz" style="color:' + design.secondary + ';">Datenschutz</a> | ' +
    '<a href="https://deintarifheld.de/impressum" style="color:' + design.secondary + ';">Impressum</a>' +
    '</td></tr>' +
    '</table></td></tr></table></body></html>';
}

function firstToken(name) {
  var n = String(name || '').trim();
  if (!n) return 'dort';
  return n.split(/\s+/)[0];
}

function logDsgvo(action, source, reference) {
  try {
    var ss = getSpreadsheet();
    var now = new Date();
    var date = Utilities.formatDate(now, 'Europe/Berlin', 'dd.MM.yyyy');
    var time = Utilities.formatDate(now, 'Europe/Berlin', 'HH:mm:ss');
    var sheet = getOrCreateSheet(ss, CFG.SHEETS.DSGVO_LOG);

    sheet.appendRow([
      now.toISOString(),
      date,
      time,
      action,
      source,
      reference,
      'Google Apps Script v4.0 | deintarifheld.de',
    ]);
  } catch (e) {
    Logger.log('logDsgvo FEHLER: ' + e.toString());
  }
}

function getRetentionCutoff(sheetName) {
  var cutoff = new Date();
  if (sheetName === CFG.SHEETS.CAREER) {
    cutoff.setMonth(cutoff.getMonth() - CFG.CAREER_RETENTION_MONTHS);
    return cutoff;
  }
  cutoff.setDate(cutoff.getDate() - CFG.RETENTION_DAYS);
  return cutoff;
}

function autoDeleteExpiredData() {
  var ss = getSpreadsheet();
  var sheetNames = [CFG.SHEETS.HERO, CFG.SHEETS.MAIN, CFG.SHEETS.UNTERNEHMEN, CFG.SHEETS.CAREER];
  var totalDeleted = 0;

  for (var s = 0; s < sheetNames.length; s++) {
    var name = sheetNames[s];
    var sheet = ss.getSheetByName(name);
    if (!sheet) continue;

    var cutoff = getRetentionCutoff(name);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) continue;

    var tsValues = sheet.getRange(2, 4, lastRow - 1, 1).getValues();
    for (var i = tsValues.length - 1; i >= 0; i--) {
      var ts = tsValues[i][0];
      if (!ts) continue;
      var rowDate = new Date(ts);
      if (!isNaN(rowDate) && rowDate < cutoff) {
        sheet.deleteRow(i + 2);
        totalDeleted++;
      }
    }
  }

  logDsgvo('AUTO_DELETE', 'SYSTEM', String(totalDeleted) + ' Datensaetze geloescht');
}

function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction && t.getHandlerFunction() === 'autoDeleteExpiredData') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('autoDeleteExpiredData')
    .timeBased()
    .everyDays(1)
    .atHour(CFG.DELETE_HOUR)
    .create();

  logDsgvo('TRIGGER_SETUP', 'SYSTEM', 'Taegliche Loeschung um ' + CFG.DELETE_HOUR + ':00');
}

function deleteByEmail(emailAddress) {
  if (!emailAddress) throw new Error('E-Mail-Adresse erforderlich.');

  var ss = getSpreadsheet();
  var emailNorm = String(emailAddress).toLowerCase().trim();
  var totalDeleted = 0;

  var emailCols = {};
  emailCols[CFG.SHEETS.HERO] = 6;
  emailCols[CFG.SHEETS.MAIN] = 6;
  emailCols[CFG.SHEETS.UNTERNEHMEN] = 6;
  emailCols[CFG.SHEETS.CAREER] = 5;

  Object.keys(emailCols).forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    var emailColIndex = emailCols[sheetName];

    for (var i = data.length - 1; i >= 0; i--) {
      var emailCell = String(data[i][emailColIndex] || '').toLowerCase().trim();
      if (emailCell === emailNorm) {
        sheet.deleteRow(i + 2);
        totalDeleted++;
      }
    }
  });

  logDsgvo('MANUAL_DELETE_REQUEST', emailNorm, String(totalDeleted) + ' Zeilen geloescht');
  return totalDeleted;
}

function testDoPost() {
  var mockEvent = {
    postData: {
      contents: JSON.stringify({
        name: 'Test Nutzer',
        email: 'wunderland50@gmail.com',
        phone: '+49 89 123456',
        motivation: 'Testlauf v4.0',
        gdpr: true,
        page_source: 'career',
        form_version: '4.0',
        _formLoadedAt: Date.now() - 15000,
        _recaptchaToken: 'TEST_TOKEN_NUR_FUER_STRUKTURTEST',
        timestamp: new Date().toISOString(),
      }),
      type: 'application/json',
    },
  };

  var result = doPost(mockEvent);
  Logger.log('Ergebnis: ' + result.getContent());
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
