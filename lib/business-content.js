/**
 * DTH-04 — zentrale Copy für /unternehmen-neu
 * Keine unbelegten Sparversprechen, keine Lieferantenrolle.
 */

export const BUSINESS_HERO = {
  label: 'Für Unternehmen & Gewerbe',
  title: 'Strom- und Gasangebote für Unternehmen persönlich prüfen',
  description:
    'Schon kleine Unterschiede bei Preis, Vertragslaufzeit oder Standortstruktur können sich bei gewerblichen Verbräuchen deutlich auf die jährlichen Energiekosten auswirken. Wir prüfen Ihre Ausgangslage und koordinieren passende Angebote über ausgewählte Energiepartner.',
  support:
    'Für Gewerbestrom, Gasverträge und mehrere Standorte — unverbindlich und ohne automatische Vertragsänderung.',
  primaryCta: 'Versorgungssituation unverbindlich prüfen lassen',
  secondaryCta: 'Per E-Mail kontaktieren',
  secondaryHref: 'mailto:kontakt@deintarifheld.de',
}

/** DTH-05A/05B — wirtschaftliche Argumentation (keine Ersparnisgarantie) */
export const BUSINESS_CASE = {
  label: 'Wirtschaftlicher Hebel',
  title: 'Kleine Preisunterschiede können über das Jahr viel ausmachen',
  intro:
    'Entscheidend ist nicht nur der Tarifname. Verbrauch und Arbeitspreis je Kilowattstunde multiplizieren sich: schon ein kleiner Cent-Unterschied kann bei hohen Gewerbeverbräuchen die jährlichen Energiekosten spürbar beeinflussen. Vertragslaufzeit, Standorte und Wechselzeitpunkt wirken dabei gemeinsam.',
  examplesLabel: 'Transparente Rechenbeispiele',
  tableCaption:
    'Beispielrechnung: Jahresverbrauch × beispielhafter Preisunterschied von 1 Cent je kWh — keine Ersparnisgarantie.',
  examples: [
    { consumption: '100.000 kWh', delta: '1 Cent je kWh', effect: '1.000 €' },
    { consumption: '500.000 kWh', delta: '1 Cent je kWh', effect: '5.000 €' },
    { consumption: '1.000.000 kWh', delta: '1 Cent je kWh', effect: '10.000 €' },
  ],
  columns: {
    consumption: 'Jahresverbrauch',
    delta: 'Beispielhafter Preisunterschied',
    effect: 'Rechnerische Jahreswirkung',
  },
  disclaimer:
    'Reine Rechenbeispiele, keine Ersparnisgarantie. Das tatsächliche Ergebnis hängt unter anderem von Verbrauch, Vertragsstand, Preisbestandteilen und verfügbaren Angeboten ab.',
  nextStep:
    'Der nächste Schritt ist eine unverbindliche Prüfung Ihrer Versorgungssituation — ohne automatische Vertragsänderung.',
}

export const BUSINESS_TRIGGERS = {
  title: 'Wann eine Prüfung besonders sinnvoll sein kann',
  items: [
    'vor einer Vertragsverlängerung oder einem Neuabschluss',
    'bei deutlich verändertem Verbrauch',
    'bei mehreren Standorten oder getrennten Verträgen',
    'bei einer Betriebserweiterung oder Standorteröffnung',
    'wenn längere Zeit kein strukturierter Angebotsvergleich erfolgt ist',
    'wenn Vertrags- und Kostenstrukturen nicht vollständig transparent sind',
  ],
}

export const BUSINESS_TRUST = [
  'Kostenlos & unverbindlich',
  'Persönlicher Ansprechpartner',
  'Auch für mehrere Standorte',
  'Vermittlung über Energiepartner',
]

export const BUSINESS_AUDIENCE = {
  label: 'Zielgruppen',
  title: 'Für welche Unternehmen ist unser Service geeignet?',
  description:
    'Unser Unternehmensservice richtet sich an Betriebe mit gewerblichem Strom- oder Gasbedarf — vom Einzelstandort bis zur Filialstruktur.',
  items: [
    {
      title: 'Gewerbebetriebe',
      desc: 'Werkstätten, Büros, Praxen und Handelsbetriebe mit planbarem Energiebedarf.',
    },
    {
      title: 'Gastronomie & Hotellerie',
      desc: 'Betriebe mit durchgehendem Verbrauch und Bedarf an nachvollziehbaren Kosten.',
    },
    {
      title: 'Autohäuser & Gruppen',
      desc: 'Standorte mit höherem Verbrauch und oft mehreren Lieferstellen.',
    },
    {
      title: 'Pflege & Gesundheit',
      desc: 'Einrichtungen mit kontinuierlichem Betrieb und klaren Versorgungsanforderungen.',
    },
    {
      title: 'Produktion & Filialen',
      desc: 'Produktionsbetriebe, Filialstrukturen und Unternehmen mit mehreren Standorten.',
    },
    {
      title: 'Hausverwaltungen',
      desc: 'Verwaltungen und Liegenschaften mit gebündeltem Strom- oder Gasbedarf.',
    },
  ],
}

