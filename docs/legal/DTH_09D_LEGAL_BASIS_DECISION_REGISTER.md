# DTH-09D Legal Basis Decision Register

STATUS=NOAH_BUSINESS_DECISION_CAPTURED  
LEGAL_REVIEW_STATUS=NOT_EXTERNAL_LEGAL_ADVICE  
PUBLICATION_AUTHORIZED=YES  
PUBLIC_PRIVACY_DOCUMENT_SHA256=b9ac4d9235e0a6116389604d23997070b65ac92a55466792cd4e2629af47ab37  
CAREER_RELATIONSHIP=SELF_EMPLOYED_PARTNER  
FORM_CONSENT_MODE=ACKNOWLEDGEMENT_ONLY  
WORKSTREAM=DTH-09D-PUBLIC-CUTOVER  
CAPTURED_AT=2026-08-01  

Dieses Dokument ist intern und nicht Teil der öffentlichen Website.  
Keine Rechtskonformitätsgarantie. Keine externe Rechtsberatung.

---

## 1. Checkbox-Entscheidung

| Feld | Wert |
|---|---|
| FORM_PRIVACY_MODE | ACKNOWLEDGEMENT_NOT_CONSENT |
| Sichtbarer Wortlaut | Ich habe die Datenschutzerklärung zur Kenntnis genommen.* |
| Pflichtfeld | JA |
| Bedeutung | PRIVACY_NOTICE_ACKNOWLEDGED=YES |
| Keine Bedeutung | CONSENT_LEGAL_BASIS=NO |
| Art. 6 Abs. 1 lit. a | nicht verwendet für Formular-Anfragen |
| Widerrufsversprechen in Checkbox | NEIN |

Technische Feldnamen `gdpr` / `dsgvo` / `privacyAccepted` bleiben aus Kompatibilitätsgründen erhalten und bedeuten nur die Kenntnisnahme-Bestätigung.

---

## 2. Privatkunden-Rechtsgrundlage

| Feld | Wert |
|---|---|
| Zweck | unverbindliche Tarifanalyse, Kontaktaufnahme und vorvertragliche Bearbeitung auf ausdrückliche Anfrage der betroffenen Person |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b DSGVO |
| Checkbox | keine Rechtsgrundlage |

---

## 3. Unternehmensanfrage – Unternehmer

| Feld | Wert |
|---|---|
| Fall | Unternehmer bzw. natürliche Person fragt für das eigene Unternehmen an |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b DSGVO |
| Zweck | vorvertragliche Bearbeitung einer geschäftlichen Energieanfrage |

---

## 4. Unternehmensanfrage – Ansprechpartner

| Feld | Wert |
|---|---|
| Fall | Ansprechpartner oder Beschäftigter fragt für ein Unternehmen an |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. f DSGVO |
| Berechtigtes Interesse | Bearbeitung geschäftlicher Anfragen, Kommunikation mit dem anfragenden Unternehmen und Vorbereitung einer möglichen geschäftlichen Zusammenarbeit |

---

## 5. Partneranfrage (Karrierepfad)

| Feld | Wert |
|---|---|
| CAREER_RELATIONSHIP_TYPE | SELF_EMPLOYED_SALES_PARTNER_OR_COMMERCIAL_AGENT |
| EMPLOYMENT_RELATIONSHIP_OFFERED | NO |
| EMPLOYMENT_APPLICATIONS_ACCEPTED | NO |
| SECTION_26_BDSG | NOT_APPLICABLE_TO_CURRENT_PATH |
| CAREER_FILE_UPLOADS | NO |
| Primäre Rechtsgrundlage | Art. 6 Abs. 1 lit. b DSGVO |
| Begründung | Verarbeitung auf Anfrage der betroffenen Person zur Prüfung und Vorbereitung einer möglichen selbstständigen vertraglichen Zusammenarbeit |
| Fallback | NONE |

Sichtbare Positionierung: selbstständige Tätigkeit als Energieberater beziehungsweise Vertriebspartner; Formular = Interessen-/Partneranfrage; kein Arbeitsverhältnis.

---

## 6. Website-Hosting und Sicherheitslogs

| Feld | Wert |
|---|---|
| Rechtsgrundlage | Art. 6 Abs. 1 lit. f DSGVO |
| Berechtigtes Interesse | sicherer, stabiler und missbrauchsgeschützter Betrieb der Website |

---

## 7. Supabase-Speicherung

Keine eigenständige neue Rechtsgrundlage.  
Die Speicherung folgt der Rechtsgrundlage des jeweiligen Hauptvorgangs (Privat-, Unternehmens- oder Partneranfrage).

---

## 8. Resend-interne Benachrichtigung

Keine Kundenbestätigung im Cutover-Stand.  
Die interne Benachrichtigung ist Bestandteil der Bearbeitung des jeweiligen Hauptvorgangs.  
Für technische Zustellungs-, Sicherheits- und Fehlerprotokolle: Art. 6 Abs. 1 lit. f DSGVO.

---

## 9. Audit Events und Missbrauchsschutz

| Feld | Wert |
|---|---|
| Rechtsgrundlage | Art. 6 Abs. 1 lit. f DSGVO |
| Berechtigtes Interesse | Nachvollziehbarkeit, Systemsicherheit, Fehleranalyse und Verhinderung von Missbrauch oder Mehrfacheinreichungen |

---

## 10. Weitergabe TELESON

Nur soweit erforderlich zur Durchführung einer ausdrücklich angefragten Tarifanalyse, Angebotsprüfung oder Vertragsanbahnung.  
Grundentscheidung: Art. 6 Abs. 1 lit. b DSGVO.  
Keine pauschale Weitergabe unabhängig von einer Anfrage.

---

## 11. Weitergabe Energieversorger

Nur soweit erforderlich zur Durchführung einer ausdrücklich angefragten Tarifanalyse, Angebotsprüfung oder Vertragsanbahnung.  
Grundentscheidung: Art. 6 Abs. 1 lit. b DSGVO.

---

## 12. Lösch-/Betroffenenprozesse

Keine neue Formular-Rechtsgrundlage.  
Intern: Bearbeitung gesetzlicher Betroffenenrechte und Erfüllung rechtlicher Verpflichtungen (u. a. Art. 12–22 DSGVO, einschlägige Löschpflichten).

---

## 13. Ausdrücklich ausgeschlossene Grundlagen

- Art. 6 Abs. 1 lit. a DSGVO als pauschale Grundlage aller Formulare
- Checkbox als Einwilligung
- § 26 BDSG für den aktuellen Partnerpfad
- Beschäftigungsbewerbung / Arbeitsverhältnis über `/karriere/`

---

## 14. Offene Provider-/Transfer-Evidence

Intern offen und **nicht** öffentlich als „offen“ zu publizieren; Folge-Workstream DTH-09D2:

- Checkdomain AVV/DPA
- Vercel Plan + DPA-Anwendbarkeit + Transferregeln
- Supabase Projektregion + DPA
- Resend DPA + Transfermechanismen
- Unterauftragsverarbeiter
- internationale Übermittlungen / Garantien (DPF/SCC nur mit Evidence)

PUBLICATION_AUTHORIZED=YES für den freigegebenen öffentlichen Datenschutztext
(`b9ac4d9235e0a6116389604d23997070b65ac92a55466792cd4e2629af47ab37`).
Checkdomain-AVV bleibt separater Compliance-Follow-up und blockiert diesen
Text-Publish nicht.
