# Phase A Infrastructure Automation

Vercel + Supabase + Resend. **Checkdomain API wird nicht genutzt** (kein kostenpflichtiger API-Zugang).

## External credentials

| Variable | Pflicht |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | ja |
| `RESEND_API_KEY` | ja |
| `CONTROLLED_TEST_EMAIL` | ja |

Intern auto: `CRON_SECRET`, `LEADS_ADMIN_SECRET`
Vercel: CLI-Session (`npx vercel whoami`)

## DNS / Mail

- Keine automatischen DNS-Writes bei Checkdomain
- Preview/Smoke: `LEADS_MAIL_MODE=mock` + From `onboarding@resend.dev`
- Custom Domain `kontakt@deintarifheld.de` später optional (DNS manuell oder Nameserver→Vercel) — nicht Teil von Phase A

## Commands

```bash
npm run infra:phase-a:preflight
npm run infra:phase-a:plan
npm run infra:phase-a:apply -- --yes
npm run infra:phase-a:smoke
```
