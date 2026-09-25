# Current production release gate

Status: ACTIVE  
Updated: 2026-09-25  
Production mutation from this document: NONE

This file is the current operational release gate. Older PR-specific runbooks and dated environment matrices are evidence only and must not be used to overwrite current production settings.

## Production mail state already proven

The production form/mail path has been exercised with a fresh private lead.

For lead reference `HER-20260923191420-A67D0W`:

- customer confirmation was received at the submitted customer mailbox
- the matching internal notification to `kontakt@deintarifheld.de` was shown as `Delivered` by Resend
- an earlier stale Resend suppression on `kontakt@deintarifheld.de` was removed before the successful test
- normal external mail to `kontakt@deintarifheld.de` reaches the Checkdomain mailbox
- Checkdomain forwarding from `kontakt@deintarifheld.de` to the central Google mailbox was subsequently tested successfully from an external sender

Therefore the customer-confirmation path is not an open proof item anymore.

## Intended mail routing

Application mail should use one official internal recipient:

```text
Resend
  -> kontakt@deintarifheld.de
     -> Checkdomain mailbox
     -> Checkdomain forwarding
        -> central Google mailbox
```

Do not send the same internal notification independently to both the Checkdomain address and the forwarded Google destination. That creates duplicate delivery once forwarding is active.

## Mandatory Vercel environment check before the next API redeploy

A temporary production environment edit set `LEADS_TO_EMAIL` to a comma-separated two-recipient value while mail routing was being debugged. The currently running deployment was created before that edit, but a future redeploy would ingest the edited environment.

Before any next production API redeploy:

1. set `LEADS_TO_EMAIL` back to exactly the official DTH recipient `kontakt@deintarifheld.de`
2. verify `LEADS_MAIL_MODE=live`
3. verify `ALLOW_CUSTOMER_MAIL=YES`
4. verify `LEADS_FROM_EMAIL` is the verified DTH sender
5. verify the Resend recipient suppression list does not contain the official DTH recipient
6. do not print `RESEND_API_KEY`, admin/cron secrets, Supabase service role or reCAPTCHA API key while checking

Environment changes alone are not proof of the active deployment. Record the deployment ID/SHA after redeploy.

## API release blockers

The audit branch must not be deployed until all of the following are true:

- pull-request CI is green on the exact head SHA
- production Supabase server URL is confirmed under the canonical `SUPABASE_URL` name or the documented compatibility fallback is consciously retained
- production reCAPTCHA Enterprise variables are present
- production rate limiting is Supabase-backed and memory override is not enabled
- static output is built from the merged main SHA
- Checkdomain backup is fresh and manifest-verified
- static output verifier passes
- no legacy Google Apps Script endpoint exists in generated output
- no production smoke bypass is enabled

## Controlled post-release proof

After a future approved release, use one fresh internal test identity and verify:

1. real browser form submit succeeds
2. Enterprise reCAPTCHA Assessment succeeds with the expected action/hostname
3. exactly one lead row exists
4. exactly one internal notification is accepted by Resend for `kontakt@deintarifheld.de`
5. the Checkdomain forwarding copy reaches the central Google mailbox
6. exactly one customer confirmation is sent
7. stored mail status and audit events match the actual partial/full delivery state
8. duplicate retry with the same idempotency key does not create a second row or resend
9. admin inbox requires authentication and displays the test row
10. cleanup uses an explicit approved deletion mode

No production write is authorized merely by this checklist.
