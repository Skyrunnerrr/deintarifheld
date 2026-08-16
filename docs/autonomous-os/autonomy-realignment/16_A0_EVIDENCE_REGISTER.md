# A0 Evidence Register

| Claim | Path | Level |
|-------|------|-------|
| Worker is one-shot stub | `packages/workers/src/one-shot-runner.js` | E2 |
| Autonomy flags NO | same + `worker-stub.test.js` | E2/E3 |
| Lead intake | `app/api/leads/route.js` | E2 |
| Mail Resend | `lib/leads/mail.js` | E2 |
| Outbox claim local | `packages/db/src/outbox-claim.js` | E2 |
| Draft cases/outbox SQL | `packages/db/migrations/drafts/p3-f2a/` | E1/E2 |
| Active migrations only 001/002/M11E | `supabase/migrations/` | E2 |
| CC read-only local | `packages/cc/package.json` | E2 |
| Kill in-memory | `packages/ops-api/src/kill/` | E2 |
| Agent deferred | `docs/autonomous-os/07_IMPLEMENTATION_PLAN.md` §23 | E1 |
| M11F–V remaining | same §24 | E1 |
| Architecture dual-plane | `docs/autonomous-os/02_ARCHITECTURE.md` | E1 |
| Baseline SHA | git `2195872af240e422da274f8b6cc19e4fc0fb3892` | E2 |
