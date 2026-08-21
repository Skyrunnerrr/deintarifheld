# A14-02 Owner Master Decision Pack

Normalized from A5–A13 packs + A4 result flags. **No decisions invented.** E2 may remain green while these stay OPEN.

## Classes

- `MUST_DECIDE_BEFORE_SECURITY`
- `MUST_DECIDE_BEFORE_PROVIDER_BUILD`
- `MUST_DECIDE_BEFORE_STAGING`
- `MUST_DECIDE_BEFORE_CANARY`
- `MUST_DECIDE_BEFORE_AUTONOMOUS_PRODUCTION`
- `CAN_DEFER_POST_LAUNCH`

## MUST_DECIDE_BEFORE_SECURITY

| ID | Domain | Decision | Evidence |
|----|--------|----------|----------|
| OD-A11-AUTH-PROVIDER | A11 | **APPROVED = SUPABASE_AUTH** (AuthN only; AuthZ remains DTH) | Recorded A14; implementation NOT_PROVEN |
| OD-A11-SESSION-POLICY | A11 | Absolute/inactivity/concurrent session + reauth (not invented yet) | OPEN; MFA method chosen (TOTP/aal2) but lifetimes undecided |
| OD-A6-MALWARE | A6 | Malware scanner before customer uploads | Unresolved; no live scanner |
| OD-A9-PAYMENT-DATA | A9 | Bank/SEPA handling if required | Review required; omitted in E2 |
| OD-A13-TRACKING | A13 | Tracking/consent before live acquisition tracking | No cookies in E2; flag true |

## MUST_DECIDE_BEFORE_PROVIDER_BUILD

| ID | Domain | Decision |
|----|--------|----------|
| OD-A4-RESEND-INBOUND | A4 | Live mail provider / Resend posture |
| OD-A5-CALENDAR-PROVIDER | A5 | Google / Graph / other + DPA |
| OD-A6-STORAGE | A6 | Production object storage |
| OD-A6-OCR | A6 | OCR SaaS or none |
| OD-A7-LIVE-TARIFF-SOURCE | A7 | Live tariff source |
| OD-A9-LIVE-SWITCH-PROVIDER | A9 | Live switch provider |
| OD-A10-LIFECYCLE-PROVIDER | A10 | Live lifecycle/readback provider |
| OD-A12-AI | A12 | Content AI provider (or remain NOT_DEPLOYED) |
| OD-A12-PUBLISHING | A12 | Publishing provider + accounts |
| OD-A13-PROVIDER | A13 | Paid media provider + accounts |

## MUST_DECIDE_BEFORE_STAGING

| ID | Domain | Decision |
|----|--------|----------|
| OD-A4-FOLLOWUP-CADENCE | A4 | Live CommunicationPolicy cadence |
| OD-A5-BOOKING-POLICY | A5 | TZ, hours, lead, horizon, reminders, cancel |
| OD-A6-DOC-REQUEST-COMMS | A6 | DOCUMENT_REQUEST purpose/comms |
| OD-A7-COMMERCIAL-POLICY | A7 | Ranking, VAT/net-gross, import, commission |
| OD-A8-COMMERCIAL | A8 | Selection, approval, follow-up |
| OD-A9-SWITCH-POLICY | A9 | Submission approval, multi-supply |
| OD-A10-RENEWAL-POLICY | A10 | Renewal timing + renewal comms |
| OD-A11-DEPLOYMENT | A11 | Hosted CC runtime model |
| OD-A11-ROLE-POLICY | A11 | Freeze role→capability (+ M11J); VIEWER/OPERATOR/APPROVER/OWNER |
| OD-A11-GLOBAL-KILL | A11 | Who may activate global kill / break-glass |
| OD-A12-CONTENT-POLICY | A12 | Strategy, claims, autopublish |
| OD-A13-ACQUISITION-POLICY | A13 | Budget caps, attribution model |
| OD-A14-BRANCH-CONVERGENCE | Platform | Keep lines separate vs later merge strategy |

## MUST_DECIDE_BEFORE_CANARY