export const BUSINESS_SERVICES = {
  label: 'Leistungen',
  title: 'Was DeinTarifheld übernimmt',
  description:
    'Wir unterstützen Sie bei der Erfassung Ihrer Situation und der Vermittlung geeigneter Angebote — ohne selbst Energie zu liefern.',
  items: [
    {
      title: 'Versorgungssituation erfassen',
      desc: 'Verbrauch, Standorte, Laufzeiten und aktuelle Versorgerdaten strukturiert aufnehmen.',
    },
    {
      title: 'Vertrags- und Verbrauchsdaten prüfen',
      desc: 'Vorhandene Unterlagen und Angaben sichten, um passende Optionen einordnen zu können.',
    },
    {
      title: 'Angebote über Partner koordinieren',
      desc: 'Geeignete Strom- oder Gasangebote über ausgewählte Energiepartner anfragen und vergleichen.',
    },
    {
      title: 'Persönlich begleiten',
      desc: 'Ein Ansprechpartner erklärt die Optionen verständlich und begleitet den weiteren Ablauf.',
    },
  ],
}

export const BUSINESS_SITUATIONS = {
  label: 'Besondere Situationen',
  title: 'Bei mehreren Standorten oder höheren Verbrauchsmengen',
  description:
    'Besonders relevant bei mehreren Standorten, höheren Verbrauchsmengen oder auslaufenden Gewerbeverträgen.',
  items: [
    {
      title: 'Mehrere Standorte',
      desc: 'Filialen, Liegenschaften oder Gruppen können gemeinsam betrachtet werden.',
    },
    {
      title: 'Höhere Verbrauchsmengen',
      desc: 'Bei höherem Strom- oder Gasbedarf prüfen wir passende gewerbliche Optionen.',
    },
    {
      title: 'Auslaufende Verträge',
      desc: 'Wir helfen, Fristen und Wechselzeitpunkte frühzeitig einzuplanen.',
    },
  ],
}

export const BUSINESS_PROCESS = {
  label: 'Ablauf',
  title: 'So läuft die Anfrage ab',
  description: 'Klarer Prozess in wenigen Schritten — ohne Verpflichtung.',
  steps: [
    {
      nr: '01',
      title: 'Anfrage stellen',
      desc: 'Kurz Situation, Standorte und Kontaktdaten angeben.',
    },
    {
      nr: '02',
      title: 'Situation prüfen',
      desc: 'Wir sichten Ihre Angaben und vorhandene Vertragsdaten.',
    },
    {
      nr: '03',
      title: 'Optionen einordnen',
      desc: 'Geeignete Angebote werden über ausgewählte Energiepartner koordiniert.',
    },
    {
      nr: '04',
      title: 'Persönliches Gespräch',
      desc: 'Ein Ansprechpartner erläutert die nächsten Schritte verständlich.',
    },
    {
      nr: '05',
      title: 'Umsetzung optional',
      desc: 'Nur wenn Sie möchten, begleiten wir den Wechselprozess.',
    },
  ],
}

export const BUSINESS_ROLE = {
  label: 'Rollenklärung',
  title: 'Unsere Rolle — klar und transparent',
  body:
    'DeinTarifheld unterstützt Unternehmen bei der Erfassung ihrer Versorgungssituation und der Vermittlung geeigneter Energieangebote über ausgewählte Energiepartner. Der Liefervertrag kommt mit dem jeweiligen Energieversorger zustande.',
  details: [
    'DeinTarifheld ist kein Stromlieferant und kein Energieversorger.',
    'Noah Bez handelt als selbständiger Handelsvertreter für die TELESON Vertriebs GmbH.',
    'Eine Vergütung kann über Partnerprovisionen erfolgen, wenn ein vermittelter Vertrag zustande kommt.',
    'Für Sie ist die Anfrage kostenlos und unverbindlich.',
  ],
}

