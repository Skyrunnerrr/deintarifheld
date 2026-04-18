// ─── Navigation ──────────────────────────────────────────────────
export const NAV_LINKS = [
  { label: 'Unternehmen',      href: '/unternehmen' },
  { label: 'So funktioniert\'s', href: '#how-it-works' },
  { label: 'Karriere',         href: '/karriere' },
]

// ─── Trust Bar ───────────────────────────────────────────────────
export const TRUST_ITEMS = [
  { icon: '★★★★★', text: '4.9/5 Bewertung' },
  { icon: '🔒',     text: 'DSGVO konform' },
  { icon: '🇩🇪',     text: 'Deutschlandweit' },
  { icon: '💸',     text: 'Keine Kosten' },
  { icon: '⚡',     text: 'Seit 2015' },
]

// ─── How It Works ────────────────────────────────────────────────
export const HOW_IT_WORKS_STEPS = [
  {
    number: '01',
    icon:   'FileText',
    title:  'Daten eingeben',
    description:
      'Trage deine Postleitzahl und deinen Jahresverbrauch ein. Dauert weniger als 60 Sekunden.',
  },
  {
    number: '02',
    icon:   'Search',
    title:  'Angebot erhalten',
    description:
      'Wir prüfen alle verfügbaren Tarife und schicken dir dein persönliches Einsparpotenzial — wir melden uns schnellstmöglich.',
  },
  {
    number: '03',
    icon:   'Zap',
    title:  'Wechseln & sparen',
    description:
      'Auf Wunsch übernehmen wir den kompletten Wechsel für dich. Kein Papierkram, kein Risiko.',
  },
]

// ─── Testimonials ────────────────────────────────────────────────
export const TESTIMONIALS = [
  {
    id:      1,
    name:    'Julia S.',
    city:    'Hamburg',
    savings: '680 €',
    rating:  5,
    text:    '"Ich war skeptisch, aber innerhalb von 3 Tagen war alles erledigt. 680 Euro jährliche Ersparnis bei null Aufwand. Absolut empfehlenswert!"',
    type:    'Privatkundin',
  },
  {
    id:      2,
    name:    'Dumas B.',
    city:    'München',
    savings: '1.200 €',
    rating:  5,
    text:    '"Als kleines Unternehmen waren wir froh, endlich einen persönlichen Ansprechpartner zu haben, der sich wirklich auskennt. 1.200 Euro gespart."',
    type:    'Geschäftskunde',
  },
  {
    id:      3,
    name:    'Daniel A.',
    city:    'Berlin',
    savings: '490 €',
    rating:  5,
    text:    '"Unkompliziert, freundlich, transparent — genau so stelle ich mir Beratung vor. Keine Verkaufsmaschen, nur echte Hilfe."',
    type:    'Privatkundin',
  },
]

// ─── Stats ───────────────────────────────────────────────────────
export const STATS = [
  { value: 1200,   suffix: '+',  label: 'Kunden optimiert',    prefix: '' },
  { value: 40,     suffix: '%',  label: 'Ø Ersparnis',         prefix: '' },
  { value: 62356,  suffix: '€',  label: 'Gesamtersparnis 2025', prefix: '' },
  { value: 5,      suffix: ' Min', label: 'Bis zum ersten Angebot', prefix: '' },
]

// ─── B2B Features ────────────────────────────────────────────────
export const B2B_FEATURES = [
  'Partnerschaft & Großkunden-Tarife',
  'Persönlicher fester Ansprechpartner',
  'Maßgeschneiderte Angebote',
  'Kostenlose Erstberatung',
  'Erfahrung seit 2015',
  'Deutschlandweit',
]

// ─── Career Features ─────────────────────────────────────────────
export const CAREER_FEATURES = [
  { icon: '🌍', text: 'Flexibel von überall arbeiten' },
  { icon: '📈', text: 'Attraktive Provisionen & Boni' },
  { icon: '🧠', text: 'Schulungen & persönliche Entwicklung' },
  { icon: '🤝', text: 'Quereinsteiger willkommen' },
  { icon: '💸', text: '1.400–5.500 € monatlich möglich' },
]

// ─── FAQ ─────────────────────────────────────────────────────────
export const FAQ_ITEMS = [
  {
    question: 'Kostet mich das etwas?',
    answer:
      'Nein. Die Tarifanalyse und der Wechselservice sind für dich zu 100% kostenlos — ohne Bearbeitungsgebühr, ohne versteckte Kosten. Wir erhalten ausschließlich eine Provision vom neuen Anbieter, wenn es zu einem Wechsel kommt.',
  },
  {
    question: 'Muss ich meinen alten Vertrag selbst kündigen?',
    answer:
      'Nein. Auf Wunsch übernehmen wir die Kündigung deines alten Vertrags vollständig für dich — inklusive fristgerechter Abmeldung. Du musst nichts weiter tun.',
  },
  {
    question: 'Was passiert mit meinen Daten?',
    answer:
      'Deine Daten werden ausschließlich zur Durchführung der Tarifoptimierung genutzt und nicht an unbeteiligte Dritte weitergegeben. Alle Verarbeitungen entsprechen der DSGVO. Details findest du in unserer Datenschutzerklärung.',
  },
  {
    question: 'Wie lange dauert ein Anbieterwechsel?',
    answer:
      'Der Wechsel dauert in der Regel 2–6 Wochen ab Auftragserteilung. Der neue Anbieter übernimmt nahtlos — du hast zu keiner Zeit eine Versorgungslücke.',
  },
  {
    question: 'Geht das für Strom und Gas gleichzeitig?',
    answer:
      'Ja. Wir optimieren sowohl Strom- als auch Gastarife — einzeln oder kombiniert. Gib einfach an, für welche Energieart du ein Angebot möchtest.',
  },
  {
    question: 'Was brauche ich für die Analyse?',
    answer:
      'Nur drei Angaben: deinen ungefähren Jahresverbrauch (steht auf deiner letzten Rechnung), deinen aktuellen Anbieter und deine Postleitzahl. Alles andere erledigen wir.',
  },
]

// ─── Partner ─────────────────────────────────────────────────────
export const PARTNER_NAMES = [
  'TELESON Vertriebs GmbH',
]

// ─── Footer Links ────────────────────────────────────────────────
export const FOOTER_LINKS = {
  main: [
    { label: 'Privatkunden',       href: '#hero' },
    { label: 'Unternehmen',        href: '/unternehmen' },
    { label: 'Karriere',           href: '/karriere' },
    { label: 'FAQ',                href: '#faq' },
  ],
  legal: [
    { label: 'Impressum',          href: '/impressum' },
    { label: 'Datenschutz',        href: '/datenschutz' },
    { label: 'AGB',                href: '/agb' },
    { label: 'Cookie-Einstellungen', href: '#' },
  ],
}