| ID | Domain | Decision |
|----|--------|----------|
| OD-A8-LEGAL-TEXT | A8 | Customer-facing legal/template wording |
| OD-A8-ACCEPTANCE-EFFECT | A8 | Acceptance semantics (≠ invented QES) |
| OD-A9-LIVE-SUBMISSION-MODE | A9 | Approval-gated vs higher autonomy |
| OD-A13-AUTO-ACTIVATION | A13 | Paid auto-activation forbidden until approved |
| OD-A13-KILL-RUNNING | A13 | Kill behavior for already-running campaigns |
| OD-A14-CANARY-SCOPE | Platform | First canary domain + abort criteria |

## MUST_DECIDE_BEFORE_AUTONOMOUS_PRODUCTION

| ID | Domain | Decision |
|----|--------|----------|
| OD-A5-APPT-RETENTION | A5 | Appointment retention |
| OD-A6-RETENTION | A6 | Document retention/DSR |
| OD-A8-RETENTION | A8 | Offer retention |
| OD-A9-RETENTION | A9 | Switch retention |
| OD-A10-RETENTION | A10 | Lifecycle retention |
| OD-A11-AUDIT-RETENTION | A11 | Audit retention + monitoring ownership |
| OD-A12-RETENTION | A12 | Content retention |
| OD-A13-ROAS-AUTHORITY | A13 | Revenue/ROAS finance authority |
| OD-A14-STABILITY-PERIOD | Platform | E6 observation period |

## CAN_DEFER_POST_LAUNCH

| ID | Domain | Decision |
|----|--------|----------|
| OD-A6-UPLOAD-UI | A6 | Full customer upload UX polish (if storage path exists) |
| OD-A8-PDF | A8 | Offer PDF generation |
| OD-A12-MEDIA | A12 | Image generation |


## Approved decisions

### OD-A11-AUTH-PROVIDER

```text
DECISION=SUPABASE_AUTH
STATUS=APPROVED
AUTH_SCOPE=COMMAND_CENTER_OPERATORS_ONLY
ACCOUNT_PROVISIONING=INVITE_ONLY
PUBLIC_OPERATOR_SIGNUP=DISABLED
PRIMARY_AUTH_METHOD=EMAIL_PASSWORD
MFA_METHOD=TOTP
MFA_REQUIRED=YES
MINIMUM_COMMAND_CENTER_AAL=aal2
SOCIAL_LOGIN=DISABLED_V1
MAGIC_LINK_OPERATOR_LOGIN=DISABLED_V1
SMS_MFA=DISABLED_V1
SESSION_TRANSPORT=SERVER_SIDE_COOKIE_SESSION
SERVER_AUTH_VERIFICATION=REQUIRED
AUTHENTICATION_AUTHORITY=SUPABASE_AUTH
AUTHORIZATION_AUTHORITY=DTH_SERVER_SIDE_CAPABILITY_MODEL
CLIENT_ROLE_AUTHORITY=NONE
JWT_USER_METADATA_ROLE_AUTHORITY=NONE
OPERATOR_ROLE_MAPPING=PRIVATE_SERVER_SIDE_SECURITY_DOMAIN
```

Invariants:
- Supabase Auth authenticates identity (`auth.users.id`)
- DTH/M11/A11 authorizes actions (capabilities)
- `user_metadata.role` / client role strings are **not** AuthZ authority
- Unprovisioned authenticated users get **zero** Command Center access
- TEST_* identities remain LOCAL_TEST only; production mode fail-closed

```text
BLOCKS_SECURITY=NO_PROVIDER_DECISION_BLOCK
BLOCKS_STAGING=IMPLEMENTATION_AND_PROOF_STILL_REQUIRED
BLOCKS_PRODUCTION=IMPLEMENTATION_AND_PROOF_STILL_REQUIRED
AUTH_IMPLEMENTATION=NOT_PROVEN
MFA_IMPLEMENTATION=NOT_PROVEN
STAGING_AUTH=NOT_PROVEN
PRODUCTION_AUTH=NOT_PROVEN
STRONG_AUTHZ=NOT_PROVEN
SECURITY_FOR_STAGING=NOT_PASS
```

Related open:
- `OD-A11-SESSION-POLICY`
- `OD-A11-ROLE-POLICY`
- `OD-A11-DEPLOYMENT` (Command Center hosting)

## First blocking Owner action

~~`OWNER_DECISION_REQUIRED:OD-A11-AUTH-PROVIDER`~~ **RESOLVED**

Next security track (not Owner provider choice):

`M11_SECURITY_GATE:M11F_RUNTIME_LOGIN_ROLES`
