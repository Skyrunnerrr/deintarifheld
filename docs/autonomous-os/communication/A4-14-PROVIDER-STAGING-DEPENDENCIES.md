# A4-14 Provider Staging Dependencies

Not performed in A4 E2.

- M11F/G worker role minimum grants for `ops` communication tables
- M11H/I/J/K/L/M as applicable
- M11N session/control
- M11P staging E2E
- Resend sending domain + API secret custody
- Resend receiving domain / MX / reply address (NOT_FROZEN)
- Webhook endpoint + signing secret + event selection (`email.received`, delivery/bounce)
- Staging-only recipient protection
- Approved CommunicationPolicyV1 live cadence (`OWNER_FOLLOWUP_CADENCE_REQUIRED`)
- Secret never in client / jobs / audit

INBOUND_REPLY_ADDRESS=PROVIDER_CONFIGURATION_PENDING