export const BUSINESS_FORM = {
  label: 'Anfrage',
  title: 'Unternehmensanfrage stellen',
  description:
    'Für eine erste Einschätzung reichen wenige Angaben. Anschließend besprechen wir persönlich, welche Vertrags- und Verbrauchsdaten für eine konkrete Angebotsprüfung benötigt werden.',
  trustItems: [
    'Kostenlos und unverbindlich',
    'Persönlicher Ansprechpartner',
    'Keine automatische Vertragsänderung',
    'Datenweitergabe nur im Rahmen der Anfrage',
  ],
  formHeading: 'Unternehmensanfrage',
  successTitle: 'Anfrage eingegangen',
  successText:
    'Vielen Dank. Wir haben Ihre Angaben erhalten und melden uns persönlich bei Ihnen.',
  submitLabel: 'Versorgungssituation unverbindlich prüfen lassen',
  nextLabel: 'Weiter zu den Kontaktdaten',
  microcopy:
    'DeinTarifheld vermittelt Energietarife über ausgewählte Partner. Der Liefervertrag kommt mit dem jeweiligen Energieversorger zustande. Die Anfrage ist kostenlos und unverbindlich.',
  dsgvoTextPrefix: 'Ich habe die',
  dsgvoTextSuffix: 'zur Kenntnis genommen.*',
}

export const BUSINESS_FAQ = {
  label: 'FAQ',
  title: 'Häufige Fragen von Unternehmen',
  items: [
    {
      q: 'Ist DeinTarifheld mein neuer Energieversorger?',
      a: 'Nein. DeinTarifheld vermittelt geeignete Angebote. Der Liefervertrag kommt mit dem jeweiligen Energieversorger zustande.',
    },
    {
      q: 'Warum können kleine Preisunterschiede bei Gewerbeverbräuchen relevant sein?',
      a: 'Weil sich der Arbeitspreis je Kilowattstunde mit dem Jahresverbrauch multipliziert. Ein beispielhafter Unterschied von 1 Cent je kWh entspricht bei 100.000 kWh rechnerisch 1.000 € pro Jahr — bei höheren Verbräuchen entsprechend mehr. Das sind reine Rechenbeispiele und keine Ersparnisgarantie; das tatsächliche Ergebnis hängt von Verbrauch, Vertragsstand, Preisbestandteilen und verfügbaren Angeboten ab.',
    },
    {
      q: 'Wann sollte ein Unternehmen Strom- oder Gasverträge prüfen lassen?',
      a: 'Besonders vor einer Vertragsverlängerung oder einem Neuabschluss, bei verändertem Verbrauch, mehreren Standorten, einer Betriebserweiterung oder wenn längere Zeit kein strukturierter Angebotsvergleich erfolgt ist. Die Prüfung ist unverbindlich und führt nicht automatisch zu einer Vertragsänderung.',
    },
    {
      q: 'Was kostet die Anfrage?',
      a: 'Die Anfrage und Erstprüfung sind für Sie kostenlos und unverbindlich. Eine Vergütung kann über Partnerprovisionen erfolgen, wenn ein vermittelter Vertrag zustande kommt.',
    },
    {
      q: 'Für welche Unternehmen eignet sich das?',
      a: 'Für Gewerbebetriebe, Gastronomie, Autohäuser, Pflegeeinrichtungen, Produktion, Filialbetriebe, Hausverwaltungen sowie Unternehmen mit mehreren Standorten oder höheren Verbräuchen.',
    },
    {
      q: 'Welche Angaben benötigen Sie für eine erste Anfrage?',
      a: 'Für den ersten Kontakt reichen Unternehmens- und Kontaktdaten sowie eine kurze Einschätzung Ihrer Versorgungssituation. Exakte Verbrauchsangaben sind optional und können später ergänzt werden. Für eine konkrete Angebotsprüfung sind in der Regel Jahresverbrauch, Vertragslaufzeit und eine aktuelle Rechnung hilfreich.',
    },
    {
      q: 'Können mehrere Standorte berücksichtigt werden?',
      a: 'Ja. Mehrere Standorte und Filialstrukturen können gemeinsam betrachtet werden.',
    },
  ],
}

export const BUSINESS_FINAL_CTA = {
  title: 'Bereit für eine unverbindliche Unternehmensanfrage?',
  description:
    'Prüfen Sie, ob Ihre Strom- und Gasverträge noch zur aktuellen Versorgungssituation passen — besonders bei hohen Verbräuchen, mehreren Standorten oder anstehender Verlängerung. Wir melden uns persönlich und koordinieren passende Optionen über ausgewählte Energiepartner.',
  primaryCta: 'Versorgungssituation unverbindlich prüfen lassen',
  secondaryCta: 'kontakt@deintarifheld.de',
  secondaryHref: 'mailto:kontakt@deintarifheld.de',
}
